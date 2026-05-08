/* ════════════════════════════════════════════════════════════════════════
   solutionsCatalogue.js · Mustapha Ukizuru Service Catalog v1.0 · Part IV
   ────────────────────────────────────────────────────────────────────────
   The 8 flagship Solutions composed from the atomic service catalog.

   Each Solution is a productized bundle:
     · single all-in price (custom proposal — see PRICING note)
     · defined timeline
     · clear outcome promise
     · composed of N atomic services (referenced by UKZ-* IDs)

   PRICING:
   The Service Catalog v1.0 deliberately does not publish dollar figures.
   Senior advisory work is sold via custom proposal after a 30-minute
   scoping call. Each Solution card shows duration + pricing model + a
   "Request package proposal" CTA. No fabricated numbers.
   ════════════════════════════════════════════════════════════════════════ */

import {
  GraduationCap, Brain, Sparkles, Briefcase, Rocket, Server, Database, User,
  // Evidence + route + supporting icons
  Zap, ShieldCheck, Globe2, Award, Clock,
  CalendarCheck, FileText, BadgeCheck, Rocket as RocketIcon, LifeBuoy,
  TrendingUp,
} from "lucide-react"

/* ── 8 Flagship Solutions ───────────────────────────────────────────────── */
export const SOLUTION_PACKAGES = [
  {
    id: "school-tech-transformation",
    slug: "school-tech-transformation",
    name: "School Tech Transformation Program",
    audience: "EDU",
    audienceLabel: "Schools & Education",
    primary: true,
    bento: "lg",
    Icon: GraduationCap,
    accent: { from: "#5D3FD3", to: "#7B5FE0" },
    iconBg: "bg-violet/10",
    iconText: "text-violet",
    tagline: "End-to-end school technology modernization",
    outcome: "End-to-end school technology modernization in 90 days plus six-month leadership engagement.",
    duration: "90 days build · 6 months leadership",
    pricingModel: "All-in proposal · multi-phase",
    composedOf: ["UKZ-CS-001","UKZ-IC-001","UKZ-IC-004","UKZ-ET-002","UKZ-ET-003","UKZ-ET-006","UKZ-CS-011"],
    headlineDeliverables: [
      "Technology audit + remediation roadmap",
      "Production-grade campus network",
      "Google Workspace for Education domain",
      "LMS deployed with content migrated",
      "Faculty cohort trained for term start",
      "Six months of fractional IT leadership",
    ],
    bestFor: "Schools modernizing infrastructure, EdTech, and IT governance in one program.",
    timelinePhases: [
      { label: "Days 1–30", title: "Audit + plan", description: "CS-001 audit · roadmap baseline" },
      { label: "Days 31–60", title: "Build", description: "Network + Workspace + LMS deployment" },
      { label: "Days 61–90", title: "Train + go-live", description: "Faculty cohort · go-live support" },
      { label: "Months 4–9", title: "Lead", description: "Virtual IT Director retainer (CS-011)" },
    ],
  },
  {
    id: "bilingual-stem-launch",
    slug: "bilingual-stem-program-launch",
    name: "Bilingual STEM Program Launch",
    audience: "EDU",
    audienceLabel: "Schools & Education",
    primary: false,
    bento: "sm",
    Icon: Brain,
    accent: { from: "#3FB47E", to: "#2D8C5F" },
    iconBg: "bg-mint/15",
    iconText: "text-mint",
    tagline: "CS curriculum + faculty enablement, EN-ES",
    outcome: "Full CS and STEM curriculum design plus faculty enablement, delivered in parallel English and Spanish.",
    duration: "10–14 weeks",
    pricingModel: "All-in proposal · per-cohort",
    composedOf: ["UKZ-ET-006","UKZ-ET-008","UKZ-ET-009","UKZ-ET-010"],
    headlineDeliverables: [
      "Smart classroom + STEM lab setup",
      "Faculty PD cohort (8 sessions)",
      "AI for educators training",
      "Bilingual EN-ES digital content library",
    ],
    bestFor: "Schools launching or re-launching a serious CS/STEM track for K–12.",
    timelinePhases: [
      { label: "Wk 1–4", title: "Lab build-out", description: "ET-010 smart-classroom setup" },
      { label: "Wk 3–10", title: "Faculty cohort", description: "ET-006 PD program in parallel" },
      { label: "Wk 5–12", title: "AI training", description: "ET-008 AI for educators" },
      { label: "Wk 8–14", title: "Content library", description: "ET-009 bilingual content production" },
    ],
  },
  {
    id: "school-ai-adoption",
    slug: "school-ai-adoption-program",
    name: "School AI Adoption Program",
    audience: "EDU",
    audienceLabel: "Schools & Education",
    primary: false,
    bento: "sm",
    Icon: Sparkles,
    accent: { from: "#5D3FD3", to: "#9061F9" },
    iconBg: "bg-violet/10",
    iconText: "text-violet",
    tagline: "Responsible AI adoption in one term",
    outcome: "Responsible adoption of AI tools across faculty, students, and curriculum within one term.",
    duration: "10–12 weeks",
    pricingModel: "All-in proposal · institutional",
    composedOf: ["UKZ-CS-007","UKZ-ET-008","UKZ-ET-011","UKZ-WD-014"],
    headlineDeliverables: [
      "AI strategy + adoption roadmap",
      "AI for educators training program",
      "Acceptable use policy implementation",
      "Optional AI content auditing system",
    ],
    bestFor: "Schools that want to adopt AI deliberately, without breaking what already works.",
    timelinePhases: [
      { label: "Wk 1–4", title: "Strategy", description: "CS-007 use cases + AUP framework" },
      { label: "Wk 3–10", title: "Faculty", description: "ET-008 AI for educators" },
      { label: "Wk 8–12", title: "Policy rollout", description: "ET-011 digital citizenship + AUP" },
      { label: "Wk 8–12", title: "Optional · WD", description: "WD-014 AI content auditing" },
    ],
  },
  {
    id: "fractional-cto",
    slug: "fractional-cto-engagement",
    name: "Fractional CTO Engagement",
    audience: "SMB",
    audienceLabel: "SMEs & Businesses",
    primary: true,
    bento: "lg",
    Icon: Briefcase,
    accent: { from: "#0284C7", to: "#0369A1" },
    iconBg: "bg-azure/15",
    iconText: "text-azure",
    tagline: "Senior technical leadership without a full hire",
    outcome: "Monthly technical leadership for SMEs and startups that need a CTO without the full-time cost.",
    duration: "Ongoing · 3-month minimum",
    pricingModel: "Monthly retainer",
    composedOf: ["UKZ-CS-010","UKZ-CS-002","UKZ-CS-008"],
    headlineDeliverables: [
      "Weekly leadership cadence",
      "Annual technology roadmap",
      "Engineering hiring support (as needed)",
      "Architecture, vendor, and roadmap decisions",
      "Investor and board technical communication",
    ],
    bestFor: "Series-A startups and 10-to-50-person SMEs needing senior technical leadership now.",
    timelinePhases: [
      { label: "Month 1", title: "Onboard", description: "Stakeholder map · roadmap baseline" },
      { label: "Month 1–2", title: "Roadmap", description: "CS-002 annual technology roadmap" },
      { label: "Ongoing", title: "Lead", description: "Weekly cadence + async availability" },
      { label: "As needed", title: "Hiring support",description: "CS-008 engineering hiring" },
    ],
  },
  {
    id: "mvp-to-launch",
    slug: "mvp-to-launch-package",
    name: "MVP-to-Launch Package",
    audience: "SMB",
    audienceLabel: "SMEs & Businesses",
    primary: true,
    bento: "lg",
    Icon: Rocket,
    accent: { from: "#5D3FD3", to: "#E07A4A" },
    iconBg: "bg-violet/10",
    iconText: "text-violet",
    tagline: "Working SaaS in 8 weeks, ready for first customers",
    outcome: "Working SaaS MVP delivered in eight weeks at fixed scope and fixed price, ready for first paying customers.",
    duration: "8 weeks build + post-launch retainer",
    pricingModel: "Fixed scope · fixed price",
    composedOf: ["UKZ-WD-002","UKZ-WD-007","UKZ-IC-009","UKZ-MS-003"],
    headlineDeliverables: [
      "Multi-tenant SaaS MVP (Django + React)",
      "Subscription billing (Stripe)",
      "Production deployment to GCP",
      "First-month maintenance retainer included",
    ],
    bestFor: "Founders with validated demand who need a real product in eight weeks, not eight months.",
    timelinePhases: [
      { label: "Wk 1", title: "Scope lock", description: "WD-002 feature definition + architecture" },
      { label: "Wk 2–6", title: "Build", description: "Backend + frontend + auth + billing" },
      { label: "Wk 7", title: "GCP deploy", description: "IC-009 cloud setup · go-live" },
      { label: "Wk 8+", title: "Maintain", description: "MS-003 ongoing maintenance retainer" },
    ],
  },
  {
    id: "business-it-foundation",
    slug: "business-it-foundation",
    name: "Business IT Foundation",
    audience: "SMB",
    audienceLabel: "SMEs & Businesses",
    primary: false,
    bento: "sm",
    Icon: Server,
    accent: { from: "#0284C7", to: "#075985" },
    iconBg: "bg-azure/15",
    iconText: "text-azure",
    tagline: "Network, cloud, identity, and security, done right.",
    outcome: "Network, cloud, Workspace, and security baseline configured for new or growing offices.",
    duration: "8–12 weeks",
    pricingModel: "All-in proposal · multi-workstream",
    composedOf: ["UKZ-IC-001","UKZ-IC-004","UKZ-IC-006","UKZ-IC-014","UKZ-IC-015"],
    headlineDeliverables: [
      "Production-grade office network",
      "Google Workspace tenant",
      "Identity & access management (SSO + MFA)",
      "OWASP security hardening",
      "Backup + disaster recovery plan",
    ],
    bestFor: "Growing companies opening a new office or rebuilding the IT layer they outgrew.",
    timelinePhases: [
      { label: "Wk 1–4", title: "Network", description: "IC-001 design + deployment" },
      { label: "Wk 3–6", title: "Workspace", description: "IC-004 Google Workspace setup" },
      { label: "Wk 5–9", title: "Identity", description: "IC-006 IAM + SSO + MFA" },
      { label: "Wk 8–12", title: "Security", description: "IC-014 OWASP audit + IC-015 DR plan" },
    ],
  },
  {
    id: "ai-knowledge-base",
    slug: "ai-powered-knowledge-base",
    name: "AI-Powered Knowledge Base",
    audience: "SMB,EDU",
    audienceLabel: "SMEs & Schools",
    primary: false,
    bento: "sm",
    Icon: Database,
    accent: { from: "#5D3FD3", to: "#7DD3FC" },
    iconBg: "bg-violet/10",
    iconText: "text-violet",
    tagline: "Custom RAG over your private knowledge",
    outcome: "Custom RAG system on private knowledge base, with semantic search and grounded answers.",
    duration: "8–14 weeks",
    pricingModel: "Fixed scope + ongoing retainer",
    composedOf: ["UKZ-CS-007","UKZ-WD-009","UKZ-WD-011","UKZ-MS-003"],
    headlineDeliverables: [
      "AI strategy + use-case roadmap",
      "Claude / OpenAI / Gemini integration",
      "Private RAG system w/ vector DB",
      "Citation + source tracking",
      "Ongoing maintenance retainer",
    ],
    bestFor: "Organizations with proprietary knowledge that needs to be searchable and AI-grounded.",
    timelinePhases: [
      { label: "Wk 1–3", title: "Strategy", description: "CS-007 use cases + AUP" },
      { label: "Wk 3–6", title: "Integrate", description: "WD-009 LLM API integration" },
      { label: "Wk 5–14", title: "RAG build", description: "WD-011 vector DB + retrieval pipeline" },
      { label: "Ongoing", title: "Maintain", description: "MS-003 application maintenance" },
    ],
  },
  {
    id: "personal-brand-web",
    slug: "personal-brand-and-web-foundation",
    name: "Personal Brand & Web Foundation",
    audience: "IND",
    audienceLabel: "Individuals & Professionals",
    primary: false,
    bento: "sm",
    Icon: User,
    accent: { from: "#E9C46A", to: "#E07A4A" },
    iconBg: "bg-terracotta/15",
    iconText: "text-terracotta-deep",
    tagline: "Identity + portfolio site + social presence",
    outcome: "Complete personal brand identity plus production-ready portfolio website on a custom domain.",
    duration: "5–7 weeks",
    pricingModel: "All-in proposal · individual tier",
    composedOf: ["UKZ-BD-001","UKZ-BD-007","UKZ-BD-011","UKZ-BD-013"],
    headlineDeliverables: [
      "Complete brand identity system",
      "Custom personal website (up to 6 pages)",
      "Social media presence optimization",
      "Privacy-compliant analytics",
    ],
    bestFor: "Independent professionals investing in a real digital presence, not a Linktree.",
    timelinePhases: [
      { label: "Wk 1–4", title: "Identity", description: "BD-001 brand discovery + system" },
      { label: "Wk 3–6", title: "Website", description: "BD-007 personal site build" },
      { label: "Wk 6", title: "Social", description: "BD-011 channel optimization" },
      { label: "Wk 7", title: "Analytics", description: "BD-013 GA4 + tracking setup" },
    ],
  },
]

