// ─────────────────────────────────────────────────────────────────────────────
// T5-17 · a second person on the client's side.
//
// This change rewires the check that every member read and write in the
// system depends on. `loadOwnedProject` used to be one query — id AND
// userId — and it is now "the owner, OR somebody invited to it". Widening
// that is exactly how an IDOR gets written, so the ownership cases come
// first and there are more of them than of anything else here.
//
// Three properties, and everything below is one of them:
//
//   STILL SHUT    a stranger is refused exactly as before, and the refusal
//                 is the same 404 that "no such project" gives.
//   OPEN ENOUGH   an invited member reaches the project.
//   NOT TOO OPEN  a viewer cannot approve, accept, decline or pay — the
//                 three things that commit the client to something.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findFirst: jest.fn(), findUnique: jest.fn() },
  projectMember: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  projectAgreement: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const portal = require("../src/services/projectPortalService")
const members = require("../src/services/projectMemberService")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const PROJECT = {
  id: "p1", userId: "owner1", projectName: "Colegio Vista", projectStatus: "in_progress",
  closedAt: null, updatedAt: new Date(), assignedAdminId: null,
  requiresNda: false, ndaVersion: null, accessState: "active", trackingCode: "MU-7K4C-9XQF",
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findFirst.mockResolvedValue(null)
  prisma.clientProject.findUnique.mockResolvedValue(PROJECT)
  prisma.projectMember.findFirst.mockResolvedValue(null)
  prisma.projectMember.findMany.mockResolvedValue([])
  prisma.projectMember.count.mockResolvedValue(0)
  prisma.projectMember.update.mockResolvedValue({})
  prisma.user.findUnique.mockResolvedValue(null)
})

/* ══════════════════════════════════════════════════════════════════════════
   1 · the gate is still shut
   ══════════════════════════════════════════════════════════════════════════ */

