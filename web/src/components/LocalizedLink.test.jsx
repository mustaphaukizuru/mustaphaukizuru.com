/**
 * LocalizedLink — the rule that keeps a Spanish reader in Spanish (T2-1).
 *
 * The site routes language by URL prefix and LanguageWrapper sets i18n's
 * language from that prefix on every navigation. So an unprefixed link is
 * not a cosmetic problem: clicking one from /es switches the whole
 * interface to English. About 150 of them shipped.
 *
 * The unit under test is `localize`, because that is where every decision
 * lives. The two components are thin wrappers, and one render test each
 * proves the wiring.
 */
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { LocalizedLink, LocalizedNavLink } from "./LocalizedLink"
import { localizeTo as localize } from "../i18n/utils/localizeTo"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: globalThis.__lang || "en" } }),
}))

const withLang = (lang, fn) => {
  globalThis.__lang = lang
  try { return fn() } finally { delete globalThis.__lang }
}

describe("English is the root, so nothing is rewritten", () => {
  it("leaves every path alone", () => {
    for (const to of ["/", "/services", "/store/x", "#top", "https://x.test", "mailto:a@b.c"]) {
      expect(localize(to, "en")).toBe(to)
    }
  })
})

describe("Spanish gets the prefix", () => {
  it.each([
    ["/", "/es"],
    ["/services", "/es/services"],
    ["/services/it-strategy-consulting", "/es/services/it-strategy-consulting"],
    ["/store/starter-kit", "/es/store/starter-kit"],
  ])("%s → %s", (input, expected) => {
    expect(localize(input, "es")).toBe(expected)
  })

  it("is idempotent — an already-Spanish path is not double-prefixed", () => {
    expect(localize("/es", "es")).toBe("/es")
    expect(localize("/es/services", "es")).toBe("/es/services")
    expect(localize(localize("/services", "es"), "es")).toBe("/es/services")
  })

  it("does not mistake a path that merely starts with the letters es", () => {
    expect(localize("/estimates", "es")).toBe("/es/estimates")
    expect(localize("/es-la/x", "es")).toBe("/es/es-la/x")
  })
})

describe("the operator trees stay English", () => {
  // App.jsx mirrors only the public and auth routes under /es, so a
  // prefixed operator path is a URL with no route behind it. Public pages
  // link into these constantly — checkout, the success page, signup.
  it.each([
    "/dashboard",
    "/dashboard/addresses",
    "/dashboard/downloads",
    "/admin",
    "/admin/orders/123",
  ])("%s is left alone in Spanish", (to) => {
    expect(localize(to, "es")).toBe(to)
  })

  it("guards the object form too", () => {
    expect(localize({ pathname: "/dashboard/support" }, "es")).toEqual({ pathname: "/dashboard/support" })
  })

  it("but a path that merely begins with those letters is prefixed", () => {
    expect(localize("/administration", "es")).toBe("/es/administration")
    expect(localize("/dashboards", "es")).toBe("/es/dashboards")
  })
})

describe("what must never be touched", () => {
  it.each([
    ["https://example.test/page", "absolute http"],
    ["//cdn.example.test/a.png", "protocol-relative"],
    ["mailto:hello@example.test", "mailto"],
    ["tel:+525512345678", "tel"],
    ["#pricing", "bare hash"],
    ["../sibling", "relative"],
    ["", "empty"],
  ])("%s (%s) passes through", (to) => {
    expect(localize(to, "es")).toBe(to)
  })
})

describe("the object form", () => {
  it("prefixes pathname and keeps search and hash", () => {
    expect(localize({ pathname: "/store", search: "?q=kit", hash: "#top" }, "es"))
      .toEqual({ pathname: "/es/store", search: "?q=kit", hash: "#top" })
  })

  it("leaves an already-Spanish or relative pathname alone", () => {
    expect(localize({ pathname: "/es/store" }, "es")).toEqual({ pathname: "/es/store" })
    expect(localize({ pathname: "store" }, "es")).toEqual({ pathname: "store" })
  })

  it("survives a `to` with no pathname", () => {
    expect(localize({ search: "?q=1" }, "es")).toEqual({ search: "?q=1" })
    expect(localize(undefined, "es")).toBeUndefined()
  })
})

describe("the components render the localized href", () => {
  it("LocalizedLink prefixes in Spanish and not in English", () => {
    withLang("es", () => {
      render(<MemoryRouter><LocalizedLink to="/services">Servicios</LocalizedLink></MemoryRouter>)
      expect(screen.getByRole("link", { name: "Servicios" })).toHaveAttribute("href", "/es/services")
    })
  })

  it("LocalizedNavLink does the same and keeps its props", () => {
    withLang("es", () => {
      render(
        <MemoryRouter initialEntries={["/es/store"]}>
          <LocalizedNavLink to="/store" end className={({ isActive }) => (isActive ? "on" : "off")}>
            Tienda
          </LocalizedNavLink>
        </MemoryRouter>,
      )
      const link = screen.getByRole("link", { name: "Tienda" })
      expect(link).toHaveAttribute("href", "/es/store")
      // The prefixed target matches the current URL, so it reads as active —
      // which is the whole reason the prefix has to happen before NavLink
      // does its comparison.
      expect(link).toHaveClass("on")
    })
  })

  it("a regional tag like es-MX still counts as Spanish", () => {
    withLang("es-MX", () => {
      render(<MemoryRouter><LocalizedLink to="/about">Acerca</LocalizedLink></MemoryRouter>)
      expect(screen.getByRole("link", { name: "Acerca" })).toHaveAttribute("href", "/es/about")
    })
  })

  it("English renders the bare path", () => {
    withLang("en", () => {
      render(<MemoryRouter><LocalizedLink to="/about">About</LocalizedLink></MemoryRouter>)
      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about")
    })
  })
})
