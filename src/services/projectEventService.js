/**
 * projectEventService.js · the one place a project event is written (T5-2).
 *
 * Every place the app already changes a project's state also records what
 * happened, in one typed row, through `record()`. One writer means one set of
 * rules about titles, languages and visibility, instead of nineteen call
 * sites each deciding for themselves.
 *
 * THIS IS NOT THE AUDIT TRAIL. `activityLog` stays exactly where it is: it is
 * written for us, it records who did what, and it keeps internal notes. This
 * is the client-facing story of the same events — fewer of them, in the
 * client's language, with nothing internal in it. They are different edits of
 * the same history and both are wanted.
 *
 * VISIBILITY is the load-bearing field:
 *
 *   public  what an anonymous tracking code may see. Deliberately thin:
 *           phase changes and milestone progress, never a file name, never a
 *           comment, never an amount.
 *   client  adds file names, comments and requests, for someone signed in or
 *           holding a portal link.
 *   admin   everything.
 *
 * A row is written once at the highest visibility it may EVER have. Narrowing
 * later is a filter; widening later is a leak, because the row is already out
 * in a response somewhere. When in doubt, write it narrower.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/* ── The closed list ─────────────────────────────────────────────────────
 * Adding a type is a deliberate act: it needs a title in both languages and
 * a default visibility, and the tracking endpoint's contract (ADR 0006) has
 * to be re-read before anything new becomes `public`.
 */
const EVENT_DEFINITIONS = {
  "project.created": {
    title: "Project created", titleEs: "Proyecto creado", visibility: "public",
  },
  "project.started": {
    title: "Work started", titleEs: "Trabajo iniciado", visibility: "public",
  },
  "project.on_hold": {
    title: "Project paused", titleEs: "Proyecto en pausa", visibility: "public",
  },
  "project.resumed": {
    title: "Project resumed", titleEs: "Proyecto reanudado", visibility: "public",
  },
  "project.completed": {
    title: "Project completed", titleEs: "Proyecto completado", visibility: "public",
  },
  "project.handover": {
    title: "Handover", titleEs: "Entrega final", visibility: "public",
  },
  "milestone.started": {
    title: "Milestone started", titleEs: "Etapa iniciada", visibility: "public",
  },
  "milestone.delivered": {
    title: "Milestone delivered for review", titleEs: "Etapa entregada para revisión", visibility: "public",
  },
  "milestone.approved": {
    title: "Milestone approved", titleEs: "Etapa aprobada", visibility: "public",
  },
  "milestone.changes_requested": {
    title: "Changes requested", titleEs: "Cambios solicitados", visibility: "public",
  },
  // T5-12 · public, and deliberately so. A date moving is exactly the kind of
  // thing a client should learn from the tracker rather than discover on the
  // day nothing arrives. It carries only the two dates — no reason, because
  // a reason is a conversation and this is a notice.
  "milestone.rescheduled": {
    title: "Date moved", titleEs: "Fecha movida", visibility: "public",
  },
  // Files and documents name things. A file name can carry a client's own
  // client's name, a case number, a salary band — so nothing here is public.
  "file.requested": {
    title: "Document requested", titleEs: "Documento solicitado", visibility: "client",
  },
  "file.received": {
    title: "Document received", titleEs: "Documento recibido", visibility: "client",
  },
  "file.accepted": {
    title: "Document accepted", titleEs: "Documento aceptado", visibility: "client",
  },
  "file.rejected": {
    title: "Document needs changes", titleEs: "El documento necesita cambios", visibility: "client",
  },
  "file.delivered": {
    title: "Deliverable ready", titleEs: "Entregable listo", visibility: "client",
  },
  "comment.added": {
    title: "New comment", titleEs: "Nuevo comentario", visibility: "client",
  },
  // Money is never public. "invoice.overdue" on a page anyone can open with a
  // shared code would tell a client's own staff, or anyone they forwarded the
  // link to, that they are behind on payment.
  "invoice.issued": {
    title: "Invoice issued", titleEs: "Factura emitida", visibility: "client",
  },
  "invoice.paid": {
    title: "Payment received", titleEs: "Pago recibido", visibility: "client",
  },
  "invoice.overdue": {
    title: "Invoice overdue", titleEs: "Factura vencida", visibility: "client",
  },
}

const PROJECT_EVENT_TYPES = Object.keys(EVENT_DEFINITIONS)
const VISIBILITIES = ["public", "client", "admin"]
const ACTOR_ROLES = ["admin", "client", "system"]

/** Rank so a filter can ask for "this level and narrower". */
const VISIBILITY_RANK = { public: 0, client: 1, admin: 2 }

/**
 * Which visibilities a viewer may see. Public is a subset of client is a
 * subset of admin, so the filter is a threshold rather than a list.
 */
