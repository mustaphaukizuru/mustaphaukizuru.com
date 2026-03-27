import { useEffect, useRef, useState } from "react"
import { Image, Upload, Trash2, AlertCircle, RefreshCw, Copy } from "lucide-react"
import { EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"
import { authFetch, API_BASE_URL } from "../lib/api"
import { getStoredToken } from "../services/authService"
import { useToast } from "../context/ToastContext"

// ─────────────────────────────────────────────────────────────────────────────
// Admin Media Library page
// ─────────────────────────────────────────────────────────────────────────────

function resolveUrl(url) {
  if (!url) return ""
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function MediaCard({ asset, onDelete, onCopy }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.fileName || asset.url || "")

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#634F40]/10 bg-[#fafafa]">
      {/* Thumbnail */}
      <div className="flex h-40 items-center justify-center overflow-hidden bg-[#f4f1f4]">
        {isImage ? (
          <img
            src={resolveUrl(asset.url)}
            alt={asset.altText || asset.fileName}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#634F40]/40">
            <Image className="h-10 w-10" />
            <div className="text-[11px]">{asset.mimeType || "file"}</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="truncate text-[12px] font-semibold text-[#420060]">
          {asset.fileName || asset.name || "Asset"}
        </div>
        <div className="mt-0.5 text-[11px] text-[#634F40]/55">
          {asset.mimeType && <span>{asset.mimeType} · </span>}
          {new Date(asset.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-[#634F40]/10">
        <button
          type="button"
          onClick={() => onCopy(resolveUrl(asset.url))}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#634F40]/60 transition hover:bg-[#f4eef6] hover:text-[#420060]"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy URL
        </button>
        <div className="w-px bg-[#634F40]/10" />
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#634F40]/60 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </div>
  )
}

export default function AdminMediaPage() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
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

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setUploading(true)
    setError("")

    try {
      const token = getStoredToken()
      const formData = new FormData()
      files.forEach((f) => formData.append("files", f))

      const response = await fetch(`${API_BASE_URL}/api/admin/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || "Upload failed")

      const uploaded = Array.isArray(data.data) ? data.data : [data.data].filter(Boolean)
      setAssets((prev) => [...uploaded, ...prev])
      showSuccess(`${uploaded.length} file${uploaded.length !== 1 ? "s" : ""} uploaded`)
    } catch (err) {
      setError(err.message || "Upload failed.")
      showError("Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this media asset?")) return
    try {
      await authFetch(`/api/admin/media/${id}`, { method: "DELETE" })
      setAssets((prev) => prev.filter((a) => a.id !== id))
      showSuccess("Asset deleted")
    } catch (err) {
      showError(err.message || "Failed to delete asset")
    }
  }

  function handleCopy(url) {
    navigator.clipboard.writeText(url).then(() => {
      showSuccess("URL copied to clipboard")
    })
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[72px]" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonCard key={i} height="h-[220px]" />)}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload area */}
      <div className="rounded-xl border-2 border-dashed border-[#420060]/20 bg-[#faf7fb] p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
            <Upload className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#420060]">Upload Media Assets</div>
            <div className="mt-1 text-[12px] text-[#634F40]/60">
              Images, documents, and other files for product pages and content.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Choose Files"}
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/15 px-4 py-2.5 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.zip,.doc,.docx"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Asset grid */}
      <SectionCard
        title={`Media Library (${assets.length})`}
        subtitle="All uploaded media assets available for use across the platform."
      >
        {assets.length === 0 ? (
          <EmptyState
            icon={Image}
            title="No media assets yet"
            description="Upload images, PDFs, and other files to use across products and content pages."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <MediaCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  )
}
