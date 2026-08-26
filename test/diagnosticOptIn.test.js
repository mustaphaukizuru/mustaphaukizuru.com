// ─────────────────────────────────────────────────────────────────────────────
// controllers/diagnosticController — nurture opt-in.
//
// When the self-audit form is submitted with `newsletterOptIn: true` the
// controller must go through newsletterService.subscribe({ source:
// "diagnostic" }) — the double-opt-in path — and send the confirm template.
// It must never write "subscribed" itself, and must never opt in by default.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  diagnosticSubmission: { create: jest.fn(), update: jest.fn() },
  newsletterSubscriber: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({
  sendRawEmail: jest.fn().mockResolvedValue({}),
  sendTemplateEmail: jest.fn().mockResolvedValue({}),
}))
jest.mock("../src/services/newsletterService", () => {
  const actual = jest.requireActual("../src/services/newsletterService")
  return { ...actual, subscribe: jest.fn(actual.subscribe) }
})
// pdfkit is heavy and irrelevant here — make generatePdf fail fast (caught).
jest.mock("pdfkit", () => function PDFDocumentStub() { throw new Error("pdf disabled in test") })

const prisma = require("../src/lib/prisma")
const emailService = require("../src/services/emailService")
const newsletterService = require("../src/services/newsletterService")
const { submitDiagnostic } = require("../src/controllers/diagnosticController")

// asyncHandler does not return the promise, so resolve when the handler
// responds (res.json) or forwards an error (next).
function mockRes() {
  const res = {}
  res.done = new Promise((resolve) => { res._resolve = resolve })
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => { res._resolve(); return res })
  return res
}

const baseBody = {
  name: "Ana Lopez", email: "Ana@Example.com", audience: "SMB",
  overall: { pct: 42 }, sectionScores: {}, scores: {}, topPriorities: [],
}

async function submit(body) {
  const req = { body, headers: {}, query: {}, cookies: {} }
  const res = mockRes()
  const next = jest.fn((err) => { res.nextError = err; res._resolve() })
  submitDiagnostic(req, res, next)
  await res.done
  expect(res.nextError).toBeUndefined()
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.diagnosticSubmission.create.mockResolvedValue({ id: "d1" })
  prisma.diagnosticSubmission.update.mockResolvedValue({})
  prisma.newsletterSubscriber.findUnique.mockResolvedValue(null)
  prisma.newsletterSubscriber.create.mockImplementation(async ({ data }) => ({ id: "n1", ...data }))
})

test("opt-in true → pending subscriber with source=diagnostic + confirm email; report copy mentions confirmation", async () => {
  const res = await submit({ ...baseBody, newsletterOptIn: true })

  expect(res.status).toHaveBeenCalledWith(200)
  expect(newsletterService.subscribe).toHaveBeenCalledWith({ email: "ana@example.com", name: "Ana Lopez", source: "diagnostic" })

  const created = prisma.newsletterSubscriber.create.mock.calls[0][0].data
  expect(created).toMatchObject({ email: "ana@example.com", status: "pending", source: "diagnostic" })
  expect(created.status).not.toBe("subscribed")

  const confirm = emailService.sendTemplateEmail.mock.calls.find((c) => c[0].templateKey === "newsletter.confirm")
  expect(confirm).toBeTruthy()
  expect(confirm[0].to).toBe("ana@example.com")
  expect(confirm[0].variables.confirmUrl).toMatch(/\/newsletter\/confirm\//)

  const report = emailService.sendRawEmail.mock.calls.find((c) => c[0].templateKey === "diagnostic.report")[0]
  expect(report.html).toMatch(/confirm your newsletter subscription/i)
  expect(report.html).not.toMatch(/won't receive any newsletter/i)
})

test("no flag → no subscribe call, no confirm email, 'no newsletter' copy kept", async () => {
  const res = await submit({ ...baseBody })
  expect(res.status).toHaveBeenCalledWith(200)
  expect(newsletterService.subscribe).not.toHaveBeenCalled()
  expect(prisma.newsletterSubscriber.create).not.toHaveBeenCalled()
  expect(emailService.sendTemplateEmail).not.toHaveBeenCalled()

  const report = emailService.sendRawEmail.mock.calls.find((c) => c[0].templateKey === "diagnostic.report")[0]
  expect(report.html).toMatch(/won't receive any newsletter/i)
})

test.each([["true"], [1], ["yes"], [null], [false]])("truthy-but-not-boolean %p never opts in", async (flag) => {
  await submit({ ...baseBody, newsletterOptIn: flag })
  expect(newsletterService.subscribe).not.toHaveBeenCalled()
})

test("already-subscribed address → no confirm email, report still sent", async () => {
  prisma.newsletterSubscriber.findUnique.mockResolvedValue({ id: "n1", email: "ana@example.com", status: "subscribed", unsubscribeToken: "t" })
  const res = await submit({ ...baseBody, newsletterOptIn: true })
  expect(res.status).toHaveBeenCalledWith(200)
  expect(emailService.sendTemplateEmail).not.toHaveBeenCalled()
  expect(prisma.newsletterSubscriber.update).not.toHaveBeenCalled()
  expect(emailService.sendRawEmail).toHaveBeenCalledTimes(2)
})

test("newsletter failure never breaks the report", async () => {
  newsletterService.subscribe.mockRejectedValueOnce(new Error("db down"))
  const res = await submit({ ...baseBody, newsletterOptIn: true })
  expect(res.status).toHaveBeenCalledWith(200)
  expect(emailService.sendRawEmail).toHaveBeenCalledTimes(2)
})
