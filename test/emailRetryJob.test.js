// ─────────────────────────────────────────────────────────────────────────────
// Step 41 · single email layer with retry.
//   emailService: EmailLog on every send, transient vs permanent failures,
//   backoff scheduling, re-send from stored payload.
//   emailRetryJob: drains due `failed` rows and updates the same row.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  emailTemplate: { findFirst: jest.fn() },
  emailLog: {
    create:   jest.fn(async ({ data }) => ({ id: "log_1", ...data })),
    update:   jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
    findMany: jest.fn(),
  },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }))

const mockSendMail = jest.fn()
const mockVerify   = jest.fn()
jest.mock("nodemailer", () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail, verify: mockVerify, close: jest.fn() })) }))

const prisma = require("../src/lib/prisma")
const nodemailer = require("nodemailer")
const emailService = require("../src/services/emailService")
const { runEmailRetryPass } = require("../src/jobs/emailRetryJob")

const smtpErr = (props) => Object.assign(new Error(props.message || "smtp"), props)

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SMTP_USER = "u"
  process.env.SMTP_PASS = "p"
  emailService.resetTransport()
})

/* ─────────────────────────── classification ───────────────────────────── */

test("isTransientError: connection/timeouts/4xx retry, 5xx do not", () => {
  expect(emailService.isTransientError(smtpErr({ code: "ECONNECTION" }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ code: "ETIMEDOUT" }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ code: "EAI_AGAIN" }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ responseCode: 421 }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ responseCode: 450 }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ responseCode: 451 }))).toBe(true)
  expect(emailService.isTransientError(smtpErr({ responseCode: 550, message: "550 mailbox unavailable" }))).toBe(false)
  expect(emailService.isTransientError(smtpErr({ responseCode: 535, message: "auth failed" }))).toBe(false)
})

test("backoffFor: 5 min × 2^(attempts-1)", () => {
  const now = Date.now()
  expect(emailService.backoffFor(1).getTime() - now).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50)
  expect(emailService.backoffFor(2).getTime() - now).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50)
  expect(emailService.backoffFor(2).getTime() - now).toBeLessThan(10 * 60 * 1000 + 1000)
})

/* ─────────────────────────── sends + logging ──────────────────────────── */

test("sendRawEmail success → EmailLog sent with messageId, attempts=1, single transport", async () => {
  mockSendMail.mockResolvedValue({ messageId: "<m1>" })
  const r1 = await emailService.sendRawEmail({ to: "a@b.c", subject: "Hi", html: "<p>x</p>" })
  const r2 = await emailService.sendRawEmail({ to: "a@b.c", subject: "Hi2", html: "<p>y</p>" })
  expect(r1).toMatchObject({ ok: true, messageId: "<m1>", logId: "log_1" })
  expect(r2.ok).toBe(true)
  expect(nodemailer.createTransport).toHaveBeenCalledTimes(1)
  const data = prisma.emailLog.create.mock.calls[0][0].data
  expect(data).toMatchObject({ status: "sent", emailTo: "a@b.c", providerMessageId: "<m1>", attempts: 1, nextAttemptAt: null, payload: null })
})

test("transient failure → failed + nextAttemptAt + stored payload; never throws", async () => {
  mockSendMail.mockRejectedValue(smtpErr({ code: "ETIMEDOUT", message: "Connection timeout" }))
  const before = Date.now()
  const res = await emailService.sendRawEmail({ to: "a@b.c", subject: "Hi", html: "<p>x</p>", headers: { "X-T": "1" } })
  expect(res).toMatchObject({ ok: false, willRetry: true, error: "Connection timeout" })
  const data = prisma.emailLog.create.mock.calls[0][0].data
  expect(data.status).toBe("failed")
  expect(data.attempts).toBe(1)
  expect(data.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50)
  expect(data.payload).toMatchObject({ to: "a@b.c", subject: "Hi", html: "<p>x</p>", headers: { "X-T": "1" } })
})

test("permanent failure (5xx) → failed, no retry scheduled, no payload", async () => {
  mockSendMail.mockRejectedValue(smtpErr({ responseCode: 550, message: "550 No such user" }))
  const res = await emailService.sendRawEmail({ to: "nobody@b.c", subject: "Hi", html: "<p>x</p>" })
  expect(res).toMatchObject({ ok: false, willRetry: false })
  const data = prisma.emailLog.create.mock.calls[0][0].data
  expect(data).toMatchObject({ status: "failed", nextAttemptAt: null, payload: null, errorMessage: "550 No such user" })
})

