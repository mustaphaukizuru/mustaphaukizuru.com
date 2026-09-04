// ════════════════════════════════════════════════════════════════════════════
// demo-seed · a launch-year of transactional data — LOCAL DATABASE ONLY
// ────────────────────────────────────────────────────────────────────────────
//   npm run seed:demo              populate
//   npm run seed:demo -- --purge   remove everything this script created
//
// WHY THIS EXISTS
// ---------------
// The content seeds (services, portfolio, products, blog, bio, logos) fill the
// public marketing site. Nothing fills the *transactional* tables, so every
// admin dashboard, chart, funnel, order table and member portal renders its
// empty state. You cannot tell whether pagination, sorting, currency
// formatting, date filters or the analytics charts work against an empty
// database — those behaviours only appear under volume.
//
// This writes that volume: customers, orders with matching payments /
// invoices / refunds, consultations, client projects with milestones and
// comment threads, support tickets, reviews, subscribers, contact messages,
// and 90 days of page views / events / daily rollups **derived from the same
// orders**, so the revenue chart and the order list agree with each other.
// A rollup invented independently of the orders would make every
// reconciliation bug invisible, which is the opposite of the point.
//
// LOCAL ONLY — AND THERE IS NO OVERRIDE
// -------------------------------------
// Unlike `db:push`, this has no `ALLOW_PROD_DB=1` escape hatch, deliberately.
// Everything here is invented: invented customers, invented revenue, invented
// reviews. Invented reviews on a live site are fabricated social proof, and
// invented revenue silently corrupts the numbers the business reads.
// `scripts/guard-prod-db.js` runs first via the npm script; assertLocalDatabase()
// runs again in-process so `node prisma/seed/demo-seed.js` cannot skip it.
//
// DETERMINISTIC
// -------------
// A seeded PRNG (never Math.random) means two machines produce identical data,
// so "the chart looks wrong on mine" is a real difference rather than a
// different dice roll. Change DEMO_SEED to reroll the whole dataset.
//
// PURGEABLE
// ---------
// Every person created here has an `@demo.test` address. RFC 2606 reserves
// `.test`, so none of them can be routed or accidentally mailed — and the
// domain doubles as the purge key. See purge() for the delete order, which is
// not the obvious one: Payment.userId is onDelete Restrict and Order.userId is
// SetNull, so users are the *last* thing to go, not the first.
//
// NOTE ON FILES: ProjectFile rows are metadata only. No bytes are written to
// storage/, so a download from the portal will 404 — that is expected, and
// keeps the seed from scattering junk outside the database.
// ════════════════════════════════════════════════════════════════════════════

require("dotenv").config()

const bcrypt = require("bcryptjs")
const prisma = require("../../src/lib/prisma")
const { computeOrderTax } = require("../../src/lib/tax")

/* ────────────────────────────────────────────────────────────────────────────
 * Guard. Allow-list, not deny-list: an unrecognised host counts as production,
 * because the cost of guessing wrong is fake revenue in a real dashboard.
 * ──────────────────────────────────────────────────────────────────────────── */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "host.docker.internal"])

function hostFromUrl(raw) {
  if (!raw) return null
  try {
    return new URL(raw).hostname || null
  } catch {
    const m = /@([^/:]+)/.exec(raw)
    return m ? m[1] : null
  }
}

function assertLocalDatabase() {
  const host = hostFromUrl(process.env.DATABASE_URL)
  if (host && (LOCAL_HOSTS.has(host) || host.endsWith(".local"))) return
  console.error("")
  console.error("  x demo-seed refuses to run against a non-local database.")
  console.error(`    DATABASE_URL host: ${host || "(unset)"}`)
  console.error("")
  console.error("    This script writes invented customers, revenue and reviews.")
  console.error("    There is deliberately no ALLOW_PROD_DB override.")
  console.error("    Point DATABASE_URL at a local MySQL — see docs/LOCAL_DEV_DB.md.")
  console.error("")
  process.exit(1)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Deterministic PRNG (mulberry32)
 * ──────────────────────────────────────────────────────────────────────────── */

const DEMO_SEED = 0x5eed1234

function makeRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = makeRng(DEMO_SEED)
const rand = (min, max) => min + rng() * (max - min)
const randInt = (min, max) => Math.floor(rand(min, max + 1))
const pick = (arr) => arr[randInt(0, arr.length - 1)]
const chance = (p) => rng() < p
const shuffle = (arr) => {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

/* Everything is anchored to "now", so the dashboards always show a trailing
 * twelve months no matter when the seed is run.
 *
 * The whole time axis is UTC, deliberately. An earlier version anchored days
 * on LOCAL midnight while bucketing them by UTC date, and on a machine west of
 * Greenwich an order placed at 22:00 local fell on the next UTC day — outside
 * every DailyMetric bucket. The rollup and the order table then disagreed by
 * exactly one order, which is precisely the reconciliation bug this seed is
 * supposed to make visible rather than cause. Local time is never read here.
 */
const NOW = new Date()
const DAY = 86_400_000
const daysAgo = (n, hour = 12, minute = 0) => {
  const d = new Date(NOW.getTime() - n * DAY)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0))
}
const addDays = (date, n) => new Date(date.getTime() + n * DAY)
const addMinutes = (date, n) => new Date(date.getTime() + n * 60_000)
const atMidnightUtc = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

const DEMO_DOMAIN = "demo.test"
const DEMO_TAG = "[demo-seed]"
const ANALYTICS_DAYS = 90

/* Volume knobs — the "realistic launch-year" profile. */
const COUNTS = Object.freeze({
  customers:    40,
  orders:       120,
  consultations: 25,
  projects:      8,
  tickets:      15,
  reviews:      36,
  subscribers: 200,
  contacts:     30,
  diagnostics:  18,
  abandonedCarts: 12,
  activeCarts:    5,
})

/* ────────────────────────────────────────────────────────────────────────────
 * Fixtures. Names read real so screenshots read real; the @demo.test address
 * is what marks the row as fake. Markets match where this business sells.
 * ──────────────────────────────────────────────────────────────────────────── */

const PEOPLE = [
  { name: "María Fernanda Delgado",  company: "Colegio Interlaken",             city: "Ciudad de México",      country: "MX", title: "Directora General" },
  { name: "Rodrigo Salinas Ibarra",  company: "Grupo Peimy",                    city: "Monterrey",             country: "MX", title: "Director de Operaciones" },
  { name: "Ana Lucía Beltrán",       company: "Colegio de Excelencia Raindrop", city: "Puebla",                country: "MX", title: "Coordinadora Académica" },
  { name: "Diego Armando Cortés",    company: "Ferretería Cortés",              city: "Guadalajara",           country: "MX", title: "Propietario" },
  { name: "Valeria Ocampo Ruiz",     company: "Clínica Dental Ocampo",          city: "Querétaro",             country: "MX", title: "Socia Fundadora" },
  { name: "Emre Yılmaz",             company: "Intellectual School",            city: "Istanbul",              country: "TR", title: "Head of Technology" },
  { name: "Zeynep Kaya",             company: "Umut Cafe & Restaurant",         city: "Ankara",                country: "TR", title: "Operations Manager" },
  { name: "Jean-Claude Habimana",    company: "BlueFlame Appliances",           city: "Kigali",                country: "RW", title: "Managing Director" },
  { name: "Aline Uwase",             company: "Kigali Learning Hub",            city: "Kigali",                country: "RW", title: "Programme Lead" },
  { name: "Sofía Martínez Ríos",     company: "Instituto Bilingüe Aurora",      city: "Mérida",                country: "MX", title: "Subdirectora" },
  { name: "Carlos Eduardo Pineda",   company: "Logística Pineda",               city: "Veracruz",              country: "MX", title: "Gerente de TI" },
  { name: "Ricardo Navarro Solís",   company: "Despacho Navarro Contadores",    city: "León",                  country: "MX", title: "Socio Director" },
  { name: "Gabriela Torres Meza",    company: "Boutique Casa Meza",             city: "San Miguel de Allende", country: "MX", title: "Fundadora" },
  { name: "Luis Ángel Domínguez",    company: "Talleres Domínguez",             city: "Toluca",                country: "MX", title: "Director" },
  { name: "Paola Rentería Vega",     company: "Colegio Nuevo Horizonte",        city: "Tijuana",               country: "MX", title: "Directora de Innovación" },
  { name: "Andrés Felipe Rojas",     company: "Rojas Consultoría",              city: "Bogotá",                country: "CO", title: "Consultor Principal" },
  { name: "Camila Restrepo Ángel",   company: "EduRed Colombia",                city: "Medellín",              country: "CO", title: "Directora de Producto" },
  { name: "Martín Ezequiel Ferrer",  company: "Estudio Ferrer",                 city: "Buenos Aires",          country: "AR", title: "Socio" },
  { name: "Julieta Sosa Aguirre",    company: "Fundación Aprender Más",         city: "Córdoba",               country: "AR", title: "Coordinadora" },
  { name: "Felipe Andrés Cárdenas",  company: "Cárdenas y Asociados",           city: "Santiago",              country: "CL", title: "Gerente General" },
  { name: "Isabel Quispe Mamani",    company: "Colegio San Martín",             city: "Lima",                  country: "PE", title: "Directora" },
  { name: "Sarah Whitmore",          company: "Northgate Prep School",          city: "Manchester",            country: "GB", title: "Bursar" },
  { name: "Daniel O'Connell",         company: "Clearwater Studio",              city: "Dublin",                country: "IE", title: "Founder" },
  { name: "Priya Ramanathan",        company: "Vantage Analytics",              city: "Toronto",               country: "CA", title: "Head of Operations" },
  { name: "Marcus Delaney",          company: "Delaney Brothers Supply",        city: "Chicago",               country: "US", title: "Owner" },
  { name: "Hannah Brecht",           company: "Studio Brecht",                  city: "Berlin",                country: "DE", title: "Creative Director" },
  { name: "Tomás Herrera Lagos",     company: "Herrera Inmobiliaria",           city: "Puebla",                country: "MX", title: "Director Comercial" },
  { name: "Regina Fuentes Camacho",  company: "Panadería Camacho",              city: "Oaxaca",                country: "MX", title: "Propietaria" },
  { name: "Alejandro Vidal Peña",    company: "Vidal Arquitectos",              city: "Guadalajara",           country: "MX", title: "Arquitecto Principal" },
  { name: "Natalia Guzmán Ortiz",    company: "Escuela Montessori Guzmán",      city: "Cuernavaca",            country: "MX", title: "Directora" },
  { name: "Omar Sánchez Bravo",      company: "Bravo Seguridad Digital",        city: "Ciudad de México",      country: "MX", title: "CTO" },
  { name: "Fátima Espinoza León",    company: "Colectivo Raíz",                 city: "Xalapa",                country: "MX", title: "Coordinadora General" },
  { name: "Iván Mendoza Cruz",       company: "Refacciones Mendoza",            city: "Puebla",                country: "MX", title: "Gerente" },
  { name: "Lorena Aguilar Nieto",    company: "Aguilar Marketing",              city: "Monterrey",             country: "MX", title: "Directora de Cuentas" },
  { name: "Sebastián Ríos Alcalá",   company: "Ríos Legal",                     city: "Ciudad de México",      country: "MX", title: "Abogado Socio" },
  { name: "Claudia Bermúdez Solano", company: "Centro Educativo Solano",        city: "Villahermosa",          country: "MX", title: "Directora Administrativa" },
  { name: "Héctor Villalobos Paz",   company: "Villalobos Transportes",         city: "Saltillo",              country: "MX", title: "Director de Sistemas" },
  { name: "Renata Ibáñez Cordero",   company: "Estudio Ibáñez",                 city: "Guadalajara",           country: "MX", title: "Diseñadora Titular" },
  { name: "Pablo Esteban Quiroga",   company: "Quiroga Agroindustrias",         city: "Culiacán",              country: "MX", title: "Gerente de Proyectos" },
  { name: "Mariana Cifuentes Rey",   company: "Instituto Rey Bilingüe",         city: "Chihuahua",             country: "MX", title: "Directora Académica" },
]

