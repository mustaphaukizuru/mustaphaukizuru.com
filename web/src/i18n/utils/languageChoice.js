/**
 * "Did a human pick a language?" — a question the i18next cache cannot answer.
 *
 * The detector in i18n/index.js is configured with
 * `caches: ["localStorage"]` on the key "preferred-language", so i18next
 * writes that key itself during init, before any component renders.
 * LanguageWrapper's Spanish-first redirect read it as "the visitor already
 * chose a language" and bailed out — which was true on every load, so the
 * redirect never ran once since it was written. A Spanish-speaking visitor
 * landing on the root got the English site and no way to know otherwise.
 *
 * So an explicit choice gets its own key, written in exactly one place:
 * useLanguage's setLang, which only runs when someone clicks the switcher.
 */
export const LANGUAGE_CHOICE_KEY = "ukz:lang-choice"

/** True only when a human has picked a language on this device. */
export function hasLanguageChoice() {
  if (typeof window === "undefined") return false
  try {
    return Boolean(window.localStorage.getItem(LANGUAGE_CHOICE_KEY))
  } catch {
    // Storage disabled or full. Treat it as "no choice recorded": the
    // redirect is the more helpful default for a non-English browser, and
    // it is capped to once per session by its own sessionStorage flag.
    return false
  }
}

/** The recorded choice ("en" | "es"), or null. */
export function readLanguageChoice() {
  if (typeof window === "undefined") return null
  try {
    const v = window.localStorage.getItem(LANGUAGE_CHOICE_KEY)
    return v === "en" || v === "es" ? v : null
  } catch {
    return null
  }
}
