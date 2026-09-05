const path = require("path")
const fs   = require("fs")
const asyncHandler = require("../utils/asyncHandler")
const readReceipts = require("../services/readReceiptService")
const projectInvoices = require("../services/projectInvoiceService")
const fileRequests = require("../services/projectFileRequestService")
const secretHandoff = require("../services/secretHandoffService")
const projectEvents = require("../services/projectEventService")
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const fsp = require("fs/promises")
const { listMyProjects, getMyProject } = require("../services/clientProjectService")
const {
  assertReadable, previewCanFrame, attachClientFiles, createComment, approveMilestone, requestMilestoneChanges,
  ndaStatus, applyNdaGate, acceptAgreement,
  presentForMember, assertDeliverableAccess, loadOwnedProject,
} = require("../services/projectPortalService")
const { STORAGE_PATHS } = require("../config/storagePaths")
const supportService = require("../services/supportService")
const changeRequestService = require("../services/changeRequestService")

/* ────────────────────────────────────────────────────────────────────────
 * SECURITY · resolveProjectFilePath
 *
 * Project files live at `<storage>/projects/<projectId>/<filename>` —
 * outside the versioned deploy directory (see storagePaths.js) and outside
 * public/, so express.static can never serve them. The DB keeps the
 * legacy-shaped relative path `/files/projects/<id>/<name>`; rows written
 * before the storage move resolve against the same root, so moving the
 * old directory into storage/projects/ is the only migration step.
 *
 * This helper resolves the on-disk absolute path with a startsWith()
 * guard so a malicious filePath like `/files/projects/../etc/passwd`
 * cannot escape the safe root. Same pattern used in downloadController.
 * ──────────────────────────────────────────────────────────────────── */
const PROJECT_FILES_ROOT = path.resolve(STORAGE_PATHS.projectFiles)

function resolveSafePath(filePath) {
  if (!filePath) return null
  // Strip any leading `/files/projects/` and normalise slashes.
  const rel = String(filePath)
    .replace(/^[/\\]+/, "")
    .replace(/^files[/\\]+projects[/\\]+/i, "")
    .replace(/\\/g, "/")
  const abs = path.resolve(PROJECT_FILES_ROOT, rel)
  if (!abs.startsWith(PROJECT_FILES_ROOT)) return null
  return abs
}

/* ────────────────────────────────────────────────────────────────────── */

const listMine = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  const data = await listMyProjects(userId)
  res.status(200).json({ success: true, data })
})

const getMine = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  const project = await getMyProject({ userId, projectId: req.params.id })
  if (!project) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project not found" } })
  try {
    const lc = assertReadable(project)
    // Tier 4 · NDA gate: header stays, everything under NDA is withheld until
    // the client has accepted the current version.
    const nda = await ndaStatus(project, userId)
    const gated = nda.required && !nda.accepted
    const body = gated ? applyNdaGate(project) : project
    // Tier 4 · presentForMember adds access.state / suspended / handover and
    // blanks previewUrl for suspended projects; the NDA gate then wins over
    // preview framing. (This used to send two responses — the second threw
    // ERR_HTTP_HEADERS_SENT on every project view and the SPA never saw
    // access.state.)
    const presented = presentForMember(body, lc)
    res.status(200).json({
      success: true,
      data: {
        ...presented,
        previewCanFrame: gated ? false : presented.previewCanFrame,
        nda: { required: nda.required, accepted: nda.accepted, version: nda.version, acceptedAt: nda.acceptedAt },
      },
    })
  } catch (e) {
    return portalError(res, e)
  }
})

/** POST /member/projects/:id/agreements { type: "nda", version } */
const acceptProjectAgreement = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await acceptAgreement({
      userId, projectId: req.params.id,
      type: req.body?.type, version: req.body?.version,
      ipAddress: req.ip || null, userAgent: req.get?.("user-agent") || null,
    })
    res.status(201).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/* ── Tier 2 · client writes ───────────────────────────────────────────── */

