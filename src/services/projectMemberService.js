const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { MEMBER_ROLES, APPROVING_ROLES } = require("./projectPortalService")

/**
 * projectMemberService.js · the other people on the client's side (T5-17)
 *
 * A project belonged to exactly one User row, and schools do not work that
 * way — nor do most organisations. There is a director who approves the work
 * and signs off the money, and an IT person who uploads the files and answers
 * the technical questions. Before this, the second person either shared a
 * password or forwarded every email, and every approval came from an account
 * that was not the person approving it.
 *
 * `ClientProject.userId` STAYS the owner. This is an addition: the owner is
 * who the project was sold to, who is billed, and the fallback recipient for
 * everything. A member is somebody else who may also reach it.
 *
 * THE IDENTITY IS THE EMAIL, NOT THE ACCOUNT
 *
 * A member need not have one. `email` always exists; `userId` is filled in
 * when somebody signs in with that address. Until then they reach the project
 * through the tracking code and a PIN sent to their own inbox (T5-8), which
 * is exactly the door that already existed — the PIN just goes somewhere
 * else now.
 *
 * WHAT A ROLE ACTUALLY GATES
 *
 * Only three things: approving a milestone, accepting or declining a quote,
 * and starting a payment. Everything else — reading, uploading, commenting,
 * opening a ticket — is open to every member, because the IT person in the
 * driving example exists to send us files and a role that could not type
 * would be useless to them. See assertCanApprove in projectPortalService.
 */

/** An address we will actually send to. Not validation theatre — a bad row here means a PIN nobody receives. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** A ceiling. A project with fifty contacts is a mailing list, not a project. */
const MAX_MEMBERS = 20

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase()
}

function serialize(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    role: row.role,
    hasAccount: Boolean(row.userId),
    invitedAt: row.invitedAt?.toISOString?.() || null,
    // Null until they actually arrive. It is the honest answer to "did the
    // invitation work?", which is otherwise guesswork.
    acceptedAt: row.acceptedAt?.toISOString?.() || null,
  }
}

async function listForProject(projectId) {
  if (!projectId) return []
  const rows = await prisma.projectMember.findMany({
    where: { projectId: String(projectId) },
    orderBy: [{ role: "asc" }, { invitedAt: "asc" }],
    take: MAX_MEMBERS,
  })
  return rows.map(serialize)
}

/**
 * Add somebody, or update the role of somebody already here.
 *
 * A second invitation to the same address is an edit rather than an error:
 * "add the director again as an approver" is the natural way to change a
 * role, and failing it would send an operator looking for a delete button.
 */
async function addMember(projectId, { email, name = null, role = "viewer" } = {}) {
  if (!projectId) throw err("Project id is required", "VALIDATION_ERROR")

  const addr = normaliseEmail(email)
  if (!EMAIL_RE.test(addr)) throw err("A member needs a valid email address — it is how they get in", "VALIDATION_ERROR")
  if (!MEMBER_ROLES.includes(role)) throw err(`role must be one of: ${MEMBER_ROLES.join(", ")}`, "VALIDATION_ERROR")
  if (role === "owner") {
    // The owner is ClientProject.userId, not a row here. Two answers to
    // "who owns this" is one too many.
    throw err("The owner is the account the project belongs to and cannot be added as a member", "VALIDATION_ERROR")
  }

  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, projectName: true, user: { select: { id: true, email: true } } },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)

  if (project.user?.email && normaliseEmail(project.user.email) === addr) {
    throw err("That is the project owner's own address — they already have full access", "VALIDATION_ERROR")
  }

  const existing = await prisma.projectMember.count({ where: { projectId: project.id } })
  if (existing >= MAX_MEMBERS) {
    throw err(`A project can have at most ${MAX_MEMBERS} contacts`, "VALIDATION_ERROR")
  }

  // Link an account if one exists at that address today. If they sign up
  // later, loadOwnedProject still finds them by userId only once this is
  // filled in — so linkExistingAccounts below runs on sign-in.
  const user = await prisma.user.findUnique({ where: { email: addr }, select: { id: true } }).catch(() => null)

  const row = await prisma.projectMember.upsert({
    where:  { projectId_email: { projectId: project.id, email: addr } },
    create: { projectId: project.id, email: addr, name: name ? String(name).trim().slice(0, 160) : null, role, userId: user?.id || null },
    update: { role, ...(name ? { name: String(name).trim().slice(0, 160) } : {}), ...(user?.id ? { userId: user.id } : {}) },
  })
  return { member: serialize(row), project }
}

async function removeMember(projectId, memberId) {
  if (!projectId || !memberId) throw err("Member not found", "NOT_FOUND", 404)
  const res = await prisma.projectMember.deleteMany({
    where: { id: String(memberId), projectId: String(projectId) },
  })
  if (res.count !== 1) throw err("Member not found", "NOT_FOUND", 404)
  return { id: String(memberId), removed: true }
}

/**
 * Attach any membership rows that were invited before this person had an
 * account.
 *
 * Called on sign-in. Without it an invitation sent to somebody who signs up
 * afterwards stays email-only forever: they could still reach the project by
 * code and PIN, but never from their own dashboard, which is the confusing
 * half-state where somebody assumes the invitation failed.
 *
 * Never throws — a failure here must not break a login.
 */
async function linkExistingAccounts(user) {
  const addr = normaliseEmail(user?.email)
  if (!user?.id || !addr) return 0
  try {
    const res = await prisma.projectMember.updateMany({
      where: { email: addr, userId: null },
      data:  { userId: String(user.id) },
    })
    if (res.count) logger.info(`[projectMember] linked ${res.count} membership${res.count === 1 ? "" : "s"} to ${user.id}`)
    return res.count
  } catch (e) {
    logger.warn(`[projectMember] could not link memberships: ${e.message}`)
    return 0
  }
}

/**
 * Everybody who should hear about this project, owner first.
 *
 * ONE list, used by the notification fan-out and the weekly digest, so the
 * two cannot drift into disagreeing about who is on a project.
 *
 * @param {string} projectId
 * @param {object} [opts]
 * @param {string[]} [opts.roles]  restrict to these roles; the owner is
 *                                 always included unless "owner" is excluded
 *                                 explicitly.
 */
async function recipientsFor(projectId, { roles = MEMBER_ROLES } = {}) {
  if (!projectId) return []
  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, userId: true, user: { select: { id: true, email: true, fullName: true } } },
  }).catch(() => null)
  if (!project) return []

  const out = []
  const seen = new Set()

  if (roles.includes("owner") && project.user?.email) {
    out.push({ userId: project.user.id, email: project.user.email, name: project.user.fullName || null, role: "owner" })
    seen.add(normaliseEmail(project.user.email))
  }

  const members = await prisma.projectMember.findMany({
    where:  { projectId: project.id, role: { in: roles.filter((r) => r !== "owner") } },
    select: { userId: true, email: true, name: true, role: true },
    take:   MAX_MEMBERS,
  }).catch(() => [])

  for (const m of members) {
    const addr = normaliseEmail(m.email)
    // The owner's own address appearing as a member row would send the same
    // email twice. addMember refuses it, but a row written before that rule
    // existed must not be trusted to be absent.
    if (!addr || seen.has(addr)) continue
    seen.add(addr)
    out.push({ userId: m.userId || null, email: m.email, name: m.name || null, role: m.role })
  }

  return out
}

module.exports = {
  MEMBER_ROLES,
  APPROVING_ROLES,
  MAX_MEMBERS,
  serialize,
  listForProject,
  addMember,
  removeMember,
  linkExistingAccounts,
  recipientsFor,
}