/* ── Helpers ────────────────────────────────────────────────────────────── */
export const getSolutionBySlug = (slug) => SOLUTION_PACKAGES.find((p) => p.slug === slug) || null

/**
 * Filter solutions by audience code.
 * "EDU" matches solutions targeting schools (incl. SMB+EDU combos).
 * "SMB" matches business-targeted (incl. SMB+EDU combos).
 * "IND" matches individual-targeted.
 * null returns all.
 */
export function solutionsByAudience(code) {
  if (!code) return SOLUTION_PACKAGES
  return SOLUTION_PACKAGES.filter((p) => p.audience.split(",").includes(code))
}

/* ── Audience filter chips spec ─────────────────────────────────────────── */
export const SOLUTIONS_AUDIENCE_FILTERS = [
  { code: null, label: "All packages", short: "All" },
  { code: "EDU", label: "Schools", short: "EDU" },
  { code: "SMB", label: "Businesses", short: "SMB" },
  { code: "IND", label: "Individuals", short: "IND" },
]

/* ── Evidence metrics (production proof) ────────────────────────────────── */
export const EVIDENCE = [
  { value: "240ms", label: "Average API response time (production)", Icon: Zap },
  { value: "99 %", label: "Uptime on deployed services", Icon: ShieldCheck},
  { value: "−60 %", label: "Typical reduction in admin time", Icon: Clock },
  { value: "+30 %", label: "Average growth in lead capture (12 months)", Icon: TrendingUp },
]

