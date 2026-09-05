const crypto = require("crypto")

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectEvents = require("./projectEventService")

/**
 * secretHandoffService.js · a credential in transit, and nothing else (T5-13)
 *
 * THE PROBLEM, WHICH WAS REAL AND NOT THEORETICAL
 *
 * Credentials were arriving as files. A hosting password in a .txt, the
 * registrar login in a screenshot, WiFi keys typed into a support ticket.
 * Every one of those lands in storage/projects/ and stays there for the whole
 * retention window — readable by anything that can read the disk, included in
 * any handover ZIP built later, and impossible to un-send.
 *
 * THE SHAPE
 *
 *   create   AES-256-GCM under SECRET_HANDOFF_KEY, plus a label in the clear
 *   reveal   decrypt, return once, WIPE the ciphertext in the same write
 *   expire   seven days by default; unclaimed is a liability, not an inbox
 *
 * Both directions, and the direction IS the access model:
 *
 *   to_client   we are handing something over — only the client may reveal
 *   to_admin    the client is sending us something — only an admin may
 *
 * Whoever wrote it cannot read it back. That is not an inconvenience, it is
 * the property that makes "read once" mean anything: if the sender could
 * re-reveal, the wipe would only be a wipe of the recipient's copy.
 *
 * WHAT IS NOT ENCRYPTED
 *
 * The label, deliberately. Both parties need to see "cPanel password" in a
 * list to know what is waiting for them, and the timeline events carry the
 * label only — never the value, never a hint of it.
 *
 * THE KEY
 *
 * SECRET_HANDOFF_KEY, 32 bytes as 64 hex characters. It joins the rotation
 * runbook (T1-12), and rotating it makes every UNVIEWED secret unreadable.
 * That is acceptable and is stated in the runbook: an unread credential can
 * be sent again, and the alternative — keeping old keys around to decrypt old
 * ciphertext — is how a key rotation becomes decorative.
 *
 * With no key configured, creating a secret is refused with a clear message
 * rather than storing plaintext. There is no degraded mode here.
 */

/** How long an unclaimed secret stays claimable. */
const DEFAULT_TTL_DAYS = 7
/** A ceiling, because "expires in a year" is not an expiry. */
const MAX_TTL_DAYS = 30
const DIRECTIONS = ["to_client", "to_admin"]
/** Long enough for a real credential, short enough not to be a file. */
const MAX_SECRET_BYTES = 4096
const MAX_LABEL_LENGTH = 160

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

/**
 * The key, read at call time.
 *
 * Lazily rather than at module load so the operator can set it without a
 * restart, and so requiring this file in a test does not demand a key.
 */
function keyBuffer() {
  const raw = String(process.env.SECRET_HANDOFF_KEY || "").trim()
  if (!raw) return null
  // Hex is the documented form. A 32-character ASCII passphrase is accepted
  // too, because an operator who reads "32 bytes" and types a password is
  // making a reasonable mistake, and refusing it would send them looking for
  // a workaround rather than for the docs.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  const buf = Buffer.from(raw, "utf8")
  if (buf.length === 32) return buf
  return null
}

/** Is the feature usable at all? Used by the UI to hide what cannot work. */
function isConfigured() {
  return keyBuffer() !== null
}

function requireKey() {
  const key = keyBuffer()
  if (!key) {
    throw err(
      "Secure credential handoff is not configured on this server. Set SECRET_HANDOFF_KEY to 64 hex characters (openssl rand -hex 32).",
      "SECRET_HANDOFF_UNCONFIGURED",
      503,
    )
  }
  return key
}

function encrypt(plaintext) {
  const key = requireKey()
  // 12 bytes is the GCM standard and what every implementation expects; a
  // 16-byte IV silently costs you the fast path and buys nothing.
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
  }
}

function decrypt({ ciphertext, iv, tag }) {
  const key = requireKey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"))
  decipher.setAuthTag(Buffer.from(tag, "hex"))
  // final() throws on a bad tag, which is the whole reason for using GCM:
  // altered ciphertext fails loudly instead of decrypting to garbage.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8")
}

