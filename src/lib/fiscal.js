/**
 * lib/fiscal — Mexican fiscal identifiers (SAT / CFDI 4.0 receiver data).
 *
 * Validation only; no PAC integration lives here. Everything a CFDI 4.0
 * "Receptor" node needs from the customer is captured and validated so a
 * future timbrado adapter reads clean data:
 *   Rfc, Nombre (razón social, uppercase, no legal-form suffix),
 *   DomicilioFiscalReceptor (postal code), RegimenFiscalReceptor, UsoCFDI.
 *
 * Catalog subsets below are the codes a services/digital-goods seller
 * actually meets. Anything else is rejected with a clear message rather
 * than silently stored — the SAT rejects unknown codes at stamping time,
 * which is the worst moment to find out.
 */

// Persona física: 4 letters + 6 digits + 3 homoclave; persona moral: 3 letters.
const RFC_RE = /^([A-ZÑ&]{3,4})(\d{2})(\d{2})(\d{2})([A-Z\d]{2})([A\d])$/
const RFC_GENERIC = new Set(["XAXX010101000", "XEXX010101000"]) // público en general / extranjero

const REGIMEN_FISCAL = Object.freeze({
  "601": "General de Ley Personas Morales",
  "603": "Personas Morales con Fines no Lucrativos",
  "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
  "606": "Arrendamiento",
  "608": "Demás ingresos",
  "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
  "611": "Ingresos por Dividendos (socios y accionistas)",
  "612": "Personas Físicas con Actividades Empresariales y Profesionales",
  "614": "Ingresos por intereses",
  "616": "Sin obligaciones fiscales",
  "620": "Sociedades Cooperativas de Producción",
  "621": "Incorporación Fiscal",
  "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
  "623": "Opcional para Grupos de Sociedades",
  "624": "Coordinados",
  "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
  "626": "Régimen Simplificado de Confianza",
})

const USO_CFDI = Object.freeze({
  G01: "Adquisición de mercancías",
  G03: "Gastos en general",
  I04: "Equipo de cómputo y accesorios",
  I08: "Otra maquinaria y equipo",
  D10: "Pagos por servicios educativos (colegiaturas)",
  S01: "Sin efectos fiscales",
  CP01: "Pagos",
})

/** SAT c_ClaveProdServ / c_ClaveUnidad defaults for what this business sells. */
const SAT_DEFAULTS = Object.freeze({
  service: { productCode: "81111600", unitCode: "E48" }, // Servicios de programación / Unidad de servicio
  product: { productCode: "43232400", unitCode: "E48" }, // Software de aplicaciones para el desarrollo — verify per product
})

function normalizeRfc(v) {
  return String(v || "").trim().toUpperCase().replace(/[\s-]/g, "")
}

/** @returns {{ ok:true, rfc:string, kind:"fisica"|"moral"|"generic" } | { ok:false, message:string }} */
function validateRfc(value) {
  const rfc = normalizeRfc(value)
  if (!rfc) return { ok: false, message: "RFC is required" }
  if (RFC_GENERIC.has(rfc)) return { ok: true, rfc, kind: "generic" }
  const m = RFC_RE.exec(rfc)
  if (!m) return { ok: false, message: "RFC must be 12 (persona moral) or 13 (persona física) characters, e.g. GODE561231GR8" }
  const [, letters, yy, mm, dd] = m
  const month = Number(mm), day = Number(dd)
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, message: "RFC date segment (YYMMDD) is not a valid date" }
  }
  void yy
  return { ok: true, rfc, kind: letters.length === 4 ? "fisica" : "moral" }
}

function isValidRegimen(code) { return Object.prototype.hasOwnProperty.call(REGIMEN_FISCAL, String(code || "")) }
function isValidUsoCfdi(code) { return Object.prototype.hasOwnProperty.call(USO_CFDI, String(code || "").toUpperCase()) }
function isValidMxPostalCode(v) { return /^\d{5}$/.test(String(v || "").trim()) }

/**
 * Validate + normalise the fiscal block of an address / checkout payload.
 * All fields optional; any provided field must be valid. `country` decides
 * whether the RFC rules apply (non-MX tax IDs are free text).
 *
 * @returns {{ ok:true, data:object } | { ok:false, message:string }}
 */
function normalizeFiscal(input = {}, { country } = {}) {
  const out = {}
  const isMx = String(country || "MX").toUpperCase() === "MX"

  if (input.taxId !== undefined && input.taxId !== null && String(input.taxId).trim() !== "") {
    if (isMx) {
      const r = validateRfc(input.taxId)
      if (!r.ok) return r
      out.taxId = r.rfc
    } else {
      out.taxId = String(input.taxId).trim().slice(0, 40)
    }
  }
  if (input.legalName !== undefined && input.legalName !== null && String(input.legalName).trim() !== "") {
    // CFDI 4.0: Nombre must match the Constancia — uppercase, no S.A. DE C.V. suffix.
    out.legalName = String(input.legalName).trim().toUpperCase().slice(0, 254)
  }
  if (input.regimenFiscal !== undefined && input.regimenFiscal !== null && String(input.regimenFiscal).trim() !== "") {
    const code = String(input.regimenFiscal).trim()
    if (!isValidRegimen(code)) return { ok: false, message: `Unknown régimen fiscal "${code}"` }
    out.regimenFiscal = code
  }
  if (input.usoCfdi !== undefined && input.usoCfdi !== null && String(input.usoCfdi).trim() !== "") {
    const code = String(input.usoCfdi).trim().toUpperCase()
    if (!isValidUsoCfdi(code)) return { ok: false, message: `Unknown uso CFDI "${code}"` }
    out.usoCfdi = code
  }
  if (input.fiscalPostalCode !== undefined && input.fiscalPostalCode !== null && String(input.fiscalPostalCode).trim() !== "") {
    const pc = String(input.fiscalPostalCode).trim()
    if (isMx && !isValidMxPostalCode(pc)) return { ok: false, message: "Fiscal postal code must be 5 digits" }
    out.fiscalPostalCode = pc.slice(0, 12)
  }
  return { ok: true, data: out }
}

module.exports = {
  RFC_RE, REGIMEN_FISCAL, USO_CFDI, SAT_DEFAULTS,
  normalizeRfc, validateRfc, isValidRegimen, isValidUsoCfdi, isValidMxPostalCode, normalizeFiscal,
}
