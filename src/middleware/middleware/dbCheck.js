// ─────────────────────────────────────────────────────────────────────────────
// DB availability check — wraps route handlers to catch DB connection errors
// early and return a clean 503 response instead of crashing.
// ─────────────────────────────────────────────────────────────────────────────

const DB_ERROR_CODES = ["P1001","P1002","P1003","P1008","P1009","P1010"];

function isDbError(err) {
  if (!err) return false;
  const msg = err.message || "";
  return (
    msg.includes("Can't reach database") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection refused") ||
    DB_ERROR_CODES.includes(err.code)
  );
}

/**
 * Wraps an async controller to catch DB unreachable errors and return 503.
 * Usage: router.get("/path", dbGuard(myController))
 */
function dbGuard(handler) {
  return async function (req, res, next) {
    try {
      await handler(req, res, next);
    } catch (err) {
      if (isDbError(err)) {
        console.error("[dbGuard] DB unreachable:", err.message);
        return res.status(503).json({
          success: false,
          message: "Database is temporarily unavailable. Please try again later.",
          code: "DB_UNAVAILABLE",
        });
      }
      next(err);
    }
  };
}

module.exports = { dbGuard, isDbError };
