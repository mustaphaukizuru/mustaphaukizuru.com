const { resolveUserLocale, DEFAULT_LOCALE } = require("../src/utils/resolveUserLocale")

function req({ body, query, user, headers = {} } = {}) {
  return {
    body,
    query,
    user,
    headers,
    get: (name) => headers[name.toLowerCase()],
  }
}

describe("resolveUserLocale · Spanish-first defaults", () => {
  test("falls back to es when there is no signal at all", () => {
    expect(DEFAULT_LOCALE).toBe("es")
    expect(resolveUserLocale()).toBe("es")
    expect(resolveUserLocale({ req: req() })).toBe("es")
    expect(resolveUserLocale({ user: {} })).toBe("es")
  })

  test("explicit argument wins over everything", () => {
    expect(resolveUserLocale({ locale: "EN", req: req({ body: { locale: "es" } }) })).toBe("en")
  })

  test("body, query and profile locale still win", () => {
    expect(resolveUserLocale({ req: req({ body: { locale: "en" } }) })).toBe("en")
    expect(resolveUserLocale({ req: req({ query: { locale: "en" } }) })).toBe("en")
    expect(resolveUserLocale({ req: req({ user: { profile: { locale: "en" } } }) })).toBe("en")
  })

  test("referer /es path resolves es; other referers do not decide", () => {
    expect(resolveUserLocale({ req: req({ headers: { referer: "https://x.com/es/store" } }) })).toBe("es")
    expect(resolveUserLocale({ req: req({ headers: { referer: "https://x.com/store", "accept-language": "en-US" } }) })).toBe("en")
  })

  test("Accept-Language: en* → en, es* → es, anything else → es", () => {
    expect(resolveUserLocale({ req: req({ headers: { "accept-language": "en-GB,en;q=0.9" } }) })).toBe("en")
    expect(resolveUserLocale({ req: req({ headers: { "accept-language": "es-MX,es;q=0.9" } }) })).toBe("es")
    expect(resolveUserLocale({ req: req({ headers: { "accept-language": "pt-BR,en;q=0.8" } }) })).toBe("es")
    expect(resolveUserLocale({ req: req({ headers: { "accept-language": "fr" } }) })).toBe("es")
  })

  test("user.profile.locale is honoured for webhook callers", () => {
    expect(resolveUserLocale({ user: { profile: { locale: "en" } } })).toBe("en")
  })

  test("user.profile.country proxies the missing locale column", () => {
    expect(resolveUserLocale({ user: { profile: { country: "MX" } } })).toBe("es")
    expect(resolveUserLocale({ user: { profile: { country: "es" } } })).toBe("es")
    expect(resolveUserLocale({ user: { profile: { country: "CO" } } })).toBe("es")
    expect(resolveUserLocale({ user: { profile: { country: "US" } } })).toBe("en")
    expect(resolveUserLocale({ user: { profile: { country: "" } } })).toBe("es")
    expect(resolveUserLocale({ user: { profile: null } })).toBe("es")
  })

  test("profile.locale beats profile.country", () => {
    expect(resolveUserLocale({ user: { profile: { locale: "en", country: "MX" } } })).toBe("en")
  })
})
