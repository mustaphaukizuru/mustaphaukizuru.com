/**
 * Portfolio seed — one-time import from web/src/data/aboutProjectsData.js
 * into the Portfolio table.
 *
 * Idempotent: re-running updates existing rows by slug. Safe to run multiple
 * times; existing IDs (including ones referenced from other systems) remain.
 *
 * Re-running back-fills the case-study block on already-seeded rows.
 *
 * Usage:
 *   node prisma/seed/portfolio-seed.js
 */

const prisma = require("../../src/lib/prisma")

const { assertLocalDatabase } = require("../../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed/portfolio-seed.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("portfolio-seed.js")
const { composeResults } = require("../../src/services/portfolioService")

/* Case-study block (roadmap step 27) — stored inside the `results` Json
 * column as `{ items, caseStudy }` (see portfolioService.composeResults).
 * Outcomes flagged `placeholder: true` are illustrative — the owner replaces
 * them with real numbers in Admin → Portfolio → Case study. The public page
 * renders them with `data-placeholder` and a visible "illustrative" note. */

/* ────────────────────────────────────────────────────────────────────────────
 * Data — reshaped from aboutProjectsData.js to match the Portfolio schema.
 *
 * The original data is missing several fields the new schema requires
 * (`role`, `category`, `shortDescription`). We derive sensible defaults
 * using the `title` and `description`. Admin can refine via the admin UI.
 * ──────────────────────────────────────────────────────────────────────────── */

const PORTFOLIO = [
  {
    slug:             "mustaphaukizuru-digital-platform",
    title:            "Brand platform & digital store",
    titleEs:          "Plataforma de marca y tienda digital",
    role:             "Full-Stack Developer · Product Designer",
    client:           "mustaphaukizuru.com (Personal brand)",
    category:         "Full-Stack Development",
    coverImage:       "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (1).png",
    gallery: [
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (1).png",
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (2).png",
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (3).png",
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (4).png",
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (5).png",
      "/images/projects/ukizuru-portfolio/ukizuru_mustapha_project (6).png",
    ],
    shortDescription:   "One platform for the portfolio, the store, members and admin.",
    shortDescriptionEs: "Una plataforma para el portafolio, la tienda, los miembros y la administración.",
    description:
      "Developed a full-stack platform combining a professional website, digital product store, secure member portal, and admin dashboard — enabling service presentation, product sales, protected downloads, and efficient system management.",
    challenge:        "Needed a single platform that covered personal branding, commerce, and client management without depending on multiple third-party services.",
    solution:         "Built a Node/Express + Prisma/MySQL backend and a React/Vite/Tailwind frontend with JWT auth, MercadoPago and PayPal payments, admin CMS, and a full member dashboard.",
    results: [
      "Unified professional presence and digital revenue stream in one domain",
      "Removed reliance on third-party store platforms and their fees",
      "Full control of customer data, orders, and digital deliveries",
      "Extensible foundation for future features (services, portfolio, support)",
    ],
    caseStudy: {
      serviceSlug: "digital-product-engineering",
      context:   "Personal brand needing one domain that sells digital products, presents services, and manages clients — without stitching together a store, a CRM, and a portfolio tool.",
      contextEs: "Marca personal que necesitaba un único dominio para vender productos digitales, presentar servicios y gestionar clientes, sin unir una tienda, un CRM y una herramienta de portafolio.",
      problem:   "Third-party storefronts took a cut of every sale, split customer data across tools, and could not gate downloads or client project files behind one login.",
      problemEs: "Las tiendas de terceros cobraban comisión por cada venta, dispersaban los datos de clientes entre herramientas y no podían proteger descargas ni archivos de proyecto tras un solo inicio de sesión.",
      approach: [
        { title: "Map the domains", body: "Split the platform into store, services, member portal and admin, each with its own Prisma models and role guards.", titleEs: "Mapear los dominios", bodyEs: "Dividir la plataforma en tienda, servicios, portal de miembros y admin, cada uno con sus modelos Prisma y guardas de rol." },
        { title: "Build the payment spine", body: "MercadoPago + PayPal with webhook-driven order transitions, coupons, refunds and audit logs.", titleEs: "Construir la columna de pagos", bodyEs: "MercadoPago + PayPal con transiciones de pedido por webhook, cupones, reembolsos y auditoría." },
        { title: "Ship the admin CMS", body: "Products, blog, portfolio, email templates and analytics editable without a deploy.", titleEs: "Entregar el CMS de admin", bodyEs: "Productos, blog, portafolio, plantillas de email y analítica editables sin desplegar." },
        { title: "Harden and localise", body: "JWT sessions, rate limits, signed download links, and a full EN/ES content layer.", titleEs: "Endurecer y localizar", bodyEs: "Sesiones JWT, límites de tasa, enlaces de descarga firmados y una capa de contenido EN/ES completa." },
      ],
      outcomes: [
        { value: "0%",  label: "marketplace fees on digital sales", labelEs: "comisiones de marketplace en ventas digitales", placeholder: false },
        { value: "1",   label: "login for store, downloads and client projects", labelEs: "inicio de sesión para tienda, descargas y proyectos", placeholder: false },
        { value: "-60%", label: "admin time per product launch (est.)", labelEs: "tiempo de admin por lanzamiento (est.)", placeholder: true },
      ],
      stack: ["Node.js", "Express", "Prisma", "MySQL", "React 19", "Vite", "Tailwind v4", "MercadoPago", "PayPal"],
    },
    tools: [
      "Node.js", "Express", "Prisma", "MySQL", "React", "Vite", "Tailwind CSS",
      "Framer Motion", "MercadoPago", "PayPal", "Nodemailer",
    ],
    tags: [
      "Professional Website", "Digital Products Store", "Member Portal",
      "E-Commerce Platform", "Admin Dashboard", "Full-Stack Development",
    ],
    liveUrl:          "https://mustaphaukizuru.com/",
    repoUrl:          null,
    year:             2026,
    duration:         "2025–2026",
    status:           "published",
    isFeatured:       true,
    displayOrder:     0,
    metaTitle:        "Brand platform & digital store · Mustapha Ukizuru",
    metaTitleEs:      "Plataforma de marca y tienda digital · Mustapha Ukizuru",
    metaDescription:  "Full-stack platform with portfolio, e-commerce, member portal, and admin CMS — built end-to-end.",
  },
  {
    slug:             "educational-digital-resources",
    title:            "Institutional brand system",
    titleEs:          "Sistema de marca institucional",
    role:             "Digital Designer & Educational Content Developer",
    client:           "Intellectual Schools",
    category:         "Design & Branding",
    coverImage:       "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (1).png",
    gallery: [
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (1).png",
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (2).png",
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (3).png",
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (4).png",
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (5).png",
      "/images/projects/intellectual-school/ukizuru_mustapha_IntellectualSchool (6).png",
    ],
    shortDescription:   "A reusable kit for print, social and outdoor campaigns.",
    shortDescriptionEs: "Un kit reutilizable para campañas impresas, sociales y exteriores.",
    description:
      "Designed and produced a wide range of educational and institutional digital materials (posters, brochures, banners, billboards, and branded documents) to support school communication, marketing, and learning environments.",
    challenge:        "The institution required consistent, professional, and visually engaging materials to support both academic communication and marketing efforts across digital and physical platforms.",
    solution:         "Designed and delivered a variety of branded materials aligned with the school's identity and communication goals, adapted for use across social media and print platforms.",
    results: [
      "Improved institutional branding consistency",
      "Enhanced visibility across social media and physical platforms",
      "Supported marketing and student engagement through visual materials",
      "Strengthened communication of school programs and activities",
    ],
    caseStudy: {
      serviceSlug: "it-strategy-consulting",
      context:   "A private school network that communicates with parents and prospects across print, social media and campus signage.",
      contextEs: "Una red de colegios privados que se comunica con familias y prospectos a través de impresos, redes sociales y señalética en campus.",
      problem:   "Materials were produced ad hoc by different staff, so branding drifted and campaigns launched late.",
      problemEs: "Los materiales se producían de forma improvisada por distintas personas, la marca se diluía y las campañas salían tarde.",
      approach: [
        { title: "Audit existing materials", body: "Catalogued every poster, brochure and banner in use and scored brand consistency.", titleEs: "Auditar los materiales existentes", bodyEs: "Se catalogó cada póster, folleto y banner en uso y se puntuó la coherencia de marca." },
        { title: "Define a reusable kit", body: "Colour, type and layout templates sized for print, Facebook and billboards.", titleEs: "Definir un kit reutilizable", bodyEs: "Plantillas de color, tipografía y maquetación para impresión, Facebook y vallas." },
        { title: "Produce the campaign set", body: "Delivered the full seasonal set of enrolment and event materials from the kit.", titleEs: "Producir el conjunto de campaña", bodyEs: "Se entregó el conjunto completo de materiales de inscripción y eventos a partir del kit." },
      ],
      outcomes: [
        { value: "40+", label: "branded assets delivered", labelEs: "piezas de marca entregadas", placeholder: true },
        { value: "-50%", label: "turnaround per campaign (est.)", labelEs: "tiempo de entrega por campaña (est.)", placeholder: true },
        { value: "1",   label: "brand kit reused across print and social", labelEs: "kit de marca reutilizado en impreso y redes", placeholder: false },
      ],
      stack: ["Adobe Photoshop", "Illustrator", "Canva", "Print production"],
    },
    tools: [
      "Graphic Design", "Branding", "Visual Communication",
      "Print & Digital Media Design", "Content Design",
    ],
    tags: ["Design", "Branding", "Educational Resources"],
    liveUrl:          "https://www.facebook.com/intsintl",
    repoUrl:          null,
    year:             2021,
    duration:         "Jan 2021 – Aug 2021",
    status:           "published",
    isFeatured:       true,
    displayOrder:     1,
    metaTitle:        "Institutional brand system · Mustapha Ukizuru",
    metaTitleEs:      "Sistema de marca institucional · Mustapha Ukizuru",
    metaDescription:  "Design and branding for Intellectual Schools — posters, brochures, banners, and institutional documents.",
  },
  {
    slug:             "colegio-raindrop-website",
    title:            "School website & admissions",
    titleEs:          "Sitio escolar y admisiones",
    role:             "Web Developer · IT Integrator",
    client:           "Colegio Raindrop",
    category:         "Web Development",
    coverImage:       "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (6).png",
    gallery: [
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (1).png",
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (2).png",
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (3).png",
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (4).png",
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (5).png",
      "/images/projects/raindrop-college/Raindrop_ProjectUkizuru_Mustapha (6).png",
    ],
    shortDescription:   "A responsive site families can scan in seconds.",
    shortDescriptionEs: "Un sitio responsive que las familias escanean en segundos.",
    description:
      "Designed and developed the official website for Colegio Raindrop — a modern, responsive platform to showcase academic programs, school activities, and institutional information.",
    challenge:        null,
    solution:         null,
    results: [
      "Delivered a cohesive, mobile-ready web presence",
      "Improved parent and prospective-student access to school information",
      "Enabled the school to publish updates without ongoing developer involvement",
    ],
    caseStudy: {
      serviceSlug: "cloud-architecture-migration",
      context:   "A K-12 school whose only online presence was a social page — no owned site for programs, admissions or announcements.",
      contextEs: "Un colegio K-12 cuya única presencia online era una página en redes: sin sitio propio para programas, admisiones o avisos.",
      problem:   "Parents could not find admissions information, and every content change depended on an outside developer.",
      problemEs: "Las familias no encontraban información de admisiones y cada cambio de contenido dependía de un desarrollador externo.",
      approach: [
        { title: "Content and IA workshop", body: "Mapped programs, admissions and news into a navigation parents can scan in seconds.", titleEs: "Taller de contenido y arquitectura", bodyEs: "Se organizaron programas, admisiones y noticias en una navegación que las familias escanean en segundos." },
        { title: "Responsive build on a managed CMS", body: "Mobile-first templates with editable sections the school staff own.", titleEs: "Construcción responsive sobre un CMS gestionado", bodyEs: "Plantillas mobile-first con secciones editables que el personal del colegio controla." },
        { title: "Hosting, domain and integrations", body: "Managed hosting, SSL, contact forms and social embeds wired up.", titleEs: "Hosting, dominio e integraciones", bodyEs: "Hosting gestionado, SSL, formularios de contacto e integraciones sociales." },
        { title: "Staff handover", body: "Trained staff to publish updates without developer involvement.", titleEs: "Traspaso al personal", bodyEs: "Se capacitó al personal para publicar novedades sin intervención de desarrollo." },
      ],
      outcomes: [
        { value: "100%", label: "of updates published by school staff", labelEs: "de las novedades publicadas por el colegio", placeholder: false },
        { value: "+35%", label: "admissions enquiries (est.)", labelEs: "consultas de admisión (est.)", placeholder: true },
        { value: "<2s",  label: "mobile load time (est.)", labelEs: "tiempo de carga móvil (est.)", placeholder: true },
      ],
      stack: ["WordPress", "HTML/CSS", "Responsive design", "Managed hosting"],
    },
    tools: ["HTML/CSS", "Responsive Design", "WordPress / CMS", "Content Strategy"],
    tags: ["Web Development", "School Systems", "Digital Integration"],
    liveUrl:          "https://www.colegioraindrop.edu.mx/",
    repoUrl:          null,
    year:             2024,
    duration:         "2023–2024",
    status:           "published",
    isFeatured:       true,
    displayOrder:     2,
    metaTitle:        "School website & admissions · Mustapha Ukizuru",
    metaTitleEs:      "Sitio escolar y admisiones · Mustapha Ukizuru",
    metaDescription:  "Responsive school website and digital integration for Colegio Raindrop.",
  },
]

/* ────────────────────────────────────────────────────────────────────────────
 * Seeder
 * ──────────────────────────────────────────────────────────────────────────── */

async function seed() {
  console.log("[portfolio-seed] Starting…")

  for (const p of PORTFOLIO) {
    console.log(`  → ${p.slug}`)
    const existing = await prisma.portfolio.findUnique({ where: { slug: p.slug } })

    const data = {
      title:            p.title,
      titleEs:          p.titleEs || null,
      slug:             p.slug,
      role:             p.role,
      client:           p.client,
      category:         p.category,
      coverImage:       p.coverImage,
      gallery:          p.gallery,
      shortDescription:   p.shortDescription,
      shortDescriptionEs: p.shortDescriptionEs || null,
      description:      p.description,
      challenge:        p.challenge,
      solution:         p.solution,
      results:          composeResults(p.results, p.caseStudy),
      tools:            p.tools,
      tags:             p.tags,
      liveUrl:          p.liveUrl,
      repoUrl:          p.repoUrl,
      year:             p.year,
      duration:         p.duration,
      status:           p.status,
      isFeatured:       p.isFeatured,
      displayOrder:     p.displayOrder,
      metaTitle:        p.metaTitle,
      metaTitleEs:      p.metaTitleEs || null,
      metaDescription:  p.metaDescription,
    }

    if (existing) {
      await prisma.portfolio.update({ where: { id: existing.id }, data })
    } else {
      await prisma.portfolio.create({ data })
    }
  }

  const count = await prisma.portfolio.count({ where: { status: "published" } })
  console.log(`[portfolio-seed] Done. ${count} published portfolio item(s) in DB.`)
}

seed()
  .catch((err) => {
    console.error("[portfolio-seed] failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
