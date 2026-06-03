/**
 * AdminDiagnosticPage — /admin/diagnostic
 * View and manage self-audit lead submissions.
 */

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ClipboardCheck, TrendingUp, Users, Mail, Building2,
  GraduationCap, User, Download, ExternalLink, RefreshCw,
} from "lucide-react"
import { authGet } from "../lib/api"

const TIER_COLORS = {
  Foundation:  "bg-rose/10 text-rose",
  Stabilizing: "bg-amber/10 text-amber",
  Optimizing:  "bg-azure/10 text-azure",
  Mature:      "bg-mint/10 text-mint",
}

const AUD_ICON = { EDU: GraduationCap, SMB: Building2, IND: User }
const AUD_LABEL = { EDU: "School", SMB: "Business", IND: "Individual" }

export default function AdminDiagnosticPage() {
  const { t } = useTranslation("common")
  const [rows,    setRows]    = useState([])
  const [meta,    setMeta]    = useState({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const data = await authGet(`/api/v1/admin/diagnostic?page=${p}&limit=25`)
      setRows(data.data || [])
      setMeta(data.meta || { total: 0, page: p, pages: 1 })
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  /* Summary stats from current page */
  const byTier = rows.reduce((acc, r) => { acc[r.tier] = (acc[r.tier] || 0) + 1; return acc }, {})
  const avgScore = rows.length ? Math.round(rows.reduce((s, r) => s + r.overallScore, 0) / rows.length) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Self-Audit Leads</h1>
          <p className="mt-0.5 text-sm text-charcoal/55">Visitors who completed the digital maturity self-audit</p>
        </div>
        <button
          onClick={() => load(page)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/12 bg-white px-3 py-2 text-sm text-charcoal/65 hover:bg-charcoal/5 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Submissions", value: meta.total, icon: ClipboardCheck, color: "text-violet" },
          { label: "Avg Score",         value: `${avgScore}/100`, icon: TrendingUp, color: "text-azure" },
          { label: "This Page",         value: rows.length,      icon: Users,      color: "text-charcoal" },
          { label: "Email Sent",        value: rows.filter(r => r.emailSent).length, icon: Mail, color: "text-mint" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl bg-white border border-charcoal/8 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-charcoal/50 font-medium">{label}</span>
            </div>
            <div className="font-mono text-2xl font-bold text-charcoal">{value}</div>
          </div>
        ))}
      </div>

      {/* Tier distribution */}
      {Object.keys(byTier).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byTier).map(([tier, count]) => (
            <span key={tier} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${TIER_COLORS[tier] || "bg-charcoal/8 text-charcoal"}`}>
              {tier} · {count}
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-charcoal/8 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/8 bg-charcoal/[0.02]">
                {["Date","Contact","Audience","Score","Tier","Bundle","Email"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal/40">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-charcoal/40">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-charcoal/40">No submissions yet.</td></tr>
              )}
              {!loading && rows.map((row) => {
                const AudIcon = AUD_ICON[row.audience] || User
                const tierCls = TIER_COLORS[row.tier] || "bg-charcoal/8 text-charcoal"
                return (
                  <tr key={row.id} className="border-b border-charcoal/6 hover:bg-charcoal/[0.015] transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-charcoal/50 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-charcoal text-[13px]">{row.name || <span className="italic text-charcoal/35">Anonymous</span>}</div>
                      <div className="text-[12px] text-charcoal/50">{row.email}</div>
                      {row.organization && <div className="text-[11px] text-charcoal/35 mt-0.5">{row.organization}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <AudIcon className="h-3.5 w-3.5 text-charcoal/40" />
                        <span className="text-[12px] text-charcoal/65">{AUD_LABEL[row.audience] || row.audience}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[15px] font-bold text-charcoal">{row.overallScore}</span>
                      <span className="font-mono text-[11px] text-charcoal/35">/100</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${tierCls}`}>{row.tier}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="text-[12px] text-charcoal/60 line-clamp-1">{row.matchedBundle || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.emailSent
                          ? <span className="inline-flex items-center gap-1 text-[11px] text-mint font-semibold"><Mail className="h-3 w-3" /> Sent</span>
                          : <span className="text-[11px] text-charcoal/30">—</span>
                        }
                        <a
                          href={`mailto:${row.email}?subject=Your%20Self-Audit%20Results%20%E2%80%94%20Follow%20Up`}
                          className="text-charcoal/30 hover:text-violet transition"
                          title="Reply"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-charcoal/8 px-4 py-3">
            <span className="text-[12px] text-charcoal/50">
              {meta.total} total · page {meta.page} of {meta.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => load(page - 1)}
                className="rounded-lg border border-charcoal/12 px-3 py-1.5 text-[12px] text-charcoal/65 hover:bg-charcoal/5 disabled:opacity-40 transition"
              >← Prev</button>
              <button
                disabled={page >= meta.pages}
                onClick={() => load(page + 1)}
                className="rounded-lg border border-charcoal/12 px-3 py-1.5 text-[12px] text-charcoal/65 hover:bg-charcoal/5 disabled:opacity-40 transition"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
