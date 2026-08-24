import {
  Building2,
  BriefcaseBusiness,
  GraduationCap,
  Search,
  Lightbulb,
  Settings2,
  LineChart,
} from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  homeData.js · I18N12 — bilingual key-based catalogue
 *
 *  After the I18N rollout, this file no longer ships English strings.
 *  Instead it exposes:
 *    · `titleKey` / `descriptionKey` — i18next keys under the `home` namespace
 *    · `icon` — Lucide React component, locale-agnostic
 *    · `roleKey` (testimonials only) — locale-routed role label
 *
 *  Consumers (Home.jsx) call `t(item.titleKey)` to render. Real customer
 *  testimonial quotes (`text`) are kept in their original English on purpose —
 *  translating a quote without the speaker's consent would misrepresent them.
 *  When a Spanish-speaking customer ships a quote in Spanish we add a
 *  parallel record with its own keys.
 *  ──────────────────────────────────────────────────────────────────── */

export const audiences = [
  {
    titleKey:       "home:audiences.smes.title",
    descriptionKey: "home:audiences.smes.description",
    icon:           Building2,
  },
  {
    titleKey:       "home:audiences.professionals.title",
    descriptionKey: "home:audiences.professionals.description",
    icon:           BriefcaseBusiness,
  },
  {
    titleKey:       "home:audiences.schools.title",
    descriptionKey: "home:audiences.schools.description",
    icon:           GraduationCap,
  },
]

/* featuredProducts is reference seed data only — actual featured products
 * come from the API on Home mount. Kept English for legacy consumers
 * (storybook, dev seeds). Not rendered on the public Home page. */
export const featuredProducts = [
  {
    id: "digital-transformation-starter-toolkit",
    category: "IT Toolkits",
    title: "Digital Transformation Starter Toolkit",
    description: "Practical templates to guide digital planning and implementation.",
    price: 10,
    rating: 5,
  },
  {
    id: "weekly-content-calendar",
    category: "Templates",
    title: "Weekly Content Calendar for Creators",
    description: "A structured planning resource for consistent digital publishing.",
    price: 12,
    rating: 5,
  },
  {
    id: "stem-program-planning-pack",
    category: "Training",
    title: "STEM Program Planning Pack",
    description: "Organized teaching resources for coding and robotics initiatives.",
    price: 18,
    rating: 5,
  },
  {
    id: "school-it-audit-checklist",
    category: "Operations",
    title: "School IT Audit Checklist",
    description: "A ready-to-use checklist for reviewing infrastructure and systems.",
    price: 15,
    rating: 5,
  },
  {
    id: "website-launch-planning-kit",
    category: "Business Systems",
    title: "Website Launch Planning Kit",
    description: "A clean framework for planning and structuring web projects.",
    price: 14,
    rating: 5,
  },
  {
    id: "digital-workflow-optimization-pack",
    category: "Consulting",
    title: "Digital Workflow Optimization Pack",
    description: "Templates and guidance for improving digital efficiency.",
    price: 16,
    rating: 5,
  },
]

export const processSteps = [
  {
    titleKey:       "home:processSteps.discovery.title",
    descriptionKey: "home:processSteps.discovery.description",
    icon:           Search,
  },
  {
    titleKey:       "home:processSteps.strategy.title",
    descriptionKey: "home:processSteps.strategy.description",
    icon:           Lightbulb,
  },
  {
    titleKey:       "home:processSteps.implementation.title",
    descriptionKey: "home:processSteps.implementation.description",
    icon:           Settings2,
  },
  {
    titleKey:       "home:processSteps.optimization.title",
    descriptionKey: "home:processSteps.optimization.description",
    icon:           LineChart,
  },
]

/* Real customer testimonials. `text` is the verbatim quote from the
 * customer — never translated without explicit consent. `roleKey` routes
 * the role label through i18n so the Spanish surface shows
 * "Administradora escolar" instead of "School Administrator". */
export const testimonials = [
  {
    initials: "AM",
    name:     "Aline M.",
    roleKey:  "home:testimonialRoles.schoolAdministrator",
    rating:   5,
    text:     "The platform strategy and infrastructure guidance helped us modernize our digital learning environment with confidence.",
  },
  {
    initials: "JN",
    name:     "Jean N.",
    roleKey:  "home:testimonialRoles.businessOwner",
    rating:   5,
    text:     "The consulting approach was structured, practical, and focused on results. Our digital processes became more organized immediately.",
  },
  {
    initials: "CK",
    name:     "Claudine K.",
    roleKey:  "home:testimonialRoles.educationCoordinator",
    rating:   4,
    text:     "The STEM and technology planning support gave us a clear path for building engaging learning experiences.",
  },
  {
    initials: "TM",
    name:     "Theo M.",
    roleKey:  "home:testimonialRoles.operationsLead",
    rating:   5,
    text:     "Strong communication, thoughtful planning, and modern systems thinking made the implementation process smooth.",
  },
  {
    initials: "SR",
    name:     "Sarah R.",
    roleKey:  "home:testimonialRoles.independentProfessional",
    rating:   4,
    text:     "The digital strategy recommendations helped me improve my online structure and work more efficiently.",
  },
  {
    initials: "DK",
    name:     "David K.",
    roleKey:  "home:testimonialRoles.itCoordinator",
    rating:   5,
    text:     "Reliable guidance and a professional process. The solutions were practical, scalable, and easy to adopt.",
  },
]
