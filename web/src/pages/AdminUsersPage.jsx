import { useEffect, useMemo, useState } from "react"
import {
  Users, Shield, User, UserCheck, UserX, ShieldCheck, RotateCcw, Loader2,
} from "lucide-react"
import { MetricCard, AlertBanner, SkeletonCard } from "../components/ui/index"
import {
  fetchAdminUsers,
  updateUserStatus,
  updateUserRole,
} from "../services/adminUserService"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"
import { useToast } from "../context/ToastContext"
import { getStoredUser } from "../lib/api"
import { ConfirmModal } from "../components/admin/forms"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminUsersPage · Option B · Wired CRUD
 *
 *  Per-row actions:
 *    - Suspend / Activate (toggles UserStatus enum)
 *    - Promote to admin / Demote to member (toggles role)
 *
 *  Backend endpoints:
 *    GET   /api/v1/admin/users                  list + metrics
 *    PATCH /api/v1/admin/users/:id/status       suspend / activate / pending
 *    PATCH /api/v1/admin/users/:id/role         admin / member
 *
 *  Self-mutation guard mirrored client-side; server enforces too.
 *  ──────────────────────────────────────────────────────────────────── */

export default function AdminUsersPage() {
  const { showSuccess, showError } = useToast()

  const [data, setData] = useState({ users: [], metrics: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const [me, setMe] = useState(null)
  // Pending confirm: { kind: "status" | "role", user, next, title, body, confirmLabel }
  const [pending, setPending] = useState(null)

  useEffect(() => {
    try {
      const stored = getStoredUser()
      if (stored) setMe(stored)
    } catch {
      /* ignore */
    }
  }, [])

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminUsers()
      if (import.meta.env.DEV) console.info("[Users] loaded", result.users.length, "users", result.metrics)
      setData(result)
    } catch (err) {
      console.error("[Users] load failed:", err)
      const msg = err.message || "Failed to load users."
      setError(msg)
      showError(msg, "Could not load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load()   }, [])

  async function handleStatus(user, nextStatus, opts = {}) {
    if (!user?.id) return
    if (me?.id === user.id) {
      showError("You cannot change your own account status.", "Self-action blocked")
      return
    }
    if (nextStatus === "suspended" && !opts.confirmed) {
      setPending({
        kind: "status", user, next: nextStatus,
        title: `Suspend ${user.fullName || user.email}?`,
        body: "They will lose access to the platform until reactivated.",
        confirmLabel: "Suspend",
      })
      return
    }
    setBusyId(user.id)
    try {
      const updated = await updateUserStatus(user.id, nextStatus)
      if (import.meta.env.DEV) console.info("[Users] status updated", updated)
      const subject = user.fullName || user.email
      const message =
        nextStatus === "active" ? `${subject} reactivated` :
        nextStatus === "suspended" ? `${subject} suspended` :
        `${subject} marked ${nextStatus}`
      showSuccess(message)
      await load()
    } catch (err) {
      console.error("[Users] status update failed:", err)
      showError(err.message || "Status update failed", "Could not update user")
    } finally {
      setBusyId("")
    }
  }

  async function handleRole(user, nextRole, opts = {}) {
    if (!user?.id) return
    if (me?.id === user.id && nextRole !== "admin") {
      showError("You cannot remove your own admin role.", "Self-action blocked")
      return
    }
    const verb = nextRole === "admin" ? "Promote" : "Demote"
    if (!opts.confirmed) {
      setPending({
        kind: "role", user, next: nextRole,
        title: `${verb} ${user.fullName || user.email} ${nextRole === "admin" ? "to admin" : "to member"}?`,
        body: nextRole === "admin"
          ? "Admins can manage every part of the platform."
          : "They will lose access to the admin area immediately.",
        confirmLabel: verb,
      })
      return
    }
    setBusyId(user.id)
    try {
      const updated = await updateUserRole(user.id, nextRole)
      if (import.meta.env.DEV) console.info("[Users] role updated", updated)
      const subject = user.fullName || user.email
      showSuccess(
        nextRole === "admin"
          ? `${subject} promoted to admin`
          : `${subject} demoted to member`
      )
      await load()
    } catch (err) {
      console.error("[Users] role update failed:", err)
      showError(err.message || "Role update failed", "Could not update role")
    } finally {
      setBusyId("")
    }
  }

  const { users = [], metrics = {} } = data

  async function confirmPending() {
    const p = pending
    if (!p) return
    setPending(null)
    if (p.kind === "status") await handleStatus(p.user, p.next, { confirmed: true })
    else await handleRole(p.user, p.next, { confirmed: true })
  }

  const columns = useMemo(() => [
    {
      key: "fullName", label: "Name", sortable: true, searchable: true, width: "1.4fr",
      getValue: (row) => row.fullName || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-meta font-semibold text-violet">{row.fullName || "-"}</div>
        </div>
      ),
    },
    {
      key: "email", label: "Email", sortable: true, searchable: true, width: "1.6fr",
      getValue: (row) => row.email || "",
      render: (row) => (
        <span className="truncate font-mono text-micro text-charcoal-80/75">{row.email}</span>
      ),
    },
    {
      key: "role", label: "Role", sortable: true, width: "0.7fr",
      getValue: (row) => row.role || "",
      render: (row) => <StatusPill status={row.role || "member"} />,
    },
    {
      key: "status", label: "Status", sortable: true, width: "0.8fr",
      getValue: (row) => row.status || "active",
      render: (row) => <StatusPill status={row.status || "active"} />,
    },
    {
      key: "orders", label: "Orders", sortable: true, width: "0.5fr", align: "center",
      getValue: (row) => row._count?.orders ?? 0,
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row._count?.orders ?? 0}
        </span>
      ),
    },
    {
      key: "createdAt", label: "Joined", sortable: true, width: "0.9fr", align: "right",
      getValue: (row) => row.createdAt,
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/55">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions", label: "Actions", sortable: false, width: "1.6fr", align: "right",
      render: (row) => (
        <RowActions
          user={row}
          isMe={me?.id === row.id}
          busy={busyId === row.id}
          onStatus={handleStatus}
          onRole={handleRole}
        />
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId, me])

  if (loading && users.length === 0) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[400px]" />
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <AlertBanner type="error" message={error} onDismiss={() => setError("")} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Users" value={metrics.total ?? 0} icon={Users} tone="purple" />
        <MetricCard title="Admins" value={metrics.admins ?? 0} icon={Shield} tone="blue" />
        <MetricCard title="Members" value={metrics.members ?? 0} icon={User} tone="amber" />
        <MetricCard title="Active" value={metrics.active ?? 0} icon={UserCheck} tone="green" />
      </div>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={load}
        initialSort={{ key: "createdAt", dir: "desc" }}
        searchPlaceholder="Search by name or email…"
        emptyState={{
          icon: Users,
          title: "No users yet",
          description: "Registered accounts will appear here as members sign up.",
        }}
      />

      <ConfirmModal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
        title={pending?.title}
        confirmLabel={pending?.confirmLabel || "Confirm"}
        tone={pending?.kind === "status" ? "danger" : "primary"}
      >
        <p className="text-sm text-charcoal-80">{pending?.body}</p>
      </ConfirmModal>
    </section>
  )
}

function RowActions({ user, isMe, busy, onStatus, onRole }) {
  const isAdmin = user.role === "admin"
  const isSuspended = user.status === "suspended"

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {isMe && (
        <span
          className="inline-flex items-center rounded-md bg-violet-pale px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-violet"
          aria-label="This is your account"
        >
          You
        </span>
      )}

      {!isMe && (isAdmin ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRole(user, "member")}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-charcoal-80 transition hover:bg-mist disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          aria-label={`Demote ${user.fullName || user.email} to member`}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Demote
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRole(user, "admin")}
          className="inline-flex items-center gap-1 rounded-md border border-violet/25 bg-violet-pale px-2 py-1 text-[11px] font-semibold text-violet transition hover:bg-violet/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          aria-label={`Promote ${user.fullName || user.email} to admin`}
        >
          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Promote
        </button>
      ))}

      {!isMe && (isSuspended ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(user, "active")}
          className="inline-flex items-center gap-1 rounded-md border border-mint/30 bg-mint/15 px-2 py-1 text-[11px] font-semibold text-mint-700 transition hover:bg-mint/25 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          aria-label={`Reactivate ${user.fullName || user.email}`}
        >
          <UserCheck className="h-3 w-3" aria-hidden="true" /> Activate
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(user, "suspended")}
          className="inline-flex items-center gap-1 rounded-md border border-rose/20 bg-rose/5 px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40"
          aria-label={`Suspend ${user.fullName || user.email}`}
        >
          <UserX className="h-3 w-3" aria-hidden="true" /> Suspend
        </button>
      ))}

      {busy && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet" aria-hidden="true" />
      )}
    </div>
  )
}
