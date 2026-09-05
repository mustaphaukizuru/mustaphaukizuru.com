/**
 * projectFileRequestService.js · asking a client for a document (T5-3).
 *
 * The gap this closes: files could be RECEIVED but never ASKED FOR. Every
 * "can you send me the RFC / the logo files / last year's invoices" lived in
 * an email thread, which means nobody could see what was outstanding, nothing
 * chased itself, and the answer arrived as an attachment with no idea which
 * question it answered.
 *
 * A request is a row with a lifecycle:
 *
 *   requested ──upload──▶ submitted ──accept──▶ accepted
 *       ▲                     │
 *       └──────reject─────────┘   (reviewNote says why; client uploads again)
 *
 * and `cancelled` for "never mind". The rejection loop is why the schema has
 * both `fulfilledFileId` (the one file that answered it, unique) and an
 * `uploads` back-relation (every attempt): the earlier file stays in the
 * gallery rather than vanishing, so a client can see what they sent before.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectEvents = require("./projectEventService")

const STATUSES = ["requested", "submitted", "accepted", "rejected", "cancelled"]
/** The states a client may still upload against. */
const OPEN_STATUSES = ["requested", "rejected"]

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

/**
 * Normalise an extension allowlist to a comparable form.
 *
 * Accepts what a person would type — "pdf, .DOCX , jpg" — and returns
 * [".pdf", ".docx", ".jpg"]. Empty means "no extra restriction", NOT "nothing
 * allowed": the global ALLOWED_EXT in uploadProjectFile.js has already run by
 * the time anything reaches here, so an empty list falls back to it rather
 * than rejecting every upload.
 */
function parseAcceptExt(value) {
  if (!value) return []
  return String(value)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((part) => (part.startsWith(".") ? part : `.${part}`))
}

/** Does this filename satisfy the request's own allowlist? */
function extensionAllowed(fileName, acceptExt) {
  const allowed = parseAcceptExt(acceptExt)
  if (!allowed.length) return true
  const name = String(fileName || "").toLowerCase()
  const dot = name.lastIndexOf(".")
  if (dot < 0) return false
  return allowed.includes(name.slice(dot))
}

function serialize(request, locale = "en") {
  if (!request) return null
  const es = locale === "es"
  return {
    id: request.id,
    projectId: request.projectId,
    milestoneId: request.milestoneId || null,
    title: (es && request.titleEs) || request.title,
    instructions: (es && request.instructionsEs) || request.instructions || null,
    acceptExt: request.acceptExt || null,
    status: request.status,
    dueAt: request.dueAt?.toISOString?.() || null,
    reviewNote: request.reviewNote || null,
    submittedAt: request.submittedAt?.toISOString?.() || null,
    closedAt: request.closedAt?.toISOString?.() || null,
    createdAt: request.createdAt?.toISOString?.() || null,
    isOpen: OPEN_STATUSES.includes(request.status),
    fulfilledFileId: request.fulfilledFileId || null,
  }
}

/* ── Admin ───────────────────────────────────────────────────────────── */

async function createRequest(projectId, data = {}, { requestedById = null } = {}) {
  if (!projectId) throw err("Project id is required", "VALIDATION_ERROR")
  const title = String(data.title || "").trim()
  if (!title) throw err("A request needs a title — say what you are asking for", "VALIDATION_ERROR")

  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, userId: true, projectName: true },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)

  const request = await prisma.projectFileRequest.create({
    data: {
      projectId: project.id,
      milestoneId: data.milestoneId ? String(data.milestoneId) : null,
      title: title.slice(0, 200),
      titleEs: data.titleEs ? String(data.titleEs).trim().slice(0, 200) : null,
      instructions: data.instructions ? String(data.instructions).trim().slice(0, 2000) : null,
      instructionsEs: data.instructionsEs ? String(data.instructionsEs).trim().slice(0, 2000) : null,
      // Stored normalised so the client UI and the upload check read the same
      // thing, whatever the admin typed.
      acceptExt: parseAcceptExt(data.acceptExt).join(",") || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      requestedById: requestedById ? String(requestedById) : null,
      status: "requested",
    },
  })

  await projectEvents.record({
    projectId: project.id,
    type: "file.requested",
    actorRole: "admin",
    detail: request.title,
    detailEs: request.titleEs || request.title,
    refs: { fileRequestId: request.id, milestoneId: request.milestoneId },
  })

  return { request, project }
}

