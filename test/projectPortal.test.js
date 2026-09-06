/**
 * projectPortalService — Tier 2 client-portal rules:
 *   lifecycle (closed → read-only, expired → 410), client uploads carry the
 *   role and notify admins, comments validate anchors and notify the other
 *   side, one-click approvals only from awaiting_client, request-changes
 *   requires a note and reopens the milestone, previewUrl validation +
 *   frame allow-list.
 */
jest.mock("../src/lib/prisma", () => ({
  clientProject:    { findFirst: jest.fn(), findUnique: jest.fn() },
  // T5-17 · loadOwnedProject falls back to a membership lookup when the
  // owner query misses, so the model has to be here. A real Prisma model
  // absent from the mock is a misconfiguration, not something to optional-
  // chain away.
  projectMember:    { findFirst: jest.fn(), update: jest.fn() },
  projectMilestone: { findFirst: jest.fn(), update: jest.fn() },
  projectFile:      { findFirst: jest.fn(), create: jest.fn() },
  projectComment:   { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  activityLog:      { create: jest.fn().mockResolvedValue({}) },
  $transaction:     jest.fn(async (ops) => Promise.all(ops)),
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/notificationService", () => ({
  notifyAdminsProjectActivity:   jest.fn().mockResolvedValue([]),
  notifyProjectComment:          jest.fn().mockResolvedValue(null),
  notifyMilestoneAwaitingClient: jest.fn().mockResolvedValue(null),
}))

const prisma = require("../src/lib/prisma")
const notif  = require("../src/services/notificationService")
const svc    = require("../src/services/projectPortalService")

const DAY = 24 * 60 * 60 * 1000
const project = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: "a1", ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findFirst.mockResolvedValue(project())
  prisma.projectFile.create.mockImplementation(async ({ data }) => ({ id: "f_" + data.fileName, ...data }))
  prisma.projectComment.create.mockImplementation(async ({ data }) => ({ id: "c1", ...data, author: { id: data.authorId } }))
  prisma.projectMilestone.update.mockImplementation(async ({ data }) => ({ id: "m1", ...data }))
  prisma.projectComment.update.mockImplementation(async ({ data }) => ({ id: "c1", ...data }))
  delete process.env.PROJECT_ACCESS_GRACE_DAYS
  delete process.env.PREVIEW_FRAME_HOSTS
})

describe("lifecycle", () => {
  test("open project: readable and writable", () => {
    expect(svc.lifecycle(project())).toMatchObject({ isClosed: false, isExpired: false, readOnly: false, expiresAt: null })
  })
  test("closed project: read-only until the grace period ends, then expired", () => {
    const closedAt = new Date(Date.now() - 10 * DAY)
    const lc = svc.lifecycle(project({ projectStatus: "completed", closedAt }))
    expect(lc).toMatchObject({ isClosed: true, readOnly: true, isExpired: false })
    expect(lc.expiresAt.getTime()).toBe(closedAt.getTime() + 30 * DAY)
    expect(svc.lifecycle(project({ projectStatus: "completed", closedAt: new Date(Date.now() - 31 * DAY) })).isExpired).toBe(true)
  })
  test("legacy closed rows without closedAt fall back to updatedAt", () => {
    expect(svc.lifecycle(project({ projectStatus: "cancelled", updatedAt: new Date(Date.now() - 40 * DAY) })).isExpired).toBe(true)
  })
  test("PROJECT_ACCESS_GRACE_DAYS overrides the window", () => {
    process.env.PROJECT_ACCESS_GRACE_DAYS = "0"
    expect(svc.lifecycle(project({ closedAt: new Date(Date.now() - 1000) })).isExpired).toBe(true)
  })
  test("assertReadable throws 410 on expired, assertWritable throws 409 on closed", () => {
    expect(() => svc.assertReadable(project({ closedAt: new Date(Date.now() - 31 * DAY) }))).toThrow(expect.objectContaining({ code: "PROJECT_EXPIRED", statusCode: 410 }))
    expect(() => svc.assertWritable(project({ closedAt: new Date() }))).toThrow(expect.objectContaining({ code: "PROJECT_CLOSED", statusCode: 409 }))
    expect(() => svc.assertWritable(project())).not.toThrow()
  })
})