function portalError(res, e) {
  if (e?.statusCode && e?.code) {
    return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } })
  }
  throw e
}

/** POST /member/projects/:id/files — multipart `files[]` (dropzone). */
const uploadFiles = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  const files = req.files || (req.file ? [req.file] : [])
  try {
    const rows = await attachClientFiles({
      userId,
      projectId: req.params.id,
      files,
      milestoneId: req.body?.milestoneId || null,
      // T5-3 · optional: this upload answers a document request.
      fileRequestId: req.body?.fileRequestId || null,
    })
    res.status(201).json({ success: true, data: rows })
  } catch (e) {
    // Never leave orphaned bytes when the DB refused the rows.
    await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => null)))
    return portalError(res, e)
  }
})

/** POST /member/projects/:id/comments */
const addComment = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const comment = await createComment({
      projectId: req.params.id, authorId: userId, authorRole: "client",
      body: req.body?.body, milestoneId: req.body?.milestoneId || null, fileId: req.body?.fileId || null,
    })
    res.status(201).json({ success: true, data: comment })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/milestones/:milestoneId/approve */
const approve = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const ms = await approveMilestone({ userId, projectId: req.params.id, milestoneId: req.params.milestoneId, note: req.body?.note })
    res.status(200).json({ success: true, data: ms })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/milestones/:milestoneId/request-changes */
const requestChanges = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const ms = await requestMilestoneChanges({ userId, projectId: req.params.id, milestoneId: req.params.milestoneId, note: req.body?.note })
    res.status(200).json({ success: true, data: ms })
  } catch (e) { return portalError(res, e) }
})

/* ── Tier 2 · project-scoped support tickets ─────────────────────────── */

function uploadedFiles(req) {
  return req.files || (req.file ? [req.file] : [])
}
async function discardUploads(files) {
  await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => null)))
}

/** GET /member/projects/:id/tickets */
const listTickets = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await supportService.listProjectTicketsForUser({ userId, projectId: req.params.id })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** GET /member/projects/:id/tickets/:ticketId — thread with attachments. */
const getTicket = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await supportService.getProjectTicketForUser({ userId, projectId: req.params.id, ticketId: req.params.ticketId })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/tickets — multipart (`files[]`) or JSON. */
const createTicket = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  const files = uploadedFiles(req)
  try {
    const ticket = await supportService.createProjectTicket({
      userId, projectId: req.params.id, files,
      subject:     req.body?.subject,
      message:     req.body?.message,
      priority:    req.body?.priority,
      milestoneId: req.body?.milestoneId || null,
    })
    res.status(201).json({ success: true, data: ticket })
  } catch (e) {
    await discardUploads(files)
    return portalError(res, e)
  }
})

/** POST /member/projects/:id/tickets/:ticketId/messages — multipart or JSON. */
const replyTicket = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  const files = uploadedFiles(req)
  try {
    const msg = await supportService.createProjectTicketMessage({
      userId, projectId: req.params.id, ticketId: req.params.ticketId, message: req.body?.message, files,
    })
    res.status(201).json({ success: true, data: msg })
  } catch (e) {
    await discardUploads(files)
    return portalError(res, e)
  }
})

/* ── Tier 4 · change requests (extra work) ───────────────────────────── */

/** GET /member/projects/:id/change-requests */
const listChangeRequests = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await changeRequestService.listMine({ userId, projectId: req.params.id })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/change-requests { title, description } */
const createChangeRequest = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await changeRequestService.createRequest({ userId, projectId: req.params.id, title: req.body?.title, description: req.body?.description })
    res.status(201).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/change-requests/:crId/accept → { orderId, redirectUrl } */
const acceptChangeRequest = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await changeRequestService.acceptRequest({ userId, projectId: req.params.id, crId: req.params.crId })
    res.status(201).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/** POST /member/projects/:id/change-requests/:crId/decline */
const declineChangeRequest = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    const data = await changeRequestService.declineRequest({ userId, projectId: req.params.id, crId: req.params.crId, note: req.body?.note || null })
    res.status(200).json({ success: true, data })
  } catch (e) { return portalError(res, e) }
})

