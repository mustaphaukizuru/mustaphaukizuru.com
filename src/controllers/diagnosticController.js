/**
 * diagnosticController.js — Self-audit submission handler.
 *
 * POST /api/v1/diagnostic-submission
 *
 * 1. Validate input
 * 2. Persist to DiagnosticSubmission
 * 3. Generate PDF (pdfkit)
 * 4. Send admin alert + visitor report email (HTML + PDF attachment)
 */

const asyncHandler = require("../utils/asyncHandler")
const prisma        = require("../lib/prisma")
const logger        = require("../utils/logger")
const PDFDocument   = require("pdfkit")
const emailService  = require("../services/emailService")

/* ── SMTP: single shared transport + EmailLog + retry via emailService ── */

const ADMIN_EMAIL  = process.env.CONTACT_ADMIN_EMAIL || process.env.SMTP_USER || "hello@mustaphaukizuru.com"
const SITE_URL     = process.env.FRONTEND_URL || "https://mustaphaukizuru.com"
const FROM_ADDRESS = `"Mustapha Ukizuru" <${process.env.SMTP_USER || "hello@mustaphaukizuru.com"}>`

/* ── Helpers ─────────────────────────────────────────────────────────── */
function esc(v = "") {
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}
function audienceLabel(aud) {
  return { EDU: "School / Educational Institution", SMB: "Business / SME / Startup", IND: "Individual / Professional" }[aud] || aud
}
function tierHex(tier) {
  return { Foundation:"#E11D48", Stabilizing:"#F59E0B", Optimizing:"#0284C7", Mature:"#10B981" }[tier] || "#5D3FD3"
}
function tierEmoji(tier) {
  return { Foundation:"🔴", Stabilizing:"🟡", Optimizing:"🔵", Mature:"🟢" }[tier] || "🟣"
}

const TIERS = [
  { min:0,  max:30,  name:"Foundation",  hex:"#E11D48",
    desc:"You're starting from near-zero on key dimensions. The highest-ROI move is a structured foundational build — not optimization.",
    action:"Start with a Technology Assessment to map exactly what to fix first.",
    urgency:"Every month without a roadmap costs an estimated 15–25% in operational efficiency." },
  { min:31, max:60,  name:"Stabilizing", hex:"#F59E0B",
    desc:"The basics are in place but discipline is missing. The next engagement consolidates what's there and adds monitoring and governance.",
    action:"Prioritize the top 2–3 gaps to move into the Optimizing tier within 90 days.",
    urgency:"Inconsistent systems create 2–3× the support burden of well-managed ones." },
  { min:61, max:85,  name:"Optimizing",  hex:"#0284C7",
    desc:"Your systems are solid. The next engagement reduces cost, improves performance, or extends capabilities to new use cases.",
    action:"Focus on AI and analytics gaps in your shortlist to differentiate from competitors.",
    urgency:"Organisations at your tier that invest in AI see 30–50% productivity gains within 12 months." },
  { min:86, max:100, name:"Mature",      hex:"#10B981",
    desc:"You're ahead of 90% of your peer organisations. The next engagement is strategic.",
    action:"Consider a retainer engagement to maintain your advantage as technology shifts.",
    urgency:"Mature organisations that don't maintain their edge typically regress to Optimizing within 18 months." },
]

function getTier(pct) { return TIERS.find(t => pct >= t.min && pct <= t.max) || TIERS[0] }

