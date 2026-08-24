import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Briefcase, Award, Sparkles, Plus, Pencil, Trash2,
  Loader2, Save, X, AlertCircle, RefreshCw, GraduationCap,
  Upload, FileText, ExternalLink, CheckCircle2, Search,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import {
  adminListExperience, adminCreateExperience, adminUpdateExperience, adminDeleteExperience,
  adminListCertificates, adminCreateCertificate, adminUpdateCertificate, adminDeleteCertificate,
  adminListSkills, adminCreateSkill, adminUpdateSkill, adminDeleteSkill,
  adminListEducation, adminCreateEducation, adminUpdateEducation, adminDeleteEducation,
} from "../services/bioService"
import { API_BASE_URL, getStoredToken } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { ICON_REGISTRY } from "../components/SkillsByCapability"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminBioPage · M12 · Bio CMS
 *
 *  Manages the three sections rendered on the public About page:
 *    - Experience (work history)
 *    - Certificates (issued credentials)
 *    - Skills (technology proficiency · grouped by category)
 *
 *  Each tab is its own self-contained CRUD island with a shared modal form.
 *  No DataTable here — entries are short and need custom layouts (date
 *  ranges, proficiency bars, multi-line descriptions). Bespoke list rows
 *  match the visual language of AdminCategoriesPage and AdminUsersPage.
 *  ──────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: "experience", label: "Experience", icon: Briefcase },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "certificates", label: "Certificates", icon: Award },
  { key: "skills", label: "Skills", icon: Sparkles },
]

const SKILL_CATEGORIES = [
  "frontend", "backend", "tools", "database", "cloud", "language", "soft_skill",
]

/* Maps each DB category to the public-facing capability section it lands in.
 * Surfaced in the SkillForm so the admin sees where a skill will appear. */
const CATEGORY_TO_PUBLIC = {
  frontend: { capability: "Build", section: "Capabilities" },
  backend: { capability: "Build", section: "Capabilities" },
  database: { capability: "Data", section: "Capabilities" },
  cloud: { capability: "Ship", section: "Capabilities" },
  tools: { capability: "Ship / Operate / Secure", section: "Capabilities (auto-grouped by name + iconKey)" },
  soft_skill: { capability: "Teach & Lead", section: "Capabilities" },
  language: { capability: "-", section: "Languages I work in (CEFR strip)" },
}

const PROFICIENCY_TIERS = {
  1: { label: "Familiar", tone: "bg-charcoal-80/30" },
  2: { label: "Working", tone: "bg-charcoal-80/45" },
  3: { label: "Proficient", tone: "bg-violet/55" },
  4: { label: "Advanced", tone: "bg-violet/80" },
  5: { label: "Expert", tone: "bg-violet" },
}

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

function fmtDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" })
  } catch {
    return String(iso)
  }
}

function inputCls() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal-50 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
}

export default function AdminBioPage() {
  const [tab, setTab] = useState("experience")

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-charcoal tracking-tight">Bio CMS</h1>
        <p className="mt-1 text-sm text-charcoal-80">
          Edit Experience, Certificates, and Skills shown on the public About page.
        </p>
      </header>

      <nav role="tablist" aria-label="Bio sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                active
                  ? "border-violet text-violet"
                  : "border-transparent text-charcoal-80 hover:text-charcoal"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
            </button>
          )
        })}
      </nav>

      <motion.div key={tab} {...fadeUp} className="mt-6">
        {tab === "experience" && <ExperienceTab />}
        {tab === "education" && <EducationTab />}
        {tab === "certificates" && <CertificatesTab />}
        {tab === "skills" && <SkillsTab />}
      </motion.div>
    </div>
  )
}

/* Authoritative experience seed · mirrors web/src/data/sitePagesData.js
 * and prisma/seed-bio.js. Used by the "Seed originals" button below so the
 * owner can populate the DB without SSH access — each row becomes a normal
 * editable record. Idempotent: rows with the same role+company key are
 * skipped (case-insensitive). */