/* ────────────────────────────────────────────────────────────────────────────
 * TESTIMONIALS — invented, and only ever loaded into a local database.
 *
 * These reach the home page the same way a real one would: the seed writes
 * Review rows, some flagged `featured`, and Home.jsx renders whatever
 * GET /api/v1/reviews/featured returns. That is the point — it exercises the
 * real trust layer end to end instead of hardcoding quotes into the SPA, and
 * it means nothing here can appear on the live site, because seed:demo cannot
 * run against a non-local database.
 *
 * Written to match the market rather than filled with generic praise:
 *   - Mexico and LATAM personas speak Spanish; the UK/IE/US/CA/DE/TR/RW
 *     accounts speak English. A Mexico-first consultancy's wall of proof is
 *     mostly Spanish, and a testimonial in the wrong language is the first
 *     thing that reads as fake.
 *   - Quotes are matched to the client's SECTOR, so a school director talks
 *     about SEP paperwork and enrolment, a despacho about CFDI and clients,
 *     a taller about inventory. Praise that could belong to anyone is what
 *     makes placeholder copy look like placeholder copy.
 *   - Concrete and bounded: a named before/after, a timeframe, and in a few
 *     cases a caveat. Uniform five-star rapture is not credible, and the
 *     rating deck below deliberately includes 3s and a 2.
 * ──────────────────────────────────────────────────────────────────────────── */

const SPANISH_SPEAKING = new Set(["MX", "CO", "AR", "CL", "PE"])

/* Sector per company, so the quote fits the client rather than rotating
 * blindly through a flat list. */
const SECTOR_BY_COMPANY = {
  "Colegio Interlaken": "school", "Colegio de Excelencia Raindrop": "school",
  "Intellectual School": "school", "Instituto Bilingüe Aurora": "school",
  "Colegio Nuevo Horizonte": "school", "EduRed Colombia": "school",
  "Fundación Aprender Más": "school", "Colegio San Martín": "school",
  "Northgate Prep School": "school", "Escuela Montessori Guzmán": "school",
  "Centro Educativo Solano": "school", "Instituto Rey Bilingüe": "school",
  "Kigali Learning Hub": "school",

  "Ferretería Cortés": "retail", "BlueFlame Appliances": "retail",
  "Boutique Casa Meza": "retail", "Panadería Camacho": "retail",
  "Refacciones Mendoza": "retail", "Delaney Brothers Supply": "retail",
  "Umut Cafe & Restaurant": "retail",

  "Despacho Navarro Contadores": "professional", "Ríos Legal": "professional",
  "Cárdenas y Asociados": "professional", "Estudio Ferrer": "professional",
  "Rojas Consultoría": "professional", "Vidal Arquitectos": "professional",
  "Estudio Ibáñez": "professional", "Herrera Inmobiliaria": "professional",
  "Clínica Dental Ocampo": "professional",

  "Logística Pineda": "industry", "Talleres Domínguez": "industry",
  "Villalobos Transportes": "industry", "Quiroga Agroindustrias": "industry",

  "Grupo Peimy": "tech", "Bravo Seguridad Digital": "tech",
  "Aguilar Marketing": "tech", "Vantage Analytics": "tech",
  "Studio Brecht": "tech", "Clearwater Studio": "tech",

  "Colectivo Raíz": "ngo",
}

