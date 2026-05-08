/**
 * detectLanguageFromPath(pathname) → "es" | "en"
 *
 * The single source of truth for "which language is this URL?". Mounted in
 * <LanguageWrapper> and consumed by every place that needs to know.
 */
export function detectLanguageFromPath(pathname = "/") {
  if (typeof pathname !== "string") return "en"
  return /^\/es(\/|$)/.test(pathname) ? "es" : "en"
}
