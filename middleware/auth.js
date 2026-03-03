const User = require("../models/user");
const bcrypt = require("bcryptjs");

/**
 * Middleware: revisa si viene token y si existe en la BD.
 * Si existe, deja pasar y pega el usuario en req.user
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Error authenticating token:", error);
    return res.status(500).json({ message: "Error authenticating token" });
  }
};

/**
 * Login: valida email+password, genera token, lo guarda en BD y lo devuelve.
 */
const generateToken = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Comparar contraseña con hash guardado
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Token "simple": hash con algo que cambie (Date.now) para que no sea igual siempre
    const token = await bcrypt.hash(email + password + Date.now(), 10);

    user.token = token;
    await user.save();

    return res.status(201).json({
      message: "Login exitoso",
      token: user.token,
      user: { id: user._id, name: user.name, lastname: user.lastname, email: user.email },
    });
  } catch (error) {
    console.error("Error generating token:", error);
    return res.status(500).json({ message: "Error generating token" });
  }
};

/**
 * Logout: borra token en BD para que deje de servir.
 * Requiere que venga autenticado.
 */
const logout = async (req, res) => {
  try {
    req.user.token = null;
    await req.user.save();
    return res.json({ message: "Logout exitoso" });
  } catch (error) {
    console.error("Error logout:", error);
    return res.status(500).json({ message: "Error en logout" });
  }
};

module.exports = { authenticateToken, generateToken, logout };