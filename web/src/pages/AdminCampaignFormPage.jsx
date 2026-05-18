/* ════════════════════════════════════════════════════════════════════════
   AdminCampaignFormPage.jsx · /admin/campaigns/new · /admin/campaigns/:id/edit
   Compose a marketing email: subject, preheader, structured-block body,
   audience picker (newsletter / members / custom list), test send,
   schedule, and "send now".
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Save, Eye, Send, Plus, Trash2, ArrowUp, ArrowDown,
  Users as UsersIcon, AlertCircle, MailCheck,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"
import BlogContentRenderer from "../components/blog/BlogContentRenderer"

const EMPTY = {
  name: "",
  subject: "",
  preheader: "",
  fromName: "Mustapha Ukizuru",
  fromEmail: "hello@mustaphaukizuru.com",
  replyTo: "",
  body: [{ type: "p", text: "" }],
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

export default function AdminCampaignFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()

  const [campaign, setCampaign] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [audienceCount, setAudienceCount] = useState(null)
  const [testEmail, setTestEmail] = useState("")
  const [confirmSend, setConfirmSend] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiRequest(`/api/v1/admin/campaigns/${id}`)
        if (cancelled) return
        const c = res.campaign || {}
        setCampaign({
          ...EMPTY,
          ...c,
          recipientEmails: Array.isArray(c.recipientEmails) ? c.recipientEmails : [],
          body: Array.isArray(c.body) && c.body.length ? c.body : [{ type: "p", text: "" }],
          scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : "",
        })
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load campaign.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
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

  function update(patch) { setCampaign((c) => ({ ...c, ...patch })) }
  function updateBlock(i, patch) { setCampaign((c) => ({ ...c, body: c.body.map((b, idx) => idx === i ? { ...b, ...patch } : b) })) }
  function moveBlock(i, dir) {
    setCampaign((c) => {
      const next = [...c.body]
      const t = i + dir
      if (t < 0 || t >= next.length) return c
      ;[next[i], next[t]] = [next[t], next[i]]
      return { ...c, body: next }
    })
  }
  function addBlock(type = "p") {
    const tpl =
      type === "list" || type === "ordered" ? { type, items: [""] }
      : type === "callout" ? { type, variant: "info", text: "" }
      : type === "button" ? { type, text: "Read on the blog", href: "https://mustaphaukizuru.com/blog" }
      : type === "divider" ? { type }
      : { type, text: "" }
    setCampaign((c) => ({ ...c, body: [...c.body, tpl] }))
  }
  function removeBlock(i) { setCampaign((c) => ({ ...c, body: c.body.filter((_, idx) => idx !== i) })) }

  async function handleSave(nextStatus) {
    if (!campaign.name) { setError("Campaign name is required."); return }
    if (!campaign.subject) { setError("Subject is required."); return }
    setError("")
    setSaving(true)
    try {
      const body = {
        ...campaign,
        status: nextStatus || campaign.status,
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString() : null,
      }
      const res = isEdit
        ? await apiRequest(`/api/v1/admin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiRequest(`/api/v1/admin/campaigns`, { method: "POST", body: JSON.stringify(body) })
      toast?.success?.(isEdit ? "Campaign saved" : "Campaign created")
      if (!isEdit) navigate(`/admin/campaigns/${res.campaign.id}/edit`, { replace: true })
      return res.campaign
    } catch (err) {
      setError(err?.message || "Save failed.")
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    if (!testEmail) { toast?.error?.("Enter a test email"); return }
    const saved = await handleSave()
    if (!saved) return
    try {
      await apiRequest(`/api/v1/admin/campaigns/${saved.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to: testEmail }),
      })
      toast?.success?.(`Test sent to ${testEmail}`)
    } catch (err) {
      toast?.error?.(err?.message || "Test send failed")
    }
  }

  async function handleSendNow() {
    const saved = await handleSave()
    if (!saved) return
    try {
      const res = await apiRequest(`/api/v1/admin/campaigns/${saved.id}/send-now`, { method: "POST" })
      toast?.success?.(`Campaign sent · ${res.campaign.sentCount} delivered`)
      setConfirmSend(false)
      navigate("/admin/campaigns")
    } catch (err) {
      toast?.error?.(err?.message || "Send failed")
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
          <button type="button" onClick={() => handleSave()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-violet/30 bg-violet-pale/60 px-3 py-2 text-[13px] font-semibold text-violet hover:bg-violet-pale">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => setConfirmSend(true)} disabled={saving || !audienceCount} className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep disabled:opacity-50">
            <Send className="h-4 w-4" /> Send now
          </button>
        </div>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-[13px] text-rose-700">{error}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <div className="flex flex-col gap-5">
          <Section title="Subject & sender">
            <Field label="Internal name" required hint="Only you see this, used in the campaigns list.">
              <input value={campaign.name} onChange={(e) => update({ name: e.target.value })} placeholder="Q2 Newsletter, Blog launch & roadmap" className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[14px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
            </Field>
            <Field label="Subject line" required hint="≤ 65 characters. Becomes the inbox row.">
              <input value={campaign.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="What I shipped in April · 4 min read" className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[14px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
            </Field>
            <Field label="Preheader" hint="Inbox preview text, shown beside the subject. ~85 char sweet spot.">
              <input value={campaign.preheader} onChange={(e) => update({ preheader: e.target.value })} placeholder="The blog is live, the admin is shipping, and a small Q3 plan." className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="From name">
                <input value={campaign.fromName} onChange={(e) => update({ fromName: e.target.value })} className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
              </Field>
              <Field label="From email">
                <input value={campaign.fromEmail} onChange={(e) => update({ fromEmail: e.target.value })} className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
              </Field>
            </div>
            <Field label="Reply-to (optional)">
              <input value={campaign.replyTo} onChange={(e) => update({ replyTo: e.target.value })} placeholder="hello@mustaphaukizuru.com" className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
            </Field>
          </Section>

          <Section title="Body">
            <div className="flex flex-col gap-3">
              {campaign.body.map((block, i) => (
                <BlockEditor key={i} block={block} onChange={(p) => updateBlock(i, p)} onMove={(d) => moveBlock(i, d)} onRemove={() => removeBlock(i)} isFirst={i === 0} isLast={i === campaign.body.length - 1} />
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
                <BlogContentRenderer blocks={campaign.body} />
              </article>
            </Section>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-5">
          <Section title="Audience">
            <Field label="Send to">
              <select value={campaign.audience} onChange={(e) => update({ audience: e.target.value })} className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15">
                <option value="newsletter">Newsletter subscribers</option>
                <option value="members">All members</option>
                <option value="custom">Custom list</option>
              </select>
            </Field>
            {campaign.audience === "custom" ? (
              <Field label="Recipient emails" hint="One per line. Duplicates are removed automatically.">
                <textarea
                  rows={5}
                  value={campaign.recipientEmails.join("\n")}
                  onChange={(e) => update({
                    recipientEmails: e.target.value.split(/\s*[\n,]+\s*/).map((x) => x.trim()).filter(Boolean),
                  })}
                  className="w-full resize-y rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15 font-mono"
                />
              </Field>
            ) : null}
            <div className="rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.02] p-3">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">
                <UsersIcon className="h-3.5 w-3.5 text-violet" /> Estimated reach
              </div>
              <div className="mt-1 text-[20px] font-extrabold tabular-nums text-violet">
                {audienceCount == null ? "-" : audienceCount}
              </div>
              <div className="text-[11.5px] text-charcoal-80/55">
                people will receive this email when you send.
              </div>
            </div>
          </Section>

          <Section title="Test send" hint="Send a copy to yourself before launching.">
            <Field label="Test email">
              <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" type="email" className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15" />
            </Field>
            <button type="button" onClick={handleTestSend} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] font-semibold text-violet hover:bg-violet-pale/40">
              <MailCheck className="h-4 w-4" /> Save & send test
            </button>
          </Section>

          <Section title="Schedule (optional)" hint="Leave blank to send immediately when you click Send now.">
            <Field label="Send at">
              <input
                type="datetime-local"
                value={campaign.scheduledAt}
                onChange={(e) => update({ scheduledAt: e.target.value })}
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
            {campaign.scheduledAt ? (
              <button type="button" onClick={() => handleSave("scheduled")} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 hover:bg-amber/15">
                Save as scheduled
              </button>
            ) : null}
          </Section>
        </aside>
      </div>

      {/* Send confirmation */}
      {confirmSend ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-pale text-violet"><Send className="h-5 w-5" /></div>
              <div className="flex-1">
                <h2 className="text-[16px] font-bold text-charcoal-80">Send campaign now?</h2>
                <p className="mt-1 text-[13px] text-charcoal-80/65">
                  This sends to <strong>{audienceCount ?? "?"}</strong> recipient{audienceCount === 1 ? "" : "s"} immediately.
                  Sent emails cannot be recalled.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSend(false)} className="rounded-lg border border-charcoal-80/15 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal-80 hover:bg-charcoal-80/[0.04]">Cancel</button>
              <button type="button" onClick={handleSendNow} className="rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-deep">Send to {audienceCount ?? "?"}</button>
            </div>
          </div>
        </div>
      ) : null}
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

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/55">
        {label}{required ? <span className="text-red-500">*</span> : null}
      </div>
      {children}
      {hint ? <div className="mt-1 text-[11.5px] text-charcoal-80/50">{hint}</div> : null}
    </label>
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

