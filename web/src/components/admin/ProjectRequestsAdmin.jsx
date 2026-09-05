import { useCallback, useEffect, useState } from "react"
import {
  FileQuestion, Plus, Check, X, Ban, Loader2, AlertCircle,
} from "lucide-react"

import {
  fetchAdminFileRequests, createAdminFileRequest, reviewAdminFileRequest,
  fetchFileRequestPresets,
} from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectRequestsAdmin · asking a client for a document, and reviewing it
 *  (T5-5, admin side)
 *
 *  The client-facing half of this is FileRequestPanel. This is the operator
 *  half: raise a request, then accept, reject with a note, or cancel it.
 *
 *  Both languages are entered here rather than translated later, because the
 *  request text is what the client reads in the email AND in the panel, and
 *  a Spanish client asked in English for "your most recent RFC" will send
 *  the wrong document. The Spanish fields are optional — the serializer
 *  falls back to English — but the form asks for them every time so the
 *  omission is a decision rather than an oversight.
 *  ──────────────────────────────────────────────────────────────────── */

const INPUT = "w-full rounded-xl border border-charcoal-80/15 bg-white px-3 py-2 text-sm text-charcoal-80 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"

const STATUS_CHIP = {
  requested: "bg-violet-pale text-violet",
  submitted: "bg-amber/10 text-amber-700",
  rejected: "bg-rose/10 text-rose-700",
  accepted: "bg-mint/15 text-mint-700",
  cancelled: "bg-charcoal-80/5 text-charcoal-80/65",
}

const BLANK = {
  title: "", titleEs: "",
  instructions: "", instructionsEs: "",
  acceptExt: "", dueAt: "", milestoneId: "",
}

