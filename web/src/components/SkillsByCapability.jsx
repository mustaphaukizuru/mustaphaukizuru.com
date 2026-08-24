/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
import { useEffect, useMemo, useRef, useState } from "react"
import { m, AnimatePresence, useReducedMotion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion"
import {
  Code2, Database, Rocket, Network, ShieldCheck, GraduationCap,
  Sparkles, ArrowUpRight, Layers,
} from "lucide-react"
import {
  FaReact, FaNodeJs, FaPython, FaJava, FaDocker, FaGitAlt, FaGithub,
  FaLinux, FaAws, FaGoogle, FaJsSquare, FaHtml5, FaCss3Alt,
} from "react-icons/fa"
import {
  SiDjango, SiFlask, SiExpress, SiTailwindcss, SiPostgresql, SiMysql,
  SiPrisma, SiSpringboot, SiFramer, SiVite, SiJsonwebtokens,
  SiBootstrap, SiSpringsecurity, SiOpenssl, SiCloudflare, SiNginx,
  SiKubernetes, SiRedis, SiMongodb, SiTypescript, SiGooglecloud,
} from "react-icons/si"

import { useTranslation } from "react-i18next"
/* ──────────────────────────────────────────────────────────────────────────
 *  SkillsByCapability · F06.v4 · Premium capability-lens skills section
 *
 *  Renders Skill rows from /api/v1/bio/skills (already fetched in
 *  AboutPage as `bioSkills`) into six capability clusters: Build · Data ·
 *  Ship · Operate · Secure · Teach. Spoken languages are rendered by the
 *  SpokenLanguages component, not here.
 *
 *  Mapping
 *  ───────
 *  The DB SkillCategory enum is (frontend, backend, tools, database,
 *  cloud, language, soft_skill). We derive the public *capability* from
 *  the combination of category + iconKey + name — no schema change
 *  needed, and admin edits propagate immediately.
 *
 *  Icon strategy
 *  ─────────────
 *  Skill chips render brand logos in MONOCHROME violet for visual
 *  cohesion. The colourful brand-logo wall stays in the existing
 *  Tech Stack section below — two sections, two visual roles.
 *
 *  Accessibility (WCAG 2.1 AA)
 *  ──────────────────────────
 *  · Filter pills are buttons with aria-pressed.
 *  · Decorative icons aria-hidden; semantic dots carry aria-label/title.
 *  · prefers-reduced-motion respected via useReducedMotion().
 *  · Counter animation falls back to instant render under reduced-motion.
 *  ──────────────────────────────────────────────────────────────────── */

/* ── Icon registry ─────────────────────────────────────────────────────
 *  Admin SkillForm dropdown reads from this. Add new entries here when
 *  the catalogue needs a new logo.                                       */
export const ICON_REGISTRY = {
  // Frontend
  react: FaReact, javascript: FaJsSquare, typescript: SiTypescript,
  html5: FaHtml5, css3: FaCss3Alt, tailwind: SiTailwindcss,
  bootstrap: SiBootstrap, framer: SiFramer, vite: SiVite,
  // Backend
  nodejs: FaNodeJs, express: SiExpress, python: FaPython,
  django: SiDjango, flask: SiFlask, java: FaJava, springboot: SiSpringboot,
  // Data
  postgresql: SiPostgresql, mysql: SiMysql, prisma: SiPrisma,
  mongodb: SiMongodb, redis: SiRedis,
  // Ship / DevOps
  docker: FaDocker, kubernetes: SiKubernetes, git: FaGitAlt,
  github: FaGithub, linux: FaLinux, aws: FaAws, gcp: SiGooglecloud,
  google: FaGoogle, nginx: SiNginx, cloudflare: SiCloudflare,
  // Secure
  jwt: SiJsonwebtokens, springsecurity: SiSpringsecurity, openssl: SiOpenssl,
}

/* ── Capability metadata ─────────────────────────────────────────────── */
const CAPABILITIES = [
  {
    id: "build",
    label: "Build",
    headline: "Production-grade web applications",
    sub: "End-to-end full-stack delivery, from architecture to ship.",
    Icon: Code2,
  },
  {
    id: "data",
    label: "Data",
    headline: "Schemas that scale, queries that fly",
    sub: "Relational design, indexing, and query tuning for real workloads.",
    Icon: Database,
  },
  {
    id: "ship",
    label: "Ship",
    headline: "Cloud, containers, automated delivery",
    sub: "GCP and AWS in production, Dockerised, version-controlled.",
    Icon: Rocket,
  },
  {
    id: "operate",
    label: "Operate",
    headline: "Networks engineered for uptime",
    sub: "TCP/IP, DNS, VPN, LAN/WAN, 99% uptime across multi-site campuses.",
    Icon: Network,
  },
  {
    id: "secure",
    label: "Secure",
    headline: "Defence in depth, by design",
    sub: "OWASP-grade auth, hardening, and least-privilege at every layer.",
    Icon: ShieldCheck,
  },
  {
    id: "teach",
    label: "Teach & Lead",
    headline: "STEM curriculum and mentorship",
    sub: "Curriculum design, multilingual delivery, student outcomes.",
    Icon: GraduationCap,
  },
]

const CAP_INDEX = Object.fromEntries(CAPABILITIES.map((c, i) => [c.id, i]))

/* ── Default catalogue (renders when API returns nothing) ──────────────
 *  Real, accurate skill list drawn from Mustapha's CVs and the
 *  mustaphaukizuru.com production stack.                                 */
const DEFAULT_SKILLS = [
  // Build
  { name: "React", iconKey: "react", capability: "build", proficiency: 5 },
  { name: "Node.js", iconKey: "nodejs", capability: "build", proficiency: 5 },
  { name: "Express", iconKey: "express", capability: "build", proficiency: 5 },
  { name: "Python", iconKey: "python", capability: "build", proficiency: 5 },
  { name: "Django", iconKey: "django", capability: "build", proficiency: 4 },
  { name: "Flask", iconKey: "flask", capability: "build", proficiency: 4 },
  { name: "Java", iconKey: "java", capability: "build", proficiency: 4 },
  { name: "Spring Boot", iconKey: "springboot", capability: "build", proficiency: 3 },
  { name: "Tailwind CSS", iconKey: "tailwind", capability: "build", proficiency: 5 },
  { name: "Framer Motion", iconKey: "framer", capability: "build", proficiency: 4 },
  { name: "Vite", iconKey: "vite", capability: "build", proficiency: 4 },
  { name: "JavaScript", iconKey: "javascript", capability: "build", proficiency: 5 },
  // Data
  { name: "PostgreSQL", iconKey: "postgresql", capability: "data", proficiency: 5 },
  { name: "MySQL", iconKey: "mysql", capability: "data", proficiency: 5 },
  { name: "Prisma ORM", iconKey: "prisma", capability: "data", proficiency: 4 },
  { name: "REST API design", capability: "data", proficiency: 5 },
  { name: "Indexing & query tuning", capability: "data", proficiency: 4 },
  // Ship
  { name: "Google Cloud", iconKey: "gcp", capability: "ship", proficiency: 4 },
  { name: "AWS", iconKey: "aws", capability: "ship", proficiency: 4 },
  { name: "Docker", iconKey: "docker", capability: "ship", proficiency: 4 },
  { name: "Git", iconKey: "git", capability: "ship", proficiency: 5 },
  { name: "GitHub Actions",iconKey: "github", capability: "ship", proficiency: 4 },
  // Operate
  { name: "TCP/IP", capability: "operate", proficiency: 5 },
  { name: "DNS / DHCP", capability: "operate", proficiency: 5 },
  { name: "VPN", capability: "operate", proficiency: 4 },
  { name: "LAN / WAN", capability: "operate", proficiency: 4 },
  { name: "Linux", iconKey: "linux", capability: "operate", proficiency: 4 },
  { name: "Google Workspace Admin", capability: "operate", proficiency: 5 },
  // Secure
  { name: "JWT", iconKey: "jwt", capability: "secure", proficiency: 5 },
  { name: "OAuth 2.0", capability: "secure", proficiency: 4 },
  { name: "OWASP Top 10", capability: "secure", proficiency: 4 },
  { name: "Helmet.js", capability: "secure", proficiency: 5 },
  { name: "Rate limiting", capability: "secure", proficiency: 4 },
  { name: "bcrypt", capability: "secure", proficiency: 5 },
  // Teach
  { name: "CS Curriculum design", capability: "teach", proficiency: 5 },
  { name: "Project-based learning", capability: "teach", proficiency: 5 },
  { name: "Student mentoring", capability: "teach", proficiency: 5 },
  { name: "Google Certified Educator L2", capability: "teach", proficiency: 5 },
  { name: "Agile / Scrum", capability: "teach", proficiency: 4 },
]

/* ── Heuristic mapping: DB Skill row → capability bucket ───────────────
 *  Honors an explicit `capability` field if the API ever sets it.
 *  Otherwise derives from category + iconKey + name keywords.            */
function deriveCapability(skill) {
  if (skill.capability && CAP_INDEX[skill.capability] !== undefined) {
    return skill.capability
  }
  const name = (skill.name || "").toLowerCase()
  const iconKey = (skill.iconKey || "").toLowerCase()
  const cat = (skill.category || "").toLowerCase()

  // Secure — auth, crypto, hardening
  if (
    /jwt|oauth|owasp|helmet|bcrypt|spring.?security|openssl|csrf|xss/.test(name) ||
    /jwt|oauth|helmet|bcrypt|springsecurity|openssl/.test(iconKey)
  ) return "secure"

  // Operate — networking, IT infra
  if (
    /tcp|dns|dhcp|vpn|lan|wan|linux|workspace|firewall|router|switch/.test(name) ||
    /linux|cloudflare|nginx/.test(iconKey)
  ) return "operate"

  // Teach — soft skills, curriculum, education
  if (
    cat === "soft_skill" ||
    /curriculum|teach|mentor|scrum|agile|leadership|communication|educator/.test(name)
  ) return "teach"

  // Data — DBs, query work
  if (
    cat === "database" ||
    /sql|postgres|mysql|prisma|mongo|redis|index|query|schema/.test(name)
  ) return "data"

  // Ship — cloud, devops, tools
  if (
    cat === "cloud" || cat === "tools" ||
    /docker|kubernet|aws|gcp|google.?cloud|cloudflare|ci\/cd|github.?actions|terraform/.test(name)
  ) return "ship"

  // Build — default for frontend/backend
  return "build"
}

/* ── Motion variants — match AboutPage.jsx for site-wide coherence ──── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}
const tightStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
}

/* ── Animated counter (for hero "X skills") ──────────────────────────── */
function Counter({ value }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 80, damping: 18 })
  const display = useTransform(spring, (v) => Math.round(v).toString())

  useEffect(() => {
    if (!inView) return
    if (reduce) { mv.set(value); return }
    mv.set(value)
  }, [inView, value, mv, reduce])

  return <m.span ref={ref}>{display}</m.span>
}

