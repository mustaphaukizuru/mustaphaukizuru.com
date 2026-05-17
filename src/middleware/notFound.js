// =============================================================================
// 404 handler — dual response shape (HTML for browsers, JSON for API clients)
//
// Why both shapes from one handler:
//   - The frontend SPA can hit non-existent /api/* routes — those callers want
//     a structured JSON error matching errorHandler.js (`success: false`,
//     `code: "NOT_FOUND"`, nested `error` object).
//   - But a human typing `https://mustaphaukizuru.com/typo` into a browser
//     deserves the branded /public/404.html page, not a raw JSON dump.
//
// How we tell them apart:
//   - Any path starting with /api/ is treated as an API request.
//   - For anything else, we honour the Accept header: text/html → HTML page,
//     anything else (curl, JS fetch with explicit application/json) → JSON.
//   - The HTML branch streams /public/404.html so updates to the static page
//     auto-propagate without a code change.
// =============================================================================

const fs   = require("fs")
const path = require("path")

// In production the SPA build copies web/public/* → public/, so public/ is the
// canonical runtime location. In development (`npm run dev` with no build) the
// source files live in web/public/ only. Resolve at startup once and use
// whichever path actually exists so both modes work.
const HTML_404_PATH = (() => {
  const built = path.join(__dirname, "..", "..", "public", "404.html")
  const src   = path.join(__dirname, "..", "..", "web", "public", "404.html")
  return fs.existsSync(built) ? built : src
})()

function wantsHtml(req) {
  if (req.originalUrl.startsWith("/api/")) return false
  const accept = String(req.headers.accept || "")
  if (!accept) return false
  // Browsers send `text/html,application/xhtml+xml,...`; APIs typically send
  // `application/json` or nothing. Treat the presence of text/html as the
  // signal that we should serve HTML.
  return accept.includes("text/html")
}

function notFound(req, res) {
  const message = `Route not found: ${req.method} ${req.originalUrl}`

  if (wantsHtml(req)) {
    // Try to serve the static HTML page. Fall through to JSON if the file
    // is missing for any reason (filesystem permissions, deploy mishap) so
    // we never end up with an empty 404.
    try {
      const html = fs.readFileSync(HTML_404_PATH, "utf8")
      res.status(404)
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.setHeader("Cache-Control", "no-store")
      return res.send(html)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[notFound] 404.html unreadable, falling back to JSON:", err.message)
    }
  }

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
