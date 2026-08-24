/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
import { motion, useReducedMotion } from "framer-motion"
import { Mail, Globe } from "lucide-react"

/**
 * SocialLinks · single source of truth for every social-button surface.
 *
 * The component normalises every social-button rendering across the platform
 * (footer, About hero, Contact page, dashboards, marketing surfaces) into one
 * brand-true, animated, accessible primitive.
 *
 * Rendering rules
 * ───────────────
 * • Icons:
 *     – Filled, single-path official brand glyphs (defined below). Each glyph
 *       matches the platform's trademark silhouette so the chip reads as the
 *       authentic brand mark on any background — never as a generic stroke
 *       icon. Color is driven by `currentColor`, which lets the same glyph
 *       look right in `filled`, `ghost`, `outline`, and `mono` variants.
 *     – Lucide React only for non-brand utility marks (Mail, Globe), where
 *       no trademark exists.
 * • Colors are the **official** platform brand colors at the time of writing.
 *   Instagram additionally uses its signature multi-stop gradient on the
 *   `filled` variant.
 * • Animation is powered by Framer Motion: spring lift + scale on hover,
 *   soft brand-tinted halo bloom, animated sheen sweep on the filled chip,
 *   tap-feedback, and a one-shot staggered entrance when the row enters
 *   the viewport. All gated by `prefers-reduced-motion`.
 *
 * Variants
 * ────────
 *   "filled" → official brand color background, white icon (default)
 *   "ghost"  → translucent surface, brand-color icon, brand-color halo on hover
 *   "outline"→ neutral outlined surface that morphs to the brand color on hover
 *   "mono"   → monochrome (white-on-dark or charcoal-on-light) — for dense rows
 *
 * Sizes:  sm (32) · md (40) · lg (44)
 * Tone:   "dark"  (default — for dark surfaces)  ·  "light"  (for light surfaces)
 *
 * Usage
 * ─────
 *   <SocialLinks platforms={["linkedin","github","instagram","whatsapp"]} />
 *   <SocialLinks platforms={DEFAULT_SOCIALS} variant="ghost" tone="dark" />
 *   <SocialLinks platforms={[
 *     { key: "linkedin", href: "https://linkedin.com/in/custom" },
 *   ]} />
 */

/* ── Official brand glyphs — filled, single-path, currentColor ─────────
 * All paths are 24×24 viewBox and use `fill="currentColor"` so the icon
 * inherits the chip's text color. This guarantees a clean white silhouette
 * on `filled` chips and the brand color on `ghost` / `outline` / `mono`
 * chips — no hollow strokes or accidental "white square" artefacts. */

/* LinkedIn — letter-only "in" glyph (FontAwesome `linkedin-in` shape).
 * Uses the official 448×512 viewBox so the "in" sits centered inside
 * the chip without the colored frame the full LinkedIn mark would carry. */
function LinkedInGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 448 512" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
    </svg>
  )
}

/* GitHub — simple-icons "github" octocat. Properly closed (`Z`) so the
 * silhouette renders solid white on the dark chip in every browser. */
function GitHubGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function InstagramGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

/* Facebook — letter-only "f" glyph (FontAwesome `facebook-f` shape).
 * Uses the official 320×512 viewBox so the "f" sits centered inside
 * the brand-colored chip; no circle frame is drawn by the path. */
function FacebookGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 320 512" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 226.91 0c-70 0-115.74 42.42-115.74 119.24v75.1H22.89V288h88.28v224h106.7V288z" />
    </svg>
  )
}

function YouTubeGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

/* ── Additional brand glyphs (X · TikTok · Threads · WhatsApp · Telegram) ─ */

function XGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function TikTokGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743 2.896 2.896 0 0 1 2.873-4.282 2.96 2.96 0 0 1 .888.108V9.71a6.323 6.323 0 0 0-1-.085A6.34 6.34 0 0 0 5.6 21.34a6.34 6.34 0 0 0 10.2-5.06V9.012a8.193 8.193 0 0 0 4.783 1.508V7.078a4.78 4.78 0 0 1-.994-.392z" />
    </svg>
  )
}

function ThreadsGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12.18 21.998h-.014C8.51 21.973 5.65 20.793 3.866 18.49 2.275 16.435 1.456 13.583 1.43 10.005v-.01C1.456 6.418 2.275 3.566 3.866 1.51 5.65-.79 8.51-1.97 12.166-1.998h.029c2.741.018 5.024.696 6.781 2.012 1.652 1.244 2.81 3.018 3.443 5.27l-1.93.541c-1.078-3.842-3.776-5.806-8.301-5.838-2.96.022-5.196.95-6.643 2.755-1.357 1.69-2.061 4.135-2.084 7.252.023 3.117.727 5.562 2.084 7.253 1.447 1.806 3.682 2.733 6.643 2.755 2.673-.02 4.439-.643 5.91-2.085 1.674-1.643 1.643-3.66 1.107-4.866-.314-.713-.886-1.305-1.65-1.74-.198 1.358-.62 2.456-1.265 3.279-.871 1.115-2.104 1.726-3.667 1.815-1.183.067-2.32-.211-3.207-.785-1.045-.677-1.66-1.717-1.728-2.928-.066-1.182.402-2.27 1.317-3.066.872-.76 2.099-1.205 3.547-1.288 1.066-.06 2.057.005 2.973.197-.122-.74-.371-1.328-.747-1.752-.516-.581-1.31-.875-2.355-.875-.875 0-1.987.245-2.696 1.302L8.572 6.96c.95-1.418 2.493-2.196 4.339-2.196 3.09 0 4.95 1.886 5.135 5.21.106.044.21.092.314.142 1.46.687 2.529 1.726 3.092 3.012.785 1.793.857 4.715-1.527 7.057-1.821 1.788-4.034 2.595-7.166 2.617z" />
    </svg>
  )
}

function WhatsAppGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

