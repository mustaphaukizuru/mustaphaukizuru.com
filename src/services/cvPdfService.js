// ─────────────────────────────────────────────────────────────────────────────
// cvPdfService.js — server-generated CV (Tier 3).
//
// Renders an A4 PDF from the Bio CMS rows (Experience · Education ·
// Certificate · Skill) so the three CVs linked from the About hero never
// drift from what the admin edits at /admin/bio. Same pdfkit structure as
// receiptPdfService.js: header band, sections, footer, Buffer out.
//
// Caching: the rendered file is written to STORAGE_PATHS.cv as
// `<track>-<lang>-<version>.pdf` where `version` is the max updatedAt across
// the four tables. Any admin edit bumps the version → a new file; an
// unchanged bio serves the cached bytes without touching pdfkit. The
// controller adds `Cache-Control: public, max-age=3600` on top.
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs")
const path = require("path")
const PDFDocument = require("pdfkit")

const prisma = require("../lib/prisma")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")
const { resolveTrack, resolveLang } = require("../config/cvTracks")

/* Same identity block as invoiceService.COMPANY / AboutHero. */
const PERSON = Object.freeze({
  name:     "Mustapha Ukizuru",
  email:    "hello@mustaphaukizuru.com",
  website:  "https://mustaphaukizuru.com",
  site:     "mustaphaukizuru.com",
  location: "Tlalnepantla de Baz, Estado de México, MX",
})

const COLORS = {
  violet:   "#5D3FD3",
  charcoal: "#1A1B23",
  muted:    "#3F4047",
  faint:    "#8C8D92",
  border:   "#E5E7EF",
}

const LABELS = {
  en: {
    summary: "Profile", experience: "Experience", education: "Education",
    certificates: "Certifications", skills: "Skills", present: "Present",
    generated: "Generated from the live profile at",
    categories: {
      frontend: "Front-end", backend: "Back-end", tools: "Tools",
      database: "Databases", cloud: "Cloud & DevOps", language: "Languages",
      soft_skill: "Professional skills",
    },
  },
  es: {
    summary: "Perfil", experience: "Experiencia", education: "Formación",
    certificates: "Certificaciones", skills: "Habilidades", present: "Actualidad",
    generated: "Generado desde el perfil en",
    categories: {
      frontend: "Front-end", backend: "Back-end", tools: "Herramientas",
      database: "Bases de datos", cloud: "Nube y DevOps", language: "Idiomas",
      soft_skill: "Habilidades profesionales",
    },
  },
}

const MARGIN = 56

/* ── data ──────────────────────────────────────────────────────────────── */

async function loadBio() {
  const [experience, education, certificates, skills] = await Promise.all([
    prisma.experience.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }],
    }),
    prisma.education.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }],
    }),
    prisma.certificate.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { issueDate: "desc" }],
    }),
    prisma.skill.findMany({
      where: { isVisible: true },
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    }),
  ])
  return { experience, education, certificates, skills }
}

/** Max updatedAt (ms) across the four bio tables — the cache version. */
async function bioVersion() {
  const rows = await Promise.all([
    prisma.experience.aggregate({ _max: { updatedAt: true } }),
    prisma.education.aggregate({ _max: { updatedAt: true } }),
    prisma.certificate.aggregate({ _max: { updatedAt: true } }),
    prisma.skill.aggregate({ _max: { updatedAt: true } }),
  ])
  const ts = rows
    .map((r) => (r && r._max && r._max.updatedAt ? new Date(r._max.updatedAt).getTime() : 0))
    .filter((n) => Number.isFinite(n))
  return Math.max(0, ...ts)
}

function cacheFileName(trackSlug, lang, version) {
  return `${trackSlug}-${lang}-${version}.pdf`
}

/* ── public API ────────────────────────────────────────────────────────── */

/**
 * getCvPdf({ lang, track }) → { buffer, fileName, version, cached, lang, track }
 * Serves from STORAGE_PATHS.cv when a file for this version exists,
 * otherwise renders, writes and returns the fresh bytes.
 */
