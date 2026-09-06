import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ensureNamespace } from "../i18n"

/**
 * useLazyNamespace · hold a route's first paint until its namespace lands.
 *
 * Route-scoped namespaces (LAZY_NAMESPACES in i18n/resources.js) are fetched
 * when the route that reads them mounts, rather than riding in the
 * per-language bundle that every page downloads. The page has to wait: this
 * project does not use Suspense for translations, so rendering early paints
 * raw keys like "track.title".
 *
 * Extracted from SelfAuditPage when `dashboard` joined `audit` on the lazy
 * list — three mount points doing this by hand is three chances to forget the
 * catch, and the catch is the important part.
 *
 * @param {string} ns
 * @returns {boolean} ready — false only while the first fetch is in flight
 */
export default function useLazyNamespace(ns) {
  const { i18n } = useTranslation()
  const [ready, setReady] = useState(() => i18n.hasResourceBundle(i18n.language, ns))

  useEffect(() => {
    let cancelled = false
    ensureNamespace(ns, i18n.language)
      .then(() => { if (!cancelled) setReady(true) })
      // A failed namespace fetch must not leave a blank page. Keys are ugly;
      // nothing at all is worse.
      .catch(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [ns, i18n.language])

  return ready
}
