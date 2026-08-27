const crypto = require("crypto")

/**
 * T3 · Deterministic licence key for an order item.
 *
 *   LIC-XXXXX-XXXXX-XXXXX-XXXXX
 *
 * = "LIC-" + the first 20 hex chars of HMAC-SHA256(orderItemId) in groups
 * of 5. Keyed with LICENSE_KEY_SECRET (falls back to JWT_SECRET) so keys
 * cannot be forged from a leaked order-item id, and deterministic so a
 * re-run never mints a different key for the same purchase.
 */
function mintLicenseKey(orderItemId, secret = process.env.LICENSE_KEY_SECRET || process.env.JWT_SECRET) {
  if (!orderItemId) throw new Error("mintLicenseKey: orderItemId is required")
  if (!secret) throw new Error("mintLicenseKey: LICENSE_KEY_SECRET or JWT_SECRET must be set")
  const hex = crypto.createHmac("sha256", String(secret)).update(String(orderItemId)).digest("hex")
  const body = hex.slice(0, 20).toUpperCase().match(/.{1,5}/g).join("-")
  return `LIC-${body}`
}

module.exports = { mintLicenseKey }
