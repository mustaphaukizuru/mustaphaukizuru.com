import { useCallback, useEffect, useState } from "react"
import { KeyRound, Plus, Eye, Copy, Check, Loader2, AlertCircle } from "lucide-react"

import {
  fetchAdminSecrets, createAdminSecret, revealAdminSecret,
} from "../../services/clientProjectService"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectSecretsAdmin · the operator half of the credential handoff (T5-13)
 *
 *  Two directions on one list, and the direction decides everything:
 *
 *    to_client   we handed something over — the CLIENT reads it, once. This
 *                side sees the label and whether it has been collected, and
 *                gets no reveal button. If the sender could read it back,
 *                "read once" would only mean the recipient's copy was
 *                destroyed.
 *    to_admin    the client sent us something — this is the side that reads
 *                it, once, and then it is gone from the server too.
 *
 *  With no SECRET_HANDOFF_KEY on the server the form is HIDDEN rather than
 *  shown and then refused: an operator who clicks "share a credential" and
 *  gets a 503 puts the password in a support ticket instead.
 *  ──────────────────────────────────────────────────────────────── */

const INPUT = "w-full rounded-xl border border-charcoal-80/15 bg-white px-3 py-2 text-sm text-charcoal-80 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"

const STATE_CHIP = {
  pending: "bg-violet-pale text-violet",
  viewed: "bg-charcoal-80/5 text-charcoal-80/65",
  expired: "bg-amber/10 text-amber-700",
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—")

function SecretLine({ projectId, secret, onError }) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const reveal = async () => {
    if (busy) return
    setBusy(true)
    try {
      const out = await revealAdminSecret(projectId, secret.id)
      if (!out?.value) throw new Error("Nothing came back")
      setValue(out.value)
    } catch (e) {
      onError(e?.message || "Could not read it")
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* on screen and selectable — that is the fallback */ }
  }

  return (
    <li className="rounded-xl border border-charcoal-80/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-80/60" />
          <div className="min-w-0">
            <p className="text-meta font-semibold text-charcoal-80">{secret.label}</p>
            <p className="mt-1 font-mono text-[11px] text-charcoal-80/65">
              {secret.direction === "to_client" ? "you → client" : "client → you"}
              {` · sent ${fmtDate(secret.createdAt)}`}
              {secret.viewedAt
                ? ` · read ${fmtDate(secret.viewedAt)}`
                : ` · expires ${fmtDate(secret.expiresAt)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${STATE_CHIP[secret.state]}`}>
            {secret.state}
          </span>
          {secret.isRevealable && !value && (
            <button
              type="button"
              onClick={reveal}
              disabled={busy}
              title="Read it once — this destroys it"
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet/30 px-3 py-1.5 text-[11px] font-semibold text-violet hover:bg-violet-pale disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Reveal once
            </button>
          )}
        </div>
      </div>

      {value && (
        <div className="mt-3 rounded-xl border border-violet/30 bg-violet-pale/30 p-3">
          <p className="text-[11px] font-semibold text-violet">
            This is the only time it will be shown. The server has already destroyed its copy.
          </p>
          <div className="mt-2 flex items-start gap-2">
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1.5 font-mono text-[11px] text-charcoal-80">
              {value}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-charcoal-80/15 px-3 py-1.5 text-[11px] font-semibold text-charcoal-80 hover:bg-charcoal-80/5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function ProjectSecretsAdmin({ projectId }) {
  const [rows, setRows] = useState([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")
  const [ttlDays, setTtlDays] = useState("7")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const out = await fetchAdminSecrets(projectId)
      setRows(out.secrets)
      setConfigured(out.configured)
      setError("")
    } catch (e) {
      setError(e?.message || "Could not load the credential handoffs")
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
    if (!label.trim() || !value.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      await createAdminSecret(projectId, { label: label.trim(), value, ttlDays: Number(ttlDays) || undefined })
      setLabel("")
      setValue("")
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err?.message || "Could not store it")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!configured ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 text-meta text-amber-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Secure credential handoff is off on this server. Set{" "}
            <code className="font-mono">SECRET_HANDOFF_KEY</code> to 64 hex characters
            (<code className="font-mono">openssl rand -hex 32</code>) and restart. Until then, do not
            send credentials by any other route.
          </span>
        </div>
      ) : !formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-violet/30 px-3 py-2 text-meta font-semibold text-violet hover:bg-violet-pale"
        >
          <Plus className="h-4 w-4" /> Share a credential
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-charcoal-80/10 bg-white p-4">
          <label className="block text-meta font-semibold text-charcoal-80">
            What it is
            <input
              required
              value={label}
              maxLength={160}
              onChange={(e) => setLabel(e.target.value)}
              className={`${INPUT} mt-1`}
              placeholder="cPanel password · WordPress admin · SFTP key"
            />
            <span className="mt-1 block text-[11px] font-normal text-charcoal-80/65">
              The client sees this label in the clear. Never put the value in it.
            </span>
          </label>
          <label className="block text-meta font-semibold text-charcoal-80">
            The credential
            <textarea
              required
              rows={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${INPUT} mt-1 font-mono`}
              autoComplete="off"
              spellCheck={false}
              placeholder="Pasted exactly. Encrypted before it is stored."
            />
          </label>
          <label className="block text-meta font-semibold text-charcoal-80">
            Expires in
            <select value={ttlDays} onChange={(e) => setTtlDays(e.target.value)} className={`${INPUT} mt-1`}>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
            <span className="mt-1 block text-[11px] font-normal text-charcoal-80/65">
              An unclaimed credential is a liability, not an inbox. It can always be sent again.
            </span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-3 py-2 text-meta font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Store and notify
            </button>
            <button type="button" onClick={() => { setFormOpen(false); setLabel(""); setValue("") }} className="rounded-xl px-3 py-2 text-meta font-semibold text-charcoal-80/70 hover:bg-charcoal-80/5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-meta text-charcoal-80/65">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-charcoal-80/15 px-4 py-6 text-center text-meta text-charcoal-80/65">
          Nothing has been handed over on this project. Credentials must not travel as files or in
          email — this is the route for them.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((secret) => (
            <SecretLine key={secret.id} projectId={projectId} secret={secret} onError={setError} />
          ))}
        </ul>
      )}
    </div>
  )
}
