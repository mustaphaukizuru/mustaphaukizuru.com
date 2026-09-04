/* ════════════════════════════════════════════════════════════════════════
   generate-service-catalog.mjs · Everything generated from the catalogue
   ────────────────────────────────────────────────────────────────────────
   Single source of truth: src/data/servicesCatalogue.js. Counts are read
   from CATALOG_STATS, never written down — the header used to say
   "21 offerings" against a catalogue of 20, which is the whole failure mode
   this script exists to prevent.

   Emits:
     public/documents/Mustapha-Ukizuru-Service-Catalog-v2.0.md   governance copy
     public/documents/Mustapha-Ukizuru-Service-Catalog-v2.0.html branded, printed
                                                                 to PDF by
                                                                 print-service-catalog.mjs
     ../docs/catalogue/services-and-categories.md      full offering reference
     ../docs/catalogue/services-and-categories.es.md   the same, in Spanish
     ../docs/catalogue/packages-and-pricing-plans.md   the nine monthly packages

   The three references under docs/catalogue/ were hand-written snapshots
   whose own headers said "regenerate after any edit; do not hand-edit prices
   here" — and nothing regenerated them. They are outputs now, and
   `npm run catalog:check` fails when the committed copy differs from a fresh
   run (T2-10).

   DETERMINISM IS LOAD-BEARING. Output must be a pure function of the source,
   or that check fails the day after every commit. Nothing here reads the
   clock: the date comes from CATALOG_LAST_UPDATED, which is bumped
   deliberately.

   Run: node scripts/generate-service-catalog.mjs
   Never hand-edit the output files; they will be overwritten.
   ════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs/promises"
import path from "node:path"
import {
  CATEGORIES, AUDIENCE_LABELS, TIER_LABELS, ENGAGEMENT_TYPES,
  HOW_IT_WORKS, CREDENTIALS, DIFFERENTIATION_PILLARS,
  AUDIENCE_PRICING_PLANS, AUDIENCE_PRICING_ORDER,
  SERVICES_FAQ_ITEMS, FAQ_CONTACT_ACTIONS, CATALOG_STATS, SERVICES, getServiceById,
  PRICING_BASIS, CATALOG_LAST_UPDATED,
  PRICING_FIXED, PRICING_RETAINER,
  QUOTE_ONLY_MXN_PER_MONTH, isQuoteOnlyTier,
  PACKAGE_OFFERING_OVERLAPS, packagesIncluding, getOfferingBySlug,
} from "../src/data/servicesCatalogue.js"

const VERSION = "2.0"
// From the catalogue, not from the clock — see the determinism note above.
// Parsed as UTC so the rendered date cannot shift by a day with the timezone
// of whichever machine runs the check.
const EFFECTIVE_DATE = new Date(`${CATALOG_LAST_UPDATED}T00:00:00Z`)
  .toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
const outDir = path.resolve(process.cwd(), "public", "documents")
const mdFile = path.join(outDir, `Mustapha-Ukizuru-Service-Catalog-v${VERSION}.md`)
const htmlFile = path.join(outDir, `Mustapha-Ukizuru-Service-Catalog-v${VERSION}.html`)

// docs/ is the documented location for project documents (CLAUDE.md, "Where
// things live"); web/docs/ was a second one nobody linked to.
const refDir = path.resolve(process.cwd(), "..", "docs", "catalogue")

const money = (n) => `$${Number(n).toLocaleString("en-US")} USD`
const mxn = (n) => `MX$${Number(n).toLocaleString("en-US")}`
const offeringPrice = (o) => {
  if (o.pricingModel === "Fixed" && o.priceMxn) return `${money(o.priceUsd)} · ${mxn(o.priceMxn)}`
  if (o.priceFromMxn) {
    const suffix = o.pricingModel === "Retainer" ? "/month" : ""
    return `From ${money(o.priceFromUsd)} · ${mxn(o.priceFromMxn)}${suffix}`
  }
  return o.pricingModel
}
const relatedNames = (o) => {
  if (!Array.isArray(o.relatedOfferings) || !o.relatedOfferings.length) return ""
  return o.relatedOfferings.map((id) => getServiceById(id)?.name).filter(Boolean).join(", ")
}
const pricingModelNote = {
  "Fixed": "Fixed scope, fixed price — confirmed in the written proposal.",
  "From quote": "Quoted after the discovery call, once scope is confirmed.",
  "Retainer": "Monthly, billed in advance. Minimum term noted per offering.",
}

/* ─────────────────────────────── markdown ─────────────────────────────── */
function buildMarkdown() {
  const lines = []
  const h = (s) => lines.push(s)

  h(`# Mustapha Ukizuru — Service Catalog`)
  h(``)
  h(`**Brand:** Technology Consulting · Digital Products · STEM and School Solutions`)
  h(`**Owner:** Mustapha Ukizuru`)
  h(`**Domain:** mustaphaukizuru.com`)
  h(`**Version:** ${VERSION}`)
  h(`**Effective Date:** ${EFFECTIVE_DATE}`)
  h(`**Review Cycle:** Quarterly`)
  h(`**Status:** Production-ready`)
  h(``)
  h(`---`)
  h(``)
  h(`## PART I — GOVERNANCE`)
  h(``)
  h(`### 1. Catalog Scope and Purpose`)
  h(``)
  h(`This catalog defines the complete set of professional services offered under the Mustapha Ukizuru brand. It is the single source of truth for what is sold, how it is sold, who it is sold to, and how it is delivered. The catalog supports four operational uses: customer-facing marketing on mustaphaukizuru.com, sales conversations and proposals, internal delivery planning, and quarterly portfolio governance. The catalog is generated directly from the production codebase (\`src/data/servicesCatalogue.js\`) so it can never drift from what the website actually offers.`)
  h(``)
  h(`### 2. Catalog Architecture`)
  h(``)
  h(`The catalog is organized in three layers, top-down:`)
  h(``)
  h(`- **Categories** — ${CATEGORIES.length} service lines, each with an independent outcome promise and its own page at \`/services/<slug>\`.`)
  h(`- **Offerings** — ${SERVICES.length} atomic, independently sellable services within the categories.`)
  h(`- **Deliverables** — the specific outputs produced within each offering.`)
  h(``)
  h(`Audience-level all-in Packages (recurring monthly plans, not project offerings) are documented separately in Part IV.`)
  h(``)
  h(`### 3. Naming Conventions`)
  h(``)
  h(`**Offering identifier schema:** \`UKZ-{CCC}-{NNN}\``)
  h(``)
  h(`- \`UKZ\` — brand prefix (Mustapha Ukizuru)`)
  h(`- \`CCC\` — three-letter category code`)
  h(`- \`NNN\` — three-digit sequential offering number within the category`)
  h(``)
  h(`**Category codes:**`)
  h(``)
  h(`| Code | Category | URL slug |`)
  h(`|------|----------|----------|`)
  for (const c of CATEGORIES) h(`| ${c.code} | ${c.name} | \`/services/${c.slug}\` |`)
  h(``)
  h(`Each offering also carries a URL-safe slug, addressable as \`/services/<category-slug>#<offering-slug>\` and bookable at \`/book?service=<offering-slug>\`.`)
  h(``)
  h(`### 4. Metadata Schema`)
  h(``)
  h(`Every offering record contains the following fields:`)
  h(``)
  h(`| Field | Description |`)
  h(`|-------|-------------|`)
  h(`| ID | UKZ-{CCC}-{NNN} unique identifier |`)
  h(`| Name | Offering name |`)
  h(`| Outcome | One-sentence value statement |`)
  h(`| Audience | Target segment(s): SMB, EDU, IND, or combinations |`)
  h(`| Engagement | Audit, Retainer, Engagement, Roadmap, Build, Integration, Migration, Implementation, or Sprint |`)
  h(`| Duration | Typical delivery timeframe |`)
  h(`| Pricing model | Fixed, From quote, or Retainer |`)
  h(`| Tier | 1 (Flagship) or 2 (Standard) |`)
  h(`| Deliverables | Specific outputs produced |`)
  h(``)
  h(`### 5. Audience Codes`)
  h(``)
  h(`| Code | Segment | Priority |`)
  h(`|------|---------|----------|`)
  for (const [code, a] of Object.entries(AUDIENCE_LABELS)) h(`| ${code} | ${a.label} | ${a.priority} |`)
  h(``)
  h(`EDU has a dedicated audience page at \`/schools\`, composed from the offerings below — it is not a fifth category.`)
  h(``)
  h(`### 6. Service Tiers`)
  h(``)
  h(`| Tier | Definition |`)
  h(`|------|------------|`)
  for (const [n, t] of Object.entries(TIER_LABELS)) h(`| ${n} | ${t.label} — ${t.description} |`)
  h(``)
  h(`### 7. Engagement Types`)
  h(``)
  h(`${ENGAGEMENT_TYPES.join(" · ")}`)
  h(``)
  h(`### 8. Lifecycle`)
  h(``)
  h(`All offerings listed in this document are **Active**. Version 2.0 retires the earlier six-category, 82-SKU taxonomy (Catalog v1.0, 29 April 2026) in full — see Appendix B.`)
  h(``)
  h(`---`)
  h(``)
  h(`## PART II — CATALOG INDEX`)
  h(``)
  h(`### 9. Master Index by Category`)
  h(``)
  for (const c of CATEGORIES) {
    h(`#### ${c.name} (${c.code}) — ${c.offerings.length} offerings`)
    h(``)
    h(`${c.tagline}`)
    h(``)
    h(`| ID | Offering | Tier | Audience | Starting price |`)
    h(`|----|----------|------|----------|----------------|`)
    for (const o of c.offerings) h(`| ${o.id} | ${o.name} | ${o.tier} | ${o.audience.join(", ")} | ${offeringPrice(o)} |`)
    h(``)
  }
  h(`### 10. Index by Audience`)
  h(``)
  for (const [code, a] of Object.entries(AUDIENCE_LABELS)) {
    const matches = SERVICES.filter((s) => s.audience.includes(code))
    h(`**${a.label} (${code})** — ${matches.length} offerings: ${matches.map((s) => s.id).join(", ")}`)
    h(``)
  }
  h(`### 11. Index by Engagement Type`)
  h(``)
  for (const eng of ENGAGEMENT_TYPES) {
    const matches = SERVICES.filter((s) => s.engagement === eng)
    if (!matches.length) continue
    h(`**${eng}** — ${matches.map((s) => s.id).join(", ")}`)
    h(``)
  }
  h(`### 12. Flagship Offerings (Tier 1)`)
  h(``)
  for (const s of SERVICES.filter((s) => s.tier === 1)) h(`- **${s.id} · ${s.name}** — ${s.description}`)
  h(``)
  h(`---`)
  h(``)
  h(`## PART III — OFFERING DETAIL`)
  h(``)
  for (const c of CATEGORIES) {
    h(`### 1${CATEGORIES.indexOf(c) + 3}. Category ${c.code} — ${c.name}`)
    h(``)
    h(`${c.outcome}`)
    h(``)
    h(`---`)
    h(``)
    for (const o of c.offerings) {
      h(`**${o.id} · ${o.name}**`)
      h(`*Tier ${o.tier} · ${o.engagement} · ${offeringPrice(o)} · ${o.duration} · ${o.audience.join(", ")}*`)
      h(`**Outcome:** ${o.description}`)
      h(`**Includes:** ${o.deliverables.join(" · ")}.`)
      if (o.priceIncludes) h(`**At the starting price:** ${o.priceIncludes}`)
      if (Array.isArray(o.priceScalesWith) && o.priceScalesWith.length) h(`**Price increases with:** ${o.priceScalesWith.join(" · ")}.`)
      if (relatedNames(o)) h(`**Often built together with:** ${relatedNames(o)}.`)
      h(``)
    }
  }
  h(`---`)
  h(``)
  h(`## PART IV — PACKAGES & PRICING`)
  h(``)
  h(`### 21. How Pricing Works`)
  h(``)
  const pricingFaq = SERVICES_FAQ_ITEMS.find((f) => f.id === "pricing")
  h(`${pricingFaq ? pricingFaq.answer : ""}`)
  h(``)
  h(`| Pricing model | What it means |`)
  h(`|----------------|----------------|`)
  for (const [model, note] of Object.entries(pricingModelNote)) h(`| ${model} | ${note} |`)
  h(``)
  h(`The ${SERVICES.length} offerings in Part III each show a starting price in both US dollars and Mexican pesos, based on a $30 USD/hour minimum rate (see the pricing methodology note in src/data/servicesCatalogue.js) — Fixed offerings are settled figures, everything else is a floor confirmed in the written proposal once scope is set. The audience Packages below are the only offerings sold at a fixed, published list price through checkout at mustaphaukizuru.com/store.`)
  h(``)
  h(`### 22. Audience Packages`)
  h(``)
  for (const key of AUDIENCE_PRICING_ORDER) {
    const p = AUDIENCE_PRICING_PLANS[key]
    if (!p) continue
    h(`#### ${p.name} — ${p.short}`)
    h(``)
    h(`${p.description}`)
    h(``)
    h(`| Tier | Monthly price (USD) | Monthly price (MXN) |`)
    h(`|------|----------------------|----------------------|`)
    for (const [tierKey, tier] of Object.entries(p.tiers)) {
      h(`| ${tier.name}${tier.popular ? " (most popular)" : ""} | ${money(tier.priceUsd)}/mo | ${money(tier.priceMxn)}/mo |`)
    }
    h(``)
  }
  h(`---`)
  h(``)
  h(`## PART V — HOW WE WORK`)
  h(``)
  h(`### 23. Engagement Process`)
  h(``)
  for (const step of HOW_IT_WORKS) h(`${step.step}. **${step.title}** — ${step.body}`)
  h(``)
  h(`### 24. Credentials`)
  h(``)
  for (const cr of CREDENTIALS) h(`- **${cr.label}** — ${cr.issuer}`)
  h(``)
  h(`### 25. Why This Practice`)
  h(``)
  for (const d of DIFFERENTIATION_PILLARS) h(`- **${d.claim}** — ${d.support}`)
  h(``)
  h(`---`)
  h(``)
  h(`## PART VI — APPENDICES`)
  h(``)
  h(`### Appendix A — Glossary`)
  h(``)
  h(`**Offering.** An atomic, independently sellable service as defined in this catalog.`)
  h(`**Package.** A recurring monthly plan sold directly through checkout, not project-based.`)
  h(`**Tier.** Offering prominence level (1 Flagship, 2 Standard).`)
  h(`**Retainer.** Recurring monthly engagement with a defined minimum term.`)
  h(`**LFPDPPP.** Mexican federal law on data protection (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).`)
  h(``)
  h(`### Appendix B — Document Revision History`)
  h(``)
  h(`| Version | Date | Author | Notes |`)
  h(`|---------|------|--------|-------|`)
  h(`| 1.0 | 29 April 2026 | Mustapha Ukizuru | Initial publication of the six-category service catalog with 82 services and 8 flagship Solutions. |`)
  h(`| ${VERSION} | ${EFFECTIVE_DATE} | Mustapha Ukizuru | Rebuilt against the production 4-category / ${SERVICES.length}-offering taxonomy. Retired the six-category, 82-SKU structure and the invented Solution bundles in full. Removed every unsourced figure. Added starting prices to all offerings, shown in both US dollars and Mexican pesos, at a $30 USD/hour minimum rate. Folded WhatsApp Lead Qualifiers into Custom AI Assistants & WhatsApp Bots (21 -> 20 offerings). Added a Related-offerings cross-reference so buyers see what else a given offering commonly needs to complete. Generated directly from \`src/data/servicesCatalogue.js\` so this document cannot drift from the live site. |`)
  h(``)
  h(`### Appendix C — Contact`)
  h(``)
  for (const a of FAQ_CONTACT_ACTIONS) h(`- **${a.title}** — ${a.desc}`)
  h(``)
  h(`---`)
  h(``)
  h(`*End of catalog. ${CATALOG_STATS.categoryCount} categories · ${CATALOG_STATS.totalServices} offerings · ${CATALOG_STATS.flagshipCount} flagship.*`)
  return lines.join("\n")
}


