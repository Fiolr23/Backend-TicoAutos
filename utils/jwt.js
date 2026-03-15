const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "utn-api-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const signAccessToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const buildAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  lastname: user.lastname,
  email: user.email,
});

module.exports = { signAccessToken, buildAuthUser, JWT_SECRET };
