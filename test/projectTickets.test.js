/**
 * Project-scoped support tickets (Tier 2):
 *   creation sets projectId + category, stores attachments as ProjectFile
 *   rows anchored to the first message, logs, and notifies admins; closed
 *   projects refuse writes (PROJECT_CLOSED); replies on a ticket that is not
 *   the user's (or not on that project) 404; listing is scoped to user AND
 *   project; admin replies carry attachments only on project tickets.
 */
jest.mock("../src/lib/prisma", () => ({
  clientProject:    { findFirst: jest.fn(), findUnique: jest.fn() },
  // T5-17 · loadOwnedProject falls back to a membership lookup when the
  // owner query misses, so the model has to be here. A real Prisma model
  // absent from the mock is a misconfiguration, not something to optional-
  // chain away.
  projectMember:    { findFirst: jest.fn(), update: jest.fn() },
  projectMilestone: { findFirst: jest.fn() },
  projectFile:      { create: jest.fn() },
  supportTicket:    { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  supportMessage:   { create: jest.fn() },
  activityLog:      { create: jest.fn().mockResolvedValue({}) },
  user:             { findUnique: jest.fn().mockResolvedValue({ email: "c@x.io", fullName: "Client" }) },
  $transaction:     jest.fn(async (ops) => Promise.all(ops)),
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/utils/mailer", () => ({
  sendSupportTicketEmail: jest.fn().mockResolvedValue(null),
  sendSupportReplyEmail:  jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/services/notificationService", () => ({
  notifySupportTicketCreated:    jest.fn().mockResolvedValue(null),
  notifySupportReply:            jest.fn().mockResolvedValue(null),
  notifyAdminsProjectActivity:   jest.fn().mockResolvedValue([]),
  notifyProjectComment:          jest.fn().mockResolvedValue(null),
  notifyMilestoneAwaitingClient: jest.fn().mockResolvedValue(null),
}))

const prisma = require("../src/lib/prisma")
const notif  = require("../src/services/notificationService")
const svc    = require("../src/services/supportService")

const project = (over = {}) => ({
  id: "p1", userId: "u1", projectName: "Site rebuild", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: "a1", ...over,
})
const files = [
  { originalname: "bug.png",  filename: "1-bug.png",  mimetype: "image/png",       size: 10 },
  { originalname: "spec.pdf", filename: "2-spec.pdf", mimetype: "application/pdf", size: 20 },
]

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findFirst.mockResolvedValue(project())
  prisma.supportTicket.create.mockImplementation(async ({ data }) => ({
    id: "t1", ...data, messages: [{ id: "m1", message: data.message, senderRole: "member", attachments: [] }], _count: { messages: 1 },
  }))
  prisma.supportMessage.create.mockImplementation(async ({ data }) => ({ id: "m2", ...data }))
  prisma.projectFile.create.mockImplementation(async ({ data }) => ({ id: "f_" + data.fileName, ...data }))
})

describe("createProjectTicket", () => {
  test("sets projectId + category, stores attachments on the first message, logs and notifies admins", async () => {
    const ticket = await svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Broken hero", message: "The hero image is missing on mobile.", priority: "high", files })

    expect(prisma.clientProject.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", userId: "u1" } }))
    expect(prisma.supportTicket.create.mock.calls[0][0].data).toMatchObject({
      userId: "u1", projectId: "p1", category: svc.PROJECT_TICKET_CATEGORY, priority: "high", status: "open", subject: "Broken hero",
      messages: { create: { senderId: "u1", senderRole: "member" } },
    })
    expect(prisma.projectFile.create).toHaveBeenCalledTimes(2)
    expect(prisma.projectFile.create.mock.calls[0][0].data).toMatchObject({
      projectId: "p1", uploadedById: "u1", uploadedByRole: "client", supportMessageId: "m1",
      fileName: "bug.png", filePath: "/files/projects/p1/1-bug.png", fileType: "image/png", fileSize: 10,
    })
    expect(ticket.messages[0].attachments).toHaveLength(2)
    expect(prisma.activityLog.create.mock.calls[0][0].data).toMatchObject({ action: "project.ticket.opened", entityId: "t1" })
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "ticket", project: expect.objectContaining({ id: "p1" }) }))
  })

  test("invalid priority falls back to medium; no files → no ProjectFile rows", async () => {
    await svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Question", message: "Where is the staging link?", priority: "urgent" })
    expect(prisma.supportTicket.create.mock.calls[0][0].data.priority).toBe("medium")
    expect(prisma.projectFile.create).not.toHaveBeenCalled()
  })

  test("milestone must belong to the project; its title is folded into the subject", async () => {
    prisma.projectMilestone.findFirst.mockResolvedValueOnce(null)
    await expect(svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Question", message: "Where is the staging link?", milestoneId: "m9" }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
    prisma.projectMilestone.findFirst.mockResolvedValueOnce({ id: "ms1", title: "Design" })
    await svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Question", message: "Where is the staging link?", milestoneId: "ms1" })
    expect(prisma.projectMilestone.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "ms1", projectId: "p1" } }))
    expect(prisma.supportTicket.create.mock.calls[0][0].data.subject).toBe("[Design] Question")
  })

  test("validation: short subject / short message", async () => {
    await expect(svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Hi", message: "Long enough message here." }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
    await expect(svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Subject", message: "short" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 })
    expect(prisma.supportTicket.create).not.toHaveBeenCalled()
  })

  test("closed project → PROJECT_CLOSED (409), nothing written", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(project({ projectStatus: "completed", closedAt: new Date() }))
    await expect(svc.createProjectTicket({ userId: "u1", projectId: "p1", subject: "Subject", message: "Long enough message here.", files }))
      .rejects.toMatchObject({ code: "PROJECT_CLOSED", statusCode: 409 })
    expect(prisma.supportTicket.create).not.toHaveBeenCalled()
    expect(prisma.projectFile.create).not.toHaveBeenCalled()
  })

  test("project not owned → 404", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    await expect(svc.createProjectTicket({ userId: "u2", projectId: "p1", subject: "Subject", message: "Long enough message here." }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
  })
})

