import { useCallback, useEffect, useState } from "react"
import { Users, Plus, Trash2, Loader2, AlertCircle, Check, Clock } from "lucide-react"

import {
  fetchProjectMembers, addProjectMember, removeProjectMember,
} from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectMembersAdmin · the other people on the client's side (T5-17)
 *
 *  Schools were the driver and they are the ordinary case: a director who
 *  approves the work and signs off the money, and an IT person who uploads
 *  the files. Before this the project belonged to one User row, so the second
 *  person either shared a password or forwarded every email — and every
 *  approval came from an account that was not the person approving.
 *
 *  TWO ROLES, AND THE DIFFERENCE IS ONE SENTENCE
 *
 *    approver  may approve milestones, accept quotes and pay
 *    viewer    may read, upload, comment and open tickets, and may not
 *              commit the client to anything
 *
 *  "Viewer" is deliberately not called read-only: the IT person's whole job
 *  is to send us files.
 *
 *  A member needs no account. The email is the identity; until they sign up
 *  they reach the project through the tracking code and a PIN sent to their
 *  own inbox. `acceptedAt` is the honest answer to "did the invitation
 *  work?", which is otherwise guesswork.
 *  ──────────────────────────────────────────────────────────────── */

const INPUT = "w-full rounded-xl border border-charcoal-80/15 bg-white px-3 py-2 text-sm text-charcoal-80 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"

const ROLE_CHIP = {
  approver: "bg-violet-pale text-violet",
  viewer: "bg-charcoal-80/5 text-charcoal-80/65",
}

const ROLE_HELP = {
  approver: "Approves milestones, accepts quotes, can pay.",
  viewer: "Reads, uploads, comments. Cannot approve or pay.",
}

export default function ProjectMembersAdmin({ projectId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [role, setRole] = useState("viewer")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      setRows(await fetchProjectMembers(projectId))
      setError("")
    } catch (e) {
      setError(e?.message || "Could not load the contacts")
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
    if (!email.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      // The same address twice is an EDIT, not an error — "add the director
      // again as an approver" is the natural way to change a role.
      await addProjectMember(projectId, { email: email.trim(), name: name.trim() || null, role })
      setEmail("")
      setName("")
      await load()
    } catch (err) {
      setError(err?.message || "Could not add that contact")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (member) => {
    if (!window.confirm(`Remove ${member.email} from this project?`)) return
    setBusyId(member.id)
    setError("")
    try {
      await removeProjectMember(projectId, member.id)
      await load()
    } catch (e) {
      setError(e?.message || "Could not remove that contact")
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

      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 md:grid-cols-[2fr_1.5fr_1fr_auto] md:items-end">
        <label className="block text-meta font-semibold text-charcoal-80">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${INPUT} mt-1`}
            placeholder="it@colegiovista.mx"
          />
        </label>
        <label className="block text-meta font-semibold text-charcoal-80">
          Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} mt-1`} placeholder="Luis Hernández" />
        </label>
        <label className="block text-meta font-semibold text-charcoal-80">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className={`${INPUT} mt-1`}>
            <option value="viewer">Viewer</option>
            <option value="approver">Approver</option>
          </select>
        </label>
        <button type="submit" disabled={saving} className="inline-flex h-[42px] items-center gap-1.5 rounded-xl bg-violet px-3 text-meta font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </button>
        <p className="text-[11px] text-charcoal-80/65 md:col-span-4">{ROLE_HELP[role]}</p>
      </form>

      {loading ? (
        <p className="text-meta text-charcoal-80/65">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-6 text-center text-meta text-charcoal-80/65">
          Only the account holder can reach this project. Add the people who actually do the work —
          they get in with the tracking code and a PIN sent to their own inbox, with no account
          needed.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((member) => (
            <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-80/60" />
                <div className="min-w-0">
                  <p className="truncate text-meta font-semibold text-charcoal-80">
                    {member.name ? `${member.name} · ` : ""}{member.email}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-charcoal-80/65">
                    {member.acceptedAt ? (
                      <span className="inline-flex items-center gap-1 text-mint-700">
                        <Check className="h-3 w-3" /> reached the project
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> invited, not yet in
                      </span>
                    )}
                    <span>{member.hasAccount ? "has an account" : "email only"}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${ROLE_CHIP[member.role] || ROLE_CHIP.viewer}`}>
                  {member.role}
                </span>
                <button
                  type="button"
                  disabled={busyId === member.id}
                  onClick={() => remove(member)}
                  title="Remove from this project"
                  className="rounded-lg p-2 text-charcoal-80/60 hover:bg-rose/10 hover:text-rose-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
