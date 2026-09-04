/**
 * lib/api.js — the request layer, and the half of the session that lives in
 * the browser (T3-4).
 *
 * This module is the single owner of session storage since the httpOnly
 * cookie migration, and none of it was under test. The Playwright lane
 * cannot cover it: it answers requests with page.route(), so it never sees
 * how a request was BUILT. Three things matter and all three are silent
 * when they break — a missing CSRF header (every write 403s), a 401 that
 * does not tear the session down (the UI keeps claiming you are signed in),
 * and a token accidentally persisted to localStorage (the exact thing the
 * migration removed).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  apiRequest,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  buildApiUrl,
  clearStoredAuth,
  CSRF_COOKIE_NAME,
  getCsrfToken,
  getStoredToken,
  getStoredUser,
  hasStoredSession,
  readCookie,
  setStoredAuth,
} from "./api"

const ok = (body = { success: true, data: { ok: true } }) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
})

const fail = (status, body) => ({
  ok: false,
  status,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
})

function mockFetch(impl) {
  const fn = vi.fn(impl)
  vi.stubGlobal("fetch", fn)
  return fn
}

const lastInit = (fn) => fn.mock.calls.at(-1)[1]
const headerOf = (fn, name) => new Headers(lastInit(fn).headers).get(name)

describe("cookie reading", () => {
  it("finds a value among several cookies and ignores a same-prefixed name", () => {
    document.cookie = "other=1; path=/"
    document.cookie = `${CSRF_COOKIE_NAME}_stale=nope; path=/`
    document.cookie = `${CSRF_COOKIE_NAME}=abc123; path=/`
    expect(readCookie(CSRF_COOKIE_NAME)).toBe("abc123")
    expect(getCsrfToken()).toBe("abc123")
  })

  it("returns null when the cookie is absent", () => {
    expect(readCookie(CSRF_COOKIE_NAME)).toBeFalsy()
  })
})

describe("CSRF double-submit", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("mirrors the cookie into the header on %s", async (method) => {
    document.cookie = `${CSRF_COOKIE_NAME}=tok-${method}; path=/`
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things", { method })
    expect(headerOf(fetchMock, "X-CSRF-Token")).toBe(`tok-${method}`)
  })

  it("sends no header on a safe method — the guard keys off the cookie, not the header", async () => {
    document.cookie = `${CSRF_COOKIE_NAME}=tok; path=/`
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things", { method: "GET" })
    expect(headerOf(fetchMock, "X-CSRF-Token")).toBeNull()
  })

  it("does not invent a header when there is no cookie", async () => {
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things", { method: "POST" })
    expect(headerOf(fetchMock, "X-CSRF-Token")).toBeNull()
  })

  it("leaves an explicitly passed header alone", async () => {
    document.cookie = `${CSRF_COOKIE_NAME}=from-cookie; path=/`
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things", { method: "POST", headers: { "X-CSRF-Token": "explicit" } })
    expect(headerOf(fetchMock, "X-CSRF-Token")).toBe("explicit")
  })

  it("always sends credentials, or the browser withholds the session cookie", async () => {
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things")
    expect(lastInit(fetchMock).credentials).toBe("include")
  })

  it("sets a JSON content type for a body but not for FormData", async () => {
    const fetchMock = mockFetch(async () => ok())
    await apiRequest("/api/v1/things", { method: "POST", body: JSON.stringify({ a: 1 }) })
    expect(headerOf(fetchMock, "Content-Type")).toBe("application/json")

    const form = new FormData()
    form.append("file", new Blob(["x"]), "x.png")
    await apiRequest("/api/v1/upload", { method: "POST", body: form })
    expect(headerOf(fetchMock, "Content-Type")).toBeNull()
  })
})

describe("401 teardown", () => {
  beforeEach(() => setStoredAuth({ user: { id: "u1", fullName: "Test" } }))

  it("clears the cached user and announces the expiry on an expired session", async () => {
    mockFetch(async () => fail(401, { success: false, code: "AUTH_EXPIRED", message: "Session expired" }))
    const seen = []
    window.addEventListener("auth:session-expired", (e) => seen.push(e.detail?.code))

    await expect(apiRequest("/api/v1/orders")).rejects.toMatchObject({ status: 401 })

    expect(getStoredUser()).toBeNull()
    expect(seen).toEqual(["AUTH_EXPIRED"])
  })

  it("leaves the session alone for a 401 that is not about the session", async () => {
    mockFetch(async () => fail(401, { success: false, code: "TWO_FACTOR_REQUIRED", message: "2FA required" }))
    const seen = []
    window.addEventListener("auth:session-expired", () => seen.push(1))

    await expect(apiRequest("/api/v1/auth/login", { method: "POST" })).rejects.toMatchObject({ status: 401 })

    expect(getStoredUser()).not.toBeNull()
    expect(seen).toEqual([])
  })

  it("surfaces the server's own code and details on a 4xx", async () => {
    mockFetch(async () => fail(409, { success: false, code: "COUPON_RACE", message: "Coupon just ran out", error: { details: { couponId: "c1" } } }))
    await expect(apiRequest("/api/v1/orders", { method: "POST" }))
      .rejects.toMatchObject({ status: 409, code: "COUPON_RACE" })
  })

  it("reports a network failure as a connection problem, not a server error", async () => {
    mockFetch(async () => { throw new TypeError("Failed to fetch") })
    await expect(apiRequest("/api/v1/things")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 })
  })
})

describe("session storage holds display data only", () => {
  it("never persists a token, even when a caller passes one", () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "left-over-from-an-older-build")
    setStoredAuth({ user: { id: "u1" }, token: "should-be-ignored" })

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(getStoredToken()).toBeNull()
    expect(getStoredUser()).toEqual({ id: "u1" })
  })

  it("counts a cached user or a CSRF cookie as a live session", () => {
    expect(hasStoredSession()).toBe(false)
    setStoredAuth({ user: { id: "u1" } })
    expect(hasStoredSession()).toBe(true)

    clearStoredAuth()
    expect(hasStoredSession()).toBe(false)
    document.cookie = `${CSRF_COOKIE_NAME}=abc; path=/`
    expect(hasStoredSession()).toBe(true)
  })

  it("survives unparseable stored data instead of throwing on boot", () => {
    localStorage.setItem(AUTH_USER_KEY, "{not json")
    expect(getStoredUser()).toBeNull()
  })
})

describe("URL building", () => {
  it("keeps one slash between base and path and leaves absolute URLs alone", () => {
    expect(buildApiUrl("/api/v1/things")).not.toMatch(/\/\/api/)
    expect(buildApiUrl("https://example.test/x")).toBe("https://example.test/x")
  })
})
