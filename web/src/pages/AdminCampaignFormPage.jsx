/* ════════════════════════════════════════════════════════════════════════
   AdminCampaignFormPage.jsx · /admin/campaigns/new · /admin/campaigns/:id/edit
   Compose a marketing email: subject, preheader, structured-block body,
   audience picker (newsletter / members / custom list), test send,
   schedule, and "send now".

   Form layer: useForm + lib/validation/campaign. Body blocks carry a
   client-side `id` (stable keys) that is stripped before the API call.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Save, Eye, Send, Plus, Trash2, ArrowUp, ArrowDown,
  Users as UsersIcon, MailCheck,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"
import BlogContentRenderer from "../components/blog/BlogContentRenderer"
import useForm from "../hooks/useForm"
import { campaignSchema } from "../lib/validation/campaign"
import { TextField, SelectField, ConfirmModal } from "../components/admin/forms"
import { Field, inputClass } from "../components/admin/Field"

/* ── Stable block ids ────────────────────────────────────────────────── */
const newId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
const withId = (block) => (block && block.id ? block : { ...block, id: newId() })
const migrateBlocks = (blocks) =>
  (Array.isArray(blocks) && blocks.length ? blocks : [{ type: "p", text: "" }]).map(withId)
const stripIds = (blocks) => blocks.map((b) => {
  const rest = { ...b }
  delete rest.id
  delete rest.itemKeys
  return rest
})

const EMPTY = {
  name: "",
  subject: "",
  preheader: "",
  fromName: "Mustapha Ukizuru",
  fromEmail: "hello@mustaphaukizuru.com",
  replyTo: "",
  body: [],
  status: "draft",
  audience: "newsletter",
  recipientEmails: [],
  scheduledAt: "",
}

const BLOCK_TYPES = [
  { value: "p", label: "Paragraph" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "list", label: "Bulleted list" },
  { value: "ordered", label: "Numbered list" },
  { value: "callout", label: "Callout" },
  { value: "quote", label: "Pull quote" },
  { value: "button", label: "CTA button" },
  { value: "divider", label: "Divider" },
]

const AUDIENCE_OPTIONS = [
  { value: "newsletter", label: "Newsletter subscribers" },
  { value: "members", label: "All members" },
  { value: "custom", label: "Custom list" },
]

const blockTemplate = (type = "p") =>
  withId(
    type === "list" || type === "ordered" ? { type, items: [""] }
    : type === "callout" ? { type, variant: "info", text: "" }
    : type === "button" ? { type, text: "Read on the blog", href: "https://mustaphaukizuru.com/blog" }
    : type === "divider" ? { type }
    : { type, text: "" },
  )

