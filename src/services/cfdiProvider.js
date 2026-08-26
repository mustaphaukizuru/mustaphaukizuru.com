/**
 * cfdiProvider — seam for CFDI 4.0 stamping (timbrado) through a PAC.
 *
 * Deliberately a no-op today. The money model now carries everything a PAC
 * needs (issuer env vars, Order.billing* receiver snapshot, IVA breakdown,
 * SAT product/unit codes, Invoice.cfdi* columns), but real stamping requires
 * a CSD certificate + a provider account (Facturapi / gigstack), which are
 * operator-owned. When they exist, implement `stampInvoice` here and nothing
 * else in invoiceService has to change.
 *
 * Contract:
 *   isConfigured()                → boolean
 *   buildReceptor(order)          → CFDI 4.0 Receptor node from the snapshot
 *   buildConceptos(order, items)  → Conceptos with ClaveProdServ/ClaveUnidad
 *   stampInvoice({ invoice, order }) → { uuid, xmlUrl, stampedAt } | null
 */
const { SAT_DEFAULTS } = require("../lib/fiscal")
const { orderTaxBreakdown } = require("../lib/tax")

function isConfigured() {
  return Boolean(process.env.CFDI_PROVIDER && process.env.CFDI_API_KEY)
}

function buildReceptor(order) {
  const isGeneric = !order.billingTaxId
  return {
    Rfc:                      order.billingTaxId || "XAXX010101000",
    Nombre:                   order.billingLegalName || (isGeneric ? "PUBLICO EN GENERAL" : String(order.customerName || "").toUpperCase()),
    DomicilioFiscalReceptor:  order.billingFiscalPostalCode || order.billingPostalCode || process.env.INVOICE_POSTAL_CODE || null,
    RegimenFiscalReceptor:    order.billingRegimenFiscal || "616",
    UsoCFDI:                  order.billingUsoCfdi || "S01",
  }
}

function buildConceptos(order, items = order.items || []) {
  const { rate } = orderTaxBreakdown(order)
  return items.map((item) => {
    const kind = item.itemType === "service" ? "service" : "product"
    const ref  = item.service || item.product || {}
    const gross = Number(item.lineTotal || 0)
    const exempt = Boolean(ref.taxExempt)
    const net = exempt || rate === 0 ? gross : Number((gross / (1 + rate)).toFixed(2))
    return {
      ClaveProdServ: ref.satProductCode || SAT_DEFAULTS[kind].productCode,
      ClaveUnidad:   ref.satUnitCode    || SAT_DEFAULTS[kind].unitCode,
      Cantidad:      Number(item.quantity || 1),
      Descripcion:   item.titleSnapshot || item.title,
      ValorUnitario: Number((net / Number(item.quantity || 1)).toFixed(2)),
      Importe:       net,
      ObjetoImp:     exempt ? "01" : "02",
      Impuestos:     exempt ? undefined : { Traslados: [{ Base: net, Impuesto: "002", TipoFactor: "Tasa", TasaOCuota: rate.toFixed(6), Importe: Number((gross - net).toFixed(2)) }] },
    }
  })
}

async function stampInvoice() {
  // Not wired: see file header. Returning null keeps the invoice a plain
  // comprobante and lets ensureInvoice proceed unchanged.
  return null
}

module.exports = { isConfigured, buildReceptor, buildConceptos, stampInvoice }
