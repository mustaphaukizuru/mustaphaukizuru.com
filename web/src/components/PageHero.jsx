import { m, useReducedMotion } from "framer-motion"
import { ArrowRight, ChevronDown } from "lucide-react"
import { Link } from "react-router-dom"

/**
 * PageHero · the ONE hero component used by every public page.
 *
 * Variants:
 *   • "mesh"     — animated gradient mesh on Royal Violet · Home page only
 *   • "split"    — left content, right slot (portrait, illustration, etc.)
 *   • "solid"    — clean Royal Violet panel · sub-pages (Privacy, Terms, …)
 *   • "minimal"  — light Mist background · Cart, Compare, generic surfaces
 *
 * Universal slots:
 *   eyebrow   — small uppercase label above the title (string)
 *   title     — h1 string (the largest text on the page)
 *   highlight — optional substring of the title to wrap in the accent color
 *   subtitle  — paragraph under the title
 *   primaryCta / secondaryCta — { label, to | href, icon? }
 *   stats     — array of { value, suffix?, label } (rendered as a metric row)
 *   right     — node injected on the right side for `split` variant
 *   align     — "left" | "center" (default: variant-specific)
 *
 * Visual standards (locked):
 *   • One Innovation Gradient per viewport — only `mesh` variant uses it.
 *   • Sora display weight, line-height ≤ 1.05.
 *   • Stagger: 0.09 s between rows · 0.52 s ease-out reveal.
 *   • Respects prefers-reduced-motion (transforms suppressed, opacity kept).
 */
export default function PageHero({
  variant = "split",
  eyebrow = "",
  title = "",
  highlight = "",
  subtitle = "",
  primaryCta = null,
  secondaryCta = null,
  stats = null,
  right = null,
  align = null,
  scrollCue = false,
  bottomFade = true,
  children = null, // optional escape hatch under the CTA row
  className = "",
}) {
  const reduced = useReducedMotion()
  const isMesh = variant === "mesh"
  const isSplit = variant === "split"
  const isSolid = variant === "solid"
  const isMinimal = variant === "minimal"
  const onDark = isMesh || isSolid
  const finalAlign = align ?? (isSplit ? "left" : "left")

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.09, delayChildren: 0.05 } },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1] } },
  }

  const titleNode = renderTitle(title, highlight, onDark)

  return (
    <section
      aria-labelledby="page-hero-title"
      className={cn(
        "relative isolate overflow-hidden",
        isMinimal ? "bg-[var(--color-mist)]"
                  : isMesh ? "gradient-mesh"
                  : isSolid ? "surface-violet"
                              : "bg-[var(--color-mist)]",
        "min-h-[clamp(420px,72vh,720px)]",
        className,
      )}
    >
      {/* Decorative background, only on dark variants */}
      {onDark && <DarkAccents />}
      {isMinimal && <LightAccents />}

      <Container className="relative z-10 flex min-h-[inherit] items-center py-16 sm:py-20 lg:py-24">
        <m.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className={cn(
            "grid w-full gap-10 lg:gap-16",
            isSplit && right ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center" : "grid-cols-1",
          )}
        >
          <div className={cn(
            "flex flex-col gap-6",
            finalAlign === "center" && "items-center text-center",
          )}>
            {eyebrow && (
              <m.span
                variants={fadeUp}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.18em]",
                  onDark
                    ? "bg-white/10 text-white/85 ring-1 ring-white/15 backdrop-blur"
                    : "bg-violet-pale text-violet ring-1 ring-violet/10",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", onDark ? "bg-terracotta" : "bg-violet")} />
                {eyebrow}
              </m.span>
            )}

            <m.h1
              id="page-hero-title"
              variants={fadeUp}
              className={cn(
                "max-w-[18ch] text-display",
                onDark ? "text-on-violet" : "text-violet",
                finalAlign === "center" && "mx-auto",
              )}
            >
              {titleNode}
            </m.h1>

            {subtitle && (
              <m.p
                variants={fadeUp}
                className={cn(
                  "max-w-[60ch] text-[clamp(15px,1.5vw,18px)] leading-[1.6]",
                  onDark ? "text-on-violet-muted" : "text-on-mist-muted",
                  finalAlign === "center" && "mx-auto",
                )}
              >
                {subtitle}
              </m.p>
            )}

            {(primaryCta || secondaryCta) && (
              <m.div
                variants={fadeUp}
                className={cn(
                  "mt-1 flex flex-wrap items-center gap-3",
                  finalAlign === "center" && "justify-center",
                )}
              >
                {primaryCta && <PrimaryCta {...primaryCta} onDark={onDark} />}
                {secondaryCta && <SecondaryCta {...secondaryCta} onDark={onDark} />}
              </m.div>
            )}

            {Array.isArray(stats) && stats.length > 0 && (
              <m.dl
                variants={fadeUp}
                className={cn(
                  "mt-3 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3",
                  finalAlign === "center" && "mx-auto",
                )}
              >
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className={cn(
                      "font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                      onDark ? "text-on-violet-muted" : "text-on-mist-faint",
                    )}>
                      {s.label}
                    </dt>
                    <dd className={cn(
                      "font-mono text-[clamp(22px,3vw,32px)] font-bold tabular-nums",
                      onDark ? "text-on-violet" : "text-violet",
                    )}>
                      {s.value}{s.suffix || ""}
                    </dd>
                  </div>
                ))}
              </m.dl>
            )}

            {children && <m.div variants={fadeUp}>{children}</m.div>}
          </div>

          {isSplit && right && (
            <m.div
              variants={fadeUp}
              className="relative flex items-center justify-center"
            >
              {right}
            </m.div>
          )}
        </m.div>
      </Container>

      {scrollCue && <ScrollCue onDark={onDark} />}
      {bottomFade && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-24",
            onDark
              ? "bg-gradient-to-b from-transparent to-[var(--color-violet)]/0"
              : "bg-gradient-to-b from-transparent to-[var(--color-mist)]",
          )}
          aria-hidden="true"
        />
      )}
    </section>
  )
}