/* ══════════════════════════════════════════════════════════════════════
   PDF GENERATION
════════════════════════════════════════════════════════════════════════ */
function generatePdf(data) {
  return new Promise((resolve, reject) => {
    const { name, organization, audience, overallScore, tier, sectionScores, topPriorities, matchedBundle } = data
    const chunks = []
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true })

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end",  () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const W = 595 - 100  // usable width (A4 minus margins)
    const tierData = getTier(overallScore)
    const tc = tierData.hex

    /* ─── Colour helpers ─── */
    const hexToRgb = (h) => {
      const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
      return [r,g,b]
    }

    /* ══ PAGE 1: COVER ════════════════════════════════════════════════ */
    // Purple header band
    doc.rect(0, 0, 595, 220).fill("#5D3FD3")

    // Brand monogram
    doc.roundedRect(50, 36, 38, 38, 8).fill("#ffffff").fillOpacity(0.15)
    doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("M", 62, 47)
    doc.fillOpacity(1)

    // Brand name
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica").text("Mustapha Ukizuru", 98, 42)
    doc.fillColor("rgba(255,255,255,0.6)").fontSize(9).font("Helvetica").text("mustaphaukizuru.com", 98, 58)

    // Report title
    doc.fillColor("#ffffff").fontSize(28).font("Helvetica-Bold").text("Digital & Technology", 50, 100)
    doc.text("Maturity Report", 50, 132)

    // Subtitle
    doc.fillColor("rgba(255,255,255,0.7)").fontSize(11).font("Helvetica")
      .text(organization ? `Prepared for: ${name} · ${organization}` : `Prepared for: ${name || "Anonymous"}`, 50, 170)
    doc.text(`${audienceLabel(audience)} · ${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}`, 50, 186)

    // White section
    doc.fillColor("#1A1B23")

    // Score band
    doc.roundedRect(50, 240, W, 100, 12).fill("#F8FAFC").stroke("#DCDCE4").lineWidth(1)
    const [tr, tg, tb] = hexToRgb(tc)
    doc.roundedRect(50, 240, W, 100, 12).fill(`rgb(${tr},${tg},${tb})`).fillOpacity(0.06)
    doc.fillOpacity(1)

    // Score number
    doc.fillColor("#1A1B23").fontSize(64).font("Helvetica-Bold").text(String(overallScore), 70, 255, { lineBreak: false })
    doc.fillColor("#64748B").fontSize(18).font("Helvetica").text("/100", 70 + (overallScore >= 100 ? 105 : overallScore >= 10 ? 73 : 40), 280, { lineBreak: false })

    // Tier badge
    doc.roundedRect(220, 260, 120, 28, 14).fill(tc)
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold").text(tierData.name.toUpperCase(), 230, 268)

    // Tier description
    doc.fillColor("#64748B").fontSize(10).font("Helvetica").text(tierData.desc, 70, 320, { width: W - 20 })

    // Section divider
    doc.moveTo(50, 390).lineTo(545, 390).stroke("#DCDCE4").lineWidth(1)

    // Category scores
    doc.fillColor("#64748B").fontSize(9).font("Helvetica-Bold").text("MATURITY BY CATEGORY", 50, 405)
    let yPos = 425
    const entries = Object.entries(sectionScores || {})
    entries.forEach(([letter, d]) => {
      doc.fillColor("#5D3FD3").fontSize(10).font("Helvetica-Bold").text(letter, 50, yPos)
      doc.fillColor("#1A1B23").fontSize(10).font("Helvetica").text((d.name || "").replace(/Audit$/,"").trim(), 70, yPos)
      // Track
      doc.rect(280, yPos + 2, 200, 8).fill("#EFF1F5").stroke("#DCDCE4").lineWidth(0)
      const pct = d.pct || 0
      const barColor = pct < 31 ? "#E11D48" : pct < 61 ? "#F59E0B" : pct < 86 ? "#0284C7" : "#10B981"
      doc.rect(280, yPos + 2, Math.max(4, 200 * pct / 100), 8).fill(barColor)
      doc.fillColor("#64748B").fontSize(9).font("Helvetica").text(`${pct}%`, 490, yPos)
      yPos += 22
    })

    /* ══ PAGE 2: PRIORITIES ═══════════════════════════════════════════ */
    doc.addPage()

    // Header
    doc.rect(0, 0, 595, 60).fill("#F8FAFC")
    doc.fillColor("#1A1B23").fontSize(18).font("Helvetica-Bold").text("Your Top Priorities", 50, 20)
    doc.fillColor("#64748B").fontSize(10).font("Helvetica").text(`The ${(topPriorities || []).length} highest-impact gaps in your assessment`, 50, 42)
    doc.moveTo(50, 62).lineTo(545, 62).stroke("#DCDCE4").lineWidth(1)

    yPos = 80
    ;(topPriorities || []).forEach((p, i) => {
      if (yPos > 720) { doc.addPage(); yPos = 50 }

      // Number
      doc.fillColor("#5D3FD3").fontSize(20).font("Helvetica-Bold").text(String(i + 1).padStart(2,"0"), 50, yPos)

      // Service ID + title
      doc.fillColor("#5D3FD3").fontSize(9).font("Helvetica-Bold").text(p.svc, 80, yPos)
      doc.fillColor("#1A1B23").fontSize(13).font("Helvetica-Bold").text(p.title, 80, yPos + 14)

      // Score bar
      const scored = p.score || 0
      ;[0,1,2,3,4].forEach((n) => {
        doc.rect(80 + n * 20, yPos + 34, 16, 6).fill(n <= scored ? "#E11D48" : "#EFF1F5")
      })
      doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(`Scored ${scored}/4 — target is 3+`, 188, yPos + 32)

      // Risk
      doc.fillColor("#64748B").fontSize(9).font("Helvetica").text(`Risk: ${p.risk || ""}`, 80, yPos + 50, { width: 400 })

      // Investment + tier
      const riskLines = Math.ceil((p.risk || "").length / 80)
      const extraY    = riskLines > 1 ? (riskLines - 1) * 10 : 0
      doc.fillColor("#5D3FD3").fontSize(9).font("Helvetica-Bold")
        .text(`${p.investRange || ""}  ·  ${p.tier || ""}`, 80, yPos + 62 + extraY)

      doc.moveTo(50, yPos + 80 + extraY).lineTo(545, yPos + 80 + extraY).stroke("#DCDCE4").lineWidth(0.5)
      yPos += 95 + extraY
    })

    /* ══ PAGE 3: NEXT STEPS ═══════════════════════════════════════════ */
    doc.addPage()

    doc.rect(0, 0, 595, 60).fill("#F8FAFC")
    doc.fillColor("#1A1B23").fontSize(18).font("Helvetica-Bold").text("Recommended Next Steps", 50, 20)
    doc.moveTo(50, 62).lineTo(545, 62).stroke("#DCDCE4").lineWidth(1)

    yPos = 85
    // Tier action
    doc.roundedRect(50, yPos, W, 90, 10).fill(tc).fillOpacity(0.08)
    doc.fillOpacity(1)
    doc.fillColor(tc).fontSize(11).font("Helvetica-Bold").text(`${tierEmoji(tierData.name)}  ${tierData.name} Tier · Recommended Action`, 65, yPos + 14)
    doc.fillColor("#1A1B23").fontSize(10).font("Helvetica").text(tierData.action, 65, yPos + 34, { width: W - 30 })
    doc.fillColor("#64748B").fontSize(9).font("Helvetica-Oblique").text(tierData.urgency, 65, yPos + 60, { width: W - 30 })
    yPos += 110

    // Bundle
    if (matchedBundle) {
      doc.roundedRect(50, yPos, W, 100, 10).fill("#5D3FD3").fillOpacity(0.06)
      doc.fillOpacity(1)
      doc.fillColor("#64748B").fontSize(9).font("Helvetica-Bold").text("RECOMMENDED SOLUTION BUNDLE", 65, yPos + 14)
      doc.fillColor("#1A1B23").fontSize(14).font("Helvetica-Bold").text(matchedBundle.name || matchedBundle, 65, yPos + 30)
      if (matchedBundle.tagline) {
        doc.fillColor("#64748B").fontSize(10).font("Helvetica").text(matchedBundle.tagline, 65, yPos + 52, { width: W - 30 })
      }
      if (matchedBundle.investRange) {
        doc.fillColor("#5D3FD3").fontSize(10).font("Helvetica-Bold").text(`Investment: ${matchedBundle.investRange}  ·  ${matchedBundle.timeline || ""}`, 65, yPos + 76)
      }
      yPos += 120
    }

    // 3 CTA cards
    yPos += 10
    const ctaData = [
      { title: "Book a free 30-min discovery call", body: "Walk through your results together. No sales pitch.", cta: `${SITE_URL}/contact` },
      { title: "Request a written proposal", body: "Scoped, fixed-price. Delivered in 5 business days.", cta: "hello@mustaphaukizuru.com" },
      { title: "Message on WhatsApp", body: "Quick turnaround. English and Spanish supported.", cta: "+52 55 1234 5678" },
    ]
    ctaData.forEach((c, i) => {
      const x = 50 + i * (W / 3 + 5)
      doc.roundedRect(x, yPos, W / 3 - 5, 90, 8).fill("#F8FAFC").stroke("#DCDCE4").lineWidth(1)
      doc.fillColor("#1A1B23").fontSize(10).font("Helvetica-Bold").text(c.title, x + 12, yPos + 14, { width: W / 3 - 30 })
      doc.fillColor("#64748B").fontSize(8).font("Helvetica").text(c.body, x + 12, yPos + 40, { width: W / 3 - 30 })
      doc.fillColor("#5D3FD3").fontSize(8).font("Helvetica-Bold").text(c.cta, x + 12, yPos + 66, { width: W / 3 - 30 })
    })

    // Footer on all pages
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i)
      doc.fillColor("#A0A8B8").fontSize(8).font("Helvetica")
        .text(`Mustapha Ukizuru · mustaphaukizuru.com · Digital & Technology Maturity Report · ${new Date().getFullYear()}`, 50, 810, { width: W, align: "center" })
    }

    doc.end()
  })
}