test("SMTP not configured → skipped log, no transport created", async () => {
  delete process.env.SMTP_USER
  delete process.env.SMTP_PASS
  const res = await emailService.sendRawEmail({ to: "a@b.c", subject: "Hi", html: "<p>x</p>" })
  expect(res).toMatchObject({ ok: false, skipped: true })
  expect(nodemailer.createTransport).not.toHaveBeenCalled()
  expect(prisma.emailLog.create.mock.calls[0][0].data.status).toBe("skipped")
})

test("sendTemplateEmail renders DB template, wraps fragments, passes ICS parts, logs templateKey", async () => {
  prisma.emailTemplate.findFirst.mockResolvedValue({
    key: "consultation.reminder", locale: "en", isActive: true,
    subject: "Reminder — {{whenLabel}}", htmlBody: "<p>Hi {{customerName}}</p>", textBody: "Hi {{customerName}}",
  })
  mockSendMail.mockResolvedValue({ messageId: "<m2>" })
  const ics = { contentType: "text/calendar", content: "BEGIN:VCALENDAR" }
  const res = await emailService.sendTemplateEmail({
    to: "a@b.c", templateKey: "consultation.reminder", userId: "u1",
    variables: { whenLabel: "tomorrow", customerName: "Ana" },
    alternatives: [ics], attachments: [{ ...ics, filename: "invite.ics" }],
    icalEvent: { method: "REQUEST", content: "BEGIN:VCALENDAR", filename: "invite.ics" },
  })
  expect(res.ok).toBe(true)
  const mail = mockSendMail.mock.calls[0][0]
  expect(mail.subject).toBe("Reminder — tomorrow")
  expect(mail.html).toMatch(/<!doctype html>/i)       // wrapped by emailLayoutService
  expect(mail.html).toContain("<p>Hi Ana</p>")
  expect(mail.text).toBe("Hi Ana")
  expect(mail.alternatives).toHaveLength(1)
  expect(mail.icalEvent.method).toBe("REQUEST")
  expect(prisma.emailLog.create.mock.calls[0][0].data).toMatchObject({ templateKey: "consultation.reminder", userId: "u1", status: "sent" })
})

test("sendTemplateEmail: missing template → failed log, not retryable, no throw", async () => {
  prisma.emailTemplate.findFirst.mockResolvedValue(null)
  const res = await emailService.sendTemplateEmail({ to: "a@b.c", templateKey: "nope" })
  expect(res.ok).toBe(false)
  expect(res.error).toMatch(/not found/)
  expect(prisma.emailLog.create.mock.calls[0][0].data).toMatchObject({ status: "failed", templateKey: "nope" })
  expect(mockSendMail).not.toHaveBeenCalled()
})

/* ─────────────────────────── mailer facade ────────────────────────────── */

test("utils/mailer facade delegates to emailService with template keys + ICS", async () => {
  const mailer = require("../src/utils/mailer")
  prisma.emailTemplate.findFirst.mockResolvedValue({ subject: "Cancelled {{scheduledAt}}", htmlBody: "<p>{{cancellationReason}}</p>", textBody: null })
  mockSendMail.mockResolvedValue({ messageId: "<m3>" })
  const consultation = {
    id: "c1", userId: "u1", user: { email: "a@b.c", fullName: "Ana Lopez" },
    scheduledAt: new Date("2026-09-01T15:00:00Z"), durationMin: 30, timezone: "UTC",
    cancellationReason: "Host unavailable", service: { title: "Strategy call" },
  }
  const res = await mailer.sendConsultationCancelledEmail(consultation, { locale: "es" })
  expect(res.ok).toBe(true)
  expect(prisma.emailTemplate.findFirst.mock.calls[0][0].where).toMatchObject({ key: "consultation.cancelled", locale: "es" })
  const mail = mockSendMail.mock.calls[0][0]
  expect(mail.html).toContain("Host unavailable")
  expect(mail.icalEvent.method).toBe("CANCEL")
  expect(mail.attachments[0].filename).toBe("cancelled.ics")

  // no recipient → resolves, never rejects
  await expect(mailer.sendOrderPaidEmail({})).resolves.toMatchObject({ ok: false })
  for (const fn of ["sendResetEmail","sendOrderPlacedEmail","sendOrderPaidEmail","sendOrderPendingEmail","sendOrderCancelledEmail",
    "sendOrderFailedEmail","sendOrderRefundedEmail","sendWelcomeEmail","sendDownloadReadyEmail","sendContactFormEmail",
    "sendSupportTicketEmail","sendSupportReplyEmail","sendNewsletterConfirmationEmail","sendPasswordResetConfirmationEmail",
    "sendConsultationConfirmationEmail","sendConsultationRescheduledEmail","sendConsultationCancelledEmail","sendConsultationReminderEmail"]) {
    expect(typeof mailer[fn]).toBe("function")
  }
})

