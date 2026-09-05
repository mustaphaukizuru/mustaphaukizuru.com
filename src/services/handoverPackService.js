const crypto = require("crypto")
const fs = require("fs")
const fsp = require("fs/promises")
const path = require("path")
const PDFDocument = require("pdfkit")

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { createZip } = require("../lib/zip")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")
const projectEvents = require("./projectEventService")
const projectInvoices = require("./projectInvoiceService")
const { invoicePathFor } = require("./invoiceService")

/**
 * handoverPackService.js · everything, in one file, at the end (T5-19)
 *
 * Handover was a status change and an email. The client was left holding a
 * dashboard they would eventually stop logging into, a set of invoices spread
 * across order pages, and a timeline that only exists while the project row
 * does — because projectPurgeJob eventually takes the files, and it is
 * supposed to.
 *
 * So: one ZIP, generated when the project moves to handover, containing what
 * the client would otherwise have to reassemble from six screens:
 *
 *   README.md        what this is and what is in it, in their language
 *   statement.pdf    every client-visible event, dated, as a document
 *   runbook.md       what was delivered, where it lives, what happens next
 *   deliverables.md  every deliverable with a SHA-256 of the exact bytes
 *   invoices/*.pdf   every invoice PDF that exists on disk
 *   manifest.json    the machine-readable index, with the same checksums
 *
 * WHAT IS DELIBERATELY NOT IN IT
 *
 * Credentials. T5-13 exists precisely so a password never becomes a file,
 * and a handover pack is the single worst file for one to end up in — it is
 * the artefact most likely to be forwarded, backed up and forgotten about.
 * The runbook names the credential handoff instead.
 *
 * NOT the ops runbook either. `opsRunbookService` is a SERVER health report:
 * environment variable names, storage paths, backup ages, Prisma versions.
 * The plan named it, but shipping it to a client would hand them our
 * infrastructure inventory. The runbook here is written for the client.
 *
 * CFDI XML is listed in the manifest and absent from the archive until T5-10
 * exists — the manifest says so rather than staying silent, so the gap is
 * visible to whoever opens it rather than being discovered by its absence.
 *
 * THE PACK IS A DELIVERABLE
 *
 * Attached as a ProjectFile with isDeliverable = true, which means the
 * unpaid-invoice gate already written applies to it: a client whose project
 * is later suspended for an outstanding invoice sees the pack listed and
 * cannot download it. That is not a new rule, it is the existing one, and
 * getting it for free is the reason to attach it as a file rather than serve
 * it from a route of its own.
 */

const PACK_DIR = "handover"
const BRAND = Object.freeze({
  primary: "#5D3FD3",
  primaryDark: "#2d003f",
  text: "#1f2937",
  muted: "#6b7280",
  line: "#e5e7eb",
})

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex")
}

function fmtBytes(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return "0 B"
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`
  return `${(v / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(value, locale = "en") {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
      year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    })
  } catch { return "—" }
}

/* ── the statement PDF ───────────────────────────────────────────────── */

/**
 * Every client-visible event as a document.
 *
 * A PDF rather than the JSON that is also in the pack, because the audience
 * for this one is a person filing a record of what happened — often for
 * somebody who was never given a login.
 */
function buildStatementPdf({ project, events, locale }) {
  const es = locale === "es"
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 48 })
      const chunks = []
      doc.on("data", (c) => chunks.push(c))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND.primary)
        .text(es ? "Historial del proyecto" : "Project history")
      doc.moveDown(0.2)
      doc.font("Helvetica").fontSize(11).fillColor(BRAND.text).text(project.projectName)
      doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted)
        .text(`${project.trackingCode || ""}`)
        .text(es
          ? `Generado el ${fmtDate(new Date(), "es")}`
          : `Generated ${fmtDate(new Date(), "en")}`)

      doc.moveDown(1)
      doc.strokeColor(BRAND.line).lineWidth(1)
        .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()
      doc.moveDown(0.8)

      if (!events.length) {
        doc.font("Helvetica").fontSize(10).fillColor(BRAND.muted)
          .text(es ? "No hay actividad registrada." : "No recorded activity.")
      }

      for (const event of events) {
        const row = projectEvents.serializeEvent(event, locale)
        // A date column that never moves, so the eye can scan it.
        const y = doc.y
        doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted)
          .text(fmtDate(row.createdAt, locale), doc.page.margins.left, y, { width: 90 })
        doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.text)
          .text(row.title, doc.page.margins.left + 100, y, { width: 340 })
        if (row.detail) {
          doc.font("Helvetica").fontSize(9).fillColor(BRAND.muted)
            .text(row.detail, doc.page.margins.left + 100, doc.y, { width: 340 })
        }
        doc.moveDown(0.6)
        // A new page before the footer runs into the margin, not after.
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage()
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

