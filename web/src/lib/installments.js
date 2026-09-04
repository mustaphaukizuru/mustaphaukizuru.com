/**
 * Mercado Pago installments (MSI) — display helpers.
 *
 * Mirrors the API's MP_MSI_MIN_AMOUNT / MP_MAX_INSTALLMENTS so the "Hasta 12
 * MSI" line only appears where Checkout Pro will actually offer installments
 * (the API forces installments = 1 below the floor). MSI is only offered on
 * MXN (Mercado Pago México), so other currencies never qualify.
 */

function envNumber(value, fallback) {
  const n = Number(value)
  return value != null && value !== "" && Number.isFinite(n) && n > 0 ? n : fallback
}

export const MSI_MIN_AMOUNT   = envNumber(import.meta.env.VITE_MP_MSI_MIN_AMOUNT, 1500)
export const MAX_INSTALLMENTS = envNumber(import.meta.env.VITE_MP_MAX_INSTALLMENTS, 12)

export function qualifiesForMsi(amount, currency = "MXN") {
  const value = Number(amount)
  if (!Number.isFinite(value)) return false
  if (String(currency || "MXN").toUpperCase() !== "MXN") return false
  return value >= MSI_MIN_AMOUNT
}
