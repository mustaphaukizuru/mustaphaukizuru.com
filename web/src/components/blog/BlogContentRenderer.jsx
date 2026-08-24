/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
/* ════════════════════════════════════════════════════════════════════════
   BlogContentRenderer · typed renderer for blog post body blocks.
   ────────────────────────────────────────────────────────────────────────
   Supported block types: p · h2 · h3 · list · ordered · callout · quote.
   Unknown types are skipped silently so future content shape additions
   never break a published page (they just no-op until the renderer
   learns the type).

   Inline formatting inside `text` fields and list items:
     **bold**     → <strong>
     *italic*     → <em>
     `code`       → <code>
     [text](url)  → React Router <Link> for internal, <a> for external

   No `dangerouslySetInnerHTML` anywhere on this surface — every token
   is parsed deterministically and rendered as a real React node.
   ════════════════════════════════════════════════════════════════════════ */

import { Fragment, useState } from "react"
import { Link } from "react-router-dom"
import { Info, CheckCircle2, AlertTriangle, Quote, Copy, Check, PlayCircle } from "lucide-react"

import { useTranslation } from "react-i18next"

// Inject the midCTA after this block index (0-based, so index 2 = after 3rd block)
const MID_CTA_AFTER_INDEX = 2

/* ── Shared utilities — also used by BlogPostPage for TOC ──────────────── */

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export function extractTOC(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks
    .filter((b) => b.type === "h2" || b.type === "h3")
    .map((b) => ({ id: slugify(b.text), text: b.text, level: b.type === "h2" ? 2 : 3 }))
}

export default function BlogContentRenderer({ blocks, midCTA }) {
  const { t } = useTranslation("blog")
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return (
      <p className="text-[15px] leading-7 text-charcoal-80/65">
        {t("content.placeholder")}
      </p>
    )
  }
  return (
    <div className="flex flex-col">
      {blocks.map((block, i) => (
        <Fragment key={i}>
          {renderBlock(block)}
          {midCTA && i === MID_CTA_AFTER_INDEX ? midCTA : null}
        </Fragment>
      ))}
    </div>
  )
}