async function listForProject(projectId, { includeClosed = true } = {}) {
  if (!projectId) return []
  return prisma.projectFileRequest.findMany({
    where: {
      projectId: String(projectId),
      ...(includeClosed ? {} : { status: { in: OPEN_STATUSES } }),
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  })
}

/**
 * Accept, reject or cancel.
 *
 * Reject deliberately reopens rather than closing: the client has to be able
 * to try again, and the request is the only place that remembers what was
 * asked for.
 */
async function reviewRequest(requestId, { action, reviewNote = null } = {}) {
  if (!requestId) throw err("Request id is required", "VALIDATION_ERROR")
  if (!["accept", "reject", "cancel"].includes(action)) {
    throw err('action must be "accept", "reject" or "cancel"', "VALIDATION_ERROR")
  }

  const existing = await prisma.projectFileRequest.findUnique({
    where: { id: String(requestId) },
    select: { id: true, projectId: true, status: true, title: true, titleEs: true },
  })
  if (!existing) throw err("Request not found", "NOT_FOUND", 404)

  if (action !== "cancel" && existing.status !== "submitted") {
    throw err(
      `Request is "${existing.status}" — only a submitted request can be accepted or rejected`,
      "INVALID_STATE",
      409,
    )
  }
  if (existing.status === "accepted") {
    throw err("Request is already accepted", "INVALID_STATE", 409)
  }

  const note = reviewNote ? String(reviewNote).trim().slice(0, 2000) : null
  if (action === "reject" && !note) {
    // A rejection with no reason asks the client to guess, which produces
    // the same file again.
    throw err("Say what needs to change when rejecting a document", "VALIDATION_ERROR")
  }

  const patch = {
    accept: { status: "accepted", closedAt: new Date(), reviewNote: note },
    reject: { status: "rejected", reviewNote: note },
    cancel: { status: "cancelled", closedAt: new Date(), reviewNote: note },
  }[action]

  const updated = await prisma.projectFileRequest.update({
    where: { id: existing.id },
    data: patch,
  })

  const EVENT_FOR_ACTION = { accept: "file.accepted", reject: "file.rejected" }
  const type = EVENT_FOR_ACTION[action]
  if (type) {
    await projectEvents.record({
      projectId: existing.projectId,
      type,
      actorRole: "admin",
      detail: existing.title,
      detailEs: existing.titleEs || existing.title,
      refs: { fileRequestId: existing.id },
    })
  }

  return updated
}

/* ── Client ──────────────────────────────────────────────────────────── */

/**
 * Check that a request can be uploaded against, for this project, with these
 * filenames. Returns the request; throws with a client-safe message.
 *
 * The project check is not a formality: the request id arrives in the request
 * body from the browser, so without it a client could attach a file to
 * someone else's request by guessing an id.
 */
async function assertUploadable(requestId, projectId, fileNames = []) {
  const request = await prisma.projectFileRequest.findUnique({
    where: { id: String(requestId) },
    select: { id: true, projectId: true, status: true, acceptExt: true, title: true, titleEs: true },
  })
  if (!request || request.projectId !== String(projectId)) {
    // Same message for "does not exist" and "belongs to another project": a
    // different one would confirm that an id is real.
    throw err("Document request not found", "NOT_FOUND", 404)
  }
  if (!OPEN_STATUSES.includes(request.status)) {
    throw err(`This request is "${request.status}" and is not accepting uploads`, "INVALID_STATE", 409)
  }

  const rejected = fileNames.filter((name) => !extensionAllowed(name, request.acceptExt))
  if (rejected.length) {
    throw err(
      `This request accepts ${request.acceptExt} — ${rejected.join(", ")} does not match`,
      "INVALID_FILE_TYPE",
      400,
    )
  }

  return request
}

/**
 * Mark a request answered by an uploaded file.
 *
 * Called after the file rows exist, so a failure here leaves the files in the
 * gallery rather than losing an upload the client has already made.
 */
async function markSubmitted(request, file) {
  if (!request || !file) return null
  try {
    const updated = await prisma.projectFileRequest.update({
      where: { id: request.id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        fulfilledFileId: file.id,
        // The previous rejection note has been answered; leaving it would
        // show the client an objection to a file they have replaced.
        reviewNote: null,
      },
    })
    await projectEvents.record({
      projectId: request.projectId,
      type: "file.received",
      actorRole: "client",
      detail: request.title,
      detailEs: request.titleEs || request.title,
      refs: { fileRequestId: request.id, fileId: file.id },
    })
    return updated
  } catch (e) {
    logger.error?.(`[fileRequest] failed to mark ${request.id} submitted: ${e.message}`)
    return null
  }
}

module.exports = {
  STATUSES,
  OPEN_STATUSES,
  parseAcceptExt,
  extensionAllowed,
  serialize,
  createRequest,
  listForProject,
  reviewRequest,
  assertUploadable,
  markSubmitted,
}