export default function AdminCampaignFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(isEdit)
  const [showPreview, setShowPreview] = useState(false)
  const [audienceCount, setAudienceCount] = useState(null)
  const [testEmail, setTestEmail] = useState("")
  const [confirmSend, setConfirmSend] = useState(false)
  const [recipientsText, setRecipientsText] = useState("")
  // Refs (not state) so the submit closure sees the latest values synchronously.
  const statusOverrideRef = useRef(null)
  const lastSavedRef = useRef(null)

  /* Save stores the persisted campaign in lastSavedRef so test-send / send-now can chain. */
  const form = useForm({
    schema: campaignSchema,
    initialValues: { ...EMPTY, body: migrateBlocks([]) },
    onSubmit: async (parsed) => {
      const payload = {
        ...parsed,
        body: stripIds(parsed.body),
        status: statusOverrideRef.current || parsed.status || "draft",
        scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt).toISOString() : null,
      }
      const res = isEdit
        ? await apiRequest(`/api/v1/admin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiRequest(`/api/v1/admin/campaigns`, { method: "POST", body: JSON.stringify(payload) })
      lastSavedRef.current = res.campaign
      toast?.showSuccess?.(isEdit ? "Campaign saved" : "Campaign created")
      if (!isEdit) navigate(`/admin/campaigns/${res.campaign.id}/edit`, { replace: true })
    },
  })
  const { values: campaign, setValue, setValues, setFormError } = form

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiRequest(`/api/v1/admin/campaigns/${id}`)
        if (cancelled) return
        const c = res.campaign || {}
        const recipientEmails = Array.isArray(c.recipientEmails) ? c.recipientEmails : []
        form.reset({
          ...EMPTY,
          ...c,
          recipientEmails,
          body: migrateBlocks(c.body),
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : "",
        })
        setRecipientsText(recipientEmails.join("\n"))
      } catch (err) {
        if (!cancelled) setFormError(err?.message || "Failed to load campaign.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit])

  /* Re-fetch audience count whenever audience config changes */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest(`/api/v1/admin/campaigns/audience-count`, {
          method: "POST",
          body: JSON.stringify({ audience: campaign.audience, recipientEmails: campaign.recipientEmails }),
        })
        if (!cancelled) setAudienceCount(res.count ?? 0)
      } catch {
        if (!cancelled) setAudienceCount(null)
      }
    })()
    return () => { cancelled = true }
  }, [campaign.audience, campaign.recipientEmails])

  /* ── Block ops keyed by id ─────────────────────────────────────────── */
  const setBody = (fn) => setValues((c) => ({ ...c, body: fn(c.body) }))
  const updateBlock = (blockId, patch) => setBody((body) => body.map((b) => (b.id === blockId ? { ...b, ...patch } : b)))
  const moveBlock = (blockId, dir) =>
    setBody((body) => {
      const i = body.findIndex((b) => b.id === blockId)
      const t = i + dir
      if (i < 0 || t < 0 || t >= body.length) return body
      const next = [...body]
      ;[next[i], next[t]] = [next[t], next[i]]
      return next
    })
  const addBlock = (type = "p") => setBody((body) => [...body, blockTemplate(type)])
  const removeBlock = (blockId) => setBody((body) => body.filter((b) => b.id !== blockId))

  /* handleSave(nextStatus) → persisted campaign or null. Uses a status
   * override so the same validated submit path serves draft / scheduled. */
  async function handleSave(nextStatus) {
    statusOverrideRef.current = nextStatus || null
    lastSavedRef.current = null
    const ok = await form.handleSubmit()
    statusOverrideRef.current = null
    return ok ? lastSavedRef.current : null
  }

  async function handleTestSend() {
    if (!testEmail) { toast?.showError?.("Enter a test email"); return }
    const saved = await handleSave()
    if (!saved?.id) return
    try {
      await apiRequest(`/api/v1/admin/campaigns/${saved.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to: testEmail }),
      })
      toast?.showSuccess?.(`Test sent to ${testEmail}`)
    } catch (err) {
      toast?.showError?.(err?.message || "Test send failed")
    }
  }

  async function handleSendNow() {
    const saved = await handleSave()
    if (!saved?.id) { setConfirmSend(false); return }
    try {
      const res = await apiRequest(`/api/v1/admin/campaigns/${saved.id}/send-now`, { method: "POST" })
      toast?.showSuccess?.(`Campaign sent · ${res.campaign.sentCount} delivered`)
      setConfirmSend(false)
      navigate("/admin/campaigns")
    } catch (err) {
      toast?.showError?.(err?.message || "Send failed")
      setConfirmSend(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center text-charcoal-80/55">Loading campaign…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/campaigns" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] font-semibold text-charcoal-80 hover:border-violet/40 hover:text-violet">
            <Eye className="h-4 w-4" /> {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button type="button" onClick={() => handleSave()} disabled={form.submitting} className="inline-flex items-center gap-1.5 rounded-lg border border-violet/30 bg-violet-pale/60 px-3 py-2 text-[13px] font-semibold text-violet hover:bg-violet-pale disabled:opacity-60">
            <Save className="h-4 w-4" /> {form.submitting ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => setConfirmSend(true)} disabled={form.submitting || !audienceCount} className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep disabled:opacity-50">
            <Send className="h-4 w-4" /> Send now
          </button>
        </div>
      </div>

      {form.formError ? <div role="alert" className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-[13px] text-rose-700">{form.formError}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <div className="flex flex-col gap-5">
          <Section title="Subject & sender">
            <TextField form={form} name="name" label="Internal name" required hint="Only you see this, used in the campaigns list." placeholder="Q2 Newsletter, Blog launch & roadmap" />
            <TextField form={form} name="subject" label="Subject line" required hint="≤ 65 characters. Becomes the inbox row." placeholder="What I shipped in April · 4 min read" />
            <TextField form={form} name="preheader" label="Preheader" hint="Inbox preview text, shown beside the subject. ~85 char sweet spot." placeholder="The blog is live, the admin is shipping, and a small Q3 plan." />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField form={form} name="fromName" label="From name" />
              <TextField form={form} name="fromEmail" label="From email" type="email" />
            </div>
            <TextField form={form} name="replyTo" label="Reply-to (optional)" type="email" placeholder="hello@mustaphaukizuru.com" />
          </Section>

          <Section title="Body">
            <div className="flex flex-col gap-3">
              {campaign.body.map((block, i) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(p) => updateBlock(block.id, p)}
                  onMove={(d) => moveBlock(block.id, d)}
                  onRemove={() => removeBlock(block.id)}
                  isFirst={i === 0}
                  isLast={i === campaign.body.length - 1}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {BLOCK_TYPES.map((bt) => (
                <button key={bt.value} type="button" onClick={() => addBlock(bt.value)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-charcoal-80/20 px-2.5 py-1.5 text-[12px] font-medium text-charcoal-80/65 transition hover:border-violet/40 hover:bg-violet-pale/40 hover:text-violet">
                  <Plus className="h-3 w-3" /> {bt.label}
                </button>
              ))}
            </div>
          </Section>

          {showPreview ? (
            <Section title="Preview · in-line"
              hint="Email-client rendering may differ slightly. Send a test email to verify the final look in your inbox.">
              <article className="rounded-2xl border border-violet/15 bg-violet-pale/10 p-6">
                <BlogContentRenderer blocks={stripIds(campaign.body)} />
              </article>
            </Section>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-5">
          <Section title="Audience">
            <SelectField form={form} name="audience" label="Send to" options={AUDIENCE_OPTIONS} />
            {campaign.audience === "custom" ? (
              <Field label="Recipient emails" hint="One per line. Duplicates are removed automatically." error={form.errors.recipientEmails}>
                {(fid) => (
                  <textarea
                    id={fid}
                    rows={5}
                    value={recipientsText}
                    onChange={(e) => {
                      setRecipientsText(e.target.value)
                      const list = e.target.value.split(/\s*[\n,]+\s*/).map((x) => x.trim()).filter(Boolean)
                      setValue("recipientEmails", Array.from(new Set(list)))
                    }}
                    className={inputClass({ error: Boolean(form.errors.recipientEmails), className: "resize-y font-mono" })}
                  />
                )}
              </Field>
            ) : null}
            <div className="rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.02] p-3">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">
                <UsersIcon className="h-3.5 w-3.5 text-violet" /> Estimated reach
              </div>
              <div className="mt-1 text-[20px] font-extrabold tabular-nums text-violet">
                {audienceCount == null ? "-" : audienceCount}
              </div>
              <div className="text-[11.5px] text-charcoal-80/55">people will receive this email when you send.</div>
            </div>
          </Section>

          <Section title="Test send" hint="Send a copy to yourself before launching.">
            <Field label="Test email">
              {(fid) => (
                <input id={fid} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" type="email" className={inputClass()} />
              )}
            </Field>
            <button type="button" onClick={handleTestSend} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] font-semibold text-violet hover:bg-violet-pale/40">
              <MailCheck className="h-4 w-4" /> Save & send test
            </button>
          </Section>

          <Section title="Schedule (optional)" hint="Leave blank to send immediately when you click Send now.">
            <TextField form={form} name="scheduledAt" label="Send at" type="datetime-local" />
            {campaign.scheduledAt ? (
              <button type="button" onClick={() => handleSave("scheduled")} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 hover:bg-amber/15">
                Save as scheduled
              </button>
            ) : null}
          </Section>
        </aside>
      </div>

      <ConfirmModal
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={handleSendNow}
        busy={form.submitting}
        title="Send campaign now?"
        confirmLabel={`Send to ${audienceCount ?? "?"}`}
      >
        <p className="text-[13px] text-charcoal-80/65">
          This sends to <strong>{audienceCount ?? "?"}</strong> recipient{audienceCount === 1 ? "" : "s"} immediately.
          Sent emails cannot be recalled.
        </p>
      </ConfirmModal>
    </div>
  )
}

function Section({ title, children, hint }) {
  return (
    <section className="rounded-2xl border border-charcoal-80/10 bg-white p-5">
      <h2 className="mb-1 text-[13px] font-bold uppercase tracking-[0.16em] text-violet">{title}</h2>
      {hint ? <p className="mb-4 text-[12px] text-charcoal-80/55">{hint}</p> : <div className="mb-4" />}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function BlockEditor({ block, onChange, onMove, onRemove, isFirst, isLast }) {
  return (
    <div className="rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <select value={block.type} onChange={(e) => onChange(typeChange(block, e.target.value))} className="rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/65 outline-none focus:border-violet/40">
          {BLOCK_TYPES.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" className="rounded p-1 text-charcoal-80/55 hover:bg-violet-pale/40 hover:text-violet disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" className="rounded p-1 text-charcoal-80/55 hover:bg-violet-pale/40 hover:text-violet disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onRemove} aria-label="Remove block" className="rounded p-1 text-charcoal-80/55 hover:bg-rose/10 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {renderField(block, onChange)}
    </div>
  )
}

/** Keeps the block id so the editor card doesn't remount on type change. */
function typeChange(prev, nextType) {
  const id = prev.id
  if (nextType === "list" || nextType === "ordered") {
    if (prev.type === "list" || prev.type === "ordered") return { id, type: nextType, items: prev.items || [""], itemKeys: prev.itemKeys }
    return { id, type: nextType, items: [prev.text || ""] }
  }
  if (nextType === "callout") return { id, type: nextType, variant: prev.variant || "info", text: prev.text || (prev.items?.[0] ?? "") }
  if (nextType === "button") return { id, type: nextType, text: prev.text || "Read on the blog", href: prev.href || "https://mustaphaukizuru.com/blog" }
  if (nextType === "divider") return { id, type: nextType }
  return { id, type: nextType, text: prev.text || (prev.items?.[0] ?? "") }
}

function itemKeysFor(block) {
  const items = block.items || []
  return Array.isArray(block.itemKeys) && block.itemKeys.length === items.length
    ? block.itemKeys
    : items.map((_, i) => block.itemKeys?.[i] || newId())
}

function renderField(block, onChange) {
  if (block.type === "list" || block.type === "ordered") {
    const items = block.items || []
    const keys = itemKeysFor(block)
    const commit = (nextItems, nextKeys) => onChange({ items: nextItems, itemKeys: nextKeys })
    return (
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={keys[i]} className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-charcoal-80/45">{block.type === "ordered" ? `${i + 1}.` : "•"}</span>
            <input value={item} onChange={(e) => { const next = [...items]; next[i] = e.target.value; commit(next, keys) }} placeholder="List item, supports **bold**, *italic*, `code`, [text](url)" className="flex-1 rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40" />
            <button type="button" onClick={() => commit(items.filter((_, x) => x !== i), keys.filter((_, x) => x !== i))} aria-label="Remove item" className="rounded p-1 text-charcoal-80/55 hover:bg-rose/10 hover:text-rose-700"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => commit([...items, ""], [...keys, newId()])} className="mt-1 inline-flex items-center gap-1 self-start text-[11.5px] font-semibold text-violet hover:underline"><Plus className="h-3 w-3" /> Add item</button>
      </div>
    )
  }
  if (block.type === "callout") {
    return (
      <div className="flex flex-col gap-2">
        <select value={block.variant || "info"} onChange={(e) => onChange({ variant: e.target.value })} className="self-start rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[11.5px] outline-none focus:border-violet/40">
          <option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option>
        </select>
        <input value={block.title || ""} onChange={(e) => onChange({ title: e.target.value })} placeholder="Callout title (optional)" className="rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40" />
        <textarea value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} rows={2} placeholder="Callout body, supports inline formatting." className="resize-y rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40" />
      </div>
    )
  }
  if (block.type === "button") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Button label" className="flex-1 rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40" />
        <input value={block.href || ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://…" className="flex-1 rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40 font-mono" />
      </div>
    )
  }
  if (block.type === "divider") {
    return <div className="text-center text-[11px] text-charcoal-80/45">— Divider line —</div>
  }
  return (
    <textarea value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} rows={block.type === "p" || block.type === "quote" ? 3 : 1}
      placeholder={
        block.type === "h2" ? "Section heading" :
        block.type === "h3" ? "Sub-heading" :
        block.type === "quote" ? "“Quote text”" :
        "Paragraph, supports **bold**, *italic*, `code`, [text](url)"
      }
      className="w-full resize-y rounded border border-charcoal-80/15 bg-white px-2 py-1.5 text-[13.5px] leading-6 outline-none focus:border-violet/40" />
  )
}
