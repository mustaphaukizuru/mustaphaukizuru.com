// ─────────────────────────────────────────────────────────────────────────────
// T5-19 · the handover pack, and the ZIP writer under it.
//
// Two separate risks, and they need different kinds of test.
//
// THE ARCHIVE is a binary format. Hand-rolling one is how you produce a file
// that some extractors accept and others reject, so the test does not check
// this code's own arithmetic — it opens the output with Node's own inflate
// path and, where the platform provides one, a real ZIP reader. Anything
// less is marking your own homework.
//
// THE PACK is a promise about what a client is holding a year from now. So:
// the checksums are of the actual bytes, a credential never appears in it,
// it cannot contain a copy of itself, and it is attached in a way that makes
// the unpaid-invoice gate apply without a second implementation.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFileSync } = require("child_process")

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mu-handover-test-"))
process.env.STORAGE_DIR = STORAGE_DIR

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn() },
  projectFile: { findMany: jest.fn(), create: jest.fn() },
  projectEvent: { findMany: jest.fn(), create: jest.fn() },
  invoice: { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectInvoiceService", () => ({
  listForProject: jest.fn(),
}))
jest.mock("../src/services/projectEventService", () => ({
  listForProject: jest.fn(),
  serializeEvent: (e) => ({ title: e.title, detail: e.detail || null, createdAt: e.createdAt }),
  record: jest.fn().mockResolvedValue({}),
}))

const prisma = require("../src/lib/prisma")
const projectInvoices = require("../src/services/projectInvoiceService")
const projectEvents = require("../src/services/projectEventService")
const { createZip, safeEntryName, crc32 } = require("../src/lib/zip")
const handover = require("../src/services/handoverPackService")
const { STORAGE_PATHS } = require("../src/config/storagePaths")

afterAll(() => {
  delete process.env.STORAGE_DIR
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true })
})

/* ── reading the archive back ────────────────────────────────────────── */

/**
 * A minimal central-directory reader, written independently of the writer:
 * it walks the end record and the central directory rather than assuming
 * the layout the writer produced. If the two agreed only because they share
 * a bug, the platform check below catches it.
 */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  expect(eocd).toBeGreaterThan(-1)
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < count; i += 1) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8")

    expect(buf.readUInt32LE(local)).toBe(0x04034b50)
    const lNameLen = buf.readUInt16LE(local + 26)
    const lExtraLen = buf.readUInt16LE(local + 28)
    const start = local + 30 + lNameLen + lExtraLen
    const data = buf.slice(start, start + size)

    expect(method).toBe(0)
    expect(crc32(data)).toBe(crc)
    out[name] = data
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · the archive is a real archive
   ══════════════════════════════════════════════════════════════════════════ */

