import { useState } from "react"
import { Briefcase, Award, Sparkles, GraduationCap } from "lucide-react"
import { m } from "framer-motion"

import {
  ExperienceSection, EducationSection, CertificatesSection, SkillsSection,
} from "../components/admin/bio"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminBioPage · M12 · Bio CMS
 *
 *  Manages the sections rendered on the public About page:
 *    - Experience (work history)
 *    - Education
 *    - Certificates (issued credentials, PDF upload)
 *    - Skills (technology proficiency · grouped by category)
 *
 *  Each tab is a self-contained CRUD island in components/admin/bio/*,
 *  driven by useForm + lib/validation/bio schemas. This page only owns
 *  the header and tab switcher.
 *  ──────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: "experience", label: "Experience", icon: Briefcase, Panel: ExperienceSection },
  { key: "education", label: "Education", icon: GraduationCap, Panel: EducationSection },
  { key: "certificates", label: "Certificates", icon: Award, Panel: CertificatesSection },
  { key: "skills", label: "Skills", icon: Sparkles, Panel: SkillsSection },
]

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
}

export default function AdminBioPage() {
  const [tab, setTab] = useState("experience")
  const active = TABS.find((t) => t.key === tab) || TABS[0]
  const Panel = active.Panel

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-charcoal tracking-tight">Bio CMS</h1>
        <p className="mt-1 text-sm text-charcoal-80">
          Edit Experience, Education, Certificates, and Skills shown on the public About page.
        </p>
      </header>

      <nav role="tablist" aria-label="Bio sections" className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                isActive ? "border-violet text-violet" : "border-transparent text-charcoal-80 hover:text-charcoal"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              {t.label}
            </button>
          )
        })}
      </nav>

      <m.div key={tab} {...fadeUp} className="mt-6">
        <Panel />
      </m.div>
    </div>
  )
}
