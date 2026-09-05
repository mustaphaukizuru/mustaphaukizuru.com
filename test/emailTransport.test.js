// ─────────────────────────────────────────────────────────────────────────────
// Which SMTP configurations are considered usable (found during T2-5).
//
// `smtpConfigured()` required SMTP_USER *and* SMTP_PASS. The documented local
// setup is Mailpit on 127.0.0.1:1025, which has no accounts and wants no auth,
// so every local send was skipped with "SMTP not configured" — silently, since
// the newsletter confirmation is fire-and-forget. Subscribing returned "check
// your inbox" and no message was ever produced. Order receipts and booking
// confirmations were in the same position: unverifiable locally, which is the
// one job a local mail catcher has.
//
// The relaxation is deliberately narrow, and these tests are the reason it can
// be trusted: credentials stay REQUIRED for any non-loopback host. Sending
// unauthenticated to a real server is either rejected or, worse, relayed.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({}))
jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

const { smtpConfigured, isLoopbackSmtpHost } = require("../src/services/emailService")

const ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE"]
const saved = {}

beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k] })
// Jest workers share a process: restore every key, including the ones that
// were unset, or a later suite inherits this one's SMTP settings.
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})
beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k] })

describe("credentials mean configured, wherever the host is", () => {
  test.each([
    "smtp.hostinger.com",
    "smtp.gmail.com",
    "127.0.0.1",
  ])("user + pass with host %s", (host) => {
    process.env.SMTP_HOST = host
    process.env.SMTP_USER = "someone"
    process.env.SMTP_PASS = "secret"
    expect(smtpConfigured()).toBe(true)
  })
})

describe("a loopback catcher needs no credentials", () => {
  test.each(["127.0.0.1", "localhost", "::1", "[::1]", "0.0.0.0", "LOCALHOST"])("%s", (host) => {
    process.env.SMTP_HOST = host
    process.env.SMTP_PORT = "1025"
    expect(isLoopbackSmtpHost()).toBe(true)
    expect(smtpConfigured()).toBe(true)
  })
})

describe("everything else without credentials is NOT configured", () => {
  test("a real host with no credentials is refused", () => {
    // The dangerous case: an unauthenticated send to a live server.
    process.env.SMTP_HOST = "smtp.hostinger.com"
    expect(smtpConfigured()).toBe(false)
  })

  test("a host that merely contains 'localhost' is not loopback", () => {
    process.env.SMTP_HOST = "localhost.attacker.example"
    expect(isLoopbackSmtpHost()).toBe(false)
    expect(smtpConfigured()).toBe(false)
  })

  test("an unset host is not configured, because the transport would guess", () => {
    // getTransport() falls back to smtp.hostinger.com when SMTP_HOST is
    // empty. Treating "unset" as loopback would mean an empty SMTP_HOST
    // sends real mail through the production relay — the exact trap the
    // project's own notes warn about.
    expect(process.env.SMTP_HOST).toBeUndefined()
    expect(isLoopbackSmtpHost()).toBe(false)
    expect(smtpConfigured()).toBe(false)

    process.env.SMTP_HOST = "   "
    expect(smtpConfigured()).toBe(false)
  })

  test("half a credential pair is not a credential", () => {
    process.env.SMTP_HOST = "smtp.hostinger.com"
    process.env.SMTP_USER = "someone"
    expect(smtpConfigured()).toBe(false)
    delete process.env.SMTP_USER
    process.env.SMTP_PASS = "secret"
    expect(smtpConfigured()).toBe(false)
  })
})
