/**
 * emailLayoutService.js · brand-aligned HTML wrapper for transactional
 * AND marketing emails.
 *
 * Email clients are stuck in 2002 — Outlook still renders with Word's
 * HTML engine, Gmail strips half of <head>, and dark mode flips colours
 * unpredictably. This module returns inlined, table-based HTML that
 * renders correctly across Gmail · Outlook · Apple Mail · Hostinger
 * webmail · iOS Mail · Android Gmail.
 *
 * Brand contract
 * ──────────────
 *  • Royal Violet (#5D3FD3) header, Soft Terracotta (#E76F51) accent,
 *    Charcoal (#1A1B23) body text, Mist (#F8FAFC) outer canvas.
 *  • Logo-mark "M" in a violet rounded square at the top.
 *  • Five-platform social-media row in the footer (LinkedIn · GitHub ·
 *    Instagram · Facebook · WhatsApp) with bulletproof colored circle
 *    buttons (no SVG dependency — every email client renders <a> + bg).
 *  • Single primary CTA helper, plus a secondary text-link helper.
 *  • Unsubscribe + manage-preferences links rendered automatically when
 *    `unsubscribeUrl` is provided.
 *
 * Public surface
 * ──────────────
 *   wrap({ preheader, eyebrow, bodyHtml, unsubscribeUrl, footerNote })
 *   primaryButton(text, href)
 *   secondaryLink(text, href)
 *   paragraph(text)
 *   spacer(px = 16)
 *   divider()
 *   calloutCard(html)
 *   socialBar()  — exposed so seed scripts can pin one without re-wrapping
 */

const BRAND = {
  violet:      "#5D3FD3",
  violetDeep:  "#4A2EAB",
  violetPale:  "#EDE9FB",
  terracotta:  "#E76F51",
  charcoal:    "#1A1B23",
  charcoal80:  "#3F4047",
  mist:        "#F8FAFC",
  faint:       "#8C8D92",
}

const SITE_URL      = process.env.PUBLIC_SITE_URL || "https://mustaphaukizuru.com"
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL   || "hello@mustaphaukizuru.com"
const ADDRESS       = "Tlalnepantla de Baz, Estado de México, México"

/* ── Social platform registry ──────────────────────────────────────────
 * Each entry: { name, url, color, glyph } where glyph is a 1-2 char
 * representation that renders in pure HTML (no SVG / no images). The
 * letter is centered inside a colored circular <a>. */

const SOCIALS = [
  { name: "LinkedIn",  url: "https://www.linkedin.com/in/mustaphaukizuru/",  color: "#0A66C2", glyph: "in" },
  { name: "GitHub",    url: "https://github.com/mustaphaukizuru",            color: "#181717", glyph: "GH" },
  { name: "Instagram", url: "https://www.instagram.com/mustaphaukizuru/",    color: "#E4405F", glyph: "IG" },
  { name: "Facebook",  url: "https://www.facebook.com/mrukizurumustapha/",   color: "#1877F2", glyph: "f"  },
  { name: "WhatsApp",  url: "https://wa.me/525552139993",                    color: "#25D366", glyph: "WA" },
]

/* ── Helpers ──────────────────────────────────────────────────────────── */

function escape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function paragraph(html) {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:${BRAND.charcoal80};">${html}</p>`
}

function spacer(px = 16) {
  return `<div style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</div>`
}

function divider() {
  return `<div style="border-top:1px solid rgba(26,27,35,0.08);margin:24px 0;height:0;line-height:0;">&nbsp;</div>`
}

function calloutCard(html) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background:${BRAND.violetPale};border-left:4px solid ${BRAND.violet};border-radius:0 12px 12px 0;padding:16px 20px;">
          <div style="font-size:14px;line-height:1.6;color:${BRAND.charcoal80};">${html}</div>
        </td>
      </tr>
    </table>`
}

/**
 * Bulletproof primary CTA — table+VML so Outlook honours rounded corners.
 */
function primaryButton(text, href) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;">
      <tr>
        <td align="center" bgcolor="${BRAND.violet}" style="border-radius:999px;background:${BRAND.violet};">
          <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;letter-spacing:0.01em;line-height:1;">
            ${escape(text)} &rarr;
          </a>
        </td>
      </tr>
    </table>`
}

function secondaryLink(text, href) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${BRAND.violet};font-weight:600;text-decoration:underline;">${escape(text)}</a>`
}

/**
 * Social media row — five colored circle buttons with platform glyphs.
 * Renders as <a> + background-color + border-radius. Outlook collapses
 * border-radius gracefully to squares; every other client honours it.
 */
