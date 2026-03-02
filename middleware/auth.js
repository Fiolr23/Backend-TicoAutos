const User = require("../models/user");
const bcrypt = require("bcryptjs");
/**
 * Valida token guardado en BD
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Authentication token required" });

  try {
    const user = await User.findOne({ token });

    if (!user) return res.status(401).json({ message: "Invalid or expired token" });

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error authenticating token" });
  }
};

/**
 * Login: genera token y lo guarda en el usuario
 */
const generateToken = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    // Comparación con hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    // Token: hash de email+password+fecha
    const token = await bcrypt.hash(email + password + Date.now(), 10);

    user.token = token;
    await user.save();

    return res.status(201).json({ token: user.token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error generating token" });
  }
};

module.exports = { authenticateToken, generateToken };