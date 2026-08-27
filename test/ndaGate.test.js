/**
 * Tier 4 · NDA click-wrap gate.
 *
 *   - ndaStatus: not required → accepted; required → looks up the agreement
 *     row for the project's effective version (default "1").
 *   - loadOwnedProject enforces the gate for every client write.
 *   - acceptAgreement validates type/version, upserts the row with ip + UA,
 *     and refuses projects that do not require an NDA.
 *   - GET /member/projects/:id returns nda + empty collections + ndaGate
 *     while the gate is up, the full payload once accepted.
 *   - updateAdminProject accepts requiresNda / ndaVersion.
 */
jest.mock("../src/lib/prisma", () => ({
  clientProject:    { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  projectAgreement: { findFirst: jest.fn(), upsert: jest.fn() },
  projectFile:      { findFirst: jest.fn() },
  activityLog:      { create: jest.fn().mockResolvedValue({}) },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/notificationService", () => ({
  notifyAdminsProjectActivity:   jest.fn().mockResolvedValue([]),
  notifyProjectComment:          jest.fn().mockResolvedValue(null),
  notifyMilestoneAwaitingClient: jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/services/supportService", () => ({}))
jest.mock("../src/config/storagePaths", () => ({ STORAGE_PATHS: { projectFiles: "/tmp/mu-projects" } }))

const prisma = require("../src/lib/prisma")
const svc    = require("../src/services/projectPortalService")
const { updateAdminProject } = require("../src/services/clientProjectService")
const ctrl   = require("../src/controllers/clientProjectController")

const base = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: "a1", requiresNda: false, ndaVersion: null, ...over,
})

/** asyncHandler swallows the promise, so wait for res.json or next(err). */
function run(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {}
    res.status = jest.fn(() => res)
    res.json = jest.fn(() => { resolve(res); return res })
    handler(req, res, (err) => reject(err || new Error("next() called")))
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.projectAgreement.upsert.mockImplementation(async ({ create }) => ({ ...create, acceptedAt: new Date("2026-08-26T10:00:00Z") }))
})

describe("ndaStatus", () => {
  test("not required → accepted=true without touching the DB", async () => {
    await expect(svc.ndaStatus(base(), "u1")).resolves.toEqual({ required: false, accepted: true, version: null, acceptedAt: null })
    expect(prisma.projectAgreement.findFirst).not.toHaveBeenCalled()
  })
  test("required with no row → accepted=false, default version 1", async () => {
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    await expect(svc.ndaStatus(base({ requiresNda: true }), "u1")).resolves.toMatchObject({ required: true, accepted: false, version: "1" })
    expect(prisma.projectAgreement.findFirst.mock.calls[0][0].where).toEqual({ projectId: "p1", userId: "u1", type: "nda", version: "1" })
  })
  test("required with a row for the current version → accepted", async () => {
    prisma.projectAgreement.findFirst.mockResolvedValue({ acceptedAt: new Date() })
    await expect(svc.ndaStatus(base({ requiresNda: true, ndaVersion: "2026-08" }), "u1")).resolves.toMatchObject({ required: true, accepted: true, version: "2026-08" })
  })
})

describe("loadOwnedProject gate", () => {
  test("throws 403 NDA_REQUIRED for client writes while unaccepted", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true }))
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    await expect(svc.loadOwnedProject({ userId: "u1", projectId: "p1" }))
      .rejects.toMatchObject({ code: "NDA_REQUIRED", statusCode: 403 })
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "hi" }))
      .rejects.toMatchObject({ code: "NDA_REQUIRED" })
  })
  test("passes once accepted and when not required", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true }))
    prisma.projectAgreement.findFirst.mockResolvedValue({ acceptedAt: new Date() })
    await expect(svc.loadOwnedProject({ userId: "u1", projectId: "p1" })).resolves.toMatchObject({ id: "p1" })
    prisma.clientProject.findFirst.mockResolvedValue(base())
    await expect(svc.loadOwnedProject({ userId: "u1", projectId: "p1" })).resolves.toMatchObject({ id: "p1" })
  })
})

