/**
 * Tier 4 · projectPurgeJob — closed projects older than PROJECT_PURGE_DAYS
 * lose their file bytes (resolveSafePath + unlink), rows get purgedAt,
 * metadata stays. ENOENT counts as purged; other unlink errors leave the
 * row and the project un-stamped for the next pass.
 */
jest.mock("fs/promises", () => ({ unlink: jest.fn() }))
jest.mock("../src/lib/prisma", () => ({
  clientProject: { findMany: jest.fn(), update: jest.fn() },
  projectFile:   { findMany: jest.fn(), update: jest.fn() },
  // T5-7 · the sweep now closes any document request still open on a purged
  // project. Added to the mock rather than optional-chained in the job: a
  // real Prisma model that is absent is a misconfiguration, and hiding it
  // behind ?. turns a loud failure into a silent no-op.
  projectFileRequest: { updateMany: jest.fn() },
  // T5-13 · same argument: the sweep wipes every remaining credential
  // ciphertext on a purged project, so the model has to be here.
  secretHandoff: { updateMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/controllers/clientProjectController", () => ({
  resolveSafePath: jest.fn((p) => (p && p.includes("..") ? null : `/storage/projects/${String(p).replace(/^\/files\/projects\//, "")}`)),
}))

const fsp = require("fs/promises")
const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const { runProjectPurgePass, purgeDays, DEFAULT_PURGE_DAYS } = require("../src/jobs/projectPurgeJob")

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-08-26T04:00:00Z")

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.PROJECT_PURGE_DAYS
  fsp.unlink.mockResolvedValue()
  prisma.clientProject.update.mockResolvedValue({})
  prisma.projectFile.update.mockResolvedValue({})
  prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 0 })
  prisma.secretHandoff.updateMany.mockResolvedValue({ count: 0 })
})

test("a purged project has every remaining credential ciphertext wiped (T5-13)", async () => {
  // A secret is already unreadable once it expires, but "the check keeps
  // refusing" is a weaker guarantee than "the bytes are gone".
  prisma.clientProject.findMany.mockResolvedValue([{ id: "p1", projectName: "P", closedAt: new Date(0) }])
  prisma.projectFile.findMany.mockResolvedValue([])
  prisma.secretHandoff.updateMany.mockResolvedValue({ count: 3 })

  const out = await runProjectPurgePass({ now: NOW })

  expect(prisma.secretHandoff.updateMany.mock.calls[0][0]).toEqual({
    where: { projectId: "p1", ciphertext: { not: null } },
    data:  { ciphertext: null, iv: null, tag: null },
  })
  expect(out.results[0].secretsWiped).toBe(3)
})

test("a purged project stops chasing the client for paperwork (T5-7)", async () => {
  // The bytes are gone and the project is closed; a request still reading
  // "requested" would keep the reminder job nagging for a file that has
  // nowhere left to land, and would let an admin reject it back open.
  prisma.clientProject.findMany.mockResolvedValue([{ id: "p1", projectName: "P", closedAt: new Date(0) }])
  prisma.projectFile.findMany.mockResolvedValue([])
  prisma.projectFileRequest.updateMany.mockResolvedValue({ count: 2 })

  const out = await runProjectPurgePass({ now: NOW })

  const call = prisma.projectFileRequest.updateMany.mock.calls[0][0]
  expect(call.where).toEqual({ projectId: "p1", status: { in: ["requested", "rejected", "submitted"] } })
  expect(call.data).toEqual({ status: "cancelled", closedAt: NOW })
  // An ACCEPTED request keeps its status: overwriting it would erase the
  // record that the document ever arrived.
  expect(call.where.status.in).not.toContain("accepted")
  expect(out.results[0].requestsClosed).toBe(2)
})

test("purgeDays defaults to 60 and honours PROJECT_PURGE_DAYS", () => {
  expect(purgeDays()).toBe(DEFAULT_PURGE_DAYS)
  expect(DEFAULT_PURGE_DAYS).toBe(60)
  process.env.PROJECT_PURGE_DAYS = "7"
  expect(purgeDays()).toBe(7)
  process.env.PROJECT_PURGE_DAYS = "nope"
  expect(purgeDays()).toBe(60)
})

test("selects only closed, un-purged projects past the cutoff", async () => {
  prisma.clientProject.findMany.mockResolvedValue([])
  const out = await runProjectPurgePass({ now: NOW })
  const where = prisma.clientProject.findMany.mock.calls[0][0].where
  expect(where.purgedAt).toBeNull()
  expect(where.closedAt.not).toBeNull()
  expect(where.closedAt.lt.getTime()).toBe(NOW.getTime() - 60 * DAY)
  expect(out).toMatchObject({ scanned: 0, projects: 0, files: 0, failed: 0 })
})

