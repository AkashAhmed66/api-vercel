const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for a user
 * @param {Object} user - User object from database
 * @param {String} expiresIn - Optional expiration time (default: process.env.JWT_EXPIRES_IN)
 * @returns {String} JWT token
 */
const generateToken = (user, expiresIn = process.env.JWT_EXPIRES_IN) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: expiresIn }
  );

  return token;
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken
}; 