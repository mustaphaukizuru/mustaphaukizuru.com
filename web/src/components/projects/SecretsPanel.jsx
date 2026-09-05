import { useState } from "react"
import { useTranslation } from "react-i18next"
import { KeyRound, Eye, Send, Copy, Check, Lock, AlertCircle } from "lucide-react"
import { Button, Input, Textarea, InlineBanner, EmptyStateSurface } from "../ui"

/* ──────────────────────────────────────────────────────────────────────────
 *  SecretsPanel · a credential in transit, and nothing else (T5-13)
 *
 *  Rendered on both client surfaces — the signed-in project page and the PIN
 *  portal — with the two handlers from useProjectPanels, which is the only
 *  thing that differs between them.
 *
 *  Two halves, and both exist to stop the same habit:
 *
 *    RECEIVE  a credential we sent, readable ONCE. The page says so before
 *             the click, not after, because a client who clicks and then
 *             closes the tab has lost it and will ask for it again by email
 *             — in plain text, which is exactly what this replaces.
 *
 *    SEND     a credential going the other way. The portal is where this
 *             matters most: a client with no account, on a forwarded link,
 *             who has been asked for the hosting password. Without a box to
 *             put it in they reply to the email with it in the body.
 *
 *  The revealed value is never written to storage, never put in a URL and
 *  never re-fetched. It exists in this component's state until the page is
 *  left, and the server has already destroyed its copy.
 *  ──────────────────────────────────────────────────────────────── */

const STATE_TONE = {
  pending: "bg-violet-pale text-violet",
  viewed: "bg-charcoal-80/5 text-charcoal-80/65",
  expired: "bg-amber/10 text-amber-700",
}

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  : "—"

/* ── one row ─────────────────────────────────────────────────────────── */

function SecretRow({ secret, onReveal, t }) {
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const reveal = async () => {
    if (busy) return
    setBusy(true); setError("")
    try {
      const out = await onReveal(secret.id)
      if (!out?.value) throw new Error(t("projects.secrets.revealError"))
      setValue(out.value)
    } catch (e) {
      setError(e?.message || t("projects.secrets.revealError"))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // A clipboard permission refusal is not an error worth showing: the
      // value is on screen and selectable, which is the fallback.
    }
  }

  return (
    <li className="rounded-lg border border-charcoal-80/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-meta font-semibold text-charcoal-80">{secret.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-charcoal-80/65">
            <span className={`rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider ${STATE_TONE[secret.state]}`}>
              {t(`projects.secrets.state.${secret.state}`)}
            </span>
            <span>
              {secret.state === "pending"
                ? t("projects.secrets.expiresOn", { date: fmtDate(secret.expiresAt) })
                : t("projects.secrets.sentOn", { date: fmtDate(secret.createdAt) })}
            </span>
          </div>
        </div>

        {secret.isRevealable && !value ? (
          <Button size="sm" icon={Eye} loading={busy} onClick={reveal}>
            {t("projects.secrets.reveal")}
          </Button>
        ) : null}
      </div>

      {/* Said BEFORE the click. After it, the warning is a post-mortem. */}
      {secret.isRevealable && !value ? (
        <p className="mt-2 flex items-start gap-1.5 text-micro text-charcoal-80/75">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("projects.secrets.onceWarning")}
        </p>
      ) : null}

      {error ? <InlineBanner tone="danger" className="mt-3">{error}</InlineBanner> : null}

      {value ? (
        <div className="mt-3 rounded-lg border border-violet/30 bg-violet-pale/30 p-3">
          <p className="text-micro font-semibold text-violet">{t("projects.secrets.onlyTime")}</p>
          <div className="mt-2 flex items-start gap-2">
            {/* Selectable and wrapped rather than an input: a credential with
                a newline in it (a private key, an app password) has to be
                copyable in full. */}
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-all rounded-md bg-white px-2 py-1.5 font-mono text-micro text-charcoal-80">
              {value}
            </code>
            <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copy}>
              {copied ? t("projects.secrets.copied") : t("projects.secrets.copy")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/* ── send one ────────────────────────────────────────────────────────── */

function SendForm({ onSend, onDone, t }) {
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e) => {
    e.preventDefault()
    if (!label.trim() || !value.trim() || busy) return
    setBusy(true); setError("")
    try {
      await onSend({ label: label.trim(), value })
      setLabel(""); setValue("")
      onDone()
    } catch (ex) {
      setError(ex?.message || t("projects.secrets.sendError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-violet/15 bg-violet-pale/30 p-4" noValidate>
      {error ? <InlineBanner tone="danger">{error}</InlineBanner> : null}
      <Input
        label={t("projects.secrets.form.label")}
        value={label}
        maxLength={160}
        required
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t("projects.secrets.form.labelPlaceholder")}
      />
      <Textarea
        label={t("projects.secrets.form.value")}
        value={value}
        rows={3}
        required
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("projects.secrets.form.valuePlaceholder")}
        // No autofill, no spellcheck, no browser suggestions. A password
        // manager offering to save this into the wrong site is the sort of
        // thing that happens once and is never noticed.
        inputClass="font-mono"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="text-micro text-charcoal-80/75">{t("projects.secrets.form.hint")}</p>
      <div className="flex justify-end">
        <Button type="submit" size="sm" icon={Send} loading={busy} disabled={!label.trim() || !value.trim()}>
          {t("projects.secrets.form.submit")}
        </Button>
      </div>
    </form>
  )
}

/* ── panel ───────────────────────────────────────────────────────────── */

export default function SecretsPanel({
  secrets = [],
  onReveal,
  onSend,
  onChanged,
  readOnly = false,
  className = "",
}) {
  const { t } = useTranslation("dashboard")
  const [sending, setSending] = useState(false)

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-meta text-charcoal-80/75">{t("projects.secrets.subtitle")}</p>
        {readOnly ? (
          <p className="flex items-center gap-1.5 text-micro text-charcoal-80/65">
            <Lock className="size-3.5" aria-hidden="true" /> {t("projects.secrets.readOnly")}
          </p>
        ) : !sending ? (
          <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setSending(true)}>
            {t("projects.secrets.send")}
          </Button>
        ) : null}
      </div>

      {sending && !readOnly ? (
        <div className="mb-3">
          <SendForm
            t={t}
            onSend={onSend}
            onDone={() => { setSending(false); onChanged?.() }}
          />
        </div>
      ) : null}

      {secrets.length === 0 ? (
        <EmptyStateSurface
          icon={KeyRound}
          title={t("projects.secrets.empty")}
          description={t("projects.secrets.emptyBody")}
          size="sm"
        />
      ) : (
        <ul className="space-y-3" aria-label={t("projects.secrets.title")}>
          {secrets.map((s) => (
            <SecretRow key={s.id} secret={s} onReveal={onReveal} t={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

export { SecretsPanel }