describe("a stranger is refused exactly as before", () => {
  test("neither owner nor member → 404", async () => {
    await expect(portal.loadOwnedProject({ userId: "nobody", projectId: "p1" }))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 })
  })

  test("the refusal is the same one a missing project gives", async () => {
    // A distinguishable 403 would confirm the project id exists.
    const a = await portal.loadOwnedProject({ userId: "nobody", projectId: "p1" }).catch((e) => `${e.statusCode}:${e.message}`)
    prisma.clientProject.findUnique.mockResolvedValue(null)
    const b = await portal.loadOwnedProject({ userId: "nobody", projectId: "nope" }).catch((e) => `${e.statusCode}:${e.message}`)
    expect(a).toBe(b)
  })

  test("a membership on ANOTHER project does not open this one", async () => {
    // The lookup is scoped by projectId as well as userId. Without that,
    // one invitation anywhere would be an invitation everywhere.
    await portal.loadOwnedProject({ userId: "u2", projectId: "p1" }).catch(() => null)
    expect(prisma.projectMember.findFirst.mock.calls[0][0].where)
      .toEqual({ projectId: "p1", userId: "u2" })
  })

  test("the owner path is unchanged and costs no extra query", async () => {
    // The ordinary case must pay nothing for the fallback existing.
    prisma.clientProject.findFirst.mockResolvedValue(PROJECT)
    const project = await portal.loadOwnedProject({ userId: "owner1", projectId: "p1" })
    expect(project.memberRole).toBe("owner")
    expect(prisma.projectMember.findFirst).not.toHaveBeenCalled()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · open enough
   ══════════════════════════════════════════════════════════════════════════ */

describe("an invited member gets in", () => {
  const asMember = (role) => prisma.projectMember.findFirst.mockResolvedValue({ id: "m1", role, acceptedAt: null })

  test("a viewer reaches the project, carrying their role", async () => {
    asMember("viewer")
    const project = await portal.loadOwnedProject({ userId: "u2", projectId: "p1" })
    expect(project).toMatchObject({ id: "p1", memberRole: "viewer" })
  })

  test("an approver too", async () => {
    asMember("approver")
    expect((await portal.loadOwnedProject({ userId: "u2", projectId: "p1" })).memberRole).toBe("approver")
  })

  test("a role this build does not recognise degrades to viewer, never to owner", async () => {
    // A row written by a newer deploy must not arrive with the authority to
    // approve on a server running last week's code.
    asMember("superuser")
    expect((await portal.loadOwnedProject({ userId: "u2", projectId: "p1" })).memberRole).toBe("viewer")
  })

  test("first arrival is stamped, so an operator can tell the invitation worked", async () => {
    asMember("viewer")
    await portal.loadOwnedProject({ userId: "u2", projectId: "p1" })
    expect(prisma.projectMember.update).toHaveBeenCalledWith({
      where: { id: "m1" }, data: { acceptedAt: expect.any(Date) },
    })
  })

  test("and not re-stamped afterwards", async () => {
    prisma.projectMember.findFirst.mockResolvedValue({ id: "m1", role: "viewer", acceptedAt: new Date("2026-01-01") })
    await portal.loadOwnedProject({ userId: "u2", projectId: "p1" })
    expect(prisma.projectMember.update).not.toHaveBeenCalled()
  })

  test("the NDA gate applies to a member too, and per member", async () => {
    // An NDA accepted by the director says nothing about the IT person now
    // reading the files.
    asMember("viewer")
    prisma.clientProject.findUnique.mockResolvedValue({ ...PROJECT, requiresNda: true, ndaVersion: "v1" })
    prisma.projectAgreement.findFirst.mockResolvedValue(null)
    await expect(portal.loadOwnedProject({ userId: "u2", projectId: "p1" })).rejects.toBeTruthy()
    expect(prisma.projectAgreement.findFirst.mock.calls[0][0].where).toMatchObject({ userId: "u2" })
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   3 · not too open
   ══════════════════════════════════════════════════════════════════════════ */

describe("what a viewer may not do", () => {
  test("assertCanApprove refuses a viewer with 403 and names who can", async () => {
    expect(() => portal.assertCanApprove({ memberRole: "viewer" }, "approve work on it"))
      .toThrow(/cannot approve work on it/)
    try {
      portal.assertCanApprove({ memberRole: "viewer" })
    } catch (e) {
      expect(e).toMatchObject({ code: "MEMBER_ROLE_FORBIDDEN", statusCode: 403 })
      // A refusal that does not say who CAN is a dead end.
      expect(e.message).toMatch(/approver/)
    }
  })

  test("an owner and an approver both pass", () => {
    for (const memberRole of ["owner", "approver"]) {
      expect(portal.assertCanApprove({ memberRole })).toBe(memberRole)
    }
  })

  test("a project with no role at all is treated as the owner's", () => {
    // Every existing caller that never knew about members keeps working.
    expect(portal.assertCanApprove({})).toBe("owner")
  })

  test("the three privileged actions all call it, and nothing else does", () => {
    // The gate is visible at each call site on purpose: "which actions are
    // privileged" is a product decision, and burying it in the loader makes
    // it invisible the next time somebody adds one.
    const portalSvc = read("src", "services", "projectPortalService.js")
    const changeReq = read("src", "services", "changeRequestService.js")
    const portalCtl = read("src", "controllers", "portalController.js")

    expect(portalSvc).toContain('assertCanApprove(project, "approve work on it")')
    expect(portalSvc).toContain('assertCanApprove(project, "send work back for changes")')
    expect(changeReq).toContain('assertCanApprove(owned, "accept a quote")')
    expect(changeReq).toContain('assertCanApprove(project, "decline a quote")')
    // Paying, on the one surface where a non-owner can reach an invoice.
    expect(portalCtl).toContain("APPROVING_ROLES.includes(req.portal.role")
  })

  test("uploading, commenting and ticketing are NOT gated, deliberately", () => {
    // The IT person's whole job is to send us files. A role that could not
    // type would be useless to them, which is why "viewer" is not named
    // read-only.
    const portalSvc = read("src", "services", "projectPortalService.js")
    const attach = portalSvc.slice(portalSvc.indexOf("async function attachClientFiles"))
    expect(attach.slice(0, 800)).not.toContain("assertCanApprove")
    const comment = portalSvc.slice(portalSvc.indexOf("async function createComment"))
    expect(comment.slice(0, 800)).not.toContain("assertCanApprove")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   4 · managing the list
   ══════════════════════════════════════════════════════════════════════════ */

describe("adding people", () => {
  beforeEach(() => {
    prisma.clientProject.findUnique.mockResolvedValue({
      id: "p1", projectName: "Colegio Vista", user: { id: "owner1", email: "director@colegiovista.mx" },
    })
    prisma.projectMember.upsert.mockImplementation(async ({ create, update }) => ({
      id: "m1", projectId: "p1", invitedAt: new Date(), acceptedAt: null, ...create, ...update,
    }))
  })

  test("an address is lower-cased, so a lookup is a lookup and not a guess", async () => {
    await members.addMember("p1", { email: "  IT@Colegio.MX ", role: "viewer" })
    expect(prisma.projectMember.upsert.mock.calls[0][0].where.projectId_email.email).toBe("it@colegio.mx")
  })

  test("a second invitation to the same address is an EDIT", async () => {
    // "Add the director again as an approver" is the natural way to change
    // a role; failing it sends an operator looking for a delete button.
    await members.addMember("p1", { email: "it@colegio.mx", role: "approver" })
    expect(prisma.projectMember.upsert.mock.calls[0][0].update).toMatchObject({ role: "approver" })
  })

  test("the OWNER cannot be added as a member", async () => {
    // Two answers to "who owns this" is one too many.
    await expect(members.addMember("p1", { email: "DIRECTOR@colegiovista.mx", role: "viewer" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    await expect(members.addMember("p1", { email: "someone@else.mx", role: "owner" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  test("a junk address is refused — it is how they get in", async () => {
    for (const email of ["", "  ", "not-an-email", "a@b", "@x.mx"]) {
      await expect(members.addMember("p1", { email, role: "viewer" }))
        .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    }
    expect(prisma.projectMember.upsert).not.toHaveBeenCalled()
  })

  test("an existing account is linked at once; a stranger is invited by email alone", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u2" })
    await members.addMember("p1", { email: "it@colegio.mx", role: "viewer" })
    expect(prisma.projectMember.upsert.mock.calls[0][0].create.userId).toBe("u2")

    prisma.user.findUnique.mockResolvedValue(null)
    await members.addMember("p1", { email: "new@colegio.mx", role: "viewer" })
    expect(prisma.projectMember.upsert.mock.calls[1][0].create.userId).toBeNull()
  })

  test("there is a ceiling — a project with fifty contacts is a mailing list", async () => {
    prisma.projectMember.count.mockResolvedValue(members.MAX_MEMBERS)
    await expect(members.addMember("p1", { email: "one@more.mx", role: "viewer" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  test("removing is scoped to the project, so an id from elsewhere cannot be used", async () => {
    prisma.projectMember.deleteMany.mockResolvedValue({ count: 0 })
    await expect(members.removeMember("p1", "m-elsewhere")).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.projectMember.deleteMany.mock.calls[0][0].where).toEqual({ id: "m-elsewhere", projectId: "p1" })
  })

  test("a membership invited before the account existed is claimed at sign-in", async () => {
    prisma.projectMember.updateMany.mockResolvedValue({ count: 2 })
    expect(await members.linkExistingAccounts({ id: "u2", email: "IT@Colegio.MX" })).toBe(2)
    expect(prisma.projectMember.updateMany.mock.calls[0][0]).toEqual({
      where: { email: "it@colegio.mx", userId: null },
      data:  { userId: "u2" },
    })
  })

  test("a failure to link never breaks a login", async () => {
    prisma.projectMember.updateMany.mockRejectedValue(new Error("db down"))
    await expect(members.linkExistingAccounts({ id: "u2", email: "x@y.mx" })).resolves.toBe(0)
  })
})

describe("who hears about the project", () => {
  beforeEach(() => {
    prisma.clientProject.findUnique.mockResolvedValue({
      id: "p1", userId: "owner1", user: { id: "owner1", email: "director@colegiovista.mx", fullName: "Ana Ruiz" },
    })
  })

  test("the owner is always first", async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ userId: "u2", email: "it@colegio.mx", name: "IT", role: "viewer" }])
    const out = await members.recipientsFor("p1")
    expect(out[0]).toMatchObject({ role: "owner", email: "director@colegiovista.mx" })
    expect(out).toHaveLength(2)
  })

  test("the owner's own address is never sent to twice", async () => {
    // addMember refuses it, but a row written before that rule existed must
    // not be trusted to be absent.
    prisma.projectMember.findMany.mockResolvedValue([{ userId: null, email: "DIRECTOR@colegiovista.mx", role: "viewer" }])
    expect(await members.recipientsFor("p1")).toHaveLength(1)
  })

  test("a role filter narrows it — and asks the database, not the array", async () => {
    prisma.projectMember.findMany.mockResolvedValue([])
    await members.recipientsFor("p1", { roles: ["owner", "approver"] })
    expect(prisma.projectMember.findMany.mock.calls[0][0].where.role).toEqual({ in: ["approver"] })
  })

  test("a member with no account still gets an address and no user id", async () => {
    prisma.projectMember.findMany.mockResolvedValue([{ userId: null, email: "it@colegio.mx", role: "viewer" }])
    const out = await members.recipientsFor("p1")
    expect(out[1]).toMatchObject({ userId: null, email: "it@colegio.mx" })
  })

  test("the bell fans out to accounts only, because there is no dashboard otherwise", () => {
    const svc = read("src", "services", "notificationService.js")
    const block = svc.slice(svc.indexOf("async function notifyProjectAudience"))
    expect(block.slice(0, 900)).toContain("if (r.userId) ids.add")
  })

  test("the DIGEST is the one email that fans out, and event emails do not", () => {
    // Multiplying every per-event email by the contact count is how a
    // project starts producing ten emails a day, which is how people stop
    // reading any of them.
    const svc = read("src", "services", "projectEmailService.js")
    expect(svc).toContain("recipientsFor(project.id)")
    expect(svc.match(/recipientsFor\(/g)).toHaveLength(1)
  })
})
