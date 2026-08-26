/**
 * SAT catalog subsets shown in fiscal selects. Mirror of src/lib/fiscal.js —
 * the API is the validator; this is only what the customer can pick from.
 */
export const REGIMEN_FISCAL = [
  ["601", "General de Ley Personas Morales"],
  ["603", "Personas Morales con Fines no Lucrativos"],
  ["605", "Sueldos y Salarios e Ingresos Asimilados a Salarios"],
  ["606", "Arrendamiento"],
  ["608", "Demás ingresos"],
  ["610", "Residentes en el Extranjero sin Establecimiento Permanente en México"],
  ["611", "Ingresos por Dividendos (socios y accionistas)"],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales"],
  ["614", "Ingresos por intereses"],
  ["616", "Sin obligaciones fiscales"],
  ["620", "Sociedades Cooperativas de Producción"],
  ["621", "Incorporación Fiscal"],
  ["622", "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras"],
  ["623", "Opcional para Grupos de Sociedades"],
  ["624", "Coordinados"],
  ["625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas"],
  ["626", "Régimen Simplificado de Confianza"],
]

export const USO_CFDI = [
  ["G03", "Gastos en general"],
  ["G01", "Adquisición de mercancías"],
  ["I04", "Equipo de cómputo y accesorios"],
  ["I08", "Otra maquinaria y equipo"],
  ["D10", "Pagos por servicios educativos (colegiaturas)"],
  ["S01", "Sin efectos fiscales"],
  ["CP01", "Pagos"],
]

export const RFC_RE = /^([A-ZÑ&]{3,4})\d{6}[A-Z\d]{2}[A\d]$/
export const isRfcShaped = (v) => RFC_RE.test(String(v || "").trim().toUpperCase()) || /^X[AE]XX010101000$/.test(String(v || "").trim().toUpperCase())