function TelegramGlyph({ className, ...rest }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.231-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

/* ── Platform registry ────────────────────────────────────────────────── */

const REGISTRY = {
  linkedin: {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/mustaphaukizuru/",
    Icon: LinkedInGlyph,
    color: "#0A66C2", // LinkedIn Blue (post-2019)
  },
  github: {
    name: "GitHub",
    href: "https://github.com/mustaphaukizuru",
    Icon: GitHubGlyph,
    color: "#181717",
  },
  instagram: {
    name: "Instagram",
    href: "https://www.instagram.com/mustaphaukizuru/",
    Icon: InstagramGlyph,
    color: "#E4405F",
    // Instagram's signature multi-stop gradient — used for the "filled" tile
    gradient:
      "linear-gradient(45deg, #515BD4 0%, #8134AF 25%, #DD2A7B 50%, #F58529 75%, #FFDC80 100%)",
  },
  facebook: {
    name: "Facebook",
    href: "https://www.facebook.com/mrukizurumustapha/",
    Icon: FacebookGlyph,
    color: "#1877F2",
  },
  x: {
    name: "X",
    href: "https://x.com/ukizurumustapha",
    Icon: XGlyph,
    color: "#000000",
  },
  twitter: {
    name: "X",
    href: "https://x.com/ukizurumustapha",
    Icon: XGlyph,
    color: "#000000",
  },
  youtube: {
    name: "YouTube",
    href: "https://www.youtube.com/@mustaphaukizuru",
    Icon: YouTubeGlyph,
    color: "#FF0000",
  },
  tiktok: {
    name: "TikTok",
    href: "https://www.tiktok.com/@mustaphaukizuru",
    Icon: TikTokGlyph,
    color: "#000000",
  },
  threads: {
    name: "Threads",
    href: "https://www.threads.net/@mustaphaukizuru",
    Icon: ThreadsGlyph,
    color: "#000000",
  },
  whatsapp: {
    name: "WhatsApp",
    href: "https://wa.me/525552139993",
    Icon: WhatsAppGlyph,
    color: "#25D366",
  },
  telegram: {
    name: "Telegram",
    href: "https://t.me/mustaphaukizuru",
    Icon: TelegramGlyph,
    color: "#229ED9", // Modern Telegram Blue
  },
  email: {
    name: "Email",
    href: "mailto:hello@mustaphaukizuru.com",
    Icon: Mail,
    color: "#5D3FD3", // Brand violet, Mustapha's deep purple
  },
  website: {
    name: "Website",
    href: "https://mustaphaukizuru.com",
    Icon: Globe,
    color: "#5D3FD3", // Royal violet, primary token
  },
}

/* ── Default + curated bundles ────────────────────────────────────────── */

export const DEFAULT_SOCIALS = [
  "linkedin",
  "github",
  "instagram",
  "facebook",
  "tiktok",
]

export const CONTACT_SOCIALS = [
  "linkedin",
  "github",
  "telegram",
  "instagram",
  "whatsapp",
]

export const FOLLOW_SOCIALS = [
  "linkedin",
  "github",
  "instagram",
  "facebook",
  "telegram",
  "whatsapp",
]

/* ── Sizing tokens ────────────────────────────────────────────────────── */
/* Chips use a refined ~42% icon-to-chip ratio. The previous 50% Apple-
 * style ratio made the glyphs feel "shouty" on the page — every brand
 * mark dominated its tile rather than sitting comfortably within it.
 * 42% is the ratio Apple News, Vercel, and Linear use for social rows:
 * the silhouette is still instantly recognizable but the chip reads as
 * a polished button first, brand emblem second. This also normalizes
 * the apparent size of glyphs with non-square viewBoxes (LinkedIn 448×512
 * "in", Facebook 320×512 "f") against the 24×24 ones (GitHub, Instagram,
 * TikTok) — the wider letter glyphs no longer feel chunkier.
 *
 * Box dimensions are square (h-X w-X), so every chip in a row renders
 * identically regardless of which brand it represents. */

const SIZE = {
  sm: { box: "h-9 w-9",   icon: "h-[15px] w-[15px]", radius: "rounded-full", gap: "gap-2"   },
  md: { box: "h-11 w-11", icon: "h-[18px] w-[18px]", radius: "rounded-full", gap: "gap-2.5" },
  lg: { box: "h-12 w-12", icon: "h-[20px] w-[20px]", radius: "rounded-full", gap: "gap-3"   },
}

/* ── Motion variants ──────────────────────────────────────────────────── */

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function SocialLinks({
  platforms = DEFAULT_SOCIALS,
  variant = "filled", // filled · ghost · outline · mono
  size = "md", // sm · md · lg
  tone = "dark", // dark surface · light surface (only used by ghost/mono/outline)
  align = "center", // start · center · end
  ariaLabel = "Social media",
  className = "",
}) {
  const reduce = useReducedMotion()
  const sizing = SIZE[size] || SIZE.md
  const justify =
    align === "start" ? "justify-start" :
    align === "end" ? "justify-end" :
                        "justify-center"

  // Normalise platform list: accepts "linkedin" | { key, href, name, color }
  const items = platforms
    .map((p) => {
      if (typeof p === "string") return REGISTRY[p] ? { key: p, ...REGISTRY[p] } : null
      const base = REGISTRY[p?.key] || {}
      const merged = { ...base, ...p }
      return merged.Icon && merged.href ? { key: p.key, ...merged } : null
    })
    .filter(Boolean)

  return (
    <motion.ul
      role="list"
      aria-label={ariaLabel}
      variants={reduce ? undefined : containerVariants}
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-40px" }}
      className={`flex flex-wrap items-center ${justify} ${sizing.gap} ${className}`}
    >
      {items.map((item) => (
        <SocialChip
          key={item.key}
          item={item}
          variant={variant}
          tone={tone}
          sizing={sizing}
          reduce={reduce}
        />
      ))}
    </motion.ul>
  )
}

/* ── Single chip (animated, brand-tinted halo) ────────────────────────── */

function SocialChip({ item, variant, tone, sizing, reduce }) {
  const isMail = typeof item.href === "string" && item.href.startsWith("mailto:")
  const target = isMail ? undefined : "_blank"
  const rel = isMail ? undefined : "noopener noreferrer"

  // Surface treatment per variant
  const surface = surfaceClasses(variant, tone)

  // Background style for "filled": brand color or gradient (Instagram)
  const filledStyle =
    variant === "filled"
      ? item.gradient
        ? { background: item.gradient }
        : { backgroundColor: item.color }
      : undefined

  // CSS variable lets per-platform brand color drive halo + outline-hover
  const cssVars = { "--brand": item.color }

  return (
    <motion.li
      variants={reduce ? undefined : itemVariants}
      className="ukz-social-chip relative isolate"
      style={cssVars}
    >
      {/* Brand-tinted halo — blooms OUTSIDE the clipped chip on hover.
          Lives on the <li> so the link's overflow-hidden can't clip it. */}
      <span
        aria-hidden="true"
        className="ukz-social-halo pointer-events-none absolute -inset-2 rounded-full opacity-0 blur-[14px] transition-opacity duration-300"
        style={{ backgroundColor: item.color, zIndex: 0 }}
      />

      <motion.a
        href={item.href}
        target={target}
        rel={rel}
        aria-label={item.name}
        title={item.name}
        whileHover={reduce ? undefined : { y: -3, scale: 1.07 }}
        whileTap={reduce ? undefined : { scale: 0.93 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        style={filledStyle}
        className={[
          "relative z-[1] inline-flex items-center justify-center overflow-hidden",
          sizing.box,
          sizing.radius,
          "transition-[box-shadow,border-color,background-color,color]",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--brand)]/40 focus-visible:ring-offset-2",
          tone === "dark" ? "focus-visible:ring-offset-charcoal" : "focus-visible:ring-offset-white",
          surface,
        ].join(" ")}
      >
        {/* Filled-variant only — premium dimensional finish:
            a) glossy top-down highlight (light-from-above)
            b) inner highlight ring on the top edge
            c) animated sheen sweep on hover
            These values are deliberately the originals that produced
            the Footer's current look — every other surface uses the
            same component and inherits the exact same finish. */}
        {variant === "filled" ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0) 100%)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/25"
            />
            <span
              aria-hidden="true"
              className="ukz-social-sheen pointer-events-none absolute inset-0 overflow-hidden rounded-full"
            >
              <span className="absolute -inset-y-2 -left-1/2 w-1/2 -skew-x-12 bg-white/35 opacity-0 blur-md" />
            </span>
          </>
        ) : null}

        {/* Brand glyphs are forced to white on `filled` and `mono` chips
            via an explicit inline style, so the silhouette never depends
            on Tailwind text-color inheritance. Every brand has a white
            symbol on its tile (the in / GH / IG / f / play / phone /
            paper-plane glyph) — making white explicit guarantees the
            chip reads correctly even if a parent surface accidentally
            overrides currentColor. The subtle drop-shadow keeps the
            silhouette crisp on every brand color. */}
        <item.Icon
          className={`relative z-[1] ${sizing.icon} ${
            variant === "filled" || variant === "mono"
              ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.30)]"
              : ""
          }`}
          style={
            variant === "filled" || variant === "mono"
              ? { color: "#FFFFFF" }
              : undefined
          }
        />
      </motion.a>

      <style>{`
        .ukz-social-chip:hover .ukz-social-halo { opacity: 0.55; }
        .ukz-social-chip:hover .ukz-social-sheen > span {
          animation: ukz-sheen-sweep 0.9s ease forwards;
        }
        @keyframes ukz-sheen-sweep {
          from { transform: translateX(-30%) skewX(-12deg); opacity: 0; }
          50% { opacity: 0.9; }
          to { transform: translateX(260%) skewX(-12deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ukz-social-chip .ukz-social-sheen > span { animation: none !important; }
        }
      `}</style>
    </motion.li>
  )
}