/* ══════════════════════════════════════════════════════════════════════
   EMAIL BUILDERS
════════════════════════════════════════════════════════════════════════ */
function buildAdminEmail(data) {
  const { name, email, organization, audience, overallScore, tier, topPriorities, matchedBundle, prequal } = data
  const firstName = (name || "Anonymous").split(" ")[0]
  const tc = tierHex(tier)

  return {
    from: FROM_ADDRESS, to: ADMIN_EMAIL,
    subject: `${tierEmoji(tier)} New Self-Audit Lead — ${esc(name || "Anonymous")} · ${overallScore}/100 · ${esc(tier)}`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #DCDCE4;box-shadow:0 8px 24px rgba(26,27,35,.08);">
  <div style="background:linear-gradient(135deg,#5D3FD3,#0284C7);padding:28px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:6px;">SELF-AUDIT LEAD · NEW SUBMISSION</div>
    <div style="font-size:24px;font-weight:700;color:#fff;">${esc(name || "Anonymous")}</div>
    <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:2px;">${esc(email)}${organization ? ` · ${esc(organization)}` : ""}</div>
  </div>
  <div style="display:flex;align-items:center;gap:20px;padding:24px 36px;background:#F8FAFC;border-bottom:1px solid #EFF1F5;">
    <div style="text-align:center;min-width:70px;">
      <div style="font-family:monospace;font-size:44px;font-weight:700;color:#1A1B23;line-height:1;">${overallScore}</div>
      <div style="font-size:11px;color:#64748B;">/100</div>
    </div>
    <div>
      <div style="display:inline-block;padding:5px 14px;border-radius:999px;background:${tc};color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${esc(tier)}</div>
      <div style="font-size:12px;color:#64748B;margin-top:6px;">${audienceLabel(audience)}</div>
      ${matchedBundle ? `<div style="font-size:11px;color:#5D3FD3;font-weight:600;margin-top:4px;">→ ${esc(matchedBundle.name || matchedBundle)}</div>` : ""}
    </div>
  </div>
  ${prequal?.challenge || prequal?.timeline ? `
  <div style="padding:20px 36px;background:#F8FAFC;border-bottom:1px solid #EFF1F5;">
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:10px;">PRE-QUALIFICATION CONTEXT</div>
    ${prequal.challenge ? `<div style="font-size:12px;color:#1A1B23;margin-bottom:4px;"><strong>Challenge:</strong> ${esc(prequal.challenge)}</div>` : ""}
    ${prequal.timeline ? `<div style="font-size:12px;color:#1A1B23;"><strong>Timeline:</strong> ${esc(prequal.timeline)}</div>` : ""}
  </div>` : ""}
  <div style="padding:24px 36px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:14px;">TOP PRIORITIES</div>
    ${(topPriorities || []).slice(0, 5).map((p, i) => `
    <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid #EFF1F5;">
      <div style="font-family:monospace;font-size:18px;font-weight:700;color:#5D3FD3;min-width:30px;">${i + 1}</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#1A1B23;">${esc(p.title)}</div>
        <div style="font-family:monospace;font-size:10px;color:#5D3FD3;margin-top:2px;">${esc(p.svc)}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px;">Score ${p.score}/4 · ${esc(p.tier)} · ${esc(p.investRange || "")}</div>
      </div>
    </div>`).join("")}
  </div>
  <div style="padding:20px 36px;text-align:center;border-top:1px solid #EFF1F5;">
    <a href="mailto:${esc(email)}?subject=Your%20Self-Audit%20Results%20%E2%80%94%20Let%27s%20Talk" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#5D3FD3,#0284C7);color:#fff;font-weight:700;font-size:13px;border-radius:10px;text-decoration:none;">Reply to ${esc(firstName)}</a>
    <p style="margin-top:12px;font-size:11px;color:#A0A8B8;">Submitted from ${SITE_URL}/self-audit</p>
  </div>
</div></body></html>`,
  }
}

function buildVisitorEmail(data) {
  const { name, email, audience, overallScore, tier, topPriorities, matchedBundle, sectionScores } = data
  const firstName = (name || "there").split(" ")[0]
  const tc = tierHex(tier)
  const avgMap = { EDU: 36, SMB: 41, IND: 32 }
  const avg = avgMap[audience] || 38
  const vsAvg = overallScore - avg
  const tierData = getTier(overallScore)

  return {
    from: FROM_ADDRESS, to: email,
    subject: `${tierEmoji(tier)} Your ${tier}-tier maturity report${data.organization ? ` — ${data.organization}` : ""} | Mustapha Ukizuru`,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#5D3FD3,#0284C7);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
    <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:14px;">YOUR DIGITAL & TECHNOLOGY MATURITY REPORT</div>
    <div style="font-family:monospace;font-size:56px;font-weight:700;color:#fff;line-height:1;">${overallScore}</div>
    <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:4px;">out of 100</div>
    <div style="margin-top:12px;display:inline-block;padding:6px 18px;border-radius:999px;background:rgba(255,255,255,.15);color:#fff;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(255,255,255,.25);">${esc(tier)}</div>
    <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,.55);">vs. avg ${avg}/100 for ${audienceLabel(audience)} · you are <strong style="color:#fff;">${vsAvg >= 0 ? "+" : ""}${vsAvg} points</strong></div>
  </div>

  <!-- Body -->
  <div style="background:#fff;border:1px solid #DCDCE4;border-top:0;border-radius:0 0 16px 16px;overflow:hidden;">

    <!-- Greeting -->
    <div style="padding:28px 40px 0;">
      <p style="font-size:16px;font-weight:700;color:#1A1B23;margin:0 0 6px;">Hi ${esc(firstName)},</p>
      <p style="font-size:14px;color:#64748B;line-height:1.65;margin:0;">Here are your full self-audit results. I've highlighted what matters most and what to do next.</p>
    </div>

    <!-- Tier message -->
    <div style="margin:24px 40px;border-radius:12px;padding:20px;background:${tc}14;border:1px solid ${tc}33;">
      <p style="font-size:13px;font-weight:700;color:#1A1B23;margin:0 0 6px;">${tierData.desc}</p>
      <p style="font-size:12px;color:#64748B;margin:0 0 6px;font-style:italic;">${tierData.urgency}</p>
      <p style="font-size:12px;font-weight:700;color:${tc};margin:0;">→ ${tierData.action}</p>
    </div>

    <!-- Category scores -->
    <div style="padding:0 40px 24px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:16px;">MATURITY BY CATEGORY</div>
      ${Object.entries(sectionScores || {}).map(([letter, d]) => {
        const pct = d.pct || 0
        const barColor = pct < 31 ? "#E11D48" : pct < 61 ? "#F59E0B" : pct < 86 ? "#0284C7" : "#10B981"
        const tierLabel = pct < 31 ? "Foundation" : pct < 61 ? "Stabilizing" : pct < 86 ? "Optimizing" : "Mature"
        return `
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:600;color:#1A1B23;">${letter} · ${esc((d.name || "").replace(/Audit$/,"").trim())}</span>
            <span style="font-size:12px;font-weight:700;font-family:monospace;color:${barColor};">${pct}% · ${tierLabel}</span>
          </div>
          <div style="height:8px;background:#EFF1F5;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:999px;"></div>
          </div>
        </div>`
      }).join("")}
    </div>

    <!-- Priorities -->
    ${(topPriorities || []).length > 0 ? `
    <div style="padding:0 40px 24px;border-top:1px solid #EFF1F5;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin:20px 0 16px;">YOUR TOP ${topPriorities.length} PRIORITIES</div>
      ${(topPriorities || []).map((p, i) => `
      <div style="display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #EFF1F5;">
        <div style="font-family:monospace;font-size:20px;font-weight:700;color:#5D3FD3;min-width:28px;padding-top:2px;">${String(i + 1).padStart(2,"0")}</div>
        <div style="flex:1;">
          <div style="font-family:monospace;font-size:10px;font-weight:700;color:#5D3FD3;margin-bottom:2px;">${esc(p.svc)}</div>
          <div style="font-size:14px;font-weight:700;color:#1A1B23;margin-bottom:6px;">${esc(p.title)}</div>
          <div style="font-size:12px;color:#64748B;line-height:1.55;margin-bottom:8px;">${esc(p.risk || "")}</div>
          <div style="display:flex;gap:8px;">
            <span style="font-family:monospace;font-size:11px;font-weight:700;color:#5D3FD3;background:#EDE9FB;padding:3px 10px;border-radius:999px;">${esc(p.tier || "")}</span>
            <span style="font-family:monospace;font-size:11px;color:#64748B;background:#F8FAFC;padding:3px 10px;border-radius:999px;">${esc(p.investRange || "")}</span>
          </div>
        </div>
      </div>`).join("")}
    </div>` : ""}

    <!-- Bundle -->
    ${matchedBundle ? `
    <div style="margin:0 40px 24px;border-radius:12px;padding:24px;background:linear-gradient(135deg,#5D3FD3,#0284C7 50%,#7DD3FC);color:#fff;">
      <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin-bottom:8px;">RECOMMENDED SOLUTION BUNDLE</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:6px;">${esc(matchedBundle.name || matchedBundle)}</div>
      ${matchedBundle.tagline ? `<div style="font-size:12px;opacity:.85;margin-bottom:12px;">${esc(matchedBundle.tagline)}</div>` : ""}
      ${matchedBundle.investRange ? `<div style="font-family:monospace;font-size:11px;font-weight:700;opacity:.9;">${esc(matchedBundle.investRange)} · ${esc(matchedBundle.timeline || "")}</div>` : ""}
    </div>` : ""}

    <!-- CTAs -->
    <div style="padding:0 40px 32px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B;margin-bottom:16px;">YOUR NEXT STEPS</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:0 6px 0 0;width:33%;vertical-align:top;">
            <a href="${SITE_URL}/contact" style="display:block;padding:16px;border:1px solid #DCDCE4;border-radius:10px;text-decoration:none;background:#F8FAFC;">
              <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Book a discovery call</div>
              <div style="font-size:11px;color:#64748B;margin-bottom:8px;">Free 30 minutes. No pitch.</div>
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:#5D3FD3;">→ Book now</div>
            </a>
          </td>
          <td style="padding:0 3px;width:33%;vertical-align:top;">
            <a href="mailto:hello@mustaphaukizuru.com?subject=Proposal%20Request" style="display:block;padding:16px;border:1px solid #DCDCE4;border-radius:10px;text-decoration:none;background:#F8FAFC;">
              <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Request a proposal</div>
              <div style="font-size:11px;color:#64748B;margin-bottom:8px;">Fixed-price. 5 business days.</div>
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:#5D3FD3;">→ Email us</div>
            </a>
          </td>
          <td style="padding:0 0 0 6px;width:33%;vertical-align:top;">
            <a href="${SITE_URL}/services" style="display:block;padding:16px;border:1px solid #DCDCE4;border-radius:10px;text-decoration:none;background:#F8FAFC;">
              <div style="font-size:13px;font-weight:700;color:#1A1B23;margin-bottom:4px;">Browse all services</div>
              <div style="font-size:11px;color:#64748B;margin-bottom:8px;">82 services with scope & pricing.</div>
              <div style="font-family:monospace;font-size:11px;font-weight:700;color:#5D3FD3;">→ View catalogue</div>
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;background:#F8FAFC;border-top:1px solid #EFF1F5;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#5D3FD3;margin-bottom:3px;">Mustapha Ukizuru</div>
      <div style="font-size:11px;color:#64748B;">Complexity, simplified. · <a href="${SITE_URL}" style="color:#0284C7;text-decoration:none;">${SITE_URL.replace("https://","")}</a></div>
      <p style="font-size:10px;color:#A0A8B8;margin-top:10px;">One-time report. You won't receive any newsletter. <a href="${SITE_URL}/privacy" style="color:#A0A8B8;">Privacy policy</a></p>
    </div>
  </div>
</div></body></html>`,
  }
}

