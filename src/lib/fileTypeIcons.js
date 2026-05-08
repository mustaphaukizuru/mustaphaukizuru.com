/**
 * File-type icon and color map for product files.
 *
 * Maps a file extension or MIME-derived `fileType` string to:
 *   - icon  : a Lucide React component
 *   - label : a 3-4 letter uppercase badge label (e.g. "PDF", "DOCX")
 *   - tone  : a tone key, used by getFileTypeStyles() to produce Tailwind classes
 *
 * Rationale for the color tone abstraction:
 *   File-type colors are conventional (PDF=red, DOCX=blue, XLSX=green, etc.)
 *   We map each tone to BOTH a chip background style and an icon color via
 *   `getFileTypeStyles()`. This keeps consumers ignorant of the underlying
 *   Tailwind classes — they just call `getFileTypeMeta(fileType)`.
 *
 * Used by:
 *   - ProductDetail "What's inside" file manifest section (refinement A)
 *   - DashboardDownloadsPage list rows (future migration)
 *   - AdminProductFormPage file row preview (future migration)
 */

import {
  FileText,
  Table,
  Presentation,
  Archive,
  Video,
  Music,
  Image as ImageIcon,
  Code,
  Component,
  File as FileIcon,
} from "lucide-react"

/* ─────────────────────────────────────────────────────────────────────────
 *  Internal: extension -> meta record
 *  Each entry uses a tone key (resolved to Tailwind classes by getFileTypeStyles)
 *  ───────────────────────────────────────────────────────────────────────── */

