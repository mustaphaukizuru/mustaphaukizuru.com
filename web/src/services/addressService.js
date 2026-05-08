import { authFetch } from "../lib/api"

/**
 * Address client service (B08)
 * Thin wrapper around /api/v1/member/addresses.
 */

export async function fetchAddresses() {
  const res = await authFetch("/api/v1/member/addresses", { method: "GET" })
  return Array.isArray(res?.data) ? res.data : []
}

export async function fetchAddress(id) {
  const res = await authFetch(`/api/v1/member/addresses/${encodeURIComponent(id)}`, { method: "GET" })
  return res?.data || null
}

export async function createAddress(payload) {
  const res = await authFetch("/api/v1/member/addresses", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  })
  return res?.data || null
}

export async function updateAddress(id, payload) {
  const res = await authFetch(`/api/v1/member/addresses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  })
  return res?.data || null
}

export async function deleteAddress(id) {
  const res = await authFetch(`/api/v1/member/addresses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  return res?.data || null
}

export async function setAddressDefault(id) {
  const res = await authFetch(`/api/v1/member/addresses/${encodeURIComponent(id)}/default`, {
    method: "POST",
  })
  return res?.data || null
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Formats an address as a compact one-line string for selector lists.
 */
export function formatAddressLine(address) {
  if (!address) return ""
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
    address.country,
  ].filter(Boolean)
  return parts.join(" · ")
}

/**
 * ISO 3166-1 alpha-2 — common countries relevant to the user base. The list
 * is intentionally short and LATAM/Europe/North-America biased. Expand later
 * when the user base warrants it.
 */
export const COUNTRY_OPTIONS = [
  { code: "MX", name: "Mexico" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "ES", name: "Spain" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PE", name: "Peru" },
  { code: "RW", name: "Rwanda" },
  { code: "TR", name: "Türkiye" },
  { code: "ET", name: "Ethiopia" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
]
