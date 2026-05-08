/* ════════════════════════════════════════════════════════════════════════
   AdminRolesPage.jsx · /admin/roles
   List roles, view assigned permissions, create/edit/delete roles.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import {
  ShieldCheck, Plus, Edit2, Trash2, X, RefreshCw, AlertCircle, Lock,
  Users as UsersIcon,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"

const EMPTY_FORM = { id: null, name: "", description: "", permissionIds: [] }

export default function AdminRolesPage() {
  const toast = useToast()
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState(null) // null = closed; object = open
  const [pendingDelete, setPendingDelete] = useState(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [r, p] = await Promise.all([
        apiRequest("/api/v1/admin/roles"),
        apiRequest("/api/v1/admin/roles/permissions"),
      ])
      setRoles(r.roles || [])
      setPermissions(p.permissions || [])
    } catch (err) {
      setError(err?.message || "Failed to load.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setForm({ ...EMPTY_FORM })
  }
  function openEdit(role) {
    setForm({
      id: role.id,
      name: role.name,
      description: role.description || "",
      permissionIds: role.permissions.map((p) => p.id),
    })
  }
  function close() { setForm(null) }

  async function save() {
    try {
      const body = { name: form.name, description: form.description, permissionIds: form.permissionIds }
      if (form.id) {
        await apiRequest(`/api/v1/admin/roles/${form.id}`, { method: "PATCH", body: JSON.stringify(body) })
        toast?.success?.("Role updated")
      } else {
        await apiRequest("/api/v1/admin/roles", { method: "POST", body: JSON.stringify(body) })
        toast?.success?.("Role created")
      }
      close()
      load()
    } catch (err) {
      toast?.error?.(err?.message || "Save failed")
    }
  }

  async function confirmDelete() {
    try {
      await apiRequest(`/api/v1/admin/roles/${pendingDelete.id}`, { method: "DELETE" })
      toast?.success?.("Role deleted")
      setPendingDelete(null)
      load()
    } catch (err) {
      toast?.error?.(err?.message || "Delete failed")
    }
  }

  /* Group permissions by their key prefix (e.g., "orders.refund" → "orders"). */
  const groupedPermissions = useMemo(() => {
    const map = new Map()
    for (const p of permissions) {
      const group = (p.key || "").split(".")[0] || "other"
      if (!map.has(group)) map.set(group, [])
      map.get(group).push(p)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[20px] font-bold text-charcoal-80">{roles.length} role{roles.length === 1 ? "" : "s"}</div>
            <div className="text-[12.5px] text-charcoal-80/55">Roles bundle permissions and apply to admin team members.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} aria-label="Reload" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-violet-deep">
            <Plus className="h-4 w-4" /> New role
          </button>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div> : null}

      {/* Roles list */}
      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center text-charcoal-80/55">Loading roles…</div>
        ) : roles.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center text-charcoal-80/55">
            No roles yet. <button type="button" onClick={openCreate} className="font-semibold text-violet hover:underline">Create the first one</button>.
          </div>
        ) : roles.map((role) => (
          <div key={role.id} className="flex flex-col gap-3 rounded-2xl border border-charcoal-80/10 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-violet">{role.name}</h3>
                  {role.isSystem ? <Lock className="h-3.5 w-3.5 text-charcoal-80/45" aria-label="System role" /> : null}
                </div>
                {role.description ? <p className="mt-1 text-[13px] text-charcoal-80/65">{role.description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => openEdit(role)} aria-label="Edit role" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 hover:bg-violet-pale hover:text-violet">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(role)}
                  aria-label="Delete role"
                  disabled={role.isSystem}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-charcoal-80/55"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-charcoal-80/55">
              <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {role.userCount} user{role.userCount === 1 ? "" : "s"}</span>
              <span aria-hidden="true">·</span>
              <span>{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</span>
            </div>
            {role.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 8).map((p) => (
                  <span key={p.id} className="inline-flex items-center rounded-full bg-violet-pale/60 px-2 py-0.5 font-mono text-[10.5px] text-violet">
                    {p.key}
                  </span>
                ))}
                {role.permissions.length > 8 ? (
                  <span className="inline-flex items-center rounded-full bg-charcoal-80/[0.06] px-2 py-0.5 font-mono text-[10.5px] text-charcoal-80/55">
                    +{role.permissions.length - 8}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Form modal */}
      {form ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal-80/10 px-5 py-3">
              <h2 className="text-[16px] font-bold text-violet">{form.id ? "Edit role" : "New role"}</h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-charcoal-80/55 hover:bg-charcoal-80/[0.06]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex flex-col gap-4">
                <label>
                  <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">Name</div>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Editor · Support · Bookkeeper"
                    className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[14px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
                  />
                </label>
                <label>
                  <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">Description</div>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full resize-y rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
                  />
                </label>
                <div>
                  <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">Permissions</div>
                  <div className="flex flex-col gap-3">
                    {groupedPermissions.map(([group, perms]) => (
                      <div key={group} className="rounded-xl border border-charcoal-80/12 p-3">
                        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-charcoal-80/55">{group}</div>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((p) => {
                            const checked = form.permissionIds.includes(p.id)
                            return (
                              <label key={p.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition ${checked ? "border-violet bg-violet text-white" : "border-charcoal-80/15 bg-white text-charcoal-80/75 hover:border-violet/30 hover:bg-violet-pale/40"}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setForm({
                                      ...form,
                                      permissionIds: e.target.checked
                                        ? [...form.permissionIds, p.id]
                                        : form.permissionIds.filter((x) => x !== p.id),
                                    })
                                  }}
                                  className="sr-only"
                                />
                                {p.label || p.key}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {groupedPermissions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-charcoal-80/15 p-4 text-center text-[12.5px] text-charcoal-80/55">
                        No permissions defined yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-charcoal-80/10 px-5 py-3">
              <button type="button" onClick={close} className="rounded-lg border border-charcoal-80/15 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal-80 hover:bg-charcoal-80/[0.04]">Cancel</button>
              <button type="button" onClick={save} className="rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-deep">{form.id ? "Save changes" : "Create role"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {pendingDelete ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-[16px] font-bold text-charcoal-80">Delete role?</h2>
                <p className="mt-1 text-[13px] text-charcoal-80/65">
                  <strong>{pendingDelete.name}</strong> will be removed. Any users assigned to this role lose its
                  permissions immediately.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border border-charcoal-80/15 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal-80 hover:bg-charcoal-80/[0.04]">Cancel</button>
              <button type="button" onClick={confirmDelete} className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