/**
 * GET /api/v1/member/projects/:id/files/:fileId/download
 *
 * Authenticated, ownership-scoped streaming download for project files.
 * Replaces the previous "everyone can hit /files/projects/<id>/<name>
 * directly" static-serve path that exposed deliverables to anyone with
 * a URL. Authorisation chain:
 *
 *   1. `protect` middleware on the route parent populates req.user
 *   2. We re-verify the file belongs to a project the user owns
 *   3. Path is resolved against the safe root with a startsWith guard
 *   4. Stream with `Content-Disposition: attachment` + private no-store
 *   5. Best-effort access log to ActivityLog
 */
const streamFile = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  }

  const { id: projectId, fileId } = req.params

  // Single composite query: file row + parent project ownership in one round-trip.
  const file = await prisma.projectFile.findFirst({
    where: { id: String(fileId), projectId: String(projectId) },
    include: {
      // One select — a duplicate `project:` key here silently dropped
      // requiresNda/ndaVersion and bypassed the NDA gate on downloads.
      project: { select: { id: true, userId: true, projectName: true, requiresNda: true, ndaVersion: true, accessState: true } },
    },
  })

  if (!file) {
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } })
  }
  if (file.project?.userId !== userId) {
    // 404 (not 403) so we don't confirm existence to a non-owner.
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } })
  }
  // Tier 4 · deliverables are under NDA until the client has accepted it.
  const nda = await ndaStatus(file.project, userId)
  if (nda.required && !nda.accepted) {
    return res.status(403).json({ success: false, error: { code: "NDA_REQUIRED", message: "Please accept the project NDA before downloading files." } })
  }
  // Tier 4 · kill switch: deliverables are withheld (402) while suspended.
  try { assertDeliverableAccess(file.project, file) } catch (e) { return portalError(res, e) }

  return sendProjectFile({ file, req, res, userId, action: "project.file.downloaded" })
})

/**
 * Shared streaming tail used by the member endpoint above and the admin
 * download endpoint. Authorisation is the CALLER's job — this only resolves
 * the safe path, logs, and streams.
 */
function sendProjectFile({ file, req, res, userId, action }) {
  const abs = resolveSafePath(file.filePath)
  if (!abs) {
    logger.warn("[project file] suspicious path rejected", { fileId: file.id, filePath: file.filePath })
    return res.status(400).json({ success: false, error: { code: "INVALID_PATH", message: "Access denied" } })
  }
  if (!fs.existsSync(abs)) {
    return res.status(404).json({ success: false, error: { code: "FILE_MISSING", message: "File is no longer available. Please contact support." } })
  }

  // T5-14 · the read receipt. Fire-and-forget, beside the access log and
  // for the same reason: a note in the margin must never stop a client
  // downloading a file they are entitled to. Only a CLIENT action stamps —
  // an admin opening their own upload would make the receipt a lie about
  // the person it names, and a lie in the direction that stops us chasing.
  readReceipts.recordFileView(file, action).catch(() => null)

  // Best-effort access log — fire-and-forget so a logging failure never
  // blocks the download itself.
  prisma.activityLog
    .create({
      data: {
        userId,
        action,
        entityType:  "ProjectFile",
        entityId:    file.id,
        description: `Downloaded ${file.fileName} from project ${file.project?.projectName || file.projectId}`,
        ipAddress:   req.ip || null,
      },
    })
    .catch(() => null)

  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8\'\'${encodeURIComponent(file.fileName)}`)
  res.setHeader("Cache-Control", "private, no-store")
  if (file.fileType) res.setHeader("Content-Type", file.fileType)

  const stream = fs.createReadStream(abs)
  stream.on("error", (err) => {
    logger.error("[project file stream]", err.message)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: { code: "STREAM_ERROR", message: "Could not stream file" } })
    } else {
      res.end()
    }
  })
  stream.pipe(res)
}