const TESTIMONIALS = {
  school: {
    es: [
      "Llegamos con tres sistemas que no se hablaban entre sí: control escolar, cobranza y la lista de asistencia en papel. En dos meses quedó un solo tablero. Lo que más agradezco es que nos explicaron el porqué de cada decisión, no sólo el cómo.",
      "El diagnóstico fue incómodo de leer, y por eso sirvió. Nos señaló que el problema no era el software sino que nadie era responsable de los datos. Cambiamos eso primero y el resto salió solo.",
      "Inscripciones pasaron de cuatro días de captura manual a una tarde. La dirección pudo por fin presentar cifras al consejo sin pedirle a nadie que se quedara el sábado.",
      "Trabajaron con nuestro calendario escolar, no contra él. Nada se tocó en periodo de exámenes, y la capacitación se dio en la semana de consejo técnico. Eso vale tanto como el sistema.",
      "El material está escrito para directoras, no para ingenieros. Lo pude compartir con mi equipo administrativo sin traducir nada.",
      "Buen acompañamiento. Nos hubiera gustado un ejemplo más para escuelas de un solo plantel; el nuestro es mucho más chico que los casos del documento.",
      "Nos ayudó a ordenar el expediente digital antes de la visita de supervisión. Llegamos con todo documentado por primera vez en años.",
    ],
    en: [
      "We came in with three systems that did not talk to each other and a spreadsheet nobody trusted. Ten weeks later there is one dashboard the leadership team actually opens. The reasoning behind each decision was explained, not just the steps.",
      "The audit told us plainly that our problem was ownership, not tooling. That was not what we wanted to hear and it was the right answer.",
      "Enrolment went from four days of manual entry to a single afternoon. Our bursar got her term-end weekends back.",
      "The work was scheduled around our academic calendar — nothing touched during exams, training delivered in the inset week. That planning mattered as much as the build.",
      "Written for school leaders rather than IT staff. I passed it to my administrative team without having to translate anything.",
      "Solid engagement. I would have liked one more worked example for single-site schools; ours is far smaller than the cases in the pack.",
    ],
  },
  professional: {
    es: [
      "Facturamos CFDI para ciento veinte clientes y llevábamos el control en hojas de cálculo. Ahora el timbrado, el seguimiento de pagos y los recordatorios salen de un solo lugar. Recuperamos como dos días al mes por persona.",
      "Lo que me convenció fue que no intentaron venderme un sistema más grande del que necesito. Nos dijeron que dos de los módulos que pedí no valían la pena todavía.",
      "El despacho por fin tiene un portal donde el cliente sube su documentación sin mandarnos WhatsApps a las once de la noche. Eso solo ya cambió el ambiente de trabajo.",
      "Puntual y ordenado. Cada entrega vino con su acta y su video corto de cómo usarlo, así que cuando entró personal nuevo no hubo que volver a explicar todo.",
      "El trabajo está bien hecho. La curva de aprendizaje del primer mes fue más pesada de lo que esperábamos y hubiera ayudado una sesión extra de capacitación.",
      "Nos migraron el expediente de quince años sin perder un solo documento. Verificamos por muestreo y no encontramos diferencias.",
    ],
    en: [
      "We were invoicing a hundred and twenty clients out of spreadsheets. Billing, payment tracking and reminders now run from one place and we got back roughly two days a month per person.",
      "What convinced me was being told that two of the modules I asked for were not worth building yet. That is not the usual sales conversation.",
      "Clients now upload their documents through a portal instead of messaging us at eleven at night. That alone changed how the office feels.",
      "Every handover came with a short walkthrough video, so onboarding a new associate did not mean explaining everything again.",
      "Good work overall. The first month's learning curve was steeper than we expected and an extra training session would have helped.",
    ],
  },
  retail: {
    es: [
      "Tenemos inventario en dos sucursales y nunca cuadraba. Ahora el conteo se sincroniza solo y dejamos de vender cosas que ya no había en piso. Eso nos quitó muchas llamadas incómodas.",
      "La tienda en línea quedó lista antes del Buen Fin y aguantó sin caerse. Para nosotros esa era la única prueba que importaba.",
      "Nos explicaron con números por qué no nos convenía todavía la app móvil. Preferí eso a que me la vendieran.",
      "Sencillo de usar para el personal de mostrador, que era mi mayor duda. Mi encargada lo aprendió en una mañana.",
      "Buen resultado. La parte de reportes se siente todavía básica para lo que necesitamos, pero cumple.",
      "Pasamos de anotar pedidos en libreta a tener historial por cliente. Ahora sabemos quién nos compra seguido y quién dejó de venir.",
    ],
    en: [
      "We run stock across two locations and the counts never matched. They sync on their own now and we stopped selling things that were not on the floor.",
      "The store was live before our peak season and it held up under the traffic. That was the only test that mattered to us.",
      "They talked me out of a mobile app with actual numbers rather than selling me one.",
      "Simple enough for counter staff, which was my main worry. My manager picked it up in a morning.",
      "Good outcome. The reporting still feels basic for what we need, but it does the job.",
    ],
  },
  industry: {
    es: [
      "Coordinamos cuarenta unidades y el seguimiento vivía en el teléfono del despachador. Ahora hay un tablero que ve toda la operación y las entregas tardías bajaron de forma notoria en el primer trimestre.",
      "El levantamiento fue en piso, con el personal de taller, no en una sala de juntas. Se nota en el resultado: el sistema se parece a cómo sí trabajamos.",
      "Documentaron todo antes de irse, incluyendo qué hacer cuando algo falla. No quedamos dependiendo de una sola persona.",
      "El sistema jala bien. Lo único es que la conexión en la bodega sigue siendo nuestro cuello de botella y eso ya nos toca a nosotros resolverlo.",
      "Cotizaciones que tardaban dos días ahora salen el mismo día. En nuestro giro eso decide quién se queda el pedido.",
    ],
    en: [
      "We coordinate forty vehicles and tracking lived on the dispatcher's phone. There is a dashboard now covering the whole operation, and late deliveries dropped noticeably in the first quarter.",
      "The discovery work happened on the shop floor with the crew, not in a meeting room. You can see it in the result.",
      "Everything was documented before they left, including what to do when something breaks. We are not dependent on one person.",
      "Works well. Our warehouse connectivity is still the bottleneck, and that one is on us.",
    ],
  },
  tech: {
    es: [
      "Los contratamos para lo que no queríamos hacer nosotros: ordenar la infraestructura y dejarla documentada. Cumplieron y no intentaron quedarse a vivir en el proyecto.",
      "El equipo entendió nuestro stack sin necesidad de tres semanas de contexto. Eso se agradece cuando pagas por hora.",
      "La revisión de seguridad encontró dos cosas que llevábamos dos años ignorando. Ninguna era exótica, y ese es justo el punto.",
      "Automatizamos el reporte mensual que nos comía un día completo. Ahora se genera solo y nadie lo extraña.",
      "Trabajo correcto y bien comunicado. Los tiempos se recorrieron una semana, avisado con anticipación.",
    ],
    en: [
      "We hired them for the part we did not want to do ourselves: tidy the infrastructure and document it. They did, and they did not try to live in the project afterwards.",
      "The team understood our stack without three weeks of context. That matters when you are paying hourly.",
      "The security review found two things we had been ignoring for two years. Neither was exotic, which is rather the point.",
      "We automated a monthly report that used to eat a full day. Nobody misses it.",
      "Correct work, well communicated. Timelines slipped by a week, flagged well in advance.",
    ],
  },
  ngo: {
    es: [
      "Trabajamos con presupuesto de donativos, así que cada peso se justifica. Nos ayudaron a priorizar lo mínimo indispensable y a dejar el resto documentado para cuando haya recursos.",
      "Nos entregaron el reporte de impacto en un formato que sí pudimos mandar a los financiadores sin rehacerlo.",
      "Buen trabajo y mucha paciencia con nuestro equipo, que es voluntario y rota bastante.",
    ],
    en: [
      "We run on grant money, so every peso has to be justified. They helped us scope the minimum and documented the rest for when funding allows.",
      "The impact report came in a format we could actually send to funders without rebuilding it.",
      "Good work, and real patience with a volunteer team that turns over often.",
    ],
  },
}

const TIMEZONES = {
  MX: "America/Mexico_City", CO: "America/Bogota", AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",    PE: "America/Lima",   TR: "Europe/Istanbul",
  RW: "Africa/Kigali",       GB: "Europe/London",  IE: "Europe/Dublin",
  CA: "America/Toronto",     US: "America/Chicago", DE: "Europe/Berlin",
}

/* SECTOR_BY_COMPANY is keyed by the exact company strings in PEOPLE, so a
 * rename in one and not the other would silently fall back to "professional"
 * and quietly give a school a bookkeeping testimonial. Fail loudly instead —
 * a seed that lies about what it produced is worse than one that stops. */
function assertSectorsCoverPeople() {
  const missing = PEOPLE.map((p) => p.company).filter((c) => !SECTOR_BY_COMPANY[c])
  if (missing.length) {
    throw new Error(
      `demo-seed: SECTOR_BY_COMPANY is missing ${missing.length} company/companies ` +
      `present in PEOPLE: ${[...new Set(missing)].join(", ")}`
    )
  }
}

function emailFor(name, index) {
  const local = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .split(".")
    .slice(0, 2)
    .join(".")
  return `${local}${index}@${DEMO_DOMAIN}`
}

/* ────────────────────────────────────────────────────────────────────────────
 * Purge. Order matters and is not intuitive:
 *   - Payment.userId is onDelete: Restrict, so payments must go before users.
 *   - Order.userId is onDelete: SetNull, so orders do NOT cascade from a user
 *     delete; leaving them would orphan a year of revenue in the dashboards.
 * Everything else (items, invoices, refunds, downloads, service orders,
 * projects, milestones, messages) cascades from Order / User once those two
 * are handled.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Product.rating / reviewCount are denormalised columns, so they do not follow
 * the reviews they summarise. Both writing AND deleting demo reviews has to
 * resync them: seeding without this leaves the storefront's stars disagreeing
 * with the reviews printed underneath them, and purging without it leaves
 * products advertising "4.25 from 4 reviews" when zero reviews exist.
 * Recomputed from the table rather than adjusted incrementally — a counter
 * that drifts is the whole failure mode being avoided here.
 */
async function syncProductRatings() {
  const products = await prisma.product.findMany({ select: { id: true } })
  let updated = 0
  for (const { id } of products) {
    const agg = await prisma.review.aggregate({
      where:  { productId: id, status: "approved" },
      _avg:   { rating: true },
      _count: { _all: true },
    })
    const rating = Number((agg._avg.rating || 0).toFixed(2))
    const reviewCount = agg._count._all
    const res = await prisma.product.updateMany({
      where: { id, OR: [{ rating: { not: rating } }, { reviewCount: { not: reviewCount } }] },
      data:  { rating, reviewCount },
    })
    updated += res.count
  }
  return updated
}

async function purge() {
  const users = await prisma.user.findMany({
    where:  { email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true },
  })
  const ids = users.map((u) => u.id)
  const tally = {}
  const run = async (label, fn) => {
    const res = await fn()
    if (res?.count) tally[label] = res.count
  }

  if (ids.length) {
    const byUser = { userId: { in: ids } }
    await run("refunds",       () => prisma.refund.deleteMany({ where: { order: byUser } }))
    await run("payments",      () => prisma.payment.deleteMany({ where: byUser }))
    await run("carts",         () => prisma.cart.deleteMany({ where: byUser }))
    await run("orders",        () => prisma.order.deleteMany({ where: byUser }))
    await run("consultations", () => prisma.consultation.deleteMany({ where: byUser }))
    await run("projects",      () => prisma.clientProject.deleteMany({ where: byUser }))
    await run("tickets",       () => prisma.supportTicket.deleteMany({ where: byUser }))
    await run("reviews",       () => prisma.review.deleteMany({ where: byUser }))
    await run("notifications", () => prisma.notification.deleteMany({ where: byUser }))
    await run("users",         () => prisma.user.deleteMany({ where: { id: { in: ids } } }))
  }

  await run("subscribers", () => prisma.newsletterSubscriber.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } }))
  await run("contacts",    () => prisma.contactMessage.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } }))
  await run("diagnostics", () => prisma.diagnosticSubmission.deleteMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } }))
  await run("coupons",     () => prisma.coupon.deleteMany({ where: { code: { startsWith: "DEMO" } } }))
  await run("pageViews",   () => prisma.pageView.deleteMany({ where: { uaHash: "demo-seed" } }))
  await run("events",      () => prisma.analyticsEvent.deleteMany({ where: { sessionHash: { startsWith: "demo-" } } }))

  // DailyMetric has no free column to mark, and one row per date is the whole
  // point of its @@unique([date]) — so the seeded window is the marker.
  await run("dailyMetrics", () =>
    prisma.dailyMetric.deleteMany({ where: { date: { gte: atMidnightUtc(daysAgo(ANALYTICS_DAYS)) } } }))

  const resynced = await syncProductRatings()
  if (resynced) tally.productRatingsReset = resynced

  return tally
}