/* ─────────────────────────── retry job ────────────────────────────────── */

const failedRow = (over = {}) => ({
  id: "log_9", userId: null, templateKey: "order.paid", emailTo: "a@b.c", subject: "Paid",
  status: "failed", attempts: 1, nextAttemptAt: new Date(Date.now() - 1000),
  payload: { from: "me", to: "a@b.c", subject: "Paid", html: "<p>paid</p>", text: "paid" },
  ...over,
})

test("retry pass: due row re-sent from payload and the SAME row is marked sent", async () => {
  prisma.emailLog.findMany.mockResolvedValue([failedRow()])
  mockSendMail.mockResolvedValue({ messageId: "<m4>" })
  const summary = await runEmailRetryPass()
  expect(summary).toEqual({ picked: 1, sent: 1, failed: 0, rescheduled: 0 })
  const q = prisma.emailLog.findMany.mock.calls[0][0].where
  expect(q).toMatchObject({ status: "failed", attempts: { lt: 3 }, payload: { not: null } })
  expect(q.nextAttemptAt.lte).toBeInstanceOf(Date)
  expect(mockSendMail.mock.calls[0][0]).toMatchObject({ to: "a@b.c", subject: "Paid", html: "<p>paid</p>" })
  expect(prisma.emailLog.create).not.toHaveBeenCalled()
  expect(prisma.emailLog.update).toHaveBeenCalledWith({
    where: { id: "log_9" },
    data: expect.objectContaining({ status: "sent", providerMessageId: "<m4>", attempts: 2, nextAttemptAt: null, payload: null }),
  })
})

test("retry pass: second transient failure reschedules with 10 min backoff", async () => {
  prisma.emailLog.findMany.mockResolvedValue([failedRow()])
  mockSendMail.mockRejectedValue(smtpErr({ responseCode: 451, message: "451 try later" }))
  const before = Date.now()
  const summary = await runEmailRetryPass()
  expect(summary).toEqual({ picked: 1, sent: 0, failed: 0, rescheduled: 1 })
  const data = prisma.emailLog.update.mock.calls[0][0].data
  expect(data.status).toBe("failed")
  expect(data.attempts).toBe(2)
  expect(data.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50)
  expect(data.payload).toBeTruthy()
})

test("retry pass: third attempt failing gives up (attempts=3, no nextAttemptAt)", async () => {
  prisma.emailLog.findMany.mockResolvedValue([failedRow({ attempts: 2 })])
  mockSendMail.mockRejectedValue(smtpErr({ code: "ECONNECTION" }))
  const summary = await runEmailRetryPass()
  expect(summary.failed).toBe(1)
  const data = prisma.emailLog.update.mock.calls[0][0].data
  expect(data).toMatchObject({ status: "failed", attempts: 3, nextAttemptAt: null, payload: null })
})

test("retry pass: row without payload is neutralised, findMany errors do not throw", async () => {
  prisma.emailLog.findMany.mockResolvedValue([failedRow({ payload: null })])
  const summary = await runEmailRetryPass()
  expect(summary.failed).toBe(1)
  expect(mockSendMail).not.toHaveBeenCalled()
  expect(prisma.emailLog.update.mock.calls[0][0].data.nextAttemptAt).toBeNull()

  prisma.emailLog.findMany.mockRejectedValue(new Error("db down"))
  await expect(runEmailRetryPass()).resolves.toEqual({ picked: 0, sent: 0, failed: 0, rescheduled: 0 })
})

test("verifyTransport uses the shared transport", async () => {
  mockVerify.mockResolvedValue(true)
  await expect(emailService.verifyTransport()).resolves.toEqual({ ok: true })
  delete process.env.SMTP_USER
  emailService.resetTransport()
  await expect(emailService.verifyTransport()).resolves.toMatchObject({ skipped: true })
})
