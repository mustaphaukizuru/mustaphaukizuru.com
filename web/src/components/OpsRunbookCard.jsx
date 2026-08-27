/**
 * OpsRunbookCard — Tier 4 ops runbook for /admin/diagnostic.
 *
 * Reads GET /api/v1/admin/diagnostic/ops and renders traffic-light checks
 * (storage, backup, prisma, db, cron, pending operator steps) plus the exact
 * recovery commands from scripts/hostinger-recover.sh and CLAUDE.md. Admin
 * namespace — English only, no i18n.
 */

import { useEffect, useState } from "react"
import {
  HardDrive, DatabaseBackup, Database, Package, Clock, ListChecks,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, TerminalSquare, Cpu,
} from "lucide-react"
import { authGet } from "../lib/api"

const STATUS = {
  green: { icon: CheckCircle2, cls: "text-mint-700", bg: "bg-mint/10", label: "OK" },
  amber: { icon: AlertTriangle, cls: "text-amber-700", bg: "bg-amber/10", label: "Attention" },
  red:   { icon: XCircle,       cls: "text-rose",      bg: "bg-rose/10", label: "Action required" },
}

function bytes(n) {
  if (!Number.isFinite(n)) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function uptime(sec) {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.amber
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${s.bg} ${s.cls}`}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {s.label}
    </span>
  )
}

function Check({ icon: Icon, title, status, children }) {
  return (
    <div className="rounded-xl border border-charcoal/8 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Icon className="h-4 w-4 text-violet" strokeWidth={1.75} />
          {title}
        </span>
        <StatusPill status={status} />
      </div>
      <div className="text-[12px] text-charcoal/65">{children}</div>
    </div>
  )
}

function Commands({ title, lines }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal/65">{title}</div>
      <pre className="overflow-x-auto rounded-lg bg-charcoal/[0.04] p-2.5 font-mono text-[11.5px] leading-relaxed text-charcoal">
        {lines.join("\n")}
      </pre>
    </div>
  )
}

export default function OpsRunbookCard() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true); setError("")
    try {
      const r = await authGet("/api/v1/admin/diagnostic/ops")
      setReport(r?.data || null)
    } catch (e) {
      setError(e?.message || "Failed to load the ops runbook.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const overall = STATUS[report?.overall] || STATUS.amber
  const OverallIcon = overall.icon

  return (
    <section className="rounded-2xl border border-charcoal/8 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-charcoal">
            <TerminalSquare className="h-5 w-5 text-violet" strokeWidth={1.75} />
            Ops runbook
          </h2>
          <p className="mt-0.5 text-[12px] text-charcoal/65">Storage, backups, Prisma, database, cron and the operator steps still pending on this deploy.</p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${overall.bg} ${overall.cls}`}>
              <OverallIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {overall.label}
            </span>
          )}
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/12 bg-white px-3 py-2 text-sm text-charcoal/65 transition hover:bg-charcoal/5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {!report && loading && <p className="py-8 text-center text-sm text-charcoal/65">Loading…</p>}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Check icon={Database} title="Database" status={report.db.status}>
              {report.db.alive ? "SELECT 1 answered." : report.db.reason}
            </Check>

            <Check icon={DatabaseBackup} title="Latest backup" status={report.backup.status}>
              {report.backup.present ? (
                <>
                  <div className="truncate font-mono text-[11.5px] text-charcoal">{report.backup.name}</div>
                  <div>{bytes(report.backup.size)} · {report.backup.ageHours}h ago · {report.backup.count} on disk</div>
                  {report.backup.reason && <div className="mt-1 text-amber-700">{report.backup.reason}</div>}
                </>
              ) : (
                <span>{report.backup.reason}. Run <code className="font-mono">node scripts/backup-db-json.js</code>.</span>
              )}
            </Check>

            <Check icon={Package} title="Prisma" status={report.prisma.status}>
              <div>@prisma/client <span className="font-mono text-charcoal">{report.prisma.client.installed || "missing"}</span> (declared {report.prisma.client.declared || "—"})</div>
              <div>prisma CLI <span className="font-mono text-charcoal">{report.prisma.cli.installed || "missing"}</span> (declared {report.prisma.cli.declared || "—"})</div>
              {report.prisma.reason && <div className="mt-1 text-amber-700">{report.prisma.reason}</div>}
            </Check>

            <Check icon={Cpu} title="Runtime" status="green">
              <div>Node <span className="font-mono text-charcoal">{report.runtime.node}</span> · {report.runtime.nodeEnv}</div>
              <div>Up {uptime(report.runtime.uptimeSec)} · storage base <span className="font-mono text-[11px] text-charcoal">{report.runtime.storageBase}</span></div>
            </Check>

            <Check icon={Clock} title="Cron" status={report.cron.status}>
              {report.cron.disabled ? report.cron.reason : "DISABLE_CRON unset — scheduled jobs run."}
            </Check>

            <Check icon={ListChecks} title="Pending operator steps" status={report.pendingSteps.length ? "amber" : "green"}>
              {report.pendingSteps.length === 0 ? "All operator env keys are set." : (
                <ul className="space-y-1.5">
                  {report.pendingSteps.map((s) => (
                    <li key={s.key}>
                      <span className="font-mono font-semibold text-charcoal">{s.key}</span>
                      {s.note && <span className="ml-1">— {s.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Check>
          </div>

          {/* Storage table */}
          <div className="mt-5 overflow-hidden rounded-xl border border-charcoal/8">
            <div className="flex items-center gap-2 border-b border-charcoal/8 bg-charcoal/[0.02] px-4 py-2.5 text-sm font-semibold text-charcoal">
              <HardDrive className="h-4 w-4 text-violet" strokeWidth={1.75} />
              Storage paths
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-charcoal/8">
                    {["Key", "Path", "Exists", "Writable", "State"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-charcoal/65">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.storage.map((s) => (
                    <tr key={s.key} className="border-b border-charcoal/6">
                      <td className="px-4 py-2 font-mono text-[12px] font-semibold text-charcoal">{s.key}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-charcoal/65">
                        {s.path}
                        {s.warning && <div className="mt-0.5 text-amber-700">{s.warning}</div>}
                      </td>
                      <td className="px-4 py-2 text-[12px] text-charcoal/65">{s.exists ? "yes" : "no"}</td>
                      <td className="px-4 py-2 text-[12px] text-charcoal/65">{s.writable ? "yes" : "no"}</td>
                      <td className="px-4 py-2"><StatusPill status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recovery commands */}
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Commands title="Schema change on production (backup first)" lines={report.recovery.backupThenPush} />
            <Commands title="Restart (Passenger)" lines={report.recovery.restart} />
            <Commands title="Status / last stderr" lines={[...report.recovery.status, ...report.recovery.log]} />
            <Commands title="Broken node_modules / stale Prisma client" lines={[...report.recovery.recover, ...report.recovery.reinstall]} />
          </div>
          <p className="mt-2 text-[11px] text-charcoal/65">
            Generated {new Date(report.generatedAt).toLocaleString("en-US")} · .env points at production — never run db push without the backup line above.
          </p>
        </>
      )}
    </section>
  )
}
