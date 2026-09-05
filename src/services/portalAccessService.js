/**
 * portalAccessService · Tier 4 magic-link + PIN portal (no login).
 *
 * Flow:
 *   1. Admin mints a portal link  → ClientProject.portalToken (32 random
 *      bytes, hex) + portalTokenExpiresAt. The link is FRONTEND_URL/portal/<token>.
 *   2. Visitor opens it and asks for a PIN → an AuthOtp row (purpose
 *      "portal", 6 digits, 10 min) for the project's owner, emailed with the
 *      `portal.pin` template. The response never reveals the address beyond
 *      a masked hint.
 *   3. Visitor submits the PIN → latest unused OTP is checked (constant
 *      time), marked used, and a read-only project-scoped JWT
 *      { scope: "portal", projectId, userId } is issued for 2 h. The
 *      controller puts it in the httpOnly `mu_portal` cookie.
 *   4. GET /portal/me/* reads through portalAuth — milestones, files and the
 *      preview link only. No writes exist on this surface.
 *
 * Token lifetime follows the project lifecycle: a closed project's link dies
 * with the PROJECT_ACCESS_GRACE_DAYS window; an open project's link lasts
 * 90 days and can be re-minted at any time (re-minting rotates the token).
 */

const crypto = require("crypto")
const { signJwt } = require("../utils/jwt")
const { normalizeTrackingCode } = require("../utils/trackingCode")
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { lifecycle, previewCanFrame, ndaStatus } = require("./projectPortalService")
const { getMyProject } = require("./clientProjectService")
const { sendTemplateEmail } = require("./emailService")

const OTP_PURPOSE = "portal"
const OTP_TTL_MS = 10 * 60 * 1000
const PORTAL_JWT_TTL = "2h"
const OPEN_PROJECT_LINK_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

function err(message, code, statusCode = 400, details) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  if (details) e.details = details
  return e
}

function frontendBase() {
  return String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

/** "m•••@example.com" — enough for the visitor to recognise the inbox. */
function maskEmail(email) {
  const [local = "", domain = ""] = String(email || "").split("@")
  if (!domain) return "•••"
  return `${local.slice(0, 1)}•••@${domain}`
}

/** Expiry for a freshly minted link, derived from the project's lifecycle. */
function portalLinkExpiry(project, now = new Date()) {
  const lc = lifecycle(project, now)
  if (lc.isClosed && lc.expiresAt) return lc.expiresAt
  return new Date(now.getTime() + OPEN_PROJECT_LINK_DAYS * DAY_MS)
}

/* ── 1 · admin mints the link ──────────────────────────────────────────── */

async function mintPortalLink(projectId) {
  const project = await prisma.clientProject.findUnique({
    where:  { id: String(projectId) },
    select: { id: true, projectStatus: true, closedAt: true, updatedAt: true },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  const lc = lifecycle(project)
  if (lc.isExpired) throw err("This project's access window has ended — reopen it before sharing a link", "PROJECT_EXPIRED", 410)

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = portalLinkExpiry(project)
  await prisma.clientProject.update({
    where: { id: project.id },
    data:  { portalToken: token, portalTokenExpiresAt: expiresAt },
  })
  return { token, url: `${frontendBase()}/portal/${token}`, expiresAt }
}

/* ── shared · resolve a live token ─────────────────────────────────────── */

async function loadProjectByToken(token) {
  const value = String(token || "").trim()
  if (!/^[a-f0-9]{64}$/i.test(value)) throw err("This link is not valid", "PORTAL_LINK_INVALID", 404)
  const project = await prisma.clientProject.findUnique({
    where:  { portalToken: value },
    select: {
      id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true,
      portalTokenExpiresAt: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  })
  if (!project) throw err("This link is not valid", "PORTAL_LINK_INVALID", 404)
  const now = Date.now()
  if (project.portalTokenExpiresAt && new Date(project.portalTokenExpiresAt).getTime() < now) {
    throw err("This link has expired — ask your project lead for a new one", "PORTAL_LINK_EXPIRED", 410)
  }
  if (lifecycle(project).isExpired) throw err("This project is no longer available", "PROJECT_EXPIRED", 410)
  return project
}

/**
 * T5-8 · the same project, reached by its TRACKING CODE instead of a link.
 *
 * The second door exists because the first one is a link somebody has to
 * still have. A client who deleted the email, or who was told the code over
 * the phone, could see the tracking page and had no way through to their
 * files — and asking for a new magic link is a message to a person, which
 * is exactly the friction the portal was built to remove.
 *
 * WHAT THIS DOES NOT CHANGE, AND IT IS THE WHOLE SECURITY ARGUMENT
 *
 * The code is not a credential and does not become one here (ADR 0006). All
 * it does is cause a PIN to be sent to the ADDRESS ON THE PROJECT — which
 * the holder of the code may well not control. Possession of a code gets you
 * a page of progress and an email in somebody else's inbox; only that inbox
 * gets you in. That is the same property the magic link has always had.
 *
 * The lifecycle gate is the same too: an expired project is unreachable by
 * either door. What is deliberately NOT checked is portalTokenExpiresAt —
 * this door does not use the token, and refusing on a stale one would make
 * the code useless in exactly the case it is most useful.
 */
async function loadProjectByCode(rawCode) {
  const code = normalizeTrackingCode(rawCode)
  // The same answer as an unknown code, for the same reason the tracking
  // endpoint gives one: a distinguishable "malformed" tells a sweep which
  // guesses were the right SHAPE.
  if (!code) throw err("No project matches that code", "PORTAL_CODE_INVALID", 404)

  const project = await prisma.clientProject.findUnique({
    where:  { trackingCode: code },
    select: {
      id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true,
      portalTokenExpiresAt: true,
      user: { select: { id: true, email: true, fullName: true } },
    },
  })
  if (!project) throw err("No project matches that code", "PORTAL_CODE_INVALID", 404)
  if (lifecycle(project).isExpired) throw err("This project is no longer available", "PROJECT_EXPIRED", 410)
  return project
}

/* ── 2 · request a PIN ─────────────────────────────────────────────────── */

function generatePin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0")
}

async function requestPin(token, { locale } = {}) {
  return requestPinForProject(await loadProjectByToken(token), { locale })
}

/** T5-8 · the same PIN, for a project reached by its tracking code. */
async function requestPinByCode(code, { locale } = {}) {
  return requestPinForProject(await loadProjectByCode(code), { locale })
}

/**
 * Everything after the project is loaded, shared by both doors.
 *
 * Split out rather than duplicated: the PIN generation, the TTL and the
 * template are the security-relevant part, and two copies is two things to
 * keep in step.
 */
async function requestPinForProject(project, { locale } = {}) {
  const email = project.user?.email
  if (!email) throw err("No contact address on this project", "PORTAL_NO_EMAIL", 409)

  const otpCode = generatePin()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  await prisma.authOtp.create({
    data: { userId: project.userId, email, otpCode, purpose: OTP_PURPOSE, expiresAt },
  })

  const result = await sendTemplateEmail({
    to: email,
    templateKey: "portal.pin",
    locale: locale || "en",
    userId: project.userId,
    variables: { pin: otpCode, projectName: project.projectName, expiresMinutes: String(OTP_TTL_MS / 60000), name: project.user?.fullName || "" },
  })
  if (result && result.ok === false) logger.warn("[portal] PIN email failed", { projectId: project.id, error: result.error })

  return { emailHint: maskEmail(email), expiresAt, projectName: project.projectName }
}

/* ── 3 · verify the PIN → portal JWT ───────────────────────────────────── */

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""), "utf8")
  const y = Buffer.from(String(b || ""), "utf8")
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y)
}

