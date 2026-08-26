/**
 * lib/fiscal — RFC / régimen / uso CFDI validation for CFDI 4.0 receiver data.
 */
const { validateRfc, normalizeFiscal, isValidRegimen, isValidUsoCfdi } = require("../src/lib/fiscal")

describe("validateRfc", () => {
  test("accepts a persona física RFC (13 chars) and normalises case/spaces", () => {
    expect(validateRfc(" gode561231gr8 ")).toEqual({ ok: true, rfc: "GODE561231GR8", kind: "fisica" })
  })
  test("accepts a persona moral RFC (12 chars)", () => {
    expect(validateRfc("ABC010101AB1")).toEqual({ ok: true, rfc: "ABC010101AB1", kind: "moral" })
  })
  test("accepts the generic público-en-general RFC", () => {
    expect(validateRfc("XAXX010101000")).toEqual({ ok: true, rfc: "XAXX010101000", kind: "generic" })
  })
  test("rejects wrong length and bad date segments", () => {
    expect(validateRfc("GODE56123")).toMatchObject({ ok: false })
    expect(validateRfc("GODE561331GR8")).toMatchObject({ ok: false }) // month 13
  })
  test("rejects empty", () => { expect(validateRfc("")).toMatchObject({ ok: false }) })
})

describe("normalizeFiscal", () => {
  test("MX: validates RFC, uppercases razón social, checks catalog codes and CP", () => {
    const r = normalizeFiscal({ taxId: "gode561231gr8", legalName: "Juan Pérez", regimenFiscal: "612", usoCfdi: "g03", fiscalPostalCode: "54000" }, { country: "MX" })
    expect(r).toEqual({ ok: true, data: { taxId: "GODE561231GR8", legalName: "JUAN PÉREZ", regimenFiscal: "612", usoCfdi: "G03", fiscalPostalCode: "54000" } })
  })
  test("MX: rejects unknown régimen and uso", () => {
    expect(normalizeFiscal({ regimenFiscal: "999" }, { country: "MX" })).toMatchObject({ ok: false })
    expect(normalizeFiscal({ usoCfdi: "ZZ9" }, { country: "MX" })).toMatchObject({ ok: false })
    expect(normalizeFiscal({ fiscalPostalCode: "ABC" }, { country: "MX" })).toMatchObject({ ok: false })
  })
  test("non-MX: tax id is free text, no RFC rules", () => {
    expect(normalizeFiscal({ taxId: "12-3456789" }, { country: "US" })).toEqual({ ok: true, data: { taxId: "12-3456789" } })
  })
  test("empty strings are ignored, not rejected", () => {
    expect(normalizeFiscal({ taxId: "", regimenFiscal: "", usoCfdi: "" }, { country: "MX" })).toEqual({ ok: true, data: {} })
  })
  test("catalog helpers", () => {
    expect(isValidRegimen("626")).toBe(true)
    expect(isValidRegimen("600")).toBe(false)
    expect(isValidUsoCfdi("s01")).toBe(true)
  })
})