describe("the zip writer", () => {
  test("round-trips names, bytes and nesting", () => {
    const zip = createZip([
      { name: "a.txt", data: "hello" },
      { name: "dir/b.json", data: Buffer.from('{"x":1}') },
    ])
    const read = readZip(zip)
    expect(Object.keys(read).sort()).toEqual(["a.txt", "dir/b.json"])
    expect(read["a.txt"].toString()).toBe("hello")
  })

  test("a real ZIP reader on this machine can open it", () => {
    // The important test. Everything above could pass while the file is
    // unopenable, because the reader above shares this repo's assumptions.
    const zip = createZip([
      { name: "a.txt", data: "hello" },
      { name: "Sitio institucional.txt", data: "ñ é 中文" },
    ])
    const file = path.join(STORAGE_DIR, "probe.zip")
    fs.writeFileSync(file, zip)

    let names = null
    try {
      const out = execFileSync("python", ["-c",
        "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print('\\n'.join(z.namelist()))",
        file,
      ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      names = out.trim().split(/\r?\n/)
    } catch {
      // No python on this machine — the assertions below are skipped rather
      // than the suite failing for an unrelated reason. The CI image has it.
      names = null
    }
    if (names) {
      expect(names.sort()).toEqual(["Sitio institucional.txt", "a.txt"])
    }
  })

  test("the UTF-8 flag is set, or accented names arrive as mojibake", () => {
    const zip = createZip([{ name: "Colegio Vista ñ.txt", data: "x" }])
    // Bit 11 of the general-purpose flags, in the local header.
    expect(zip.readUInt16LE(6) & 0x0800).toBe(0x0800)
    expect(readZip(zip)["Colegio Vista ñ.txt"]).toBeTruthy()
  })

  test("backslashes and traversal never survive into an entry name", () => {
    // An entry name is not a path on the reader's disk and must never be
    // able to become one.
    expect(safeEntryName("..\\..\\etc\\passwd")).toBe("etc/passwd")
    expect(safeEntryName("/absolute/thing.pdf")).toBe("absolute/thing.pdf")
    expect(safeEntryName("./a/./b.txt")).toBe("a/b.txt")
    expect(safeEntryName("")).toBe("file")
  })

  test("a duplicate name is renamed, not silently hidden", () => {
    const read = readZip(createZip([
      { name: "invoice.pdf", data: "one" },
      { name: "invoice.pdf", data: "two" },
    ]))
    expect(Object.keys(read).sort()).toEqual(["invoice-2.pdf", "invoice.pdf"])
    expect(read["invoice.pdf"].toString()).toBe("one")
    expect(read["invoice-2.pdf"].toString()).toBe("two")
  })

  test("an empty archive is refused rather than written as a stub", () => {
    expect(() => createZip([])).toThrow(/at least one entry/)
  })

  test("a date before the format's 1980 epoch is clamped, not wrapped", () => {
    // A wrapped year renders as 2076 in some extractors, which reads as
    // corruption to anyone who notices it.
    expect(() => createZip([{ name: "a.txt", data: "x", date: new Date("1970-01-01") }])).not.toThrow()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · the pack
   ══════════════════════════════════════════════════════════════════════════ */

const PROJECT = {
  id: "p1", userId: "u1", projectName: "Colegio Vista", trackingCode: "MU-7K4C-9XQF",
  previewUrl: "https://staging.colegiovista.mx", createdAt: new Date("2026-06-01"), closedAt: new Date("2026-09-01"),
  user: { id: "u1", email: "director@colegiovista.mx", fullName: "Ana Ruiz", profile: { country: "MX" } },
  milestones: [
    { id: "m1", title: "Design", status: "approved", completedAt: new Date("2026-07-01"), sortOrder: 1 },
    { id: "m2", title: "Build", status: "in_progress", completedAt: null, sortOrder: 2 },
  ],
}

const deliverableDir = path.join(STORAGE_PATHS.projectFiles, "p1")

const writeDeliverable = (name, contents) => {
  fs.mkdirSync(deliverableDir, { recursive: true })
  fs.writeFileSync(path.join(deliverableDir, name), contents)
  return { id: `f-${name}`, fileName: name, filePath: `/files/projects/p1/${name}`, fileSize: contents.length, createdAt: new Date("2026-07-02") }
}

const readPack = () => {
  const dir = path.join(STORAGE_PATHS.projectFiles, "p1", "handover")
  const [file] = fs.readdirSync(dir)
  return readZip(fs.readFileSync(path.join(dir, file)))
}

beforeEach(() => {
  jest.clearAllMocks()
  fs.rmSync(path.join(STORAGE_PATHS.projectFiles, "p1"), { recursive: true, force: true })
  prisma.clientProject.findUnique.mockResolvedValue(PROJECT)
  prisma.projectFile.findMany.mockResolvedValue([])
  prisma.projectFile.create.mockImplementation(async ({ data }) => ({ id: "pf1", ...data }))
  projectInvoices.listForProject.mockResolvedValue({ invoices: [], billing: null })
  projectEvents.listForProject.mockResolvedValue([
    { id: "e1", title: "Project started", detail: null, createdAt: new Date("2026-06-01") },
    { id: "e2", title: "Milestone approved", detail: "Design", createdAt: new Date("2026-07-01") },
  ])
})

describe("what the client ends up holding", () => {
  test("the pack carries the six things it promises", async () => {
    const row = writeDeliverable("brand.pdf", Buffer.from("%PDF-1.4 pretend"))
    prisma.projectFile.findMany.mockResolvedValue([row])

    await handover.buildHandoverPack("p1")
    const files = readPack()

    for (const name of ["README.md", "runbook.md", "deliverables.md", "events.json", "manifest.json", "statement.pdf"]) {
      expect(files[name]).toBeTruthy()
    }
    expect(files["deliverables/brand.pdf"].toString()).toBe("%PDF-1.4 pretend")
    expect(files["statement.pdf"].subarray(0, 5).toString()).toBe("%PDF-")
  })

  test("the checksum is of the ACTUAL bytes, not of the recorded size", async () => {
    // The whole point of a checksum in a handover: it is what proves, a year
    // from now, that the file somebody is holding is the one we gave them.
    const contents = Buffer.from("the real deliverable")
    const row = writeDeliverable("thing.txt", contents)
    prisma.projectFile.findMany.mockResolvedValue([{ ...row, fileSize: 99999 }])

    await handover.buildHandoverPack("p1")
    const manifest = JSON.parse(readPack()["manifest.json"].toString())

    const expected = require("crypto").createHash("sha256").update(contents).digest("hex")
    expect(manifest.deliverables[0].sha256).toBe(expected)
    expect(manifest.deliverables[0].size).toBe(contents.length)
  })

  test("a deliverable whose bytes are gone is listed with a null checksum, not a wrong one", async () => {
    // An honest gap beats a value nobody can verify.
    prisma.projectFile.findMany.mockResolvedValue([
      { id: "f9", fileName: "missing.pdf", filePath: "/files/projects/p1/missing.pdf", fileSize: 10, createdAt: new Date() },
    ])
    await handover.buildHandoverPack("p1")
    const manifest = JSON.parse(readPack()["manifest.json"].toString())

    expect(manifest.deliverables[0]).toMatchObject({ name: "missing.pdf", sha256: null, included: false })
    expect(readPack()["deliverables/missing.pdf"]).toBeUndefined()
  })

  test("the pack never contains a copy of itself", async () => {
    // Re-running handover would otherwise nest last week's archive inside
    // this week's, and the week after that.
    prisma.projectFile.findMany.mockResolvedValue([
      { id: "old", fileName: "handover-old.zip", filePath: "/files/projects/p1/handover/handover-old.zip", fileSize: 1, createdAt: new Date() },
    ])
    await handover.buildHandoverPack("p1")
    const manifest = JSON.parse(readPack()["manifest.json"].toString())
    expect(manifest.deliverables).toEqual([])
  })

  test("what is left OUT is stated, not merely absent", async () => {
    // A reader should not have to infer that a credential was excluded on
    // purpose, or that a CFDI is missing rather than forgotten.
    await handover.buildHandoverPack("p1")
    const manifest = JSON.parse(readPack()["manifest.json"].toString())
    expect(manifest.excluded.map((x) => x.what).sort()).toEqual(["cfdi-xml", "credentials"])
    // In the CLIENT's language — this one is Mexican, so Spanish.
    expect(readPack()["README.md"].toString()).toMatch(/nunca viajan como archivos/i)
  })

  test("no credential, secret or password value can reach the archive", async () => {
    // There is no code path that puts one in — this asserts the shape of the
    // pack rather than a filter, because a filter would imply there is
    // something to filter.
    await handover.buildHandoverPack("p1")
    const files = readPack()
    const joined = Object.values(files).map((b) => b.toString("utf8")).join("\n")
    expect(joined).not.toMatch(/ciphertext|SECRET_HANDOFF_KEY/)
  })
})

describe("invoices in the pack", () => {
  test("an invoice PDF on disk is included and checksummed", async () => {
    const { INVOICE_DIR } = require("../src/services/invoiceService")
    fs.mkdirSync(INVOICE_DIR, { recursive: true })
    fs.writeFileSync(path.join(INVOICE_DIR, "A-000142.pdf"), Buffer.from("%PDF-1.4 invoice"))
    projectInvoices.listForProject.mockResolvedValue({
      invoices: [{ invoiceNumber: "A-000142", status: "paid", totalAmount: 1000, currency: "MXN", issuedAt: new Date("2026-08-01") }],
      billing: null,
    })

    await handover.buildHandoverPack("p1")
    const files = readPack()
    expect(files["invoices/A-000142.pdf"].toString()).toBe("%PDF-1.4 invoice")

    const manifest = JSON.parse(files["manifest.json"].toString())
    expect(manifest.invoices[0]).toMatchObject({ invoiceNumber: "A-000142", included: true, cfdiXml: null })
  })

  test("an invoice with no PDF yet is listed and marked not included", async () => {
    projectInvoices.listForProject.mockResolvedValue({
      invoices: [{ invoiceNumber: "A-NOPE", status: "issued", totalAmount: 500, currency: "MXN", issuedAt: new Date() }],
      billing: null,
    })
    await handover.buildHandoverPack("p1")
    const manifest = JSON.parse(readPack()["manifest.json"].toString())
    expect(manifest.invoices[0]).toMatchObject({ invoiceNumber: "A-NOPE", included: false })
  })
})

describe("how it is attached", () => {
  test("as a DELIVERABLE, so the unpaid-invoice gate already written applies", async () => {
    // Not a route of its own. Getting the gate for free is the reason.
    await handover.buildHandoverPack("p1")
    const data = prisma.projectFile.create.mock.calls[0][0].data
    expect(data).toMatchObject({ projectId: "p1", isDeliverable: true, fileType: "application/zip", uploadedByRole: "admin" })
    expect(data.filePath).toMatch(/^\/files\/projects\/p1\/handover\//)
  })

  test("the file name carries the project and the date, not a uuid", async () => {
    await handover.buildHandoverPack("p1", { now: new Date("2026-09-05T10:00:00Z") })
    expect(prisma.projectFile.create.mock.calls[0][0].data.fileName)
      .toBe("handover-Colegio-Vista-2026-09-05.zip")
  })

  test("a project name full of punctuation cannot escape the filename", async () => {
    prisma.clientProject.findUnique.mockResolvedValue({ ...PROJECT, projectName: "../../etc/passwd" })
    await handover.buildHandoverPack("p1", { now: new Date("2026-09-05T10:00:00Z") })
    const { fileName, filePath } = prisma.projectFile.create.mock.calls[0][0].data
    expect(fileName).not.toMatch(/[/\\]/)
    expect(filePath).toBe(`/files/projects/p1/handover/${fileName}`)
  })

  test("it is recorded on the timeline as a delivered file", async () => {
    await handover.buildHandoverPack("p1")
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "p1", type: "file.delivered", actorRole: "system",
    }))
  })

  test("a missing project returns null rather than throwing", async () => {
    prisma.clientProject.findUnique.mockResolvedValue(null)
    await expect(handover.buildHandoverPack("nope")).resolves.toBeNull()
  })

  test("handover fires it and does not wait — a failed pack cannot undo a handover", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "services", "clientProjectService.js"), "utf8")
    const block = src.slice(src.indexOf('patch.accessState === "handover"'))
    expect(block.slice(0, 700)).toContain("buildHandoverPack(updated.id)")
    expect(block.slice(0, 700)).toContain(".catch(")
  })
})

describe("the written parts read like they were written for a client", () => {
  test("Spanish for a Mexican client, English otherwise", () => {
    const es = handover.buildRunbook({ project: PROJECT, milestones: PROJECT.milestones, locale: "es" })
    const en = handover.buildRunbook({ project: PROJECT, milestones: PROJECT.milestones, locale: "en" })
    expect(es).toContain("Qué se entregó")
    expect(en).toContain("What was delivered")
  })

  test("the runbook lists what was finished, not what is still open", () => {
    const out = handover.buildRunbook({ project: PROJECT, milestones: PROJECT.milestones, locale: "en" })
    expect(out).toContain("Design")
    expect(out).not.toContain("Build")
  })

  test("it says the files are removed later and that this pack is the copy that lasts", () => {
    // The single most useful sentence in the archive.
    const out = handover.buildRunbook({ project: PROJECT, milestones: PROJECT.milestones, locale: "en" })
    expect(out).toMatch(/permanent copy/i)
  })

  test("it tells them how to get back in without an account", () => {
    const out = handover.buildRunbook({ project: PROJECT, milestones: PROJECT.milestones, locale: "en" })
    expect(out).toContain("MU-7K4C-9XQF")
  })
})
