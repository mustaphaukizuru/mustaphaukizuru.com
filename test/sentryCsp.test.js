const { sentryOriginFromDsn, sentryConnectSrc } = require("../src/lib/sentryCsp")

describe("sentryOriginFromDsn", () => {
  it("returns the origin of a valid DSN (public key and path dropped)", () => {
    expect(sentryOriginFromDsn("https://abc123@o4507.ingest.us.sentry.io/4508"))
      .toBe("https://o4507.ingest.us.sentry.io")
  })

  it("keeps a non-default port", () => {
    expect(sentryOriginFromDsn("https://k@sentry.example.com:8443/1"))
      .toBe("https://sentry.example.com:8443")
  })

  it("ignores empty, whitespace and malformed values", () => {
    expect(sentryOriginFromDsn(undefined)).toBeNull()
    expect(sentryOriginFromDsn("")).toBeNull()
    expect(sentryOriginFromDsn("   ")).toBeNull()
    expect(sentryOriginFromDsn("not a url")).toBeNull()
    expect(sentryOriginFromDsn("ftp://k@host/1")).toBeNull()
  })
})

describe("sentryConnectSrc", () => {
  it("is empty when no DSN is configured", () => {
    expect(sentryConnectSrc({})).toEqual([])
    expect(sentryConnectSrc({ SENTRY_DSN: "" })).toEqual([])
  })

  it("dedupes the server and SPA DSN when they share a host", () => {
    const env = {
      SENTRY_DSN:      "https://a@o1.ingest.sentry.io/1",
      VITE_SENTRY_DSN: "https://b@o1.ingest.sentry.io/2",
    }
    expect(sentryConnectSrc(env)).toEqual(["https://o1.ingest.sentry.io"])
  })

  it("lists both origins when they differ and skips a broken one", () => {
    const env = {
      SENTRY_DSN:      "https://a@o1.ingest.sentry.io/1",
      VITE_SENTRY_DSN: "garbage",
    }
    expect(sentryConnectSrc(env)).toEqual(["https://o1.ingest.sentry.io"])
    env.VITE_SENTRY_DSN = "https://b@o2.ingest.de.sentry.io/2"
    expect(sentryConnectSrc(env)).toEqual([
      "https://o1.ingest.sentry.io",
      "https://o2.ingest.de.sentry.io",
    ])
  })
})
