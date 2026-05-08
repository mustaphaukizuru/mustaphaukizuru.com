/* ════════════════════════════════════════════════════════════════════════
   AdminBlogFormPage.jsx · /admin/blog/new · /admin/blog/:id/edit
   ────────────────────────────────────────────────────────────────────────
   Two routes share this component. When `id` is present we hydrate from
   /api/v1/admin/blog/posts/:id; otherwise we start fresh.

   The body editor uses the same structured-block schema as the public
   renderer (BlogContentRenderer). Each block is editable inline; the
   admin can add/remove/reorder blocks, change types, and preview.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft, Save, Eye, Plus, Trash2, ArrowUp, ArrowDown, Star, StarOff,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"
import BlogContentRenderer from "../components/blog/BlogContentRenderer"

const EMPTY_POST = {
  title: "",
  slug: "",
  excerpt: "",
  cover: "",
  readMinutes: 5,
  status: "draft",
  isFeatured: false,
  metaTitle: "",
  metaDescription: "",
  categoryId: "",
  authorName: "Mustapha Ukizuru",
  authorRole: "IT Manager · Full-Stack Developer · CS Educator",
  authorAvatar: "",
  body: [{ type: "p", text: "" }],
  tags: [],
}

const BLOCK_TYPES = [
  { value: "p", label: "Paragraph" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "list", label: "Bulleted list" },
  { value: "ordered", label: "Numbered list" },
  { value: "callout", label: "Callout" },
  { value: "quote", label: "Pull quote" },
]

export default function AdminBlogFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const isEdit = !!id

  const [post, setPost] = useState(EMPTY_POST)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  /* Load post + categories on mount */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [{ categories: cats }] = await Promise.all([
          apiRequest("/api/v1/admin/blog/categories"),
        ])
        if (cancelled) return
        setCategories(cats || [])
        if (cats?.length && !post.categoryId) {
          setPost((p) => ({ ...p, categoryId: cats[0].id }))
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load categories.")
      }
    })()
    return () => { cancelled = true }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiRequest(`/api/v1/admin/blog/posts/${id}`)
        if (cancelled) return
        const p = res.post || {}
        setPost({
          ...EMPTY_POST,
          ...p,
          tags: Array.isArray(p.tags) ? p.tags : [],
          body: Array.isArray(p.body) && p.body.length ? p.body : [{ type: "p", text: "" }],
        })
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load post.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, isEdit])

  function update(patch) {
    setPost((p) => ({ ...p, ...patch }))
  }

  function updateBlock(index, patch) {
    setPost((p) => ({
      ...p,
      body: p.body.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }
  function moveBlock(index, dir) {
    setPost((p) => {
      const next = [...p.body]
      const target = index + dir
      if (target < 0 || target >= next.length) return p
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...p, body: next }
    })
  }
  function addBlock(type = "p") {
    const tpl =
      type === "list" || type === "ordered"
        ? { type, items: [""] }
        : type === "callout"
          ? { type, variant: "info", text: "" }
          : type === "quote"
            ? { type, text: "" }
            : { type, text: "" }
    setPost((p) => ({ ...p, body: [...p.body, tpl] }))
  }
  function removeBlock(index) {
    setPost((p) => ({ ...p, body: p.body.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!post.title) { setError("Title is required."); return }
    if (!post.categoryId) { setError("Category is required."); return }
    setError("")
    setSaving(true)
    try {
      const body = {
        ...post,
        readMinutes: Number(post.readMinutes) || 5,
        tags: post.tags.filter(Boolean),
      }
      const res = await (isEdit
        ? apiRequest(`/api/v1/admin/blog/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest(`/api/v1/admin/blog/posts`, { method: "POST", body: JSON.stringify(body) }))
      toast?.success?.(isEdit ? "Post updated" : "Post created")
      navigate(`/admin/blog/${res.post.id}/edit`, { replace: !isEdit })
    } catch (err) {
      setError(err?.message || "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center text-charcoal-80/55">Loading post…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to posts
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] font-semibold text-charcoal-80 transition hover:border-violet/40 hover:text-violet"
          >
            <Eye className="h-4 w-4" /> {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : isEdit ? "Save changes" : "Create post"}
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* MAIN */}
        <div className="flex flex-col gap-5">
          <Section title="Basics">
            <Field label="Title" required>
              <input
                value={post.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="From zero to SaaS: shipping mustaphaukizuru.com…"
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[14px] outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
                required
              />
            </Field>
            <Field label="Slug" hint="Auto-generated from title if left blank.">
              <input
                value={post.slug}
                onChange={(e) => update({ slug: e.target.value })}
                placeholder="from-zero-to-saas"
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 font-mono text-[13px] outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
            <Field label="Excerpt" hint="One or two sentences shown on the index card and OG/SEO description.">
              <textarea
                value={post.excerpt}
                onChange={(e) => update({ excerpt: e.target.value })}
                rows={3}
                className="w-full resize-y rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[14px] outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
          </Section>

          <Section title="Body">
            <div className="flex flex-col gap-3">
              {post.body.map((block, i) => (
                <BlockEditor
                  key={i}
                  index={i}
                  block={block}
                  onChange={(patch) => updateBlock(i, patch)}
                  onMove={(dir) => moveBlock(i, dir)}
                  onRemove={() => removeBlock(i)}
                  isFirst={i === 0}
                  isLast={i === post.body.length - 1}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {BLOCK_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => addBlock(bt.value)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-charcoal-80/20 px-2.5 py-1.5 text-[12px] font-medium text-charcoal-80/65 transition hover:border-violet/40 hover:bg-violet-pale/40 hover:text-violet"
                >
                  <Plus className="h-3 w-3" /> {bt.label}
                </button>
              ))}
            </div>
          </Section>

          {showPreview ? (
            <Section title="Preview">
              <article className="prose-blog rounded-2xl border border-violet/15 bg-violet-pale/10 p-6">
                <BlogContentRenderer blocks={post.body} />
              </article>
            </Section>
          ) : null}
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-5">
          <Section title="Publishing">
            <Field label="Status">
              <select
                value={post.status}
                onChange={(e) => update({ status: e.target.value })}
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Featured">
              <button
                type="button"
                onClick={() => update({ isFeatured: !post.isFeatured })}
                className={`inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${
                  post.isFeatured
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet"
                }`}
              >
                {post.isFeatured ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : <StarOff className="h-4 w-4" />}
                {post.isFeatured ? "Featured on /blog" : "Mark as featured"}
              </button>
            </Field>
            <Field label="Read time (minutes)">
              <input
                type="number"
                min={1}
                value={post.readMinutes}
                onChange={(e) => update({ readMinutes: e.target.value })}
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
          </Section>

          <Section title="Taxonomy">
            <Field label="Category" required>
              <select
                value={post.categoryId}
                onChange={(e) => update({ categoryId: e.target.value })}
                required
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags" hint="Comma-separated. New tags are created automatically.">
              <input
                value={post.tags.join(", ")}
                onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="React, Hostinger, Mexico"
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
          </Section>

          <Section title="Cover & SEO">
            <Field label="Cover image URL">
              <input
                value={post.cover || ""}
                onChange={(e) => update({ cover: e.target.value })}
                placeholder="/images/blog/your-post.jpg"
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
            <Field label="Meta title">
              <input
                value={post.metaTitle || ""}
                onChange={(e) => update({ metaTitle: e.target.value })}
                className="w-full rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
            <Field label="Meta description">
              <textarea
                value={post.metaDescription || ""}
                onChange={(e) => update({ metaDescription: e.target.value })}
                rows={3}
                className="w-full resize-y rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
              />
            </Field>
          </Section>
        </aside>
      </div>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-charcoal-80/10 bg-white p-5">
      <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.16em] text-violet">{title}</h2>
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

function BlockEditor({ index, block, onChange, onMove, onRemove, isFirst, isLast }) {
  return (
    <div className="rounded-xl border border-charcoal-80/12 bg-charcoal-80/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <select
          value={block.type}
          onChange={(e) => onChange(blockTypeChange(block, e.target.value))}
          className="rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/65 outline-none focus:border-violet/40"
        >
          {BLOCK_TYPES.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} aria-label="Move up" className="rounded p-1 text-charcoal-80/55 hover:bg-violet-pale/40 hover:text-violet disabled:opacity-30">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" className="rounded p-1 text-charcoal-80/55 hover:bg-violet-pale/40 hover:text-violet disabled:opacity-30">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onRemove} aria-label="Remove block" className="rounded p-1 text-charcoal-80/55 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {renderBlockField(block, onChange, index)}
    </div>
  )
}

function blockTypeChange(prev, nextType) {
  // Preserve text/items where possible across type changes.
  if (nextType === "list" || nextType === "ordered") {
    if (prev.type === "list" || prev.type === "ordered") return { type: nextType, items: prev.items || [""] }
    return { type: nextType, items: [prev.text || ""] }
  }
  if (nextType === "callout") {
    return { type: nextType, variant: prev.variant || "info", text: prev.text || (prev.items?.[0] ?? "") }
  }
  return { type: nextType, text: prev.text || (prev.items?.[0] ?? "") }
}

function renderBlockField(block, onChange, index) {
  if (block.type === "list" || block.type === "ordered") {
    return (
      <div className="flex flex-col gap-1.5">
        {block.items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-charcoal-80/45">{block.type === "ordered" ? `${i + 1}.` : "•"}</span>
            <input
              value={item}
              onChange={(e) => {
                const items = [...block.items]
                items[i] = e.target.value
                onChange({ items })
              }}
              placeholder="List item, supports **bold**, *italic*, `code`, [text](url)"
              className="flex-1 rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40"
            />
            <button
              type="button"
              onClick={() => onChange({ items: block.items.filter((_, idx) => idx !== i) })}
              aria-label="Remove item"
              className="rounded p-1 text-charcoal-80/55 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ items: [...block.items, ""] })}
          className="mt-1 inline-flex items-center gap-1 self-start text-[11.5px] font-semibold text-violet hover:underline"
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
      </div>
    )
  }
  if (block.type === "callout") {
    return (
      <div className="flex flex-col gap-2">
        <select
          value={block.variant || "info"}
          onChange={(e) => onChange({ variant: e.target.value })}
          className="self-start rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[11.5px] outline-none focus:border-violet/40"
        >
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
        </select>
        <input
          value={block.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Callout title (optional)"
          className="rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40"
        />
        <textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Callout body, supports inline formatting."
          rows={2}
          className="resize-y rounded border border-charcoal-80/15 bg-white px-2 py-1 text-[13px] outline-none focus:border-violet/40"
        />
      </div>
    )
  }
  // p / h2 / h3 / quote
  return (
    <textarea
      value={block.text}
      onChange={(e) => onChange({ text: e.target.value })}
      placeholder={
        block.type === "h2" ? "Section heading" :
        block.type === "h3" ? "Sub-heading" :
        block.type === "quote" ? "“Quote text”" :
        "Paragraph, supports **bold**, *italic*, `code`, [text](url)"
      }
      rows={block.type === "p" || block.type === "quote" ? 3 : 1}
      className="w-full resize-y rounded border border-charcoal-80/15 bg-white px-2 py-1.5 text-[13.5px] leading-6 outline-none focus:border-violet/40"
    />
  )
}
