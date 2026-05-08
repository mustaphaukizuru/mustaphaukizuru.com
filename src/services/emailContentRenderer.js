/**
 * emailContentRenderer.js · server-side block-to-HTML renderer.
 *
 * Mirrors the public BlogContentRenderer schema (p · h2 · h3 · list ·
 * ordered · callout · quote · button) and the inline-formatting subset
 * (**bold** · *italic* · `code` · [text](url)) but emits inlined,
 * email-client-safe HTML with zero JavaScript.
 *
 * Used by:
 *   • emailLayoutService.wrap(...) — the bodyHtml parameter
 *   • adminCampaignService — campaign body rendering
 *   • Future "newsletter digest" generator if/when it ships
 */

const { BRAND, escape, primaryButton, paragraph: layoutParagraph } = require("./emailLayoutService")

/* ── Inline formatter ─────────────────────────────────────────────────
 * Tokenising parser — never uses dangerous HTML interpolation. */

function renderInline(text = "") {
  const safe = String(text)
  const parts = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match
  while ((match = pattern.exec(safe)) !== null) {
    if (match.index > lastIndex) parts.push({ kind: "text", value: safe.slice(lastIndex, match.index) })
    const token = match[0]
    if (token.startsWith("**"))      parts.push({ kind: "bold",   value: token.slice(2, -2) })
    else if (token.startsWith("`"))  parts.push({ kind: "code",   value: token.slice(1, -1) })
    else if (token.startsWith("[")) {
      const closeBracket = token.indexOf("]")
      const label = token.slice(1, closeBracket)
      const href  = token.slice(closeBracket + 2, -1)
      parts.push({ kind: "link", label, href })
    }
    else if (token.startsWith("*"))  parts.push({ kind: "italic", value: token.slice(1, -1) })
    lastIndex = match.index + token.length
  }
  if (lastIndex < safe.length) parts.push({ kind: "text", value: safe.slice(lastIndex) })

  return parts.map((p) => {
    if (p.kind === "bold")   return `<strong style="color:${BRAND.charcoal};font-weight:700;">${escape(p.value)}</strong>`
    if (p.kind === "italic") return `<em>${escape(p.value)}</em>`
    if (p.kind === "code")   return `<code style="background:rgba(26,27,35,0.06);padding:2px 6px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.92em;color:${BRAND.violet};">${escape(p.value)}</code>`
    if (p.kind === "link")   return `<a href="${escape(p.href)}" style="color:${BRAND.violet};text-decoration:underline;font-weight:600;">${escape(p.label)}</a>`
    return escape(p.value)
  }).join("")
}

/* ── Block renderers ──────────────────────────────────────────────────── */

function renderBlock(block) {
  if (!block || typeof block !== "object") return ""
  switch (block.type) {
    case "p":
      return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${BRAND.charcoal80};">${renderInline(block.text)}</p>`

    case "h2":
      return `<h2 style="margin:24px 0 12px 0;font-size:22px;font-weight:700;line-height:1.25;color:${BRAND.violet};letter-spacing:-0.01em;">${renderInline(block.text)}</h2>`

    case "h3":
      return `<h3 style="margin:20px 0 10px 0;font-size:17px;font-weight:700;line-height:1.3;color:${BRAND.violet};">${renderInline(block.text)}</h3>`

    case "list": {
      const items = (block.items || []).map(
        (i) => `<li style="margin:0 0 6px 0;font-size:15px;line-height:1.65;color:${BRAND.charcoal80};">${renderInline(i)}</li>`
      ).join("")
      return `<ul style="margin:0 0 20px 0;padding-left:22px;">${items}</ul>`
    }

    case "ordered": {
      const items = (block.items || []).map(
        (i) => `<li style="margin:0 0 6px 0;font-size:15px;line-height:1.65;color:${BRAND.charcoal80};">${renderInline(i)}</li>`
      ).join("")
      return `<ol style="margin:0 0 20px 0;padding-left:22px;">${items}</ol>`
    }

    case "callout": {
      const variant = block.variant || "info"
      const palette =
        variant === "success" ? { border: "#10B981", bg: "#ECFDF5", title: "#065F46", text: "#047857" }
        : variant === "warning" ? { border: "#F59E0B", bg: "#FFFBEB", title: "#92400E", text: "#B45309" }
        : { border: BRAND.violet, bg: BRAND.violetPale, title: BRAND.violet, text: BRAND.charcoal80 }
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
          <tr>
            <td style="background:${palette.bg};border-left:4px solid ${palette.border};border-radius:0 12px 12px 0;padding:14px 18px;">
              ${block.title ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${palette.title};margin:0 0 6px 0;">${escape(block.title)}</div>` : ""}
              <div style="font-size:14.5px;line-height:1.65;color:${palette.text};">${renderInline(block.text)}</div>
            </td>
          </tr>
        </table>`
    }

    case "quote":
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
          <tr>
            <td style="border-left:4px solid ${BRAND.violet};padding:8px 18px;font-style:italic;font-size:16px;line-height:1.65;color:${BRAND.charcoal};">
              ${renderInline(block.text)}
              ${block.cite ? `<div style="margin-top:8px;font-style:normal;font-weight:600;font-size:12px;color:${BRAND.faint};">${escape(block.cite)}</div>` : ""}
            </td>
          </tr>
        </table>`

    case "button":
      // Marketing CTA — text + href.
      if (!block.href) return ""
      return primaryButton(block.text || "Learn more", block.href)

    case "image":
      // Plain inline image. Uses display:block to avoid Outlook
      // adding a phantom blue border on linked images.
      if (!block.src) return ""
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
          <tr>
            <td align="center">
              ${block.href
                ? `<a href="${escape(block.href)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">`
                : ""}
              <img src="${escape(block.src)}" alt="${escape(block.alt || "")}" width="536" style="display:block;max-width:100%;width:100%;height:auto;border:0;border-radius:12px;outline:none;text-decoration:none;" />
              ${block.href ? `</a>` : ""}
              ${block.caption ? `<p style="margin:8px 0 0 0;font-size:12px;color:${BRAND.faint};text-align:center;">${escape(block.caption)}</p>` : ""}
            </td>
          </tr>
        </table>`

    case "divider":
      return `<div style="border-top:1px solid rgba(26,27,35,0.08);margin:24px 0;height:0;line-height:0;">&nbsp;</div>`

    default:
      // Fallback: if it has a `text` property, render as a paragraph.
      if (typeof block.text === "string") return layoutParagraph(renderInline(block.text))
      return ""
  }
}

function renderBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ""
  return blocks.map(renderBlock).join("")
}

module.exports = { renderBlocks, renderBlock, renderInline }