async function getCvPdf({ lang: rawLang, track: rawTrack, outDir = STORAGE_PATHS.cv } = {}) {
  const lang    = resolveLang(rawLang)
  const track   = resolveTrack(rawTrack)
  const version = await bioVersion()
  const fileName = cacheFileName(track.slug, lang, version)
  const filePath = path.join(outDir, fileName)

  if (fs.existsSync(filePath)) {
    return { buffer: fs.readFileSync(filePath), fileName, version, cached: true, lang, track: track.slug }
  }

  const bio = await loadBio()
  const buffer = await renderCvPdf({ bio, lang, track })

  try {
    ensureDir(outDir)
    fs.writeFileSync(filePath, buffer)
  } catch {
    // A failed cache write is not an error — the caller still gets the bytes.
  }
  return { buffer, fileName, version, cached: false, lang, track: track.slug }
}

/* ── rendering ─────────────────────────────────────────────────────────── */

async function renderCvPdf({ bio, lang = "en", track }) {
  const L = LABELS[lang] || LABELS.en
  const title   = track.title[lang]   || track.title.en
  const summary = track.summary[lang] || track.summary.en

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title:    `${PERSON.name} — ${title}`,
      Author:   PERSON.name,
      Subject:  title,
      Producer: PERSON.site,
    },
  })

  const chunks = []
  doc.on("data", (c) => chunks.push(c))
  const done = new Promise((resolve, reject) => {
    doc.on("end", resolve)
    doc.on("error", reject)
  })

  const contentW = doc.page.width - MARGIN * 2

  /* ── header band ───────────────────────────────────────────────────── */
  doc.rect(0, 0, doc.page.width, 110).fill(COLORS.violet)
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text(PERSON.name, MARGIN, 30)
  doc.font("Helvetica").fontSize(12).opacity(0.9).text(title, MARGIN, 60).opacity(1)
  doc.font("Helvetica").fontSize(9).opacity(0.8)
     .text(`${PERSON.email}  ·  ${PERSON.site}  ·  ${PERSON.location}`, MARGIN, 84, { width: contentW })
     .opacity(1)

  doc.fillColor(COLORS.charcoal)
  doc.y = 134

  /* ── summary ───────────────────────────────────────────────────────── */
  sectionTitle(doc, L.summary)
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted)
     .text(summary, MARGIN, doc.y, { width: contentW, lineGap: 2 })
  doc.moveDown(1)

  /* ── experience ────────────────────────────────────────────────────── */
  if (bio.experience.length) {
    sectionTitle(doc, L.experience)
    for (const row of bio.experience) {
      entryHeading(doc, row.role, row.company, dateRange(row.startDate, row.endDate, lang, L.present), row.location, contentW)
      if (row.description) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
           .text(String(row.description), MARGIN, doc.y, { width: contentW, lineGap: 1.5 })
      }
      bullets(doc, asStringArray(row.highlights), contentW)
      const tools = asStringArray(row.tools)
      if (tools.length) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(COLORS.faint)
           .text(tools.join(" · "), MARGIN, doc.y + 2, { width: contentW })
      }
      doc.moveDown(0.9)
    }
  }

  /* ── education ─────────────────────────────────────────────────────── */
  if (bio.education.length) {
    sectionTitle(doc, L.education)
    for (const row of bio.education) {
      const degree = row.fieldOfStudy ? `${row.degree} — ${row.fieldOfStudy}` : row.degree
      entryHeading(doc, degree, row.institution, dateRange(row.startDate, row.endDate, lang, L.present), row.location, contentW)
      if (row.description) {
        doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
           .text(String(row.description), MARGIN, doc.y, { width: contentW, lineGap: 1.5 })
      }
      bullets(doc, asStringArray(row.highlights), contentW)
      doc.moveDown(0.9)
    }
  }

  /* ── certificates ──────────────────────────────────────────────────── */
  if (bio.certificates.length) {
    sectionTitle(doc, L.certificates)
    for (const row of bio.certificates) {
      if (doc.y > doc.page.height - 100) doc.addPage()
      const y = doc.y
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.charcoal)
         .text(row.title, MARGIN, y, { width: contentW - 90 })
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.faint)
         .text(formatMonth(row.issueDate, lang), MARGIN + contentW - 90, y, { width: 90, align: "right" })
      doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted)
         .text(row.credentialId ? `${row.issuer} · ${row.credentialId}` : row.issuer, MARGIN, doc.y, { width: contentW })
      doc.moveDown(0.5)
    }
    doc.moveDown(0.4)
  }

  /* ── skills (emphasised categories first) ──────────────────────────── */
  if (bio.skills.length) {
    sectionTitle(doc, L.skills)
    const grouped = bio.skills.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = []
      acc[s.category].push(s.name)
      return acc
    }, {})
    const order = [...track.emphasis, ...Object.keys(grouped).filter((k) => !track.emphasis.includes(k))]
    for (const cat of order) {
      const names = grouped[cat]
      if (!names || !names.length) continue
      if (doc.y > doc.page.height - 100) doc.addPage()
      const y = doc.y
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.violet)
         .text(L.categories[cat] || cat, MARGIN, y, { width: 130 })
      doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
         .text(names.join(" · "), MARGIN + 130, y, { width: contentW - 130, lineGap: 1.5 })
      doc.moveDown(0.5)
    }
  }

  /* ── footer ────────────────────────────────────────────────────────── */
  const footerY = doc.page.height - 44
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.faint)
     .text(`${L.generated} ${PERSON.website}/about · ${formatMonth(new Date(), lang)}`, MARGIN, footerY, { width: contentW, align: "center" })

  doc.end()
  await done
  return Buffer.concat(chunks)
}