function renderBlock(block) {
  if (!block || typeof block !== "object") return null
  switch (block.type) {
    case "p":
      return (
        <p className="mt-5 text-[15.5px] leading-8 text-charcoal-80/85 first:mt-0">
          {renderInline(block.text)}
        </p>
      )

    case "h2":
      return (
        <h2
          id={slugify(block.text)}
          className="mt-12 scroll-mt-24 text-[24px] font-bold leading-tight tracking-tight text-violet first:mt-0 sm:text-[26px]"
        >
          {renderInline(block.text)}
        </h2>
      )

    case "h3":
      return (
        <h3
          id={slugify(block.text)}
          className="mt-9 scroll-mt-24 text-[19px] font-bold leading-tight text-violet first:mt-0 sm:text-[20px]"
        >
          {renderInline(block.text)}
        </h3>
      )

    case "list":
      return (
        <ul role="list" className="mt-5 flex flex-col gap-2">
          {(block.items || []).map((item, i) => (
            <li
              key={i}
              className="relative pl-6 text-[15.5px] leading-7 text-charcoal-80/85 before:absolute before:left-1.5 before:top-[14px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-violet"
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )

    case "ordered":
      return (
        <ol className="mt-5 flex flex-col gap-2.5">
          {(block.items || []).map((item, i) => (
            <li
              key={i}
              className="relative pl-9 text-[15.5px] leading-7 text-charcoal-80/85"
            >
              <span className="absolute left-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet/10 font-mono text-[12px] font-bold text-violet">
                {i + 1}
              </span>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      )

    case "callout": {
      const variant = block.variant || "info"
      const Icon =
        variant === "success" ? CheckCircle2 :
        variant === "warning" ? AlertTriangle :
                                Info
      const styles =
        variant === "success"
          ? "border-mint/20/70 bg-mint/10 text-emerald-800"
          : variant === "warning"
          ? "border-amber/20/70 bg-amber/10 text-amber-700"
          : "border-violet/20 bg-violet-pale/40 text-charcoal-80/85"
      const iconColor =
        variant === "success" ? "text-emerald-700" :
        variant === "warning" ? "text-amber-700" :
                                "text-violet"
      return (
        <aside className={`mt-7 flex gap-3 rounded-2xl border p-5 ${styles}`}>
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
          <div className="min-w-0">
            {block.title ? (
              <p className="text-[12px] font-bold uppercase tracking-[0.16em]">
                {block.title}
              </p>
            ) : null}
            <p className={`text-[14.5px] leading-7 ${block.title ? "mt-1.5" : ""}`}>
              {renderInline(block.text)}
            </p>
          </div>
        </aside>
      )
    }

    case "quote":
      return (
        <figure className="mt-8 rounded-2xl border-l-4 border-violet bg-violet-pale/30 px-6 py-5">
          <Quote className="h-4 w-4 text-violet/60" aria-hidden="true" />
          <blockquote className="mt-2 text-[16.5px] italic leading-8 text-charcoal-80/85">
            {renderInline(block.text)}
          </blockquote>
          {block.cite ? (
            <figcaption className="mt-2 text-[12.5px] font-semibold text-charcoal-80/55">
              — {block.cite}
            </figcaption>
          ) : null}
        </figure>
      )

    case "code":
      return <CodeBlock block={block} />

    case "image":
      return <ImageBlock block={block} />

    case "video":
      return <VideoBlock block={block} />

    case "takeaways":
      return (
        <div className="mt-7 overflow-hidden rounded-2xl border border-violet/25 bg-violet-pale/40">
          <div className="border-b border-violet/15 px-5 py-3 sm:px-6">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {block.title || "Key takeaways"}
            </p>
          </div>
          <ul className="flex flex-col gap-3 px-5 py-4 sm:px-6 sm:py-5">
            {(block.items || []).map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[14.5px] leading-6 text-charcoal-80/85">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet text-white"
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {renderInline(item)}
              </li>
            ))}
          </ul>
        </div>
      )

    default:
      return null
  }
}

/* ── Code block with copy button ─────────────────────────────────────── */
function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false)
  const code = block.code || block.text || ""
  const lang  = block.lang || "code"

  function copy() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-charcoal-80/20 bg-[var(--color-charcoal)]">
      {/* Header bar: language label + copy button */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
          {lang}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          {copied
            ? <><Check className="h-3.5 w-3.5 text-mint" aria-hidden="true" />Copied</>
            : <><Copy className="h-3.5 w-3.5"            aria-hidden="true" />Copy</>}
        </button>
      </div>
      {/* Code body — JetBrains Mono, scrollable */}
      <pre className="overflow-x-auto px-5 py-4">
        <code className="font-mono text-[13.5px] leading-7 text-[var(--color-code-fg)]">
          {code}
        </code>
      </pre>
    </div>
  )
}

/* ── Image block ─────────────────────────────────────────────────────── */
function ImageBlock({ block }) {
  if (!block.src) return null
  return (
    <figure className="mt-8">
      <div className="overflow-hidden rounded-2xl bg-charcoal-80/[0.04]">
        <img
          src={block.src}
          alt={block.alt || ""}
          loading="lazy"
          className="w-full object-cover"
        />
      </div>
      {block.caption ? (
        <figcaption className="mt-2 text-center text-[12.5px] italic text-charcoal-80/50">
          {block.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/* ── Video embed block ───────────────────────────────────────────────── */
function getPublicEmbedUrl(raw) {
  try {
    const url = new URL(raw)
    if (url.hostname.includes("youtube.com") && url.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${url.searchParams.get("v")}`
    }
    if (url.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${url.pathname}`
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.replace(/\//g, "")
      return `https://player.vimeo.com/video/${id}`
    }
  } catch { /* invalid URL */ }
  return ""
}

function VideoBlock({ block }) {
  const embed = getPublicEmbedUrl(block.url || "")
  if (!embed) return null
  return (
    <figure className="mt-8">
      <div className="relative w-full overflow-hidden rounded-2xl bg-charcoal-80/[0.04]" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embed}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title={block.caption || "Video"}
        />
      </div>
      {block.caption ? (
        <figcaption className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] italic text-charcoal-80/50">
          <PlayCircle className="h-3.5 w-3.5 text-violet/60" aria-hidden="true" />
          {block.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

/* ── Inline formatter ────────────────────────────────────────────────── */

function renderInline(text) {
  if (text == null) return null
  if (typeof text !== "string") return text

  const parts = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, match.index) })
    }
    const token = match[0]

    if (token.startsWith("**")) {
      parts.push({ kind: "bold", value: token.slice(2, -2) })
    } else if (token.startsWith("`")) {
      parts.push({ kind: "code", value: token.slice(1, -1) })
    } else if (token.startsWith("[")) {
      const closeBracket = token.indexOf("]")
      const label = token.slice(1, closeBracket)
      const href = token.slice(closeBracket + 2, -1)
      parts.push({ kind: "link", label, href })
    } else if (token.startsWith("*")) {
      parts.push({ kind: "italic", value: token.slice(1, -1) })
    }

    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) })
  }

  return parts.map((part, i) => {
    switch (part.kind) {
      case "bold":
        return <strong key={i} className="font-bold text-charcoal-80">{part.value}</strong>
      case "italic":
        return <em key={i} className="italic">{part.value}</em>
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-charcoal-80/[0.06] px-1.5 py-0.5 font-mono text-[13.5px] text-violet"
          >
            {part.value}
          </code>
        )
      case "link":
        return renderLink(part, i)
      default:
        return <Fragment key={i}>{part.value}</Fragment>
    }
  })
}

/* Internal vs external link detection: relative URLs ("/contact") use
 * React Router's <Link>; everything else opens in a new tab with
 * rel=noopener,noreferrer. */
function renderLink({ label, href }, key) {
  const isExternal = /^https?:\/\//i.test(href)
  const className =
    "font-semibold text-violet underline decoration-violet/30 underline-offset-2 transition hover:decoration-violet"
  if (isExternal) {
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    )
  }
  return (
    <Link key={key} to={href} className={className}>
      {label}
    </Link>
  )
}