/**
 * GET /member/projects/:id/events  (T5-5)
 *
 * The timeline behind the project page. "client" is the ceiling: a signed-in
 * owner sees file names, comments and requests, never the admin-only rows.
 */
const listEvents = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    await loadOwnedProject({ userId, projectId: req.params.id })
    const locale = resolveUserLocale({ req, user: req.user })
    const rows = await projectEvents.listForProject(req.params.id, { audience: "client" })
    res.json({ success: true, data: rows.map((r) => projectEvents.serializeEvent(r, locale)) })
  } catch (e) {
    return portalError(res, e)
  }
})

/**
 * GET /member/projects/:id/file-requests  (T5-5)
 *
 * What the studio is waiting on. The admin list already existed; this is the
 * same rows read by the person who has to satisfy them.
 */
const listFileRequests = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    await loadOwnedProject({ userId, projectId: req.params.id })
    const locale = resolveUserLocale({ req, user: req.user })
    const rows = await fileRequests.listForProject(req.params.id)
    res.json({ success: true, data: rows.map((r) => fileRequests.serialize(r, locale)) })
  } catch (e) {
    return portalError(res, e)
  }
})

/**
 * GET /member/projects/:id/invoices  (T5-4)
 *
 * The invoices already existed; they were just findable only from a bare
 * order page. loadOwnedProject is what proves this member may see them.
 */
const listInvoices = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    // Ownership first, then the read. Skipping this would let any signed-in
    // member list any project's billing by id.
    await loadOwnedProject({ userId, projectId: req.params.id })
    const data = await projectInvoices.listForProject(req.params.id)
    res.json({ success: true, data })
  } catch (e) {
    return portalError(res, e)
  }
})

/* ── T5-13 · the secure credential handoff ────────────────────────────────
 *
 * Three handlers, and the direction is NOT a parameter on any of them. A
 * member creating a secret is always sending one TO us; the direction
 * decides who may reveal it, so letting the caller pick would let a client
 * mint a secret only they can read, which is a note to self dressed as a
 * handoff.
 */

/** GET /member/projects/:id/secrets — metadata only, never a value. */
const listSecrets = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    await loadOwnedProject({ userId, projectId: req.params.id })
    res.json({ success: true, data: await secretHandoff.listForProject(req.params.id, "client") })
  } catch (e) {
    return portalError(res, e)
  }
})

/** POST /member/projects/:id/secrets — the client sends us a credential. */
const createSecret = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    await loadOwnedProject({ userId, projectId: req.params.id })
    const { secret } = await secretHandoff.createSecret(req.params.id, {
      ...req.body,
      direction: "to_admin",
    }, { createdById: userId })
    res.status(201).json({ success: true, data: secret })
  } catch (e) {
    return portalError(res, e)
  }
})

/**
 * POST /member/projects/:id/secrets/:secretId/reveal
 *
 * POST, not GET, and that is a deliberate departure from the plan. This call
 * DESTROYS the thing it returns, and a GET that destroys state is consumed
 * by a link scanner, a prefetch, a chat client's preview or the browser
 * restoring a tab — every one of which burns the client's one read before
 * they have seen it.
 */
const revealSecret = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, error: { code: "AUTH_MISSING", message: "Authentication required" } })
  try {
    await loadOwnedProject({ userId, projectId: req.params.id })
    const out = await secretHandoff.revealSecret(req.params.secretId, req.params.id, "client")
    // Never cached, anywhere. This body is a credential.
    res.setHeader("Cache-Control", "no-store")
    res.json({ success: true, data: out })
  } catch (e) {
    return portalError(res, e)
  }
})

module.exports = {
  listMine, getMine, streamFile, sendProjectFile, resolveSafePath, PROJECT_FILES_ROOT,
  uploadFiles, addComment, approve, requestChanges, acceptProjectAgreement,
  listInvoices, listEvents, listFileRequests,
  listSecrets, createSecret, revealSecret,
  listTickets, getTicket, createTicket, replyTicket,
  listChangeRequests, createChangeRequest, acceptChangeRequest, declineChangeRequest,
}
