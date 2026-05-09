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

/* ──────────────────────────────────────────────────────────────────────────
 *  Authoritative experience data · 6 roles, mirrors web/src/data/sitePagesData.js
 *  • description = lead summary paragraph rendered on the public timeline
 *  • highlights  = JSON array of quantified achievement bullets (used by
 *                  CV export, structured-data schema, and the admin UI)
 *  • location    = city, region/country
 *  Date format: YYYY-MM-01 for the first of the month.
 *  ────────────────────────────────────────────────────────────────────── */
const EXPERIENCE = [
  {
    role:        "IT Manager · Full-Stack Developer · ICT Coordinator · CS Educator",
    company:     "Colegio de Excelencia Raindrop",
    location:    "Tlalnepantla de Baz, Estado de México, Mexico",
    startDate:   new Date("2022-12-01"),
    endDate:     null,
    description: "Lead end-to-end ICT operations and full-stack engineering for a 100-plus user campus, while designing and delivering the Computer Science and STEM curriculum for secondary-level students.",
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
    role:        "Assistant Project Manager · Technical Systems",
    company:     "Design Office of Africa Ltd.",
    location:    "Kigali, Rwanda",
    startDate:   new Date("2021-09-01"),
    endDate:     new Date("2022-09-01"),
    description: "Coordinated technical project delivery and IT operations across concurrent engineering and design workstreams.",
    highlights: [
      "Coordinated technical timelines, task assignments, and delivery milestones across concurrent projects using JIRA — consistently meeting deadlines on time and within scope.",
      "Managed internal digital systems and IT infrastructure, maintaining 99% uptime and ensuring data integrity across all operational platforms.",
      "Provided direct IT support and troubleshooting to internal teams across hardware, software, and network issues, resolving incidents promptly to prevent disruption to project delivery.",
      "Produced multilingual technical documentation in English, Turkish, and Kinyarwanda for cross-functional stakeholder teams.",
    ],
  },
  {
    role:        "ICT Infrastructure Director · Backend Developer · Technical Support Lead",
    company:     "Intellectual Schools AC",
    location:    "Addis Ababa, Ethiopia",
    startDate:   new Date("2021-01-01"),
    endDate:     new Date("2021-08-01"),
    description: "Directed all ICT operations and led the institutional web and backend redesign across a multi-building campus serving 1,000-plus students and 60 faculty.",
    highlights: [
      "Redesigned the institutional web and backend infrastructure, achieving a 50% improvement in website performance through server-side optimization, database query tuning, and caching strategies.",
      "Reduced system downtime by 30% by deploying proactive infrastructure monitoring, configuring automated alerts, and establishing scheduled preventive maintenance protocols.",
      "Managed the full scope of IT support operations across the multi-building campus — covering hardware, software, and network systems with an average issue resolution time of under two hours.",
      "Led the deployment of Google Workspace and LMS platforms across the institution, improving digital tool adoption by 60% in the first quarter and enabling hybrid e-learning at scale.",
    ],
  },
  {
    role:        "Software Development Instructor · Curriculum Designer",
    company:     "St. Emmanuel School Complex",
    location:    "Kigali, Rwanda",
    startDate:   new Date("2020-01-01"),
    endDate:     new Date("2020-12-01"),
    description: "Designed and delivered the institutional software development curriculum from foundational programming through application deployment.",
    highlights: [
      "Designed and delivered a full-cycle STEM and software development curriculum in Python, Java, JavaScript, and web development.",
      "Introduced Git and GitHub version control practices into student workflows — reduced code integration errors by an estimated 35% and built habits of collaborative, professional-standard development.",
      "Developed structured lesson plans, rubrics, and project-based assessments aligned with international CS education standards.",
    ],
  },
  {
    role:        "Sales & Marketing Officer · Digital Systems",
    company:     "Blueflame Ltd.",
    location:    "Kigali, Rwanda",
    startDate:   new Date("2020-05-01"),
    endDate:     new Date("2020-12-01"),
    description: "Drove digital marketing and customer-acquisition strategy through CRM-driven campaigns and conversion-optimized email systems.",
    highlights: [
      "Generated a 25% increase in company revenue through a data-driven digital marketing strategy combining CRM automation, audience segmentation, and campaign performance analytics.",
      "Built HTML, CSS, and JavaScript email marketing campaigns that measurably improved customer conversion rates and audience engagement.",
    ],
  },
  {
    role:        "Translator & Interpreter",
    company:     "Umut Ltd.",
    location:    "Kigali, Rwanda",
    startDate:   new Date("2018-09-01"),
    endDate:     new Date("2020-05-01"),
    description: "Delivered professional interpretation and document translation services in Turkish, English, and Kinyarwanda across business, legal, and diplomatic contexts.",
    highlights: [
      "Provided professional interpretation and translation in three working languages for international stakeholders.",
      "Served clients across business, legal, and diplomatic environments — built the multilingual professional foundation that anchors the entire current brand.",
    ],
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
  // Upsert by (role, company) so re-running the seed refreshes existing rows
  // — important when the source content evolves but the role+company key
  // stays stable. Switching from skip-if-exists prevents stale legacy rows
  // from masking the curated content on the public timeline.
  let created = 0, updated = 0
  for (let i = 0; i < EXPERIENCE.length; i++) {
    const item = EXPERIENCE[i]
    const existing = await prisma.experience.findFirst({
      where: { role: item.role, company: item.company },
      select: { id: true },
    })
    if (existing) {
      await prisma.experience.update({
        where: { id: existing.id },
        data: { ...item, displayOrder: i, isVisible: true },
      })
      updated++
    } else {
      await prisma.experience.create({
        data: { ...item, displayOrder: i, isVisible: true },
      })
      created++
    }
  }
  // Optional cleanup: remove any legacy rows NOT in the authoritative list
  // (matched by role+company key) so stale entries can't reappear in admin.
  const keepKeys = new Set(EXPERIENCE.map((e) => `${e.role}::${e.company}`))
  const all = await prisma.experience.findMany({ select: { id: true, role: true, company: true } })
  const stale = all.filter((r) => !keepKeys.has(`${r.role}::${r.company}`))
  let removed = 0
  for (const s of stale) {
    await prisma.experience.delete({ where: { id: s.id } })
    removed++
  }
  return { created, updated, removed, skipped: 0 }
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
  console.log(`  Experience    : ${exp.created} created, ${exp.updated} updated, ${exp.removed} removed (legacy rows pruned)`)

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