/* ── the written parts ───────────────────────────────────────────────── */

function buildReadme({ project, locale, contents }) {
  const es = locale === "es"
  const lines = es ? [
    `# Entrega — ${project.projectName}`,
    "",
    `Generado el ${fmtDate(new Date(), "es")}.`,
    "",
    "Este archivo contiene todo lo del proyecto en un solo lugar, para que no",
    "dependa de seguir entrando al panel. Guárdalo donde guardes los documentos",
    "importantes de tu organización.",
    "",
    "## Qué hay aquí",
    "",
    ...contents.map((c) => `- \`${c.name}\` — ${c.descriptionEs}`),
    "",
    "## Qué NO hay aquí, a propósito",
    "",
    "**Contraseñas ni llaves de acceso.** Nunca viajan como archivos: un",
    "archivo se reenvía, se respalda y se olvida. Se entregan por el traspaso",
    "seguro de credenciales, que se lee una sola vez y después se destruye.",
    "Si necesitas alguna, pídela desde el proyecto.",
    "",
    "## Verificar los archivos",
    "",
    "`manifest.json` y `deliverables.md` traen el SHA-256 de cada entregable.",
    "Sirven para comprobar, dentro de un año, que el archivo que tienes es",
    "exactamente el que te entregamos.",
  ] : [
    `# Handover — ${project.projectName}`,
    "",
    `Generated ${fmtDate(new Date(), "en")}.`,
    "",
    "This archive holds everything from the project in one place, so that",
    "having it does not depend on still logging into a dashboard. Keep it",
    "wherever your organisation keeps important documents.",
    "",
    "## What is in here",
    "",
    ...contents.map((c) => `- \`${c.name}\` — ${c.description}`),
    "",
    "## What is deliberately NOT in here",
    "",
    "**Passwords and access keys.** They never travel as files: a file gets",
    "forwarded, backed up and forgotten. They are handed over through the",
    "secure credential handoff, which can be read once and is then destroyed.",
    "If you need one, ask for it from the project.",
    "",
    "## Verifying the files",
    "",
    "`manifest.json` and `deliverables.md` carry a SHA-256 for every",
    "deliverable. They are how you confirm, a year from now, that the file you",
    "are holding is exactly the one we handed over.",
  ]
  return lines.join("\n") + "\n"
}

function buildRunbook({ project, milestones, locale }) {
  const es = locale === "es"
  const done = milestones.filter((m) => ["approved", "completed"].includes(m.status))
  const lines = es ? [
    `# Guía — ${project.projectName}`,
    "",
    "## Qué se entregó",
    "",
    ...(done.length
      ? done.map((m) => `- **${m.title}**${m.completedAt ? ` — ${fmtDate(m.completedAt, "es")}` : ""}`)
      : ["- (sin etapas registradas)"]),
    "",
    ...(project.previewUrl ? ["## Dónde está", "", `- ${project.previewUrl}`, ""] : []),
    "## Qué sigue",
    "",
    "- El proyecto queda en modo entrega: puedes seguir consultándolo y",
    "  descargando los entregables durante el periodo de conservación.",
    "- Después de ese periodo los archivos se eliminan del servidor. Este",
    "  paquete es tu copia permanente — por eso existe.",
    "- Si algo deja de funcionar o necesitas trabajo adicional, ábrelo desde",
    "  el proyecto y lo cotizamos antes de empezar.",
    "",
    "## Cómo volver aquí",
    "",
    ...(project.trackingCode
      ? [`- Con el código \`${project.trackingCode}\` desde /track, sin necesidad de cuenta.`]
      : ["- Desde tu panel, en la sección de proyectos."]),
  ] : [
    `# Runbook — ${project.projectName}`,
    "",
    "## What was delivered",
    "",
    ...(done.length
      ? done.map((m) => `- **${m.title}**${m.completedAt ? ` — ${fmtDate(m.completedAt, "en")}` : ""}`)
      : ["- (no milestones recorded)"]),
    "",
    ...(project.previewUrl ? ["## Where it lives", "", `- ${project.previewUrl}`, ""] : []),
    "## What happens next",
    "",
    "- The project stays in handover: you can keep reading it and downloading",
    "  the deliverables for the retention period.",
    "- After that the files are removed from the server. This pack is your",
    "  permanent copy — that is what it is for.",
    "- If something stops working, or you need more work done, raise it from",
    "  the project and we quote it before anything starts.",
    "",
    "## How to get back here",
    "",
    ...(project.trackingCode
      ? [`- With the code \`${project.trackingCode}\` at /track, no account needed.`]
      : ["- From your dashboard, under projects."]),
  ]
  return lines.join("\n") + "\n"
}

