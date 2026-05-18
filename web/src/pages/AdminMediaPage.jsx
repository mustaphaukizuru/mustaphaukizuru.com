import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Image as ImageIcon, Upload, Trash2, AlertCircle, RefreshCw, Copy,
  FileImage, Files, X,
} from "lucide-react"
import { authFetch, API_BASE_URL } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminMediaPage · Batch 6B-5
 *
 *  Image grid with drag-drop upload — DataTable doesn't fit because the
 *  primary affordance is visual (preview thumbnails). The grid pattern is
 *  preserved but modernized.
 *
 *  What changed:
 *    - Upload area now supports drag-and-drop (dragover/drop handlers
 *      with visual hover state)
 *    - Bespoke metric tile divs replaced with shared <MetricCard /> strip
 *      showing total assets, image count, document count
 *    - Native window.confirm() replaced with proper confirmation modal
 *      (role=dialog, aria-modal, ESC dismiss)
 *    - MediaCard refined: larger thumbnail, file-type icon for non-images,
 *      better metadata, mono filename and date
 *    - Search added (filter by filename)
 *    - All ARIA: button labels, role=region on grid, role=img on thumbnails
 *    - Refresh button matches DataTable convention
 *    - Mojibake "..." replaced with Unicode "\u2026"
 *
 *  Preserved verbatim:
 *    - authFetch + raw fetch endpoints (/api/admin/media)
 *    - resolveUrl helper
 *    - Multi-file upload via FormData
 *    - Toast notifications on upload/delete/copy
 *  ──────────────────────────────────────────────────────────────────── */

// Backend `MediaLibrary` rows store the public path under `fileUrl`. Some
// seeded / legacy rows may use the older `url` field. Resolve in priority
// order so both shapes display correctly.
function pickAssetUrl(asset) {
  return asset?.fileUrl || asset?.url || asset?.path || ""
}

function resolveUrl(input) {
  // Accepts either an asset object or a raw url string for backwards-compat.
  const url = typeof input === "string" ? input : pickAssetUrl(input)
  if (!url) return ""
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function isImageAsset(asset) {
  const name = asset?.fileName || pickAssetUrl(asset) || ""
  const mime = asset?.mimeType || ""
  return mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)
}

/* ──────────────────────────────────────────────────────────────────── */

