// =============================================================
// bio-seed.js · seed Experience + Certificate + Skill (M12)
// Run:  node prisma/seed/bio-seed.js
// Source: Personal-Preferences-Mustapha-Ukizuru.md
// Idempotent — clears + re-inserts.
// =============================================================

/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const EXPERIENCE = [
  {
    role:         "IT Manager · Computer Science Teacher",
    company:      "Colegio de Excelencia Raindrop",
    location:     "Tlalnepantla de Baz, Estado de México, Mexico",
    startDate:    new Date("2022-12-01"),
    endDate:      null,
    description:
      "Lead the school's IT operations and computer-science programme. Built reporting tools, deployed Microsoft 365 across the institution, and designed a CSTA-aligned curriculum for K-12 students.",
    highlights: [
      "Cut weekly admin time by 80% via custom Django reporting dashboards",
      "Rolled out Microsoft 365 to staff and students with single sign-on",
      "Designed and delivered a K-12 computer-science curriculum aligned to international standards",
    ],
    tools:        ["Microsoft 365", "Django", "Python", "PostgreSQL", "GCP"],
    displayOrder: 0,
    isVisible:    true,
  },
]

const CERTIFICATES = [
  {
    title:         "Google Certified Educator · Level 2",
    issuer:        "Google",
    issueDate:     new Date("2023-09-01"),
    expiryDate:    null,
    credentialId:  null,
    credentialUrl: null,
    category:      "education",
    displayOrder:  0,
    isVisible:     true,
  },
]

const SKILLS = [
  // Backend
  { name: "Python",       category: "backend",  proficiency: 5, yearsUsing: 6, displayOrder: 0 },
  { name: "Django",       category: "backend",  proficiency: 5, yearsUsing: 5, displayOrder: 1 },
  { name: "Flask",        category: "backend",  proficiency: 4, yearsUsing: 4, displayOrder: 2 },
  { name: "Node.js",      category: "backend",  proficiency: 4, yearsUsing: 3, displayOrder: 3 },
  { name: "Express",      category: "backend",  proficiency: 4, yearsUsing: 3, displayOrder: 4 },
  { name: "Java",         category: "backend",  proficiency: 3, yearsUsing: 4, displayOrder: 5 },
  { name: "Spring Boot",  category: "backend",  proficiency: 3, yearsUsing: 2, displayOrder: 6 },

  // Frontend
  { name: "React",        category: "frontend", proficiency: 4, yearsUsing: 4, displayOrder: 0 },
  { name: "Tailwind CSS", category: "frontend", proficiency: 4, yearsUsing: 3, displayOrder: 1 },
  { name: "JavaScript",   category: "frontend", proficiency: 5, yearsUsing: 6, displayOrder: 2 },
  { name: "HTML / CSS",   category: "frontend", proficiency: 5, yearsUsing: 8, displayOrder: 3 },
  { name: "Bootstrap",    category: "frontend", proficiency: 4, yearsUsing: 5, displayOrder: 4 },

  // Database
  { name: "MySQL",        category: "database", proficiency: 4, yearsUsing: 5, displayOrder: 0 },
  { name: "PostgreSQL",   category: "database", proficiency: 4, yearsUsing: 4, displayOrder: 1 },

  // Cloud
  { name: "Google Cloud Platform", category: "cloud", proficiency: 4, yearsUsing: 3, displayOrder: 0 },
  { name: "AWS",                   category: "cloud", proficiency: 3, yearsUsing: 2, displayOrder: 1 },

  // Tools
  { name: "Git / GitHub", category: "tools", proficiency: 5, yearsUsing: 6, displayOrder: 0 },
  { name: "Docker",       category: "tools", proficiency: 4, yearsUsing: 3, displayOrder: 1 },
  { name: "JIRA",         category: "tools", proficiency: 4, yearsUsing: 4, displayOrder: 2 },

  // Languages
  { name: "Kinyarwanda (native)",      category: "language", proficiency: 5, displayOrder: 0 },
  { name: "English (professional)",    category: "language", proficiency: 5, displayOrder: 1 },
  { name: "Turkish (professional)",    category: "language", proficiency: 4, displayOrder: 2 },
  { name: "Spanish (intermediate)",    category: "language", proficiency: 3, displayOrder: 3 },
]

async function main() {
  console.log("▸ Seeding bio (experience · certificates · skills)...")

  await prisma.experience.deleteMany({})
  await prisma.experience.createMany({ data: EXPERIENCE })
  console.log(`  ✓ ${EXPERIENCE.length} experience row(s)`)

  await prisma.certificate.deleteMany({})
  await prisma.certificate.createMany({ data: CERTIFICATES })
  console.log(`  ✓ ${CERTIFICATES.length} certificate row(s)`)

  await prisma.skill.deleteMany({})
  await prisma.skill.createMany({ data: SKILLS })
  console.log(`  ✓ ${SKILLS.length} skill row(s)`)

  console.log("✓ Done.")
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
