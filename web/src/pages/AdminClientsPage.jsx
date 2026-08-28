/* ════════════════════════════════════════════════════════════════════════
   AdminClientsPage · /admin/clients
   ────────────────────────────────────────────────────────────────────────
   CRUD for the client logo wall shown on /about.

     GET    /api/v1/admin/client-logos
     POST   /api/v1/admin/client-logos
     PATCH  /api/v1/admin/client-logos/:id
     DELETE /api/v1/admin/client-logos/:id
     POST   /api/v1/admin/client-logos/reorder   { ids: [...] }

   Logo files go through the existing media endpoint (POST /admin/media),
   the same one the blog cover uploader uses, so there is one upload path
   and one storage location for the whole admin.

   The page carries a live preview of the real <LogoCloud>, because the
   thing being edited is a *visual* arrangement: `scale` and order only
   make sense when you can see the row they produce.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Building2, Plus, Trash2, Upload, Eye, EyeOff, ArrowUp, ArrowDown,
  Loader2, AlertCircle, RefreshCw, ExternalLink, Save, X,
} from "lucide-react"

import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { compressImage } from "../lib/imageCompress"
import LogoCloud from "../components/ui/LogoCloud"

const ENDPOINT = "/api/v1/admin/client-logos"
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const EMPTY = {
  name: "", slug: "", logoUrl: "", sector: "", sectorEs: "",
  websiteUrl: "", scale: 1, boxed: false, isActive: true,
}

const INPUT =
  "w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"

export default function AdminClientsPage() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null) // row object or EMPTY for a new one
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await authFetch(ENDPOINT)
      setRows(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err?.message || "Could not load the client list.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeCount = useMemo(() => rows.filter((r) => r.isActive).length, [rows])
  // The preview mirrors exactly what the public wall will show.
  const previewRows = useMemo(() => rows.filter((r) => r.isActive), [rows])

  async function save(e) {
    e?.preventDefault()
    if (!editing) return
    if (!editing.name?.trim()) return toast?.showError?.("A company name is required.")
    if (!editing.logoUrl?.trim()) return toast?.showError?.("Upload a logo image first.")

    setSaving(true)
    try {
      const payload = {
        name: editing.name.trim(),
        slug: editing.slug?.trim() || undefined,
        logoUrl: editing.logoUrl.trim(),
        sector: editing.sector?.trim() || null,
        sectorEs: editing.sectorEs?.trim() || null,
        websiteUrl: editing.websiteUrl?.trim() || null,
        scale: Number(editing.scale) || 1,
        boxed: Boolean(editing.boxed),
        isActive: Boolean(editing.isActive),
      }
      if (editing.id) {
        await authFetch(`${ENDPOINT}/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: JSON.stringify(payload) })
        toast?.showSuccess?.("Client updated")
      } else {
        await authFetch(ENDPOINT, { method: "POST", body: JSON.stringify(payload) })
        toast?.showSuccess?.("Client added")
      }
      setEditing(null)
      await load()
    } catch (err) {
      toast?.showError?.(err?.message || "Could not save this client.")
    } finally {
      setSaving(false)
    }
  }

  async function remove(row) {
    if (!window.confirm(`Remove ${row.name} from the wall? This cannot be undone.`)) return
    setBusyId(row.id)
    try {
      await authFetch(`${ENDPOINT}/${encodeURIComponent(row.id)}`, { method: "DELETE" })
      toast?.showSuccess?.("Client removed")
      await load()
    } catch (err) {
      toast?.showError?.(err?.message || "Could not remove this client.")
    } finally {
      setBusyId("")
    }
  }

  async function toggleActive(row) {
    setBusyId(row.id)
    try {
      await authFetch(`${ENDPOINT}/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !row.isActive }),
      })
      await load()
    } catch (err) {
      toast?.showError?.(err?.message || "Could not change visibility.")
    } finally {
      setBusyId("")
    }
  }

  /** Move a row and persist the whole ordering in one request. */
  async function move(index, direction) {
    const next = [...rows]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next) // optimistic: the list reorders under the cursor immediately
    try {
      await authFetch(`${ENDPOINT}/reorder`, {
        method: "POST",
        body: JSON.stringify({ ids: next.map((r) => r.id) }),
      })
    } catch (err) {
      toast?.showError?.(err?.message || "Could not save the new order.")
      await load() // put the server's truth back on screen
    }
  }

  async function upload(file) {
    if (!file) return
    if (!file.type.startsWith("image/")) return toast?.showError?.("Choose an image file (PNG, JPG, WebP or SVG).")
    if (file.size > MAX_UPLOAD_BYTES) return toast?.showError?.("That image is over 5 MB. Compress it and try again.")
    setSaving(true)
    try {
      // SVGs are already vector — compressing them would rasterise the logo.
      const payload = file.type === "image/svg+xml" ? file : await compressImage(file)
      const fd = new FormData()
      fd.append("file", payload) // backend expects multer.single("file")
      const data = await authFetch("/api/v1/admin/media", { method: "POST", body: fd })
      const row = data?.data ?? data
      const url = row?.fileUrl || row?.url || row?.path || ""
      if (!url) throw new Error("Upload succeeded but no URL came back.")
      setEditing((p) => ({ ...(p || EMPTY), logoUrl: url }))
      toast?.showSuccess?.("Logo uploaded")
    } catch (err) {
      toast?.showError?.(err?.message || "Logo upload failed.")
    } finally {
      setSaving(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Clients" value={rows.length} />
        <Metric label="On the wall" value={activeCount} />
        <Metric label="Hidden" value={rows.length - activeCount} />
        <Metric label="Grid" value={`${Math.ceil(Math.max(activeCount, 1) / 4)} row(s) × 4`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-charcoal-80">Client logo wall</h2>
          <p className="text-[12.5px] text-charcoal-80/65">
            Shown on the About page. Order here is the order visitors see.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            aria-label="Reload"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80 hover:border-violet/40 hover:text-violet"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add client
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose/30 bg-rose/5 px-4 py-3 text-[13px] text-rose-700" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> {error}
        </div>
      ) : null}

      {/* Editor */}
      {editing ? (
        <form onSubmit={save} className="grid gap-3 rounded-2xl border border-violet/20 bg-violet-pale/30 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-[12px] font-semibold text-charcoal-80">
            Company name *
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${INPUT} mt-1`} placeholder="Colegio Interlaken" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80">
            Slug
            <input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className={`${INPUT} mt-1 font-mono`} placeholder="auto from the name" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80">
            Website
            <input value={editing.websiteUrl || ""} onChange={(e) => setEditing({ ...editing, websiteUrl: e.target.value })} className={`${INPUT} mt-1`} placeholder="https://…  (optional — makes the logo a link)" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80">
            Sector (English)
            <input value={editing.sector || ""} onChange={(e) => setEditing({ ...editing, sector: e.target.value })} className={`${INPUT} mt-1`} placeholder="K-12 school · Mexico" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80">
            Sector (Español)
            <input value={editing.sectorEs || ""} onChange={(e) => setEditing({ ...editing, sectorEs: e.target.value })} className={`${INPUT} mt-1`} placeholder="Colegio K-12 · México" />
          </label>
          <label className="text-[12px] font-semibold text-charcoal-80">
            Size on the wall — {Number(editing.scale).toFixed(2)}×
            <input
              type="range" min="0.5" max="2" step="0.05"
              value={editing.scale}
              onChange={(e) => setEditing({ ...editing, scale: Number(e.target.value) })}
              className="mt-3 w-full accent-[var(--color-violet)]"
            />
            <span className="mt-1 block text-[11px] font-normal text-charcoal-80/65">
              Nudge until this mark looks the same weight as its neighbours.
            </span>
          </label>

          {/* Logo */}
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="text-[12px] font-semibold text-charcoal-80">Logo *</span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white">
                {editing.logoUrl ? (
                  <img src={editing.logoUrl} alt="" className="max-h-12 max-w-[112px] object-contain" />
                ) : (
                  <span className="text-[11px] text-charcoal-80/65">No logo yet</span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] font-semibold text-charcoal-80 hover:border-violet/40 hover:text-violet disabled:opacity-60"
              >
                <Upload className="h-4 w-4" aria-hidden="true" /> Upload logo
              </button>
              <input
                value={editing.logoUrl}
                onChange={(e) => setEditing({ ...editing, logoUrl: e.target.value })}
                className={`${INPUT} max-w-sm font-mono`}
                placeholder="/images/brand/companies/acme.webp"
              />
            </div>
            <p className="mt-2 text-[11.5px] text-charcoal-80/65">
              A transparent PNG or WebP looks best — the wall tints alternate cells behind it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-charcoal-80">
              <input type="checkbox" checked={Boolean(editing.isActive)} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} className="h-4 w-4 accent-[var(--color-violet)]" />
              Show on the wall
            </label>
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-charcoal-80">
              <input type="checkbox" checked={Boolean(editing.boxed)} onChange={(e) => setEditing({ ...editing, boxed: e.target.checked })} className="h-4 w-4 accent-[var(--color-violet)]" />
              Logo has its own background
            </label>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3.5 py-2 text-[13px] font-semibold text-charcoal-80">
                <X className="h-4 w-4" aria-hidden="true" /> Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {editing.id ? "Save changes" : "Add client"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
            <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
              <tr>
                <th scope="col" className="px-4 py-3">Order</th>
                <th scope="col" className="px-4 py-3">Logo</th>
                <th scope="col" className="px-4 py-3">Company</th>
                <th scope="col" className="hidden px-4 py-3 md:table-cell">Sector</th>
                <th scope="col" className="px-4 py-3">Size</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-80/[0.06]">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/65">Loading clients…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/65">No clients yet — add the first one.</td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} className={`transition hover:bg-violet-pale/30 ${row.isActive ? "" : "opacity-55"}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${row.name} up`} className="rounded p-1 text-charcoal-80 hover:bg-violet-pale disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${row.name} down`} className="rounded p-1 text-charcoal-80 hover:bg-violet-pale disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex h-11 w-24 items-center justify-center rounded-md border border-charcoal-80/10 bg-mist">
                      <img src={row.logoUrl} alt="" className="max-h-8 max-w-[84px] object-contain" loading="lazy" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-charcoal-80">{row.name}</div>
                    <div className="font-mono text-[11px] text-charcoal-80/65">{row.slug}</div>
                    {row.websiteUrl ? (
                      <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-violet hover:underline">
                        Visit <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/70 md:table-cell">
                    <div>{row.sector || "—"}</div>
                    <div className="text-[11.5px] text-charcoal-80/65">{row.sectorEs || ""}</div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-charcoal-80/70">{Number(row.scale).toFixed(2)}×</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => toggleActive(row)} disabled={busyId === row.id} aria-label={row.isActive ? `Hide ${row.name}` : `Show ${row.name}`} title={row.isActive ? "Hide from the wall" : "Show on the wall"} className="rounded-md border border-charcoal-80/15 p-1.5 text-charcoal-80 hover:border-violet/40 hover:text-violet disabled:opacity-50">
                        {row.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <button type="button" onClick={() => setEditing({ ...row })} className="rounded-md border border-charcoal-80/15 px-2 py-1 text-[11.5px] font-semibold text-charcoal-80 hover:border-violet/40 hover:text-violet">
                        Edit
                      </button>
                      <button type="button" onClick={() => remove(row)} disabled={busyId === row.id} aria-label={`Remove ${row.name}`} className="rounded-md border border-rose/30 p-1.5 text-rose-700 hover:bg-rose/5 disabled:opacity-50">
                        {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live preview — the arrangement is the product, so show it. */}
      <div>
        <h3 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-charcoal-80">
          <Building2 className="h-4 w-4 text-violet" aria-hidden="true" /> Preview
        </h3>
        <p className="mb-3 text-[12px] text-charcoal-80/65">
          Exactly how the wall renders on the About page, with the current order and sizes.
        </p>
        <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white p-4">
          {previewRows.length ? (
            <LogoCloud companies={previewRows} />
          ) : (
            <p className="py-8 text-center text-[13px] text-charcoal-80/65">Nothing visible on the wall yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-charcoal-80/10 bg-white p-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/65">{label}</div>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-pale text-violet">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="text-[18px] font-extrabold tabular-nums text-charcoal-80">{value}</div>
      </div>
    </div>
  )
}