const FILE_TYPE_MAP = {
  // Documents
  pdf:  { icon: FileText,     label: "PDF",  tone: "rose"      },
  doc:  { icon: FileText,     label: "DOC",  tone: "azure"     },
  docx: { icon: FileText,     label: "DOCX", tone: "azure"     },
  rtf:  { icon: FileText,     label: "RTF",  tone: "azure"     },
  txt:  { icon: FileText,     label: "TXT",  tone: "charcoal"  },
  md:   { icon: FileText,     label: "MD",   tone: "charcoal"  },

  // Spreadsheets / data
  xls:  { icon: Table,        label: "XLS",  tone: "mint"      },
  xlsx: { icon: Table,        label: "XLSX", tone: "mint"      },
  csv:  { icon: Table,        label: "CSV",  tone: "mint"      },
  tsv:  { icon: Table,        label: "TSV",  tone: "mint"      },

  // Presentations
  ppt:  { icon: Presentation, label: "PPT",  tone: "amber"     },
  pptx: { icon: Presentation, label: "PPTX", tone: "amber"     },
  key:  { icon: Presentation, label: "KEY",  tone: "amber"     },

  // Archives
  zip:  { icon: Archive,      label: "ZIP",  tone: "violet"    },
  rar:  { icon: Archive,      label: "RAR",  tone: "violet"    },
  "7z": { icon: Archive,      label: "7Z",   tone: "violet"    },
  tar:  { icon: Archive,      label: "TAR",  tone: "violet"    },
  gz:   { icon: Archive,      label: "GZ",   tone: "violet"    },

  // Video
  mp4:  { icon: Video,        label: "MP4",  tone: "charcoal"  },
  mov:  { icon: Video,        label: "MOV",  tone: "charcoal"  },
  webm: { icon: Video,        label: "WEBM", tone: "charcoal"  },
  avi:  { icon: Video,        label: "AVI",  tone: "charcoal"  },
  mkv:  { icon: Video,        label: "MKV",  tone: "charcoal"  },

  // Audio
  mp3:  { icon: Music,        label: "MP3",  tone: "terracotta"},
  wav:  { icon: Music,        label: "WAV",  tone: "terracotta"},
  flac: { icon: Music,        label: "FLAC", tone: "terracotta"},
  m4a:  { icon: Music,        label: "M4A",  tone: "terracotta"},
  ogg:  { icon: Music,        label: "OGG",  tone: "terracotta"},

  // Images
  png:  { icon: ImageIcon,    label: "PNG",  tone: "cyan"      },
  jpg:  { icon: ImageIcon,    label: "JPG",  tone: "cyan"      },
  jpeg: { icon: ImageIcon,    label: "JPEG", tone: "cyan"      },
  gif:  { icon: ImageIcon,    label: "GIF",  tone: "cyan"      },
  webp: { icon: ImageIcon,    label: "WEBP", tone: "cyan"      },
  svg:  { icon: ImageIcon,    label: "SVG",  tone: "cyan"      },
  heic: { icon: ImageIcon,    label: "HEIC", tone: "cyan"      },

  // Design
  fig:    { icon: Component,  label: "FIG",   tone: "violet"   },
  figma:  { icon: Component,  label: "FIG",   tone: "violet"   },
  sketch: { icon: Component,  label: "SKETCH",tone: "violet"   },
  ai:     { icon: Component,  label: "AI",    tone: "amber"    },
  psd:    { icon: Component,  label: "PSD",   tone: "azure"    },
  xd:     { icon: Component,  label: "XD",    tone: "rose"     },

  // Code / source
  json: { icon: Code,         label: "JSON", tone: "amber"     },
  xml:  { icon: Code,         label: "XML",  tone: "amber"     },
  yaml: { icon: Code,         label: "YAML", tone: "amber"     },
  yml:  { icon: Code,         label: "YML",  tone: "amber"     },
  html: { icon: Code,         label: "HTML", tone: "terracotta"},
  css:  { icon: Code,         label: "CSS",  tone: "azure"     },
  js:   { icon: Code,         label: "JS",   tone: "amber"     },
  ts:   { icon: Code,         label: "TS",   tone: "azure"     },
  jsx:  { icon: Code,         label: "JSX",  tone: "azure"     },
  tsx:  { icon: Code,         label: "TSX",  tone: "azure"     },
  py:   { icon: Code,         label: "PY",   tone: "azure"     },
  java: { icon: Code,         label: "JAVA", tone: "rose"      },
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Tone -> Tailwind class mapping
 *  Resolves a tone key to:
 *    - chip       : background + text classes for the file-type badge
 *    - iconColor  : text color class for the standalone icon (when shown larger)
 *
 *  Tones use the v3.0 brand tokens where available (violet, charcoal,
 *  terracotta) and Tailwind defaults for the rest. This keeps the icon map
 *  visually consistent without depending on tokens that may not exist.
 *  ───────────────────────────────────────────────────────────────────────── */

const TONE_STYLES = {
  // v3.0 brand tokens
  violet:     { chip: "bg-violet-pale text-violet",        iconColor: "text-violet"        },
  charcoal:   { chip: "bg-charcoal-80/8 text-charcoal-80", iconColor: "text-charcoal-80"   },
  terracotta: { chip: "bg-orange-50 text-terracotta",      iconColor: "text-terracotta"    },

  // Document-color conventions (Tailwind defaults)
  rose:       { chip: "bg-rose-50 text-rose-700",          iconColor: "text-rose-600"      },
  azure:      { chip: "bg-blue-50 text-blue-700",          iconColor: "text-blue-600"      },
  mint:       { chip: "bg-emerald-50 text-emerald-700",    iconColor: "text-emerald-600"   },
  amber:      { chip: "bg-amber-50 text-amber-700",        iconColor: "text-amber-600"     },
  cyan:       { chip: "bg-sky-50 text-sky-700",            iconColor: "text-sky-600"       },

  // Default fallback
  default:    { chip: "bg-slate-100 text-slate-700",       iconColor: "text-slate-600"     },
}

/* ─────────────────────────────────────────────────────────────────────────
 *  Public API
 *  ───────────────────────────────────────────────────────────────────────── */

/**
 * Normalize an arbitrary file-type input to a clean lowercase extension.
 *
 *   "PDF"                          -> "pdf"
 *   "Document.docx"                -> "docx"
 *   "image/png"                    -> "png"
 *   "/path/to/file.zip"            -> "zip"
 *   "C:\\path\\file.docx"          -> "docx"
 *   "TAR.GZ"                       -> "gz"   (intentional — uses last extension)
 *   "application/pdf"              -> "pdf"
 *   "application/vnd.ms-excel"     -> "excel"
 *   ""                             -> ""
 *   null/undefined/non-string      -> ""
 */
export function normalizeFileType(input) {
  if (!input || typeof input !== "string") return ""

  let trimmed = input.trim().toLowerCase()
  if (!trimmed) return ""

  // Detect MIME type: contains "/" AND looks like type/subtype, AND has no
  // extra path separators that would indicate a filesystem path
  // (e.g. "image/png" is MIME, "/path/to/file.zip" is filesystem)
  const isMime =
    trimmed.includes("/") &&
    !trimmed.startsWith("/") &&
    !trimmed.startsWith(".") &&
    trimmed.split("/").length === 2

  if (isMime) {
    let after = trimmed.split("/").pop() || ""
    // image/svg+xml -> svg
    after = after.split("+")[0]
    // vnd.ms-excel -> ms-excel; x-zip-compressed -> zip-compressed
    after = after.replace(/^vnd\./, "").replace(/^x-/, "")
    // ms-excel -> excel; ms-powerpoint -> powerpoint (so the alias map can hit)
    after = after.replace(/^ms-/, "")
    return after
  }

  // Filesystem path: take the basename first (handle both / and \ separators),
  // then fall through to dotted-extension extraction
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    trimmed = trimmed.split(/[\\/]/).pop() || ""
  }

  // Pick the last dot-separated segment from a filename
  if (trimmed.includes(".")) {
    return trimmed.split(".").pop() || ""
  }

  return trimmed
}

