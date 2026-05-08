/**
 * Portfolio seed — one-time import from web/src/data/aboutProjectsData.js
 * into the Portfolio table.
 *
 * Idempotent: re-running updates existing rows by slug. Safe to run multiple
 * times; existing IDs (including ones referenced from other systems) remain.
 *
 * Usage:
 *   node prisma/seed/portfolio-seed.js
 */

const prisma = require("../../src/lib/prisma")

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
    title:            "Professional Portfolio, Digital Store & Member Platform",
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
    shortDescription: "A full-stack SaaS platform combining portfolio, digital store, member dashboard, and admin CMS.",
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
    metaTitle:        "Professional Portfolio, Digital Store & Member Platform · Mustapha Ukizuru",
    metaDescription:  "Full-stack platform with portfolio, e-commerce, member portal, and admin CMS — built end-to-end.",
  },
  {
    slug:             "educational-digital-resources",
    title:            "Educational Digital Resources & Institutional Branding",
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
    shortDescription: "Branded digital materials — posters, brochures, banners, billboards — for school communication and marketing.",
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
    metaTitle:        "Educational Digital Resources & Institutional Branding · Mustapha Ukizuru",
    metaDescription:  "Design and branding for Intellectual Schools — posters, brochures, banners, and institutional documents.",
  },
  {
    slug:             "colegio-raindrop-website",
    title:            "Colegio Raindrop School Website & Digital Integration",
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
    shortDescription: "Modern, responsive school website showcasing academic programs and institutional information.",
    description:
      "Designed and developed the official website for Colegio Raindrop — a modern, responsive platform to showcase academic programs, school activities, and institutional information.",
    challenge:        null,
    solution:         null,
    results: [
      "Delivered a cohesive, mobile-ready web presence",
      "Improved parent and prospective-student access to school information",
      "Enabled the school to publish updates without ongoing developer involvement",
    ],
    tools: ["HTML/CSS", "Responsive Design", "WordPress / CMS", "Content Strategy"],
    tags: ["Web Development", "School Systems", "Digital Integration"],
    liveUrl:          "https://www.colegioraindrop.edu.mx/",
    repoUrl:          null,
    year:             2024,
    duration:         "2023–2024",
    status:           "published",
    isFeatured:       true,
    displayOrder:     2,
    metaTitle:        "Colegio Raindrop School Website · Mustapha Ukizuru",
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
      slug:             p.slug,
      role:             p.role,
      client:           p.client,
      category:         p.category,
      coverImage:       p.coverImage,
      gallery:          p.gallery,
      shortDescription: p.shortDescription,
      description:      p.description,
      challenge:        p.challenge,
      solution:         p.solution,
      results:          p.results,
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