/* ── Founder card bullets ───────────────────────────────────────────────── */
export const FOUNDER_BULLETS = [
  { Icon: Globe2, text: "4 countries: Rwanda · Turkey · Ethiopia · Mexico" },
  { Icon: Award, text: "8+ years shipping production systems and curricula" },
  { Icon: ShieldCheck, text: "Google Certified Educator L2 · IT Support Pro · Meta Front-End" },
  { Icon: Server, text: "Currently building: a publication pipeline that ships one solution per week" },
]

/* ── Recently shipped (proof strip) ─────────────────────────────────────── */
export const RECENTLY_SHIPPED = [
  {
    id: "rs-1",
    clientType: "International school, Estado de México",
    solutionSlug: "school-tech-transformation",
    solutionLabel: "School Tech Transformation",
    shippedAt: "2026-03-01",
    outcome: "Network rebuilt · LMS migrated · 40 faculty onboarded in 90 days",
    isLive: true,
  },
  {
    id: "rs-2",
    clientType: "EdTech startup, CDMX",
    solutionSlug: "mvp-to-launch",
    solutionLabel: "MVP-to-Launch",
    shippedAt: "2026-02-01",
    outcome: "SaaS MVP shipped in 8 weeks · first 30 paying users in week 10",
    isLive: true,
  },
  {
    id: "rs-3",
    clientType: "Independent consultant, Mexico",
    solutionSlug: "personal-brand-web",
    solutionLabel: "Personal Brand & Web",
    shippedAt: "2026-01-01",
    outcome: "Identity + 6-page site live · 3 inbound leads in week 1",
    isLive: true,
  },
]

