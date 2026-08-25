import { m } from "framer-motion"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

/**
 * SectionHeading · the standard heading used by every section on every page.
 *
 * Pattern: eyebrow → title → subtitle → optional inline action.
 *
 *   <SectionHeading
 *     eyebrow="Featured products"
 *     title="Tools that compound"
 *     subtitle="Curated digital products built from real engagements."
 *     align="center"
 *     action={{ label: "Browse store", to: "/store" }}
 *   />
 *
 * Use this everywhere instead of bespoke heading markup so a future palette
 * tweak only requires editing this one file.
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  action,
  className = "",
}) {
  const isCenter = align === "center"
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-3",
        action && !isCenter && "lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-3", isCenter && "items-center text-center")}>
        {eyebrow && (
          <m.span
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.18em] text-violet ring-1 ring-violet/10"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet" aria-hidden="true" />
            {eyebrow}
          </m.span>
        )}

        <m.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[clamp(26px,3.5vw,40px)] font-bold leading-[1.1] tracking-[-0.01em] text-violet"
        >
          {title}
        </m.h2>

        {subtitle && (
          <m.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "max-w-[64ch] text-[15px] leading-[1.65] text-on-mist-muted",
              isCenter && "mx-auto",
            )}
          >
            {subtitle}
          </m.p>
        )}
      </div>

      {action && (
        <div className={cn("shrink-0", isCenter && "mt-4")}>
          {action.to ? (
            <Link
              to={action.to}
              className="cursor-pointer group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-violet transition hover:text-violet-deep"
            >
              {action.label}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ) : action.href ? (
            <a
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-violet transition hover:text-violet-deep"
            >
              {action.label}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      )}
    </div>
  )
}

function cn(...args) { return args.filter(Boolean).join(" ") }