describe("createProjectTicketMessage", () => {
  test("foreign ticket (not owned / other project) → 404, no message written", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null)
    await expect(svc.createProjectTicketMessage({ userId: "u1", projectId: "p1", ticketId: "t-other", message: "hello" }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t-other", userId: "u1", projectId: "p1" } }))
    expect(prisma.supportMessage.create).not.toHaveBeenCalled()
  })

  test("owned ticket: member message + attachments, resolved ticket reopens, admins notified", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: "t1", ticketNumber: "TKT-1", status: "resolved" })
    const msg = await svc.createProjectTicketMessage({ userId: "u1", projectId: "p1", ticketId: "t1", message: "Still broken", files: [files[0]] })
    expect(prisma.supportMessage.create.mock.calls[0][0].data).toMatchObject({ ticketId: "t1", senderId: "u1", senderRole: "member", message: "Still broken" })
    expect(prisma.projectFile.create.mock.calls[0][0].data).toMatchObject({ supportMessageId: "m2", uploadedByRole: "client", projectId: "p1" })
    expect(msg.attachments).toHaveLength(1)
    expect(prisma.supportTicket.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1", status: "resolved" }, data: { status: "open", resolvedAt: null } }))
    expect(notif.notifyAdminsProjectActivity).toHaveBeenCalledWith(expect.objectContaining({ kind: "ticket" }))
  })

  test("closed project → PROJECT_CLOSED before the ticket is even looked up", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(project({ closedAt: new Date() }))
    await expect(svc.createProjectTicketMessage({ userId: "u1", projectId: "p1", ticketId: "t1", message: "hi" }))
      .rejects.toMatchObject({ code: "PROJECT_CLOSED" })
    expect(prisma.supportTicket.findFirst).not.toHaveBeenCalled()
  })
})

describe("listProjectTicketsForUser / getProjectTicketForUser", () => {
  test("listing is scoped to user + project, newest first, bounded, with message counts", async () => {
    prisma.supportTicket.findMany.mockResolvedValue([{ id: "t1" }])
    const rows = await svc.listProjectTicketsForUser({ userId: "u1", projectId: "p1" })
    expect(rows).toEqual([{ id: "t1" }])
    const args = prisma.supportTicket.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: "u1", projectId: "p1" })
    expect(args.orderBy).toEqual({ createdAt: "desc" })
    expect(args.take).toBeLessThanOrEqual(200)
    expect(args.include._count.select.messages).toBe(true)
  })

  test("listing on a project the user does not own → 404", async () => {
    prisma.clientProject.findFirst.mockResolvedValue(null)
    await expect(svc.listProjectTicketsForUser({ userId: "u9", projectId: "p1" })).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(prisma.supportTicket.findMany).not.toHaveBeenCalled()
  })

  test("thread includes message attachments", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: "t1", messages: [] })
    await svc.getProjectTicketForUser({ userId: "u1", projectId: "p1", ticketId: "t1" })
    const args = prisma.supportTicket.findFirst.mock.calls[0][0]
    expect(args.where).toEqual({ id: "t1", userId: "u1", projectId: "p1" })
    expect(args.include.messages.include.attachments).toBeDefined()
  })
})

describe("addAdminMessage with attachments", () => {
  test("stores attachments with role=admin on a project ticket (project pairing verified)", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: "t1", projectId: "p1" })
    prisma.supportTicket.findUnique = jest.fn().mockResolvedValue({ ticketNumber: "TKT-1", subject: "S", userId: "u1" })
    const msg = await svc.addAdminMessage({ ticketId: "t1", projectId: "p1", adminId: "a1", message: "Fixed, see file", files: [files[1]] })
    expect(prisma.supportTicket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1", projectId: "p1" } }))
    expect(prisma.projectFile.create.mock.calls[0][0].data).toMatchObject({ projectId: "p1", uploadedById: "a1", uploadedByRole: "admin", supportMessageId: "m2" })
    expect(msg.attachments).toHaveLength(1)
  })

  test("attachments on a non-project ticket are refused", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue({ id: "t1", projectId: null })
    await expect(svc.addAdminMessage({ ticketId: "t1", adminId: "a1", message: "x", files: [files[0]] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(prisma.supportMessage.create).not.toHaveBeenCalled()
  })

  test("ticket not on that project → 404", async () => {
    prisma.supportTicket.findFirst.mockResolvedValue(null)
    await expect(svc.addAdminMessage({ ticketId: "t1", projectId: "p2", adminId: "a1", message: "x" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})
