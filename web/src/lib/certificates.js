/* Certificate helpers shared by the tile, the modal and the cover-flow rail.
 * Lives outside CertificatePreview.jsx so that file only exports components
 * (react-refresh/only-export-components). */

// Heuristic — is this src renderable inline as a PDF? Same-origin paths
// (`/documents/...`) and explicit `.pdf` URLs qualify. Cross-origin issuer
// verify pages (`https://coursera.org/verify/abc`) do not.
export function isRenderablePdf(src) {
  if (!src) return false
  const s = String(src).trim()
  if (!s || s === "#") return false
  if (s.startsWith("/")) return true // same-origin static
  if (s.startsWith(".")) return true // relative
  if (/\.pdf($|\?)/i.test(s)) {
    try {
      if (typeof window !== "undefined") {
        const u = new URL(s, window.location.origin)
        return u.origin === window.location.origin
      }
    } catch { /* fallthrough */ }
    return false
  }
  return false
}
