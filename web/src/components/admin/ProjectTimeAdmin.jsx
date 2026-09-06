import { useCallback, useEffect, useState } from "react"
import { Clock, Plus, Trash2, Loader2, AlertCircle, Download } from "lucide-react"

import {
  fetchAdminProjectTime, logAdminProjectTime, deleteAdminProjectTime, adminTimeStatementUrl,
} from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectTimeAdmin · logging hours against a retainer (T5-18)
 *
 *  The client half of this is HoursLedger. This is where the number comes
 *  from, and the reason it is a form rather than a timer is that the work
 *  gets logged after it happens, on a Friday, from a notebook — so the DATE
 *  is a field and defaults to today rather than being taken from the clock.
 *
 *  MINUTES, NOT DECIMAL HOURS
 *
 *  "1.5" is a rounding argument waiting to happen. The field takes hours for
 *  the operator's convenience and sends minutes, because minutes are what
 *  make the month total exact.
 *
 *  NON-BILLABLE TIME IS STILL LOGGED
 *
 *  It shows on the client's ledger and does not count against the allowance.
 *  "We spent two hours on this and did not charge you" is worth saying, and
 *  it can only be said if it was recorded.
 *  ──────────────────────────────────────────────────────────────── */

const INPUT = "w-full rounded-xl border border-charcoal-80/15 bg-white px-3 py-2 text-sm text-charcoal-80 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"

const today = () => new Date().toISOString().slice(0, 10)

export default function ProjectTimeAdmin({ projectId, milestones = [] }) {
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ date: today(), hours: "", note: "", noteEs: "", milestoneId: "", billable: true })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLedger(await fetchAdminProjectTime(projectId))
      setError("")
    } catch (e) {
      setError(e?.message || "Could not load the hours")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    load()
  }, [projectId, load])

  const submit = async (e) => {
    e.preventDefault()
    const hours = Number(form.hours)
    if (!Number.isFinite(hours) || hours <= 0 || saving) return
    setSaving(true)
    setError("")
    try {
      await logAdminProjectTime(projectId, {
        date: form.date || undefined,
        // Rounded to the nearest minute here so the server never receives a
        // fraction of one and has to decide what to do with it.
        minutes: Math.round(hours * 60),
        note: form.note.trim() || null,
        noteEs: form.noteEs.trim() || null,
        milestoneId: form.milestoneId || null,
        billable: form.billable,
      })
      setForm((prev) => ({ ...prev, hours: "", note: "", noteEs: "" }))
      await load()
    } catch (err) {
      setError(err?.message || "Could not log that")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entry) => {
    if (!window.confirm(`Delete ${entry.hours} h on ${entry.date}?`)) return
    setBusyId(entry.id)
    setError("")
    try {
      await deleteAdminProjectTime(projectId, entry.id)
      await load()
    } catch (e) {
      setError(e?.message || "Could not delete that entry")
    } finally {
      setBusyId(null)
    }
  }

  const months = ledger?.months || []
  const allowance = ledger?.allowance || null

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <p className="text-meta text-charcoal-80/65">
        {allowance
          ? `${allowance.name || allowance.packageName} · ${allowance.includedHours} h included per month.`
          : "This project has no monthly allowance — the client sees the hours with nothing to measure them against."}
      </p>

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 md:grid-cols-[auto_auto_1fr_1fr_auto_auto] md:items-end">
        <label className="block text-meta font-semibold text-charcoal-80">
          Date
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-meta font-semibold text-charcoal-80">
          Hours
          <input
            required
            type="number"
            step="0.25"
            min="0.25"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            className={`${INPUT} mt-1 w-24`}
            placeholder="1.5"
          />
        </label>
        <label className="block text-meta font-semibold text-charcoal-80">
          What was done (English)
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${INPUT} mt-1`} placeholder="Fixed the enrolment form validation" />
        </label>
        <label className="block text-meta font-semibold text-charcoal-80">
          Spanish
          <input value={form.noteEs} onChange={(e) => setForm({ ...form, noteEs: e.target.value })} className={`${INPUT} mt-1`} placeholder="Arreglamos la validación del formulario" />
        </label>
        {milestones.length > 0 && (
          <label className="block text-meta font-semibold text-charcoal-80">
            Milestone
            <select value={form.milestoneId} onChange={(e) => setForm({ ...form, milestoneId: e.target.value })} className={`${INPUT} mt-1`}>
              <option value="">—</option>
              {milestones.map((ms) => <option key={ms.id} value={ms.id}>{ms.title}</option>)}
            </select>
          </label>
        )}
        <button type="submit" disabled={saving} className="inline-flex h-[42px] items-center gap-1.5 rounded-xl bg-violet px-3 text-meta font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Log
        </button>
        <label className="flex items-center gap-2 text-meta text-charcoal-80 md:col-span-6">
          <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
          Billable — uncheck for work the client sees and is not charged for.
        </label>
      </form>

      {loading ? (
        <p className="text-meta text-charcoal-80/65">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {months.filter((m) => m.entries.length > 0).map((month) => (
            <li key={month.month} className="rounded-xl border border-charcoal-80/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-meta font-semibold text-charcoal-80">{month.month}</p>
                <p className="font-mono text-[11px] text-charcoal-80/65">
                  {month.usedHours} h
                  {month.includedHours != null ? ` / ${month.includedHours} h` : ""}
                  {month.overHours > 0 ? ` · ${month.overHours} h over` : ""}
                  {month.nonBillableHours > 0 ? ` · ${month.nonBillableHours} h no charge` : ""}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-charcoal-80/10">
                {month.entries.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] text-charcoal-80/65">{entry.date}</span>
                      <span className="ms-2 text-micro text-charcoal-80">{entry.note || "—"}</span>
                      {!entry.billable && <span className="ms-2 rounded-md bg-charcoal-80/5 px-1.5 py-px text-[10px] font-bold uppercase text-charcoal-80/65">no charge</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-micro tabular-nums text-charcoal-80">{entry.hours} h</span>
                      <button
                        type="button"
                        disabled={busyId === entry.id}
                        onClick={() => remove(entry)}
                        title="Delete this entry"
                        className="rounded-lg p-1.5 text-charcoal-80/60 hover:bg-rose/10 hover:text-rose-700 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href={adminTimeStatementUrl(projectId, month.month)}
                className="mt-2 inline-flex items-center gap-1.5 text-meta font-semibold text-violet hover:underline"
              >
                <Download className="h-4 w-4" /> Statement for {month.month}
              </a>
            </li>
          ))}
          {months.every((m) => m.entries.length === 0) && (
            <li className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-6 text-center text-meta text-charcoal-80/65">
              <Clock className="mx-auto mb-2 h-5 w-5 text-charcoal-80/65" />
              No hours logged yet. A retainer client with no ledger has no way to know what they
              have left.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