/* ── Proficiency display tier ─────────────────────────────────────────── */
const TIER = {
  5: { label: "Expert", dot: "bg-violet", ring: "ring-violet/30" },
  4: { label: "Advanced", dot: "bg-violet/80", ring: "ring-violet/25" },
  3: { label: "Proficient", dot: "bg-violet/55", ring: "ring-violet/20" },
  2: { label: "Working", dot: "bg-charcoal-80/45", ring: "ring-charcoal-80/15" },
  1: { label: "Familiar", dot: "bg-charcoal-80/30", ring: "ring-charcoal-80/10" },
}

function tierFor(p) { return TIER[Math.max(1, Math.min(5, p || 3))] || TIER[3] }

/* ── Skill chip — monochrome logo + name + proficiency dot ────────────── */
function SkillChip({ skill }) {
  const reduce = useReducedMotion()
  const tier = tierFor(skill.proficiency)
  const Logo = skill.iconKey ? ICON_REGISTRY[skill.iconKey] : null
  const isExpert = (skill.proficiency || 0) >= 5

  return (
    <m.li
      variants={fadeUp}
      whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`group inline-flex items-center gap-2 rounded-lg bg-violet-pale/55 px-3 py-1.5 text-meta text-violet ring-1 ring-inset transition-colors hover:bg-violet-pale ${tier.ring}`}
      title={`${skill.name} · ${tier.label}`}
    >
      {Logo && <Logo className="h-3.5 w-3.5 text-violet/85" aria-hidden="true" />}
      <span className="font-medium">{skill.name}</span>
      <span className="relative flex items-center justify-center">
        {isExpert && !reduce && (
          // soft pulse ring on expert-tier dots — signals mastery without
          // shouting. Spec'd to be subtle, not animation-heavy.
          <m.span
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 2.2 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            className="absolute h-1.5 w-1.5 rounded-full bg-violet"
            aria-hidden="true"
          />
        )}
        <span
          className={`relative h-1.5 w-1.5 rounded-full ${tier.dot}`}
          aria-label={`${tier.label} level`}
        />
      </span>
    </m.li>
  )
}