/* ────────────────────────────────────────────────────────────────────────────
 * Seed
 * ──────────────────────────────────────────────────────────────────────────── */

async function seedDemo() {
  assertSectorsCoverPeople()
  const stats = {}

  /* The catalogue is the input, not something this script invents — demo
   * orders must reference the same rows the storefront sells, or the admin
   * product pages show sales that belong to nothing. */
  const [products, services] = await Promise.all([
    prisma.product.findMany({
      where:  { status: "published", deletedAt: null },
      select: { id: true, title: true, slug: true, price: true, taxExempt: true, currency: true },
    }),
    prisma.service.findMany({
      where:  { status: "published", deletedAt: null },
      select: { id: true, title: true, slug: true, basePrice: true, taxExempt: true, isBookable: true },
    }),
  ])

  // A basePrice of 0 means "quote only" — four of the seeded services are
  // enquiry funnels, not products with a checkout price. Selling them here
  // produced MX$0 orders, which is not a thing a payment gateway can produce
  // and which drags the average-order-value tile toward nonsense.
  const sellableProducts = products.filter((p) => Number(p.price) > 0)
  const sellableServices = services.filter((s) => Number(s.basePrice) > 0)

  if (!sellableProducts.length && !sellableServices.length) {
    throw new Error(
      "No published products or services with a price above zero. Run the content seeds first:\n" +
      "  node prisma/seed/products-seed.js && node prisma/seed/services-seed.js"
    )
  }

  /* ── Admin ────────────────────────────────────────────────────────────── */
  // Reuse the real admin if one exists so consultations and projects are
  // assigned to the account you actually sign in with.
  const passwordHash = await bcrypt.hash("DemoPass!2026", 10)
  let admin = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        fullName: "Mustapha Ukizuru (demo admin)",
        email: `admin@${DEMO_DOMAIN}`,
        passwordHash,
        role: "admin",
        status: "active",
        emailVerifiedAt: daysAgo(400),
        createdAt: daysAgo(400),
      },
    })
    stats.adminCreated = 1
  }

  /* ── Customers ────────────────────────────────────────────────────────── */
  const customers = []
  for (let i = 0; i < COUNTS.customers; i += 1) {
    const person = PEOPLE[i % PEOPLE.length]
    const joined = daysAgo(randInt(20, 360), randInt(8, 20), randInt(0, 59))
    const user = await prisma.user.create({
      data: {
        fullName: person.name,
        email: emailFor(person.name, i + 1),
        passwordHash,
        role: "member",
        status: chance(0.06) ? "pending" : "active",
        company: person.company,
        phone: `+52 55 ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
        emailVerifiedAt: chance(0.92) ? addDays(joined, 0) : null,
        lastLoginAt: chance(0.8) ? daysAgo(randInt(0, 45), randInt(8, 22)) : null,
        createdAt: joined,
        profile: {
          create: {
            companyName: person.company,
            jobTitle: person.title,
            city: person.city,
            country: person.country,
            timezone: TIMEZONES[person.country] || "UTC",
            websiteUrl: `https://${person.company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.${DEMO_DOMAIN}`,
          },
        },
      },
    })
    customers.push({ ...user, person })
  }
  stats.customers = customers.length

  /* ── Coupons ──────────────────────────────────────────────────────────── */
  const coupons = []
  const COUPON_DEFS = [
    { code: "DEMOLAUNCH15", description: "Launch discount 15%",     discountType: "percentage", discountValue: 15, usageLimit: 100, maxUsesPerUser: 1 },
    { code: "DEMOEDU20",    description: "Education sector 20%",    discountType: "percentage", discountValue: 20, usageLimit: 50,  maxUsesPerUser: 1 },
    { code: "DEMOMX500",    description: "MX$500 off orders 3000+", discountType: "fixed",      discountValue: 500, usageLimit: 40, maxUsesPerUser: 1, minOrderAmount: 3000 },
    { code: "DEMOEXPIRED",  description: "Expired — proves the guard", discountType: "percentage", discountValue: 25, usageLimit: 10, maxUsesPerUser: 1, expiresAt: daysAgo(30) },
  ]
  for (const def of COUPON_DEFS) {
    coupons.push(await prisma.coupon.create({
      data: { ...def, startsAt: daysAgo(365), isActive: def.code !== "DEMOEXPIRED", createdAt: daysAgo(365) },
    }))
  }
  const liveCoupons = coupons.filter((c) => c.isActive)
  stats.coupons = coupons.length

  /* ── Orders ───────────────────────────────────────────────────────────── */
  // Status mix as a shuffled deck rather than per-order dice, so the totals
  // are exact: a dashboard showing "6 refunds" is testing 6 refunds.
  const statusDeck = shuffle([
    ...Array(88).fill("paid"),
    ...Array(6).fill("refunded"),
    ...Array(10).fill("pending"),
    ...Array(8).fill("failed"),
    ...Array(8).fill("cancelled"),
  ]).slice(0, COUNTS.orders)

  // Invoice numbering continues the real sequence rather than restarting at 1,
  // so a demo run on a database that already has invoices cannot collide.
  const invoiceCounters = new Map()
  async function nextInvoiceNumber(year) {
    if (!invoiceCounters.has(year)) {
      const prefix = `INV-${year}-`
      const last = await prisma.invoice.findFirst({
        where:   { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: "desc" },
        select:  { invoiceNumber: true },
      })
      const parsed = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) : 0
      invoiceCounters.set(year, Number.isFinite(parsed) ? parsed : 0)
    }
    const next = invoiceCounters.get(year) + 1
    invoiceCounters.set(year, next)
    return `INV-${year}-${String(next).padStart(5, "0")}`
  }

  const orders = []
  let txCounter = 1

  for (let i = 0; i < COUNTS.orders; i += 1) {
    const status = statusDeck[i]
    const customer = pick(customers)
    // Recency-weighted: pow > 1 pushes the mass toward day 0, which is what a
    // business that is growing actually looks like on a 12-month chart.
    const placedAt = daysAgo(Math.floor(365 * Math.pow(rng(), 1.7)), randInt(7, 22), randInt(0, 59))

    // Services are the bigger, rarer sale; products are the volume.
    const wantsService = sellableServices.length > 0 && chance(0.32)
    const lines = []
    if (wantsService) {
      const svc = pick(sellableServices)
      lines.push({
        itemType: "service",
        serviceId: svc.id,
        title: svc.title,
        unitPrice: Number(svc.basePrice),
        quantity: 1,
        taxExempt: svc.taxExempt,
      })
    }
    const productCount = wantsService ? randInt(0, 1) : randInt(1, 3)
    for (const p of shuffle(sellableProducts).slice(0, productCount)) {
      const quantity = chance(0.15) ? 2 : 1
      lines.push({
        itemType: "product",
        productId: p.id,
        title: p.title,
        unitPrice: Number(p.price),
        quantity,
        taxExempt: p.taxExempt,
      })
    }
    if (!lines.length) continue

    for (const l of lines) l.lineTotal = Number((l.unitPrice * l.quantity).toFixed(2))
    const subtotal = Number(lines.reduce((s, l) => s + l.lineTotal, 0).toFixed(2))

    // ~22% of orders carry a coupon, and only ones that actually qualify —
    // a seeded order that violates the coupon rules would make the checkout
    // validation look broken when it is not.
    let coupon = null
    let discount = 0
    if (liveCoupons.length && chance(0.22)) {
      const candidate = pick(liveCoupons)
      const min = candidate.minOrderAmount ? Number(candidate.minOrderAmount) : 0
      if (subtotal >= min) {
        coupon = candidate
        discount = candidate.discountType === "percentage"
          ? Number((subtotal * (Number(candidate.discountValue) / 100)).toFixed(2))
          : Math.min(Number(candidate.discountValue), subtotal)
      }
    }

    const tax = computeOrderTax({ items: lines, discount })
    const total = Number((subtotal - discount).toFixed(2))
    const paid = status === "paid" || status === "refunded"
    const paidAt = paid ? addMinutes(placedAt, randInt(1, 40)) : null

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${placedAt.getUTCFullYear()}${String(placedAt.getUTCMonth() + 1).padStart(2, "0")}${String(placedAt.getUTCDate()).padStart(2, "0")}-D${String(i + 1).padStart(5, "0")}`,
        userId: customer.id,
        customerName: customer.fullName,
        customerEmail: customer.email,
        billingName: customer.fullName,
        billingEmail: customer.email,
        billingCompany: customer.person.company,
        billingCountry: customer.person.country,
        billingCity: customer.person.city,
        status,
        subtotalAmount: subtotal,
        discountAmount: discount,
        taxRate: tax.taxRate,
        taxAmount: tax.taxAmount,
        taxIncluded: true,
        totalAmount: total,
        currency: "MXN",
        couponId: coupon?.id || null,
        termsAcceptedAt: placedAt,
        paidAt,
        notes: `${DEMO_TAG} generated order`,
        createdAt: placedAt,
        items: {
          create: lines.map((l) => ({
            itemType: l.itemType,
            productId: l.productId || null,
            serviceId: l.serviceId || null,
            title: l.title,
            titleSnapshot: l.title,
            price: l.unitPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
            licenseTier: l.itemType === "product" ? pick(["single", "team", "extended"]) : null,
            createdAt: placedAt,
          })),
        },
      },
      include: { items: true },
    })

    if (coupon) {
      await prisma.couponUsage.create({
        data: { couponId: coupon.id, userId: customer.id, orderId: order.id, usedAt: placedAt },
      })
      await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })
    }

    // Payment — one per order, on the gateway the market would actually use.
    const gateway = customer.person.country === "MX" ? (chance(0.8) ? "mercadopago" : "paypal") : (chance(0.75) ? "paypal" : "mercadopago")
    const paymentStatus = status === "refunded" ? "refunded" : (status === "paid" ? "paid" : (status === "failed" ? "failed" : (status === "cancelled" ? "cancelled" : "pending")))
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        userId: customer.id,
        paymentGateway: gateway,
        gatewayTransactionId: `demo-${gateway}-${String(txCounter++).padStart(6, "0")}`,
        amount: total,
        currency: "MXN",
        paymentStatus,
        failureReason: status === "failed" ? pick([
          "Insufficient funds",
          "Card declined by issuer",
          "3-D Secure authentication abandoned",
        ]) : null,
        paidAt,
        createdAt: placedAt,
      },
    })

    if (paid) {
      const year = placedAt.getUTCFullYear()
      await prisma.invoice.create({
        data: {
          orderId: order.id,
          invoiceNumber: await nextInvoiceNumber(year),
          status: "paid",
          issuedAt: paidAt,
          paidAt,
          serie: "A",
          currency: "MXN",
          subtotalAmount: Number((total - tax.taxAmount).toFixed(2)),
          taxRate: tax.taxRate,
          taxAmount: tax.taxAmount,
          totalAmount: total,
        },
      })

      // Entitlements for downloadable products — the member dashboard's
      // Downloads tab is empty without these even when orders exist.
      for (const item of order.items.filter((it) => it.productId)) {
        const downloadCount = randInt(0, 4)
        const lastDownloadedAt = downloadCount ? addDays(paidAt, randInt(0, 20)) : null
        const entitlement = await prisma.userDownload.create({
          data: {
            userId: customer.id,
            productId: item.productId,
            orderId: order.id,
            orderItemId: item.id,
            downloadAccessStatus: status === "refunded" ? "revoked" : "active",
            downloadLimit: 10,
            downloadCount,
            lastDownloadedAt,
            createdAt: paidAt,
          },
        })

        // DownloadLog is a separate table, and it is the one the admin
        // dashboard's "downloads" tile counts — an entitlement carrying
        // downloadCount: 3 with no log rows shows up there as zero. One log
        // per counted download, the last of them landing on lastDownloadedAt
        // so the entitlement and its history cannot disagree.
        for (let n = 0; n < downloadCount; n += 1) {
          await prisma.downloadLog.create({
            data: {
              userId: customer.id,
              productId: item.productId,
              orderId: order.id,
              userDownloadId: entitlement.id,
              userAgent: pick([
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.5",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/17.5",
                "Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0",
              ]),
              ipAddress: `189.${randInt(100, 250)}.${randInt(0, 255)}.${randInt(1, 254)}`,
              createdAt: n === downloadCount - 1 ? lastDownloadedAt : addDays(paidAt, randInt(0, 20)),
            },
          })
        }
      }

      // Service purchases open a delivery record; that is what feeds
      // Admin -> Service Orders and, below, the client projects.
      for (const item of order.items.filter((it) => it.serviceId)) {
        const age = Math.round((NOW - placedAt) / DAY)
        const soStatus = status === "refunded" ? "cancelled"
          : age > 120 ? "completed"
          : age > 30 ? pick(["active", "active", "completed", "on_hold"])
          : "new"
        await prisma.serviceOrder.create({
          data: {
            orderId: order.id,
            orderItemId: item.id,
            userId: customer.id,
            serviceId: item.serviceId,
            status: soStatus,
            startDate: addDays(placedAt, randInt(2, 10)),
            endDate: soStatus === "completed" ? addDays(placedAt, randInt(45, 110)) : null,
            notes: `${DEMO_TAG} delivery record`,
            createdAt: placedAt,
          },
        })
      }
    }

    if (status === "refunded") {
      const refundedAt = addDays(paidAt, randInt(3, 25))
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          orderId: order.id,
          amount: total, // full refunds only — a business rule, not a shortcut
          reason: pick([
            "Customer requested cancellation within the guarantee window.",
            "Duplicate purchase — the same toolkit was bought twice.",
            "Scope changed before kickoff; refunded in full.",
          ]),
          refundStatus: "succeeded",
          gatewayRefundId: `demo-refund-${String(txCounter++).padStart(6, "0")}`,
          processedAt: refundedAt,
          createdAt: refundedAt,
        },
      })
    }

    orders.push({ ...order, placedAt, status, total, customer })
  }
  stats.orders = orders.length
  stats.paidOrders = orders.filter((o) => o.status === "paid").length

  /* ── Carts ────────────────────────────────────────────────────────────── */
  // Abandoned carts drive the recovery job and the funnel's drop-off step;
  // with none, that whole panel reads as a bug.
  let cartCount = 0
  for (let i = 0; i < COUNTS.abandonedCarts + COUNTS.activeCarts; i += 1) {
    const abandoned = i < COUNTS.abandonedCarts
    const customer = pick(customers)
    const when = daysAgo(abandoned ? randInt(3, 40) : randInt(0, 2), randInt(9, 21))
    const chosen = shuffle(sellableProducts).slice(0, randInt(1, 3))
    if (!chosen.length) break
    await prisma.cart.create({
      data: {
        userId: customer.id,
        status: abandoned ? "abandoned" : "active",
        createdAt: when,
        updatedAt: when,
        items: {
          create: chosen.map((p) => ({
            itemType: "product",
            productId: p.id,
            titleSnapshot: p.title,
            priceSnapshot: Number(p.price),
            quantity: 1,
            createdAt: when,
            updatedAt: when,
          })),
        },
      },
    })
    cartCount += 1
  }
  stats.carts = cartCount

  /* ── Consultations ────────────────────────────────────────────────────── */
  // @@unique([assignedAdminId, scheduledAt]) is a real collision risk here:
  // every booking shares one host, so slots are tracked and never reused.
  const bookable = services.filter((s) => s.isBookable)
  const slotPool = bookable.length ? bookable : services
  const usedSlots = new Set()
  const consultations = []

  for (let i = 0; i < COUNTS.consultations; i += 1) {
    const past = i < Math.round(COUNTS.consultations * 0.68)
    let scheduledAt = null
    for (let attempt = 0; attempt < 50 && !scheduledAt; attempt += 1) {
      const offset = past ? -randInt(1, 150) : randInt(1, 45)
      const candidate = daysAgo(-offset, randInt(9, 17), pick([0, 30]))
      const day = candidate.getUTCDay()
      if (day === 0 || day === 6) continue // weekends are not offered
      const key = candidate.toISOString()
      if (usedSlots.has(key)) continue
      usedSlots.add(key)
      scheduledAt = candidate
    }
    if (!scheduledAt) continue

    const customer = pick(customers)
    const service = slotPool.length ? pick(slotPool) : null
    const durationMin = pick([30, 45, 60])
    const status = past
      ? pick(["completed", "completed", "completed", "no_show", "cancelled"])
      : pick(["confirmed", "confirmed", "pending"])

    const consultation = await prisma.consultation.create({
      data: {
        serviceId: service?.id || null,
        userId: customer.id,
        assignedAdminId: admin.id,
        scheduledAt,
        endsAt: addMinutes(scheduledAt, durationMin),
        durationMin,
        timezone: TIMEZONES[customer.person.country] || "UTC",
        // Meet links come only from Google Calendar; a demo row has no real
        // event, so the provider stays "manual" rather than faking a Meet URL.
        meetingProvider: "manual",
        meetingLink: null,
        status,
        clientNotes: pick([
          "We want to consolidate three separate school systems into one platform.",
          "Looking for help scoping an IT audit before the next budget cycle.",
          "Our website is slow and we do not know where to start.",
          "Need to automate the monthly reporting our team does by hand.",
          "Evaluating whether to migrate to the cloud this year or next.",
        ]),
        summaryNotes: status === "completed"
          ? pick([
            "Agreed on a two-phase scope. Proposal to follow within the week.",
            "Mapped current stack; main blocker is the legacy attendance system.",
            "Client will confirm budget internally before we quote.",
          ])
          : null,
        cancellationReason: status === "cancelled" ? "Client rescheduled internally and did not rebook." : null,
        cancelledAt: status === "cancelled" ? addDays(scheduledAt, -1) : null,
        confirmedAt: ["confirmed", "completed", "no_show"].includes(status) ? addDays(scheduledAt, -3) : null,
        completedAt: status === "completed" ? addMinutes(scheduledAt, durationMin) : null,
        createdAt: addDays(scheduledAt, -randInt(3, 21)),
      },
    })
    consultations.push(consultation)
  }
  stats.consultations = consultations.length

  /* ── Client projects ──────────────────────────────────────────────────── */
  // Anchored to real ServiceOrders (serviceOrderId is @unique) so the portal,
  // the order and the invoice all describe the same engagement.
  const anchors = await prisma.serviceOrder.findMany({
    // `{ is: null }`, not a bare `null` — Prisma rejects the shorthand on a
    // to-one back-relation filter.
    where:   { clientProject: { is: null }, notes: { contains: DEMO_TAG } },
    orderBy: { createdAt: "asc" },
    include: { service: { select: { title: true } } },
    take:    COUNTS.projects,
  })

  const MILESTONES = [
    "Discovery & stakeholder interviews",
    "Current-state audit and findings",
    "Architecture & roadmap sign-off",
    "Build — phase one",
    "Build — phase two",
    "Training & handover",
  ]

  let projectCount = 0
  for (const so of anchors) {
    const start = so.startDate || addDays(so.createdAt, 5)
    const projectStatus = so.status === "completed" ? "completed"
      : so.status === "cancelled" ? "cancelled"
      : so.status === "on_hold" ? "review"
      : pick(["planning", "in_progress", "in_progress", "review"])
    const closed = ["completed", "cancelled"].includes(projectStatus)

    const project = await prisma.clientProject.create({
      data: {
        serviceOrderId: so.id,
        userId: so.userId,
        assignedAdminId: admin.id,
        projectName: `${so.service?.title || "Engagement"} — ${(customers.find((c) => c.id === so.userId)?.person.company) || "Client"}`,
        projectStatus,
        startDate: start,
        dueDate: addDays(start, randInt(45, 120)),
        description: "Scoped from the signed proposal. Milestones mirror the statement of work.",
        closedAt: closed ? addDays(start, randInt(60, 130)) : null,
        requiresNda: chance(0.3),
        ndaVersion: "v1",
        accessState: "active",
        createdAt: so.createdAt,
      },
    })

    const count = randInt(4, 6)
    const milestoneRows = []
    for (let m = 0; m < count; m += 1) {
      // Progress runs front-to-back: earlier milestones are further along,
      // which is what makes a progress bar meaningful in a screenshot.
      const doneThrough = projectStatus === "completed" ? count : Math.floor(count * rand(0.25, 0.75))
      const mStatus = m < doneThrough ? "completed"
        : m === doneThrough ? pick(["in_progress", "awaiting_client"])
        : "pending"
      // One roll, not two: approvedAt and approvedById must agree, or the
      // portal shows an approval with nobody attached to it.
      const approved = mStatus === "completed" && chance(0.7)
      milestoneRows.push(await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          title: MILESTONES[m % MILESTONES.length],
          description: "Deliverables and acceptance criteria as agreed in the SOW.",
          status: mStatus,
          dueDate: addDays(start, (m + 1) * randInt(10, 18)),
          completedAt: mStatus === "completed" ? addDays(start, (m + 1) * 14) : null,
          approvedAt: approved ? addDays(start, (m + 1) * 14 + 1) : null,
          approvedById: approved ? so.userId : null,
          sortOrder: m,
        },
      }))
    }

    for (let c = 0; c < randInt(3, 7); c += 1) {
      const fromClient = chance(0.5)
      await prisma.projectComment.create({
        data: {
          projectId: project.id,
          milestoneId: chance(0.6) ? pick(milestoneRows).id : null,
          authorId: fromClient ? so.userId : admin.id,
          authorRole: fromClient ? "client" : "admin",
          body: fromClient
            ? pick([
              "This looks good to us — approved from our side.",
              "Can we push the training session to the following week?",
              "Our finance team needs the invoice addressed to the parent company.",
              "One correction: the campus count is 3, not 2.",
            ])
            : pick([
              "Phase one is deployed to staging. Link is in the files tab.",
              "Blocked on the DNS access we requested last Thursday.",
              "Updated the roadmap to reflect the scope change we discussed.",
              "Handover pack is drafted; sending for review tomorrow.",
            ]),
          resolvedAt: chance(0.4) ? addDays(start, randInt(5, 40)) : null,
          createdAt: addDays(start, randInt(1, 60)),
        },
      })
    }

    // Metadata only — no bytes are written to storage/. See the header note.
    for (let f = 0; f < randInt(2, 5); f += 1) {
      const name = pick([
        "discovery-notes.pdf", "current-state-audit.pdf", "roadmap-v2.pdf",
        "architecture-diagram.png", "training-deck.pdf", "handover-checklist.pdf",
      ])
      const byAdmin = chance(0.7) // one roll — id and role must describe the same person
      await prisma.projectFile.create({
        data: {
          projectId: project.id,
          uploadedById: byAdmin ? admin.id : so.userId,
          uploadedByRole: byAdmin ? "admin" : "client",
          milestoneId: chance(0.5) ? pick(milestoneRows).id : null,
          fileName: name,
          filePath: `demo/projects/${project.id}/${name}`,
          fileType: name.endsWith(".pdf") ? "application/pdf" : "image/png",
          fileSize: randInt(80_000, 4_500_000),
          isDeliverable: chance(0.4),
          createdAt: addDays(start, randInt(2, 70)),
        },
      })
    }
    projectCount += 1
  }
  stats.projects = projectCount

  /* ── Support tickets ──────────────────────────────────────────────────── */
  const TICKETS = [
    { subject: "Cannot download the toolkit after payment", category: "technical", priority: "high" },
    { subject: "Invoice needs our RFC and legal name",      category: "billing",   priority: "medium" },
    { subject: "Request refund — bought the wrong pack",    category: "refund_request", priority: "high" },
    { subject: "Can the checklist be provided in Spanish?", category: "feature_request", priority: "low" },
    { subject: "Login link expired before I could use it",  category: "technical", priority: "medium" },
    { subject: "Question about the team licence limits",    category: "general",   priority: "low" },
    { subject: "Reschedule our consultation for next week", category: "general",   priority: "medium" },
    { subject: "Coupon code was rejected at checkout",      category: "billing",   priority: "medium" },
  ]
  let ticketCount = 0
  for (let i = 0; i < COUNTS.tickets; i += 1) {
    const t = TICKETS[i % TICKETS.length]
    const customer = pick(customers)
    const openedAt = daysAgo(randInt(0, 180), randInt(8, 20), randInt(0, 59))
    const status = pick(["open", "in_progress", "resolved", "resolved", "closed"])
    const linkedOrder = t.category === "refund_request"
      ? orders.find((o) => o.customer.id === customer.id && o.status === "paid")
      : null

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: `DEMO-${String(i + 1).padStart(4, "0")}`,
        userId: customer.id,
        subject: t.subject,
        message: `${t.subject}. Sending the details so you have the full context — happy to jump on a call if that is faster.`,
        status,
        priority: t.priority,
        category: t.category,
        orderId: linkedOrder?.id || null,
        assignedAdminId: status === "open" ? null : admin.id,
        resolvedAt: ["resolved", "closed"].includes(status) ? addDays(openedAt, randInt(1, 6)) : null,
        closedAt: status === "closed" ? addDays(openedAt, randInt(3, 10)) : null,
        createdAt: openedAt,
      },
    })

    const replies = randInt(1, 4)
    for (let m = 0; m < replies; m += 1) {
      const fromAdmin = m % 2 === 0
      await prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: fromAdmin ? admin.id : customer.id,
          senderRole: fromAdmin ? "admin" : "member",
          message: fromAdmin
            ? pick([
              "Thanks for flagging this — looking into it now and will come back within the day.",
              "I have reissued the invoice with the fiscal details you sent.",
              "That link is regenerated and valid for 24 hours. Let me know if it still fails.",
            ])
            : pick([
              "Confirmed, that worked. Thank you.",
              "Still seeing the same error on my side.",
              "Perfect — no further questions.",
            ]),
          isRead: status !== "open",
          createdAt: addDays(openedAt, m + 1),
        },
      })
    }
    ticketCount += 1
  }
  stats.tickets = ticketCount

  /* ── Reviews ──────────────────────────────────────────────────────────── */
  // Pinned to a real OrderItem from a paid order, so every one is a genuine
  // verified purchase within the demo dataset rather than a free-floating
  // rating the anti-fake-review model is designed to reject.
  const reviewableItems = []
  for (const o of orders.filter((x) => x.status === "paid")) {
    for (const item of o.items) {
      if (item.productId || item.serviceId) reviewableItems.push({ order: o, item })
    }
  }

  // Quote selection: sector decides WHAT the client talks about, country
  // decides which language they say it in. A cursor per (sector, language)
  // walks each pool instead of picking at random, so two clients in the same
  // sector never end up with the same words — duplicate testimonials are the
  // single most obvious tell that a wall of proof was generated.
  // No quote is ever used twice. When a client's (sector, language) pool is
  // exhausted the candidate is SKIPPED rather than handed a repeat — there are
  // far more reviewable order items than the 36 reviews wanted, so skipping is
  // free, and a wall of proof containing the same sentence twice is the single
  // most obvious tell that it was generated.
  const usedQuotes = new Set()
  const quoteFor = (person) => {
    const sector = SECTOR_BY_COMPANY[person.company] || "professional"
    const lang = SPANISH_SPEAKING.has(person.country) ? "es" : "en"
    const pool = TESTIMONIALS[sector]?.[lang] || TESTIMONIALS.professional[lang]
    const text = pool.find((q) => !usedQuotes.has(q))
    if (!text) return null
    usedQuotes.add(text)
    return { text, sector, lang }
  }

  // Featuring happens in a SECOND PASS, after every review exists. Deciding it
  // inline cannot honour a quota: reserving the last slots for English
  // speakers blocks Spanish candidates, and if no qualifying English review
  // turns up afterwards the slots simply stay empty (that attempt produced 4
  // of 6). Curating from the finished set is the only way to guarantee both
  // the count and the mix.
  const FEATURED_TARGET = 6
  const FEATURED_MIN_EN = 2
  const created = []

  const ratingDeck = shuffle([
    ...Array(20).fill(5), ...Array(11).fill(4), ...Array(4).fill(3), ...Array(1).fill(2),
  ])
  let reviewCount = 0

  // Draw until the target is met rather than slicing first: a candidate whose
  // review date would land in the future is skipped, and slicing up front let
  // those skips silently shrink the dataset (36 asked for, 27 written).
  for (const { order, item } of shuffle(reviewableItems)) {
    if (reviewCount >= COUNTS.reviews) break
    const rating = ratingDeck[reviewCount % ratingDeck.length]
    const writtenAt = addDays(order.placedAt, randInt(4, 45))
    if (writtenAt > NOW) continue
    const status = chance(0.88) ? "approved" : pick(["pending", "flagged"])
    const replied = status === "approved" && chance(0.25)
    const person = order.customer.person
    const quote = quoteFor(person)
    if (!quote) continue // pool exhausted for this sector+language — take the next candidate
    const { text, sector, lang } = quote

    const row = await prisma.review.create({
      data: {
        subjectType: item.productId ? "product" : "service",
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        orderItemId: item.id,
        userId: order.customer.id,
        rating,
        reviewText: text,
        isVerifiedPurchase: true,
        status,
        helpfulCount: randInt(0, 14),
        // Replies answer the review rather than repeating one line under all
        // of them — a wall of identical admin responses reads as automated.
        adminReply: replied
          ? (SPANISH_SPEAKING.has(person.country)
            ? pick([
              "Gracias por el detalle. La siguiente revisión amplía los ejemplos para equipos chicos.",
              "Le agradecemos la retroalimentación. Ya agendamos la sesión extra de capacitación que menciona.",
              "Gracias. Tomamos nota del punto sobre reportes; está en el plan del próximo trimestre.",
            ])
            : pick([
              "Thank you for the detail — the next revision expands the small-team examples.",
              "Appreciated. We have scheduled the extra training session you mention.",
              "Noted on reporting; it is on the roadmap for next quarter.",
            ]))
          : null,
        adminReplyAt: replied ? addDays(writtenAt, 2) : null,
        adminReplyById: replied ? admin.id : null,
        createdAt: writtenAt,
      },
    })
    created.push({ id: row.id, rating, status, sector, lang })
    reviewCount += 1
  }

  // Curate the marquee: five-star approved reviews, one client per sector,
  // English first so the quota is met while slots remain, then the rest
  // (Spanish-dominant, matching the home market). featuredOrder is written
  // explicitly because reviewService sorts by it ascending — left null, the
  // running order would be MySQL's null ordering rather than a decision.
  const eligible = created.filter((r) => r.status === "approved" && r.rating === 5)
  const chosen = []
  const takenSectors = new Set()
  const take = (rows, limit) => {
    for (const r of rows) {
      if (chosen.length >= limit) break
      if (takenSectors.has(r.sector)) continue
      takenSectors.add(r.sector)
      chosen.push(r)
    }
  }
  take(eligible.filter((r) => r.lang === "en"), FEATURED_MIN_EN)
  take(eligible, FEATURED_TARGET)

  for (const [i, r] of chosen.entries()) {
    await prisma.review.update({
      where: { id: r.id },
      data:  { featured: true, featuredOrder: i },
    })
  }
  stats.featuredTestimonials = chosen.length

  await syncProductRatings()
  stats.reviews = reviewCount

  /* ── Newsletter ───────────────────────────────────────────────────────── */
  const subscriberRows = []
  for (let i = 0; i < COUNTS.subscribers; i += 1) {
    const person = PEOPLE[i % PEOPLE.length]
    const subscribedAt = daysAgo(randInt(0, 400), randInt(6, 23), randInt(0, 59))
    // Double opt-in is the business rule: pending rows exist and must be
    // excluded from campaign audiences, so the seed has to contain some.
    const status = chance(0.84) ? "subscribed" : (chance(0.6) ? "pending" : "unsubscribed")
    subscriberRows.push({
      email: `news.${i + 1}.${person.name.toLowerCase().split(" ")[0]}@${DEMO_DOMAIN}`,
      name: person.name,
      status,
      subscribedAt,
      unsubscribedAt: status === "unsubscribed" ? addDays(subscribedAt, randInt(10, 120)) : null,
      unsubscribeToken: `demo-unsub-${String(i + 1).padStart(5, "0")}`,
      source: pick(["footer", "blog-post", "lead-magnet", "checkout", "self-audit"]),
    })
  }
  await prisma.newsletterSubscriber.createMany({ data: subscriberRows })
  stats.subscribers = subscriberRows.length

  /* ── Contact messages ─────────────────────────────────────────────────── */
  const CONTACT_SUBJECTS = [
    "Quote for a school website rebuild",
    "Do you work with organisations outside Mexico?",
    "Availability for a Q3 infrastructure audit",
    "Question about the consulting session package",
    "Partnership enquiry",
    "Following up on the self-audit report",
  ]
  const contactRows = []
  for (let i = 0; i < COUNTS.contacts; i += 1) {
    const person = PEOPLE[(i * 3) % PEOPLE.length]
    const at = daysAgo(randInt(0, 200), randInt(7, 22), randInt(0, 59))
    const status = pick(["new", "read", "replied", "replied"])
    contactRows.push({
      name: person.name,
      email: `contact.${i + 1}@${DEMO_DOMAIN}`,
      phone: `+52 55 ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
      subject: CONTACT_SUBJECTS[i % CONTACT_SUBJECTS.length],
      message: "We are reviewing options for the coming budget cycle and would like to understand scope, timeline and cost before we commit internally.",
      status,
      repliedAt: status === "replied" ? addDays(at, randInt(1, 4)) : null,
      intent: pick(["plan", "proposal", "service", "general"]),
      audience: pick(["education", "business", "professional"]),
      tier: pick(["starter", "growth", "enterprise"]),
      source: pick(["contact-form", "footer", "services-page"]),
      locale: chance(0.65) ? "es" : "en",
      createdAt: at,
    })
  }
  await prisma.contactMessage.createMany({ data: contactRows })
  stats.contacts = contactRows.length

  /* ── Self-audit submissions ───────────────────────────────────────────── */
  const diagnosticRows = []
  for (let i = 0; i < COUNTS.diagnostics; i += 1) {
    const person = PEOPLE[(i * 5) % PEOPLE.length]
    const score = randInt(22, 88)
    const tier = score < 35 ? "Foundation" : score < 55 ? "Stabilizing" : score < 75 ? "Optimizing" : "Mature"
    const sections = {}
    for (const key of ["A", "B", "C", "D", "E"]) {
      const raw = randInt(4, 20)
      sections[key] = { pct: Math.round((raw / 20) * 100), raw, max: 20 }
    }
    diagnosticRows.push({
      name: person.name,
      email: `audit.${i + 1}@${DEMO_DOMAIN}`,
      organization: person.company,
      audience: pick(["EDU", "SMB", "IND"]),
      overallScore: score,
      tier,
      sectionScores: sections,
      scores: { "A.1": randInt(1, 4), "A.2": randInt(1, 4), "B.1": randInt(1, 4), "C.1": randInt(1, 4) },
      topPriorities: [
        { id: "P1", svc: "it-infrastructure", title: "Stabilise core infrastructure", score: randInt(1, 3), tier },
        { id: "P2", svc: "digital-transformation-consulting", title: "Document the operating model", score: randInt(1, 3), tier },
      ],
      matchedBundle: chance(0.6) ? pick(["Foundations Bundle", "Growth Bundle", "Modernisation Bundle"]) : null,
      emailSent: chance(0.85),
      createdAt: daysAgo(randInt(0, 150), randInt(8, 22), randInt(0, 59)),
    })
  }
  await prisma.diagnosticSubmission.createMany({ data: diagnosticRows })
  stats.diagnostics = diagnosticRows.length

  /* ── Notifications ────────────────────────────────────────────────────── */
  const notificationRows = []
  for (const o of orders.filter((x) => x.status === "paid").slice(0, 45)) {
    notificationRows.push({
      userId: o.customer.id,
      type: "order",
      title: "Your order is ready",
      message: `Order ${o.orderNumber} is confirmed and your downloads are available.`,
      isRead: chance(0.6),
      readAt: chance(0.6) ? addDays(o.placedAt, 1) : null,
      linkUrl: `/dashboard/orders/${o.id}`,
      createdAt: addMinutes(o.placedAt, 45),
    })
  }
  await prisma.notification.createMany({ data: notificationRows })
  stats.notifications = notificationRows.length

  /* ── Analytics ────────────────────────────────────────────────────────── */
  // PageView / AnalyticsEvent / DailyMetric are built in one pass so the
  // rollup is an aggregate of the rows above it, not an independent invention.
  // uaHash "demo-seed" and the "demo-" sessionHash prefix are the purge keys.
  const PATHS = [
    { path: "/",             weight: 26 },
    { path: "/services",     weight: 14 },
    { path: "/store",        weight: 12 },
    { path: "/about",        weight: 9 },
    { path: "/blog",         weight: 8 },
    { path: "/contact",      weight: 7 },
    { path: "/self-audit",   weight: 6 },
    { path: "/portfolio",    weight: 5 },
    { path: "/book",         weight: 5 },
    { path: "/privacy",      weight: 2 },
    { path: "/terms",        weight: 2 },
  ]
  const pathDeck = PATHS.flatMap((p) => Array(p.weight).fill(p.path))

  // Product detail URLs are built from the real catalogue, not hardcoded.
  // analyticsService.getFunnel defines its FIRST step as a PageView whose
  // path startsWith "/store/" — deliberately excluding the store index, so
  // that step means intent. It is not an AnalyticsEvent, so no amount of
  // "view_item" events can widen it: an earlier version of this seed emitted
  // those and put a single hardcoded product URL in the traffic deck, which
  // left the funnel's top narrower than its second step and rendered a 169%
  // conversion rate in the admin chart.
  const productPaths = sellableProducts.map((p) => `/store/${p.slug}`)
  const COUNTRIES = ["MX", "MX", "MX", "MX", "CO", "AR", "US", "ES", "TR", "RW", "CL", "PE"]
  const DEVICES = ["mobile", "mobile", "mobile", "desktop", "desktop", "tablet"]
  const REFERRERS = [
    null, null, null,
    "https://www.google.com/",
    "https://www.linkedin.com/",
    "https://l.facebook.com/",
    "https://t.co/",
  ]

  const ordersByDay = new Map()
  for (const o of orders) {
    if (o.status !== "paid" && o.status !== "refunded") continue
    const key = atMidnightUtc(o.placedAt).toISOString()
    const bucket = ordersByDay.get(key) || []
    bucket.push(o)
    ordersByDay.set(key, bucket)
  }

  const pageViewRows = []
  const eventRows = []
  const dailyRows = []

  for (let d = ANALYTICS_DAYS - 1; d >= 0; d -= 1) {
    const day = daysAgo(d)
    const dow = day.getUTCDay()
    // Weekday-heavy traffic with a mild upward trend — a flat line would hide
    // exactly the seasonality the charts are supposed to show.
    const weekday = dow === 0 || dow === 6 ? 0.45 : 1
    const trend = 1 + ((ANALYTICS_DAYS - d) / ANALYTICS_DAYS) * 0.6

    const dayKey = atMidnightUtc(day).toISOString()
    const dayOrders = ordersByDay.get(dayKey) || []
    const revenue = dayOrders.reduce((s, o) => s + o.total, 0)

    // ── The funnel is built as NESTED SESSION SETS, widest first ───────────
    // analyticsService.getFunnel counts DISTINCT sessionHash per stage, so
    // independent per-stage draws produce impossible funnels — an earlier
    // version of this seed emitted more add_to_cart sessions than view_item
    // ones and the admin chart rendered a 149.7% step conversion rate.
    // Every stage here is a prefix of the session pool, so
    // purchase ⊆ checkout ⊆ cart ⊆ view holds by construction, and the
    // purchase set is pinned to the orders that actually exist that day.
    const purchaseSessions = dayOrders.length
    const checkoutSessions = purchaseSessions + randInt(2, 7)
    const cartSessions     = checkoutSessions + randInt(4, 12)
    const viewSessions     = cartSessions + randInt(10, 28)

    // Traffic has to be able to contain the funnel: a day cannot have more
    // product-viewing sessions than sessions.
    const baseViews = Math.round(rand(90, 170) * weekday * trend)
    const sessions = Math.max(6, Math.round(baseViews / rand(2.1, 3.4)), viewSessions + randInt(5, 40))
    // `viewSessions + sessions` in the floor guarantees the general-traffic
    // pass below still has at least one view per session id, so the day really
    // does contain `sessions` distinct sessions.
    const views = Math.max(12, baseViews, viewSessions + sessions, Math.round(sessions * rand(2.1, 3.4)))

    const sessionId = (i) => `demo-s${d}-${i}`
    const timeOfDay = () => new Date(day.getTime() - 12 * 3600_000 + randInt(6 * 3600, 23 * 3600) * 1000)
    const pathTally = new Map()
    const addView = (path, sessionIdx) => {
      pathTally.set(path, (pathTally.get(path) || 0) + 1)
      pageViewRows.push({
        path,
        referrer: pick(REFERRERS),
        country: pick(COUNTRIES),
        device: pick(DEVICES),
        uaHash: "demo-seed",
        sessionHash: sessionId(sessionIdx),
        createdAt: timeOfDay(),
      })
    }

    // 1 · Every "viewer" session lands on a product detail page at least once.
    //     This is what actually forms the top of the funnel.
    for (let i = 0; i < viewSessions; i += 1) addView(pick(productPaths), i)

    // 2 · The rest of the day's traffic across the site. Modulo, not divide,
    //     so the ids used are exactly 0..sessions-1.
    for (let v = viewSessions; v < views; v += 1) addView(pick(pathDeck), v % sessions)

    const emitStage = (name, n, path) => {
      for (let i = 0; i < n; i += 1) {
        eventRows.push({
          name,
          path,
          amount: null,
          sessionHash: sessionId(i),
          createdAt: timeOfDay(),
          meta: { demo: true },
        })
      }
    }
    emitStage("view_item",      viewSessions,     "/store")
    emitStage("add_to_cart",    cartSessions,     "/store")
    emitStage("begin_checkout", checkoutSessions, "/checkout")

    // One purchase event per real order, carrying that order's id and amount —
    // so event revenue and order revenue are the same number by construction,
    // not two numbers that happen to be close.
    dayOrders.forEach((o, i) => {
      eventRows.push({
        name: "purchase",
        path: "/checkout/success",
        orderId: o.id,
        amount: Number(o.total.toFixed(2)),
        sessionHash: sessionId(i),
        createdAt: addMinutes(o.placedAt, 5),
        meta: { demo: true, orderNumber: o.orderNumber },
      })
    })

    if (chance(0.7)) {
      for (let i = 0; i < randInt(1, 3); i += 1) {
        eventRows.push({ name: "newsletter_subscribe", path: "/", amount: null, sessionHash: sessionId(randInt(0, sessions - 1)), createdAt: timeOfDay(), meta: { demo: true } })
      }
    }
    if (chance(0.4)) {
      eventRows.push({ name: "contact_submit", path: "/contact", amount: null, sessionHash: sessionId(randInt(0, sessions - 1)), createdAt: timeOfDay(), meta: { demo: true } })
    }

    const topPath = [...pathTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "/"
    dailyRows.push({
      date: atMidnightUtc(day),
      pageviews: views,
      sessions,
      // The rollup reports the same session counts the events encode, so the
      // KPI tiles and the funnel chart cannot tell different stories.
      addToCart: cartSessions,
      beginCheckout: checkoutSessions,
      purchases: purchaseSessions,
      revenue: Number(revenue.toFixed(2)),
      topPath,
    })
  }

  const chunked = async (rows, fn, size = 1000) => {
    for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size))
  }
  await chunked(pageViewRows, (batch) => prisma.pageView.createMany({ data: batch }))
  await chunked(eventRows,    (batch) => prisma.analyticsEvent.createMany({ data: batch }))
  // skipDuplicates: a re-run without --purge must not die on @@unique([date]).
  await prisma.dailyMetric.createMany({ data: dailyRows, skipDuplicates: true })

  stats.pageViews = pageViewRows.length
  stats.analyticsEvents = eventRows.length
  stats.dailyMetrics = dailyRows.length

  return stats
}

