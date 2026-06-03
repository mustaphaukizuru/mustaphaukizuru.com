/**
 * diagnosticController.js
 *
 * Handles POST /api/v1/diagnostic-submission — the "Email my report" gate
 * inside the /diagnostic iframe. Receives the visitor's full audit payload,
 * persists it to DiagnosticSubmission, then fires two emails:
 *
 *   1. Admin alert  → hello@mustaphaukizuru.com  (lead notification)
 *   2. Visitor copy → their email                (their report HTML)
 *
 * SMTP failure is non-fatal: the row is saved first, so no lead is lost
 * even if Hostinger's SMTP is temporarily unreachable.
 */

const asyncHandler  = require("../utils/asyncHandler")
const prisma        = require("../lib/prisma")
const logger        = require("../utils/logger")
const nodemailer    = require("nodemailer")

/* ── SMTP transport (reuses the same Hostinger config as mailer.js) ── */
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.hostinger.com",
  port:   Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
})

const ADMIN_EMAIL    = process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_USER || "hello@mustaphaukizuru.com"
const SITE_URL       = process.env.FRONTEND_URL || "https://mustaphaukizuru.com"
const FROM_ADDRESS   = `"Mustapha Ukizuru" <${process.env.SMTP_USER || "hello@mustaphaukizuru.com"}>`

