// B10 · 404 handler in dual-shape format
// Matches errorHandler.js response shape exactly.
function notFound(req, res) {
  const message = `Route not found: ${req.method} ${req.originalUrl}`

  return res.status(404).json({
    success: false,
    code:    "NOT_FOUND",
    message,
    error: {
      code:    "NOT_FOUND",
      message,
      details: { method: req.method, path: req.originalUrl },
    },
  })
}

module.exports = notFound
