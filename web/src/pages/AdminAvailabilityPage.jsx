// ─────────────────────────────────────────────────────────────────────────────
// AdminAvailabilityPage.jsx — manage recurring rules + date-specific exceptions
//
// Layout:
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ PageHeader                                                            │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │ Rules section: 7-day grid + "Add rule" form                          │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │ Exceptions section: list + "Add exception" form                      │
//   └──────────────────────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar, Clock, Plus, Trash2, Globe2, AlertCircle, Save, ShieldOff, CalendarPlus, Loader2,
} from "lucide-react"
import { SectionCard, SkeletonCard, EmptyState } from "../components/ui/index"
import {
  adminListRules, adminCreateRule, adminDeleteRule,
  adminListExceptions, adminCreateException, adminDeleteException,
  getBrowserTimezone,
} from "../services/bookingService"
import { useToast } from "../context/ToastContext"

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } }

const WEEKDAYS = [
  { i: 0, name: "Sunday", short: "Sun" },
  { i: 1, name: "Monday", short: "Mon" },
  { i: 2, name: "Tuesday", short: "Tue" },
  { i: 3, name: "Wednesday", short: "Wed" },
  { i: 4, name: "Thursday", short: "Thu" },
  { i: 5, name: "Friday", short: "Fri" },
  { i: 6, name: "Saturday", short: "Sat" },
]