export default function ProjectRequestsAdmin({ projectId, milestones = [] }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [busyId, setBusyId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [presets, setPresets] = useState([])

  const load = useCallback(async () => {
    try {
      setRows(await fetchAdminFileRequests(projectId))
      setError("")
    } catch (e) {
      setError(e?.message || "Could not load document requests")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Best-effort and separate from the rows: presets are a convenience, and
  // a form that will not open because a static list failed to load is worse
  // than one without shortcuts.
  useEffect(() => {
    fetchFileRequestPresets().then(setPresets).catch(() => setPresets([]))
  }, [])

  useEffect(() => {
    if (!projectId) return
    // Inside a callback rather than the effect body: setting state
    // synchronously there cascades a render before anything has loaded.
    load()
  }, [projectId, load])

  /**
   * Fill from a preset, keeping the two fields that are about THIS project
   * rather than about the document: the due date and the milestone.
   */
  const applyPreset = (preset) => setForm((prev) => ({
    ...prev,
    title: preset.title,
    titleEs: preset.titleEs || "",
    instructions: preset.instructions || "",
    instructionsEs: preset.instructionsEs || "",
    acceptExt: preset.acceptExt || "",
  }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      await createAdminFileRequest(projectId, {
        title: form.title.trim(),
        titleEs: form.titleEs.trim() || null,
        instructions: form.instructions.trim() || null,
        instructionsEs: form.instructionsEs.trim() || null,
        acceptExt: form.acceptExt.trim() || null,
        dueAt: form.dueAt || null,
        milestoneId: form.milestoneId || null,
      })
      setForm(BLANK)
      setFormOpen(false)
      await load()
    } catch (err) {
      // USE_SECRET_HANDOFF comes back when the title reads like a credential
      // ("hosting password"). The server's message names the alternative, so
      // it is shown as-is rather than replaced with something vaguer.
      setError(err?.message || "Could not create the request")
    } finally {
      setSaving(false)
    }
  }

  const review = async (request, action) => {
    // A rejection with no reason asks the client to guess, and they guess the
    // same file again. The server refuses it too; this is the earlier stop.
    const note = action === "reject"
      ? window.prompt("What needs to change? The client sees this note.")
      : null
    if (action === "reject" && !note?.trim()) return
    if (action === "cancel" && !window.confirm(`Cancel "${request.title}"?`)) return

    setBusyId(request.id)
    setError("")
    try {
      await reviewAdminFileRequest(projectId, request.id, { action, reviewNote: note?.trim() || null })
      await load()
    } catch (e) {
      setError(e?.message || "Could not update the request")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet/30 px-3 py-2 text-meta font-semibold text-violet hover:bg-violet-pale"
        >
          <Plus className="h-4 w-4" /> Request a document
        </button>
      )}

      {formOpen && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
          {presets.length > 0 && (
            <div>
              <p className="text-meta font-semibold text-charcoal-80">Start from a preset</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-charcoal-80/15 bg-white px-3 py-1 text-[11px] font-semibold text-charcoal-80 transition hover:border-violet hover:text-violet"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-charcoal-80/65">
                Fills both languages and the accepted types. Everything stays editable.
              </p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-meta font-semibold text-charcoal-80">
              Title (English)
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${INPUT} mt-1`} placeholder="Signed service agreement" />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80">
              Title (Spanish)
              <input value={form.titleEs} onChange={(e) => setForm({ ...form, titleEs: e.target.value })} className={`${INPUT} mt-1`} placeholder="Contrato de servicio firmado" />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80">
              Instructions (English)
              <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={`${INPUT} mt-1`} placeholder="Scan or photo is fine, all pages." />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80">
              Instructions (Spanish)
              <textarea rows={2} value={form.instructionsEs} onChange={(e) => setForm({ ...form, instructionsEs: e.target.value })} className={`${INPUT} mt-1`} placeholder="Escaneo o foto está bien, todas las páginas." />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80">
              Accepted types
              <input value={form.acceptExt} onChange={(e) => setForm({ ...form, acceptExt: e.target.value })} className={`${INPUT} mt-1 font-mono`} placeholder=".pdf,.jpg,.png — blank allows every permitted type" />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80">
              Due date
              <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} className={`${INPUT} mt-1`} />
            </label>
            <label className="block text-meta font-semibold text-charcoal-80 md:col-span-2">
              Milestone (optional)
              <select value={form.milestoneId} onChange={(e) => setForm({ ...form, milestoneId: e.target.value })} className={`${INPUT} mt-1`}>
                <option value="">Not tied to a milestone</option>
                {milestones.map((ms) => <option key={ms.id} value={ms.id}>{ms.title}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-meta font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Send request
            </button>
            <button type="button" onClick={() => { setFormOpen(false); setForm(BLANK) }} className="rounded-xl px-3 py-2 text-meta font-semibold text-charcoal-80/70 hover:bg-charcoal-80/5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-meta text-charcoal-80/65">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-6 text-center text-meta text-charcoal-80/65">
          Nothing has been requested from this client yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
              <div className="flex min-w-0 items-start gap-3">
                <FileQuestion className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-80/60" />
                <div className="min-w-0">
                  <p className="text-meta font-semibold text-charcoal-80">{r.title}</p>
                  {r.instructions && <p className="mt-0.5 text-[11px] text-charcoal-80/65">{r.instructions}</p>}
                  <p className="mt-1 font-mono text-[11px] text-charcoal-80/65">
                    {r.acceptExt || "any permitted type"}
                    {r.dueAt ? ` · due ${new Date(r.dueAt).toLocaleDateString()}` : ""}
                    {r.submittedAt ? ` · sent ${new Date(r.submittedAt).toLocaleDateString()}` : ""}
                  </p>
                  {r.reviewNote && <p className="mt-1 text-[11px] text-amber-700">{r.reviewNote}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${STATUS_CHIP[r.status] || STATUS_CHIP.cancelled}`}>
                  {r.status}
                </span>
                {/* Accept and reject only apply to something the client has
                    actually sent. Cancel applies to anything not already
                    settled — asking for a document that turned out not to be
                    needed should not stay on the client's list, whether or not
                    they have got round to sending it. */}
                {r.status === "submitted" && (
                  <>
                    <button type="button" disabled={busyId === r.id} onClick={() => review(r, "accept")} title="Accept" className="rounded-lg p-2 text-mint-700 hover:bg-mint/10 disabled:opacity-50">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => review(r, "reject")} title="Reject with a note" className="rounded-lg p-2 text-rose-700 hover:bg-rose/10 disabled:opacity-50">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {r.status !== "accepted" && r.status !== "cancelled" && (
                  <button type="button" disabled={busyId === r.id} onClick={() => review(r, "cancel")} title="Cancel this request" className="rounded-lg p-2 text-charcoal-80/60 hover:bg-charcoal-80/5 disabled:opacity-50">
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
