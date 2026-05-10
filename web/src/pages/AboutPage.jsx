import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { personSchema, profilePageSchema } from "../seo/schemas"
import Breadcrumbs from "../components/Breadcrumbs"
import FeaturedReviewsRibbon from "../components/FeaturedReviewsRibbon"
import {
  ArrowRight, Target, Eye, Heart,
  Code, Cloud, Network, GraduationCap,
  Briefcase, Mail, Phone,
  Plus, Send, FileText, MoreHorizontal,
  Compass, Languages, Users, Sparkles, Workflow,
} from "lucide-react"
import {
  FaHtml5, FaCss3Alt, FaJs, FaReact, FaNodeJs,
  FaGitAlt, FaSass, FaFigma, FaLinux, FaPython,
  FaJava, FaDocker, FaGithub,
} from "react-icons/fa"
import { SiMongodb, SiNpm, SiDjango, SiFlask, SiExpress, SiMysql, SiPostgresql, SiPrisma, SiSpringboot, SiTailwindcss, SiSlack, SiOpenai } from "react-icons/si"
import { VscVscode } from "react-icons/vsc"
import {
  aboutMissionVisionValues, expertiseAreas,
  educationTimeline, experienceTimeline, skillsColumns,
} from "../data/sitePagesData"
import { aboutProjects } from "../data/aboutProjectsData"
import { listPortfolio } from "../services/portfolioService"
import { fetchExperience, fetchEducation, fetchCertificates, fetchSkills } from "../services/bioService" // M12 + M12.5 Education
import PortfolioCard from "../components/PortfolioCard"
import AboutHero from "../components/heroes/AboutHero" // V2, universal hero
import CertificatePreview from "../components/CertificatePreview" // V2, inline PDF
import SkillsByCapability from "../components/SkillsByCapability" // F06.v4, capability lens
import SpokenLanguages from "../components/SpokenLanguages" // F06.v4, CEFR strip

/* ──────────────────────────────────────────────────────────────────────────
 *  AboutPage · F06 v2 · Batch 3 (revised)
 *
 *  Revision summary based on owner feedback:
 *    - Hero replaced with the Home-page hero structure (3-column with
 *      circular portrait, ring, trust card, role title, trust bullets).
 *      Only the buttons and social row are tailored for /about:
 *        · Primary CTA: "Download CV" with Innovation Gradient
 *        · Secondary CTA: "Contact"
 *        · Follow row with 5 socials in order:
 *          LinkedIn · GitHub · Telegram · Instagram · WhatsApp
 *    - Journey section moved off the dark charcoal canvas onto a soft
 *      mist gradient with high-contrast violet/charcoal text. Reads as
 *      modern, professional, and accessible (WCAG AA).
 *    - Tech Stack section now uses the EXACT card layout, fonts, and
 *      sizing as the Technical / Professional / Languages cards above —
 *      4 cards (Frontend · Backend · Tools · Database) on a uniform row,
 *      each with vertical skill bars matching the existing SkillBar
 *      component.
 *  ──────────────────────────────────────────────────────────────────────── */

const CertPython = "/documents/certificates/Certificate___Python_for_Data_Science_UKIZURU_Mustapha.pdf"
const CertEnglish = "/documents/certificates/Certificate_English_for_Career_Development_UKIZURU_Mustapha.pdf"
const CertPhilosophy = "/documents/certificates/Certificate_Philosophy_of_SCience_UKIZURU_Mustapha.pdf"
const CertTeaching = "/documents/certificates/Certificate_Teaching_with_technology_UKIZURU_Mustapha.pdf"
const CertGoogleEdu = "/documents/certificates/Google_Certified_Educator_Level_2_UKIZURU_Mustapha.pdf"
const CertGoogleIT = "/documents/certificates/Certificate_Google_IT_Support_Professional_UKIZURU_Mustapha.pdf"
const CertTechSupport = "/documents/certificates/Certificate_Technical_Support_Fundamentals_UKIZURU_Mustapha.pdf"
const CertSysAdmin = "/documents/certificates/Certificate_System_Administration_and_IT_Infrastructure_UKIZURU_Mustapha.pdf"
const CertConstancia = "/documents/certificates/Certificate_Constancia_UKIZURU_Mustapha.pdf"

const certifications = [
  { title: "Python 101 for Data Science", description: "IBM / Cognitive Class", pdf: CertPython },
  { title: "English for Career Development", description: "UPenn / Coursera", pdf: CertEnglish },
  { title: "Philosophy of Science", description: "UPenn / Coursera", pdf: CertPhilosophy },
  { title: "Practical Teaching with Technology", description: "University of London / Coursera", pdf: CertTeaching },
  { title: "Google Certified Educator Level 2", description: "Google for Education", pdf: CertGoogleEdu },
  { title: "Google IT Support Professional", description: "Google / Coursera", pdf: CertGoogleIT },
  { title: "Technical Support Fundamentals", description: "Google / Coursera", pdf: CertTechSupport },
  { title: "System Administration & IT Infrastructure", description: "Google / Coursera", pdf: CertSysAdmin },
  { title: "Maestras y Maestros Construimos Igualdad", description: "Gobierno del Estado de Mexico", pdf: CertConstancia },
]