/* ─────────────────────────── sub-components ────────────────────────────── */

function PrimaryCta({ label, to, href, icon: Icon = ArrowRight, onDark = false }) {
  const className = cn(
    "group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-semibold transition",
    "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] hover:-translate-y-[1px] active:translate-y-0",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
    onDark
      ? "bg-white text-violet hover:bg-white/95 focus-visible:ring-white/40 focus-visible:ring-offset-violet"
      : "bg-violet text-white hover:bg-violet-deep focus-visible:ring-violet/35 focus-visible:ring-offset-mist",
  )
  const inner = (
    <>
      {label}
      <Icon size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </>
  )
  if (to) return <Link to={to} className={className}>{inner}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  return <button type="button" className={className}>{inner}</button>
}

function SecondaryCta({ label, to, href, icon: Icon, onDark = false }) {
  const className = cn(
    "inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[13.5px] font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
    onDark
      ? "border-white/25 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/40 focus-visible:ring-offset-violet"
      : "border-violet/25 bg-white/0 text-violet hover:bg-violet-pale focus-visible:ring-violet/35 focus-visible:ring-offset-mist",
  )
  const inner = (
    <>
      {Icon && <Icon size={15} aria-hidden="true" />}
      {label}
    </>
  )
  if (to) return <Link to={to} className={className}>{inner}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  return <button type="button" className={className}>{inner}</button>
}

function ScrollCue({ onDark }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
      <span className={cn(
        "inline-flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-[0.22em]",
        onDark ? "text-white/55" : "text-charcoal-80/45",
      )}>
        Scroll
        <ChevronDown size={14} className="animate-[bob_1.6s_ease-in-out_infinite]" aria-hidden="true" />
      </span>
      <style>{`@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }`}</style>
    </div>
  )
}

function DarkAccents() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-terracotta/15 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-32 h-[520px] w-[520px] rounded-full bg-azure/20 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:32px_32px]" />
    </>
  )
}

function LightAccents() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-violet/10 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-terracotta/15 blur-[100px]" />
    </>
  )
}

function Container({ children, className = "" }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
}

function renderTitle(title, highlight, onDark) {
  if (!highlight || !title.includes(highlight)) return title
  const [before, after] = title.split(highlight)
  return (
    <>
      {before}
      <span className={onDark ? "text-terracotta" : "text-terracotta"}>{highlight}</span>
      {after}
    </>
  )
}

function cn(...args) { return args.filter(Boolean).join(" ") }
