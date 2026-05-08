const prisma = require("../lib/prisma")

/**
 * Generate the next sequential invoice number for the current year.
 *
 * Format: INV-YYYY-NNNNN   (e.g. INV-2026-00001, INV-2026-00002, …)
 *
 * Strategy: query the highest-numbered invoice for the current year, increment
 * by 1, pad to 5 digits. Reaches 99,999 before widening the pad — effectively
 * never in our lifetime.
 *
 * @returns {Promise<string>}
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  // Find the highest-numbered invoice for this year.
  const last = await prisma.invoice.findFirst({
    where:   { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select:  { invoiceNumber: true },
  })

  let next = 1
  if (last?.invoiceNumber) {
    const suffix = last.invoiceNumber.slice(prefix.length)
    const parsed = parseInt(suffix, 10)
    if (Number.isFinite(parsed)) next = parsed + 1
  }

  return `${prefix}${String(next).padStart(5, "0")}`
}

module.exports = generateInvoiceNumber