/* ──────────────────────────────── html ─────────────────────────────────── */
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }

function buildHtml() {
  const catSections = CATEGORIES.map((c, i) => `
    <section class="cat" style="--cat-accent: var(--color-svc-${{ "it-strategy-consulting": "strategy", "ai-automation": "automation", "cloud-architecture-migration": "cloud", "digital-product-engineering": "product" }[c.slug]})">
      <div class="cat-head">
        <span class="cat-code">${esc(c.code)}</span>
        <div>
          <h2>${esc(c.name)}</h2>
          <p class="cat-outcome">${esc(c.outcome)}</p>
        </div>
      </div>
      <div class="offerings">
        ${c.offerings.map((o) => `
          <article class="offering">
            <div class="offering-head">
              <span class="offering-id">${esc(o.id)}</span>
              <h3>${esc(o.name)}</h3>
              ${o.tier === 1 ? '<span class="flagship">Flagship</span>' : ""}
            </div>
            <p class="offering-desc">${esc(o.description)}</p>
            <dl class="offering-meta">
              <div><dt>Engagement</dt><dd>${esc(o.engagement)}</dd></div>
              <div><dt>Duration</dt><dd>${esc(o.duration)}</dd></div>
              <div><dt>Starting price</dt><dd>${esc(offeringPrice(o))}</dd></div>
              <div><dt>Audience</dt><dd>${esc(o.audience.join(", "))}</dd></div>
            </dl>
            <ul class="deliverables">
              ${o.deliverables.map((d) => `<li>${esc(d)}</li>`).join("")}
            </ul>
            ${o.priceIncludes ? `
            <div class="price-detail">
              <p>${esc(o.priceIncludes)}</p>
              ${Array.isArray(o.priceScalesWith) && o.priceScalesWith.length ? `
              <p class="price-detail-label">Price increases with:</p>
              <ul>${o.priceScalesWith.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
              ${relatedNames(o) ? `<p class="price-detail-label">Often built together with:</p><p>${esc(relatedNames(o))}</p>` : ""}
            </div>` : (relatedNames(o) ? `<div class="price-detail"><p class="price-detail-label">Often built together with:</p><p>${esc(relatedNames(o))}</p></div>` : "")}
          </article>`).join("")}
      </div>
    </section>`).join("")

  const packageCards = AUDIENCE_PRICING_ORDER.map((key) => {
    const p = AUDIENCE_PRICING_PLANS[key]
    const tiers = Object.values(p.tiers).map((t) => `
      <div class="price-tier ${t.popular ? "popular" : ""}">
        <div class="price-tier-name">${esc(t.name)}${t.popular ? " · Most popular" : ""}</div>
        <div class="price-tier-amount">${money(t.priceUsd)}<span>/mo USD</span></div>
        <div class="price-tier-mxn">${money(t.priceMxn)}/mo MXN</div>
      </div>`).join("")
    return `
      <div class="package">
        <h3>${esc(p.name)} <span>— ${esc(p.short)}</span></h3>
        <p>${esc(p.description)}</p>
        <div class="price-tiers">${tiers}</div>
      </div>`
  }).join("")

  const credentials = CREDENTIALS.map((c) => `<li><strong>${esc(c.label)}</strong> — ${esc(c.issuer)}</li>`).join("")
  const pillars = DIFFERENTIATION_PILLARS.map((d) => `<li><strong>${esc(d.claim)}</strong> — ${esc(d.support)}</li>`).join("")
  const steps = HOW_IT_WORKS.map((s) => `<li><span class="step-num">${esc(s.step)}</span><div><strong>${esc(s.title)}</strong><p>${esc(s.body)}</p></div></li>`).join("")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mustapha Ukizuru — Service Catalog v${VERSION}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --bg:#F8FAFC; --bg-elevated:#FFFFFF; --border:#E1E4EC;
  --fg:#1A1B23; --fg-muted:#54566B; --fg-subtle:#8A8CA3;
  --violet:#5D3FD3; --violet-pale:#EDE9FB;
  --color-svc-strategy:#5D3FD3; --color-svc-automation:#856212; --color-svc-cloud:#0284C7; --color-svc-product:#065F46;
  --sans:'Sora',system-ui,-apple-system,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--sans);font-size:13.5px;line-height:1.55}
.wrap{max-width:880px;margin:0 auto;padding:0 28px 60px}
h1,h2,h3{text-wrap:balance;margin:0;font-weight:800}
p{margin:0}
.cover{padding:64px 0 40px;border-bottom:3px solid var(--violet)}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--violet);margin-bottom:14px}
.cover h1{font-size:32px;color:var(--violet);letter-spacing:-0.01em}
.cover-meta{margin-top:22px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px 32px;font-size:12.5px;color:var(--fg-muted)}
.cover-meta b{color:var(--fg);font-weight:600}
.stats{margin-top:26px;display:flex;gap:28px}
.stat{font-family:var(--mono)}
.stat b{display:block;font-size:24px;color:var(--violet);font-weight:700}
.stat span{font-size:10.5px;color:var(--fg-subtle);text-transform:uppercase;letter-spacing:.08em}
.part{margin-top:44px;padding-top:20px;border-top:1px solid var(--border)}
.part-title{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--violet);margin-bottom:6px}
.part h2.section{font-size:20px;margin-bottom:14px}
.cat{margin-top:32px}
.cat-head{display:flex;gap:14px;align-items:flex-start;border-left:4px solid var(--cat-accent);padding-left:14px}
.cat-code{font-family:var(--mono);font-size:11px;font-weight:700;color:var(--cat-accent);background:color-mix(in srgb, var(--cat-accent) 12%, white);border-radius:6px;padding:3px 8px;white-space:nowrap;margin-top:3px}
.cat-head h2{font-size:17px;color:var(--fg)}
.cat-outcome{margin-top:4px;font-size:12.5px;color:var(--fg-muted)}
.offerings{margin-top:14px;display:flex;flex-direction:column;gap:10px}
.offering{border:1px solid var(--border);border-radius:10px;padding:14px 16px;background:var(--bg-elevated);page-break-inside:avoid}
.offering-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.offering-id{font-family:var(--mono);font-size:10.5px;color:var(--fg-subtle)}
.offering-head h3{font-size:13.5px;color:var(--fg)}
.flagship{margin-left:auto;font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;background:var(--violet-pale);color:var(--violet);padding:2px 7px;border-radius:99px;font-weight:700}
.offering-desc{margin-top:4px;font-size:12px;color:var(--fg-muted)}
.offering-meta{margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.offering-meta dt{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-subtle)}
.offering-meta dd{margin:1px 0 0;font-size:11.5px;font-weight:600}
.deliverables{margin:9px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:5px}
.deliverables li{font-size:10.5px;background:var(--bg);border:1px solid var(--border);border-radius:99px;padding:3px 8px;color:var(--fg-muted)}
.price-detail{margin-top:10px;padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)}
.price-detail p{font-size:11px;color:var(--fg-muted);line-height:1.5}
.price-detail-label{margin-top:7px;font-weight:700;color:var(--fg)}
.price-detail ul{margin:4px 0 0;padding-left:16px}
.price-detail li{font-size:10.5px;color:var(--fg-muted);line-height:1.5}
.packages{display:flex;flex-direction:column;gap:16px}
.package{border:1px solid var(--border);border-radius:12px;padding:16px 18px;background:var(--bg-elevated)}
.package h3{font-size:14.5px}
.package h3 span{font-weight:400;color:var(--fg-muted);font-size:12.5px}
.package p{margin-top:5px;font-size:12px;color:var(--fg-muted)}
.price-tiers{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.price-tier{border:1px solid var(--border);border-radius:9px;padding:10px 12px}
.price-tier.popular{border-color:var(--violet);background:var(--violet-pale)}
.price-tier-name{font-size:10.5px;font-weight:700;color:var(--fg-muted)}
.price-tier-amount{margin-top:4px;font-family:var(--mono);font-size:16px;font-weight:700;color:var(--violet)}
.price-tier-amount span{font-size:9.5px;font-weight:500;color:var(--fg-subtle)}
.price-tier-mxn{font-size:10px;color:var(--fg-subtle);margin-top:2px}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.steps li{display:flex;gap:12px;align-items:flex-start}
.step-num{font-family:var(--mono);font-weight:700;color:var(--violet);font-size:13px}
.steps p{font-size:12px;color:var(--fg-muted);margin-top:2px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}
ul.plain{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--fg-muted)}
.pricing-note{margin-top:12px;font-size:12px;color:var(--fg-muted);background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px 14px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11.5px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--border)}
th{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-subtle)}
.footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--border);font-size:11px;color:var(--fg-subtle);display:flex;justify-content:space-between}
@media print{ body{font-size:12.5px} .part{page-break-before:auto} }
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <div class="eyebrow">Service Catalog · Version ${VERSION}</div>
    <h1>Mustapha Ukizuru</h1>
    <p style="margin-top:6px;font-size:14px;color:var(--fg-muted)">Technology Consulting · Digital Products · STEM &amp; School Solutions</p>
    <div class="cover-meta">
      <div><b>Domain</b> mustaphaukizuru.com</div>
      <div><b>Effective date</b> ${esc(EFFECTIVE_DATE)}</div>
      <div><b>Review cycle</b> Quarterly</div>
      <div><b>Status</b> Production-ready</div>
    </div>
    <div class="stats">
      <div class="stat"><b>${CATALOG_STATS.categoryCount}</b><span>Categories</span></div>
      <div class="stat"><b>${CATALOG_STATS.totalServices}</b><span>Offerings</span></div>
      <div class="stat"><b>${CATALOG_STATS.flagshipCount}</b><span>Flagship</span></div>
      <div class="stat"><b>${CATALOG_STATS.audienceCount}</b><span>Audiences</span></div>
    </div>
  </div>

  <div class="part">
    <div class="part-title">Part I — The Offerings</div>
    <h2 class="section">Four categories, ${CATALOG_STATS.totalServices} independently sellable offerings</h2>
    ${catSections}
  </div>

  <div class="part">
    <div class="part-title">Part II — Packages &amp; Pricing</div>
    <h2 class="section">Audience packages — the only offerings with a published price</h2>
    <div class="pricing-note">${esc((SERVICES_FAQ_ITEMS.find((f) => f.id === "pricing") || {}).answer || "")}</div>
    <div class="packages" style="margin-top:16px">${packageCards}</div>
  </div>

  <div class="part">
    <div class="part-title">Part III — How We Work</div>
    <div class="two-col">
      <div>
        <h2 class="section">Engagement process</h2>
        <ol class="steps">${steps}</ol>
      </div>
      <div>
        <h2 class="section">Credentials</h2>
        <ul class="plain">${credentials}</ul>
      </div>
    </div>
    <h2 class="section" style="margin-top:26px">Why this practice</h2>
    <ul class="plain">${pillars}</ul>
  </div>

  <div class="footer">
    <span>Generated from the production catalogue — cannot drift from mustaphaukizuru.com</span>
    <span>hello@mustaphaukizuru.com</span>
  </div>
</div>
</body>
</html>`
}

/* ═══════════════════════════════════════════════════════════════════════
   Generated references (T2-10)
   ───────────────────────────────────────────────────────────────────────
   docs/catalogue/services-and-categories.md and its Spanish twin, plus
   packages-and-pricing-plans.md. These were hand-written snapshots whose
   own front matter said "regenerate after any edit; do not hand-edit
   prices here" — and nothing regenerated them, so they drifted the moment
   a price changed. Proposals and sales conversations read these files, not
   the source, which is exactly why they must not be able to disagree.

   Bilingual by construction: the catalogue carries nameEs, descriptionEs,
   durationEs, deliverablesEs, priceIncludesEs and priceScalesWithEs beside
   every English field, so the Spanish reference is the same walk with a
   different accessor rather than a translation that can rot.
   ═══════════════════════════════════════════════════════════════════════ */

const REF_STRINGS = {
  en: {
    title: "Services & Categories Reference",
    heading: "Service Catalogue — Reference",
    subtitle: (c, o) => `**${c} categories · ${o} offerings · every price shown in USD and MXN**`,
    tableHead: "| # | Category | Offerings | Primary audience |",
    promise: "Promise",
    outcome: "Outcome",
    audience: "Primary audience",
    flagship: "flagship",
    includes: "Includes at this price",
    scales: "Price increases with",
    deliverables: "Deliverables",
    paired: "Often paired with",
    from: "From",
    perMonth: "/month",
    generated: "Generated from web/src/data/servicesCatalogue.js by web/scripts/generate-service-catalog.mjs. Do not hand-edit — `npm run catalog:check` fails when this file differs from a fresh run.",
    purpose: (c, o) => `Full current-state reference of the live service catalogue — ${c} categories, ${o} offerings, pricing, deliverables and cross-references — generated from web/src/data/servicesCatalogue.js (source of truth). For briefs, proposals and sales conversations, and as a companion to engagement-process-content.md.`,
    status: "generated — run `cd web && npm run catalog:generate` after any catalogue edit; never hand-edit this file",
  },
  es: {
    title: "Referencia de Servicios y Categorías",
    heading: "Catálogo de Servicios — Referencia",
    subtitle: (c, o) => `**${c} categorías · ${o} servicios · cada precio en USD y MXN**`,
    tableHead: "| # | Categoría | Servicios | Audiencia principal |",
    promise: "Promesa",
    outcome: "Resultado",
    audience: "Audiencia principal",
    flagship: "destacado",
    includes: "Incluye a este precio",
    scales: "El precio aumenta con",
    deliverables: "Entregables",
    paired: "Suele combinarse con",
    from: "Desde",
    perMonth: "/mes",
    generated: "Generado desde web/src/data/servicesCatalogue.js por web/scripts/generate-service-catalog.mjs. No editar a mano — `npm run catalog:check` falla cuando este archivo difiere de una ejecución nueva.",
    purpose: (c, o) => `Referencia completa del catálogo de servicios vigente — ${c} categorías, ${o} servicios, precios, entregables y referencias cruzadas — generada desde web/src/data/servicesCatalogue.js (fuente de verdad). Para briefs, propuestas y conversaciones comerciales.`,
    status: "generado — ejecuta `cd web && npm run catalog:generate` tras cualquier cambio del catálogo; nunca editar este archivo a mano",
  },
}

// The Spanish field for a key, falling back to English. A missing translation
// prints the English rather than an empty bullet: a blank deliverable in a
// document a client reads is worse than one in the wrong language.
const pickLang = (obj, key, lang) => {
  if (lang !== "es") return obj[key]
  const es = obj[`${key}Es`]
  if (Array.isArray(es)) return es.length ? es : obj[key]
  return es || obj[key]
}

const refPrice = (o, s) => {
  if (o.pricingModel === PRICING_FIXED && o.priceMxn) return `${money(o.priceUsd)} · ${mxn(o.priceMxn)}`
  if (o.priceFromMxn) {
    const suffix = o.pricingModel === PRICING_RETAINER ? s.perMonth : ""
    return `${s.from} ${money(o.priceFromUsd)}${suffix} · ${mxn(o.priceFromMxn)}${suffix}`
  }
  return o.pricingModel
}

const audienceNames = (codes, lang = "en") =>
  (codes || []).map((c) => {
    const a = AUDIENCE_LABELS[c]
    if (!a) return c
    return lang === "es" ? (a.labelEs || a.label) : a.label
  }).join(" · ")

function buildServicesReference(lang = "en") {
  const s = REF_STRINGS[lang]
  const L = []
  const h = (line = "") => L.push(line)

  h("---")
  h(`title: ${s.title}`)
  h(`purpose: ${s.purpose(CATALOG_STATS.categoryCount, CATALOG_STATS.totalServices)}`)
  h(`status: ${s.status}`)
  h(`pricing_basis: ${lang === "es" ? PRICING_BASIS.noteEs : PRICING_BASIS.note}`)
  h(`last_updated: ${CATALOG_LAST_UPDATED}`)
  h("---")
  h()
  h(`# ${s.heading}`)
  h()
  h(s.subtitle(CATALOG_STATS.categoryCount, CATALOG_STATS.totalServices))
  h()
  h(s.tableHead)
  h("|---|---|---|---|")
  CATEGORIES.forEach((c, i) => {
    // Audience is the union across the category's offerings, in the
    // catalogue's own SMB → EDU → IND order, so it cannot contradict the
    // per-offering lines below it.
    const codes = ["SMB", "EDU", "IND"].filter((code) =>
      c.offerings.some((o) => (o.audience || []).includes(code)))
    h(`| ${i + 1} | ${pickLang(c, "name", lang)} | ${c.offerings.length} | ${audienceNames(codes, lang)} |`)
  })

  CATEGORIES.forEach((c, i) => {
    const codes = ["SMB", "EDU", "IND"].filter((code) =>
      c.offerings.some((o) => (o.audience || []).includes(code)))
    h()
    h("---")
    h()
    h(`## ${i + 1} · ${pickLang(c, "name", lang)}`)
    h(`*${lang === "es" ? c.name : c.nameEs}*`)
    h()
    h(`**${s.promise}:** ${pickLang(c, "tagline", lang)}`)
    h(`**${s.outcome}:** ${pickLang(c, "outcome", lang)}`)
    h(`**${s.audience}:** ${audienceNames(codes, lang)}`)

    for (const o of c.offerings) {
      h()
      h(`### ${pickLang(o, "name", lang)}${o.tier === 1 ? ` — ${s.flagship}` : ""}`)
      h(`\`${o.id}\` · ${refPrice(o, s)} · ${pickLang(o, "duration", lang)} · ${o.engagement}`)
      h(pickLang(o, "description", lang))
      const inc = pickLang(o, "priceIncludes", lang)
      if (inc) h(`**${s.includes}:** ${inc}`)
      const scales = pickLang(o, "priceScalesWith", lang)
      if (Array.isArray(scales) && scales.length) h(`**${s.scales}:** ${scales.join(" · ")}.`)
      const deliv = pickLang(o, "deliverables", lang)
      if (Array.isArray(deliv) && deliv.length) h(`**${s.deliverables}:** ${deliv.join(" · ")}.`)
      const related = (o.relatedOfferings || [])
        .map((id) => { const r = getServiceById(id); return r ? pickLang(r, "name", lang) : null })
        .filter(Boolean)
      if (related.length) h(`**${s.paired}:** ${related.join(", ")}.`)
    }
  })

  h()
  h("---")
  h()
  h(`_${s.generated}_`)
  h()
  return L.join("\n")
}

function buildPackagesReference() {
  const L = []
  const h = (line = "") => L.push(line)
  const tierKeys = ["basic", "medium", "advanced"]
  const totalPackages = AUDIENCE_PRICING_ORDER.reduce(
    (n, code) => n + Object.keys(AUDIENCE_PRICING_PLANS[code].tiers || {}).length, 0)

  h("---")
  h("title: Packages & Pricing Plans Reference")
  h(`purpose: Full current-state reference of the ${AUDIENCE_PRICING_ORDER.length} checkout subscription tracks that back /checkout/service?audience=<code>&tier=<key> — generated from web/src/data/servicesCatalogue.js (AUDIENCE_PRICING_PLANS, source of truth). Companion to services-and-categories.md, which covers the ${CATALOG_STATS.totalServices} individually-booked offerings; these are a separate, monthly, audience-segmented pricing model.`)
  h("status: generated — run `cd web && npm run catalog:generate` after any edit to AUDIENCE_PRICING_PLANS; never hand-edit this file")
  h(`pricing_basis: ${PRICING_BASIS.note}`)
  h(`last_updated: ${CATALOG_LAST_UPDATED}`)
  h("---")
  h()
  h("# Packages & Pricing Plans — Reference")
  h()
  h(`**${AUDIENCE_PRICING_ORDER.length} audience tracks × ${tierKeys.length} tiers = ${totalPackages} monthly packages.** Ongoing monthly subscriptions, distinct from the ${CATALOG_STATS.totalServices} project-based offerings in \`services-and-categories.md\`: a package is a subscription, an offering is a scoped, delivered project.`)
  h()
  h("**These prices are the static catalogue's.** The live site reads prices from `GET /services/plans` (the database, edited in /admin/services) and takes only names, descriptions and the feature matrix from the static file. When the two disagree, the site shows the database and this document shows the code.")
  h()
  // The column headers are the tiers' own display names, taken from the first
  // track. TIER_LABELS is a different thing entirely — it labels an OFFERING
  // as Flagship or Standard — and using it here printed the raw keys.
  const firstPlan = AUDIENCE_PRICING_PLANS[AUDIENCE_PRICING_ORDER[0]]
  const tierHeadings = tierKeys.map((k) => firstPlan.tiers?.[k]?.name || k)
  h("| Track | Audience | " + tierHeadings.join(" | ") + " |")
  h("|---|---|" + tierKeys.map(() => "---|").join(""))
  for (const code of AUDIENCE_PRICING_ORDER) {
    const plan = AUDIENCE_PRICING_PLANS[code]
    const cells = tierKeys.map((k) => {
      const t = plan.tiers?.[k]
      return t ? `${money(t.priceUsd)}${t.period ? `/${t.period}` : ""} · ${mxn(t.priceMxn)}` : "—"
    })
    h(`| ${plan.name} | ${plan.short} | ${cells.join(" | ")} |`)
  }
  h()
  h("Tiers at or above " + mxn(QUOTE_ONLY_MXN_PER_MONTH) + "/month, and the Business and Schools top tiers whatever their price, are **quote-only**: they link to the booking page rather than the checkout, and scope is agreed on a call before anything is charged (T2-4).")

  for (const code of AUDIENCE_PRICING_ORDER) {
    const plan = AUDIENCE_PRICING_PLANS[code]
    h()
    h("---")
    h()
    h(`## ${plan.name}`)
    h(`*${plan.short}*`)
    h()
    for (const k of tierKeys) {
      const t = plan.tiers?.[k]
      if (!t) continue
      const gated = isQuoteOnlyTier(code, k, t.priceMxn)
      h(`### ${t.name} — ${money(t.priceUsd)}${t.period ? `/${t.period}` : ""} · ${mxn(t.priceMxn)}`)
      const flags = []
      if (t.popular) flags.push("most popular")
      if (t.saveLabel) flags.push(t.saveLabel)
      flags.push(gated ? "quote-only — book a call" : `self-serve — /checkout/service?audience=${code}&tier=${k}`)
      h(`_${flags.join(" · ")}_`)
      h()
      // The feature matrix is positional: includes[i] answers features[i].
      // Printing the two together is the only way to read it, and the only
      // way a reordering shows up as a diff here.
      const features = plan.features || []
      const includes = t.includes || []
      for (let i = 0; i < features.length; i += 1) {
        h(`- ${includes[i] ? "✓" : "✗"} ${features[i]}`)
      }
      h()
    }
  }

  h("---")
  h()
  h("## Sold both ways — open pricing decision")
  h()
  h("These capabilities are sold twice: bundled into a monthly package, and as a scoped project in `services-and-categories.md`. A client comparing the two pages reaches different numbers for what looks like the same thing, so both pages now name the relationship (T2-11) — but **whether the prices should differ is not decided**.")
  h()
  h("The choice is between (a) the package is the audience default and the standalone price is the single-piece price, deliberately higher per unit, and (b) the two are parallel and these features get repriced. It becomes ADR 0007, and the Schools row also waits on T4-2's school-director interviews.")
  h()
  h("| Capability | Bundled from | Sold standalone as | Standalone price |")
  h("|---|---|---|---|")
  for (const overlap of PACKAGE_OFFERING_OVERLAPS) {
    const offering = getOfferingBySlug(overlap.offeringSlug)
    const [inc] = packagesIncluding(overlap.offeringSlug)
    if (!offering || !inc) continue
    h(`| ${overlap.feature} | ${inc.planName} ${inc.tierName} | ${offering.name} | ${refPrice(offering, REF_STRINGS.en)} |`)
  }
  h()
  h("---")
  h()
  h("_Generated from web/src/data/servicesCatalogue.js by web/scripts/generate-service-catalog.mjs. Do not hand-edit — `npm run catalog:check` fails when this file differs from a fresh run._")
  h()
  return L.join("\n")
}

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  const md = buildMarkdown()
  await fs.writeFile(mdFile, md, "utf8")
  console.log(`Wrote ${mdFile} (${md.length} bytes)`)

  const html = buildHtml()
  await fs.writeFile(htmlFile, html, "utf8")
  console.log(`Wrote ${htmlFile} (${html.length} bytes)`)

  await fs.mkdir(refDir, { recursive: true })
  const references = [
    ["services-and-categories.md", buildServicesReference("en")],
    ["services-and-categories.es.md", buildServicesReference("es")],
    ["packages-and-pricing-plans.md", buildPackagesReference()],
  ]
  for (const [name, body] of references) {
    const file = path.join(refDir, name)
    await fs.writeFile(file, body, "utf8")
    console.log(`Wrote ${file} (${body.length} bytes)`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