const SEED_EXPERIENCE = [
  {
    role: "IT Manager · Full-Stack Developer · ICT Coordinator · CS Educator",
    company: "Colegio de Excelencia Raindrop",
    location: "Tlalnepantla de Baz, Estado de México, Mexico",
    startDate: "2022-12-01",
    endDate: null,
    description:
      "Lead end-to-end ICT operations and full-stack engineering for a 100-plus user campus, while designing and delivering the Computer Science and STEM curriculum for secondary-level students.",
    highlights: [
      "Built and optimized the school web infrastructure on Python and Google Cloud Platform — delivered a 40% improvement in page-load performance and 99% uptime for over 100 daily users.",
      "Led a full network infrastructure upgrade across TCP/IP, DNS, DHCP, and VPN systems, reducing operational downtime by over 30% and sustaining 99% campus-wide uptime.",
      "Administered end-to-end technical support for hardware, software, and network systems across the entire campus, holding a consistent sub-two-hour issue resolution standard.",
      "Developed internal automation tools and reporting dashboards in Python, Django, and JavaScript, eliminating manual workflows across 12 departments and recovering significant staff hours each week.",
      "Integrated Google Workspace and LMS platforms into daily academic operations, fully digitalizing instructional and administrative processes and onboarding 40 faculty members.",
      "Designed, developed, and delivered the school Computer Science and STEM curriculum for secondary-level students, covering Python, Java, web development, data literacy, and computational thinking.",
      "Mentored 10 students in Python, Java, and web development — coached a project team that advanced to the XIX InfoMatrix Ibero-American Science and Technology National Finals 2025 (SOLACYT).",
    ],
  },
  {
    role: "Assistant Project Manager · Technical Systems",
    company: "Design Office of Africa Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2021-09-01",
    endDate: "2022-09-01",
    description:
      "Coordinated technical project delivery and IT operations across concurrent engineering and design workstreams.",
    highlights: [
      "Coordinated technical timelines, task assignments, and delivery milestones across concurrent projects using JIRA — consistently meeting deadlines on time and within scope.",
      "Managed internal digital systems and IT infrastructure, maintaining 99% uptime and ensuring data integrity across all operational platforms.",
      "Provided direct IT support and troubleshooting to internal teams across hardware, software, and network issues, resolving incidents promptly to prevent disruption to project delivery.",
      "Produced multilingual technical documentation in English, Turkish, and Kinyarwanda for cross-functional stakeholder teams.",
    ],
  },
  {
    role: "ICT Infrastructure Director · Backend Developer · Technical Support Lead",
    company: "Intellectual Schools AC",
    location: "Addis Ababa, Ethiopia",
    startDate: "2021-01-01",
    endDate: "2021-08-01",
    description:
      "Directed all ICT operations and led the institutional web and backend redesign across a multi-building campus serving 1,000-plus students and 60 faculty.",
    highlights: [
      "Redesigned the institutional web and backend infrastructure, achieving a 50% improvement in website performance through server-side optimization, database query tuning, and caching strategies.",
      "Reduced system downtime by 30% by deploying proactive infrastructure monitoring, configuring automated alerts, and establishing scheduled preventive maintenance protocols.",
      "Managed the full scope of IT support operations across the multi-building campus — covering hardware, software, and network systems with an average issue resolution time of under two hours.",
      "Led the deployment of Google Workspace and LMS platforms across the institution, improving digital tool adoption by 60% in the first quarter and enabling hybrid e-learning at scale.",
    ],
  },
  {
    role: "Software Development Instructor · Curriculum Designer",
    company: "St. Emmanuel School Complex",
    location: "Kigali, Rwanda",
    startDate: "2020-01-01",
    endDate: "2020-12-01",
    description:
      "Designed and delivered the institutional software development curriculum from foundational programming through application deployment.",
    highlights: [
      "Designed and delivered a full-cycle STEM and software development curriculum in Python, Java, JavaScript, and web development.",
      "Introduced Git and GitHub version control practices into student workflows — reduced code integration errors by an estimated 35% and built habits of collaborative, professional-standard development.",
      "Developed structured lesson plans, rubrics, and project-based assessments aligned with international CS education standards.",
    ],
  },
  {
    role: "Sales & Marketing Officer · Digital Systems",
    company: "Blueflame Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2020-05-01",
    endDate: "2020-12-01",
    description:
      "Drove digital marketing and customer-acquisition strategy through CRM-driven campaigns and conversion-optimized email systems.",
    highlights: [
      "Generated a 25% increase in company revenue through a data-driven digital marketing strategy combining CRM automation, audience segmentation, and campaign performance analytics.",
      "Built HTML, CSS, and JavaScript email marketing campaigns that measurably improved customer conversion rates and audience engagement.",
    ],
  },
  {
    role: "Translator & Interpreter",
    company: "Umut Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2018-09-01",
    endDate: "2020-05-01",
    description:
      "Delivered professional interpretation and document translation services in Turkish, English, and Kinyarwanda across business, legal, and diplomatic contexts.",
    highlights: [
      "Provided professional interpretation and translation in three working languages for international stakeholders.",
      "Served clients across business, legal, and diplomatic environments — built the multilingual professional foundation that anchors the entire current brand.",
    ],
  },
]

/* ─────────────────── Experience Tab ─────────────────── */

function ExperienceTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await adminListExperience()
      const arr = Array.isArray(data) ? data : []
      if (import.meta.env.DEV) console.info("[Bio · Experience] loaded", arr.length, "rows", arr)
      setItems(arr)
    } catch (e) {
      console.error("[Bio · Experience] load failed:", e)
      const msg = e?.message || "Failed to load experience."
      setError(msg)
      toast.showError(msg, "Could not load experience")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { reload() }, [reload])

  // Save: throw inside try/catch so the form's submit handler also catches.
  // Reload is fire-and-forget after a successful save so a stale GET doesn't
  // mask the success state.
  const onSave = async (form) => {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit
        ? await adminUpdateExperience(form.id, form)
        : await adminCreateExperience(form)
      if (import.meta.env.DEV) console.info("[Bio · Experience] saved", saved)
      toast.showSuccess(isEdit ? "Experience updated" : "Experience added")
      setEditing(null)
      // Reload runs after success — its failure shouldn't roll back the success toast.
      try { await reload() } catch (re) { console.warn("[Bio · Experience] reload after save failed:", re) }
    } catch (e) {
      console.error("[Bio · Experience] save failed:", e)
      toast.showError(e?.message || "Save failed", "Could not save experience")
      throw e // re-throw so the form modal also shows the inline error
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm("Delete this experience entry?")) return
    try {
      await adminDeleteExperience(id)
      toast.showSuccess("Experience deleted")
      await reload()
    } catch (e) {
      console.error("[Bio · Experience] delete failed:", e)
      toast.showError(e?.message || "Delete failed", "Could not delete experience")
    }
  }

  /* Bulk-import the 6 authoritative experience entries so the owner can edit
   * / delete / reorder them like any other row. Skips entries whose
   * (role, company) key already exists (case-insensitive). Mirrors the
   * certificates section's "Seed originals" pattern. */
  const onSeedOriginals = async () => {
    if (!window.confirm(
      `Add the ${SEED_EXPERIENCE.length} authoritative experience entries to the database?\n\nThey'll be fully editable from this panel. Existing rows with the same role + company are skipped.`
    )) return
    setSeeding(true)
    const existing = new Set(
      items.map((x) => `${(x.role || "").trim().toLowerCase()}::${(x.company || "").trim().toLowerCase()}`)
    )
    let added = 0, skipped = 0, failed = 0

    for (let i = 0; i < SEED_EXPERIENCE.length; i += 1) {
      const seed = SEED_EXPERIENCE[i]
      const key = `${seed.role.trim().toLowerCase()}::${seed.company.trim().toLowerCase()}`
      if (existing.has(key)) { skipped += 1; continue }
      try {
        await adminCreateExperience({
          role:         seed.role,
          company:      seed.company,
          location:     seed.location,
          startDate:    seed.startDate,
          endDate:      seed.endDate,
          description:  seed.description,
          highlights:   seed.highlights,
          displayOrder: i,
          isVisible:    true,
        })
        added += 1
      } catch (e) {
        console.error("[Bio · Experience] seed failed for:", seed.role, e)
        failed += 1
      }
    }

    setSeeding(false)
    if (added > 0) toast.showSuccess(`Added ${added} experience entr${added === 1 ? "y" : "ies"}${skipped ? ` · skipped ${skipped}` : ""}${failed ? ` · ${failed} failed` : ""}`)
    else if (skipped === SEED_EXPERIENCE.length) (toast.showInfo?.("All entries already in the database.") || toast.showSuccess("Already up to date."))
    else if (failed > 0) toast.showError(`${failed} entr${failed === 1 ? "y" : "ies"} failed to import.`, "Seed incomplete")
    await reload()
  }

  return (
    <Section
      title="Experience"
      onAdd={() => setEditing({})}
      onRefresh={reload}
      loading={loading}
      action={
        <div className="flex items-center gap-3">
          <a
            href="/about#journey"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-azure hover:underline"
          >
            View on About page ↗
          </a>
          <button
            type="button"
            onClick={onSeedOriginals}
            disabled={seeding || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet-pale disabled:opacity-60"
            title="Insert the 6 authoritative experience entries into the DB so they become editable here"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Seed originals ({SEED_EXPERIENCE.length})
          </button>
        </div>
      }
    >
      <Body
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyText={
          <span>
            No experience entries yet.{" "}
            <button type="button" onClick={onSeedOriginals} disabled={seeding} className="font-semibold text-violet underline-offset-2 hover:underline">
              {seeding ? "Importing…" : `Import the ${SEED_EXPERIENCE.length} originals`}
            </button>{" "}
            or click <span className="font-semibold">Add</span> to create one from scratch.
          </span>
        }
      >
        <ul className="divide-y divide-slate-200">
          {items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">
                  {x.role} · <span className="font-normal text-charcoal-80">{x.company}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                  {fmtDate(x.startDate)} → {x.endDate ? fmtDate(x.endDate) : "Present"}
                  {x.location ? ` · ${x.location}` : ""}
                  {x.isVisible ? "" : " · hidden"}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-charcoal-80">{x.description}</p>
              </div>
              <RowActions onEdit={() => setEditing(x)} onDelete={() => onDelete(x.id)} />
            </li>
          ))}
        </ul>
      </Body>

      {editing && (
        <Modal title={editing.id ? "Edit experience" : "New experience"} onClose={() => setEditing(null)}>
          <ExperienceForm initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Section>
  )
}

function ExperienceForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    id: initial.id,
    role: initial.role ?? "",
    company: initial.company ?? "",
    location: initial.location ?? "",
    startDate: initial.startDate ? String(initial.startDate).slice(0, 10) : "",
    endDate: initial.endDate ? String(initial.endDate).slice(0, 10) : "",
    description: initial.description ?? "",
    isVisible: initial.isVisible !== false,
    displayOrder: initial.displayOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr("")
    try { await onSubmit(f) }
    catch (x) { setErr(x?.message || "Save failed."); setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Role" required>
        <input required value={f.role} onChange={(e) => set("role", e.target.value)} className={inputCls()} />
      </Field>
      <Field label="Company" required>
        <input required value={f.company} onChange={(e) => set("company", e.target.value)} className={inputCls()} />
      </Field>
      <Field label="Location">
        <input value={f.location} onChange={(e) => set("location", e.target.value)} className={inputCls()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" required>
          <input required type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
        <Field label="End date (empty = present)">
          <input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
      </div>
      <Field label="Description" required>
        <textarea required rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls()} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={f.isVisible} onChange={(e) => set("isVisible", e.target.checked)} />
        <span>Visible on About page</span>
      </label>
      {err && <ErrorRow message={err} />}
      <FormActions onCancel={onCancel} saving={saving} />
    </form>
  )
}

/* ─────────────────── Education Tab ─────────────────── */

function EducationTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await adminListEducation()
      const arr = Array.isArray(data) ? data : []
      if (import.meta.env.DEV) console.info("[Bio · Education] loaded", arr.length, "rows", arr)
      setItems(arr)
    } catch (e) {
      console.error("[Bio · Education] load failed:", e)
      const msg = e?.message || "Failed to load education."
      setError(msg)
      toast.showError(msg, "Could not load education")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { reload() }, [reload])

  const onSave = async (form) => {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit
        ? await adminUpdateEducation(form.id, form)
        : await adminCreateEducation(form)
      if (import.meta.env.DEV) console.info("[Bio · Education] saved", saved)
      toast.showSuccess(isEdit ? "Education updated" : "Education added")
      setEditing(null)
      try { await reload() } catch (re) { console.warn("[Bio · Education] reload after save failed:", re) }
    } catch (e) {
      console.error("[Bio · Education] save failed:", e)
      toast.showError(e?.message || "Save failed", "Could not save education")
      throw e
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm("Delete this education entry?")) return
    try {
      await adminDeleteEducation(id)
      toast.showSuccess("Education deleted")
      await reload()
    } catch (e) {
      console.error("[Bio · Education] delete failed:", e)
      toast.showError(e?.message || "Delete failed", "Could not delete education")
    }
  }

  return (
    <Section title="Education" onAdd={() => setEditing({})} onRefresh={reload} loading={loading}>
      <Body loading={loading} error={error} empty={items.length === 0} emptyText="No education entries yet.">
        <ul className="divide-y divide-slate-200">
          {items.map((x) => (
            <li key={x.id} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">
                  {x.degree} · <span className="font-normal text-charcoal-80">{x.institution}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                  {fmtDate(x.startDate)} → {x.endDate ? fmtDate(x.endDate) : "Present"}
                  {x.location ? ` · ${x.location}` : ""}
                  {x.fieldOfStudy ? ` · ${x.fieldOfStudy}` : ""}
                  {x.grade ? ` · ${x.grade}` : ""}
                  {x.isVisible ? "" : " · hidden"}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-charcoal-80">{x.description}</p>
              </div>
              <RowActions onEdit={() => setEditing(x)} onDelete={() => onDelete(x.id)} />
            </li>
          ))}
        </ul>
      </Body>

      {editing && (
        <Modal title={editing.id ? "Edit education" : "New education"} onClose={() => setEditing(null)}>
          <EducationForm initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Section>
  )
}

function EducationForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    id: initial.id,
    degree: initial.degree ?? "",
    institution: initial.institution ?? "",
    location: initial.location ?? "",
    fieldOfStudy: initial.fieldOfStudy ?? "",
    grade: initial.grade ?? "",
    startDate: initial.startDate ? String(initial.startDate).slice(0, 10) : "",
    endDate: initial.endDate ? String(initial.endDate).slice(0, 10) : "",
    description: initial.description ?? "",
    isVisible: initial.isVisible !== false,
    displayOrder: initial.displayOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr("")
    try { await onSubmit(f) }
    catch (x) { setErr(x?.message || "Save failed."); setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Degree / qualification" required>
        <input required value={f.degree} onChange={(e) => set("degree", e.target.value)} className={inputCls()} placeholder="e.g. Master's in Strategic Management" />
      </Field>
      <Field label="Institution" required>
        <input required value={f.institution} onChange={(e) => set("institution", e.target.value)} className={inputCls()} placeholder="e.g. Universidad Europea del Atlántico" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Field of study">
          <input value={f.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} className={inputCls()} placeholder="e.g. Software Engineering" />
        </Field>
        <Field label="Grade">
          <input value={f.grade} onChange={(e) => set("grade", e.target.value)} className={inputCls()} placeholder="e.g. Distinction" />
        </Field>
      </div>
      <Field label="Location">
        <input value={f.location} onChange={(e) => set("location", e.target.value)} className={inputCls()} placeholder="e.g. Santander, Spain" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date" required>
          <input required type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
        <Field label="End date (empty = present)">
          <input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
      </div>
      <Field label="Description" required>
        <textarea required rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls()} placeholder="What you studied, projects, focus areas, anything noteworthy." />
      </Field>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={f.isVisible} onChange={(e) => set("isVisible", e.target.checked)} />
        <span>Visible on About page</span>
      </label>
      {err && <ErrorRow message={err} />}
      <FormActions onCancel={onCancel} saving={saving} />
    </form>
  )
}

/* ─────────────────── PdfUploader ───────────────────────────────────────────
 *  Drop-zone + click-to-pick PDF uploader for the certificate form.
 *
 *  - Sends multipart/form-data to POST /api/admin/media (field name: "file")
 *  - 20 MB hard limit (matches backend); 10 MB soft warning
 *  - PDF only (mime check + extension check)
 *  - Shows progress, filename, and a "Replace" / "Remove" pair after upload
 *  - On success, calls onChange(url) with the same-origin /images/media/... path
 * ────────────────────────────────────────────────────────────────────────── */