/* ══════════════════════════════════════════════════════════════════════
   CONTROLLER
════════════════════════════════════════════════════════════════════════ */
const submitDiagnostic = asyncHandler(async (req, res) => {
  const { name, email, organization, audience, scores, sectionScores, overall, topPriorities, matchedBundle, prequal, website } = req.body || {}

  /* Honeypot — `website` is a hidden field humans never see. A filled value
   * is a bot: answer 200 so it thinks it succeeded, persist nothing, send
   * nothing. Same contract as contactController. */
  if (website) {
    logger.info("[diagnostic] honeypot tripped", { ip: req.ip })
    return res.status(200).json({ success: true, data: { queued: true } })
  }

  /* Validation */
  if (!email || !audience) {
    return res.status(400).json({ success: false, message: "email and audience are required" })
  }
  const cleanName  = name ? String(name).trim().slice(0, 120) : null
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
  const tier         = getTier(overallScore).name

  /* Persist first — leads are never lost on email failure */
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
        matchedBundle: (matchedBundle?.name || matchedBundle) || null,
      },
    })
  } catch (err) {
    logger.error("[diagnostic] DB save failed", err)
  }

  /* Generate PDF */
  let pdfBuffer = null
  try {
    pdfBuffer = await generatePdf({
      name: cleanName, organization: cleanOrg, audience: cleanAud,
      overallScore, tier, sectionScores: sectionScores || {},
      topPriorities: topPriorities || [], matchedBundle,
    })
  } catch (err) {
    logger.error("[diagnostic] PDF generation failed", err)
  }

  /* Send emails */
  const emailData = {
    name: cleanName, email: cleanEmail, organization: cleanOrg,
    audience: cleanAud, overallScore, tier,
    sectionScores: sectionScores || {},
    topPriorities: topPriorities || [],
    matchedBundle, prequal: prequal || {},
  }

  const adminMail   = buildAdminEmail(emailData)
  const visitorMail = buildVisitorEmail(emailData)

  if (pdfBuffer) {
    visitorMail.attachments = [{
      filename: `Mustapha-Ukizuru-Self-Audit-${overallScore}-${tier}.pdf`,
      content:  pdfBuffer,
      contentType: "application/pdf",
    }]
  }

  Promise.all([
    emailService.sendRawEmail({ ...adminMail,   templateKey: "diagnostic.admin" }).catch((e) => logger.error("[diagnostic] admin email failed", e)),
    emailService.sendRawEmail({ ...visitorMail, templateKey: "diagnostic.report" }).catch((e) => logger.error("[diagnostic] visitor email failed", e)),
  ]).then(() => {
    if (record?.id) {
      prisma.diagnosticSubmission.update({ where: { id: record.id }, data: { emailSent: true } }).catch(() => {})
    }
  })

  logger.info(`[diagnostic] ${cleanEmail} · ${cleanAud} · ${overallScore}/100 · ${tier}`)
  return res.status(200).json({ success: true, message: "Report submitted. Check your inbox shortly." })
})

/* GET /api/v1/admin/diagnostic — paginated list for admin UI */
const listSubmissions = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || "1"))
  const limit = Math.min(50, parseInt(req.query.limit || "25"))
  const skip  = (page - 1) * limit

  const [rows, total] = await Promise.all([
    prisma.diagnosticSubmission.findMany({
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      select: { id:true, name:true, email:true, organization:true, audience:true, overallScore:true, tier:true, matchedBundle:true, emailSent:true, createdAt:true },
    }),
    prisma.diagnosticSubmission.count(),
  ])

  return res.json({ success: true, data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } })
})

module.exports = { submitDiagnostic, listSubmissions }
