// ─────────────────────────────────────────────────────────────────────────────
// cvPdfService — GET /api/v1/bio/cv.pdf (Tier 3, server-generated CV)
//
//   1. Renders a real PDF (starts with %PDF-) from the four bio tables,
//      honouring lang + track (title/summary in the PDF metadata).
//   2. Disk cache is keyed by track + lang + max updatedAt: a second call
//      with the same version reads the file instead of rendering.
//   3. A bumped updatedAt produces a new file name (cache miss).
//   4. Unknown lang/track fall back to en / fullstack.
//   5. Controller sets Cache-Control: public, max-age=3600 + PDF headers.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const os   = require("os")
const path = require("path")

jest.mock("../src/lib/prisma", () => ({
  experience:  { findMany: jest.fn(), aggregate: jest.fn() },
  education:   { findMany: jest.fn(), aggregate: jest.fn() },
  certificate: { findMany: jest.fn(), aggregate: jest.fn() },
  skill:       { findMany: jest.fn(), aggregate: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { getCvPdf, cacheFileName } = require("../src/services/cvPdfService")
const { resolveTrack, resolveLang, CV_TRACKS } = require("../src/config/cvTracks")
const { STORAGE_PATHS } = require("../src/config/storagePaths")

const T1 = new Date("2026-01-01T00:00:00Z")
const T2 = new Date("2026-06-01T00:00:00Z")

function seed(version = T1) {
  prisma.experience.findMany.mockResolvedValue([{
    role: "IT Manager", company: "Acme School", location: "Mexico City",
    startDate: new Date("2022-08-01"), endDate: null,
    description: "Ran school technology.", highlights: ["Built the LMS", "Cut downtime 40%"],
    tools: ["Node", "React"],
  }])
  prisma.education.findMany.mockResolvedValue([{
    degree: "BSc", institution: "University", fieldOfStudy: "Computer Science",
    startDate: new Date("2014-09-01"), endDate: new Date("2018-06-01"),
    description: "", highlights: null,
  }])
  prisma.certificate.findMany.mockResolvedValue([{
    title: "Google IT Support", issuer: "Google", issueDate: new Date("2021-03-01"), credentialId: "ABC",
  }])
  prisma.skill.findMany.mockResolvedValue([
    { name: "React", category: "frontend" },
    { name: "Node.js", category: "backend" },
    { name: "Mentoring", category: "soft_skill" },
  ])
  for (const m of ["experience", "education", "certificate", "skill"]) {
    prisma[m].aggregate.mockResolvedValue({ _max: { updatedAt: version } })
  }
}

let outDir
beforeEach(() => {
  jest.clearAllMocks()
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "cv-test-"))
})
afterEach(() => {
  fs.rmSync(outDir, { recursive: true, force: true })
})

describe("cvTracks", () => {
  test("resolves known tracks and falls back to fullstack", () => {
    expect(resolveTrack("ict-stem").slug).toBe("ict-stem")
    expect(resolveTrack("SUPPORT").slug).toBe("support")
    expect(resolveTrack("nope").slug).toBe("fullstack")
    expect(resolveTrack(undefined).slug).toBe("fullstack")
  })

  test("resolves lang to en|es only", () => {
    expect(resolveLang("es")).toBe("es")
    expect(resolveLang("es-MX")).toBe("es")
    expect(resolveLang("fr")).toBe("en")
    expect(resolveLang()).toBe("en")
  })

  test("every track has en+es title and summary and a full emphasis list", () => {
    for (const track of Object.values(CV_TRACKS)) {
      expect(track.title.en).toBeTruthy()
      expect(track.title.es).toBeTruthy()
      expect(track.summary.en).toBeTruthy()
      expect(track.summary.es).toBeTruthy()
      expect(track.emphasis.length).toBeGreaterThan(0)
    }
  })

  test("STORAGE_PATHS exposes a cv directory under the storage base", () => {
    expect(STORAGE_PATHS.cv).toBe(path.join(STORAGE_PATHS.base, "cv"))
  })
})

describe("getCvPdf", () => {
  test("renders a PDF from the bio rows with the track title and language", async () => {
    seed()
    const res = await getCvPdf({ lang: "es", track: "ict-stem", outDir })
    expect(res.cached).toBe(false)
    expect(res.lang).toBe("es")
    expect(res.track).toBe("ict-stem")
    expect(Buffer.isBuffer(res.buffer)).toBe(true)
    expect(res.buffer.subarray(0, 5).toString()).toBe("%PDF-")
    expect(res.buffer.length).toBeGreaterThan(1000)
    // Track title lands in the PDF info dictionary (uncompressed in pdfkit).
    const text = res.buffer.toString("latin1")
    expect(text).toContain("Mustapha Ukizuru")
    expect(text).toContain("Coordinador TIC")
    // All four tables were read, visible rows only.
    for (const m of ["experience", "education", "certificate", "skill"]) {
      expect(prisma[m].findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isVisible: true } }))
    }
  })

  test("writes the render to disk keyed by track+lang+version and serves it from cache next time", async () => {
    seed(T1)
    const first = await getCvPdf({ lang: "en", track: "fullstack", outDir })
    const expectedName = cacheFileName("fullstack", "en", T1.getTime())
    expect(first.fileName).toBe(expectedName)
    expect(fs.existsSync(path.join(outDir, expectedName))).toBe(true)

    jest.clearAllMocks()
    seed(T1)
    const second = await getCvPdf({ lang: "en", track: "fullstack", outDir })
    expect(second.cached).toBe(true)
    expect(second.buffer.equals(first.buffer)).toBe(true)
    expect(prisma.experience.findMany).not.toHaveBeenCalled()
    expect(prisma.skill.findMany).not.toHaveBeenCalled()
  })

  test("a newer updatedAt in any table invalidates the cache", async () => {
    seed(T1)
    await getCvPdf({ lang: "en", track: "fullstack", outDir })

    jest.clearAllMocks()
    seed(T1)
    prisma.skill.aggregate.mockResolvedValue({ _max: { updatedAt: T2 } })
    const res = await getCvPdf({ lang: "en", track: "fullstack", outDir })
    expect(res.cached).toBe(false)
    expect(res.version).toBe(T2.getTime())
    expect(res.fileName).toBe(cacheFileName("fullstack", "en", T2.getTime()))
    expect(prisma.experience.findMany).toHaveBeenCalled()
  })

  test("lang and track are cached independently", async () => {
    seed(T1)
    const en = await getCvPdf({ lang: "en", track: "support", outDir })
    const es = await getCvPdf({ lang: "es", track: "support", outDir })
    expect(en.fileName).not.toBe(es.fileName)
    expect(es.cached).toBe(false)
  })

  test("empty tables still render a valid PDF", async () => {
    for (const m of ["experience", "education", "certificate", "skill"]) {
      prisma[m].findMany.mockResolvedValue([])
      prisma[m].aggregate.mockResolvedValue({ _max: { updatedAt: null } })
    }
    const res = await getCvPdf({ outDir })
    expect(res.version).toBe(0)
    expect(res.buffer.subarray(0, 5).toString()).toBe("%PDF-")
  })
})

describe("bioController.cvPdf", () => {
  test("sends the PDF with a one-hour public Cache-Control", async () => {
    seed(T1)
    jest.doMock("../src/services/cvPdfService", () => ({
      getCvPdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from("%PDF-1.3 fake"), fileName: "fullstack-en-1.pdf", version: 1, cached: true,
      }),
    }))
    jest.resetModules()
    const ctrl = require("../src/controllers/bioController")
    const { getCvPdf: mocked } = require("../src/services/cvPdfService")

    const headers = {}
    const res = {
      set: jest.fn((h) => Object.assign(headers, h)),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const next = jest.fn()
    ctrl.cvPdf({ query: { lang: "es", track: "support" } }, res, next)
    await new Promise((r) => setImmediate(r))

    expect(mocked).toHaveBeenCalledWith({ lang: "es", track: "support" })
    expect(next).not.toHaveBeenCalled()
    expect(headers["Cache-Control"]).toBe("public, max-age=3600")
    expect(headers["Content-Type"]).toBe("application/pdf")
    expect(headers["Content-Disposition"]).toMatch(/fullstack-en-1\.pdf/)
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer))
    jest.dontMock("../src/services/cvPdfService")
  })
})
