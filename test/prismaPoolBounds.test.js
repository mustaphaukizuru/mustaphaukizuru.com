/**
 * lib/prisma withPoolBounds — cap the connection pool on shared MySQL.
 *
 * Prisma's default pool is (cpus * 2 + 1) PER CLIENT. On Hostinger the account
 * has a hard max_user_connections, and a deploy can leave more than one app
 * instance briefly alive. Several instances x a large pool exhausts the quota,
 * and the symptom is a HANG rather than an error — queries queue forever while
 * static files keep serving. This project has hit exactly that.
 *
 * These tests pin the bounds and, more importantly, the two ways the helper
 * could fail open: a URL it cannot parse, and an operator value it must not
 * override.
 */

// The module connects on require; stub the client so requiring it is inert.
jest.mock("@prisma/client", () => ({
  PrismaClient: class {
    $connect() { return Promise.resolve() }
    $queryRaw() { return Promise.resolve([{ 1: 1 }]) }
    $disconnect() { return Promise.resolve() }
  },
}))

const { withPoolBounds } = require("../src/lib/prisma")

describe("withPoolBounds", () => {
  test("adds connection_limit and pool_timeout when absent", () => {
    const out = withPoolBounds("mysql://u:p@host:3306/db")
    expect(out).toMatch(/connection_limit=5/)
    expect(out).toMatch(/pool_timeout=10/)
  })

  test("never overrides values the operator already set", () => {
    // A limit tuned in .env for the real plan must win over our default.
    const out = withPoolBounds("mysql://u:p@host:3306/db?connection_limit=17&pool_timeout=3")
    expect(out).toMatch(/connection_limit=17/)
    expect(out).toMatch(/pool_timeout=3/)
    expect(out).not.toMatch(/connection_limit=5/)
  })

  test("preserves existing query parameters", () => {
    const out = withPoolBounds("mysql://u:p@host:3306/db?sslaccept=strict")
    expect(out).toMatch(/sslaccept=strict/)
    expect(out).toMatch(/connection_limit=5/)
  })

  test("keeps an operator limit and tops up the missing one", () => {
    // Note: new URL() is more permissive than expected — it percent-encodes
    // hostile passwords rather than throwing, so this takes the parsed path.
    const out = withPoolBounds("mysql://user:p@ss w[rd@host:3306/db?connection_limit=9")
    expect(out).toMatch(/connection_limit=9/)
    expect(out).toMatch(/pool_timeout=10/)
  })

  test("still bounds a genuinely unparseable URL — must not fail open", () => {
    // A space in the HOST does throw (ERR_INVALID_URL). Returning the raw
    // string here would silently restore the unbounded pool.
    const out = withPoolBounds("mysql://u:p@ho st:3306/db")
    expect(out).toMatch(/connection_limit=5/)
    expect(out).toMatch(/pool_timeout=10/)
  })

  test("does not double-append when an unparseable URL already has a limit", () => {
    const raw = "mysql://u:p@ho st:3306/db?connection_limit=9"
    expect(withPoolBounds(raw)).toBe(raw)
  })

  test("passes through empty input rather than inventing a URL", () => {
    expect(withPoolBounds(undefined)).toBeUndefined()
    expect(withPoolBounds("")).toBe("")
  })
})