async function verifyPin(token, pin) {
  return verifyPinForProject(await loadProjectByToken(token), pin)
}

/** T5-8 · the same verification, for a project reached by its code. */
async function verifyPinByCode(code, pin) {
  return verifyPinForProject(await loadProjectByCode(code), pin)
}

async function verifyPinForProject(project, pin) {
  const given = String(pin || "").replace(/\s+/g, "")
  if (!/^\d{6}$/.test(given)) throw err("Enter the 6-digit PIN from your email", "VALIDATION_ERROR", 400)

  const otp = await prisma.authOtp.findFirst({
    where:   { userId: project.userId, purpose: OTP_PURPOSE, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!otp || !safeEqual(otp.otpCode, given)) {
    throw err("That PIN is wrong or has expired — request a new one", "PORTAL_PIN_INVALID", 401)
  }
  await prisma.authOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } })

  const portalToken = signJwt(
    { scope: "portal", projectId: project.id, userId: project.userId },
    { expiresIn: PORTAL_JWT_TTL },
  )
  await prisma.activityLog.create({
    data: { userId: project.userId, action: "project.portal.opened", entityType: "ClientProject", entityId: project.id, description: `Portal opened via magic link for ${project.projectName}` },
  }).catch(() => null)

  return { token: portalToken, projectId: project.id, projectName: project.projectName }
}

/* ── 4 · read-only project view ────────────────────────────────────────── */

const FILE_FIELDS = ["id", "fileName", "fileType", "fileSize", "milestoneId", "isDeliverable", "uploadedByRole", "createdAt", "purgedAt"]
const MILESTONE_FIELDS = ["id", "title", "description", "status", "dueDate", "completedAt", "approvedAt", "changesRequestedAt", "sortOrder"]
const pickFields = (row, fields) => Object.fromEntries(fields.filter((k) => k in row).map((k) => [k, row[k]]))

/** Member shape minus writes: milestones, files (no ticket attachments), preview. */
async function loadPortalProject({ projectId, userId }) {
  const project = await getMyProject({ userId, projectId })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  const lc = lifecycle(project)
  if (lc.isExpired) throw err("This project is no longer available", "PROJECT_EXPIRED", 410)

  const nda = await ndaStatus(project, userId)
  const gated = nda.required && !nda.accepted

  return {
    id: project.id,
    projectName: project.projectName,
    projectStatus: project.projectStatus,
    description: gated ? null : project.description,
    startDate: project.startDate,
    dueDate: project.dueDate,
    assignedAdmin: project.assignedAdmin ? { fullName: project.assignedAdmin.fullName } : null,
    milestones: gated ? [] : (project.milestones || []).map((m) => pickFields(m, MILESTONE_FIELDS)),
    files: gated ? [] : (project.files || []).filter((f) => !f.supportMessageId).map((f) => pickFields(f, FILE_FIELDS)),
    previewUrl: gated ? null : project.previewUrl || null,
    previewCanFrame: gated ? false : previewCanFrame(project.previewUrl),
    access: { readOnly: true, isClosed: lc.isClosed, expiresAt: lc.expiresAt },
    nda: { required: nda.required, accepted: nda.accepted, version: nda.version },
    ndaGate: gated,
  }
}

module.exports = {
  loadProjectByCode,
  requestPinByCode,
  verifyPinByCode,
  mintPortalLink, requestPin, verifyPin, loadPortalProject, loadProjectByToken,
  portalLinkExpiry, maskEmail, generatePin,
  OTP_PURPOSE, OTP_TTL_MS, PORTAL_JWT_TTL, OPEN_PROJECT_LINK_DAYS,
}
