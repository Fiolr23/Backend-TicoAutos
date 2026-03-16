const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");

const Vehicle = require("../models/vehicle");
const {
  buildVehicleFilters,
  normalizeKeepImages,
  validateVehiclePayload,
} = require("../validations/vehicleValidation");

const VEHICLE_UPLOADS_DIR = path.join(__dirname, "..", "uploads", "vehicles");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toPublicImagePath = (file) => `/uploads/vehicles/${path.basename(file.filename || file.path || "")}`;

const cleanupUploadedFiles = async (files = []) => {
  await Promise.all(
    files.map(async (file) => {
      const filename = path.basename(file.filename || file.path || "");
      if (!filename) {
        return;
      }

      try {
        await fs.unlink(path.join(VEHICLE_UPLOADS_DIR, filename));
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("No se pudo borrar el archivo temporal:", error);
        }
      }
    })
  );
};

const cleanupImagePaths = async (imagePaths = []) => {
  await Promise.all(
    imagePaths.map(async (imagePath) => {
      const filename = path.basename(imagePath || "");
      if (!filename) {
        return;
      }

      try {
        await fs.unlink(path.join(VEHICLE_UPLOADS_DIR, filename));
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error("No se pudo borrar la imagen del vehiculo:", error);
        }
      }
    })
  );
};

const serializeVehicle = (vehicle) => {
  const data = vehicle.toObject ? vehicle.toObject() : vehicle;
  const owner = data.userId && typeof data.userId === "object" ? data.userId : null;

  return {
    ...data,
    owner,
  };
};

const getVehicles = async (req, res) => {
  try {
    const { filters, page, limit, skip } = buildVehicleFilters(req.query);

    const [results, total] = await Promise.all([
      Vehicle.find(filters)
        .populate("userId", "name lastname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(filters),
    ]);

    return res.json({
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      page,
      limit,
      results: results.map(serializeVehicle),
    });
  } catch (error) {
    console.error("Error listando vehiculos:", error);
    return res.status(500).json({ message: "No se pudieron cargar los vehiculos" });
  }
};

const getMyVehicles = async (req, res) => {
  try {
    const { page, limit, skip } = buildVehicleFilters(req.query);
    const filters = { userId: req.user._id };

    const [results, total] = await Promise.all([
      Vehicle.find(filters)
        .populate("userId", "name lastname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vehicle.countDocuments(filters),
    ]);

    return res.json({
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      page,
      limit,
      results: results.map(serializeVehicle),
    });
  } catch (error) {
    console.error("Error listando mis vehiculos:", error);
    return res.status(500).json({ message: "No se pudieron cargar tus vehiculos" });
  }
};

const getVehicleById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID de vehiculo invalido" });
    }

    const vehicle = await Vehicle.findById(req.params.id).populate("userId", "name lastname email");
    if (!vehicle) {
      return res.status(404).json({ message: "Vehiculo no encontrado" });
    }

    return res.json(serializeVehicle(vehicle));
  } catch (error) {
    console.error("Error cargando el vehiculo:", error);
    return res.status(500).json({ message: "No se pudo cargar el vehiculo" });
  }
};

const createVehicle = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const validation = validateVehiclePayload(req.body, {
      requireImages: true,
      imageCount: uploadedFiles.length,
    });

    if (!validation.ok) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: validation.message });
    }

    const vehicle = await Vehicle.create({
      ...validation.data,
      userId: req.user._id,
      images: uploadedFiles.map(toPublicImagePath),
    });

    const populatedVehicle = await Vehicle.findById(vehicle._id).populate("userId", "name lastname email");
    return res.status(201).json(serializeVehicle(populatedVehicle));
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    console.error("Error creando vehiculo:", error);
    return res.status(500).json({ message: "No se pudo crear el vehiculo" });
  }
};

const updateVehicle = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    if (!isValidObjectId(req.params.id)) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: "ID de vehiculo invalido" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ message: "Vehiculo no encontrado" });
    }

    if (vehicle.userId.toString() !== req.user._id.toString()) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(403).json({ message: "No puedes editar este vehiculo" });
    }

    const keepImages = normalizeKeepImages(req.body.keepImages).filter((image) => vehicle.images.includes(image));
    const nextImages = [...keepImages, ...uploadedFiles.map(toPublicImagePath)];

    if (nextImages.length > 6) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: "Solo puedes guardar hasta 6 imagenes" });
    }

    const validation = validateVehiclePayload(req.body, {
      requireImages: false,
      imageCount: nextImages.length,
    });

    if (!validation.ok) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: validation.message });
    }

    if (!nextImages.length) {
      await cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ message: "Debes conservar o subir al menos una imagen" });
    }

    const removedImages = vehicle.images.filter((image) => !keepImages.includes(image));

    Object.assign(vehicle, validation.data, { images: nextImages });
    await vehicle.save();
    await cleanupImagePaths(removedImages);

    const populatedVehicle = await Vehicle.findById(vehicle._id).populate("userId", "name lastname email");
    return res.json(serializeVehicle(populatedVehicle));
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    console.error("Error actualizando vehiculo:", error);
    return res.status(500).json({ message: "No se pudo actualizar el vehiculo" });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID de vehiculo invalido" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehiculo no encontrado" });
    }

    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No puedes eliminar este vehiculo" });
    }

    const imagesToDelete = [...vehicle.images];
    await vehicle.deleteOne();
    await cleanupImagePaths(imagesToDelete);

    return res.json({ message: "Vehiculo eliminado correctamente" });
  } catch (error) {
    console.error("Error eliminando vehiculo:", error);
    return res.status(500).json({ message: "No se pudo eliminar el vehiculo" });
  }
};

const markVehicleAsSold = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID de vehiculo invalido" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehiculo no encontrado" });
    }

    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No puedes actualizar este vehiculo" });
    }

    vehicle.status = "vendido";
    await vehicle.save();

    const populatedVehicle = await Vehicle.findById(vehicle._id).populate("userId", "name lastname email");
    return res.json(serializeVehicle(populatedVehicle));
  } catch (error) {
    console.error("Error marcando vehiculo como vendido:", error);
    return res.status(500).json({ message: "No se pudo marcar el vehiculo como vendido" });
  }
};

const updateVehicleStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "ID de vehiculo invalido" });
    }

    const { status } = req.body;
    if (!["disponible", "vendido"].includes(status)) {
      return res.status(400).json({ message: "El estado del vehiculo es invalido" });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehiculo no encontrado" });
    }

    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No puedes actualizar este vehiculo" });
    }

    vehicle.status = status;
    await vehicle.save();

    const populatedVehicle = await Vehicle.findById(vehicle._id).populate("userId", "name lastname email");
    return res.json(serializeVehicle(populatedVehicle));
  } catch (error) {
    console.error("Error actualizando el estado del vehiculo:", error);
    return res.status(500).json({ message: "No se pudo actualizar el estado del vehiculo" });
  }
};

module.exports = {
  createVehicle,
  deleteVehicle,
  getMyVehicles,
  getVehicleById,
  getVehicles,
  markVehicleAsSold,
  updateVehicleStatus,
  updateVehicle,
};
