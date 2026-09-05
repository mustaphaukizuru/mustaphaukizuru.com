import { describe, expect, test } from "vitest"

import { routePattern } from "./vitals"

/**
 * What reaches the analytics table (T3-6).
 *
 * A vital carries a path, and the path is the only field with any chance of
 * carrying something it should not. Two of these routes have a live secret
 * in them.
 */

describe("routePattern", () => {
  test("static routes pass through unchanged", () => {
    expect(routePattern("/")).toBe("/")
    expect(routePattern("/about")).toBe("/about")
    expect(routePattern("/store")).toBe("/store")
  })

  test("an identifier is collapsed to its pattern", () => {
    expect(routePattern("/store/refactor-toolkit")).toBe("/store/:slug")
    expect(routePattern("/blog/why-we-left-stripe")).toBe("/blog/:slug")
    expect(routePattern("/projects/colegio-vista")).toBe("/projects/:slug")
    expect(routePattern("/dashboard/orders/clx9f8s0000")).toBe("/dashboard/orders/:id")
  })

  test("A LIVE TRACKING CODE NEVER REACHES ANALYTICS", () => {
    // The one that matters. A tracking code in an analytics table is a
    // client's project identifier sitting somewhere it was never meant to
    // be, readable by anyone who can open the admin dashboard.
    const pattern = routePattern("/track/MU-7K4C-9XQF")
    expect(pattern).toBe("/track/:code")
    expect(pattern).not.toContain("7K4C")
  })

  test("a portal token never reaches analytics either", () => {
    // Worse than an identifier: it is a live credential.
    const pattern = routePattern("/portal/prt_live_9f8a7b6c5d4e")
    expect(pattern).toBe("/portal/:token")
    expect(pattern).not.toContain("prt_")
  })

  test("a password-reset token never reaches analytics", () => {
    expect(routePattern("/reset-password/abc123def456")).toBe("/reset-password/:token")
  })

  test("an unrecognised deep path is truncated rather than sent whole", () => {
    // The default has to be safe: an unrecognised third segment is exactly
    // where the next identifier will hide.
    expect(routePattern("/some/new/feature/xyz-secret-123")).toBe("/some/new/*")
  })

  test("Spanish routes keep their prefix, because they are a different page", () => {
    // A Spanish reader downloads a different locale chunk, so /es/store and
    // /store are two performance stories. Rolling them together would let
    // either one get worse unnoticed.
    expect(routePattern("/es/store")).toBe("/es/store")
    expect(routePattern("/es/store/refactor-toolkit")).toBe("/es/store/:slug")
    expect(routePattern("/es")).toBe("/es")
  })

  test("/estonia is not Spanish", () => {
    // The same trap the language detector has a test for.
    expect(routePattern("/estonia")).toBe("/estonia")
  })

  test("query strings and trailing slashes are stripped", () => {
    // Otherwise a search term or a UTM parameter lands in the table, and
    // /store, /store/ and /store?page=2 are three rows for one page.
    expect(routePattern("/store?search=laptop&utm_source=x")).toBe("/store")
    expect(routePattern("/store/")).toBe("/store")
  })

  test("nothing at all is the root, not a crash", () => {
    expect(routePattern(undefined)).toBe("/")
    expect(routePattern("")).toBe("/")
    expect(routePattern(null)).toBe("/")
  })
})