function PdfUploader({ value, onChange, disabled = false }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState("") // last-uploaded filename (for the success state)

  const triggerPick = () => { if (!disabled && !uploading) inputRef.current?.click() }

  const validate = (file) => {
    if (!file) return "No file selected."
    const isPdf =
      file.type === "application/pdf" ||
      /\.pdf$/i.test(file.name)
    if (!isPdf) return "Only PDF files are accepted."
    if (file.size > 20 * 1024 * 1024) return "File is too large (max 20 MB)."
    return ""
  }

  const upload = async (file) => {
    const v = validate(file)
    if (v) { setError(v); return }
    setError(""); setUploading(true); setProgress(0); setFileName(file.name)

    try {
      const token = getStoredToken()
      const fd = new FormData()
      fd.append("file", file)

      // XHR (instead of fetch) so we get real upload-progress events
      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `${API_BASE_URL}/api/admin/media`)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || "{}")
            if (xhr.status >= 200 && xhr.status < 300 && parsed?.success) resolve(parsed.data)
            else reject(new Error(parsed?.error || `Upload failed (HTTP ${xhr.status})`))
          } catch { reject(new Error("Upload returned an invalid response.")) }
        }
        xhr.onerror = () => reject(new Error("Network error during upload."))
        xhr.send(fd)
      })

      const url = data?.fileUrl || data?.url
      if (!url) throw new Error("Upload succeeded but no URL was returned.")
      onChange(url)
    } catch (e) {
      setError(e?.message || "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    // Allow re-picking the same file
    e.target.value = ""
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer?.files?.[0]
    if (file) upload(file)
  }

  // ── Render: 3 states · empty · uploading · uploaded ────────────────────

  if (uploading) {
    return (
      <div className="rounded-xl border border-violet/20 bg-violet/5 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-charcoal">{fileName}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet/10">
              <div className="h-full rounded-full bg-violet transition-[width] duration-150 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <span className="font-mono text-xs tabular-nums text-charcoal-50">{progress}%</span>
        </div>
      </div>
    )
  }

  if (value) {
    return (
      <div className="rounded-xl border border-mint/30 bg-mint/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mint/15 text-mint">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-charcoal">PDF attached</div>
            <a
              href={value.startsWith("http") ? value : `${API_BASE_URL}${value}`}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block truncate font-mono text-xs text-azure hover:underline"
              title={value}
            >
              {value}
            </a>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={triggerPick}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
              title="Replace PDF"
            >
              <Upload className="h-3.5 w-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-rose hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40"
              title="Remove PDF"
              aria-label="Remove PDF"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-xs text-rose">{error}</div>}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
      </div>
    )
  }

  // Empty state — drop zone
  return (
    <div>
      <button
        type="button"
        onClick={triggerPick}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={disabled}
        className={[
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-white px-4 py-8 text-center transition",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40",
          dragOver
            ? "border-violet bg-violet-pale"
            : "border-slate-300 hover:border-violet/50 hover:bg-violet-pale/40",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet/10 text-violet">
          <Upload className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="text-sm font-semibold text-charcoal">
          Click to upload or drag a PDF here
        </div>
        <div className="text-xs text-charcoal-50">
          PDF only · up to 20 MB
        </div>
      </button>
      {error && (
        <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-2.5 text-xs text-rose">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPick} />
    </div>
  )
}

/* ─────────────────── Certificates Tab ─────────────────── */

// One-click seed list — mirrors the 9 hardcoded fallback certs in
// AboutPage.jsx. Lets the owner migrate them into the DB so they become
// editable from admin without losing the polished PDF tile experience.
const SEED_CERTIFICATES = [
  { title: "Python 101 for Data Science", issuer: "IBM / Cognitive Class", pdfUrl: "/documents/certificates/Certificate___Python_for_Data_Science_UKIZURU_Mustapha.pdf", category: "data" },
  { title: "English for Career Development", issuer: "UPenn / Coursera", pdfUrl: "/documents/certificates/Certificate_English_for_Career_Development_UKIZURU_Mustapha.pdf", category: "language" },
  { title: "Philosophy of Science", issuer: "UPenn / Coursera", pdfUrl: "/documents/certificates/Certificate_Philosophy_of_SCience_UKIZURU_Mustapha.pdf", category: "general" },
  { title: "Practical Teaching with Technology", issuer: "University of London / Coursera", pdfUrl: "/documents/certificates/Certificate_Teaching_with_technology_UKIZURU_Mustapha.pdf", category: "education" },
  { title: "Google Certified Educator Level 2", issuer: "Google for Education", pdfUrl: "/documents/certificates/Google_Certified_Educator_Level_2_UKIZURU_Mustapha.pdf", category: "education" },
  { title: "Google IT Support Professional", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_Google_IT_Support_Professional_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "Technical Support Fundamentals", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_Technical_Support_Fundamentals_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "System Administration & IT Infrastructure", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_System_Administration_and_IT_Infrastructure_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "Maestras y Maestros Construimos Igualdad", issuer: "Gobierno del Estado de Mexico", pdfUrl: "/documents/certificates/Certificate_Constancia_UKIZURU_Mustapha.pdf", category: "education" },
]

function CertificatesTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)
  const [seeding, setSeeding] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await adminListCertificates()
      const arr = Array.isArray(data) ? data : []
      if (import.meta.env.DEV) console.info("[Bio · Certificates] loaded", arr.length, "rows", arr)
      setItems(arr)
    } catch (e) {
      console.error("[Bio · Certificates] load failed:", e)
      const msg = e?.message || "Failed to load certificates."
      setError(msg)
      toast.showError(msg, "Could not load certificates")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { reload() }, [reload])

  const onSave = async (form) => {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit
        ? await adminUpdateCertificate(form.id, form)
        : await adminCreateCertificate(form)
      if (import.meta.env.DEV) console.info("[Bio · Certificates] saved", saved)
      toast.showSuccess(isEdit ? "Certificate updated" : "Certificate added")
      setEditing(null)
      try { await reload() } catch (re) { console.warn("[Bio · Certificates] reload after save failed:", re) }
    } catch (e) {
      console.error("[Bio · Certificates] save failed:", e)
      toast.showError(e?.message || "Save failed", "Could not save certificate")
      throw e
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm("Delete this certificate?")) return
    try {
      await adminDeleteCertificate(id)
      toast.showSuccess("Certificate deleted")
      await reload()
    } catch (e) {
      console.error("[Bio · Certificates] delete failed:", e)
      toast.showError(e?.message || "Delete failed", "Could not delete certificate")
    }
  }

  // Seed the 9 hardcoded fallback certificates into the DB so the owner can
  // edit / delete / replace them like any other entry. Skips titles that
  // already exist (case-insensitive) — safe to run multiple times.
  const onSeedOriginals = async () => {
    if (!window.confirm(`Add the ${SEED_CERTIFICATES.length} original certificates to the database?\n\nThey'll be fully editable from this panel.`)) return
    setSeeding(true)
    const today = new Date().toISOString().slice(0, 10)
    const existingTitles = new Set(items.map((c) => c.title?.trim().toLowerCase()))
    let added = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < SEED_CERTIFICATES.length; i += 1) {
      const seed = SEED_CERTIFICATES[i]
      if (existingTitles.has(seed.title.toLowerCase())) { skipped += 1; continue }
      try {
        await adminCreateCertificate({
          title: seed.title,
          issuer: seed.issuer,
          issueDate: today, // backfill, owner can edit per cert
          pdfUrl: seed.pdfUrl,
          category: seed.category || null,
          isVisible: true,
          displayOrder: i, // preserves original order
        })
        added += 1
      } catch (e) {
        console.error("[Bio · Certificates] seed failed for:", seed.title, e)
        failed += 1
      }
    }

    setSeeding(false)
    if (added > 0) toast.showSuccess(`Added ${added} certificate${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}${failed ? ` · ${failed} failed` : ""}`)
    else if (skipped === SEED_CERTIFICATES.length) toast.showInfo?.("All originals already in the database.") || toast.showSuccess("Already up to date.")
    else if (failed > 0) toast.showError(`${failed} certificate${failed === 1 ? "" : "s"} failed to import.`, "Seed incomplete")
    await reload()
  }

  // Sort by displayOrder ASC, then by issueDate DESC so the admin list
  // matches what visitors see on About.
  const sortedItems = [...items].sort((a, b) => {
    const ord = (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
    if (ord !== 0) return ord
    const da = a.issueDate ? new Date(a.issueDate).getTime() : 0
    const db = b.issueDate ? new Date(b.issueDate).getTime() : 0
    return db - da
  })

  return (
    <Section
      title="Certificates"
      onAdd={() => setEditing({})}
      onRefresh={reload}
      loading={loading}
      action={
        <div className="flex items-center gap-3">
          <a
            href="/about#certifications"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-azure hover:underline"
          >
            View on About page ↗
          </a>
          <button
            type="button"
            onClick={onSeedOriginals}
            disabled={seeding || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet/20 bg-white px-2.5 py-1 text-xs font-semibold text-violet hover:bg-violet-pale disabled:opacity-60"
            title="Insert the 9 original certificates into the DB so they become editable here"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Seed originals (9)
          </button>
        </div>
      }
    >
      <Body
        loading={loading}
        error={error}
        empty={items.length === 0}
        emptyText={
          <span>
            No certificates yet.{" "}
            <button type="button" onClick={onSeedOriginals} disabled={seeding} className="font-semibold text-violet underline-offset-2 hover:underline">
              {seeding ? "Importing…" : "Import the 9 originals"}
            </button>{" "}
            or click <span className="font-semibold">Add</span> to create one from scratch.
          </span>
        }
      >
        <ul className="divide-y divide-slate-200">
          {sortedItems.map((c) => {
            const initial = (c.issuer || c.title || "?").trim().charAt(0).toUpperCase()
            const isPdf = Boolean(c.pdfUrl)
            return (
              <li key={c.id} className="flex items-start gap-4 py-4">
                {/* Visual cue, issuer logo or initial chip */}
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet/10 ring-1 ring-violet/15">
                  {c.issuerLogo ? (
                    <img src={c.issuerLogo} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" />
                  ) : (
                    <span className="font-mono text-sm font-bold text-violet">{initial}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-charcoal">{c.title}</span>
                    {/* Source pill */}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                        isPdf
                          ? "bg-mint/15 text-mint"
                          : c.credentialUrl
                            ? "bg-azure/10 text-azure"
                            : "bg-charcoal-80/8 text-charcoal-80"
                      }`}
                      title={isPdf ? "Hosted PDF" : c.credentialUrl ? "External credential URL" : "No source, tile will fall back to initial"}
                    >
                      {isPdf ? "PDF" : c.credentialUrl ? "URL" : "-"}
                    </span>
                    {!c.isVisible && (
                      <span className="inline-flex items-center rounded-full bg-amber/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                        Hidden
                      </span>
                    )}
                    {typeof c.displayOrder === "number" && c.displayOrder !== 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-charcoal-50">#{c.displayOrder}</span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-charcoal-50 tabular-nums">
                    {c.issuer} · {fmtDate(c.issueDate)}
                    {c.category ? ` · ${c.category}` : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {c.pdfUrl && (
                      <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="text-azure hover:underline">
                        Open PDF →
                      </a>
                    )}
                    {c.credentialUrl && (
                      <a href={c.credentialUrl} target="_blank" rel="noreferrer" className="text-azure hover:underline">
                        Verify credential →
                      </a>
                    )}
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(c)} onDelete={() => onDelete(c.id)} />
              </li>
            )
          })}
        </ul>
      </Body>

      {editing && (
        <Modal title={editing.id ? "Edit certificate" : "New certificate"} onClose={() => setEditing(null)}>
          <CertificateForm initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Section>
  )
}

function CertificateForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    id: initial.id,
    title: initial.title ?? "",
    issuer: initial.issuer ?? "",
    issuerLogo: initial.issuerLogo ?? "",
    issueDate: initial.issueDate ? String(initial.issueDate).slice(0, 10) : "",
    expiryDate: initial.expiryDate ? String(initial.expiryDate).slice(0, 10) : "",
    credentialId: initial.credentialId ?? "",
    credentialUrl: initial.credentialUrl ?? "",
    pdfUrl: initial.pdfUrl ?? "",
    category: initial.category ?? "",
    isVisible: initial.isVisible !== false,
    displayOrder: typeof initial.displayOrder === "number" ? initial.displayOrder : 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  // Submit: trim + coerce types to match the Prisma model.
  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr("")
    try {
      await onSubmit({
        ...f,
        title: f.title.trim(),
        issuer: f.issuer.trim(),
        issuerLogo: f.issuerLogo.trim() || null,
        category: f.category.trim() || null,
        credentialId: f.credentialId.trim() || null,
        credentialUrl: f.credentialUrl.trim() || null,
        pdfUrl: f.pdfUrl.trim() || null,
        expiryDate: f.expiryDate || null,
        displayOrder: Number.isFinite(Number(f.displayOrder)) ? Number(f.displayOrder) : 0,
      })
    }
    catch (x) { setErr(x?.message || "Save failed."); setSaving(false) }
  }

  // Source-of-truth indicator for the visitor — keeps the user honest about
  // what the public tile will look like before they save.
  const sourceMode = f.pdfUrl
    ? { label: "PDF preview", tone: "bg-mint/15 text-mint", hint: "Hosted PDF will render inline as a thumbnail." }
    : f.credentialUrl
    ? { label: "Credential card", tone: "bg-azure/10 text-azure", hint: "External link only, tile shows issuer logo + Verify button." }
    : { label: "Initial card", tone: "bg-charcoal-80/8 text-charcoal-80", hint: "No source, tile shows issuer initial only. Add a PDF or credential URL." }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" required>
        <input required value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls()} placeholder="e.g. Google IT Support Professional" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Issuer" required>
          <input required value={f.issuer} onChange={(e) => set("issuer", e.target.value)} className={inputCls()} placeholder="Google · Coursera · IBM" />
        </Field>
        <Field label="Display order" hint="Lower shows first">
          <input
            type="number"
            value={f.displayOrder}
            onChange={(e) => set("displayOrder", e.target.value)}
            className={`${inputCls()} font-mono w-24`}
          />
        </Field>
      </div>

      <Field label="Issuer logo URL" hint="Square or wide image. Falls back to issuer initial.">
        <input
          value={f.issuerLogo}
          onChange={(e) => set("issuerLogo", e.target.value)}
          className={inputCls()}
          placeholder="https://… (PNG/SVG)"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Issue date" required>
          <input required type="date" value={f.issueDate} onChange={(e) => set("issueDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
        <Field label="Expiry date">
          <input type="date" value={f.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} className={`${inputCls()} font-mono`} />
        </Field>
      </div>

      <Field label="Category">
        <input value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls()} placeholder="cloud · education · language" />
      </Field>

      <Field label="Credential ID">
        <input value={f.credentialId} onChange={(e) => set("credentialId", e.target.value)} className={`${inputCls()} font-mono`} placeholder="ABCD-1234-EFGH" />
      </Field>

      {/* Certificate file — primary source for the public tile.
          The uploaded PDF is what visitors see (page-1 thumbnail) and what
          opens in the modal viewer with download / open-in-new-tab. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-charcoal-80">
              <FileText className="h-3.5 w-3.5" /> Certificate file
            </div>
            <div className="mt-0.5 text-[11px] text-charcoal-50">
              The PDF visitors see on /about. Renders as a page-1 thumbnail and opens in a viewer with download.
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${sourceMode.tone}`}
            title={sourceMode.hint}
          >
            {sourceMode.label}
          </span>
        </div>

        <PdfUploader
          value={f.pdfUrl}
          onChange={(url) => set("pdfUrl", url)}
        />

        {/* Advanced, paste a URL manually (legacy paths or external PDFs) */}
        <details className="group mt-3">
          <summary className="cursor-pointer select-none text-xs font-semibold text-charcoal-80 hover:text-violet">
            Or paste a URL <span className="text-charcoal-50 group-open:hidden">(advanced)</span>
          </summary>
          <div className="mt-2">
            <input
              value={f.pdfUrl}
              onChange={(e) => set("pdfUrl", e.target.value)}
              className={inputCls()}
              placeholder="/documents/certificates/cert.pdf · or full PDF URL"
            />
            <p className="mt-1 text-[11px] text-charcoal-50">
              Same-origin path (e.g. <code>/documents/certificates/…</code>) or any direct <code>.pdf</code> link.
            </p>
          </div>
        </details>
      </div>

      {/* Credential URL, secondary, shown to visitors only when no PDF */}
      <Field label="Credential verification URL" hint="Issuer page (Coursera, Credly, Google). Shown when no PDF is attached.">
        <div className="flex gap-2">
          <input
            value={f.credentialUrl}
            onChange={(e) => set("credentialUrl", e.target.value)}
            className={inputCls()}
            placeholder="https://www.coursera.org/account/accomplishments/verify/…"
          />
          {f.credentialUrl && (
            <a
              href={f.credentialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-azure/20 bg-white px-3 text-xs font-semibold text-azure hover:bg-azure/5"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Test
            </a>
          )}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={f.isVisible} onChange={(e) => set("isVisible", e.target.checked)} />
        <span>Visible on About page</span>
      </label>

      {err && <ErrorRow message={err} />}
      <FormActions onCancel={onCancel} saving={saving} />
    </form>
  )
}

/* ─────────────────── Skills Tab ─────────────────── */

function SkillsTab() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await adminListSkills()
      const arr = Array.isArray(data) ? data : []
      if (import.meta.env.DEV) console.info("[Bio · Skills] loaded", arr.length, "rows", arr)
      setItems(arr)
    } catch (e) {
      console.error("[Bio · Skills] load failed:", e)
      const msg = e?.message || "Failed to load skills."
      setError(msg)
      toast.showError(msg, "Could not load skills")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { reload() }, [reload])

  const onSave = async (form) => {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit
        ? await adminUpdateSkill(form.id, form)
        : await adminCreateSkill(form)
      if (import.meta.env.DEV) console.info("[Bio · Skills] saved", saved)
      toast.showSuccess(isEdit ? "Skill updated" : "Skill added")
      setEditing(null)
      try { await reload() } catch (re) { console.warn("[Bio · Skills] reload after save failed:", re) }
    } catch (e) {
      console.error("[Bio · Skills] save failed:", e)
      toast.showError(e?.message || "Save failed", "Could not save skill")
      throw e
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm("Delete this skill?")) return
    try {
      await adminDeleteSkill(id)
      toast.showSuccess("Skill deleted")
      await reload()
    } catch (e) {
      console.error("[Bio · Skills] delete failed:", e)
      toast.showError(e?.message || "Delete failed", "Could not delete skill")
    }
  }

  return (
    <Section title="Skills" onAdd={() => setEditing({})} onRefresh={reload} loading={loading}>
      <Body loading={loading} error={error} empty={items.length === 0} emptyText="No skills yet.">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-charcoal">{s.name}</div>
                <div className="font-mono text-xs text-charcoal-50 tabular-nums">
                  {s.category} · {s.proficiency}/5{s.yearsUsing ? ` · ${s.yearsUsing}y` : ""}
                  {s.isVisible ? "" : " · hidden"}
                </div>
              </div>
              <RowActions onEdit={() => setEditing(s)} onDelete={() => onDelete(s.id)} />
            </li>
          ))}
        </ul>
      </Body>

      {editing && (
        <Modal title={editing.id ? "Edit skill" : "New skill"} onClose={() => setEditing(null)}>
          <SkillForm initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Section>
  )
}

function SkillForm({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    id: initial.id,
    name: initial.name ?? "",
    category: initial.category ?? "frontend",
    proficiency: initial.proficiency ?? 3,
    yearsUsing: initial.yearsUsing ?? "",
    iconKey: initial.iconKey ?? "",
    isVisible: initial.isVisible !== false,
    displayOrder: initial.displayOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true); setErr("")
    try { await onSubmit({ ...f, proficiency: Number(f.proficiency) }) }
    catch (x) { setErr(x?.message || "Save failed."); setSaving(false) }
  }

  const publicHint = CATEGORY_TO_PUBLIC[f.category] || {}
  const tier = PROFICIENCY_TIERS[Number(f.proficiency)] || PROFICIENCY_TIERS[3]
  const ChosenIcon = f.iconKey ? ICON_REGISTRY[f.iconKey] : null

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Skill name" required>
        <input
          required
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. React, TCP/IP, Curriculum design"
          className={inputCls()}
        />
      </Field>

      <Field label="Category">
        <select
          required
          value={f.category}
          onChange={(e) => set("category", e.target.value)}
          className={inputCls()}
        >
          {SKILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] leading-4 text-charcoal-50">
          Will appear on the public About page under{" "}
          <strong className="font-semibold text-violet">{publicHint.capability || "-"}</strong>
          {publicHint.section ? <> in <em>{publicHint.section}</em></> : null}.
        </p>
      </Field>

      <Field label="Icon, optional, monochrome render">
        <IconPicker value={f.iconKey} onChange={(v) => set("iconKey", v)} />
      </Field>

      <Field label="Proficiency">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = Number(f.proficiency) >= n
              const t = PROFICIENCY_TIERS[n]
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("proficiency", n)}
                  aria-pressed={Number(f.proficiency) === n}
                  className={`group h-8 flex-1 rounded-md transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 ${
                    active ? t.tone : "bg-slate-100 hover:bg-slate-200"
                  }`}
                  title={`${n} · ${t.label}`}
                >
                  <span className={`block text-center font-mono text-[10px] font-semibold tabular-nums ${active ? "text-white/90" : "text-charcoal-50"}`}>
                    {n}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-charcoal-50">1 Familiar → 5 Expert</span>
            <span className="font-semibold text-violet">{tier.label}</span>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Years using">
          <input
            type="number"
            min={0}
            value={f.yearsUsing}
            onChange={(e) => set("yearsUsing", e.target.value)}
            className={`${inputCls()} font-mono`}
          />
        </Field>
        <Field label="Display order">
          <input
            type="number"
            value={f.displayOrder}
            onChange={(e) => set("displayOrder", Number(e.target.value || 0))}
            className={`${inputCls()} font-mono`}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={f.isVisible}
          onChange={(e) => set("isVisible", e.target.checked)}
        />
        <span>Visible on the public About page</span>
      </label>

      {/* Live preview, exactly what visitors will see */}
      <div className="rounded-xl border border-dashed border-violet/30 bg-violet-pale/30 p-3">
        <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-violet/70">
          Live preview
        </div>
        {f.name ? (
          <span className="inline-flex items-center gap-2 rounded-lg bg-violet-pale px-3 py-1.5 text-sm text-violet ring-1 ring-inset ring-violet/20">
            {ChosenIcon && <ChosenIcon className="h-3.5 w-3.5 text-violet/85" aria-hidden="true" />}
            <span className="font-medium">{f.name}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${tier.tone}`} aria-hidden="true" />
          </span>
        ) : (
          <span className="text-xs italic text-charcoal-50">Type a name above to see the chip render.</span>
        )}
      </div>

      {err && <ErrorRow message={err} />}
      <FormActions onCancel={onCancel} saving={saving} />
    </form>
  )
}

/* ── IconPicker — searchable visual dropdown bound to ICON_REGISTRY ──── */
function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef(null)
  const Selected = value ? ICON_REGISTRY[value] : null

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const allKeys = useMemo(() => Object.keys(ICON_REGISTRY).sort(), [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allKeys
    return allKeys.filter((k) => k.includes(q))
  }, [allKeys, query])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls()} flex items-center gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {Selected ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-pale text-violet">
              <Selected className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="font-mono text-[12px] text-violet">{value}</span>
          </>
        ) : (
          <span className="text-charcoal-50">No icon, text-only chip</span>
        )}
        <span className="ml-auto text-charcoal-50">▾</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.10)]"
            role="listbox"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-charcoal-50" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons (react, jwt, postgres…)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-charcoal-50"
              />
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(""); setOpen(false) }}
                  className="rounded px-1.5 text-[10px] font-semibold uppercase text-charcoal-50 hover:text-violet"
                  title="Clear"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-3 text-center text-xs italic text-charcoal-50">
                  No matches for "{query}"
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {filtered.map((key) => {
                    const Ic = ICON_REGISTRY[key]
                    const sel = key === value
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { onChange(key); setOpen(false); setQuery("") }}
                        className={`group flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/40 ${
                          sel ? "bg-violet-pale ring-1 ring-violet/30" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className={`flex h-7 w-7 items-center justify-center rounded ${sel ? "bg-white" : "bg-slate-100 group-hover:bg-white"}`}>
                          <Ic className="h-4 w-4 text-violet" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-[9px] text-charcoal-50 group-hover:text-charcoal">
                          {key}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-3 py-1.5 font-mono text-[10px] text-charcoal-50">
              {filtered.length} of {allKeys.length} icons
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────── Shared bits ─────────────────── */

function Section({ title, onAdd, onRefresh, loading, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
          {action && <span className="text-charcoal-50">·</span>}
          {action}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Reload from server"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-charcoal-80 transition hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

function Body({ loading, error, empty, emptyText, children }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet" /></div>
  if (error) return <ErrorRow message={error} />
  if (empty) return <p className="py-6 text-center text-sm text-charcoal-50">{emptyText}</p>
  return children
}

function ErrorRow({ message }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <span>{message}</span>
    </div>
  )
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="rounded-lg p-1.5 text-azure hover:bg-azure/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="rounded-lg p-1.5 text-rose hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-charcoal">
        <span>
          {label}{required && <span className="ml-0.5 text-rose">*</span>}
        </span>
        {hint && <span className="text-[11px] font-normal text-charcoal-50">, {hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bio-modal-title"
      className="fixed inset-0 z-50 grid place-items-center bg-charcoal/40 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="bio-modal-title" className="text-lg font-semibold text-charcoal">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-charcoal-50 hover:bg-slate-100 hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormActions({ onCancel, saving }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-charcoal hover:bg-slate-50 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Save className="h-4 w-4" strokeWidth={1.75} />}
        Save
      </button>
    </div>
  )
}
