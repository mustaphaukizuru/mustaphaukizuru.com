/* ────────────────────────────────────────────────────────────────────────
   prisma/seed-bio.js · M12.5

   Idempotent seeder for Bio CMS. Populates the database with the legacy
   hardcoded Experience / Education / Certifications / Skills that lived in
   web/src/data/sitePagesData.js so the public About page renders the same
   content from the database. Once populated, the admin can edit via
   /admin/bio without losing existing content.

   Idempotent: each row is keyed on a unique combination (e.g. role+company
   for Experience, degree+institution for Education, name+category for Skill,
   title+issuer for Certificate). Re-running the script will skip rows that
   already exist with that key. Safe to run repeatedly.

   Usage:
     node prisma/seed-bio.js

   Wire into package.json scripts:
     "seed:bio": "node prisma/seed-bio.js"
   ──────────────────────────────────────────────────────────────────────── */

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────
// Source data — mirrors web/src/data/sitePagesData.js + AboutPage local arrays
// Kept as plain JS so this script has no frontend dependency.
// ─────────────────────────────────────────────────────────────────────────

const EXPERIENCE = [
  {
    role:        "IT Manager & Computer Science Teacher",
    company:     "Colegio de Excelencia Raindrop",
    location:    "Tlalnepantla de Baz, Mexico",
    startDate:   new Date("2022-12-01"),
    endDate:     null, // current
    description: "Leading IT systems, teaching computer science, and supporting digital learning implementation.",
  },
  {
    role:        "Assistant Project Manager",
    company:     "Design Office of Africa",
    location:    "Rwanda",
    startDate:   new Date("2021-09-01"),
    endDate:     new Date("2022-09-01"),
    description: "Coordinated project activities, digital processes, and operational support across technical workflows.",
  },
  {
    role:        "ICT Infrastructure & Support Director / ICT Teacher",
    company:     "Intellectual Schools AC",
    location:    "Ethiopia",
    startDate:   new Date("2021-01-01"),
    endDate:     new Date("2021-08-01"),
    description: "Managed ICT infrastructure and delivered educational technology support and training.",
  },
]

const EDUCATION = [
  {
    degree:       "Master's in Strategic Management in Software Engineering",
    institution:  "Universidad Europea del Atlántico",
    location:     "Santander, Spain",
    fieldOfStudy: "Software Engineering",
    startDate:    new Date("2024-06-01"),
    endDate:      new Date("2026-03-31"),
    description:  "Advanced training in software strategy, leadership, systems improvement, and digital transformation.",
  },
  {
    degree:       "Bachelor's in Information Technology and Accountancy",
    institution:  "Adventist University of Central Africa",
    location:     "Kigali, Rwanda",
    fieldOfStudy: "IT & Accountancy",
    grade:        "Distinction",
    startDate:    new Date("2016-09-01"),
    endDate:      new Date("2021-03-31"),
    description:  "Academic formation in IT systems, educational technology, and business-related digital skills.",
  },
  {
    degree:       "Diploma in Turkish Language",
    institution:  "Ipek University",
    location:     "Ankara, Turkey",
    fieldOfStudy: "Turkish Language & Communication",
    startDate:    new Date("2015-09-01"),
    endDate:      new Date("2016-08-31"),
    description:  "Language and communication studies supporting international academic and professional development.",
  },
]

const CERTIFICATES = [
  { title: "Google Certified Educator Level 2",         issuer: "Google for Education", category: "education", issueDate: new Date("2023-06-01") },
  { title: "Google Certified Educator Level 1",         issuer: "Google for Education", category: "education", issueDate: new Date("2022-08-01") },
  { title: "Cisco IT Essentials",                       issuer: "Cisco Networking Academy", category: "infrastructure", issueDate: new Date("2020-05-01") },
  { title: "CCNA: Introduction to Networks",            issuer: "Cisco Networking Academy", category: "infrastructure", issueDate: new Date("2020-12-01") },
  { title: "CCNA: Switching, Routing, and Wireless",    issuer: "Cisco Networking Academy", category: "infrastructure", issueDate: new Date("2021-04-01") },
  { title: "Web Development Bootcamp",                  issuer: "freeCodeCamp", category: "development", issueDate: new Date("2020-03-01") },
]

