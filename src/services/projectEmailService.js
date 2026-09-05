/**
 * projectEmailService.js · the project emails, and the code on all of them (T5-6).
 *
 * Seven templates share one shape: they are about a project, they go to the
 * person who owns it (or, for one of them, to the operator), and every one
 * carries the tracking code in its eyebrow the way a carrier repeats the
 * waybill number. This file is that shape.
 *
 * WHY IT IS ONE FILE
 *
 * The templates are seeded DB rows, so an unresolved {{placeholder}} does not
 * throw — it renders literally in somebody's inbox. Six call sites each
 * assembling their own variable bag is six chances to forget one. Here the
 * bag is built once, every value is coerced to a string, and a missing
 * tracking code refuses the send rather than mailing "{{trackingCode}}".
 *
 * Nothing here throws. An email is a notification about something that has
 * already happened; failing to send one must not roll back the thing it
 * describes.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { sendTemplateEmail } = require("./emailService")
const projectEvents = require("./projectEventService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

/** Every key this file may send. Anything else is a typo. */
const PROJECT_TEMPLATES = [
  "project.tracking-code",
  "project.file-requested",
  "project.file-reminder",
  "project.file-accepted",
  "project.file-rejected",
  "project.file-received",
  "project.status-update",
  "project.weekly-digest",
]

function frontendBase() {
  return String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

/** The three links every one of these emails might carry. */
function urlsFor(project, { requestId = null } = {}) {
  const base = frontendBase()
  const projectUrl = `${base}/dashboard/projects/${project.id}`
  return {
    trackUrl: project.trackingCode ? `${base}/track/${project.trackingCode}` : `${base}/track`,
    trackUrlLabel: `${base.replace(/^https?:\/\//, "")}/track`,
    dashboardUrl: projectUrl,
    projectUrl,
    // The row the client has to act on, highlighted on arrival by
    // FileRequestPanel (T5-5). Without the query they land on a page with
    // eight rows and have to work out which one the email meant.
    requestUrl: requestId ? `${projectUrl}?request=${encodeURIComponent(requestId)}` : projectUrl,
    adminUrl: `${base}/admin/client-projects/${project.id}`,
  }
}

/**
 * Send one project email.
 *
 * @param {object}  input
 * @param {object}  input.project      needs at least { id, trackingCode }
 * @param {string}  input.templateKey  one of PROJECT_TEMPLATES
 * @param {string}  input.to           recipient address
 * @param {"en"|"es"} input.locale
 * @param {object}  input.variables    template-specific values
 * @param {string} [input.userId]      for the email log
 * @param {string} [input.requestId]   builds requestUrl
 * @returns {Promise<boolean>} whether it was handed to the transport
 */
async function send({ project, templateKey, to, locale = "es", variables = {}, userId, requestId }) {
  if (!to) return false
  if (!PROJECT_TEMPLATES.includes(templateKey)) {
    logger.error(`[projectEmail] unknown template "${templateKey}"`)
    return false
  }
  // A project created before T5-1 has no code until the backfill runs. Rather
  // than mail a literal "{{trackingCode}}", skip and say so — the in-app
  // notification still fires, and the operator gets a line naming the fix.
  if (!project?.trackingCode) {
    logger.warn(`[projectEmail] ${templateKey} skipped: project ${project?.id} has no tracking code (run scripts/backfill-tracking-codes.js)`)
    return false
  }

  const base = {
    trackingCode: project.trackingCode,
    projectName: project.projectName || "your project",
    ...urlsFor(project, { requestId }),
  }

  // Every value a string: a null reaching the template renderer is the same
  // literal-placeholder problem by another route.
  const merged = {}
  for (const [key, value] of Object.entries({ ...base, ...variables })) {
    merged[key] = value == null ? "" : String(value)
  }

  try {
    // sendTemplateEmail RESOLVES with { ok, error } rather than rejecting, so
    // a missing or inactive template row is a false here, not a throw. Both
    // paths are covered because a transport failure does still throw.
    const result = await sendTemplateEmail({ to, templateKey, locale, userId, variables: merged })
    if (!result?.ok) {
      logger.error(`[projectEmail] ${templateKey} not sent: ${result?.error || "unknown"}`)
      return false
    }
    return true
  } catch (err) {
    logger.error(`[projectEmail] ${templateKey} failed: ${err.message}`)
    return false
  }
}

/* ── recipients ──────────────────────────────────────────────────────── */

/** The client's address and preferred language, in one read. */
async function clientFor(userId) {
  if (!userId) return null
  try {
    return await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, email: true, fullName: true },
    })
  } catch (err) {
    logger.error(`[projectEmail] recipient lookup failed: ${err.message}`)
    return null
  }
}

