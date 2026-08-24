/* ════════════════════════════════════════════════════════════════════════
   AdminSessionsPage.jsx · /admin/sessions
   Active sign-ins across the platform with revoke capability.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import {
  Activity, RefreshCw, Search, X, Globe, Monitor, Smartphone, Tablet,
  AlertCircle, ShieldX,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { ConfirmModal } from "../components/admin/forms"

function formatRelative(iso) {
  if (!iso) return "-"
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function pickDeviceIcon(ua = "") {
  const s = String(ua).toLowerCase()
  if (s.includes("mobile") || s.includes("iphone") || s.includes("android")) return Smartphone
  if (s.includes("ipad") || s.includes("tablet")) return Tablet
  return Monitor
}

export default function AdminSessionsPage() {
  const toast = useToast()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [pendingRevoke, setPendingRevoke] = useState(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest("/api/v1/admin/sessions")
      setSessions(res.sessions || [])
    } catch (err) {
      setError(err?.message || "Failed to load sessions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search) return sessions
    const term = search.toLowerCase()
    return sessions.filter((s) =>
      (s.user?.email || "").toLowerCase().includes(term) ||
      (s.user?.fullName || "").toLowerCase().includes(term) ||
      (s.ip || "").includes(term)
    )
  }, [sessions, search])

  async function confirmRevoke() {
    if (!pendingRevoke) return
    try {
      await apiRequest(`/api/v1/admin/sessions/${pendingRevoke.id}`, { method: "DELETE" })
      toast?.success?.("Session revoked")
      setPendingRevoke(null)
      load()
    } catch (err) {
      toast?.error?.(err?.message || "Revoke failed")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-charcoal-80">{filtered.length} active session{filtered.length === 1 ? "" : "s"}</div>
            <div className="text-[12.5px] text-charcoal-80/55">Live sign-ins across the platform.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name, IP…"
              className="w-72 rounded-lg border border-charcoal-80/15 bg-white py-2 pl-9 pr-9 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-charcoal-80/45 hover:bg-charcoal-80/[0.06]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <button type="button" onClick={load} aria-label="Reload" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
          <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">
            <tr>
              <th scope="col" className="px-4 py-3">User</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">Device</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">IP & location</th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">Last seen</th>
              <th scope="col" className="hidden px-4 py-3 md:table-cell">Created</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-80/[0.06]">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/55">Loading sessions…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-charcoal-80/55">No active sessions.</td></tr>
            ) : filtered.map((s) => {
              const DeviceIcon = pickDeviceIcon(s.userAgent)
              return (
                <tr key={s.id} className="transition hover:bg-violet-pale/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-charcoal-80">{s.user?.fullName || "Unknown"}</div>
                    <div className="text-[12px] text-charcoal-80/55">{s.user?.email || s.userId}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/70 sm:table-cell">
                    <div className="inline-flex items-center gap-1.5">
                      <DeviceIcon className="h-3.5 w-3.5 text-charcoal-80/55" />
                      <span className="line-clamp-1 max-w-[200px]">{s.device || "-"}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/65 lg:table-cell">
                    <div className="font-mono text-[11.5px]">{s.ip || "-"}</div>
                    {s.location ? (
                      <div className="inline-flex items-center gap-1 text-[11px] text-charcoal-80/45">
                        <Globe className="h-3 w-3" /> {s.location}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-charcoal-80/65 md:table-cell">{formatRelative(s.lastSeenAt || s.createdAt)}</td>
                  <td className="hidden px-4 py-3 text-charcoal-80/45 md:table-cell">{formatRelative(s.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setPendingRevoke(s)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-rose-700 transition hover:bg-rose/10"
                    >
                      <ShieldX className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(pendingRevoke)}
        onClose={() => setPendingRevoke(null)}
        onConfirm={confirmRevoke}
        title="Revoke session?"
        confirmLabel="Revoke"
        tone="danger"
      >
        <p className="text-[13px] text-charcoal-80/65">
          <strong>{pendingRevoke?.user?.fullName || pendingRevoke?.user?.email}</strong> will be signed out
          on this device immediately. They can sign back in normally.
        </p>
      </ConfirmModal>
    </div>
  )
}
