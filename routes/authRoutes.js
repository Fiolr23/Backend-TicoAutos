const express = require("express");
const router = express.Router();
const { generateToken } = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", generateToken);

module.exports = router;