describe("attachClientFiles", () => {
  const files = [
    { originalname: "brief.pdf", filename: "1-brief.pdf", mimetype: "application/pdf", size: 1234 },
    { originalname: "logo.png",  filename: "2-logo.png",  mimetype: "image/png",       size: 99 },
  ]
  test("creates one ProjectFile per upload with role=client, logs and notifies admins", async () => {
    const rows = await svc.attachClientFiles({ userId: "u1", projectId: "p1", files })
    expect(rows).toHaveLength(2)
    expect(prisma.projectFile.create.mock.calls[0][0].data).toMatchObject({
      projectId: "p1", uploadedById: "u1", uploadedByRole: "client", fileName: "brief.pdf",
      filePath: "/files/projects/p1/1-brief.pdf", fileType: "application/pdf", fileSize: 1234, milestoneId: null,
    })
    expect(prisma.activityLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "project.file.uploaded" }) }))
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "upload" }))
  })
  test("rejects when the project is not owned, closed, or the milestone is foreign", async () => {
    prisma.clientProject.findFirst.mockResolvedValueOnce(null)
    await expect(svc.attachClientFiles({ userId: "u2", projectId: "p1", files })).rejects.toMatchObject({ code: "NOT_FOUND" })
    prisma.clientProject.findFirst.mockResolvedValueOnce(project({ closedAt: new Date() }))
    await expect(svc.attachClientFiles({ userId: "u1", projectId: "p1", files })).rejects.toMatchObject({ code: "PROJECT_CLOSED" })
    prisma.projectMilestone.findFirst.mockResolvedValueOnce(null)
    await expect(svc.attachClientFiles({ userId: "u1", projectId: "p1", files, milestoneId: "mX" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(prisma.projectFile.create).not.toHaveBeenCalled()
  })
  test("empty upload is a 400", async () => {
    await expect(svc.attachClientFiles({ userId: "u1", projectId: "p1", files: [] })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
  })
})

describe("comments", () => {
  test("client comment notifies admins; admin comment notifies the client", async () => {
    await svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "Looks great" })
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "comment", summary: "Looks great" }))
    expect(notif.notifyProjectComment).not.toHaveBeenCalled()

    prisma.clientProject.findUnique.mockResolvedValueOnce(project())
    await svc.createComment({ projectId: "p1", authorId: "a1", authorRole: "admin", body: "Thanks!" })
    expect(notif.notifyProjectComment).toHaveBeenCalledWith("u1", expect.objectContaining({ comment: expect.objectContaining({ body: "Thanks!" }) }))
  })
  test("validates body, role and anchors", async () => {
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "   " })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "bot", body: "x" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    prisma.projectMilestone.findFirst.mockResolvedValueOnce(null)
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "x", milestoneId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    prisma.projectFile.findFirst.mockResolvedValueOnce(null)
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "x", fileId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
  test("client cannot comment on a closed project", async () => {
    prisma.clientProject.findFirst.mockResolvedValueOnce(project({ closedAt: new Date() }))
    await expect(svc.createComment({ projectId: "p1", authorId: "u1", authorRole: "client", body: "late" })).rejects.toMatchObject({ code: "PROJECT_CLOSED" })
  })
  test("resolveComment toggles resolvedAt", async () => {
    prisma.projectComment.findUnique.mockResolvedValueOnce({ id: "c1", resolvedAt: null })
    await svc.resolveComment({ commentId: "c1", adminId: "a1" })
    expect(prisma.projectComment.update.mock.calls[0][0].data.resolvedAt).toBeInstanceOf(Date)
    prisma.projectComment.findUnique.mockResolvedValueOnce({ id: "c1", resolvedAt: new Date() })
    await svc.resolveComment({ commentId: "c1", adminId: "a1" })
    expect(prisma.projectComment.update.mock.calls[1][0].data.resolvedAt).toBeNull()
  })
})

