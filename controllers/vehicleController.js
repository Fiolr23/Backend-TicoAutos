const Vehicle = require("../models/vehicle");

// POST - Crear vehículo
const vehiclePost = async (req, res) => {
  // Se crea un nuevo vehículo con los datos enviados en el body
  const vehicle = new Vehicle({
    brand: req.body.brand,
    model: req.body.model,
    year: req.body.year,
    price: req.body.price,
    color: req.body.color,
    userId: req.user._id // usuario que creó el vehículo
  });
  try {
    // Guarda el vehículo en la base de datos
    const vehicleCreated = await vehicle.save();

    // Header con la ubicación del nuevo recurso creado
    res.header("Location", `/api/vehicles?id=${vehicleCreated._id}`);
    res.status(201).json(vehicleCreated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// PUT - Editar vehículo
const vehiclePut = async (req, res) => {
  try {
    // Primero se busca el vehículo
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    // Se verifica que el usuario autenticado sea el dueño
    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot edit this vehicle" });
    }

    // Si es el dueño, se permite la actualización
    const vehicleUpdated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year,
        price: req.body.price,
        color: req.body.color
      },
      { new: true }
    );
    res.status(200).json(vehicleUpdated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE - Eliminar vehículo
const vehicleDelete = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    // Solo el dueño puede eliminarlo
    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot delete this vehicle" });
    }
    await Vehicle.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH - Marcar como vendido
const vehicleSold = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    // Solo el dueño puede marcarlo como vendido
    if (vehicle.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You cannot modify this vehicle" });
    }
    vehicle.status = "vendido";
    await vehicle.save();
    res.status(200).json(vehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET - Obtener vehículos con filtros y paginación
const vehicleGet = async (req, res) => {
  try {
    const {
      brand,
      model,
      minYear,
      maxYear,
      minPrice,
      maxPrice,
      status,
      page = 1,   
      limit = 10  
    } = req.query;

    // Objeto donde se irán agregando los filtros dinámicamente
    const filters = {};

    if (brand) filters.brand = brand;
    if (model) filters.model = model;
    if (status) filters.status = status;

    // Filtro por rango de año
    if (minYear || maxYear) {
      filters.year = {};
      if (minYear) filters.year.$gte = Number(minYear);
      if (maxYear) filters.year.$lte = Number(maxYear);
    }
    // Filtro por rango de precio
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = Number(minPrice);
      if (maxPrice) filters.price.$lte = Number(maxPrice);
    }
    // Se calcula cuántos registros saltar para la paginación
    const skip = (Number(page) - 1) * Number(limit);

    // Consulta a la base de datos con los filtros aplicados
    const vehicles = await Vehicle.find(filters)
      .populate("userId", "name lastname")
      .skip(skip)
      .limit(Number(limit));

    // Cuenta cuántos vehículos existen con esos filtros
    const total = await Vehicle.countDocuments(filters);

    res.status(200).json({
      total,
      page: Number(page),
      limit: Number(limit),
      results: vehicles
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET - Obtener un vehículo específico por id
const vehicleGetById = async (req, res) => {
  try {
    // Busca el vehículo usando el id que viene en la URL
    const vehicle = await Vehicle
      .findById(req.params.id)

      .populate("userId", "name lastname");

    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.status(200).json(vehicle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  vehiclePost,
  vehiclePut,
  vehicleDelete,
  vehicleSold,
  vehicleGet,
  vehicleGetById
};