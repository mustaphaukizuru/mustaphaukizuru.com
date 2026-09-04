/**
 * CookieConsentContext — consent is a legal record, not a UI preference
 * (T3-4).
 *
 * Under Mexico's LFPDPPP the site has to be able to show what a visitor
 * agreed to and when, and a privacy-policy change has to be able to ask
 * again. That makes the version stamp the whole point: a stored record from
 * an older policy version must read as "not decided" so the banner returns.
 * Nothing tested that, and getting it wrong fails silently in the direction
 * that looks fine — the banner simply never comes back.
 *
 * The analytics bridge matters for the same reason: until a choice exists,
 * both consent flags must be false, so no script is injected and no event
 * is sent.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const analytics = { setAnalyticsConsent: vi.fn(), setMarketingConsent: vi.fn() }
vi.mock("../lib/analytics", () => ({
  setAnalyticsConsent: (...a) => analytics.setAnalyticsConsent(...a),
  setMarketingConsent: (...a) => analytics.setMarketingConsent(...a),
}))

const { CookieConsentProvider, useCookieConsent, CONSENT_VERSION } = await import("./CookieConsentContext")
const STORAGE_KEY = "mu_cookie_consent_v1"

function Probe() {
  const { decided, categories, version, acceptAll, rejectAll, setCategories, reset } = useCookieConsent()
  return (
    <div>
      <span data-testid="decided">{String(decided)}</span>
      <span data-testid="version">{String(version)}</span>
      <span data-testid="cats">{["necessary", "functional", "analytics", "marketing"].map((k) => `${k}:${Boolean(categories[k])}`).join(" ")}</span>
      <button onClick={acceptAll}>Accept all</button>
      <button onClick={rejectAll}>Reject all</button>
      <button onClick={() => setCategories({ necessary: false, analytics: true })}>Analytics only</button>
      <button onClick={reset}>Reset</button>
    </div>
  )
}

const mount = () => render(<CookieConsentProvider><Probe /></CookieConsentProvider>)
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))

beforeEach(() => {
  analytics.setAnalyticsConsent.mockReset()
  analytics.setMarketingConsent.mockReset()
})

describe("before a choice exists", () => {
  it("reads as undecided and tells analytics nothing is allowed", async () => {
    mount()
    expect(screen.getByTestId("decided")).toHaveTextContent("false")
    await waitFor(() => expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith(false))
    expect(analytics.setMarketingConsent).toHaveBeenCalledWith(false)
  })
})

describe("the version stamp", () => {
  it("re-prompts when the stored record predates the current policy version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION - 1,
      timestamp: "2026-01-01T00:00:00.000Z",
      categories: { necessary: true, functional: true, analytics: true, marketing: true },
    }))

    mount()

    // The banner comes back, and the old grants are not honoured meanwhile.
    expect(screen.getByTestId("decided")).toHaveTextContent("false")
    expect(screen.getByTestId("cats")).toHaveTextContent("analytics:false")
    expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith(false)
  })

  it("honours a record stamped with the current version", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: "2026-01-01T00:00:00.000Z",
      categories: { necessary: true, functional: false, analytics: true, marketing: false },
    }))

    mount()

    expect(screen.getByTestId("decided")).toHaveTextContent("true")
    expect(screen.getByTestId("cats")).toHaveTextContent("analytics:true")
    expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith(true)
    expect(analytics.setMarketingConsent).toHaveBeenCalledWith(false)
  })

  it("treats unparseable storage as no decision rather than throwing on boot", () => {
    localStorage.setItem(STORAGE_KEY, "{ not json")
    mount()
    expect(screen.getByTestId("decided")).toHaveTextContent("false")
  })
})

describe("recording a choice", () => {
  it("accept all grants every category and stamps version and time", async () => {
    mount()
    await userEvent.click(screen.getByRole("button", { name: /accept all/i }))

    expect(screen.getByTestId("cats")).toHaveTextContent("necessary:true functional:true analytics:true marketing:true")
    const rec = stored()
    expect(rec.version).toBe(CONSENT_VERSION)
    expect(Date.parse(rec.timestamp)).not.toBeNaN()
    expect(analytics.setAnalyticsConsent).toHaveBeenLastCalledWith(true)
  })

  it("reject all still counts as a decision, with only the necessary bucket on", async () => {
    mount()
    await userEvent.click(screen.getByRole("button", { name: /reject all/i }))

    expect(screen.getByTestId("decided")).toHaveTextContent("true")
    expect(screen.getByTestId("cats")).toHaveTextContent("necessary:true functional:false analytics:false marketing:false")
    expect(analytics.setAnalyticsConsent).toHaveBeenLastCalledWith(false)
  })

  it("cannot switch the necessary bucket off, whatever the caller passes", async () => {
    mount()
    await userEvent.click(screen.getByRole("button", { name: /analytics only/i }))

    expect(screen.getByTestId("cats")).toHaveTextContent("necessary:true")
    expect(stored().categories.necessary).toBe(true)
    expect(stored().categories.analytics).toBe(true)
  })

  it("reset removes the record so the banner returns", async () => {
    mount()
    await userEvent.click(screen.getByRole("button", { name: /accept all/i }))
    expect(stored()).not.toBeNull()

    await userEvent.click(screen.getByRole("button", { name: /^reset$/i }))

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId("decided")).toHaveTextContent("false")
    expect(analytics.setAnalyticsConsent).toHaveBeenLastCalledWith(false)
  })
})

describe("across tabs", () => {
  it("picks up a decision made in another tab", async () => {
    mount()
    expect(screen.getByTestId("decided")).toHaveTextContent("false")

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, functional: true, analytics: true, marketing: false },
    }))
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))

    await waitFor(() => expect(screen.getByTestId("decided")).toHaveTextContent("true"))
    expect(analytics.setAnalyticsConsent).toHaveBeenLastCalledWith(true)
  })
})