/* ── Motion variants · used across every section for a coherent feel ── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const tightStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

function SH({ eyebrow, title, subtitle, align = "center" }) {
  const c = align === "center"
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={`mb-12 flex flex-col gap-3 ${c ? "items-center text-center" : "items-start"}`}
    >
      {eyebrow && (
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet"
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        variants={fadeUp}
        className="text-[28px] font-bold tracking-tight text-violet sm:text-section md:text-page lg:text-page"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          variants={fadeUp}
          className={`max-w-2xl text-body leading-7 text-charcoal-80/70 ${c ? "mx-auto" : ""}`}
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  )
}

const MVVIcons = { "Our Mission": Target, "Our Vision": Eye, "Our Values": Heart }
const ExpertiseIcons = { "Software Engineering": Code, "Cloud Systems": Cloud, "Digital Infrastructure": Network, "Education Technology": GraduationCap }

/* ── Tech Stack data — branded logo cards (replaces progress-bar layout).
 *  Each entry is { name, Icon, color } where Icon is a react-icons component
 *  and color is the official brand color of that technology, applied as the
 *  icon foreground. Categories preserved for visual grouping.
 *  ──────────────────────────────────────────────────────────────────── */
const techStackByCategory = [
  {
    labelKey: "frontend",
    items: [
      { name: "React",      Icon: FaReact,       color: "#61DAFB", value: 88 },
      { name: "JavaScript", Icon: FaJs,          color: "#F7DF1E", value: 90 },
      { name: "HTML5",      Icon: FaHtml5,       color: "#E34F26", value: 86 },
      { name: "CSS3",       Icon: FaCss3Alt,     color: "#1572B6", value: 84 },
      { name: "Tailwind",   Icon: SiTailwindcss, color: "#38BDF8", value: 82 },
      { name: "Sass",       Icon: FaSass,        color: "#CC6699", value: 68 },
      { name: "Figma",      Icon: FaFigma,       color: "#F24E1E", value: 72 },
    ],
  },
  {
    labelKey: "backend",
    items: [
      { name: "Node.js",     Icon: FaNodeJs,    color: "#339933", value: 86 },
      { name: "Express",     Icon: SiExpress,   color: "#000000", value: 84 },
      { name: "Python",      Icon: FaPython,    color: "#3776AB", value: 82 },
      { name: "Django",      Icon: SiDjango,    color: "#092E20", value: 78 },
      { name: "Flask",       Icon: SiFlask,     color: "#000000", value: 70 },
      { name: "Java",        Icon: FaJava,      color: "#007396", value: 74 },
      { name: "Spring Boot", Icon: SiSpringboot,color: "#6DB33F", value: 66 },
    ],
  },
  {
    labelKey: "database",
    items: [
      { name: "MySQL",      Icon: SiMysql,      color: "#4479A1", value: 84 },
      { name: "PostgreSQL", Icon: SiPostgresql, color: "#336791", value: 82 },
      { name: "MongoDB",    Icon: SiMongodb,    color: "#47A248", value: 70 },
      { name: "Prisma",     Icon: SiPrisma,     color: "#2D3748", value: 78 },
    ],
  },
  {
    labelKey: "toolsAndPlatforms",
    items: [
      { name: "Git",     Icon: FaGitAlt,  color: "#F05032", value: 90 },
      { name: "GitHub",  Icon: FaGithub,  color: "#181717", value: 88 },
      { name: "VS Code", Icon: VscVscode, color: "#007ACC", value: 90 },
      { name: "npm",     Icon: SiNpm,     color: "#CB3837", value: 82 },
      { name: "Docker",  Icon: FaDocker,  color: "#2496ED", value: 76 },
      { name: "Linux",   Icon: FaLinux,   color: "#FCC624", value: 80 },
      { name: "Slack",   Icon: SiSlack,   color: "#4A154B", value: 84 },
      { name: "AI",      Icon: SiOpenai,  color: "#412991", value: 86 },
    ],
  },
]

/* ── Core competencies data ──────────────────────────────────────────── *
 *  I18N12 — keyId-based references. The actual text lives in
 *  i18n/locales/{en,es}/about.json under `about.core.items.*.{title,desc}`,
 *  so flipping locale automatically retitles each row. Icons remain locale-
 *  agnostic React components.
 *  ──────────────────────────────────────────────────────────────────── */
const CORE_COMPETENCIES = [
  { Icon: Compass,  keyId: "problemSolving" },
  { Icon: Languages, keyId: "communication" },
  { Icon: Users,    keyId: "leadership" },
  { Icon: Sparkles, keyId: "adaptability" },
  { Icon: Workflow, keyId: "strategy" },
]

/* ── CoreCompetenciesSection · profile photo + competency rows ─────────
 *  Replaces the SkillsByCapability lens. Two-column layout on lg+,
 *  stacks vertically below. WCAG AA: photo has descriptive alt text,
 *  decorative halo is aria-hidden, every animated surface respects
 *  prefers-reduced-motion via the page-wide motion variants.
 *  ──────────────────────────────────────────────────────────────────── */
