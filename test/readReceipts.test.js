// ─────────────────────────────────────────────────────────────────────────────
// T5-14 · read receipts.
//
// The whole feature is two questions about WHO, and both of them are easy to
// get subtly wrong in a way nobody notices:
//
//   Whose view counts?    Only the client's. An admin opening the file they
//                         uploaded an hour ago would make every receipt a lie
//                         about the person it names — and a lie in the
//                         direction that stops the operator chasing.
//
//   Who may see it?       Only the admin. An operator knowing whether the
//                         deliverable was looked at is the difference between
//                         chasing and waiting; a client shown "you opened
//                         this on Tuesday" is being watched.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  projectFile: { update: jest.fn() },
  invoice: { update: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectEventService", () => ({
  record: jest.fn().mockResolvedValue({}),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const projectEvents = require("../src/services/projectEventService")
const receipts = require("../src/services/readReceiptService")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const FILE = { id: "f1", projectId: "p1", fileName: "brand-guide.pdf", firstViewedAt: null }
const INVOICE = { id: "inv1", invoiceNumber: "A-000123", firstViewedAt: null }

beforeEach(() => {
  jest.clearAllMocks()
  prisma.projectFile.update.mockResolvedValue({})
  prisma.invoice.update.mockResolvedValue({})
})

describe("whose view counts", () => {
  test("a member download stamps it", async () => {
    await receipts.recordFileView(FILE, "project.file.downloaded")
    expect(prisma.projectFile.update).toHaveBeenCalledTimes(1)
  })

  test("a portal download stamps it too — the PIN proved they are the client", async () => {
    await receipts.recordFileView(FILE, "project.file.downloaded.portal")
    expect(prisma.projectFile.update).toHaveBeenCalledTimes(1)
  })

  test("AN ADMIN DOWNLOAD DOES NOT", async () => {
    // The one that matters. The same streaming tail serves the admin route,
    // so without this check the operator marks the client's own homework.
    await receipts.recordFileView(FILE, "project.file.downloaded.admin")
    expect(prisma.projectFile.update).not.toHaveBeenCalled()
    expect(projectEvents.record).not.toHaveBeenCalled()
  })

  test("an unknown action does not, either — the list is an allowlist", async () => {
    await receipts.recordFileView(FILE, "something.new")
    await receipts.recordFileView(FILE, undefined)
    expect(prisma.projectFile.update).not.toHaveBeenCalled()
  })
})

describe("the first time is the interesting one", () => {
  test("firstViewedAt is set on the first view", async () => {
    await receipts.recordFileView(FILE, "project.file.downloaded")
    const { data } = prisma.projectFile.update.mock.calls[0][0]
    expect(data.firstViewedAt).toBeInstanceOf(Date)
    expect(data.viewCount).toEqual({ increment: 1 })
  })

  test("and NEVER moved afterwards", async () => {
    // Overwriting it turns "they saw it three weeks ago and did nothing"
    // into "they saw it just now", which is the opposite of what the
    // operator needs to know. viewCount carries the repetition instead.
    const seen = { ...FILE, firstViewedAt: new Date("2026-08-01T00:00:00Z") }
    await receipts.recordFileView(seen, "project.file.downloaded")
    const { data } = prisma.projectFile.update.mock.calls[0][0]
    expect(data).not.toHaveProperty("firstViewedAt")
    expect(data.viewCount).toEqual({ increment: 1 })
  })

  test("the event fires once, not once per open", async () => {
    // A client who opens a deliverable eleven times has told the operator
    // one thing, not eleven, and eleven rows would bury the timeline.
    await receipts.recordFileView(FILE, "project.file.downloaded")
    expect(projectEvents.record).toHaveBeenCalledTimes(1)

    jest.clearAllMocks()
    await receipts.recordFileView({ ...FILE, firstViewedAt: new Date() }, "project.file.downloaded")
    expect(projectEvents.record).not.toHaveBeenCalled()
  })
})

describe("who may see it", () => {
  test("both events are admin-visibility, never client", () => {
    // The line between "useful to the operator" and "surveillance of the
    // client" is exactly this field.
    const service = read("src", "services", "projectEventService.js")
    for (const type of ['"file.viewed"', '"invoice.viewed"']) {
      const block = service.slice(service.indexOf(type))
      expect(block.slice(0, 160)).toContain('visibility: "admin"')
    }
  })

  test("a client-audience read can never reach them", () => {
    const events = jest.requireActual("../src/services/projectEventService")
    expect(events.visibilitiesFor("client")).not.toContain("admin")
  })
})

describe("an invoice that was opened", () => {
  test("is stamped, with the event carrying the number", async () => {
    await receipts.recordInvoiceView(INVOICE, { projectId: "p1" })
    expect(prisma.invoice.update).toHaveBeenCalledTimes(1)
    expect(projectEvents.record.mock.calls[0][0]).toMatchObject({
      projectId: "p1", type: "invoice.viewed", detail: "A-000123",
    })
  })

  test("with no project there is still a receipt, just no event", async () => {
    // A storefront invoice has no project to write a timeline on. The
    // operator still wants to know the bill was opened.
    await receipts.recordInvoiceView(INVOICE, {})
    expect(prisma.invoice.update).toHaveBeenCalledTimes(1)
    expect(projectEvents.record).not.toHaveBeenCalled()
  })
})

describe("a receipt never costs a download", () => {
  test("a write that fails is swallowed", async () => {
    // A note in the margin must not stop a client getting a file they are
    // entitled to.
    prisma.projectFile.update.mockRejectedValue(new Error("db gone"))
    await expect(receipts.recordFileView(FILE, "project.file.downloaded")).resolves.toBeNull()

    prisma.invoice.update.mockRejectedValue(new Error("db gone"))
    await expect(receipts.recordInvoiceView(INVOICE, { projectId: "p1" })).resolves.toBeNull()
  })

  test("the callers do not await it", () => {
    // Fire-and-forget, beside the access log and for the same reason.
    const controller = read("src", "controllers", "clientProjectController.js")
    expect(controller).toContain("readReceipts.recordFileView(file, action).catch(() => null)")

    const portal = read("src", "controllers", "portalController.js")
    expect(portal).toMatch(/readReceipts\.recordInvoiceView\([^)]*\)[\s\S]{0,80}\.catch\(\(\) => null\)/)
  })

  test("the invoice stamp happens AFTER the authorisation gate", () => {
    // Stamping before it would let a probe for someone else's invoice id
    // mark that invoice as read.
    const portal = read("src", "controllers", "portalController.js")
    const block = portal.slice(portal.indexOf("const downloadInvoice"))
    const gate = block.indexOf("if (!invoice)")
    const stamp = block.indexOf("recordInvoiceView")
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(stamp)
  })
})