/* ── Route · 5-step engagement flow ─────────────────────────────────────── */
export const ROUTE_STEPS = [
  {
    n: "01",
    title: "Discovery call",
    description: "30 minutes · no commitment · we align on context, real pain, and the smallest viable deliverable.",
    Icon: CalendarCheck,
  },
  {
    n: "02",
    title: "Written proposal",
    description: "48–72 h · scope, deliverables, timeline, and price · zero surprises.",
    Icon: FileText,
  },
  {
    n: "03",
    title: "Deposit + kickoff",
    description: "50% deposit with instant invoice · same-week kickoff · continuous access from day one.",
    Icon: BadgeCheck,
  },
  {
    n: "04",
    title: "Iterative delivery",
    description: "Weekly sprints · visible checkpoints · adjustments included within agreed scope.",
    Icon: RocketIcon,
  },
  {
    n: "05",
    title: "Post-launch support",
    description: "30 days of support included · optional monthly retainer · iteration based on real data.",
    Icon: LifeBuoy,
  },
]

/* ── FAQ · self-serve + discovery focused ───────────────────────────────── */
export const SOLUTIONS_FAQ_ITEMS = [
  {
    q: "Why packages instead of fixed-price tiers on every page?",
    a: "Senior advisory work is sold via custom proposal after a 30-minute scoping call. Each package has a fixed scope and fixed price for that buyer; they are simply not posted publicly. The duration and pricing model are visible on every card so you know what you are stepping into before the call.",
  },
  {
    q: "How do I know which package fits me?",
    a: "Filter by audience (Schools, Businesses, or Individuals). The card shows the outcome, the duration, the services it is composed of, and the headline deliverables. If you are between two, book the call and I will diagnose which one solves your situation.",
  },
  {
    q: "What if I need something that's not a packaged Solution?",
    a: "All 82 atomic services are listed on the Services page; pick whichever ones you need à la carte. Packages are bundles of services with a single proposal and a single timeline.",
  },
  {
    q: "Is the 30-minute call free?",
    a: "Yes, no strings. There's no discovery fee, no obligation to continue. If after the call we decide we're not the right match, I'll honestly recommend other professionals.",
  },
  {
    q: "What happens after the call?",
    a: "Within 48–72 hours you receive a written proposal: scope, deliverables, timeline, price. If it makes sense we sign a simple contract, take a deposit, and kick off that same week. If you need time to decide, no pressure.",
  },
  {
    q: "Can I add services to a package?",
    a: "Yes. Every Solution can be extended with any other atomic service from the catalog. The proposal will list them as separate line items so you can pick what is in and what is out.",
  },
  {
    q: "Do you work outside Mexico?",
    a: "Yes. Production track record across Rwanda, Turkey, Ethiopia, and Mexico. Operation is 100% remote, with on-site sessions in CDMX or Estado de México when they add real value.",
  },
]