test("unlinks each file through resolveSafePath, stamps rows then the project; keeps metadata", async () => {
  prisma.clientProject.findMany.mockResolvedValue([{ id: "p1", projectName: "Old", closedAt: new Date(NOW.getTime() - 90 * DAY) }])
  prisma.projectFile.findMany.mockResolvedValue([
    { id: "f1", filePath: "/files/projects/p1/a.pdf" },
    { id: "f2", filePath: "/files/projects/p1/b.zip" },
  ])
  const out = await runProjectPurgePass({ now: NOW })

  expect(prisma.projectFile.findMany.mock.calls[0][0].where).toEqual({ projectId: "p1", purgedAt: null })
  expect(fsp.unlink.mock.calls.map((c) => c[0])).toEqual(["/storage/projects/p1/a.pdf", "/storage/projects/p1/b.zip"])
  expect(prisma.projectFile.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { purgedAt: NOW } })
  expect(prisma.projectFile.update).toHaveBeenCalledWith({ where: { id: "f2" }, data: { purgedAt: NOW } })
  expect(prisma.clientProject.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { purgedAt: NOW } })
  // No deletes anywhere — rows are kept.
  expect(prisma.projectFile.delete).toBeUndefined()
  expect(out).toMatchObject({ scanned: 1, projects: 1, files: 2, failed: 0 })
})

test("ENOENT counts as purged; unsafe paths are skipped but stamped; other errors retry next pass", async () => {
  prisma.clientProject.findMany.mockResolvedValue([{ id: "p1", projectName: "Old", closedAt: new Date(NOW.getTime() - 90 * DAY) }])
  prisma.projectFile.findMany.mockResolvedValue([
    { id: "gone",   filePath: "/files/projects/p1/gone.pdf" },
    { id: "evil",   filePath: "/files/projects/../../etc/passwd" },
    { id: "locked", filePath: "/files/projects/p1/locked.pdf" },
  ])
  fsp.unlink.mockImplementation(async (abs) => {
    if (abs.endsWith("gone.pdf")) { const e = new Error("missing"); e.code = "ENOENT"; throw e }
    if (abs.endsWith("locked.pdf")) { const e = new Error("busy"); e.code = "EBUSY"; throw e }
  })
  const out = await runProjectPurgePass({ now: NOW })

  expect(fsp.unlink).toHaveBeenCalledTimes(2) // the unsafe path never reaches unlink
  expect(prisma.projectFile.update).toHaveBeenCalledWith({ where: { id: "gone" }, data: { purgedAt: NOW } })
  expect(prisma.projectFile.update).toHaveBeenCalledWith({ where: { id: "evil" }, data: { purgedAt: NOW } })
  expect(prisma.projectFile.update).not.toHaveBeenCalledWith({ where: { id: "locked" }, data: expect.anything() })
  expect(prisma.clientProject.update).not.toHaveBeenCalled()
  expect(logger.warn).toHaveBeenCalled()
  expect(out).toMatchObject({ scanned: 1, projects: 0, files: 2, failed: 1 })
})

test("dryRun lists candidates without touching disk or DB", async () => {
  prisma.clientProject.findMany.mockResolvedValue([{ id: "p1", projectName: "Old", closedAt: new Date(NOW.getTime() - 90 * DAY) }])
  prisma.projectFile.findMany.mockResolvedValue([{ id: "f1", filePath: "/files/projects/p1/a.pdf" }])
  const out = await runProjectPurgePass({ now: NOW, dryRun: true })
  expect(fsp.unlink).not.toHaveBeenCalled()
  expect(prisma.projectFile.update).not.toHaveBeenCalled()
  expect(prisma.clientProject.update).not.toHaveBeenCalled()
  // Including the T5-7 request close: a dry run that quietly cancelled a
  // client's outstanding paperwork would be a nasty surprise.
  expect(prisma.projectFileRequest.updateMany).not.toHaveBeenCalled()
  expect(out.results[0]).toMatchObject({ projectId: "p1", files: 1, purged: 0 })
})

test("one failing project does not stop the sweep", async () => {
  prisma.clientProject.findMany.mockResolvedValue([
    { id: "bad", projectName: "Bad", closedAt: new Date(0) },
    { id: "ok",  projectName: "Ok",  closedAt: new Date(0) },
  ])
  prisma.projectFile.findMany.mockImplementation(async ({ where }) => {
    if (where.projectId === "bad") throw new Error("db hiccup")
    return [{ id: "f1", filePath: "/files/projects/ok/a.pdf" }]
  })
  const out = await runProjectPurgePass({ now: NOW })
  expect(out).toMatchObject({ scanned: 2, projects: 1, files: 1, failed: 1 })
  expect(prisma.clientProject.update).toHaveBeenCalledWith({ where: { id: "ok" }, data: { purgedAt: NOW } })
  expect(logger.error).toHaveBeenCalled()
})