// ─────────────────────────────────────────────────────────────────────────────
// AddRuleForm
// ─────────────────────────────────────────────────────────────────────────────
function AddRuleForm({ defaultTimezone, onCreated }) {
  const toast = useToast()
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [slotDurationMin, setSlotDurationMin] = useState(30)
  const [bufferMin, setBufferMin] = useState(15)
  const [timezone, setTimezone] = useState(defaultTimezone)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (startTime >= endTime) { setError("End time must be after start time"); return }
    try {
      setSubmitting(true); setError("")
      const created = await adminCreateRule({
        dayOfWeek: Number(dayOfWeek),
        startTime, endTime,
        slotDurationMin: Number(slotDurationMin),
        bufferMin: Number(bufferMin),
        timezone,
      })
      toast?.show?.({ type: "success", title: "Rule added", message: `${WEEKDAYS[Number(dayOfWeek)].name} ${startTime}–${endTime}` })
      if (typeof onCreated === "function") onCreated(created)
    } catch (err) {
      setError(err?.message || "Could not save rule")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-dashed border-[#5D3FD3]/20 bg-[#F5F2FE] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5D3FD3]">
        <Plus className="h-3.5 w-3.5" /> Add a recurring rule
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Day">
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={inputCls}>
            {WEEKDAYS.map((d) => <option key={d.i} value={d.i}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Start time">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="End time">
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Slot length (min)">
          <input type="number" min="15" max="240" step="15" value={slotDurationMin} onChange={(e) => setSlotDurationMin(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Buffer (min)">
          <input type="number" min="0" max="120" step="5" value={bufferMin} onChange={(e) => setBufferMin(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Timezone">
          <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls} placeholder="America/Mexico_City" />
        </Field>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Add rule
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RulesByDay — visual weekly grid with delete buttons per rule
// ─────────────────────────────────────────────────────────────────────────────
function RulesByDay({ rules, onDelete }) {
  const grouped = useMemo(() => {
    const out = WEEKDAYS.map((d) => ({ ...d, items: [] }))
    rules.forEach((r) => { if (out[r.dayOfWeek]) out[r.dayOfWeek].items.push(r) })
    out.forEach((d) => d.items.sort((a, b) => (a.startTime > b.startTime ? 1 : -1)))
    return out
  }, [rules])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {grouped.map((d) => (
        <div key={d.i} className="rounded-xl border border-[#1A1B23]/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5D3FD3]">{d.short}</span>
            <span className="text-[10px] text-[#1A1B23]/45">{d.items.length} {d.items.length === 1 ? "rule" : "rules"}</span>
          </div>
          {d.items.length === 0 ? (
            <div className="rounded-xl bg-[#F5F2FE] p-3 text-center text-[11px] text-[#1A1B23]/45">Off</div>
          ) : (
            <div className="space-y-1.5">
              {d.items.map((r) => (
                <div key={r.id} className="group flex items-center justify-between gap-2 rounded-xl border border-[#1A1B23]/10 bg-[#F5F2FE] px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-[#5D3FD3]">{r.startTime}–{r.endTime}</div>
                    <div className="mt-0.5 truncate text-[10px] text-[#1A1B23]/55">
                      {r.slotDurationMin}min {r.bufferMin > 0 ? `· +${r.bufferMin}min` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    aria-label="Delete rule"
                    className="opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#1A1B23]/60" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddExceptionForm
// ─────────────────────────────────────────────────────────────────────────────
function AddExceptionForm({ defaultTimezone, onCreated }) {
  const toast = useToast()
  const [date, setDate] = useState("")
  const [type, setType] = useState("block")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("17:00")
  const [reason, setReason] = useState("")
  const [timezone, setTimezone] = useState(defaultTimezone)
  const [submitting,setSubmitting]= useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (!date) { setError("Date is required"); return }
    if (type === "custom" && startTime >= endTime) { setError("End time must be after start time"); return }
    try {
      setSubmitting(true); setError("")
      const payload = { date, type, timezone, reason: reason || null }
      if (type === "custom") { payload.startTime = startTime; payload.endTime = endTime }
      const created = await adminCreateException(payload)
      toast?.show?.({ type: "success", title: "Exception added", message: `${date} · ${type}` })
      setDate(""); setReason("")
      if (typeof onCreated === "function") onCreated(created)
    } catch (err) {
      setError(err?.message || "Could not save exception")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-dashed border-[#5D3FD3]/20 bg-[#F5F2FE] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5D3FD3]">
        <CalendarPlus className="h-3.5 w-3.5" /> Add an exception
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            <option value="block">Block (mark unavailable)</option>
            <option value="custom">Custom (add availability)</option>
          </select>
        </Field>
        {type === "custom" && (
          <>
            <Field label="Start time">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </Field>
            <Field label="End time">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
        <Field label="Timezone">
          <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Reason (internal)">
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="Holiday, travel…" />
        </Field>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Add exception
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-[#1A1B23]/15 bg-white px-3 py-2 text-[13px] text-[#5D3FD3] outline-none transition focus:border-[#5D3FD3]"
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1A1B23]/60">{label}</span>
      {children}
    </label>
  )
}

export default function AdminAvailabilityPage() {
  const toast = useToast()
  const defaultTimezone = useMemo(() => getBrowserTimezone(), [])
  const [rules, setRules] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadAll() {
    try {
      setLoading(true); setError("")
      const [rulesData, exceptionsData] = await Promise.all([
        adminListRules(),
        adminListExceptions(),
      ])
      setRules(rulesData)
      setExceptions(exceptionsData)
    } catch (err) {
      setError(err?.message || "Could not load availability data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function handleDeleteRule(rule) {
    if (!window.confirm(`Delete ${WEEKDAYS[rule.dayOfWeek].name} ${rule.startTime}–${rule.endTime}?`)) return
    try {
      await adminDeleteRule(rule.id)
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
      toast?.show?.({ type: "success", title: "Rule deleted" })
    } catch (err) {
      toast?.show?.({ type: "error", title: "Delete failed", message: err?.message || "" })
    }
  }

  async function handleDeleteException(ex) {
    if (!window.confirm(`Delete exception on ${new Date(ex.date).toLocaleDateString()}?`)) return
    try {
      await adminDeleteException(ex.id)
      setExceptions((prev) => prev.filter((e) => e.id !== ex.id))
      toast?.show?.({ type: "success", title: "Exception deleted" })
    } catch (err) {
      toast?.show?.({ type: "error", title: "Delete failed", message: err?.message || "" })
    }
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[180px]" />
        <SkeletonCard height="h-[280px]" />
      </section>
    )
  }

  return (
    <motion.section variants={fadeUp} initial="hidden" animate="show" className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Recurring rules */}
      <SectionCard
        title="Recurring weekly availability"
        subtitle="The hours clients see each week. Times are interpreted in the rule's timezone."
      >
        {rules.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No availability set yet"
            description="Add at least one weekly rule below, clients can't book until availability is defined."
          />
        ) : (
          <RulesByDay rules={rules} onDelete={handleDeleteRule} />
        )}

        <div className="mt-5">
          <AddRuleForm
            defaultTimezone={defaultTimezone}
            onCreated={(r) => setRules((prev) => [...prev, r])}
          />
        </div>
      </SectionCard>

      {/* Exceptions */}
      <SectionCard
        title="Date-specific exceptions"
        subtitle="Block specific days (vacation, holidays) or add custom availability outside your weekly rules."
      >
        {exceptions.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No exceptions"
            description="Your recurring rules apply on every matching weekday."
          />
        ) : (
          <div className="space-y-2">
            {exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#1A1B23]/10 bg-white px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${ex.type === "block" ? "bg-red-50 text-red-600" : "bg-[#e8f4ea] text-[#3b8f47]"}`}>
                    {ex.type === "block" ? <ShieldOff className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#5D3FD3]">
                      {new Date(ex.date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric", timeZone: ex.timezone })}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#1A1B23]/65">
                      {ex.type === "block" ? "Blocked" : `Custom · ${ex.startTime}–${ex.endTime}`}
                      {ex.reason ? ` · ${ex.reason}` : ""}
                      <span className="ml-2 text-[#1A1B23]/40">{ex.timezone}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteException(ex)}
                  aria-label="Delete exception"
                  className="text-[#1A1B23]/55 transition hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <AddExceptionForm
            defaultTimezone={defaultTimezone}
            onCreated={(ex) => setExceptions((prev) => [...prev, ex])}
          />
        </div>
      </SectionCard>

      <p className="text-center text-[11px] text-[#1A1B23]/55">
        <Globe2 className="mr-1 inline h-3 w-3" />
        Tip: clients always see times converted to their own timezone, set rules in the timezone you actually take calls.
      </p>
    </motion.section>
  )
}