/* ── Capability card ─────────────────────────────────────────────────── */
function CapabilityCard({ capability, skills, index }) {
  const reduce = useReducedMotion()
  const { Icon, label, headline, sub } = capability

  return (
    <m.article
      variants={fadeUp}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_18px_rgba(93,63,211,0.05)] transition-shadow hover:shadow-[0_18px_44px_rgba(93,63,211,0.12)]"
    >
      {/* Decorative gradient blob, appears on hover, fades cleanly */}
      <m.div
        aria-hidden="true"
        initial={false}
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet/8 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      {/* Numbered badge in the corner, feels editorial, premium */}
      <span
        aria-hidden="true"
        className="absolute right-5 top-5 font-mono text-[10px] font-semibold tabular-nums tracking-wider text-violet/30 transition-colors group-hover:text-violet/55"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <header className="mb-5 flex items-start gap-3">
        <span
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet shadow-[inset_0_-1px_0_rgba(93,63,211,0.12)] transition-all duration-300 group-hover:bg-violet group-hover:text-white group-hover:shadow-[0_8px_18px_rgba(93,63,211,0.30)]"
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 pr-6">
          <h3 className="text-card font-bold leading-tight text-violet">{label}</h3>
          <p className="mt-1 text-meta font-medium leading-snug text-charcoal-80/80">{headline}</p>
          <p className="mt-1 text-micro leading-5 text-charcoal-80/55">{sub}</p>
        </div>
      </header>

      <m.ul
        variants={tightStagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-40px" }}
        className="flex flex-wrap gap-2"
      >
        {skills.map((s) => <SkillChip key={s.name + s.iconKey} skill={s} />)}
      </m.ul>

      {/* Hairline accent on hover, micro-detail */}
      <span
        aria-hidden="true"
        className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-violet via-violet/40 to-transparent transition-transform duration-500 group-hover:scale-x-100"
      />
    </m.article>
  )
}