/**
 * Metadata only. There is no listing anywhere that returns a value — a
 * secret leaves this service through `reveal` and by no other path.
 */
function serialize(row, { now = new Date() } = {}) {
  if (!row) return null
  const viewed = Boolean(row.viewedAt)
  const expired = !viewed && new Date(row.expiresAt).getTime() <= now.getTime()
  return {
    id: row.id,
    direction: row.direction,
    label: row.label,
    createdAt: row.createdAt?.toISOString?.() || null,
    expiresAt: row.expiresAt?.toISOString?.() || null,
    viewedAt: row.viewedAt?.toISOString?.() || null,
    // Three states the UI actually needs to distinguish, computed here so
    // the two surfaces cannot disagree about what "gone" means.
    state: viewed ? "viewed" : expired ? "expired" : "pending",
    isRevealable: !viewed && !expired,
  }
}

/* ── create ──────────────────────────────────────────────────────────── */

/**
 * Store one credential for the other party to read once.
 *
 * @param {string} projectId
 * @param {object} data  { direction, label, value, ttlDays? }
 * @param {object} ctx   { createdById }
 */
async function createSecret(projectId, data = {}, { createdById = null } = {}) {
  if (!projectId) throw err("Project id is required", "VALIDATION_ERROR")

  const direction = String(data.direction || "").trim()
  if (!DIRECTIONS.includes(direction)) {
    throw err(`direction must be one of: ${DIRECTIONS.join(", ")}`, "VALIDATION_ERROR")
  }
  const label = String(data.label || "").trim()
  if (!label) throw err("Say what the credential is for — the label is what the other side sees", "VALIDATION_ERROR")

  const value = String(data.value ?? "")
  if (!value.trim()) throw err("There is nothing to send", "VALIDATION_ERROR")
  if (Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES) {
    throw err(`A credential must be under ${MAX_SECRET_BYTES} bytes. Anything larger is a file, and files go through the document request instead.`, "VALIDATION_ERROR")
  }

  const ttlDays = Number.isFinite(Number(data.ttlDays)) && Number(data.ttlDays) > 0
    ? Math.min(Math.floor(Number(data.ttlDays)), MAX_TTL_DAYS)
    : DEFAULT_TTL_DAYS

  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: { id: true, userId: true, projectName: true },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)

  const { ciphertext, iv, tag } = encrypt(value)

  const row = await prisma.secretHandoff.create({
    data: {
      projectId: project.id,
      direction,
      label: label.slice(0, MAX_LABEL_LENGTH),
      ciphertext,
      iv,
      tag,
      expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      createdById: createdById ? String(createdById) : null,
    },
  })

  // The label only. An event carrying a value would put the credential in
  // the one table designed to be read by both parties and kept forever.
  await projectEvents.record({
    projectId: project.id,
    type: "secret.shared",
    actorRole: direction === "to_client" ? "admin" : "client",
    detail: row.label,
    detailEs: row.label,
    // No `refs`: ProjectEvent has a fixed set of foreign keys (milestone,
    // file, file request, invoice) and anything else passed here is silently
    // dropped. A secret's row is reachable from its own list; inventing a
    // ref that goes nowhere reads like a link and is not one.
  })

  return { secret: serialize(row), project }
}

/* ── reveal ──────────────────────────────────────────────────────────── */

/**
 * Read it, once.
 *
 * @param {string} secretId
 * @param {string} projectId  the caller's project — scoping, not decoration
 * @param {"client"|"admin"} audience  who is asking
 */
