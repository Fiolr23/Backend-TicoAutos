const express = require("express");

const { authenticateToken } = require("../middleware/auth");
const { uploadVehicleImages } = require("../middleware/uploadVehicleImages");
const {
  createVehicle,
  deleteVehicle,
  getMyVehicles,
  getVehicleById,
  getVehicles,
  markVehicleAsSold,
  updateVehicleStatus,
  updateVehicle,
} = require("../controllers/vehicleController");

const router = express.Router();

const runVehicleUpload = (req, res, next) => {
  uploadVehicleImages(req, res, (error) => {
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return next();
  });
};

router.get("/", getVehicles);
router.get("/mine", authenticateToken, getMyVehicles);
router.get("/:id", getVehicleById);
router.post("/", authenticateToken, runVehicleUpload, createVehicle);
router.put("/:id", authenticateToken, runVehicleUpload, updateVehicle);
router.delete("/:id", authenticateToken, deleteVehicle);
router.patch("/:id/sold", authenticateToken, markVehicleAsSold);
router.patch("/:id/status", authenticateToken, updateVehicleStatus);

module.exports = router;