describe("approvals", () => {
  test("approve only from awaiting_client; stamps approvedAt/By and notifies admins", async () => {
    prisma.projectMilestone.findFirst.mockResolvedValueOnce({ id: "m1", title: "Design", status: "awaiting_client" })
    const ms = await svc.approveMilestone({ userId: "u1", projectId: "p1", milestoneId: "m1", note: "ship it" })
    expect(ms).toMatchObject({ status: "approved", approvedById: "u1", clientNote: "ship it" })
    expect(ms.approvedAt).toBeInstanceOf(Date)
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "approval" }))

    prisma.projectMilestone.findFirst.mockResolvedValueOnce({ id: "m1", title: "Design", status: "in_progress" })
    await expect(svc.approveMilestone({ userId: "u1", projectId: "p1", milestoneId: "m1" })).rejects.toMatchObject({ code: "INVALID_STATE", statusCode: 409 })
  })
  test("request changes needs a note, reopens the milestone and threads the note as a comment", async () => {
    // Note validation runs before any DB read — no milestone mock queued here.
    await expect(svc.requestMilestoneChanges({ userId: "u1", projectId: "p1", milestoneId: "m1", note: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

    prisma.projectMilestone.findFirst.mockResolvedValueOnce({ id: "m1", title: "Design", status: "approved" })
    const ms = await svc.requestMilestoneChanges({ userId: "u1", projectId: "p1", milestoneId: "m1", note: "Logo is off-brand" })
    expect(ms).toMatchObject({ status: "in_progress", approvedAt: null, approvedById: null, clientNote: "Logo is off-brand" })
    expect(ms.changesRequestedAt).toBeInstanceOf(Date)
    expect(prisma.projectComment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ milestoneId: "m1", authorRole: "client", body: "Logo is off-brand" }) }))
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "changes" }))
  })
  test("cannot request changes on undelivered work", async () => {
    prisma.projectMilestone.findFirst.mockResolvedValueOnce({ id: "m1", status: "pending" })
    await expect(svc.requestMilestoneChanges({ userId: "u1", projectId: "p1", milestoneId: "m1", note: "x" })).rejects.toMatchObject({ code: "INVALID_STATE" })
  })
})

describe("previewUrl", () => {
  test("validatePreviewUrl accepts http(s), rejects the rest, clears on empty", () => {
    expect(svc.validatePreviewUrl("https://staging.example.com/app")).toBe("https://staging.example.com/app")
    expect(svc.validatePreviewUrl("")).toBeNull()
    expect(() => svc.validatePreviewUrl("javascript:alert(1)")).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }))
    expect(() => svc.validatePreviewUrl("not a url")).toThrow()
  })
  test("previewCanFrame honours exact and wildcard hosts from PREVIEW_FRAME_HOSTS", () => {
    process.env.PREVIEW_FRAME_HOSTS = "https://*.vercel.app, https://staging.mustaphaukizuru.com"
    expect(svc.previewCanFrame("https://my-app.vercel.app/x")).toBe(true)
    expect(svc.previewCanFrame("https://staging.mustaphaukizuru.com")).toBe(true)
    expect(svc.previewCanFrame("http://staging.mustaphaukizuru.com")).toBe(false)
    expect(svc.previewCanFrame("https://evil.com")).toBe(false)
    expect(svc.previewCanFrame(null)).toBe(false)
    delete process.env.PREVIEW_FRAME_HOSTS
    expect(svc.previewCanFrame("https://my-app.vercel.app/x")).toBe(false)
  })
})