/**
 * Get the meta record (icon, label, tone) for a given file type.
 * Always returns a valid record — falls back to a generic "FILE" entry.
 *
 * @param {string} fileType - extension, MIME type, or filename
 * @returns {{ icon: Function, label: string, tone: string }}
 */
export function getFileTypeMeta(fileType) {
  const ext = normalizeFileType(fileType)

  if (ext && FILE_TYPE_MAP[ext]) return FILE_TYPE_MAP[ext]

  // Special MIME aliases that don't map to a clean extension
  if (ext === "excel" || ext === "ms-excel") return FILE_TYPE_MAP.xlsx
  if (ext === "msword") return FILE_TYPE_MAP.docx
  if (ext === "powerpoint" || ext === "ms-powerpoint") return FILE_TYPE_MAP.pptx

  // Unknown extension — generic file record
  return { icon: FileIcon, label: ext ? ext.slice(0, 4).toUpperCase() : "FILE", tone: "default" }
}

/**
 * Get the resolved Tailwind classes for a tone key.
 *
 * @param {string} tone - tone key (e.g. "rose", "azure", "violet")
 * @returns {{ chip: string, iconColor: string }}
 */
export function getToneStyles(tone) {
  return TONE_STYLES[tone] || TONE_STYLES.default
}

/**
 * Convenience wrapper — returns icon + label + ready-to-use Tailwind classes.
 * This is what most call sites will use.
 *
 * @param {string} fileType - extension, MIME type, or filename
 * @returns {{ icon: Function, label: string, tone: string, chip: string, iconColor: string }}
 *
 * Example:
 *   const { icon: Icon, label, chip } = getFileTypeStyles("invoice.pdf")
 *   <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-micro font-bold ${chip}`}>
 *     <Icon className="h-3 w-3" /> {label}
 *   </span>
 */
export function getFileTypeStyles(fileType) {
  const meta = getFileTypeMeta(fileType)
  const styles = getToneStyles(meta.tone)
  return { ...meta, ...styles }
}

/**
 * Format bytes into a human-readable string with sensible precision.
 * Used as a fallback when the backend hasn't provided fileSizeFormatted.
 *
 *   1024            -> "1 KB"
 *   2_500_000       -> "2.4 MB"
 *   1_500_000_000   -> "1.4 GB"
 *   undefined/null  -> ""
 *   0               -> "0 B"
 */
export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return ""

  const n = Number(bytes)
  if (n === 0) return "0 B"
  if (n < 0) return ""

  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = n
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  // 1 decimal place for KB+, no decimals for B
  const formatted = unit === 0 ? Math.round(value).toString() : value.toFixed(value < 10 ? 1 : 0)

  return `${formatted} ${units[unit]}`
}
