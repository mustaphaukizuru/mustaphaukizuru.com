/**
 * Format a byte count as a human-readable string using binary (1024-based)
 * units, labeled with the conventional KB/MB/GB nomenclature (matches what
 * Windows, macOS Finder, and most download managers display).
 *
 * Returns `null` for non-finite / negative / missing input so the client
 * can simply skip rendering that line rather than print "NaN".
 *
 * @example
 *   formatBytes(0)        // "0 B"
 *   formatBytes(512)      // "512 B"
 *   formatBytes(1536)     // "1.5 KB"
 *   formatBytes(2516582)  // "2.4 MB"
 *   formatBytes(null)     // null
 *
 * @param {number|bigint|null|undefined} bytes
 * @returns {string|null}
 */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return null
  // Accept BigInt (Prisma emits BigInt for certain MySQL columns).
  const n = typeof bytes === "bigint" ? Number(bytes) : Number(bytes)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const exponent = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, exponent)
  // Bytes → integer. Everything else → 1 decimal place.
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[exponent]}`
}

module.exports = formatBytes
