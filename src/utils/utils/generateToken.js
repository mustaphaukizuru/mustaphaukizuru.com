const jwt = require("jsonwebtoken")

/**
 * Generate JWT token
 * @param {object} user - { id, email, role }
 * @param {boolean} rememberMe - if true, token lasts 30 days; otherwise 1 day
 */
function generateToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? "30d" : (process.env.JWT_EXPIRES_IN || "7d")
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn }
  )
}

module.exports = generateToken
