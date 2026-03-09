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
    // Actualiza el vehículo usando el id enviado en la URL
    const vehicleUpdated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        brand: req.body.brand,
        model: req.body.model,
        year: req.body.year,
        price: req.body.price,
        color: req.body.color
      },
      { new: true } // devuelve el vehiculo actualizado
    );
    if (!vehicleUpdated) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.status(200).json(vehicleUpdated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// DELETE
const vehicleDelete = async (req, res) => {
  try {
    // Elimina el vehículo usando su id
    const vehicleDeleted = await Vehicle.findByIdAndDelete(req.params.id);
    if (!vehicleDeleted) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.status(200).json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH - Marcar como vendido
const vehicleSold = async (req, res) => {
  try {
    // Cambia el estado del vehículo a vendido
    const vehicleUpdated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { status: "vendido" },
      { new: true }
    );
    if (!vehicleUpdated) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    res.status(200).json(vehicleUpdated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  vehiclePost,
  vehiclePut,
  vehicleDelete,
  vehicleSold
};