async function revealSecret(secretId, projectId, audience) {
  if (!secretId || !projectId) throw err("Secret not found", "NOT_FOUND", 404)

  const row = await prisma.secretHandoff.findUnique({ where: { id: String(secretId) } })
  // "Not on this project", "already read" and "no such id" all answer 404
  // where they can, because a distinguishable answer tells a caller which
  // ids exist. The two states below are the exception: a client who reads a
  // secret twice needs to be told WHY it is gone, or they will assume the
  // system lost it and ask for it again in an email.
  if (!row || row.projectId !== String(projectId)) throw err("Secret not found", "NOT_FOUND", 404)

  // Direction is the access model: whoever wrote it cannot read it back.
  const mayRead = row.direction === "to_client" ? audience === "client" : audience === "admin"
  if (!mayRead) throw err("Secret not found", "NOT_FOUND", 404)

  if (row.viewedAt) {
    throw err("This credential has already been read once and was destroyed. Ask for it to be sent again.", "SECRET_ALREADY_VIEWED", 410)
  }
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    throw err("This credential expired before it was read. Ask for it to be sent again.", "SECRET_EXPIRED", 410)
  }
  if (!row.ciphertext || !row.iv || !row.tag) {
    throw err("This credential is no longer available.", "SECRET_ALREADY_VIEWED", 410)
  }

  // Claim it BEFORE decrypting, conditionally on still being unviewed. Two
  // simultaneous reveals must not both return the value: the loser sees the
  // "already read" answer, which is the honest one.
  const claim = await prisma.secretHandoff.updateMany({
    where: { id: row.id, viewedAt: null },
    data: { viewedAt: new Date(), ciphertext: null, iv: null, tag: null },
  })
  if (claim.count !== 1) {
    throw err("This credential has already been read once and was destroyed. Ask for it to be sent again.", "SECRET_ALREADY_VIEWED", 410)
  }

  let value
  try {
    value = decrypt(row)
  } catch (e) {
    // The ciphertext is already wiped and cannot be recovered. Say so
    // plainly rather than pretending it might work on a retry — the usual
    // cause is a rotated SECRET_HANDOFF_KEY, which is a documented and
    // intended consequence of rotation.
    logger.error(`[secretHandoff] could not decrypt ${row.id}: ${e.message}`)
    throw err("This credential could not be decrypted — the server key changed since it was stored. Ask for it to be sent again.", "SECRET_UNDECRYPTABLE", 410)
  }

  await projectEvents.record({
    projectId: row.projectId,
    type: "secret.viewed",
    actorRole: audience === "client" ? "client" : "admin",
    detail: row.label,
    detailEs: row.label,
  })

  return { label: row.label, value }
}

/* ── list ────────────────────────────────────────────────────────────── */

/**
 * Metadata for one project.
 *
 * `audience` filters to what that side has any business seeing: a client is
 * shown what is waiting FOR them plus what they themselves sent (so they can
 * tell it arrived), and never a value either way.
 */
async function listForProject(projectId, audience = "admin") {
  if (!projectId) return []
  const rows = await prisma.secretHandoff.findMany({
    where: { projectId: String(projectId) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, direction: true, label: true,
      createdAt: true, expiresAt: true, viewedAt: true,
    },
  })
  const now = new Date()
  return rows.map((r) => ({
    ...serialize(r, { now }),
    // Only the recipient gets a reveal affordance. The sender sees the row
    // and its state, which is what they need, and no button.
    isRevealable: serialize(r, { now }).isRevealable
      && (r.direction === "to_client" ? audience === "client" : audience === "admin"),
  }))
}

/**
 * Purge the ciphertext of everything expired.
 *
 * Called from the project purge job. An expired secret is already
 * unreadable through `reveal`, so this is defence in depth: it takes the
 * bytes off the disk rather than relying on a check to keep refusing.
 */
async function purgeExpired({ now = new Date() } = {}) {
  const res = await prisma.secretHandoff.updateMany({
    where: { viewedAt: null, expiresAt: { lte: now }, ciphertext: { not: null } },
    data: { ciphertext: null, iv: null, tag: null },
  })
  if (res.count) logger.info(`[secretHandoff] wiped ${res.count} expired secret${res.count === 1 ? "" : "s"}`)
  return res.count
}

module.exports = {
  DIRECTIONS,
  DEFAULT_TTL_DAYS,
  MAX_TTL_DAYS,
  MAX_SECRET_BYTES,
  isConfigured,
  createSecret,
  revealSecret,
  listForProject,
  purgeExpired,
  serialize,
  // Exported for the tests that prove the ciphertext is really ciphertext.
  _encrypt: encrypt,
  _decrypt: decrypt,
}