/* ── helpers ───────────────────────────────────────────────────────────── */

function sectionTitle(doc, label) {
  const contentW = doc.page.width - MARGIN * 2
  if (doc.y > doc.page.height - 140) doc.addPage()
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.violet)
     .text(label.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1.4 })
  doc.strokeColor(COLORS.border).lineWidth(0.6)
     .moveTo(MARGIN, doc.y + 3).lineTo(MARGIN + contentW, doc.y + 3).stroke()
  doc.y += 10
}

function entryHeading(doc, primary, secondary, dates, location, contentW) {
  if (doc.y > doc.page.height - 120) doc.addPage()
  const y = doc.y
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.charcoal)
     .text(primary, MARGIN, y, { width: contentW - 130 })
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.faint)
     .text(dates, MARGIN + contentW - 130, y, { width: 130, align: "right" })
  doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
     .text(location ? `${secondary} · ${location}` : secondary, MARGIN, doc.y, { width: contentW })
  doc.moveDown(0.3)
}

function bullets(doc, items, contentW) {
  if (!items.length) return
  doc.moveDown(0.2)
  for (const item of items) {
    const y = doc.y
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.violet).text("•", MARGIN + 4, y)
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.muted)
       .text(item, MARGIN + 16, y, { width: contentW - 16, lineGap: 1.5 })
  }
}

/** Json columns (highlights, tools) may hold an array of strings or objects. */
function asStringArray(value) {
  if (!value) return []
  let v = value
  if (typeof v === "string") {
    try { v = JSON.parse(v) } catch { return [v] }
  }
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === "string" ? x : x && (x.text || x.label || x.name))).filter(Boolean)
}

function formatMonth(d, lang) {
  if (!d) return ""
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ""
  return dt.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "short" })
}

function dateRange(start, end, lang, presentLabel) {
  return `${formatMonth(start, lang)} — ${end ? formatMonth(end, lang) : presentLabel}`
}

module.exports = { getCvPdf, renderCvPdf, bioVersion, cacheFileName, PERSON }