/* ── Surface presets per variant + tone ───────────────────────────────── */

function surfaceClasses(variant, tone) {
  switch (variant) {
    case "ghost":
      // Translucent surface that picks up the brand color on hover.
      return tone === "light"
        ? "border border-charcoal-80/10 bg-charcoal-80/5 text-charcoal-80/75 hover:bg-[color:var(--brand)]/10 hover:text-[color:var(--brand)] hover:border-[color:var(--brand)]/30 hover:shadow-[0_10px_28px_-8px_color-mix(in_srgb,var(--brand)_55%,transparent)]"
        : "border border-white/12 bg-white/[0.06] text-white/75 backdrop-blur-sm hover:bg-[color:var(--brand)]/15 hover:text-white hover:border-[color:var(--brand)]/45 hover:shadow-[0_10px_28px_-8px_color-mix(in_srgb,var(--brand)_55%,transparent)]"

    case "outline":
      return tone === "light"
        ? "border border-charcoal-80/15 bg-white text-charcoal-80/80 hover:bg-[color:var(--brand)] hover:text-white hover:border-[color:var(--brand)] hover:shadow-[0_12px_30px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)]"
        : "border border-white/30 bg-transparent text-white/90 hover:bg-[color:var(--brand)] hover:text-white hover:border-[color:var(--brand)] hover:shadow-[0_12px_30px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)]"

    case "mono":
      return tone === "light"
        ? "bg-charcoal-80 text-white hover:bg-[color:var(--brand)] hover:shadow-[0_10px_28px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)]"
        : "bg-white/12 text-white hover:bg-[color:var(--brand)] hover:shadow-[0_10px_28px_-8px_color-mix(in_srgb,var(--brand)_60%,transparent)]"

    case "filled":
    default:
      // Brand color (or Instagram gradient) inline-styled on the link itself.
      return "text-white shadow-[0_8px_22px_-6px_color-mix(in_srgb,var(--brand)_55%,transparent)] ring-1 ring-black/[0.05] hover:shadow-[0_14px_34px_-6px_color-mix(in_srgb,var(--brand)_70%,transparent)]"
  }
}
