const express = require("express");
const router = express.Router();

const {
  vehiclePost,
  vehiclePut,
  vehicleDelete,
  vehicleSold,
  vehicleGet,
  vehicleGetById
} = require("../controllers/vehicleController");

const { authenticateToken } = require("../middleware/auth");

router.get("/", vehicleGet);
router.get("/:id", vehicleGetById);

// Crear vehículo (requiere login)
router.post("/", authenticateToken, vehiclePost);

// Editar vehículo
router.put("/:id", authenticateToken, vehiclePut);

// Eliminar vehículo
router.delete("/:id", authenticateToken, vehicleDelete);

// Marcar vehículo como vendido
router.patch("/:id/sold", authenticateToken, vehicleSold);

module.exports = router;