function CoreCompetenciesSection() {
  const { t } = useTranslation("about")
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="py-16 lg:py-24"
    >
      <SH
        eyebrow={t("core.eyebrow")}
        title={t("core.title")}
        subtitle={t("core.subtitle")}
      />

      <div className="mx-auto mt-10 grid max-w-6xl items-start gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Photo column · square aspect for parallel alignment with the
            competencies list on the right. Sticky on lg+ so the photo
            stays in view while users scan the competencies. */}
        <motion.figure variants={fadeUp} className="relative lg:col-span-5 lg:sticky lg:top-28">
          {/* Soft violet halo behind the photo */}
          <div
            aria-hidden="true"
            className="absolute -inset-5 -z-10 rounded-[28px] bg-gradient-to-br from-violet/20 via-violet-pale to-terracotta/15 blur-2xl"
          />
          {/* Decorative offset frame, subtle terracotta accent */}
          <div
            aria-hidden="true"
            className="absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-3xl border border-terracotta/40"
          />
          <div className="relative overflow-hidden rounded-3xl border border-charcoal-80/10 bg-white shadow-[0_20px_60px_-20px_rgba(93,63,211,0.30)]">
            <img
              src="/images/profile/Ukizuru_Mustapha_Photo.jpg"
              alt={t("core.photoAlt")}
              className="aspect-square w-full object-cover object-center"
              loading="lazy"
            />
          </div>
        </motion.figure>

        {/* Competencies column · tighter rhythm so the column height
            stays close to the photo height for parallel visual weight. */}
        <motion.ul
          variants={tightStagger}
          className="flex flex-col gap-3.5 lg:col-span-7"
        >
          {CORE_COMPETENCIES.map(({ Icon, keyId }, i) => (
            <motion.li
              key={keyId}
              variants={fadeUp}
              className="group flex items-start gap-3.5 border-b border-charcoal-80/8 pb-3.5 last:border-0 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 font-mono text-[11px] font-bold tabular-nums text-violet/40 transition-colors group-hover:text-violet/70"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-pale text-violet transition-all duration-300 group-hover:bg-violet group-hover:text-white group-hover:shadow-[0_8px_18px_rgba(93,63,211,0.30)]"
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.85} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold leading-tight text-violet">
                  {t(`core.items.${keyId}.title`)}
                </h3>
                <p className="mt-1 text-[13px] leading-[1.55] text-charcoal-80/75">
                  {t(`core.items.${keyId}.desc`)}
                </p>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </motion.div>
  )
}

/* ── Tech row · icon · name · % · animated progress bar ─────────────────
 *  Used inside the Tech Stack section. Bars animate from 0 → value when
 *  the row enters the viewport, and respect prefers-reduced-motion.
 *  ──────────────────────────────────────────────────────────────────── */
function TechRow({ name, Icon, color, value = 75 }) {
  const reduce = useReducedMotion()
  const safe = Math.max(0, Math.min(100, value))
  return (
    <motion.li
      variants={fadeUp}
      className="group flex flex-col gap-1.5"
      title={`${name} · ${safe}%`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mist transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_rgba(93,63,211,0.10)]"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" style={{ color }} aria-hidden="true" />
        </div>
        <span className="flex-1 truncate text-meta font-semibold text-charcoal">
          {name}
        </span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-charcoal-80/70">
          {safe}%
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-violet-pale/60"
        role="progressbar"
        aria-label={`${name} proficiency`}
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          initial={{ width: reduce ? `${safe}%` : "0%" }}
          whileInView={{ width: `${safe}%` }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: reduce ? 0 : 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="h-full rounded-full bg-gradient-to-r from-violet via-[#6A4FD8] to-terracotta"
        />
      </div>
    </motion.li>
  )
}

/* ── Skill bar (preserved from prior version) ────────────────────────── */
function SkillBar({ name, value }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-meta font-medium">
        <span className="text-violet">{name}</span>
        <span className="font-mono tabular-nums text-charcoal-80/60">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-violet-pale">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className="h-full rounded-full bg-violet"
        />
      </div>
    </div>
  )
}

