/**
 * AppError · the single application error type.
 *
 * Replaces the three ad-hoc dialects that used to coexist:
 *   - Object.assign(new Error(msg), { statusCode, code })
 *   - buildError(code, msg, statusCode)   (cartService / serviceOrderService)
 *   - bare `new Error("...")` for user-facing validation failures
 *
 * errorHandler.js reads `statusCode`, `code` and `details` and emits the
 * dual-shape body, so any AppError thrown from a service reaches the client
 * with the intended HTTP status and machine-readable code.
 */
class AppError extends Error {
  constructor(message, { statusCode = 500, code = "INTERNAL", details } = {}) {
    super(message)
    this.name       = "AppError"
    this.statusCode = statusCode
    this.code       = code
    if (details !== undefined) this.details = details
    Error.captureStackTrace?.(this, AppError)
  }

  static badRequest(message, code = "BAD_REQUEST", details)  { return new AppError(message, { statusCode: 400, code, details }) }
  static unauthorized(message, code = "UNAUTHORIZED", details) { return new AppError(message, { statusCode: 401, code, details }) }
  static forbidden(message, code = "FORBIDDEN", details)      { return new AppError(message, { statusCode: 403, code, details }) }
  static notFound(message, code = "NOT_FOUND", details)       { return new AppError(message, { statusCode: 404, code, details }) }
  static conflict(message, code = "CONFLICT", details)        { return new AppError(message, { statusCode: 409, code, details }) }

  static isAppError(err) { return err instanceof AppError }
}

module.exports = AppError
