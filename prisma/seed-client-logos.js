// ════════════════════════════════════════════════════════════════════════════
// seed-client-logos · the seven marks the /about wall shipped with
// ────────────────────────────────────────────────────────────────────────────
//   ALLOW_PROD_DB=1 npm run seed:client-logos
//
// Idempotent: upserts on `slug`, so re-running never duplicates a client and
// never clobbers a name/sector/scale the owner has since edited in the admin
// (only rows that do not exist yet are written).
//
// `scale` is optical, not mathematical. A circular badge at the same CSS
// height as a wide wordmark reads noticeably smaller, so square marks get a
// nudge up and the solid dark ASR tile a nudge down. These are starting
// points — they are tunable per logo from Admin → Clients.
// ════════════════════════════════════════════════════════════════════════════
const prisma = require("../src/lib/prisma")

const { assertLocalDatabase } = require("../scripts/guard-prod-db")

// The npm wrapper runs this guard too, but `node prisma/seed-client-logos.js` skips
// the wrapper entirely — and that is a normal thing to type. Guarding in here
// as well means the check follows the script, not the way it was invoked.
assertLocalDatabase("seed-client-logos.js")

const LOGOS = [
  { slug: "raindrop",            name: "Colegio de Excelencia Raindrop", sector: "K-12 school · Mexico",  sectorEs: "Colegio K-12 · México",   scale: 1.15 },
  { slug: "intellectual-school", name: "Intellectual School",            sector: "K-12 school · Turkey",  sectorEs: "Colegio K-12 · Turquía",  scale: 1.0 },
  { slug: "interlaken",          name: "Colegio Interlaken",             sector: "K-12 school · Mexico",  sectorEs: "Colegio K-12 · México",   scale: 1.1 },
  { slug: "peimy",               name: "e·PEIMY",                        sector: "Payroll & HR · Mexico", sectorEs: "Nóminas y RR. HH. · México", scale: 1.05 },
  { slug: "blueflame",           name: "BlueFlame Appliances",           sector: "Retail · Rwanda",       sectorEs: "Comercio · Ruanda",       scale: 1.0 },
  { slug: "umut",                name: "Umut Cafe & Restaurant",         sector: "Hospitality · Turkey",  sectorEs: "Hostelería · Turquía",    scale: 1.1 },
  { slug: "asr",                 name: "ASR",                            sector: "Technology",            sectorEs: "Tecnología",              scale: 0.9,  boxed: true },
]

async function main() {
  let created = 0
  for (const [index, logo] of LOGOS.entries()) {
    const data = {
      ...logo,
      boxed: Boolean(logo.boxed),
      logoUrl: `/images/brand/companies/${logo.slug}.webp`,
      sortOrder: index,
      isActive: true,
    }
    const existing = await prisma.clientLogo.findUnique({ where: { slug: logo.slug } })
    if (existing) {
      console.log(`  =  ${logo.slug} (left alone)`)
      continue
    }
    await prisma.clientLogo.create({ data })
    created += 1
    console.log(`  +  ${logo.slug}`)
  }
  const total = await prisma.clientLogo.count()
  console.log(`\nDone. ${created} created, ${total} client logos on the wall.`)
}

main()
  .catch((e) => {
    console.error("[seed-client-logos] failed:", e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect().catch(() => {}))
