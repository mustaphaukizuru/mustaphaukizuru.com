/* ════════════════════════════════════════════════════════════════════════
   CookieConsentContext.jsx · GDPR / ePrivacy / LFPDPPP-aware consent
   ────────────────────────────────────────────────────────────────────────
   Categories follow the IAB Europe TCF taxonomy:
     · necessary  — strictly required (always granted, can't be refused)
     · functional — preferences, language, theme, saved selections
     · analytics  — anonymous usage measurement (e.g. GA4, Plausible)
     · marketing  — advertising, retargeting, social pixels

   Storage is versioned via CONSENT_VERSION so a privacy-policy update can
   force users to re-consent. We persist to localStorage, never cookies, so
   the consent record itself doesn't itself create a privacy concern.

   Contract:
     consent: {
       version,
       timestamp,
       categories: { necessary, functional, analytics, marketing }
     }
     decided: boolean — has the user made an explicit choice?
   ════════════════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { setAnalyticsConsent, setMarketingConsent } from "../lib/analytics"

const STORAGE_KEY = "mu_cookie_consent_v1"
export const CONSENT_VERSION = 1

// ── Annual re-prompt ───────────────────────────────────────────────────────
// ePrivacy guidance + most national DPAs (CNIL, ICO, AEPD, Garante) say a
// reasonable consent lifetime is 6–13 months. We pick 365 days. A stored
// record older than this is treated as expired — the banner re-shows and
// the user gets a fresh choice. The actual record stays in localStorage
// until they decide again so we don't lose their granular preferences mid-
// re-prompt; we just stop honouring it.
const MAX_CONSENT_AGE_MS = 365 * 24 * 60 * 60 * 1000

// ── Default state ──────────────────────────────────────────────────────────
// Necessary is always granted. Everything else defaults to denied until the
// user opts in — this is the GDPR-compliant baseline.
const DEFAULTS = Object.freeze({
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
})

const CookieConsentContext = createContext(null)

function readStored() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== CONSENT_VERSION) return null

    // Annual expiry check — see MAX_CONSENT_AGE_MS comment at top.
    // If the record is older than the threshold, return null so the
    // provider treats `decided` as false and the banner re-prompts.
    if (parsed.timestamp) {
      const ageMs = Date.now() - new Date(parsed.timestamp).getTime()
      if (Number.isFinite(ageMs) && ageMs > MAX_CONSENT_AGE_MS) return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStored(record) {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* localStorage may be disabled or full — fail silently */
  }
}

export function CookieConsentProvider({ children }) {
  const [record, setRecord] = useState(() => readStored())

  // Sync across tabs — when the user updates preferences in another tab,
  // reflect that here without a full reload.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return
      setRecord(readStored())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // ── Sync consent → analytics module ──────────────────────────────────────
  // Source of truth: this context. Side-effect: the analytics module needs
  // to know whether it's allowed to inject gtag.js + fire events. We push
  // both states on every change AND on initial mount. Until the user has
  // decided, both stay false — gtag.js is never injected and no pageviews
  // or events are sent. The moment they accept (either via "Accept all"
  // or the granular toggle in the preferences modal), analytics.js
  // lazy-loads the script and resumes tracking from that point forward.
  // No retroactive sending of queued events; that's a feature, not a bug —
  // any event fired before consent stayed on the floor by design.
  useEffect(() => {
    const allowAnalytics = Boolean(record?.categories?.analytics)
    const allowMarketing = Boolean(record?.categories?.marketing)
    try { setAnalyticsConsent(allowAnalytics) } catch { /* defensive */ }
    try { setMarketingConsent(allowMarketing) } catch { /* defensive */ }
  }, [record])

  const setCategories = useCallback((next) => {
    const safe = {
      ...DEFAULTS,
      ...(next || {}),
      necessary: true, // Always granted, regardless of input
    }
    const stamp = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: safe,
    }
    writeStored(stamp)
    setRecord(stamp)
  }, [])

  const acceptAll = useCallback(() => {
    setCategories({ necessary: true, functional: true, analytics: true, marketing: true })
  }, [setCategories])

  const rejectAll = useCallback(() => {
    setCategories({ necessary: true, functional: false, analytics: false, marketing: false })
  }, [setCategories])

  const reset = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
    setRecord(null)
  }, [])

  const categories = record?.categories || DEFAULTS
  const decided = Boolean(record)

  const value = useMemo(() => ({
    decided,
    categories,
    timestamp: record?.timestamp || null,
    version: record?.version || null,
    acceptAll,
    rejectAll,
    setCategories,
    reset,
  }), [decided, categories, record, acceptAll, rejectAll, setCategories, reset])

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    // Safe fallback so components don't crash when the provider is absent
    return {
      decided: false,
      categories: DEFAULTS,
      timestamp: null,
      version: null,
      acceptAll: () => {},
      rejectAll: () => {},
      setCategories: () => {},
      reset: () => {},
    }
  }
  return ctx
}

export const COOKIE_CATEGORIES = [
  {
    key: "necessary",
    title: "Strictly necessary",
    locked: true,
    description: "Required for core site functions: authentication, cart state, checkout integrity, security, and accessibility preferences. The site cannot function without these.",
    examples: "auth-token · session · CSRF · load-balancing",
  },
  {
    key: "functional",
    title: "Functional",
    locked: false,
    description: "Remember non-essential preferences such as language, time zone, theme, and saved filters across visits.",
    examples: "language · timezone · theme · cart-prefs",
  },
  {
    key: "analytics",
    title: "Analytics & performance",
    locked: false,
    description: "Anonymous usage measurement that helps us understand which pages perform well and where users encounter friction. IPs are pseudonymised and never resold.",
    examples: "page views · device class · referrer",
  },
  {
    key: "marketing",
    title: "Marketing & personalisation",
    locked: false,
    description: "Used to tailor recommendations and measure the performance of campaigns across LinkedIn, Meta, Google Ads, and other partners.",
    examples: "campaign attribution · audience tagging",
  },
]
