// ─────────────────────────────────────────────────────────────────────────────
// T5-8 · a tracking code as a second door into the portal.
//
// The security argument is one sentence, and every case here is a way it
// could be wrong: holding the code causes a PIN to be sent to the address on
// the PROJECT — an inbox the holder of a forwarded code very likely does not
// control. So the code stays what ADR 0006 says it is, and only the inbox
// gets anybody in.
//
// A second DOOR, not a second lock.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn() },
  authOtp: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  activityLog: { create: jest.fn().mockResolvedValue({}) },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }),
}))
jest.mock("../src/services/clientProjectService", () => ({ getMyProject: jest.fn() }))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const portal = require("../src/services/portalAccessService")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const CODE = "MU-7K4C-9XQF"
const PROJECT = {
  id: "p1", userId: "u1", projectName: "Colegio Vista",
  projectStatus: "in_progress", closedAt: null, updatedAt: new Date(),
  portalTokenExpiresAt: null,
  user: { id: "u1", email: "director@colegiovista.mx", fullName: "Ana Ruiz" },
}

const SECRET_BEFORE = process.env.JWT_SECRET
beforeAll(() => { process.env.JWT_SECRET = "test-secret-for-portal-by-code-0123456789" })
afterAll(() => {
  if (SECRET_BEFORE === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = SECRET_BEFORE
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findUnique.mockResolvedValue(PROJECT)
  prisma.authOtp.create.mockResolvedValue({ id: "o1" })
  sendTemplateEmail.mockResolvedValue({ ok: true })
})

describe("the code opens the door, it does not unlock it", () => {
  test("the PIN goes to the address ON THE PROJECT, not to the caller", async () => {
    // The whole argument. Nothing in the request says where to send it.
    await portal.requestPinByCode(CODE)
    expect(sendTemplateEmail.mock.calls[0][0].to).toBe("director@colegiovista.mx")
  })

  test("the address is returned MASKED, so the page can say where it went", async () => {
    // Enough for the real client to recognise their own inbox, not enough
    // for a stranger to learn it.
    const out = await portal.requestPinByCode(CODE)
    expect(out.emailHint).toBeTruthy()
    expect(out.emailHint).not.toBe("director@colegiovista.mx")
    expect(out.emailHint).not.toContain("director")
  })

  test("it is the same PIN machinery as the magic link, not a second copy", () => {
    // Two implementations of "issue a credential by email" is one too many.
    const service = read("src", "services", "portalAccessService.js")
    expect(service).toContain("return requestPinForProject(await loadProjectByToken(token)")
    expect(service).toContain("return requestPinForProject(await loadProjectByCode(code)")
    expect(service).toContain("return verifyPinForProject(await loadProjectByToken(token)")
    expect(service).toContain("return verifyPinForProject(await loadProjectByCode(code)")
  })
})

describe("which codes are refused", () => {
  test("a malformed code never reaches the database", async () => {
    await expect(portal.requestPinByCode("not-a-code")).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.clientProject.findUnique).not.toHaveBeenCalled()
  })

  test("malformed and unknown answer IDENTICALLY", async () => {
    // A distinguishable "malformed" tells a sweep which guesses had the
    // right shape, which is the same oracle /track closes.
    const messages = []
    await portal.requestPinByCode("nope").catch((e) => messages.push(`${e.statusCode}:${e.message}`))
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await portal.requestPinByCode(CODE).catch((e) => messages.push(`${e.statusCode}:${e.message}`))
    expect(messages[0]).toBe(messages[1])
  })

  test("an expired project is unreachable by this door too", async () => {
    prisma.clientProject.findUnique.mockResolvedValue({
      ...PROJECT,
      projectStatus: "completed",
      closedAt: new Date("2020-01-01"),
    })
    await expect(portal.requestPinByCode(CODE)).rejects.toMatchObject({ code: "PROJECT_EXPIRED" })
  })

  test("a STALE MAGIC LINK does not close this door", async () => {
    // Deliberate: this door does not use the token, and refusing on an
    // expired one would make the code useless in exactly the case it is most
    // useful — the client whose emailed link has run out.
    prisma.clientProject.findUnique.mockResolvedValue({
      ...PROJECT,
      portalTokenExpiresAt: new Date("2020-01-01"),
    })
    await expect(portal.requestPinByCode(CODE)).resolves.toBeTruthy()
  })

  test("a project with no address on file is refused rather than silently doing nothing", async () => {
    prisma.clientProject.findUnique.mockResolvedValue({ ...PROJECT, user: { id: "u1", email: null } })
    await expect(portal.requestPinByCode(CODE)).rejects.toMatchObject({ code: "PORTAL_NO_EMAIL" })
  })
})

describe("verifying", () => {
  test("the right PIN issues the same mu_portal token as the link flow", async () => {
    prisma.authOtp.findFirst.mockResolvedValue({ id: "o1", otpCode: "123456" })
    prisma.authOtp.update.mockResolvedValue({})
    const out = await portal.verifyPinByCode(CODE, "123456")
    expect(out.projectId).toBe("p1")
    const { verifyJwt } = require("../src/utils/jwt")
    expect(verifyJwt(out.token)).toMatchObject({ scope: "portal", projectId: "p1", userId: "u1" })
  })

  test("a wrong PIN is refused, and the OTP is not consumed", async () => {
    prisma.authOtp.findFirst.mockResolvedValue({ id: "o1", otpCode: "123456" })
    await expect(portal.verifyPinByCode(CODE, "000000")).rejects.toMatchObject({ code: "PORTAL_PIN_INVALID" })
    expect(prisma.authOtp.update).not.toHaveBeenCalled()
  })

  test("a used PIN cannot be replayed — it is marked the moment it works", async () => {
    prisma.authOtp.findFirst.mockResolvedValue({ id: "o1", otpCode: "123456" })
    prisma.authOtp.update.mockResolvedValue({})
    await portal.verifyPinByCode(CODE, "123456")
    expect(prisma.authOtp.update.mock.calls[0][0].data.usedAt).toBeInstanceOf(Date)
  })

  test("anything that is not six digits is refused before any lookup", async () => {
    for (const bad of ["12345", "abcdef", "", "1234567"]) {
      await expect(portal.verifyPinByCode(CODE, bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    }
    expect(prisma.authOtp.findFirst).not.toHaveBeenCalled()
  })
})

describe("the routes", () => {
  const routes = read("src", "routes", "portalRoutes.js")

  test("both carry the SAME limiters as the token routes", () => {
    // This door takes a shareable code, so without them anyone holding one
    // could mail the project owner at will.
    expect(routes).toMatch(/router\.post\("\/by-code\/:code\/pin",\s*portalPinRateLimiter/)
    expect(routes).toMatch(/router\.post\("\/by-code\/:code\/verify",\s*portalVerifyRateLimiter/)
  })

  test("they are declared ABOVE /:token", () => {
    // A tracking code is not 64 hex characters, so it would fall through to
    // the token handler and be refused as an invalid link.
    expect(routes.indexOf('"/by-code/:code/pin"')).toBeLessThan(routes.indexOf('router.get ("/:token"'))
  })

  test("they are on the guardrails allowlist, with the reason written down", () => {
    // Two new unauthenticated routes. If they were not in that allowlist the
    // route-guard test would fail, which is the point of it — so they are
    // there deliberately rather than by omission.
    const guard = read("test", "trackingGuardrails.test.js")
    expect(guard).toContain('"/portal · POST /by-code/:code/pin"')
    expect(guard).toContain('"/portal · POST /by-code/:code/verify"')
  })
})
