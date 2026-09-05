/**
 * zip.js · a minimal, dependency-free ZIP writer (T5-19)
 *
 * WHY THIS EXISTS RATHER THAN `archiver`
 *
 * The handover pack is one feature that needs one archive. Adding a runtime
 * dependency and its tree for that is a poor trade in a project that has
 * deliberately kept few — and this codebase has already been bitten once by
 * reaching for a package by name (`npx lhci` installs a squatted package
 * that is not Lighthouse).
 *
 * The counter-argument is the real one: hand-rolling an archive format is
 * how you produce a file that some extractors accept and others reject. So
 * this implementation is deliberately the boring subset:
 *
 *   STORE only, no compression.  The pack is PDFs (already compressed) and a
 *      little JSON and Markdown. Deflate would save a few percent and add
 *      the one failure mode that actually bites — a compressed-size or CRC
 *      that disagrees with the bytes.
 *   No Zip64.  Refused above the cap below instead, loudly, rather than
 *      emitting a 32-bit header that lies.
 *   No directory entries, no extra fields, no data descriptors.
 *
 * What is left is the 1989 format every extractor has implemented correctly
 * for thirty years: local header, data, central directory, end record. The
 * test opens the output with a real ZIP reader rather than trusting this
 * file's own arithmetic.
 */

const zlib = require("zlib")

/** Non-Zip64 ceiling, with room to spare. A handover pack is megabytes. */
const MAX_TOTAL_BYTES = 512 * 1024 * 1024

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

/**
 * MS-DOS date and time, which is what the format stores.
 *
 * Two-second resolution and a 1980 epoch. A date before 1980 cannot be
 * represented, so it is clamped rather than wrapped into a nonsense year.
 */
function dosDateTime(date) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  const year = Math.max(1980, d.getFullYear())
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f)
  const dateBits = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f)
  return { time, date: dateBits }
}

/** zlib ships the same CRC-32 the format wants; no table of our own. */
function crc32(buf) {
  return zlib.crc32
    ? zlib.crc32(buf) >>> 0
    : legacyCrc32(buf)
}

/** Node < 20.12 has no zlib.crc32. Same polynomial, computed once. */
let CRC_TABLE = null
function legacyCrc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i += 1) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

/**
 * Names inside the archive.
 *
 * Forward slashes always — a backslash in a ZIP entry name is what makes an
 * archive built on Windows extract into files literally called
 * "a\\b.pdf" on everything else. Leading slashes and "..' segments are
 * stripped: an entry name is not a path on the reader's disk and must never
 * be able to become one.
 */
function safeEntryName(name) {
  return String(name || "file")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/") || "file"
}

/**
 * Build a ZIP archive in memory.
 *
 * @param {Array<{name: string, data: Buffer|string, date?: Date}>} entries
 * @returns {Buffer}
 */
function createZip(entries) {
  const rows = (entries || []).filter(Boolean)
  if (!rows.length) throw new Error("A zip needs at least one entry")

  const locals = []
  const centrals = []
  const seen = new Set()
  let offset = 0

  for (const entry of rows) {
    let name = safeEntryName(entry.name)
    // A duplicate name is an archive where one file silently hides another.
    if (seen.has(name.toLowerCase())) {
      const dot = name.lastIndexOf(".")
      const stem = dot > 0 ? name.slice(0, dot) : name
      const ext = dot > 0 ? name.slice(dot) : ""
      let n = 2
      while (seen.has(`${stem}-${n}${ext}`.toLowerCase())) n += 1
      name = `${stem}-${n}${ext}`
    }
    seen.add(name.toLowerCase())

    const nameBuf = Buffer.from(name, "utf8")
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ""), "utf8")
    const { time, date } = dosDateTime(entry.date)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_SIG, 0)
    local.writeUInt16LE(20, 4)          // version needed: 2.0
    // Bit 11 · the name is UTF-8. Without it an accented file name is read
    // as CP437 and the client opens "Sitio institucional" as mojibake.
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)           // method 0 = stored
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)          // no extra field

    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL_SIG, 0)
    central.writeUInt16LE(20, 4)        // version made by
    central.writeUInt16LE(20, 6)        // version needed
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)        // extra
    central.writeUInt16LE(0, 32)        // comment
    central.writeUInt16LE(0, 34)        // disk number
    central.writeUInt16LE(0, 36)        // internal attrs
    central.writeUInt32LE(0, 38)        // external attrs
    central.writeUInt32LE(offset, 42)   // where its local header is

    locals.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += local.length + nameBuf.length + data.length

    if (offset > MAX_TOTAL_BYTES) {
      // Refused rather than truncated into a 32-bit header that lies about
      // where things are.
      throw new Error(`Archive exceeds ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB — Zip64 is not implemented`)
    }
  }

  const centralBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD_SIG, 0)
  eocd.writeUInt16LE(0, 4)              // this disk
  eocd.writeUInt16LE(0, 6)              // disk with the central directory
  eocd.writeUInt16LE(rows.length, 8)
  eocd.writeUInt16LE(rows.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)             // no comment

  return Buffer.concat([...locals, centralBuf, eocd])
}

module.exports = { createZip, crc32, safeEntryName, MAX_TOTAL_BYTES }