/* ── Helpers ──────────────────────────────────────────────────────── */
function esc(v = "") {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function tierColor(tier) {
  return {
    Foundation:  "#E11D48",
    Stabilizing: "#F59E0B",
    Optimizing:  "#0284C7",
    Mature:      "#10B981",
  }[tier] || "#5D3FD3"
}

function audienceLabel(aud) {
  return { EDU: "School / Educational Institution", SMB: "Business / SME / Startup", IND: "Individual / Professional" }[aud] || aud
}

/* ── Email builders ───────────────────────────────────────────────── */
function buildAdminEmail(data) {
  const { name, email, organization, audience, overallScore, tier, topPriorities, matchedBundle } = data

  const priorityRows = (topPriorities || []).map((p, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #EFF1F5;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#5D3FD3;">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #EFF1F5;font-size:13px;font-weight:600;">${esc(p.title)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #EFF1F5;font-family:'JetBrains Mono',monospace;font-size:11px;color:#64748B;">${esc(p.svc)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #EFF1F5;text-align:center;font-family:'JetBrains Mono',monospace;font-weight:700;color:#E11D48;">${p.score}/4</td>
    </tr>`).join("")

  return {
    from:    FROM_ADDRESS,
    to:      ADMIN_EMAIL,
    subject: `🎯 New Self-Audit Lead — ${esc(name)} · ${esc(audience)} · ${overallScore}/100`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Sora',system-ui,sans-serif;">
<div style="max-width:640px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(26,27,35,.08);border:1px solid #DCDCE4;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#5D3FD3,#0284C7);padding:32px 40px;">
    <div style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px;">SELF-AUDIT LEAD</div>
    <div style="font-size:28px;font-weight:700;color:#fff;line-height:1.2;">${esc(name)}</div>
    <div style="font-size:14px;color:rgba(255,255,255,.85);margin-top:4px;">${esc(email)}${organization ? ` · ${esc(organization)}` : ""}</div>
  </div>
  <!-- Score band -->
  <div style="display:flex;align-items:center;gap:24px;padding:28px 40px;background:#F8FAFC;border-bottom:1px solid #EFF1F5;">
    <div style="text-align:center;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:48px;font-weight:700;color:#1A1B23;line-height:1;">${overallScore}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px;">/ 100</div>
    </div>
    <div>
      <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:${tierColor(tier)};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${esc(tier)}</div>
      <div style="font-size:13px;color:#64748B;margin-top:8px;">${audienceLabel(audience)}</div>
      ${matchedBundle ? `<div style="font-size:12px;color:#5D3FD3;font-weight:600;margin-top:4px;">→ ${esc(matchedBundle)}</div>` : ""}
    </div>
  </div>
  <!-- Priorities -->
  <div style="padding:28px 40px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:16px;">TOP PRIORITIES</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:8px 12px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B;letter-spacing:0.06em;border-bottom:2px solid #DCDCE4;">#</th>
          <th style="padding:8px 12px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B;letter-spacing:0.06em;border-bottom:2px solid #DCDCE4;">SERVICE NEEDED</th>
          <th style="padding:8px 12px;text-align:left;font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B;letter-spacing:0.06em;border-bottom:2px solid #DCDCE4;">ID</th>
          <th style="padding:8px 12px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B;letter-spacing:0.06em;border-bottom:2px solid #DCDCE4;">SCORE</th>
        </tr>
      </thead>
      <tbody>${priorityRows || "<tr><td colspan='4' style='padding:16px 12px;color:#64748B;font-size:13px;'>All items scored ≥ 3 — strong foundation.</td></tr>"}</tbody>
    </table>
  </div>
  <!-- CTA -->
  <div style="padding:24px 40px 32px;border-top:1px solid #EFF1F5;text-align:center;">
    <a href="mailto:${esc(email)}?subject=Your%20Self-Audit%20Results%20%E2%80%94%20Let%27s%20Talk" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#5D3FD3,#0284C7);color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">Reply to ${esc(name)}</a>
    <p style="margin-top:16px;font-size:12px;color:#64748B;">Submitted at ${new Date().toISOString()} from ${SITE_URL}/self-audit</p>
  </div>
</div>
</body></html>`,
  }
}

function buildVisitorEmail(data) {
  const { name, email, audience, overallScore, tier, topPriorities, matchedBundle, sectionScores } = data
  const firstName = (name || "").split(" ")[0] || "there"

  const catBars = Object.entries(sectionScores || {}).map(([letter, d]) => {
    const pct = d?.pct ?? 0
    const barColor = pct < 31 ? "#E11D48" : pct < 61 ? "#F59E0B" : pct < 86 ? "#0284C7" : "#10B981"
    return `
    <tr>
      <td style="padding:8px 0;font-weight:600;font-size:13px;white-space:nowrap;">${letter} · ${esc(d?.name || "").replace(/Audit$/, "").trim()}</td>
      <td style="padding:8px 8px;width:100%;">
        <div style="height:8px;background:#EFF1F5;border-radius:999px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:999px;"></div>
        </div>
      </td>
      <td style="padding:8px 0;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;">${pct}%</td>
    </tr>`
  }).join("")

  const priorityList = (topPriorities || []).map((p, i) => `
    <tr>
      <td style="padding:12px 0;vertical-align:top;font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:#5D3FD3;line-height:1.2;padding-right:16px;">${String(i + 1).padStart(2, "0")}</td>
      <td style="padding:12px 0;border-bottom:1px solid #EFF1F5;">
        <div style="font-weight:700;font-size:14px;">${esc(p.title)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#5D3FD3;margin-top:3px;">${esc(p.svc)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#64748B;margin-top:2px;">${esc(p.tier)}</div>
      </td>
    </tr>`).join("")

  return {
    from:    FROM_ADDRESS,
    to:      email,
    subject: `Your Self-Audit Results: ${overallScore}/100 · ${tier} Tier`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Sora',system-ui,sans-serif;">
<div style="max-width:620px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(26,27,35,.08);border:1px solid #DCDCE4;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#5D3FD3,#0284C7);padding:32px 40px;text-align:center;">
    <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:16px;">YOUR DIGITAL &amp; TECHNOLOGY SELF-AUDIT</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:64px;font-weight:700;color:#fff;line-height:1;">${overallScore}</div>
    <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:4px;">out of 100</div>
    <div style="display:inline-block;margin-top:12px;padding:6px 18px;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.25);">${esc(tier)}</div>
  </div>

  <!-- Greeting -->
  <div style="padding:32px 40px 0;">
    <p style="font-size:16px;font-weight:600;color:#1A1B23;margin:0 0 8px;">Hi ${esc(firstName)},</p>
    <p style="font-size:14.5px;color:#64748B;line-height:1.65;margin:0;">Here are your self-audit results. I've highlighted your top priorities and the bundle that best matches where to start.</p>
  </div>

  <!-- Category scores -->
  <div style="padding:28px 40px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:16px;">MATURITY BY CATEGORY</div>
    <table style="width:100%;border-collapse:collapse;">${catBars}</table>
  </div>

  <!-- Top priorities -->
  <div style="padding:0 40px 28px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:16px;">YOUR TOP PRIORITIES</div>
    ${topPriorities?.length ? `<table style="width:100%;border-collapse:collapse;">${priorityList}</table>` : `<p style="font-size:13.5px;color:#64748B;">All items scored ≥ 3 — strong foundation across the board.</p>`}
  </div>

  <!-- Bundle -->
  ${matchedBundle ? `
  <div style="margin:0 40px 28px;padding:28px;background:linear-gradient(135deg,#5D3FD3,#0284C7 50%,#7DD3FC);border-radius:14px;color:#fff;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;opacity:.8;margin-bottom:8px;">RECOMMENDED SOLUTION BUNDLE</div>
    <div style="font-size:20px;font-weight:700;margin-bottom:6px;">${esc(matchedBundle)}</div>
    <div style="font-size:13px;opacity:.9;">This bundle directly addresses the largest gaps in your shortlist.</div>
  </div>` : ""}

  <!-- Next steps -->
  <div style="padding:0 40px 32px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;font-weight:700;margin-bottom:16px;">NEXT STEPS</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:0 12px 12px 0;vertical-align:top;width:33%;">
          <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Book a discovery call</div>
          <div style="font-size:12.5px;color:#64748B;line-height:1.5;margin-bottom:8px;">Free 30-minute call. Walk through your results. No pitch.</div>
          <a href="${SITE_URL}/contact" style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#5D3FD3;text-decoration:none;">→ Book now</a>
        </td>
        <td style="padding:0 12px 12px;vertical-align:top;width:33%;">
          <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Request a proposal</div>
          <div style="font-size:12.5px;color:#64748B;line-height:1.5;margin-bottom:8px;">Scoped, fixed-price. 5 business days.</div>
          <a href="mailto:hello@mustaphaukizuru.com?subject=Proposal%20Request%20%E2%80%94%20Self-Audit" style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#5D3FD3;text-decoration:none;">→ Email us</a>
        </td>
        <td style="padding:0 0 12px;vertical-align:top;width:33%;">
          <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Browse services</div>
          <div style="font-size:12.5px;color:#64748B;line-height:1.5;margin-bottom:8px;">See all 82 services and their scope &amp; pricing.</div>
          <a href="${SITE_URL}/services" style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#5D3FD3;text-decoration:none;">→ View catalogue</a>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:24px 40px;background:#F8FAFC;border-top:1px solid #EFF1F5;text-align:center;">
    <div style="font-size:14px;font-weight:700;color:#5D3FD3;margin-bottom:4px;">Mustapha Ukizuru</div>
    <div style="font-size:12px;color:#64748B;">Complexity, simplified. · <a href="${SITE_URL}" style="color:#0284C7;text-decoration:none;">${SITE_URL.replace("https://","")}</a></div>
    <p style="font-size:11px;color:#A0A8B8;margin-top:12px;">You received this because you submitted the self-audit on ${SITE_URL}/self-audit. This is a one-time report — no newsletter.</p>
  </div>
</div>
</body></html>`,
  }
}

/* ── Controller ───────────────────────────────────────────────────── */
const submitDiagnostic = asyncHandler(async (req, res) => {
  const {
    name, email, organization,
    audience, scores, sectionScores,
    overall, topPriorities, matchedBundle,
  } = req.body || {}

  /* ── Validation ── */
  if (!name || !email || !audience) {
    return res.status(400).json({ success: false, message: "name, email, and audience are required" })
  }
  const cleanName  = String(name).trim().slice(0, 120)
  const cleanEmail = String(email).trim().toLowerCase()
  const cleanOrg   = organization ? String(organization).trim().slice(0, 200) : null
  const cleanAud   = ["EDU","SMB","IND"].includes(audience) ? audience : null

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: "Invalid email address" })
  }
  if (!cleanAud) {
    return res.status(400).json({ success: false, message: "audience must be EDU, SMB, or IND" })
  }

  const overallScore = Math.round(Number(overall?.pct || 0))
  const TIERS = [
    { min: 0,  max: 30,  name: "Foundation"  },
    { min: 31, max: 60,  name: "Stabilizing" },
    { min: 61, max: 85,  name: "Optimizing"  },
    { min: 86, max: 100, name: "Mature"       },
  ]
  const tier = (TIERS.find(t => overallScore >= t.min && overallScore <= t.max) || TIERS[0]).name

  /* ── Persist (before email so leads are never lost) ── */
  let record
  try {
    record = await prisma.diagnosticSubmission.create({
      data: {
        name:         cleanName,
        email:        cleanEmail,
        organization: cleanOrg,
        audience:     cleanAud,
        overallScore,
        tier,
        sectionScores: sectionScores || {},
        scores:        scores || {},
        topPriorities: topPriorities || [],
        matchedBundle: matchedBundle?.name || null,
      },
    })
  } catch (err) {
    logger.error("[diagnostic] DB save failed", err)
    // Still attempt emails — don't let a DB hiccup block the user
  }

  /* ── Send emails (non-blocking) ── */
  const emailData = {
    name:         cleanName,
    email:        cleanEmail,
    organization: cleanOrg,
    audience:     cleanAud,
    overallScore,
    tier,
    sectionScores: sectionScores || {},
    topPriorities: topPriorities || [],
    matchedBundle: matchedBundle?.name || null,
  }

  let emailSent = false
  Promise.all([
    transporter.sendMail(buildAdminEmail(emailData)).catch(e => logger.error("[diagnostic] admin email failed", e)),
    transporter.sendMail(buildVisitorEmail(emailData)).catch(e => logger.error("[diagnostic] visitor email failed", e)),
  ]).then(() => {
    if (record?.id) {
      prisma.diagnosticSubmission.update({
        where: { id: record.id },
        data:  { emailSent: true },
      }).catch(() => {})
    }
  })

  logger.info(`[diagnostic] submission saved: ${cleanEmail} · ${cleanAud} · ${overallScore}/100 · ${tier}`)

  return res.status(200).json({
    success: true,
    message: "Report submitted. Check your inbox — it should arrive within a few minutes.",
  })
})

module.exports = { submitDiagnostic }