function socialBar() {
  const cells = SOCIALS.map((s) => `
    <td align="center" valign="middle" style="padding:0 6px;">
      <a href="${s.url}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;width:34px;height:34px;line-height:34px;background:${s.color};border-radius:999px;text-align:center;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11.5px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0;">
        ${s.glyph}
      </a>
    </td>`).join("")
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>${cells}</tr>
    </table>`
}

/**
 * Compose the finished email document.
 *
 * @param {object}  opts
 * @param {string}  opts.preheader        — invisible inbox preview text
 * @param {string}  opts.eyebrow          — small label above the heading
 *                                          (e.g. "Welcome", "Order")
 * @param {string}  opts.bodyHtml         — sender's authored content
 * @param {string?} opts.unsubscribeUrl   — when present, renders the
 *                                          GDPR/CAN-SPAM unsubscribe row
 * @param {string?} opts.footerNote       — optional small disclaimer
 * @param {string?} opts.preferencesUrl   — optional link to email
 *                                          preference centre
 */
function wrap({ preheader = "", eyebrow = "", bodyHtml = "", unsubscribeUrl = null, preferencesUrl = null, footerNote = null }) {
  const year = new Date().getFullYear()
  const eyebrowHtml = eyebrow
    ? `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.violet};margin:0 0 12px 0;">${escape(eyebrow)}</div>`
    : ""

  const unsubHtml = unsubscribeUrl
    ? `
      <tr>
        <td align="center" style="padding:6px 0 0 0;">
          <p style="margin:0;font-size:11.5px;color:${BRAND.faint};line-height:1.6;">
            You are receiving this email because you subscribed at <a href="${SITE_URL}" style="color:${BRAND.faint};text-decoration:underline;">mustaphaukizuru.com</a>.
            ${preferencesUrl ? `<a href="${preferencesUrl}" style="color:${BRAND.faint};text-decoration:underline;">Manage preferences</a> · ` : ""}
            <a href="${unsubscribeUrl}" style="color:${BRAND.faint};text-decoration:underline;">Unsubscribe</a>
          </p>
        </td>
      </tr>`
    : ""

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Mustapha Ukizuru</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.mist};font-family:'Helvetica Neue',Arial,sans-serif;color:${BRAND.charcoal};">
    <span style="display:none;visibility:hidden;opacity:0;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</span>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.mist}">
      <tr>
        <td align="center" style="padding:32px 16px 16px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;border:1px solid rgba(26,27,35,0.08);box-shadow:0 20px 60px -20px rgba(93,63,211,0.15);overflow:hidden;">

            <!-- Brand header -->
            <tr>
              <td style="background:linear-gradient(135deg, ${BRAND.violet} 0%, ${BRAND.violetDeep} 100%);padding:24px 32px;" bgcolor="${BRAND.violet}">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td valign="middle" style="padding-right:12px;">
                            <div style="width:36px;height:36px;background:#ffffff;border-radius:8px;text-align:center;line-height:36px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:800;color:${BRAND.violet};">M</div>
                          </td>
                          <td valign="middle">
                            <a href="${SITE_URL}" style="text-decoration:none;color:#ffffff;font-weight:700;font-size:15px;letter-spacing:-0.01em;">
                              Mustapha Ukizuru
                            </a>
                            <div style="font-size:11px;color:rgba(255,255,255,0.75);font-weight:500;letter-spacing:0.04em;">Technology · Digital Products · STEM</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                ${eyebrowHtml}
                ${bodyHtml}
              </td>
            </tr>

            <!-- Replies / support row -->
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0;font-size:12.5px;line-height:1.65;color:${BRAND.faint};">
                  Replies go to <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.violet};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>.
                  ${footerNote ? `<br/>${footerNote}` : ""}
                </p>
              </td>
            </tr>

            <!-- Social media row -->
            <tr>
              <td align="center" style="padding:8px 32px 24px 32px;border-top:1px solid rgba(26,27,35,0.06);">
                <p style="margin:16px 0 12px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.faint};text-align:center;">Follow along</p>
                ${socialBar()}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background:${BRAND.charcoal};padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center">
                      <p style="margin:0 0 6px 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">
                        Mustapha Ukizuru
                      </p>
                      <p style="margin:0 0 6px 0;font-size:11.5px;color:rgba(255,255,255,0.65);line-height:1.6;">
                        ${escape(ADDRESS)}
                      </p>
                      <p style="margin:0;font-size:11.5px;color:rgba(255,255,255,0.65);">
                        © ${year} Mustapha Ukizuru &nbsp;·&nbsp;
                        <a href="${SITE_URL}" style="color:rgba(255,255,255,0.85);text-decoration:underline;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
                      </p>
                    </td>
                  </tr>
                  ${unsubHtml}
                </table>
              </td>
            </tr>
          </table>

          <!-- Off-canvas legal print -->
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:12px;">
            <tr>
              <td align="center" style="padding:8px 16px;">
                <p style="margin:0;font-size:11px;color:${BRAND.faint};line-height:1.5;">
                  Sent with care from Mexico. Need help? Email
                  <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.faint};text-decoration:underline;">${SUPPORT_EMAIL}</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

module.exports = {
  BRAND,
  SITE_URL,
  SUPPORT_EMAIL,
  SOCIALS,
  wrap,
  primaryButton,
  secondaryLink,
  paragraph,
  spacer,
  divider,
  calloutCard,
  socialBar,
  escape,
}
