import { forwardRef } from "react"
import { Link, NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { localizeTo, normaliseLang } from "../i18n/utils/localizeTo"

/**
 * LocalizedLink / LocalizedNavLink — a Link that keeps the reader's language.
 *
 * Thin wrappers. Every decision about whether a target gets the /es prefix
 * lives in i18n/utils/localizeTo.js, including the rule that the admin and
 * dashboard trees are never prefixed because they are not mirrored.
 *
 * The language comes from i18next rather than the URL, so a switch made
 * mid-session is reflected without waiting for a navigation.
 *
 * These two files are the only place in the public tree allowed to import
 * the raw router primitives; web/eslint.config.js enforces that.
 */

function useLang() {
  const { i18n } = useTranslation()
  return normaliseLang(i18n?.language)
}

const LocalizedLink = forwardRef(function LocalizedLink({ to, ...rest }, ref) {
  return <Link ref={ref} to={localizeTo(to, useLang())} {...rest} />
})

const LocalizedNavLink = forwardRef(function LocalizedNavLink({ to, ...rest }, ref) {
  // `end`, `caseSensitive` and the className/style callbacks pass through
  // untouched. NavLink compares against the localized `to`, which is the
  // path actually in the address bar — that is why the prefix has to be
  // applied before NavLink sees it, or nothing ever reads as active in /es.
  return <NavLink ref={ref} to={localizeTo(to, useLang())} {...rest} />
})

export { LocalizedLink, LocalizedNavLink }
export default LocalizedLink