function TimelineEntry({ item, index, total, accent }) {
  // Royal Violet accent for Education, Soft Terracotta accent for Experience
  const dotClass = accent === "violet" ? "bg-violet text-white" : "bg-terracotta text-violet"
  const ringClass = "ring-4 ring-mist"
  const xFrom = accent === "violet" ? -20 : 20

  // Light-theme period chip — high contrast on white card
  const chipClass = accent === "violet"
    ? "bg-violet/10 text-violet"
    : "bg-terracotta/15 text-terracotta-deep"

  return (
    <motion.div
      initial={{ opacity: 0, x: xFrom }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
      className="relative flex gap-5 pl-12"
    >
      <div className={`absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-micro font-bold tabular-nums shadow-[0_4px_12px_rgba(93,63,211,0.20)] ${dotClass} ${ringClass}`}>
        {String(total - index).padStart(2, "0")}
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(93,63,211,0.08)]">
        <div className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 font-mono text-micro font-semibold tabular-nums tracking-[0.05em] ${chipClass}`}>
          {item.period}
        </div>
        <div className="text-meta font-bold leading-5 text-violet">
          {item.title}
        </div>
        {item.org && (
          <div className="mt-1 text-micro leading-5 text-charcoal-80/70">
            {item.org}
          </div>
        )}
        {(item.summary || item.description) && (
          <p className="mt-2 text-micro leading-5 text-charcoal-80/70">
            {item.summary || item.description}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function Timeline({ items, accent }) {
  // Line gradient — soft, light-theme appropriate
  const lineGradient = accent === "violet"
    ? "from-violet/40 via-violet/20 to-transparent"
    : "from-terracotta/50 via-terracotta/25 to-transparent"

  return (
    <div className="relative">
      <motion.div
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ transformOrigin: "top" }}
        className={`absolute left-[19px] top-0 h-full w-px bg-gradient-to-b ${lineGradient}`}
        aria-hidden="true"
      />
      <div className="space-y-6">
        {items.map((item, i) => (
          <TimelineEntry key={item.title + i} item={item} index={i} total={items.length} accent={accent} />
        ))}
      </div>
    </div>
  )
}

export default function AboutPage() {

  const { t } = useTranslation("about")
  /* ────────────────────────────────────────────────────────────────────
   *  M12 · Bio CMS hydration
   *
   *  Loads Experience · Certificates · Skills from /api/v1/bio/*. If the
   *  fetch fails or returns empty, falls back to the hardcoded arrays in
   *  sitePagesData.js + the local certifications array — keeping the page
   *  fully functional for new installs that haven't run bio-seed.js yet.
   *  ────────────────────────────────────────────────────────────────── */
  const [bioExperience, setBioExperience] = useState([])
  const [bioEducation, setBioEducation] = useState([])
  const [bioCertificates, setBioCertificates] = useState([])
  const [bioSkills, setBioSkills] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchExperience().catch(() => []),
      fetchEducation().catch(() => []),
      fetchCertificates().catch(() => ({ items: [], grouped: {} })),
      fetchSkills().catch(() => ({ items: [], grouped: {} })),
    ]).then(([exp, edu, certs, skills]) => {
      if (cancelled) return
      setBioExperience(Array.isArray(exp) ? exp : [])
      setBioEducation(Array.isArray(edu) ? edu : [])
      setBioCertificates(certs?.items || [])
      setBioSkills(skills?.grouped || {})
    })
    return () => { cancelled = true }
  }, [])

  /* ── Transform API → component shape, with hardcoded fallback ─────── */

  function fmtMonthYear(iso) {
    if (!iso) return null
    try {
      return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" })
    } catch {
      return null
    }
  }

  const apiExperienceMapped = bioExperience.map((e) => {
    const start = fmtMonthYear(e.startDate)
    const end = e.endDate ? fmtMonthYear(e.endDate) : t("journey.present")
    const period = start ? `${start} – ${end}` : t("journey.datePending")
    // Rich org line — "Company · Location" — matches the visual hierarchy
    // of the static fallback array. Location is a separate column on the
    // Experience model, so we compose it here.
    const org = e.location ? `${e.company || ""} · ${e.location}` : (e.company || null)
    const bullets = Array.isArray(e.bullets) || Array.isArray(e.highlights)
      ? (e.bullets || e.highlights)
      : null
    return { period, title: e.role, org, summary: e.description, bullets }
  })

  // Education: same shape as experience (period · title · description)
  const apiEducationMapped = bioEducation.map((e) => {
    const start = fmtMonthYear(e.startDate)
    const end = e.endDate ? fmtMonthYear(e.endDate) : t("journey.present")
    const period = start ? `${start} – ${end}` : t("journey.datePending")
    return {
      period,
      title: `${e.degree}${e.institution ? " · " + e.institution : ""}`,
      description: e.description,
    }
  })

  // DB-source-of-truth: API takes precedence. Hardcoded arrays kept as
  // a *seed reference* and as a fallback while the user runs the seed
  // script (npm run seed:bio) — once at least one row exists in the DB
  // the public page reflects the live data.
  // ── Experience precedence ──────────────────────────────────────────
  // Once the DB has been seeded (admin /admin/bio "Seed originals (6)"),
  // the API is the single source of truth — exactly the 6 canonical
  // roles, fully editable from the admin. The static `experienceTimeline`
  // remains the seed reference + empty-state fallback. No merging here:
  // dedup by (title, org) failed because static `org` includes location
  // while the DB `company` column does not, surfacing duplicates.
  const displayedExperience = apiExperienceMapped.length > 0
    ? apiExperienceMapped
    : experienceTimeline

  const displayedEducation = apiEducationMapped.length > 0
    ? apiEducationMapped
    : educationTimeline

  const skillCatMap = {
    frontend: "technical", backend: "technical", database: "technical", cloud: "technical", tools: "technical",
    soft_skill: "professional",
    language: "language",
  }

  // Build { technical, professional, language } from the API skill rows.
  const apiSkillsColumns = (() => {
    const out = { technical: [], professional: [], language: [] }
    Object.entries(bioSkills).forEach(([cat, list]) => {
      const bucket = skillCatMap[cat]
      if (!bucket || !Array.isArray(list)) return
      list.forEach((s) => {
        out[bucket].push({ name: s.name, value: Math.max(20, Math.min(100, (s.proficiency || 3) * 20)) })
      })
    })
    return out
  })()

  const hasApiSkills = (apiSkillsColumns.technical.length + apiSkillsColumns.professional.length + apiSkillsColumns.language.length) > 0

  const displayedSkills = hasApiSkills
    ? {
        technical: apiSkillsColumns.technical.length > 0 ? apiSkillsColumns.technical : skillsColumns.technical,
        professional: apiSkillsColumns.professional.length > 0 ? apiSkillsColumns.professional : skillsColumns.professional,
        language: apiSkillsColumns.language.length > 0 ? apiSkillsColumns.language : skillsColumns.language,
      }
    : skillsColumns

  // ── DB → tile shape ────────────────────────────────────────────────
  // Key change: we keep `pdfUrl` and `credentialUrl` separate so the
  // CertificatePreview component can branch into PDF mode (when we have
  // a hosted PDF) or Credential mode (when we only have an issuer
  // verify URL). Previously we collapsed both into one `pdf` field —
  // that fed external URLs into pdfjs, which couldn't render them and
  // showed broken violet placeholders. The component now degrades
  // gracefully on its own.
  const apiCertsMapped = bioCertificates.map((c) => ({
    title: c.title,
    issuer: c.issuer || "",
    issueDate: c.issueDate || null,
    pdfUrl: c.pdfUrl || null,
    credentialUrl: c.credentialUrl || null,
    issuerLogo: c.issuerLogo || null,
  }))

  // Hardcoded fallback — only used when the DB has zero rows (fresh install
  // before bio-seed runs). Mapped into the new shape too.
  const fallbackCertsMapped = certifications.map((c) => ({
    title: c.title,
    issuer: c.description,
    issueDate: null,
    pdfUrl: c.pdf,
    credentialUrl: null,
    issuerLogo: null,
  }))

  const displayedCerts = apiCertsMapped.length > 0 ? apiCertsMapped : fallbackCertsMapped

  // Portfolio API state
  const [apiProjects, setApiProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { items } = await listPortfolio({ limit: 6 })
        if (!cancelled) setApiProjects(items || [])
      } catch (err) {
        if (!cancelled) setProjectsError(err?.message || "Could not load portfolio")
      } finally {
        if (!cancelled) setProjectsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const displayProjects = apiProjects.length > 0 ? apiProjects : aboutProjects.slice(0, 6)

  // Top row of skill cards (preserved from existing data)
  const skillTabs = {
    technical:    { label: t("skills.tabs.technical"),    data: displayedSkills.technical },
    professional: { label: t("skills.tabs.professional"), data: displayedSkills.professional },
    language:     { label: t("skills.tabs.language"),     data: displayedSkills.language },
  }

  /* Social rendering lives in <AboutHero /> via the shared SocialLinks
   * component; no page-local SOCIALS array is needed here. */

  return (
    <>
      <Seo
        {...pageSeo.about}
        includeLocalBusiness
        jsonLd={[personSchema(), profilePageSchema("/about")]}
      />

      {/* ══════════════════════════════════════════════════════════════════
           HERO · Home-page structure cloned with About-specific buttons
           and a 5-social Follow row. Three columns at lg+:
             [text · circular portrait · trust column]
          ══════════════════════════════════════════════════════════════════ */}
      {/* ══ HERO · V2 universal · replaces 180-line bespoke block ══ */}
      <AboutHero />


      {/* ══════════════════════════════════════════════════════════════════
           MISSION · VISION · VALUES
          ══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 lg:py-28">
        <Container>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 flex flex-col items-center gap-3 text-center sm:mb-14"
          >
            <motion.span variants={fadeUp} className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">{t("mvv.eyebrow")}</motion.span>
            <motion.h2 variants={fadeUp} className="text-[28px] font-bold tracking-tight text-violet sm:text-section md:text-page">{t("mvv.title")}</motion.h2>
            <motion.p variants={fadeUp} className="max-w-xl text-body leading-7 text-charcoal-80/70">{t("mvv.subtitle")}</motion.p>
          </motion.div>
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-6 lg:grid-cols-3">
            {aboutMissionVisionValues.map(({ title, description }) => {
              const Icon = MVVIcons[title]
              return (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  className="group rounded-xl border border-charcoal-80/10 bg-white p-7 shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(93,63,211,0.10)]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet transition group-hover:bg-violet group-hover:text-white">
                    {Icon && <Icon className="h-6 w-6" aria-hidden="true" />}
                  </div>
                  <h3 className="mb-2 text-card font-bold text-violet">{title}</h3>
                  <p className="text-meta leading-6 text-charcoal-80/65">{description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           EXPERTISE
          ══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow={t("expertise.eyebrow")} title={t("expertise.title")} subtitle={t("expertise.subtitle")} />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {expertiseAreas.map(({ title, description }) => {
              const Icon = ExpertiseIcons[title]
              return (
                <motion.div key={title} variants={fadeUp} className="rounded-xl border border-charcoal-80/10 bg-white p-6 transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(93,63,211,0.08)]">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-pale text-violet">
                    {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                  </div>
                  <h3 className="mb-1 text-body font-bold text-violet">{title}</h3>
                  <p className="text-meta leading-6 text-charcoal-80/65">{description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           PROFESSIONAL JOURNEY · LIGHT theme · modern · accessible
           Background: soft mist gradient. All text WCAG AA on white cards.
          ══════════════════════════════════════════════════════════════════ */}
      <section
        id="journey"
        className="scroll-mt-24 relative overflow-hidden py-20 lg:py-28"
        style={{ background: "linear-gradient(180deg, var(--color-mist) 0%, #f8f3fa 60%, var(--color-mist) 100%)" }}
      >
        {/* Decorative subtle blob */}
        <div className="pointer-events-none absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-violet/5 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-[300px] w-[300px] rounded-full bg-terracotta/10 blur-3xl" aria-hidden="true" />

        <Container className="relative">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 flex flex-col items-center gap-3 text-center sm:mb-14"
          >
            <motion.span variants={fadeUp} className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              {t("journey.eyebrow")}
            </motion.span>
            <motion.h2 variants={fadeUp} className="text-[28px] font-bold tracking-tight text-violet sm:text-section md:text-page">{t("journey.title")}</motion.h2>
            <motion.p variants={fadeUp} className="max-w-xl text-body leading-7 text-charcoal-80/65">
              {t("journey.subtitle")}
            </motion.p>
          </motion.div>

          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-12 xl:gap-16">
            {/* Education column · sticky on lg+ so the longer Experience
                column on the right scrolls past while Education stays put. */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="lg:sticky lg:top-28 lg:self-start"
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet text-white shadow-[0_8px_20px_rgba(93,63,211,0.30)]">
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-card font-bold text-violet">{t("journey.education")}</div>
                  <div className="text-micro text-charcoal-80/55">{t("journey.educationSubtitle")}</div>
                </div>
              </div>
              <Timeline items={displayedEducation} accent="violet" />
            </motion.div>

            {/* Experience column */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: 0.1 }}
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-terracotta text-violet shadow-[0_8px_20px_rgba(233, 196, 106,0.40)]">
                  <Briefcase className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-card font-bold text-violet">{t("journey.experience")}</div>
                  <div className="text-micro text-charcoal-80/55">{t("journey.experienceSubtitle")}</div>
                </div>
              </div>
              <Timeline items={displayedExperience} accent="terracotta" />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           CERTIFICATIONS · kept on dark canvas (high contrast on white cards)
          ══════════════════════════════════════════════════════════════════ */}
      {/* Dark Credentials section — inline bg guarantees dark surface even
          if `bg-charcoal` utility doesn't generate (Tailwind v4 JIT quirk). */}
      <section id="certifications" className="scroll-mt-24 py-20 lg:py-28" style={{ backgroundColor: "#1A1B23" }}>
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr] xl:gap-14">
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="flex flex-col items-center gap-5 text-center lg:sticky lg:top-28 lg:items-start lg:text-left">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ backgroundColor: "rgba(233, 196, 106, 0.16)", color: "#E9C46A", border: "1px solid rgba(233, 196, 106, 0.32)" }}
              >
                {t("credentials.eyebrow")}
              </span>
              <div>
                <p className="text-body italic" style={{ color: "rgba(233, 196, 106, 0.85)" }}>{t("credentials.italic")}</p>
                <h2 className="mt-1 text-[28px] font-bold tracking-tight sm:text-[40px]" style={{ color: "#FFFFFF" }}>{t("credentials.title")}</h2>
              </div>
              <p className="max-w-xs text-meta leading-6" style={{ color: "rgba(255, 255, 255, 0.72)" }}>
                {t("credentials.subtitle")}
              </p>
              <Link
                to="/contact"
                className="group mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-meta font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
                style={{ color: "#FFFFFF", backgroundColor: "transparent", border: "2px solid #E9C46A" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(233, 196, 106, 0.12)" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              >
                {t("credentials.knowMore")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: "#8B6FE8" }} aria-hidden="true" />
              </Link>
            </motion.div>



<motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {displayedCerts.map((c) => (
                <motion.div key={c.title} variants={fadeUp}>
                  <CertificatePreview
                    src={c.pdfUrl}
                    credentialUrl={c.credentialUrl}
                    issuerLogo={c.issuerLogo}
                    title={c.title}
                    issuer={c.issuer}
                    date={c.issueDate}
                    verified
                  />
                </motion.div>
              ))}
            </motion.div>


          </div>
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           SKILLS · F06.v4 · Three sections, one cohesive narrative:
             1. SkillsByCapability  — what I deliver (capability lens)
             2. Tech Stack          — what I use     (brand logo wall)
             3. SpokenLanguages     — how I work     (CEFR scale)
           All three are admin-controlled via /admin/bio (Skills tab).
          ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-mist">
        <Container>
          {/* 1 · Core Competencies · profile photo + competency rows.
                 Replaces the prior SkillsByCapability section. The surrounding
                 wrapper stays so Tech Stack and SpokenLanguages render below. */}
          <CoreCompetenciesSection />

          {/* 2 · Tech Stack · branded logo wall — kept as-is, full colour
                 by design. Two visual roles, deliberately different. */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <motion.span variants={fadeUp} className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              {t("tech.eyebrow")}
            </motion.span>
            <motion.h3 variants={fadeUp} className="text-[24px] font-bold tracking-tight text-violet sm:text-section md:text-page">
              {t("tech.title")}
            </motion.h3>
            <motion.p variants={fadeUp} className="max-w-xl text-meta leading-7 text-charcoal-80/75">
              {t("tech.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {techStackByCategory.map(({ labelKey, items }) => (
              <motion.div
                key={labelKey}
                variants={fadeUp}
                className="px-1"
              >
                <h4 className="mb-5 font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-violet">
                  {t(`tech.categories.${labelKey}`)}
                </h4>
                <motion.ul
                  variants={tightStagger}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="flex flex-col gap-4"
                >
                  {items.map(({ name, Icon, color, value }) => (
                    <TechRow key={name} name={name} Icon={Icon} color={color} value={value} />
                  ))}
                </motion.ul>
              </motion.div>
            ))}
          </motion.div>

          {/* 3 · Spoken languages · CEFR scale, premium card, real flag SVGs */}
          <SpokenLanguages
            languages={
              displayedSkills?.language?.length
                ? displayedSkills.language.map((s) => ({
                    name: s.name,
                    code: (s.iconKey || s.code || s.name?.slice(0, 2) || "").toUpperCase(),
                    proficiency: Math.round((s.value || 60) / 20), // SkillBar value → 1–5
                    native: /native|kinyarwanda/i.test(s.name),
                  }))
                : null
            }
          />
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           PROJECTS · DB-backed via portfolioService
          ══════════════════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH
            eyebrow={t("portfolio.eyebrow")}
            title={t("portfolio.title")}
            subtitle={t("portfolio.subtitle")}
          />

          {projectsLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-[400px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
              ))}
            </div>
          ) : displayProjects.length === 0 ? (
            <div className="rounded-xl border border-charcoal-80/10 bg-white p-10 text-center text-meta text-charcoal-80/50">
              {projectsError
                ? t("portfolio.errorState")
                : t("portfolio.emptyState")}
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayProjects.map((p, idx) => (
                <PortfolioCard
                  key={p.id || p.slug || p.title}
                  project={p}
                  cardIndex={idx}
                  linkLabel={p.tags ? t("portfolio.linkLearnMore") : t("portfolio.linkCaseStudy")}
                />
              ))}
            </motion.div>
          )}
        </Container>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
           CTA · compact 3-column band — phone breaks the bottom frame
          ══════════════════════════════════════════════════════════════════ */}
      <section className="pb-20 lg:pb-28">
        <Container>
          <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_120%_at_0%_0%,#5D3FD3_0%,#4A2EAB_55%,#3B2487_100%)] px-6 sm:px-10 lg:px-12 py-10 lg:py-12">

            {/* Ambient blobs (clipped by overflow-hidden) */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/[0.06] blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-terracotta/12 blur-3xl" aria-hidden="true" />

            <div className="relative grid items-center gap-10 lg:grid-cols-12 lg:gap-8">

              {/* ─────────────── LEFT · Headline + CTA ─────────────── */}
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                className="lg:col-span-5"
              >
                <h2 className="text-[34px] sm:text-[40px] lg:text-[44px] font-bold leading-[1.05] tracking-tight text-white">
                  {t("ctaBand.headingPart1")}<br className="hidden sm:block" />
                  {" "}{t("ctaBand.headingPart2")} <span className="text-terracotta">{t("ctaBand.headingPart3")}</span>
                </h2>
                <p className="mt-4 max-w-sm text-body leading-6 text-white/70">
                  {t("ctaBand.body")}
                </p>
                <div className="mt-7">
                  <Link
                    to="/contact"
                    className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-meta font-semibold text-violet shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
                  >
                    {t("ctaBand.contactMe")}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </motion.div>
              {/* ─────────────── CENTER · Phone (absolutely positioned on lg+
                                  so the card height is driven only by text;
                                  phone overflows below and is clipped by the
                                  card's `overflow-hidden`) ─────────── */}
              <div className="relative flex justify-center lg:col-span-2 lg:self-stretch">
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-80px" }}
                  className="flex w-full justify-center lg:absolute lg:left-1/2 lg:top-3 lg:-translate-x-1/2"
                >
                  <CtaPhoneMockup />
                </motion.div>
              </div>

              {/* ─────────────── RIGHT · Office + Contact info ─────────────── */}
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                className="space-y-6 lg:col-span-5 lg:pl-2"
              >
                <motion.div variants={fadeUp}>
                  <h3 className="text-[15px] font-bold tracking-tight text-white">
                    {t("ctaBand.officeAddress")}
                  </h3>
                  <p className="mt-2 max-w-xs text-body leading-6 text-white/70">
                    {t("ctaBand.officeAddressBody1")}<br />
                    {t("ctaBand.officeAddressBody2")}
                  </p>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <h3 className="text-[15px] font-bold tracking-tight text-white">
                    {t("ctaBand.contactInfo")}
                  </h3>
                  <ul className="mt-2.5 space-y-2">
                    <li>
                      <a
                        href="mailto:hello@mustaphaukizuru.com"
                        className="group inline-flex items-center gap-2.5 rounded-md text-meta text-white/85 transition hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/30"
                      >
                        <Mail className="h-4 w-4 flex-none text-white/70 transition group-hover:text-terracotta" aria-hidden="true" />
                        hello@mustaphaukizuru.com
                      </a>
                    </li>
                    <li>
                      <a
                        href="tel:+525552139993"
                        className="group inline-flex items-center gap-2.5 rounded-md text-meta text-white/85 transition hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/30"
                      >
                        <Phone className="h-4 w-4 flex-none text-white/70 transition group-hover:text-terracotta" aria-hidden="true" />
                        +52 555 213 9993
                      </a>
                    </li>
                  </ul>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}

function CtaPhoneMockup() {
  const { t } = useTranslation("about")
  const reduce = useReducedMotion()
  const initials = ["MR", "AC", "DV", "LP", "EK"]
  const tints    = [
    "from-terracotta to-[#E07A4A]",
    "from-violet to-[#7B5FE0]",
    "from-azure to-[#3E80E0]",
    "from-[#3FB47E] to-[#2D8C5F]",
    "from-[#E94F8B] to-[#B8336A]",
  ]

  return (
    <motion.div
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="relative mx-auto w-[210px] sm:w-[220px] lg:w-[230px]"
    >
      {/* ── Side buttons (left side) ── */}
      <span className="absolute -left-[2px] top-[14%] h-[16px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#1a1d24] to-[#2a2e36]" aria-hidden="true" />
      <span className="absolute -left-[2px] top-[24%] h-[36px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#1a1d24] to-[#2a2e36]" aria-hidden="true" />
      <span className="absolute -left-[2px] top-[34%] h-[36px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#1a1d24] to-[#2a2e36]" aria-hidden="true" />
      {/* ── Side button (right side · power) ── */}
      <span className="absolute -right-[2px] top-[26%] h-[52px] w-[3px] rounded-r-[2px] bg-gradient-to-l from-[#1a1d24] to-[#2a2e36]" aria-hidden="true" />

      {/* ── Outer titanium frame ── */}
      <div
        className="relative aspect-[9/19.5] rounded-[40px] p-[3px]"
        style={{
          background:
            "linear-gradient(160deg,#4a4d54 0%,#2c2f36 35%,#1c1f25 65%,#3a3d44 100%)",
          boxShadow:
            "0 30px 60px -15px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",
        }}
      >
        {/* ── Inner black bezel (mimics the black ring inside the titanium edge) ── */}
        <div className="relative h-full w-full overflow-hidden rounded-[37px] bg-[#0a0b0e] p-[2px]">

          {/* ── Screen ── */}
          <div className="relative h-full w-full overflow-hidden rounded-[35px] bg-gradient-to-b from-mist via-[#F2EBF6] to-[#EDE7F6]">

            {/* ── Dynamic Island ── */}
            <div className="absolute left-1/2 top-[8px] z-30 flex h-[22px] w-[80px] -translate-x-1/2 items-center justify-end rounded-full bg-black px-2 ring-1 ring-black/60">
              {/* Camera lens */}
              <span
                className="relative flex h-[10px] w-[10px] items-center justify-center rounded-full bg-[#0e1218] ring-1 ring-[#2a3144]/60"
                aria-hidden="true"
              >
                <span className="h-[4px] w-[4px] rounded-full bg-[#1a2330]" />
                <span className="absolute right-[1px] top-[1px] h-[2px] w-[2px] rounded-full bg-[#3a4659]/80" />
              </span>
            </div>

            {/* ── Status bar ── */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-2.5 pb-1.5">
              <span className="font-mono text-[10px] font-semibold tabular-nums text-charcoal">9:41</span>
              <div className="flex items-center gap-[3px]">
                {/* Signal bars */}
                <span className="flex items-end gap-[1.5px]">
                  <span className="h-[3px] w-[2px] rounded-[1px] bg-charcoal" />
                  <span className="h-[5px] w-[2px] rounded-[1px] bg-charcoal" />
                  <span className="h-[7px] w-[2px] rounded-[1px] bg-charcoal" />
                  <span className="h-[9px] w-[2px] rounded-[1px] bg-charcoal" />
                </span>
                {/* Wifi */}
                <svg viewBox="0 0 16 12" className="ml-[3px] h-[10px] w-[12px] text-charcoal" aria-hidden="true">
                  <path d="M8 11.5a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
                  <path d="M3.5 7.5a6 6 0 019 0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <path d="M1 4.8A10 10 0 0115 4.8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                </svg>
                {/* Battery */}
                <span className="ml-[3px] inline-flex items-center">
                  <span className="relative inline-block h-[9px] w-[18px] rounded-[3px] border border-charcoal/80">
                    <span className="absolute inset-[1px] w-[11px] rounded-[2px] bg-charcoal" />
                  </span>
                  <span className="ml-[1px] inline-block h-[4px] w-[1.5px] rounded-r-[1px] bg-charcoal/80" />
                </span>
              </div>
            </div>

            {/* ── App content ── */}
            <div className="relative z-10 px-4 pt-2">

              {/* Welcome card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet via-[#6A4FD8] to-[#7B5FE0] p-3.5 text-white shadow-[0_8px_22px_rgba(93, 63, 211,0.28)]">
                {/* Subtle inner sheen */}
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/15 blur-xl"
                  aria-hidden="true"
                />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      {t("dashboardWidget.welcomeBack")}
                    </p>
                    <p className="mt-0.5 text-[13px] font-bold leading-tight">Mustapha U.</p>
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm">
                    <span className="text-[9px] font-bold tracking-wider">MU</span>
                  </div>
                </div>

                <div className="relative mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[8.5px] font-medium uppercase tracking-[0.14em] text-white/65">
                      {t("dashboardWidget.activeProjects")}
                    </p>
                    <p className="font-mono text-[22px] font-bold leading-none tabular-nums">12</p>
                  </div>
                  <motion.span
                    animate={reduce ? undefined : { opacity: [1, 0.55, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    Live
                  </motion.span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[
                  { Icon: Plus,           label: "New"     },
                  { Icon: Send,           label: "Send"    },
                  { Icon: FileText,       label: "Inquire" },
                  { Icon: MoreHorizontal, label: "More"    },
                ].map(({ Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-[0_2px_6px_rgba(93, 63, 211,0.10)] ring-1 ring-charcoal/5">
                      <Icon className="h-3.5 w-3.5 text-violet" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span className="text-[8px] font-semibold text-charcoal/75">{label}</span>
                  </div>
                ))}
              </div>

              {/* Recent clients */}
              <div className="mt-3.5 rounded-2xl bg-white p-3 shadow-[0_2px_6px_rgba(93, 63, 211,0.06)] ring-1 ring-charcoal/5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-charcoal">{t("dashboardWidget.recentClients")}</p>
                  <span className="text-[9px] font-semibold text-violet">{t("dashboardWidget.viewAll")}</span>
                </div>
                <div className="mt-2.5 flex items-center -space-x-2">
                  {initials.map((ini, i) => (
                    <div
                      key={ini}
                      className={
                        "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[8px] font-bold text-white ring-2 ring-white " +
                        tints[i % tints.length]
                      }
                    >
                      {ini}
                    </div>
                  ))}
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-pale text-[9px] font-bold text-violet ring-2 ring-white">
                    +9
                  </div>
                </div>
              </div>

            </div>

            {/* ── Specular glare overlay (subtle white diagonal) ── */}
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.07) 100%)",
              }}
              aria-hidden="true"
            />

            {/* ── Home indicator ── */}
            <div className="absolute bottom-1.5 left-1/2 z-20 h-[3px] w-[80px] -translate-x-1/2 rounded-full bg-charcoal/45" aria-hidden="true" />
          </div>
        </div>

        {/* ── Outer titanium edge highlight (top + bottom thin gloss) ── */}
        <span
          className="pointer-events-none absolute inset-x-6 top-[1px] h-[1px] rounded-full bg-white/15"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute inset-x-6 bottom-[1px] h-[1px] rounded-full bg-white/[0.06]"
          aria-hidden="true"
        />
      </div>
    </motion.div>
  )
}