function buildDeliverablesDoc(files, locale) {
  const es = locale === "es"
  const head = es
    ? ["# Entregables", "", "Con el SHA-256 de cada archivo, para verificarlos después.", ""]
    : ["# Deliverables", "", "With a SHA-256 for each file, so they can be verified later.", ""]
  if (!files.length) {
    return [...head, es ? "(ninguno)" : "(none)", ""].join("\n")
  }
  const rows = files.map((f) => [
    `## ${f.name}`,
    "",
    `- ${es ? "tamaño" : "size"}: ${fmtBytes(f.size)}`,
    `- ${es ? "entregado" : "delivered"}: ${fmtDate(f.createdAt, locale)}`,
    `- sha256: \`${f.sha256 || (es ? "no disponible" : "unavailable")}\``,
    "",
  ].join("\n"))
  return [...head, ...rows].join("\n")
}

/* ── the pack ────────────────────────────────────────────────────────── */

function packPathFor(projectId, fileName) {
  return path.join(STORAGE_PATHS.projectFiles, String(projectId), PACK_DIR, fileName)
}

/**
 * Build the pack for one project and attach it as a deliverable.
 *
 * Returns the ProjectFile row, or null when there is nothing to build — a
 * missing project, not a thrown error, because every caller is a side effect
 * of something that has already happened.
 */