function MediaCard({ asset, onDelete, onCopy }) {
  const isImage = isImageAsset(asset)

  return (
    <article
      role="listitem"
      className="group flex flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:-translate-y-0.5 hover:border-violet/20 hover:shadow-[0_12px_28px_rgba(93,63,211,0.10)]"
    >
      {/* Thumbnail */}
      <div className="flex h-40 items-center justify-center overflow-hidden bg-violet-pale/30">
        {isImage ? (
          <img
            src={resolveUrl(asset)}
            alt={asset.altText || asset.fileName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-charcoal-80/45" role="img" aria-label="Non-image file">
            <Files className="h-10 w-10" aria-hidden="true" />
            <div className="font-mono text-[10px] uppercase tracking-wider">{asset.mimeType || "file"}</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 p-3">
        <div className="truncate font-mono text-[11px] font-semibold text-violet" title={asset.fileName || asset.name}>
          {asset.fileName || asset.name || "Asset"}
        </div>
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-charcoal-80/55">
          {asset.mimeType && <span>{asset.mimeType} · </span>}
          {new Date(asset.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-charcoal-80/10">
        <button
          type="button"
          onClick={() => onCopy(resolveUrl(asset))}
          aria-label={`Copy URL for ${asset.fileName}`}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-micro font-semibold text-charcoal-80/65 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-inset"
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          Copy URL
        </button>
        <div className="w-px bg-charcoal-80/10" />
        <button
          type="button"
          onClick={() => onDelete(asset)}
          aria-label={`Delete ${asset.fileName}`}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-micro font-semibold text-charcoal-80/65 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-inset"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          Delete
        </button>
      </div>
    </article>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

function DeleteConfirmModal({ asset, onConfirm, onCancel, busy }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_24px_60px_rgba(93,63,211,0.18)]"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-card font-bold text-violet">Delete this media asset?</h3>
            <p className="mt-1 text-meta text-charcoal-80/70">
              <code className="rounded bg-violet-pale px-1.5 py-0.5 font-mono text-micro text-violet">
                {asset?.fileName}
              </code>
              {" "}will be permanently removed. This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-micro font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────── */

export default function AdminMediaPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef(null)
  const { showSuccess, showError } = useToast()

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError("")
    try {
      const res = await authFetch("/api/admin/media")
      setAssets(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || "Failed to load media.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  async function uploadFiles(files) {
    if (!files.length) return
    setUploading(true); setError("")

    // Backend uses multer.single("file") — one file per request, field name "file"
    // (was previously sending "files" which triggered multer's "Unexpected field" error).
    const uploaded = []
    const failed = []

    for (const f of files) {
      const formData = new FormData()
      formData.append("file", f) // field name MUST be "file"
      try {
        // authFetch handles auth header + FormData boundary + AppError wrap.
        const data = await authFetch("/api/v1/admin/media", {
          method: "POST",
          body:   formData,
        })
        const row = data?.data ?? data
        if (row) uploaded.push(row)
        if (import.meta.env.DEV) console.info("[Media] uploaded", f.name, row)
      } catch (err) {
        console.error("[Media] upload failed for", f.name, err)
        failed.push({ name: f.name, message: err?.toUserMessage?.() || err?.message || "Upload failed" })
      }
    }

    if (uploaded.length) setAssets((prev) => [...uploaded, ...prev])

    // Surface a clear toast summary so the user knows exactly what landed and what didn't
    if (uploaded.length && !failed.length) {
      showSuccess(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`)
    } else if (uploaded.length && failed.length) {
      showError(`${uploaded.length} succeeded, ${failed.length} failed: ${failed.map(f => f.name).join(", ")}`, "Partial upload")
      setError(`Some files failed: ${failed.map(f => `${f.name} (${f.message})`).join("; ")}`)
    } else {
      const firstError = failed[0]?.message || "Upload failed"
      showError(firstError, "Upload failed")
      setError(firstError)
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleUploadInput(e) {
    await uploadFiles(Array.from(e.target.files || []))
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDragOver(false)
  }

  async function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    await uploadFiles(Array.from(e.dataTransfer.files || []))
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await authFetch(`/api/admin/media/${confirmDelete.id}`, { method: "DELETE" })
      setAssets((prev) => prev.filter((a) => a.id !== confirmDelete.id))
      setConfirmDelete(null)
      showSuccess("Asset deleted")
    } catch (err) {
      showError(err.message || "Failed to delete asset")
    } finally {
      setDeleting(false)
    }
  }

  function handleCopy(url) {
    navigator.clipboard.writeText(url).then(() => showSuccess("URL copied to clipboard"))
  }

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return assets
    const q = search.toLowerCase().trim()
    return assets.filter((a) =>
      (a.fileName || "").toLowerCase().includes(q) ||
      (a.mimeType || "").toLowerCase().includes(q)
    )
  }, [assets, search])

  // Metrics
  const metrics = useMemo(() => ({
    total: assets.length,
    images: assets.filter(isImageAsset).length,
    documents: assets.filter((a) => !isImageAsset(a)).length,
  }), [assets])

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        <SkeletonCard height="h-[180px]" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonCard key={i} height="h-[260px]" />)}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Total Assets" value={metrics.total} icon={Files} tone="purple" />
        <MetricCard title="Images" value={metrics.images} icon={FileImage} tone="green" />
        <MetricCard title="Documents" value={metrics.documents} icon={Files} tone="blue" />
      </div>

      {/* Upload area with drag-and-drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 transition ${
          dragOver
            ? "border-violet bg-violet-pale/60 ring-[3px] ring-azure/30"
            : "border-violet/25 bg-violet-pale/30"
        }`}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet transition ${dragOver ? "scale-110" : ""}`}>
            <Upload className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="text-meta font-bold text-violet">
              {dragOver ? "Drop files to upload" : "Upload Media Assets"}
            </div>
            <div className="mt-0.5 text-micro text-charcoal-80/65">
              Drag and drop, or click below. Supports images, PDFs, ZIPs, and Word docs.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {uploading ? "Uploading\u2026" : "Choose Files"}
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-2 text-micro font-medium text-violet transition hover:border-violet/20 hover:bg-violet-pale disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip,.doc,.docx"
            onChange={handleUploadInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Library header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-card font-bold text-violet">Media Library</h2>
          <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
            {filtered.length}{search && filtered.length !== assets.length && <span> of {assets.length}</span>} {filtered.length === 1 ? "asset" : "assets"}
          </p>
        </div>
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename or type\u2026"
            aria-label="Search media library"
            className="h-9 w-full rounded-lg border border-charcoal-80/12 bg-white px-3 pr-7 text-micro text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20 sm:w-[240px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Asset grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-card font-bold text-violet">
            {search ? "No matches" : "No media assets yet"}
          </h3>
          <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
            {search
              ? `No assets match "${search}". Try a different search term.`
              : "Upload images, PDFs, and other files to use across products and content pages."}
          </p>
        </div>
      ) : (
        <div role="list" aria-label="Media assets" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((asset) => (
            <MediaCard
              key={asset.id}
              asset={asset}
              onDelete={setConfirmDelete}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      <AnimatePresence>
        {confirmDelete && (
          <DeleteConfirmModal
            asset={confirmDelete}
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmDelete(null)}
            busy={deleting}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