/* ────────────────────────────────────────────────────────────────────────── */

async function main() {
  assertLocalDatabase()
  // Before anything destructive. A seed run purges first, so a fixture error
  // caught inside seedDemo() would already have deleted the previous dataset
  // and then failed, leaving an empty database and nothing to show for it.
  assertSectorsCoverPeople()
  const wantsPurge = process.argv.includes("--purge")

  if (wantsPurge) {
    const removed = await purge()
    console.log("[demo-seed] purged:", Object.keys(removed).length ? removed : "nothing to remove")
    return
  }

  // Always purge first. Most of these tables have no natural key to upsert on
  // (there is no "the same order" to update), so a second run without this
  // would double the dataset and quietly break every count you are reading.
  const removed = await purge()
  if (Object.keys(removed).length) console.log("[demo-seed] cleared previous demo data:", removed)

  const stats = await seedDemo()
  console.log("[demo-seed] done:", stats)
  console.log(`[demo-seed] sign in as any customer with password: DemoPass!2026`)
  console.log(`[demo-seed] remove it all again with: npm run seed:demo -- --purge`)
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect()
      // src/lib/prisma runs a self-scheduling keepalive ping (added after the
      // 2026-08-28 engine outage). A ping already in flight lands after
      // $disconnect and logs "database unreachable", which makes a seed that
      // fully succeeded look like it failed on its last line. Exit explicitly
      // rather than waiting for that. The ping's timer is unref'd, so there is
      // nothing else holding the loop open.
      process.exit(0)
    })
    .catch(async (err) => {
      console.error("[demo-seed] failed:", err)
      await prisma.$disconnect()
      process.exit(1)
    })
}

module.exports = { seedDemo, purge, assertLocalDatabase, DEMO_DOMAIN, DEMO_TAG }
