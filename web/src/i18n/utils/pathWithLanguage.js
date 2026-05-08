/**
 * pathWithLanguage(currentPath, targetLang)
 *
 * Returns the equivalent URL path in the target language. The site uses URL
 * prefix routing: English at root, Spanish at `/es/*`.
 *
 *   pathWithLanguage("/about",      "es") => "/es/about"
 *   pathWithLanguage("/es/about",   "en") => "/about"
 *   pathWithLanguage("/",           "es") => "/es"
 *   pathWithLanguage("/es",         "en") => "/"
 *   pathWithLanguage("/es/store/x", "en") => "/store/x"
 */
export function pathWithLanguage(currentPath = "/", targetLang = "en") {
  if (typeof currentPath !== "string") currentPath = "/"
  // Strip an optional leading /es prefix.
  const stripped = currentPath.replace(/^\/es(?=\/|$)/, "") || "/"
  if (targetLang === "es") {
    return stripped === "/" ? "/es" : `/es${stripped}`
  }
  return stripped
}
