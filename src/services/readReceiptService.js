const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectEvents = require("./projectEventService")

/**
 * readReceiptService.js · did the client actually open it? (T5-14)
 *
 * A deliverable that was sent and a deliverable that was read are different
 * facts, and the operator currently cannot tell them apart. "Did they even
 * see the bill" is what decides whether the next message is a reminder or a
 * phone call.
 *
 * TWO RULES, AND BOTH ARE ABOUT WHO
 *
 * 1. Only a CLIENT view is stamped. An admin opening the file they uploaded
 *    an hour ago would otherwise make every receipt a lie about the person
 *    it names — and a lie in the direction that stops the operator chasing.
 *
 * 2. The receipt is ADMIN-VISIBLE only. An operator knowing whether the
 *    deliverable was looked at is the difference between chasing and
 *    waiting. A client being shown "you opened this on Tuesday" is being
 *    watched, and the two are not the same feature.
 *
 * Nothing here throws. A receipt is a note in the margin; failing to write
 * one must never stop a client downloading a file they are entitled to.
 */

/** The download actions that represent a client — everything else is us. */
const CLIENT_ACTIONS = new Set([
  "project.file.downloaded",
  "project.file.downloaded.portal",
])

function isClientView(action) {
  return CLIENT_ACTIONS.has(String(action || ""))
}

/**
 * Stamp a file as seen.
 *
 * `firstViewedAt` is written once and never moved: the first time is the
 * interesting one, and overwriting it would turn "they saw it three weeks
 * ago and did nothing" into "they saw it just now". `viewCount` carries the
 * repetition instead.
 *
 * @param {object} file  the row already loaded by the caller's auth check
 * @param {string} action  the audit action the caller is logging
 */
async function recordFileView(file, action) {
  if (!file?.id || !isClientView(action)) return null
  try {
    const updated = await prisma.projectFile.update({
      where: { id: file.id },
      data: {
        viewCount: { increment: 1 },
        // Only when it is still null. Prisma has no conditional set, so the
        // read the caller already did is what decides.
        ...(file.firstViewedAt ? {} : { firstViewedAt: new Date() }),
      },
      select: { id: true, firstViewedAt: true, viewCount: true },
    })

    // One event, on the FIRST view only. A client who opens a deliverable
    // eleven times has told the operator one thing, not eleven, and eleven
    // rows would bury the timeline it sits in.
    if (!file.firstViewedAt && file.projectId) {
      await projectEvents.record({
        projectId: file.projectId,
        type: "file.viewed",
        actorRole: "client",
        detail: file.fileName || "a file",
        detailEs: file.fileName || "un archivo",
        refs: { fileId: file.id },
      })
    }
    return updated
  } catch (err) {
    logger.warn?.(`[readReceipt] file ${file.id}: ${err.message}`)
    return null
  }
}

/**
 * Stamp an invoice as seen. Same rules, same reasons.
 *
 * @param {object} invoice  the row the caller's auth check already loaded
 * @param {string} [projectId]  for the event, when the caller knows it
 */
async function recordInvoiceView(invoice, { projectId = null } = {}) {
  if (!invoice?.id) return null
  try {
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        viewCount: { increment: 1 },
        ...(invoice.firstViewedAt ? {} : { firstViewedAt: new Date() }),
      },
      select: { id: true, firstViewedAt: true, viewCount: true },
    })

    if (!invoice.firstViewedAt && projectId) {
      await projectEvents.record({
        projectId,
        type: "invoice.viewed",
        actorRole: "client",
        detail: invoice.invoiceNumber || "an invoice",
        detailEs: invoice.invoiceNumber || "una factura",
        refs: { invoiceId: invoice.id },
      })
    }
    return updated
  } catch (err) {
    logger.warn?.(`[readReceipt] invoice ${invoice.id}: ${err.message}`)
    return null
  }
}

module.exports = { CLIENT_ACTIONS, isClientView, recordFileView, recordInvoiceView }
