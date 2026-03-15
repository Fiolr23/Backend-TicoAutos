const express = require("express");
const router = express.Router();

const { authenticateToken } = require("../middleware/auth");
const {
  getMyConversations,
  getOwnerInbox,
  getConversationById,
  replyToConversation,
} = require("../controllers/messageController");

router.get("/mine", authenticateToken, getMyConversations);
router.get("/inbox", authenticateToken, getOwnerInbox);
router.get("/conversations/:id", authenticateToken, getConversationById);
router.post("/conversations/:id/messages", authenticateToken, replyToConversation);

module.exports = router;