/**
 * Where project.file-received goes.
 *
 * The assigned admin if there is one, otherwise the support address. Not
 * every admin: this fires on every client upload, and a fan-out would train
 * the whole team to filter it away.
 */
async function operatorFor(project) {
  if (project?.assignedAdminId) {
    const admin = await clientFor(project.assignedAdminId)
    if (admin?.email) return admin.email
  }
  return process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || null
}


/* ── one wrapper per template ─────────────────────────────────────────
 *
 * Each is the only place its template's variables are assembled. The prose
 * fragments (dueLine, acceptLine, remainingLine…) are built here rather than
 * conditionally composed in the template, because a seeded HTML row has no
 * conditionals — the choice is between a fragment and an empty string, and
 * that choice belongs in code where it can be read.
 */

const ES = (locale) => String(locale || "").startsWith("es")

/** The client's locale, from their profile. Spanish-first, like everywhere. */
function localeFor(user, fallback) {
  if (fallback) return fallback
  return resolveUserLocale({ user })
}

function fmtDate(value, locale) {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  // timeZone UTC, deliberately. A due date is a DAY, and it is stored as
  // midnight UTC on that day — rendering it in the server's zone turned
  // "20 September" into "September 19" for a Mexico City reader, which is a
  // deadline moved by a formatting choice.
  return d.toLocaleDateString(ES(locale) ? "es-MX" : "en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  })
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * The request's title and instructions in the client's language.
 *
 * Both fall back to English, which is what the serializer does and what the
 * admin form's optional Spanish fields imply.
 */
function requestText(request, locale) {
  const es = ES(locale)
  return {
    title: (es && request.titleEs) || request.title,
    instructions: (es && request.instructionsEs) || request.instructions || "",
  }
}

/** T5-6a · the code, once, when the project is created. */
async function sendTrackingCodeEmail(userId, project, { locale } = {}) {
  const user = await clientFor(userId)
  if (!user?.email) return false
  return send({
    project,
    templateKey: "project.tracking-code",
    to: user.email,
    userId,
    locale: localeFor(user, locale),
  })
}

/** T5-6b · we need a document. */
async function sendFileRequested({ project, request, locale }) {
  const user = await clientFor(project.userId)
  if (!user?.email) return false
  const lc = localeFor(user, locale)
  const es = ES(lc)
  const { title, instructions } = requestText(request, lc)
  const due = fmtDate(request.dueAt, lc)

  return send({
    project,
    templateKey: "project.file-requested",
    to: user.email,
    userId: project.userId,
    locale: lc,
    requestId: request.id,
    variables: {
      requestTitle: title,
      // *Html: the renderer escapes every variable that is NOT named with
      // that suffix, which is why these carry markup and the plain ones do
      // not. Anything interpolated INTO one is escaped here instead.
      instructionsHtml: instructions ? `<br><span style="font-weight:400">${escapeHtml(instructions)}</span>` : "",
      instructionsText: instructions,
      dueLineHtml: due ? (es ? `Lo necesitamos para el <strong>${due}</strong>. ` : `We need it by <strong>${due}</strong>. `) : "",
      dueText: due ? (es ? `Para el ${due}.` : `Due ${due}.`) : "",
      acceptLineHtml: request.acceptExt
        ? (es ? `Formatos aceptados: ${escapeHtml(request.acceptExt)}.` : `Accepted formats: ${escapeHtml(request.acceptExt)}.`)
        : "",
      acceptText: request.acceptExt ? (es ? `Formatos: ${request.acceptExt}` : `Formats: ${request.acceptExt}`) : "",
    },
  })
}

/** T5-6c · the nudge. Sent by fileRequestReminderJob, never by a controller. */
async function sendFileReminder({ project, request, overdue = false, locale }) {
  const user = await clientFor(project.userId)
  if (!user?.email) return false
  const lc = localeFor(user, locale)
  const es = ES(lc)
  const { title, instructions } = requestText(request, lc)
  const due = fmtDate(request.dueAt, lc)

  return send({
    project,
    templateKey: "project.file-reminder",
    to: user.email,
    userId: project.userId,
    locale: lc,
    requestId: request.id,
    variables: {
      requestTitle: title,
      instructionsHtml: instructions ? `<br><span style="font-weight:400">${escapeHtml(instructions)}</span>` : "",
      // Overdue and due-soon are the same email with a different opening
      // line. A separate template would be two things to keep in step for
      // one adjective.
      reminderSubjectLead: overdue
        ? (es ? "Sigue pendiente" : "Still outstanding")
        : (es ? "Vence pronto" : "Due soon"),
      reminderHeading: overdue
        ? (es ? "Este documento ya venció" : "This document is overdue")
        : (es ? "Este documento vence pronto" : "This document is due soon"),
      dueLineHtml: due
        ? (overdue
          ? (es ? `Su fecha era el <strong>${due}</strong>. ` : `It was due on <strong>${due}</strong>. `)
          : (es ? `Vence el <strong>${due}</strong>. ` : `It is due on <strong>${due}</strong>. `))
        : "",
      dueText: due ? (es ? `Fecha: ${due}` : `Due: ${due}`) : "",
    },
  })
}

/**
 * T5-6d/e · accepted or sent back.
 *
 * Cancelled deliberately sends nothing: "we no longer need the thing we
 * asked you for" is worth a notification badge and not worth an email.
 */
async function sendFileReviewed({ project, request, locale }) {
  if (!["accepted", "rejected"].includes(request?.status)) return false
  const user = await clientFor(project.userId)
  if (!user?.email) return false
  const lc = localeFor(user, locale)
  const es = ES(lc)
  const { title } = requestText(request, lc)

  if (request.status === "rejected") {
    return send({
      project,
      templateKey: "project.file-rejected",
      to: user.email,
      userId: project.userId,
      locale: lc,
      requestId: request.id,
      variables: {
        requestTitle: title,
        // The note is the entire point of this email. reviewRequest refuses a
        // rejection without one, so this fallback should never render.
        // NOT escaped here: the renderer escapes every non-*Html variable,
        // and doing it twice ships "&amp;lt;" to the reader.
        reviewNote: request.reviewNote || (es ? "Escríbenos y te explicamos." : "Reply and we will explain."),
      },
    })
  }

  // How many are still open, so the client knows whether they are done.
  let remaining = 0
  try {
    remaining = await prisma.projectFileRequest.count({
      where: { projectId: project.id, status: { in: ["requested", "rejected"] } },
    })
  } catch { /* a count is a nicety; the email is not worth losing over it */ }

  const remainingLine = remaining > 0
    ? (es
      ? `Todavía esperamos ${remaining} documento${remaining === 1 ? "" : "s"} más de tu parte.`
      : `We are still waiting on ${remaining} more document${remaining === 1 ? "" : "s"} from you.`)
    : (es
      ? "No esperamos nada más de tu parte por ahora."
      : "We are not waiting on anything else from you right now.")

  return send({
    project,
    templateKey: "project.file-accepted",
    to: user.email,
    userId: project.userId,
    locale: lc,
    variables: { requestTitle: title, remainingLine, remainingText: remainingLine },
  })
}

/** T5-6f · to the operator. The only one of the seven that names a file. */
async function sendFileReceived({ project, request, file, client }) {
  const to = await operatorFor(project)
  if (!to) return false
  // Callers on the upload path have the uploader's id and nothing else.
  // "A client uploaded a file" is a worse operator email than the name.
  const named = client?.fullName || client?.email ? client : await clientFor(client?.id || project.userId)
  return send({
    project,
    templateKey: "project.file-received",
    to,
    // English: the operator surfaces are English-only.
    locale: "en",
    requestId: request?.id,
    variables: {
      requestTitle: request?.title || "a document",
      clientName: named?.fullName || named?.email || "A client",
      fileName: file?.fileName || "a file",
    },
  })
}

/**
 * T5-15 · the Monday digest.
 *
 * Takes the digest weeklyDigestJob already built — the decision about
 * WHETHER to send lives there, so this only has to render one.
 */
/**
 * T5-17 · everyone on the project, not just the account it was sold to.
 *
 * The digest is the ONE email that fans out. Every other project email fires
 * on an event, and multiplying those by the number of contacts is how a
 * project starts producing ten emails a day — which is how people stop
 * reading any of them. A weekly summary is exactly the shape that survives
 * being sent to three people.
 */
async function sendWeeklyDigest(args) {
  const { project } = args
  let recipients = []
  try {
    recipients = await require("./projectMemberService").recipientsFor(project.id)
  } catch (_) { recipients = [] }

  if (!recipients.length) {
    const owner = await clientFor(project.userId)
    if (!owner?.email) return false
    recipients = [{ userId: owner.id, email: owner.email, name: owner.fullName, role: "owner" }]
  }

  // One send per recipient, and the OWNER's result is the return value: the
  // job counts a digest as sent when the person who is billed for the work
  // received it. A member's bounce is logged, not fatal.
  let ownerResult = false
  for (const to of recipients) {
    const ok = await sendWeeklyDigestTo(args, to).catch((e) => {
      logger.warn(`[projectEmail] digest to ${to.role} failed: ${e.message}`)
      return false
    })
    if (to.role === "owner") ownerResult = ok
  }
  return ownerResult
}

async function sendWeeklyDigestTo({ project, events, moreEvents = 0, openRequests = [], billing }, recipient) {
  const user = recipient?.email
    ? { id: recipient.userId, email: recipient.email, fullName: recipient.name }
    : await clientFor(project.userId)
  if (!user?.email) return false
  const lc = localeFor(user)
  const es = ES(lc)

  const lines = (events || []).map((e) => {
    const serialized = projectEvents.serializeEvent(e, es ? "es" : "en")
    return { title: serialized.title, date: fmtDate(serialized.createdAt, lc) }
  })

  // The summary line does the work of the subject: a reader who opens this
  // on a phone should know within one sentence whether it needs them.
  const moved = lines.length
  const summaryLine = moved
    ? (es
      ? `${moved} ${moved === 1 ? "cosa avanzó" : "cosas avanzaron"} esta semana.`
      : `${moved} thing${moved === 1 ? "" : "s"} moved this week.`)
    : (es
      ? "Nada avanzó esta semana de nuestro lado."
      : "Nothing moved on our side this week.")

  const owed = (openRequests || []).length
  const unpaid = billing?.unpaidCount || 0
  const waiting = []
  if (owed) {
    waiting.push(es
      ? `Seguimos esperando ${owed} documento${owed === 1 ? "" : "s"} de tu parte.`
      : `We are still waiting on ${owed} document${owed === 1 ? "" : "s"} from you.`)
  }
  if (unpaid) {
    waiting.push(es
      ? `Hay ${unpaid} factura${unpaid === 1 ? "" : "s"} pendiente${unpaid === 1 ? "" : "s"}.`
      : `${unpaid} invoice${unpaid === 1 ? " is" : "s are"} outstanding.`)
  }
  const waitingLine = waiting.length
    ? waiting.join(" ")
    : (es ? "No necesitamos nada de tu parte ahora mismo." : "We do not need anything from you right now.")

  const base = frontendBase()
  return send({
    project,
    templateKey: "project.weekly-digest",
    to: user.email,
    // The OWNER's id on every copy: EmailLog and the suppression list are
    // keyed by account, a member may not have one, and attributing a
    // member's copy to a null user would make it unloggable.
    userId: project.userId,
    locale: lc,
    variables: {
      summaryLine,
      waitingLine,
      // *Html because it carries markup; anything interpolated in is escaped.
      eventsHtml: lines.length
        ? lines.map((l) => `${escapeHtml(l.title)}${l.date ? ` · <span style="font-weight:400">${l.date}</span>` : ""}`).join("<br>")
          + (moreEvents ? `<br><span style="font-weight:400">${es ? `y ${moreEvents} más` : `and ${moreEvents} more`}</span>` : "")
        : (es ? "Sin actividad esta semana." : "No activity this week."),
      eventsText: lines.length
        ? lines.map((l) => `  · ${l.title}${l.date ? ` (${l.date})` : ""}`).join("\n")
        : (es ? "  · Sin actividad esta semana." : "  · No activity this week."),
      // A token would be one more credential to mint and expire. The project
      // id is enough: the link only ever turns a digest OFF, and the worst a
      // stranger with it can do is stop an email they were not receiving.
      optOutUrl: `${base}/api/v1/track/${project.trackingCode}/digest-opt-out`,
    },
  })
}

/** T5-6g · the phase changed, with the last three events. */
async function sendStatusUpdate({ project, status, locale }) {
  const user = await clientFor(project.userId)
  if (!user?.email) return false
  const lc = localeFor(user, locale)
  const es = ES(lc)

  // Each label carries its own preposition, so the sentence around it is
  // "is now {{statusLabel}}" / "ahora está {{statusLabel}}" and reads right
  // for all five. Composing "en " in the template gave "en en revisión".
  const LABELS = {
    en: { planning: "in planning", in_progress: "in progress", review: "in review", completed: "complete", cancelled: "cancelled" },
    es: { planning: "en planeación", in_progress: "en curso", review: "en revisión", completed: "completado", cancelled: "cancelado" },
  }
  const statusLabel = LABELS[es ? "es" : "en"][status]
  if (!statusLabel) return false

  // The last three the CLIENT may see. Asking for the admin ceiling here
  // would put operator notes in a client's inbox.
  let events = []
  try {
    events = await projectEvents.listForProject(project.id, { audience: "client", limit: 3 })
  } catch { /* the email still says what phase it is */ }

  const lines = events.map((e) => {
    const serialized = projectEvents.serializeEvent(e, es ? "es" : "en")
    return { title: serialized.title, date: fmtDate(serialized.createdAt, lc) }
  })

  let outstanding = 0
  try {
    outstanding = await prisma.projectFileRequest.count({
      where: { projectId: project.id, status: { in: ["requested", "rejected"] } },
    })
  } catch { /* as above */ }

  const one = outstanding === 1
  const outstandingLine = outstanding > 0
    ? (es
      ? `Seguimos esperando ${outstanding} documento${one ? "" : "s"} de tu parte — ${one ? "súbelo" : "súbelos"} desde tu panel para que no se detenga el trabajo.`
      : `We are still waiting on ${outstanding} document${one ? "" : "s"} from you — upload ${one ? "it" : "them"} from your dashboard so nothing stalls.`)
    : (es
      ? "No necesitamos nada de tu parte en este momento."
      : "We do not need anything from you right now.")

  return send({
    project,
    templateKey: "project.status-update",
    to: user.email,
    userId: project.userId,
    locale: lc,
    variables: {
      statusLabel,
      recentEventsHtml: lines.length
        ? lines.map((l) => `${escapeHtml(l.title)}${l.date ? ` · <span style="font-weight:400">${l.date}</span>` : ""}`).join("<br>")
        : (es ? "Sin actividad registrada todavía." : "No activity recorded yet."),
      recentEventsText: lines.length
        ? lines.map((l) => `  · ${l.title}${l.date ? ` (${l.date})` : ""}`).join("\n")
        : (es ? "  · Sin actividad registrada todavía." : "  · No activity recorded yet."),
      outstandingLine,
      outstandingText: outstandingLine,
    },
  })
}

module.exports = {
  PROJECT_TEMPLATES,
  send,
  clientFor,
  operatorFor,
  urlsFor,
  sendTrackingCodeEmail,
  sendFileRequested,
  sendFileReminder,
  sendFileReviewed,
  sendFileReceived,
  sendStatusUpdate,
  sendWeeklyDigest,
}
