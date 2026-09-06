/* eslint-disable no-restricted-imports -- the one place useNavigate is
   allowed; the public tree imports this instead. */
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"

import { useTranslation } from "react-i18next"

import { localizeTo, normaliseLang } from "../i18n/utils/localizeTo"

/**
 * useLocalizedNavigate — useNavigate that keeps the reader's language.
 *
 * The companion to LocalizedLink for programmatic navigation: a form that
 * redirects after submit, a "continue" handler, a guard that bounces
 * somewhere else. Same failure without it — navigate("/store") from
 * /es/checkout drops the visitor into English, because LanguageWrapper
 * reads the language off the URL prefix.
 *
 * Signature is useNavigate's, unchanged: navigate(to, options) and
 * navigate(delta) both work. A numeric delta is history movement and is
 * passed straight through.
 */
export default function useLocalizedNavigate() {
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const lang = normaliseLang(i18n?.language)

  return useCallback((to, options) => {
    if (typeof to === "number") return navigate(to)
    return navigate(localizeTo(to, lang), options)
  }, [navigate, lang])
}
