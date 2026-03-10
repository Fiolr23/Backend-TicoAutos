const mongoose = require("mongoose");

// Define los campos que tendrá cada vehículo en la base de datos
const vehicleSchema = new mongoose.Schema(
{
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  color: {
    type: String,
    required: true,
    trim: true
  },
  // Estado del vehículo
  status: {
    type: String,
    enum: ["disponible", "vendido"],
    default: "disponible"
  },
  // Usuario que publicó el vehículo
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
},
{
  timestamps: true
});

module.exports = mongoose.model("Vehicle", vehicleSchema);