function visibilitiesFor(audience) {
  const ceiling = VISIBILITY_RANK[audience]
  if (ceiling === undefined) return ["public"]
  return VISIBILITIES.filter((v) => VISIBILITY_RANK[v] <= ceiling)
}

/**
 * Record one event.
 *
 * Returns the created row so a caller can hand it straight to a notification
 * without a second read. Never throws: an event is a record of something that
 * has already happened, so failing to write one must not roll back the thing
 * it describes — a milestone approval that 500s because its event row failed
 * is a worse outcome than a gap in the timeline. Failures are logged loudly.
 *
 * @param {object}  input
 * @param {string}  input.projectId
 * @param {string}  input.type          one of PROJECT_EVENT_TYPES
 * @param {string}  input.actorRole     "admin" | "client" | "system"
 * @param {string} [input.visibility]   defaults to the type's own
 * @param {string} [input.detail]       free text shown under the title
 * @param {string} [input.detailEs]
 * @param {string} [input.title]        overrides the dictionary title
 * @param {string} [input.titleEs]
 * @param {object} [input.refs]         { milestoneId, fileId, fileRequestId, invoiceId }
 */
async function record(input = {}) {
  try {
    const { projectId, type, actorRole = "system", refs = {} } = input

    if (!projectId) throw new Error("projectId is required")
    const def = EVENT_DEFINITIONS[type]
    if (!def) throw new Error(`unknown event type "${type}"`)
    if (!ACTOR_ROLES.includes(actorRole)) throw new Error(`unknown actorRole "${actorRole}"`)

    // An explicit visibility may only NARROW the default, never widen it.
    // The dictionary holds the considered answer for each type; the override
    // exists for the occasional row that should be quieter than its type
    // (an internal note on a milestone, say), not for promoting a file event
    // to public by passing a string. Higher rank is narrower, so the rule is
    // simply "take the narrower of the two", and an attempt to widen is
    // logged rather than silently honoured.
    let visibility = def.visibility
    if (input.visibility) {
      if (!VISIBILITIES.includes(input.visibility)) throw new Error(`unknown visibility "${input.visibility}"`)
      if (VISIBILITY_RANK[input.visibility] < VISIBILITY_RANK[def.visibility]) {
        logger.warn?.(`[projectEvent] refused to widen "${type}" from ${def.visibility} to ${input.visibility}`)
      } else {
        visibility = input.visibility
      }
    }

    return await prisma.projectEvent.create({
      data: {
        projectId: String(projectId),
        type,
        title:   input.title   || def.title,
        titleEs: input.titleEs || def.titleEs,
        detail:   input.detail   ? String(input.detail).slice(0, 2000)   : null,
        detailEs: input.detailEs ? String(input.detailEs).slice(0, 2000) : null,
        actorRole,
        visibility,
        milestoneId:   refs.milestoneId   || null,
        fileId:        refs.fileId        || null,
        fileRequestId: refs.fileRequestId || null,
        invoiceId:     refs.invoiceId     || null,
      },
    })
  } catch (err) {
    // Loud, because a silently missing timeline is very hard to notice: the
    // page still renders, it just tells the client less than it should.
    logger.error?.(`[projectEvent] failed to record "${input?.type}" for ${input?.projectId}: ${err.message}`)
    return null
  }
}

/**
 * Events for one project at or below a visibility ceiling, newest first.
 * `audience` is "public" | "client" | "admin".
 */
async function listForProject(projectId, { audience = "public", limit = 100 } = {}) {
  if (!projectId) return []
  return prisma.projectEvent.findMany({
    where: { projectId: String(projectId), visibility: { in: visibilitiesFor(audience) } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, Number(limit) || 100), 200),
  })
}

/** One event as the client sees it, in their language. */
function serializeEvent(event, locale = "en") {
  if (!event) return null
  const es = locale === "es"
  return {
    id: event.id,
    type: event.type,
    title: (es && event.titleEs) || event.title,
    detail: (es && event.detailEs) || event.detail || null,
    createdAt: event.createdAt?.toISOString?.() || event.createdAt,
  }
}

/**
 * The public projection: type, title and timestamp only.
 *
 * Deliberately narrower than serializeEvent even though only public rows
 * reach it — `detail` is free text written by whoever recorded the event, and
 * the anonymous surface must not depend on every future caller having been
 * careful about what they put in it. See ADR 0006.
 */
function serializePublicEvent(event, locale = "en") {
  if (!event) return null
  const es = locale === "es"
  return {
    type: event.type,
    title: (es && event.titleEs) || event.title,
    createdAt: event.createdAt?.toISOString?.() || event.createdAt,
  }
}

module.exports = {
  EVENT_DEFINITIONS,
  PROJECT_EVENT_TYPES,
  VISIBILITIES,
  ACTOR_ROLES,
  visibilitiesFor,
  record,
  listForProject,
  serializeEvent,
  serializePublicEvent,
}
