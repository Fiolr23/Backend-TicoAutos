const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/auth");
const {
  answerQuestion,
  askQuestion,
  getChats,
  getMyQuestions,
  getOwnerQuestions,
  getVehicleQuestions,
} = require("../controllers/messageController");

router.get("/chats", authenticateToken, getChats);
router.post("/vehicle/:vehicleId", authenticateToken, askQuestion);
router.get("/mine", authenticateToken, getMyQuestions);
router.get("/owner", authenticateToken, getOwnerQuestions);
router.get("/vehicle/:vehicleId", authenticateToken, getVehicleQuestions);
router.post("/:id/answer", authenticateToken, answerQuestion);

module.exports = router;

