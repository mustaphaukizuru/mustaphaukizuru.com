import { useEffect, useState, useRef, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Trash2, Upload, X, Plus, Image as ImageIcon, ExternalLink, Star,
  ArrowUp, ArrowDown,
} from "lucide-react"
import { SERVICE_SLUGS } from "../components/portfolio/caseStudy"
import {
  adminGetPortfolio,
  adminCreatePortfolio,
  adminUpdatePortfolio,
  adminUploadCover,
  adminUploadGalleryImage,
} from "../services/portfolioService"
import FormShell, { FormCard } from "../components/admin/FormShell"
import {
  Field, FormInput, FormTextarea, FormSelect, inputClass,
} from "../components/admin/Field"
import StatusPill from "../components/admin/StatusPill"
import useUnsavedChangesPrompt, { computeIsDirty } from "../hooks/useUnsavedChangesPrompt"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminPortfolioFormPage · F10.I · Batch 6B-3
 *
 *  Refactored to use the shared <FormShell />, <Field />, <FormInput />,
 *  and <FormSelect /> primitives, plus the unsaved-changes prompt hook.
 *
 *  What changed:
 *    - <FormShell /> wraps the page with sticky save bar (Save / Cancel)
 *    - Per-field validation surfaces inline error messages under inputs
 *    - <StatusPill /> in the page header shows publish status
 *    - "View live" link only renders when status === "published"
 *    - Local Card/Field/inputClass helpers replaced with shared primitives
 *    - Dirty-state tracked: isDirty triggers beforeunload prompt + intra-app
 *      anchor click prompt
 *    - Snapshot updated on successful save so the prompt clears
 *
 *  Preserved verbatim:
 *    - All API calls (adminGetPortfolio / Create / Update / UploadCover /
 *      UploadGalleryImage)
 *    - EMPTY shape and form fields
 *    - TagListInput component (kept inline since it's specific to this form)
 *    - Cover + gallery upload flow (disabled until first save in create mode)
 *    - Two-column layout (1.5fr / 1fr)
 *  ──────────────────────────────────────────────────────────────────── */

const EMPTY = {
  title: "", slug: "", role: "", client: "", category: "",
  shortDescription: "", description: "",
  challenge: "", solution: "",
  liveUrl: "", repoUrl: "",
  year: "", duration: "",
  metaTitle: "", metaDescription: "",
  status: "draft",
  isFeatured: false,
  displayOrder: 0,
  coverImage: null,
  gallery: [],
  results: [],
  tools: [],
  tags: [],
  // I18N06 · Spanish bilingual fields. Schema-level columns mirror their
  // English counterparts; non-translatable structure (slug, role, category,
  // links, year, results, tools, tags) stays canonical and is shared
  // across locales.
  titleEs: "",
  shortDescriptionEs: "",
  descriptionEs: "",
  metaTitleEs: "",
  metaDescriptionEs: "",
  // Step 27 · case-study block. Persisted inside the `results` Json column
  // as { items, caseStudy } by adminPortfolioService — the API surfaces it
  // back as `caseStudy` so the form round-trips cleanly.
  caseStudy: EMPTY_CASE_STUDY(),
}

function EMPTY_CASE_STUDY() {
  return {
    serviceSlug: "",
    context: "", contextEs: "",
    problem: "", problemEs: "",
    approach: [],   // [{ title, body, titleEs, bodyEs }]
    outcomes: [],   // [{ value, label, labelEs, placeholder }]
    stack: [],
  }
}

function hydrateCaseStudy(cs) {
  const base = EMPTY_CASE_STUDY()
  if (!cs || typeof cs !== "object") return base
  return {
    ...base,
    ...cs,
    serviceSlug: cs.serviceSlug || "",
    context: cs.context || "", contextEs: cs.contextEs || "",
    problem: cs.problem || "", problemEs: cs.problemEs || "",
    approach: Array.isArray(cs.approach)
      ? cs.approach.map((a) => ({ title: a?.title || "", body: a?.body || "", titleEs: a?.titleEs || "", bodyEs: a?.bodyEs || "" }))
      : [],
    outcomes: Array.isArray(cs.outcomes)
      ? cs.outcomes.map((o) => ({ value: o?.value || "", label: o?.label || "", labelEs: o?.labelEs || "", placeholder: Boolean(o?.placeholder) }))
      : [],
    stack: Array.isArray(cs.stack) ? cs.stack : [],
  }
}

const SERVICE_OPTIONS = [
  { value: "", label: "— none —" },
  { value: "it-strategy-consulting",        label: "IT strategy & consulting" },
  { value: "ai-automation",                 label: "AI & automation" },
  { value: "cloud-architecture-migration",  label: "Cloud architecture & migration" },
  { value: "digital-product-engineering",   label: "Digital product engineering" },
].filter((o) => o.value === "" || SERVICE_SLUGS.includes(o.value))

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

export default function AdminPortfolioFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  // I18N06 · Locale toggle. EN is canonical; flipping to ES rebinds the
  // five translatable inputs (title, short description, overview, meta
  // title, meta description) to their *Es siblings without losing the
  // English copy. Save sends both locales in one PATCH.
  const [locale, setLocale] = useState("en")
  const [form, setForm] = useState(EMPTY)
  const [savedSnapshot, setSavedSnapshot] = useState(isEdit ? null : EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  const coverInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  // Compute dirty for unsaved-changes guard
  const isDirty = useMemo(
    () => computeIsDirty(form, savedSnapshot),
    [form, savedSnapshot]
  )
  useUnsavedChangesPrompt(isDirty && !saving)

  /* ── Load on edit ───────────────────────────────────────── */
  useEffect(() => {
    if (!isEdit) return
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const data = await adminGetPortfolio(id)
        if (cancelled) return
        if (!data) { setError("Portfolio item not found"); return }
        const next = {
          ...EMPTY,
          ...data,
          year: data.year != null ? String(data.year) : "",
          gallery: Array.isArray(data.gallery) ? data.gallery : [],
          results: Array.isArray(data.results) ? data.results : [],
          tools: Array.isArray(data.tools) ? data.tools : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          caseStudy: hydrateCaseStudy(data.caseStudy),
        }
        setForm(next)
        setSavedSnapshot(next)
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit])

  /* ── Validation ─────────────────────────────────────────── */
  function validate() {
    const errors = {}
    if (!form.title.trim()) errors.title = "Title is required"
    if (!form.role.trim()) errors.role = "Role is required"
    if (!form.category.trim()) errors.category = "Category is required"
    if (!form.shortDescription.trim()) errors.shortDescription = "Short description is required"
    if (form.year && (Number(form.year) < 1990 || Number(form.year) > 2100)) {
      errors.year = "Year must be between 1990 and 2100"
    }
    if (form.liveUrl && !/^https?:\/\//.test(form.liveUrl)) {
      errors.liveUrl = "Must start with http:// or https://"
    }
    if (form.repoUrl && !/^https?:\/\//.test(form.repoUrl)) {
      errors.repoUrl = "Must start with http:// or https://"
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const canSave = useMemo(
    () => Boolean(form.title.trim() && form.shortDescription.trim() && form.role.trim() && form.category.trim()),
    [form.title, form.shortDescription, form.role, form.category]
  )

  /* ── Handlers ───────────────────────────────────────────── */
  const patch = (changes) => {
    setForm((prev) => ({ ...prev, ...changes }))
    // Clear field errors as the user types
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        Object.keys(changes).forEach((k) => delete next[k])
        return next
      })
    }
  }

  const patchCaseStudy = (changes) => patch({ caseStudy: { ...form.caseStudy, ...changes } })

  async function handleSave() {
    setSuccessMsg("")
    if (!validate()) {
      setError("Please fix the highlighted fields before saving.")
      return
    }
    setSaving(true); setError("")
    try {
      const payload = {
        ...form,
        year: form.year === "" ? null : Number(form.year),
        results: form.results,
        tools: form.tools,
        tags: form.tags,
        gallery: form.gallery,
        caseStudy: form.caseStudy,
      }
      if (isEdit) {
        const updated = await adminUpdatePortfolio(id, payload)
        const next = {
          ...form,
          ...updated,
          year: updated?.year != null ? String(updated.year) : "",
          caseStudy: hydrateCaseStudy(updated?.caseStudy ?? form.caseStudy),
        }
        setForm(next)
        setSavedSnapshot(next)
        setSuccessMsg("Changes saved.")
      } else {
        const created = await adminCreatePortfolio(payload)
        if (created?.id) {
          // Clear dirty flag before navigating so the prompt doesn't fire
          setSavedSnapshot(form)
          navigate(`/admin/portfolio/${created.id}/edit`, { replace: true })
        }
      }
    } catch (err) {
      setError(err?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleCoverFile(file) {
    if (!file || !isEdit) return
    setUploadingCover(true); setError("")
    try {
      const result = await adminUploadCover(id, file)
      const url = result?.coverImage || result?.portfolio?.coverImage
      if (url) {
        // Cover upload bypasses dirty tracking (it's a separate API call
        // that's already persisted server-side). Update both form and
        // snapshot to keep isDirty correct.
        const next = { ...form, coverImage: url }
        setForm(next)
        setSavedSnapshot((prev) => prev ? { ...prev, coverImage: url } : next)
      }
      setSuccessMsg("Cover uploaded.")
    } catch (err) {
      setError(err?.message || "Failed to upload cover")
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ""
    }
  }

  async function handleGalleryFile(file) {
    if (!file || !isEdit) return
    setUploadingGallery(true); setError("")
    try {
      const result = await adminUploadGalleryImage(id, file)
      const nextGallery = result?.portfolio?.gallery
      const newGallery = Array.isArray(nextGallery)
        ? nextGallery
        : (result?.galleryImage ? [...form.gallery, result.galleryImage] : form.gallery)
      const next = { ...form, gallery: newGallery }
      setForm(next)
      setSavedSnapshot((prev) => prev ? { ...prev, gallery: newGallery } : next)
      setSuccessMsg("Gallery image added.")
    } catch (err) {
      setError(err?.message || "Failed to upload image")
    } finally {
      setUploadingGallery(false)
      if (galleryInputRef.current) galleryInputRef.current.value = ""
    }
  }

  function removeGalleryAt(idx) {
    const next = [...form.gallery]
    next.splice(idx, 1)
    patch({ gallery: next })
  }

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <section className="space-y-4" role="status" aria-busy="true" aria-label="Loading portfolio item">
        <div className="h-[88px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="h-[280px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
            <div className="h-[200px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
          </div>
          <div className="h-[400px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
        </div>
      </section>
    )
  }

  return (
    <FormShell
      title={isEdit ? "Edit project" : "New project"}
      subtitle={isEdit && form.slug ? `/${form.slug}` : undefined}
      backHref="/admin/portfolio"
      backLabel="Back to portfolio"
      onSave={handleSave}
      onCancel={() => {
        if (isDirty && !window.confirm("Discard unsaved changes?")) return
        navigate("/admin/portfolio")
      }}
      saving={saving}
      canSave={canSave}
      saveLabel={isEdit ? "Save changes" : "Create project"}
      error={error}
      onClearError={() => setError("")}
      success={successMsg}
      onClearSuccess={() => setSuccessMsg("")}
      statusBadge={isEdit ? <StatusPill status={form.status} /> : null}
      headerActions={
        isEdit && form.status === "published" && form.slug ? (
          <a
            href={`/projects/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            View live
          </a>
        ) : null
      }
    >
      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT, main content */}
        <div className="space-y-4">
          <FormCard title="Basics">
            {/* I18N06 · Locale toggle — only translatable fields swap; slug,
                category, role, client, year, duration, tags, tools, results,
                URLs, status, featured, display order all stay shared. */}
            <div className="-mt-1 mb-3 flex items-center justify-between rounded-lg border border-charcoal-80/10 bg-violet-pale/40 px-3 py-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">
                Edit locale
              </span>
              <div role="tablist" aria-label="Edit locale" className="inline-flex items-center gap-1 rounded-md bg-white p-0.5 shadow-[inset_0_0_0_1px_rgb(var(--color-charcoal-rgb)/0.08)]">
                <button
                  type="button"
                  role="tab"
                  aria-selected={locale === "en"}
                  onClick={() => setLocale("en")}
                  className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/35 ${
                    locale === "en" ? "bg-violet text-white" : "text-charcoal-80/65 hover:text-violet"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={locale === "es"}
                  onClick={() => setLocale("es")}
                  className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/35 ${
                    locale === "es" ? "bg-violet text-white" : "text-charcoal-80/65 hover:text-violet"
                  }`}
                >
                  ES
                </button>
              </div>
            </div>
            {locale === "en" ? (
              <FormInput
                label="Title"
                required
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="e.g. Cloud Migration for Colegio Raindrop"
                hint="Displayed as the project title on the public page."
                error={fieldErrors.title}
              />
            ) : (
              <FormInput
                label="Title (ES)"
                value={form.titleEs}
                onChange={(e) => patch({ titleEs: e.target.value })}
                placeholder="ej. Migración a la nube para Colegio Raindrop"
                hint="Falls back to English if blank."
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Slug"
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="cloud-migration-colegio-raindrop"
                hint="Leave blank to auto-generate from title."
              />
              <FormInput
                label="Category"
                required
                value={form.category}
                onChange={(e) => patch({ category: e.target.value })}
                placeholder="e.g. Web Development, Design"
                error={fieldErrors.category}
              />
            </div>
            {locale === "en" ? (
              <FormTextarea
                label="Short description"
                required
                rows={2}
                value={form.shortDescription}
                onChange={(e) => patch({ shortDescription: e.target.value })}
                placeholder="What the project is, in one clear sentence."
                hint="One-sentence pitch, shown on the portfolio card."
                error={fieldErrors.shortDescription}
              />
            ) : (
              <FormTextarea
                label="Short description (ES)"
                rows={2}
                value={form.shortDescriptionEs}
                onChange={(e) => patch({ shortDescriptionEs: e.target.value })}
                placeholder="Pitch en una frase para la tarjeta del portafolio."
                hint="Falls back to English if blank."
              />
            )}
          </FormCard>

          <FormCard title="Role & context">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Role"
                required
                value={form.role}
                onChange={(e) => patch({ role: e.target.value })}
                placeholder="e.g. Full-Stack Developer · Product Designer"
                error={fieldErrors.role}
              />
              <FormInput
                label="Client"
                value={form.client || ""}
                onChange={(e) => patch({ client: e.target.value })}
                placeholder="e.g. Colegio Raindrop"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Year"
                type="number"
                value={form.year || ""}
                onChange={(e) => patch({ year: e.target.value })}
                placeholder="2024"
                min="1990" max="2100"
                error={fieldErrors.year}
              />
              <FormInput
                label="Duration"
                value={form.duration || ""}
                onChange={(e) => patch({ duration: e.target.value })}
                placeholder="e.g. 6 weeks, Jan–Aug 2021"
              />
            </div>
          </FormCard>

          <FormCard title="Case study · problem → approach → outcome">
            <p className="-mt-1 mb-2 text-micro leading-5 text-charcoal-80/60">
              Rendered on the public project page and drives the outcome line on portfolio cards. Outcomes flagged
              <strong> illustrative</strong> show with an asterisk until you replace them with real numbers.
            </p>
            <FormSelect
              label="Related service"
              value={form.caseStudy.serviceSlug}
              onChange={(e) => patchCaseStudy({ serviceSlug: e.target.value })}
              options={SERVICE_OPTIONS}
              hint="Powers the service filter and the “Book a call about a project like this” CTA."
            />
            {locale === "en" ? (
              <FormTextarea
                label="Client & context"
                rows={3}
                value={form.caseStudy.context}
                onChange={(e) => patchCaseStudy({ context: e.target.value })}
                placeholder="Who the client is and the situation they were in."
              />
            ) : (
              <FormTextarea
                label="Client & context (ES)"
                rows={3}
                value={form.caseStudy.contextEs}
                onChange={(e) => patchCaseStudy({ contextEs: e.target.value })}
                placeholder="Quién es el cliente y en qué situación estaba."
                hint="Falls back to English if blank."
              />
            )}
            {locale === "en" ? (
              <FormTextarea
                label="Problem"
                rows={3}
                value={form.caseStudy.problem}
                onChange={(e) => patchCaseStudy({ problem: e.target.value })}
                placeholder="The concrete pain point, constraint or goal."
              />
            ) : (
              <FormTextarea
                label="Problem (ES)"
                rows={3}
                value={form.caseStudy.problemEs}
                onChange={(e) => patchCaseStudy({ problemEs: e.target.value })}
                placeholder="El problema, restricción u objetivo concreto."
                hint="Falls back to English if blank."
              />
            )}

            <ApproachEditor
              steps={form.caseStudy.approach}
              locale={locale}
              onChange={(approach) => patchCaseStudy({ approach })}
            />

            <OutcomesEditor
              outcomes={form.caseStudy.outcomes}
              locale={locale}
              onChange={(outcomes) => patchCaseStudy({ outcomes })}
            />

            <TagListInput
              label="Stack & tools (case study)"
              hint="Leave empty to reuse the Tools & technologies list below."
              values={form.caseStudy.stack}
              onChange={(stack) => patchCaseStudy({ stack })}
            />
          </FormCard>

          <FormCard title="Narrative (overview · challenge · solution)">
            {locale === "en" ? (
              <FormTextarea
                label="Overview"
                rows={5}
                value={form.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Tell the full story of what you built and delivered."
                hint="The longer narrative, what the project is and what was shipped."
              />
            ) : (
              <FormTextarea
                label="Overview (ES)"
                rows={5}
                value={form.descriptionEs || ""}
                onChange={(e) => patch({ descriptionEs: e.target.value })}
                placeholder="Cuenta la historia completa de lo que construiste y entregaste."
                hint="Falls back to English if blank."
              />
            )}
            <FormTextarea
              label="Challenge"
              rows={4}
              value={form.challenge || ""}
              onChange={(e) => patch({ challenge: e.target.value })}
              placeholder="What was the constraint, pain point, or goal?"
              hint="The problem the project solved."
            />
            <FormTextarea
              label="Solution"
              rows={4}
              value={form.solution || ""}
              onChange={(e) => patch({ solution: e.target.value })}
              placeholder="Approach, architecture, key decisions."
              hint="How the challenge was addressed."
            />
          </FormCard>

          <FormCard title="Tags, tools & results">
            <TagListInput
              label="Tags"
              hint="Short labels, e.g. Web Development, E-Commerce."
              values={form.tags}
              onChange={(tags) => patch({ tags })}
            />
            <TagListInput
              label="Tools & technologies"
              hint="Stack items, e.g. React, Django, PostgreSQL."
              values={form.tools}
              onChange={(tools) => patch({ tools })}
            />
            <TagListInput
              label="Results"
              hint="Outcomes as a short list, e.g. 'Reduced deploy time 80%'."
              values={form.results}
              onChange={(results) => patch({ results })}
              placeholder="Add a result and press Enter"
            />
          </FormCard>

          <FormCard title="Links & SEO">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Live URL"
                type="url"
                value={form.liveUrl || ""}
                onChange={(e) => patch({ liveUrl: e.target.value })}
                placeholder="https://example.com"
                error={fieldErrors.liveUrl}
              />
              <FormInput
                label="Repository URL"
                type="url"
                value={form.repoUrl || ""}
                onChange={(e) => patch({ repoUrl: e.target.value })}
                placeholder="https://github.com/you/project"
                error={fieldErrors.repoUrl}
              />
            </div>
            {locale === "en" ? (
              <FormInput
                label="Meta title"
                value={form.metaTitle || ""}
                onChange={(e) => patch({ metaTitle: e.target.value })}
                placeholder="Falls back to the project title."
              />
            ) : (
              <FormInput
                label="Meta title (ES)"
                value={form.metaTitleEs || ""}
                onChange={(e) => patch({ metaTitleEs: e.target.value })}
                placeholder="Falls back to English meta title if blank."
              />
            )}
            {locale === "en" ? (
              <FormTextarea
                label="Meta description"
                rows={2}
                value={form.metaDescription || ""}
                onChange={(e) => patch({ metaDescription: e.target.value })}
                placeholder="Falls back to the short description."
              />
            ) : (
              <FormTextarea
                label="Meta description (ES)"
                rows={2}
                value={form.metaDescriptionEs || ""}
                onChange={(e) => patch({ metaDescriptionEs: e.target.value })}
                placeholder="Falls back to English meta description if blank."
              />
            )}
          </FormCard>
        </div>

        {/* RIGHT, meta + media */}
        <aside className="space-y-4">
          <FormCard title="Publishing">
            <FormSelect
              label="Status"
              value={form.status}
              onChange={(e) => patch({ status: e.target.value })}
              options={STATUS_OPTIONS}
            />
            <Field label="Featured" hint="Pin this project to home and portfolio.">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-charcoal-80/12 bg-mist px-3 py-2 text-meta text-violet transition hover:bg-violet-pale">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => patch({ isFeatured: e.target.checked })}
                  className="h-4 w-4 rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                />
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                Featured on home / portfolio
              </label>
            </Field>
            <FormInput
              label="Display order"
              type="number"
              value={form.displayOrder}
              onChange={(e) => patch({ displayOrder: Number(e.target.value) || 0 })}
              hint="Lower numbers appear first."
              min="0"
            />
          </FormCard>

          <FormCard title="Cover image">
            {!isEdit && (
              <p className="rounded-lg border border-amber/20 bg-amber/10 p-2 text-micro text-amber-700" role="status">
                Save the project first, then come back to upload a cover.
              </p>
            )}
            {form.coverImage ? (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-xl border border-charcoal-80/10">
                  <img src={form.coverImage} alt="Cover" className="aspect-[16/10] w-full object-cover" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={!isEdit || uploadingCover}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-pale px-3 py-1.5 text-micro font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                  >
                    <Upload className="h-3 w-3" aria-hidden="true" /> Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ coverImage: null })}
                    className="inline-flex items-center gap-1 rounded-lg border border-charcoal-80/15 px-3 py-1.5 text-micro font-semibold text-charcoal-80/75 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={!isEdit || uploadingCover}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-violet/25 bg-violet-pale/30 p-8 text-micro text-violet/70 transition hover:bg-violet-pale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <ImageIcon className="h-6 w-6" aria-hidden="true" />
                {uploadingCover ? "Uploading…" : "Click to upload cover"}
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleCoverFile(e.target.files?.[0])}
            />
          </FormCard>

          <FormCard title="Gallery">
            {!isEdit && (
              <p className="rounded-lg border border-amber/20 bg-amber/10 p-2 text-micro text-amber-700" role="status">
                Save the project first, then upload gallery images.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {form.gallery.map((src, idx) => (
                <div key={`${src}-${idx}`} className="group relative overflow-hidden rounded-lg border border-charcoal-80/10">
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryAt(idx)}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={!isEdit || uploadingGallery}
                aria-label="Add gallery image"
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-violet/25 bg-violet-pale/30 text-micro text-violet/70 transition hover:bg-violet-pale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {uploadingGallery ? "Uploading…" : "Add"}
              </button>
            </div>
            <p className="mt-2 text-micro text-charcoal-80/55">
              Removing images here only drops them from this project's list, the file stays on the server.
            </p>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(e) => handleGalleryFile(e.target.files?.[0])}
            />
          </FormCard>
        </aside>
      </div>
    </FormShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  ApproachEditor · 3–5 ordered steps { title, body } (+ ES siblings)
 *  ──────────────────────────────────────────────────────────────────── */
const MAX_STEPS = 5
const MAX_OUTCOMES = 3

function ApproachEditor({ steps, locale, onChange }) {
  const update = (idx, changes) => onChange(steps.map((s, i) => (i === idx ? { ...s, ...changes } : s)))
  const remove = (idx) => onChange(steps.filter((_, i) => i !== idx))
  const move = (idx, dir) => {
    const to = idx + dir
    if (to < 0 || to >= steps.length) return
    const next = [...steps]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    onChange(next)
  }
  const add = () => {
    if (steps.length >= MAX_STEPS) return
    onChange([...steps, { title: "", body: "", titleEs: "", bodyEs: "" }])
  }
  const tKey = locale === "es" ? "titleEs" : "title"
  const bKey = locale === "es" ? "bodyEs" : "body"

  return (
    <Field label={`Approach steps (${steps.length}/${MAX_STEPS})`} hint="Three to five steps, in order. Short title + one or two sentences each.">
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="rounded-lg border border-charcoal-80/12 bg-mist p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-micro font-bold uppercase tracking-[0.14em] text-violet/70">Step {idx + 1}{locale === "es" ? " (ES)" : ""}</span>
              <div className="flex items-center gap-1">
                <IconBtn label="Move up" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp className="h-3 w-3" aria-hidden="true" /></IconBtn>
                <IconBtn label="Move down" onClick={() => move(idx, 1)} disabled={idx === steps.length - 1}><ArrowDown className="h-3 w-3" aria-hidden="true" /></IconBtn>
                <IconBtn label="Remove step" onClick={() => remove(idx)} danger><X className="h-3 w-3" aria-hidden="true" /></IconBtn>
              </div>
            </div>
            <input
              type="text"
              value={step[tKey]}
              onChange={(e) => update(idx, { [tKey]: e.target.value })}
              placeholder={locale === "es" ? "Título del paso" : "Step title"}
              aria-label={`Step ${idx + 1} title`}
              className={inputClass({ className: "mb-2" })}
            />
            <textarea
              rows={2}
              value={step[bKey]}
              onChange={(e) => update(idx, { [bKey]: e.target.value })}
              placeholder={locale === "es" ? "Qué se hizo y por qué" : "What was done and why"}
              aria-label={`Step ${idx + 1} body`}
              className={inputClass({})}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          disabled={steps.length >= MAX_STEPS}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-pale px-3 py-1.5 text-micro font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Add step
        </button>
      </div>
    </Field>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  OutcomesEditor · 2–3 quantified results { value, label, placeholder }
 *  ──────────────────────────────────────────────────────────────────── */
function OutcomesEditor({ outcomes, locale, onChange }) {
  const update = (idx, changes) => onChange(outcomes.map((o, i) => (i === idx ? { ...o, ...changes } : o)))
  const remove = (idx) => onChange(outcomes.filter((_, i) => i !== idx))
  const add = () => {
    if (outcomes.length >= MAX_OUTCOMES) return
    onChange([...outcomes, { value: "", label: "", labelEs: "", placeholder: true }])
  }
  const lKey = locale === "es" ? "labelEs" : "label"

  return (
    <Field label={`Quantified outcomes (${outcomes.length}/${MAX_OUTCOMES})`} hint="Two or three numbers: value like “-40%”, “3x”, “<2s” plus a short label. Untick “illustrative” once the figure is real.">
      <div className="space-y-2">
        {outcomes.map((o, idx) => (
          <div key={idx} className="grid grid-cols-[92px_1fr_auto] items-center gap-2 rounded-lg border border-charcoal-80/12 bg-mist p-2">
            <input
              type="text"
              value={o.value}
              onChange={(e) => update(idx, { value: e.target.value })}
              placeholder="-40%"
              aria-label={`Outcome ${idx + 1} value`}
              className={inputClass({ className: "font-mono font-semibold" })}
            />
            <input
              type="text"
              value={o[lKey]}
              onChange={(e) => update(idx, { [lKey]: e.target.value })}
              placeholder={locale === "es" ? "tiempo de despliegue" : "deploy time"}
              aria-label={`Outcome ${idx + 1} label${locale === "es" ? " (ES)" : ""}`}
              className={inputClass({})}
            />
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-micro text-charcoal-80/70">
                <input
                  type="checkbox"
                  checked={o.placeholder}
                  onChange={(e) => update(idx, { placeholder: e.target.checked })}
                  className="h-3.5 w-3.5 accent-violet"
                />
                illustrative
              </label>
              <IconBtn label="Remove outcome" onClick={() => remove(idx)} danger><X className="h-3 w-3" aria-hidden="true" /></IconBtn>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          disabled={outcomes.length >= MAX_OUTCOMES}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-pale px-3 py-1.5 text-micro font-semibold text-violet transition hover:bg-violet hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Add outcome
        </button>
      </div>
    </Field>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded-md border border-charcoal-80/12 bg-white text-charcoal-80/70 transition disabled:opacity-40 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40 ${
        danger ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600" : "hover:border-violet/30 hover:text-violet"
      }`}
    >
      {children}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  TagListInput — preserved verbatim from prior version. Kept inline since
 *  it's specific to this form. Could move to components/admin/ if reused.
 *  ──────────────────────────────────────────────────────────────────── */
function TagListInput({ label, hint, values, onChange, placeholder = "Type and press Enter" }) {
  const [input, setInput] = useState("")

  function add(raw) {
    const parts = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    const next = [...values]
    for (const p of parts) {
      if (!next.includes(p)) next.push(p)
    }
    onChange(next)
    setInput("")
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add(input)
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className={inputClass({ className: "flex flex-wrap items-center gap-1.5 p-2 focus-within:border-violet/40 focus-within:ring-[3px] focus-within:ring-azure/20" })}>
        {values.map((v, idx) => (
          <span key={`${v}-${idx}`} className="inline-flex items-center gap-1 rounded-full bg-violet-pale px-2.5 py-0.5 text-micro font-semibold text-violet">
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
              aria-label={`Remove ${v}`}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-violet/20 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
            >
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (input.trim()) add(input) }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-meta text-violet placeholder:text-charcoal-80/35 focus:outline-none"
        />
      </div>
    </Field>
  )
}