/* ── Comparison-matrix attribute spec ───────────────────────────────────── */
export const COMPARISON_ATTRIBUTES = [
  { id: "audience", label: "Best for", source: (p) => p.audienceLabel },
  { id: "duration", label: "Duration", source: (p) => p.duration },
  { id: "pricing", label: "Pricing model", source: (p) => p.pricingModel },
  { id: "services", label: "Services included", source: (p) => `${p.composedOf.length} services` },
  { id: "deliverables", label: "Deliverables", source: (p) => `${p.headlineDeliverables.length} headline` },
]

/* ════════════════════════════════════════════════════════════════════════
   SOLUTION PLANS · per package
   ────────────────────────────────────────────────────────────────────────
   Three tiers per solution — Essential / Complete / Premium.
   Override path: edit any priceFromUsd / priceFromMxn in the map below.
   Numbers are sensible senior-consulting anchors at ~20 MXN/USD; adjust
   to match your actual proposal range.
   ════════════════════════════════════════════════════════════════════════ */
export const SOLUTION_PLANS = {
  "school-tech-transformation": {
    essential: { name: "Essential", label: "Audit + plan", priceFromUsd: 14500, priceFromMxn: 290000, unit: "fixed", timeline: "60 days", popular: false, scope: ["Tech audit + remediation roadmap","Network plan & architecture","Workspace tenant setup","30-day post-launch support"] },
    complete: { name: "Complete", label: "End-to-end build", priceFromUsd: 24000, priceFromMxn: 480000, unit: "fixed", timeline: "90 days", popular: true, scope: ["Everything in Essential","LMS deployment + content migration","Faculty PD cohort (8 sessions)","Go-live + 30-day support"] },
    premium: { name: "Premium", label: "Build + 6-mo leadership",priceFromUsd: 38000, priceFromMxn: 760000, unit: "fixed", timeline: "9 months", popular: false, scope: ["Everything in Complete","6 months Virtual IT Director","Quarterly executive briefings","Annual technology roadmap"] },
  },
  "bilingual-stem-program-launch": {
    essential: { name: "Essential", label: "Faculty cohort", priceFromUsd: 9800, priceFromMxn: 196000, unit: "fixed", timeline: "10 weeks", popular: false, scope: ["Faculty PD cohort (8 sessions)","AI-for-educators training","Pre/post assessments","Final showcase"] },
    complete: { name: "Complete", label: "Cohort + content", priceFromUsd: 16500, priceFromMxn: 330000, unit: "fixed", timeline: "12 weeks", popular: true, scope: ["Everything in Essential","Bilingual EN-ES content library","Curriculum alignment review","Style guide for ongoing production"] },
    premium: { name: "Premium", label: "Lab + program", priceFromUsd: 26000, priceFromMxn: 520000, unit: "fixed", timeline: "14 weeks", popular: false, scope: ["Everything in Complete","Smart classroom + STEM lab setup","Equipment specification & coordination","Faculty orientation"] },
  },
  "school-ai-adoption-program": {
    essential: { name: "Essential", label: "Strategy + AUP", priceFromUsd: 7500, priceFromMxn: 150000, unit: "fixed", timeline: "8 weeks", popular: false, scope: ["AI strategy & adoption roadmap","Acceptable use policy framework","Use-case identification","Executive briefing"] },
    complete: { name: "Complete", label: "Strategy + faculty", priceFromUsd: 13000, priceFromMxn: 260000, unit: "fixed", timeline: "10 weeks", popular: true, scope: ["Everything in Essential","AI for educators training program","Per-seat or institutional cohort","Practical projects + assessment"] },
    premium: { name: "Premium", label: "Strategy + auditing", priceFromUsd: 19500, priceFromMxn: 390000, unit: "fixed", timeline: "12 weeks", popular: false, scope: ["Everything in Complete","AI content auditing system","Teacher review interface","LMS integration + reporting"] },
  },
  "fractional-cto-engagement": {
    essential: { name: "Essential", label: "Advisory retainer", priceFromUsd: 3500, priceFromMxn: 70000, unit: "monthly", timeline: "3-month min",popular: false, scope: ["Weekly leadership cadence","Architecture & roadmap decisions","Vendor / tool selection","Async availability"] },
    complete: { name: "Complete", label: "Full fractional CTO", priceFromUsd: 5500, priceFromMxn: 110000, unit: "monthly", timeline: "Ongoing", popular: true, scope: ["Everything in Essential","Engineering team oversight","Code review & standards","Investor & board communication","Hiring support included"] },
    premium: { name: "Premium", label: "CTO + roadmap + hiring", priceFromUsd: 9000, priceFromMxn: 180000, unit: "monthly", timeline: "Ongoing", popular: false, scope: ["Everything in Complete","Full annual technology roadmap","Active engineering hiring (1–2 roles)","Quarterly stakeholder reviews"] },
  },
  "mvp-to-launch-package": {
    essential: { name: "Essential", label: "Lean MVP (4 weeks)", priceFromUsd: 14000, priceFromMxn: 280000, unit: "fixed", timeline: "4 weeks", popular: false, scope: ["Single-tenant MVP","Auth + Stripe billing","Admin dashboard","GCP deployment"] },
    complete: { name: "Complete", label: "SaaS MVP (8 weeks)", priceFromUsd: 22000, priceFromMxn: 440000, unit: "fixed", timeline: "8 weeks", popular: true, scope: ["Multi-tenant SaaS MVP","Auth + subscription billing","Customer + admin dashboards","Onboarding flow + email","First-month maintenance retainer"] },
    premium: { name: "Premium", label: "MVP + 90-day retainer", priceFromUsd: 34000, priceFromMxn: 680000, unit: "fixed", timeline: "8 weeks + 90d",popular: false, scope: ["Everything in Complete","90-day post-launch retainer","Performance optimization","First feature iteration","Analytics dashboard"] },
  },
  "business-it-foundation": {
    essential: { name: "Essential", label: "Workspace + identity", priceFromUsd: 11000, priceFromMxn: 220000, unit: "fixed", timeline: "6 weeks", popular: false, scope: ["Google Workspace tenant","SSO + MFA implementation","Identity & access management","Admin documentation"] },
    complete: { name: "Complete", label: "Network + cloud + sec", priceFromUsd: 18500, priceFromMxn: 370000, unit: "fixed", timeline: "10 weeks", popular: true, scope: ["Everything in Essential","Production-grade office network","OWASP security hardening","Backup + DR plan","Tabletop recovery exercise"] },
    premium: { name: "Premium", label: "Foundation + ops", priceFromUsd: 28000, priceFromMxn: 560000, unit: "fixed", timeline: "12 weeks", popular: false, scope: ["Everything in Complete","First 90-day managed IT retainer","Helpdesk-as-a-service","Quarterly health check"] },
  },
  "ai-powered-knowledge-base": {
    essential: { name: "Essential", label: "Strategy + LLM", priceFromUsd: 9500, priceFromMxn: 190000, unit: "fixed", timeline: "6 weeks", popular: false, scope: ["AI strategy + use-case roadmap","LLM API integration (Claude / GPT / Gemini)","Cost monitoring + rate limiting","Documentation"] },
    complete: { name: "Complete", label: "RAG system", priceFromUsd: 15000, priceFromMxn: 300000, unit: "fixed", timeline: "10 weeks", popular: true, scope: ["Everything in Essential","Vector DB + retrieval pipeline","Citation + source tracking","Admin UI for content management"] },
    premium: { name: "Premium", label: "RAG + ongoing retainer", priceFromUsd: 24000, priceFromMxn: 480000, unit: "fixed", timeline: "14 weeks + ongoing",popular: false, scope: ["Everything in Complete","Document processing pipeline","Evaluation framework","6-month maintenance retainer"] },
  },
  "personal-brand-and-web-foundation": {
    essential: { name: "Essential", label: "Identity only", priceFromUsd: 1800, priceFromMxn: 36000, unit: "fixed", timeline: "3 weeks", popular: false, scope: ["Brand identity system","Logo + color + typography","Brand guidelines","Asset library handover"] },
    complete: { name: "Complete", label: "Brand + website", priceFromUsd: 3200, priceFromMxn: 64000, unit: "fixed", timeline: "5 weeks", popular: true, scope: ["Everything in Essential","Custom personal website (6 pages)","WCAG AA accessibility","SEO + analytics setup"] },
    premium: { name: "Premium", label: "Brand + web + presence", priceFromUsd: 5500, priceFromMxn: 110000, unit: "fixed", timeline: "7 weeks", popular: false, scope: ["Everything in Complete","Social presence optimization","Content system setup","30-day post-launch support"] },
  },
}

/* ── Plan tier display config ───────────────────────────────────────────── */
export const SOLUTION_PLAN_TIERS = [
  { key: "essential", label: "Essential", tone: "azure", popular: false },
  { key: "complete", label: "Complete", tone: "violet", popular: true },
  { key: "premium", label: "Premium", tone: "terracotta", popular: false },
]