function typeChange(prev, nextType) {
  if (nextType === "list" || nextType === "ordered") {
    if (prev.type === "list" || prev.type === "ordered") return { type: nextType, items: prev.items || [""] }
    return { type: nextType, items: [prev.text || ""] }
  }
  if (nextType === "callout") return { type: nextType, variant: prev.variant || "info", text: prev.text || (prev.items?.[0] ?? "") }
  if (nextType === "button") return { type: nextType, text: prev.text || "Read on the blog", href: prev.href || "https://mustaphaukizuru.com/blog" }
  if (nextType === "divider") return { type: nextType }
  return { type: nextType, text: prev.text || (prev.items?.[0] ?? "") }
}

function renderField(block, onChange) {
  if (block.type === "list" || block.type === "ordered") {
    return (
      <div className="flex flex-col gap-1.5">
        {(block.items || []).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-charcoal-80/45">{block.type === "ordered" ? `${i + 1}.` : "•"}</span>
            <input value={item} onChange={(e) => { const items = [...block.items]; items[i] = e.target.value; onChange({ items }) }} placeholder="List item, supports **bold**, *italic*, `code`, [text](url)" className="flex-1 rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40" />
            <button type="button" onClick={() => onChange({ items: block.items.filter((_, x) => x !== i) })} aria-label="Remove item" className="rounded p-1 text-charcoal-80/55 hover:bg-rose/10 hover:text-rose-700"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange({ items: [...(block.items || []), ""] })} className="mt-1 inline-flex items-center gap-1 self-start text-[11.5px] font-semibold text-violet hover:underline"><Plus className="h-3 w-3" /> Add item</button>
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
    return <div className="text-center text-[11px] text-charcoal-80/45">, Divider line,</div>
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