const SKILLS = [
  // Frontend
  { name: "React",       category: "frontend", proficiency: 5 },
  { name: "JavaScript",  category: "frontend", proficiency: 5 },
  { name: "HTML5",       category: "frontend", proficiency: 5 },
  { name: "CSS3",        category: "frontend", proficiency: 5 },
  { name: "Tailwind CSS",category: "frontend", proficiency: 5 },
  // Backend
  { name: "Node.js",     category: "backend",  proficiency: 5 },
  { name: "Python",      category: "backend",  proficiency: 4 },
  { name: "Django",      category: "backend",  proficiency: 4 },
  { name: "Express",     category: "backend",  proficiency: 5 },
  { name: "Java",        category: "backend",  proficiency: 3 },
  // Database
  { name: "MySQL",       category: "database", proficiency: 4 },
  { name: "PostgreSQL",  category: "database", proficiency: 4 },
  { name: "MongoDB",     category: "database", proficiency: 3 },
  { name: "Prisma",      category: "database", proficiency: 5 },
  // Cloud
  { name: "Google Cloud Platform", category: "cloud", proficiency: 4 },
  { name: "AWS",         category: "cloud", proficiency: 3 },
  { name: "Hostinger",   category: "cloud", proficiency: 5 },
  // Tools
  { name: "Git",         category: "tools",  proficiency: 5 },
  { name: "GitHub",      category: "tools",  proficiency: 5 },
  { name: "Docker",      category: "tools",  proficiency: 4 },
  { name: "VS Code",     category: "tools",  proficiency: 5 },
  // Languages
  { name: "Kinyarwanda", category: "language", proficiency: 5 },
  { name: "English",     category: "language", proficiency: 5 },
  { name: "Turkish",     category: "language", proficiency: 4 },
  { name: "Spanish",     category: "language", proficiency: 3 },
  // Soft skills
  { name: "Project Management",     category: "soft_skill", proficiency: 5 },
  { name: "IT Strategy",            category: "soft_skill", proficiency: 5 },
  { name: "Curriculum Design",      category: "soft_skill", proficiency: 4 },
  { name: "Cross-Cultural Comms",   category: "soft_skill", proficiency: 5 },
]

// ─────────────────────────────────────────────────────────────────────────
// Idempotent seed runners — each looks up the natural unique key first
// and skips/updates rather than blindly creating duplicates.
// ─────────────────────────────────────────────────────────────────────────

async function seedExperience() {
  let created = 0, skipped = 0
  for (const item of EXPERIENCE) {
    const exists = await prisma.experience.findFirst({
      where: { role: item.role, company: item.company },
      select: { id: true },
    })
    if (exists) { skipped++; continue }
    await prisma.experience.create({
      data: { ...item, displayOrder: created, isVisible: true },
    })
    created++
  }
  return { created, skipped }
}

async function seedEducation() {
  let created = 0, skipped = 0
  for (const item of EDUCATION) {
    const exists = await prisma.education.findFirst({
      where: { degree: item.degree, institution: item.institution },
      select: { id: true },
    })
    if (exists) { skipped++; continue }
    await prisma.education.create({
      data: { ...item, displayOrder: created, isVisible: true },
    })
    created++
  }
  return { created, skipped }
}

async function seedCertificates() {
  let created = 0, skipped = 0
  for (const item of CERTIFICATES) {
    const exists = await prisma.certificate.findFirst({
      where: { title: item.title, issuer: item.issuer },
      select: { id: true },
    })
    if (exists) { skipped++; continue }
    await prisma.certificate.create({
      data: { ...item, displayOrder: created, isVisible: true },
    })
    created++
  }
  return { created, skipped }
}

async function seedSkills() {
  let created = 0, skipped = 0
  for (const item of SKILLS) {
    const exists = await prisma.skill.findFirst({
      where: { name: item.name, category: item.category },
      select: { id: true },
    })
    if (exists) { skipped++; continue }
    await prisma.skill.create({
      data: { ...item, displayOrder: created, isVisible: true },
    })
    created++
  }
  return { created, skipped }
}

// ─────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📚  Seeding Bio CMS — idempotent · safe to re-run")
  console.log("─".repeat(60))

  const exp   = await seedExperience()
  console.log(`  Experience    : ${exp.created} created, ${exp.skipped} skipped (already exist)`)

  const edu   = await seedEducation()
  console.log(`  Education     : ${edu.created} created, ${edu.skipped} skipped`)

  const certs = await seedCertificates()
  console.log(`  Certificates  : ${certs.created} created, ${certs.skipped} skipped`)

  const skl   = await seedSkills()
  console.log(`  Skills        : ${skl.created} created, ${skl.skipped} skipped`)

  console.log("─".repeat(60))
  console.log("✓ Done. Visit /admin/bio to edit the seeded content.")
  console.log("  Public page /about will reflect changes immediately.")
}

main()
  .catch((e) => { console.error("✗ Seed failed:", e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
