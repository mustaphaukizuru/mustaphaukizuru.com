/* ─────────────────── PdfUploader ───────────────────────────────────────────
 *  Drop-zone + click-to-pick PDF uploader for the certificate form.
 *
 *  - Sends multipart/form-data to POST /api/admin/media (field name: "file")
 *  - 20 MB hard limit (matches backend); 10 MB soft warning
 *  - PDF only (mime check + extension check)
 *  - Shows progress, filename, and a "Replace" / "Remove" pair after upload
 *  - On success, calls onChange(url) with the same-origin /images/media/... path
 *
 *  Upload flow is preserved verbatim from the original AdminBioPage.
 * ────────────────────────────────────────────────────────────────────────── */

import { useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Upload, X } from "lucide-react"
import { API_BASE_URL, getStoredToken } from "../../../lib/api"

export default function PdfUploader({ value, onChange, disabled = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState("") // last-uploaded filename (for the success state)

  const triggerPick = () => { if (!disabled && !uploading) inputRef.current?.click() }

  const validate = (file) => {
    if (!file) return "No file selected."
    const isPdf =
      file.type === "application/pdf" ||
      /\.pdf$/i.test(file.name)
    if (!isPdf) return "Only PDF files are accepted."
    if (file.size > 20 * 1024 * 1024) return "File is too large (max 20 MB)."
    return ""
  }

  const upload = async (file) => {
    const v = validate(file)
    if (v) { setError(v); return }
    setError(""); setUploading(true); setProgress(0); setFileName(file.name)

    try {
      const token = getStoredToken()
      const fd = new FormData()
      fd.append("file", file)

      // XHR (instead of fetch) so we get real upload-progress events
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `${API_BASE_URL}/api/admin/media`)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || "{}")
            if (xhr.status >= 200 && xhr.status < 300 && parsed?.success) resolve(parsed.data)
            else reject(new Error(parsed?.error || `Upload failed (HTTP ${xhr.status})`))
          } catch { reject(new Error("Upload returned an invalid response.")) }
        }
        xhr.onerror = () => reject(new Error("Network error during upload."))
        xhr.send(fd)
      })

      const url = data?.fileUrl || data?.url
      if (!url) throw new Error("Upload succeeded but no URL was returned.")
      onChange(url)
    } catch (e) {
      setError(e?.message || "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // Allow re-picking the same file
    e.target.value = ""
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer?.files?.[0]
    if (file) upload(file)
  }

  // ── Render: 3 states · empty · uploading · uploaded ────────────────────

  if (uploading) {
    return (
      <div className="rounded-xl border border-violet/20 bg-violet/5 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-charcoal">{fileName}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet/10">
              <div className="h-full rounded-full bg-violet transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className="font-mono text-xs tabular-nums text-charcoal-50">{progress}%</span>
        </div>
      </div>
    )
  }

  if (value) {
    return (
      <div className="rounded-xl border border-mint/30 bg-mint/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint/15 text-mint">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-charcoal">PDF attached</div>
            <a
              href={value.startsWith("http") ? value : `${API_BASE_URL}${value}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate font-mono text-xs text-azure hover:underline"
              title={value}
            >
              {value}
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={triggerPick}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
              title="Replace PDF"
            >
              <Upload className="h-3.5 w-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-rose hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40"
              title="Remove PDF"
              aria-label="Remove PDF"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-xs text-rose">{error}</div>}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
      </div>
    )
  }

  // Empty state — drop zone
  return (
    <div>
      <button
        type="button"
        onClick={triggerPick}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={disabled}
        className={[
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white px-4 py-8 text-center transition",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40",
          dragOver
            ? "border-violet bg-violet-pale"
            : "border-slate-300 hover:border-violet/50 hover:bg-violet-pale/40",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet/10 text-violet">
          <Upload className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="text-sm font-semibold text-charcoal">
          Click to upload or drag a PDF here
        </div>
        <div className="text-xs text-charcoal-50">
          PDF only · up to 20 MB
        </div>
      </button>
      {error && (
        <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-2.5 text-xs text-rose">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
    </div>
  )
}