/* ── Filter pill with shared layout for active state ──────────────────── */
function FilterPill({ active, label, count, onClick, layoutGroup }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative isolate inline-flex items-center gap-2 rounded-full px-4 py-2 text-meta font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 focus-visible:ring-offset-2 ${
        active
          ? "text-white"
          : "border border-charcoal-80/15 bg-white text-violet hover:border-violet/35 hover:bg-violet-pale/40"
      }`}
    >
      {active && (
        // shared element morph — the violet pill slides between filters
        <m.span
          layoutId={`pill-${layoutGroup}`}
          className="absolute inset-0 -z-10 rounded-full bg-violet shadow-[0_8px_18px_rgba(93,63,211,0.28)]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span>{label}</span>
      <span className={`font-mono text-[10px] tabular-nums ${active ? "text-white/80" : "text-violet/60"}`}>
        {count}
      </span>
    </button>
  )
}

/* ── Public component ─────────────────────────────────────────────────── */
export default function SkillsByCapability({
  apiSkillsGrouped = null,
  defaultFilter = "all",
}) {
  const { t } = useTranslation("about")
  const reduce = useReducedMotion()
  const [filter, setFilter] = useState(defaultFilter)

  /* Flatten API skills if present, else use defaults. We accept either
   * the grouped API shape or a flat array — both work. */
  const allSkills = useMemo(() => {
    const raw = []
    if (apiSkillsGrouped && typeof apiSkillsGrouped === "object") {
      Object.entries(apiSkillsGrouped).forEach(([cat, list]) => {
        if (cat === "language") return // handled by SpokenLanguages
        if (Array.isArray(list)) list.forEach((s) => raw.push({ ...s, category: cat }))
      })
    }
    return raw.length > 0 ? raw : DEFAULT_SKILLS
  }, [apiSkillsGrouped])

  /* Group by derived capability, preserving CAPABILITIES order */
  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(CAPABILITIES.map((c) => [c.id, []]))
    allSkills.forEach((s) => {
      const cap = deriveCapability(s)
      buckets[cap].push(s)
    })
    // sort each bucket: highest proficiency first, then name
    Object.values(buckets).forEach((arr) => {
      arr.sort((a, b) => (b.proficiency || 0) - (a.proficiency || 0) || a.name.localeCompare(b.name))
    })
    return CAPABILITIES.map((c) => ({ ...c, skills: buckets[c.id] })).filter((c) => c.skills.length > 0)
  }, [allSkills])

  const visible = useMemo(
    () => (filter === "all" ? grouped : grouped.filter((c) => c.id === filter)),
    [filter, grouped],
  )

  const totalSkills = useMemo(
    () => grouped.reduce((acc, c) => acc + c.skills.length, 0),
    [grouped],
  )

  return (
    <section
      aria-labelledby="capabilities-heading"
      className="relative overflow-hidden py-20 lg:py-28"
    >
      {/* Ambient gradient blobs, premium texture without heaviness */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-violet/5 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-10 h-[420px] w-[420px] rounded-full bg-terracotta/8 blur-3xl" />

      <div className="relative">
        {/* ── Section header ── */}
        <m.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mb-12 flex flex-col items-center gap-3 text-center"
        >
          <m.span
            variants={fadeUp}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet"
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Capabilities
          </m.span>
          <m.h2
            id="capabilities-heading"
            variants={fadeUp}
            className="max-w-3xl text-[28px] font-bold tracking-tight text-violet sm:text-section md:text-page"
          >
            {t("skills.engineered")}{" "}
            <span className="bg-gradient-to-r from-violet via-[#6A4FD8] to-terracotta bg-clip-text text-transparent">
              {t("skills.builtToScale")}
            </span>
          </m.h2>
          <m.p
            variants={fadeUp}
            className="max-w-2xl text-body leading-7 text-charcoal-80/70"
          >
            {t("skills.intro")}
          </m.p>

          {/* Stat strip, counts that signal depth at a glance */}
          <m.div
            variants={fadeUp}
            className="mt-4 flex items-center gap-6 text-micro text-charcoal-80/65"
          >
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] font-bold tabular-nums text-violet">
                <Counter value={totalSkills} />
              </span>
              <span className="uppercase tracking-wider">Skills</span>
            </span>
            <span className="h-4 w-px bg-charcoal-80/15" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] font-bold tabular-nums text-violet">
                <Counter value={grouped.length} />
              </span>
              <span className="uppercase tracking-wider">Capabilities</span>
            </span>
            <span className="h-4 w-px bg-charcoal-80/15" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[22px] font-bold tabular-nums text-violet">
                <Counter value={5} />
              </span>
              <span className="uppercase tracking-wider">Years</span>
            </span>
          </m.div>
        </m.div>

        {/* ── Filter pills with shared layout morph ── */}
        <m.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          role="toolbar"
          aria-label={t("skills.filterAria")}
          className="mx-auto mb-10 flex max-w-4xl flex-wrap justify-center gap-2"
        >
          <FilterPill
            active={filter === "all"}
            label={t("skills.allCapabilities")}
            count={totalSkills}
            onClick={() => setFilter("all")}
            layoutGroup="capabilities"
          />
          {grouped.map((c) => (
            <FilterPill
              key={c.id}
              active={filter === c.id}
              label={c.label}
              count={c.skills.length}
              onClick={() => setFilter(c.id)}
              layoutGroup="capabilities"
            />
          ))}
        </m.div>

        {/* ── Capability grid ── */}
        <AnimatePresence mode="wait">
          <m.div
            key={filter}
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.2 } }}
            className={`grid gap-5 ${
              visible.length === 1
                ? "mx-auto max-w-2xl"
                : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {visible.map((cap, i) => (
              <CapabilityCard key={cap.id} capability={cap} skills={cap.skills} index={i} />
            ))}
          </m.div>
        </AnimatePresence>

        {/* ── Legend + CTA strip ── */}
        <m.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-micro text-charcoal-80/65">
            <Legend dotClass="bg-violet" label="Expert" />
            <Legend dotClass="bg-violet/80" label="Advanced" />
            <Legend dotClass="bg-violet/55" label="Proficient" />
            <Legend dotClass="bg-charcoal-80/45" label="Working" />
          </div>
          <a
            href="/contact"
            className="group inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-white px-4 py-1.5 text-meta font-semibold text-violet transition hover:-translate-y-0.5 hover:border-violet hover:shadow-[0_8px_20px_rgba(93,63,211,0.15)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40"
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            {t("skills.applyToProject")}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </a>
        </m.div>
      </div>
    </section>
  )
}

function Legend({ dotClass, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  )
}
