// ─────────────────────────────────────────────────────────────────────────────
// T0-5 · analytics never hashes visitor data under a default or short salt.
//
// The session hash is HMAC(ip|ua|day). With a key that lives in the
// repository, or one short enough to brute-force, that hash is a lookup
// table away from the visitor's IP — the exact thing the cookieless design
// promises not to keep. config/env.js refuses to boot without the variable;
// this is the in-process guard for anything that bypasses env.js.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  pageView:       { create: jest.fn(), findMany: jest.fn() },
  analyticsEvent: { create: jest.fn(), findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const fs   = require("fs")
const path = require("path")

function load() {
  let m
  jest.isolateModules(() => { m = require("../src/services/analyticsService") })
  return m
}
const req = { ip: "203.0.113.7", headers: { "user-agent": "Mozilla/5.0 test" } }

function hashThrows(svc) {
  try { svc.buildSessionHash(req) } catch (e) { return e }
  return null
}

afterEach(() => { delete process.env.ANALYTICS_HASH_SALT })

test("importing the module never throws; hashing without a salt does, with a machine-readable code", () => {
  delete process.env.ANALYTICS_HASH_SALT
  const svc = load()
  expect(hashThrows(svc)).toMatchObject({ name: "AppError", statusCode: 500, code: "ANALYTICS_SALT_MISSING" })
})

test("a salt shorter than 32 characters is refused", () => {
  process.env.ANALYTICS_HASH_SALT = "muz-analytics-default-salt"
  expect(hashThrows(load())).toMatchObject({ code: "ANALYTICS_SALT_MISSING" })
})

test("a real salt hashes; the hash depends on the salt and never contains the input", () => {
  process.env.ANALYTICS_HASH_SALT = "a".repeat(32)
  const h1 = load().buildSessionHash(req)
  expect(h1).toMatch(/^[0-9a-f]{32}$/)
  expect(h1).not.toContain("203.0.113.7")

  process.env.ANALYTICS_HASH_SALT = "b".repeat(32)
  const h2 = load().buildSessionHash(req)
  expect(h2).not.toBe(h1)
})

test("the literal fallback is gone from the source", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "services", "analyticsService.js"), "utf8")
  expect(src).not.toMatch(/muz-analytics-default-salt/)
  // `|| ""` (read-then-refuse) is fine; `|| "<anything>"` is a fallback key.
  expect(src).not.toMatch(/ANALYTICS_HASH_SALT\s*\|\|\s*["'][^"']+["']/)
})
