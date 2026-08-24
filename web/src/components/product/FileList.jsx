import { useTranslation } from "react-i18next"
import { Files, Download, Loader2 } from "lucide-react"
import { getFileTypeStyles, formatFileSize } from "../../lib/fileTypeIcons"
import SuccessCheck from "../motion/SuccessCheck"

/* ──────────────────────────────────────────────────────────────────────────
 *  FileList — "What's inside" manifest rendered from product.files[].
 *
 *  Exports:
 *    default FileList     2-col grid of FileRow (1-col mobile) + empty state
 *    FileRow              icon chip · mono name · size · version · primary
 *    FileTypeStrip        compact distinct-type chip strip for the buy box
 *
 *  Optional download affordance (roadmap step 35): pass `onDownload(file)` to
 *  FileList (plus `downloadStates` — a { [file.id]: "idle"|"busy"|"done" } map)
 *  or straight to FileRow (`onDownload` + `state`). Omit them and the markup is
 *  byte-identical to before, so the public product page is unaffected.
 *  ────────────────────────────────────────────────────────────────────────── */

export default function FileList({ files = [], onDownload, downloadStates }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(files) || files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
        <Files className="h-8 w-8 text-charcoal-80/30" />
        <p className="text-meta font-semibold text-charcoal-80/60">{t("detail.noFiles")}</p>
        <p className="text-micro text-charcoal-80/50">{t("detail.filesAfterPurchase")}</p>
      </div>
    )
  }

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {files.map((file, i) => (
        <FileRow
          key={file.id || `file-${i}`}
          file={file}
          onDownload={onDownload}
          state={downloadStates?.[file.id] || "idle"}
        />
      ))}
    </ul>
  )
}

export function FileRow({ file, onDownload, state = "idle" }) {
  const { t } = useTranslation("product")
  const styles = getFileTypeStyles(file.fileType || file.fileName || "")
  const Icon = styles.icon
  const sizeDisplay = file.fileSizeFormatted || formatFileSize(file.fileSize) || ""
  const displayName = (file.fileName || t("files.untitled")).split(/[\\/]/).pop()

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-charcoal-80/8 bg-white p-3 transition hover:border-violet/20 hover:shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.chip}`} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-mono text-meta font-semibold text-charcoal" title={displayName}>
            {displayName}
          </span>
          {file.isPrimary && (
            <span className="shrink-0 rounded-md bg-violet-pale px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide text-violet">
              {t("misc.primary")}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-micro text-charcoal-80/60">
          {sizeDisplay && <span className="font-mono tabular-nums">{sizeDisplay}</span>}
          {sizeDisplay && file.version && <span aria-hidden="true">·</span>}
          {file.version && (
            <span className="rounded bg-charcoal-80/8 px-1.5 py-0.5 font-mono text-micro font-semibold text-charcoal-80/70">
              v{String(file.version).replace(/^v/i, "").replace(/v$/i, "")}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 font-mono text-micro font-bold ${styles.chip}`}>
          {styles.label}
        </span>
        {onDownload && (
          <DownloadAction
            state={state}
            label={displayName}
            onClick={() => onDownload(file)}
          />
        )}
      </div>
    </li>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  DownloadAction — per-row download state machine · roadmap step 35
 *
 *  idle → busy → done. The whole control is a fixed 36×36 box with a fixed
 *  16×16 icon slot inside it, so swapping the glyph can never reflow the row.
 *  `busy` keeps a real spinner (the request is genuinely in flight); `done`
 *  draws the shared <SuccessCheck tone="inline">, which self-flattens under
 *  `prefers-reduced-motion`.
 *  ────────────────────────────────────────────────────────────────────────── */
function DownloadAction({ state = "idle", label, onClick }) {
  const { t } = useTranslation("product")
  const busy = state === "busy"
  const done = state === "done"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      aria-label={t("files.downloadAria", { name: label, defaultValue: "Download {{name}}" })}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 disabled:cursor-wait ${
        done
          ? "border-mint/40 bg-mint/10 text-mint-600"
          : "border-charcoal-80/10 bg-mist text-violet hover:border-violet/25 hover:bg-violet-pale"
      }`}
    >
      <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : done
            ? <SuccessCheck size={16} tone="inline" />
            : <Download className="h-4 w-4 transition motion-safe:group-hover:translate-y-0.5" />}
      </span>
    </button>
  )
}

/* Groups files by type label · up to 5 distinct types · "×N" multipliers */
export function FileTypeStrip({ files }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(files) || files.length === 0) return null

  const grouped = new Map()
  for (const f of files) {
    const styles = getFileTypeStyles(f.fileType || f.fileName || "")
    const existing = grouped.get(styles.label)
    if (existing) existing.count += 1
    else grouped.set(styles.label, { ...styles, count: 1 })
  }

  const visible = Array.from(grouped.values()).slice(0, 5)
  const visibleFileCount = visible.reduce((sum, g) => sum + g.count, 0)
  const overflow = files.length - visibleFileCount

  return (
    <div className="mt-4 border-t border-charcoal-80/8 pt-4">
      <div className="flex items-center gap-2">
        <Files className="h-3.5 w-3.5 shrink-0 text-charcoal-80/45" aria-hidden="true" />
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-charcoal-80/55">
          {t("misc.includes")}
        </span>
        <span className="font-mono text-micro tabular-nums text-charcoal-80/45">
          {t("info.fileCount", { count: files.length })}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {visible.map(({ icon: Icon, label, chip, count }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-micro font-bold ${chip}`}
            title={`${count} ${label}`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono">{label}</span>
            {count > 1 && <span className="font-mono opacity-70">×{count}</span>}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-micro font-medium text-charcoal-80/50">
            +{overflow} {t("misc.more")}
          </span>
        )}
      </div>
    </div>
  )
}