async function buildHandoverPack(projectId, { now = new Date(), createdById = null } = {}) {
  const project = await prisma.clientProject.findUnique({
    where: { id: String(projectId) },
    select: {
      id: true, userId: true, projectName: true, trackingCode: true, previewUrl: true,
      createdAt: true, closedAt: true,
      user: { select: { id: true, email: true, fullName: true, profile: { select: { country: true } } } },
      milestones: {
        select: { id: true, title: true, status: true, completedAt: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })
  if (!project) return null

  const { resolveUserLocale } = require("../utils/resolveUserLocale")
  const locale = resolveUserLocale({ user: project.user })

  // 1 · deliverables, with a checksum of the exact bytes on disk.
  const fileRows = await prisma.projectFile.findMany({
    where:  { projectId: project.id, isDeliverable: true, purgedAt: null },
    select: { id: true, fileName: true, filePath: true, fileSize: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const { resolveSafePath } = require("../controllers/clientProjectController")
  const deliverables = []
  const entries = []

  for (const row of fileRows) {
    // The pack must never contain a copy of itself. Re-running handover
    // would otherwise nest last week's archive inside this week's, and then
    // the week after that.
    if (String(row.filePath || "").includes(`/${PACK_DIR}/`)) continue
    const abs = resolveSafePath(row.filePath)
    let bytes = null
    if (abs) bytes = await fsp.readFile(abs).catch(() => null)
    deliverables.push({
      name: row.fileName,
      size: bytes ? bytes.length : row.fileSize,
      createdAt: row.createdAt,
      // Null rather than a wrong value when the bytes are gone: a checksum
      // nobody can verify is worse than an honest gap.
      sha256: bytes ? sha256(bytes) : null,
      included: Boolean(bytes),
    })
    if (bytes) entries.push({ name: `deliverables/${row.fileName}`, data: bytes, date: row.createdAt })
  }

  // 2 · invoices that exist on disk.
  const { invoices } = await projectInvoices.listForProject(project.id)
  const invoiceEntries = []
  for (const invoice of invoices) {
    const diskPath = invoicePathFor(invoice.invoiceNumber)
    const bytes = fs.existsSync(diskPath) ? await fsp.readFile(diskPath).catch(() => null) : null
    invoiceEntries.push({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      issuedAt: invoice.issuedAt,
      included: Boolean(bytes),
      sha256: bytes ? sha256(bytes) : null,
      // T5-10 · the CFDI XML has no source yet. Listed rather than omitted so
      // the gap is visible to whoever opens the manifest.
      cfdiXml: null,
    })
    if (bytes) entries.push({ name: `invoices/${invoice.invoiceNumber}.pdf`, data: bytes, date: invoice.issuedAt })
  }

  // 3 · the timeline, as a document and as data.
  const events = await projectEvents.listForProject(project.id, { audience: "client", limit: 500 })
  const statement = await buildStatementPdf({ project, events, locale }).catch((e) => {
    logger.warn(`[handover] statement failed for ${project.id}: ${e.message}`)
    return null
  })
  if (statement) entries.push({ name: "statement.pdf", data: statement, date: now })
  entries.push({
    name: "events.json",
    data: JSON.stringify(events.map((e) => projectEvents.serializeEvent(e, locale)), null, 2),
    date: now,
  })

  // 4 · the written parts.
  entries.push({ name: "runbook.md", data: buildRunbook({ project, milestones: project.milestones, locale }), date: now })
  entries.push({ name: "deliverables.md", data: buildDeliverablesDoc(deliverables, locale), date: now })

  const contents = [
    { name: "statement.pdf", description: "every recorded step of the project, dated", descriptionEs: "cada paso registrado del proyecto, con fecha" },
    { name: "runbook.md", description: "what was delivered, where it lives, what happens next", descriptionEs: "qué se entregó, dónde está y qué sigue" },
    { name: "deliverables/", description: "the delivered files themselves", descriptionEs: "los archivos entregados" },
    { name: "deliverables.md", description: "every deliverable with a SHA-256", descriptionEs: "cada entregable con su SHA-256" },
    { name: "invoices/", description: "every invoice PDF", descriptionEs: "cada factura en PDF" },
    { name: "events.json", description: "the same history, machine-readable", descriptionEs: "el mismo historial, legible por máquina" },
    { name: "manifest.json", description: "the index, with checksums", descriptionEs: "el índice, con las sumas de verificación" },
  ]
  entries.push({ name: "README.md", data: buildReadme({ project, locale, contents }), date: now })

  const manifest = {
    kind: "handover-pack",
    version: 1,
    generatedAt: now.toISOString(),
    project: {
      id: project.id,
      name: project.projectName,
      trackingCode: project.trackingCode,
      startedAt: project.createdAt?.toISOString?.() || null,
      closedAt: project.closedAt?.toISOString?.() || null,
      previewUrl: project.previewUrl || null,
    },
    deliverables,
    invoices: invoiceEntries,
    events: events.length,
    // Stated rather than implied: a reader should not have to infer that a
    // credential was left out on purpose.
    excluded: [
      { what: "credentials", why: "Passwords and keys never travel as files; they go through the read-once secure handoff." },
      { what: "cfdi-xml", why: "Not yet issued by this system (T5-10). The invoice PDFs are included." },
    ],
  }
  entries.push({ name: "manifest.json", data: JSON.stringify(manifest, null, 2), date: now })

  const zip = createZip(entries)

  // 5 · write it and attach it.
  const stamp = now.toISOString().slice(0, 10)
  const safeName = String(project.projectName || "project").replace(/[^\w\-. ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "project"
  const fileName = `handover-${safeName}-${stamp}.zip`
  const dir = path.join(STORAGE_PATHS.projectFiles, project.id, PACK_DIR)
  ensureDir(dir)
  await fsp.writeFile(path.join(dir, fileName), zip)

  // isDeliverable, so the unpaid-invoice gate already written applies to it.
  const row = await prisma.projectFile.create({
    data: {
      projectId: project.id,
      uploadedById: createdById ? String(createdById) : null,
      uploadedByRole: "admin",
      fileName,
      filePath: `/files/projects/${project.id}/${PACK_DIR}/${fileName}`,
      fileType: "application/zip",
      fileSize: zip.length,
      isDeliverable: true,
    },
  })

  await projectEvents.record({
    projectId: project.id,
    type: "file.delivered",
    actorRole: "system",
    detail: fileName,
    detailEs: fileName,
    refs: { fileId: row.id },
  })

  logger.info(`[handover] ${project.id}: ${fmtBytes(zip.length)}, ${entries.length} entries`)
  return row
}

module.exports = {
  buildHandoverPack,
  buildStatementPdf,
  buildRunbook,
  buildReadme,
  buildDeliverablesDoc,
  packPathFor,
  PACK_DIR,
}