describe("acceptAgreement", () => {
  test("records acceptance with ip + user-agent for the effective version", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true, ndaVersion: "v2" }))
    const out = await svc.acceptAgreement({ userId: "u1", projectId: "p1", type: "NDA", version: "v2", ipAddress: "1.2.3.4", userAgent: "jest" })
    expect(out).toMatchObject({ type: "nda", version: "v2" })
    const call = prisma.projectAgreement.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ projectId_userId_type_version: { projectId: "p1", userId: "u1", type: "nda", version: "v2" } })
    expect(call.create).toMatchObject({ ipAddress: "1.2.3.4", userAgent: "jest" })
    expect(prisma.activityLog.create.mock.calls[0][0].data.action).toBe("project.nda.accepted")
  })
  test("rejects unknown types, version mismatch, and projects without an NDA", async () => {
    await expect(svc.acceptAgreement({ userId: "u1", projectId: "p1", type: "sow" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true, ndaVersion: "v2" }))
    await expect(svc.acceptAgreement({ userId: "u1", projectId: "p1", type: "nda", version: "v1" }))
      .rejects.toMatchObject({ code: "NDA_VERSION_MISMATCH", statusCode: 409, details: { version: "v2" } })
    prisma.clientProject.findFirst.mockResolvedValue(base())
    await expect(svc.acceptAgreement({ userId: "u1", projectId: "p1", type: "nda" })).rejects.toMatchObject({ code: "INVALID_STATE" })
    expect(prisma.projectAgreement.upsert).not.toHaveBeenCalled()
  })
  test("does not consult the gate itself (skipNda) — an unaccepted client can accept", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true }))
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    await expect(svc.acceptAgreement({ userId: "u1", projectId: "p1", type: "nda" })).resolves.toMatchObject({ version: "1" })
  })
})

describe("GET /member/projects/:id", () => {
  const full = () => ({
    ...base({ requiresNda: true, ndaVersion: "1", previewUrl: "https://demo.example.com" }),
    milestones: [{ id: "m1" }], files: [{ id: "f1" }], comments: [{ id: "c1" }], tickets: [{ id: "t1" }],
  })
  test("gated: empty collections + ndaGate + nda descriptor", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(full())
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    const res = await run(ctrl.getMine, { user: { id: "u1" }, params: { id: "p1" } })
    expect(res.status).toHaveBeenCalledWith(200)
    const data = res.json.mock.calls[0][0].data
    expect(data).toMatchObject({ ndaGate: true, milestones: [], files: [], comments: [], tickets: [], previewUrl: null, previewCanFrame: false })
    expect(data.nda).toMatchObject({ required: true, accepted: false, version: "1" })
    expect(data.projectName).toBe("Site rebuild")
  })
  test("accepted: full payload", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(full())
    prisma.projectAgreement.findFirst.mockResolvedValue({ acceptedAt: new Date() })
    const res = await run(ctrl.getMine, { user: { id: "u1" }, params: { id: "p1" } })
    const data = res.json.mock.calls[0][0].data
    expect(data.ndaGate).toBeUndefined()
    expect(data.milestones).toHaveLength(1)
    expect(data.nda).toMatchObject({ required: true, accepted: true })
  })
  test("file download refuses with 403 NDA_REQUIRED while gated", async () => {
    prisma.projectFile.findFirst.mockResolvedValue({ id: "f1", projectId: "p1", filePath: "/files/projects/p1/x.pdf", project: { id: "p1", userId: "u1", requiresNda: true, ndaVersion: null } })
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    const res = await run(ctrl.streamFile, { user: { id: "u1" }, params: { id: "p1", fileId: "f1" } })
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json.mock.calls[0][0].error.code).toBe("NDA_REQUIRED")
  })
  test("POST /agreements returns 201 with the record", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(base({ requiresNda: true }))
    const res = await run(ctrl.acceptProjectAgreement, { user: { id: "u1" }, params: { id: "p1" }, body: { type: "nda" }, ip: "9.9.9.9", get: () => "UA" })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json.mock.calls[0][0].data).toMatchObject({ type: "nda", version: "1" })
    expect(prisma.projectAgreement.upsert.mock.calls[0][0].create).toMatchObject({ ipAddress: "9.9.9.9", userAgent: "UA" })
  })
})

describe("admin PATCH requiresNda / ndaVersion", () => {
  test("maps the toggles into the update patch", async () => {
    prisma.clientProject.update.mockResolvedValue({ id: "p1" })
    await updateAdminProject("p1", { requiresNda: "true", ndaVersion: " 2026-08 " })
    expect(prisma.clientProject.update.mock.calls[0][0].data).toEqual({ requiresNda: true, ndaVersion: "2026-08" })
    await updateAdminProject("p1", { requiresNda: false, ndaVersion: "" })
    expect(prisma.clientProject.update.mock.calls[1][0].data).toEqual({ requiresNda: false, ndaVersion: null })
    await expect(updateAdminProject("p1", { ndaVersion: "x".repeat(17) })).rejects.toThrow(/16 characters/)
  })
})
