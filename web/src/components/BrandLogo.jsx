import logoCharcoal from "../assets/logo-full/mu-logo-charcoal.svg"
import logoWhite from "../assets/logo-full/mu-logo-white.svg"
import markCharcoal from "../assets/logo-mark/m-mark-charcoal.svg"
import markViolet from "../assets/logo-mark/m-mark-violet.svg"
import markWhite from "../assets/logo-mark/m-mark-white.svg"
import markAzure from "../assets/logo-mark/m-mark-azure.svg"
import markTerra from "../assets/logo-mark/m-mark-terracotta.svg"

/**
 * BrandLogo · single source of truth for logo rendering
 *
 * Variants:
 *   "full"  → Mustapha Ukizuru wordmark + mark (default)
 *   "mark"  → just the M monogram (compact UI)
 *   "stack" → mark above the wordmark (vertical pair)
 *
 * Theme:
 *   "auto"     → uses prefers-color-scheme + data-theme on <html>
 *   "light"    → charcoal logo for use on light/mist backgrounds
 *   "dark"     → white logo for use on violet/charcoal backgrounds
 *   "violet"   → violet mark for use on white tiles (e.g. inside a chip)
 *   "azure"    → azure mark accent
 *   "terra"    → terracotta mark accent
 *
 * Sizes are explicit pixel values — `size` for `mark`, `height` for `full`
 * (wordmarks lock aspect ratio).
 *
 * Examples:
 *   <BrandLogo variant="full" theme="light" height={28} />
 *   <BrandLogo variant="mark" theme="violet" size={36} />
 *   <BrandLogo variant="stack" theme="dark" height={32} />
 */
export default function BrandLogo({
  variant = "full",
  theme = "auto",
  height = 28,
  size = 32,
  className = "",
  alt = "Mustapha Ukizuru",
  ...rest
}) {
  const resolved = theme === "auto" ? "light" : theme

  if (variant === "mark") {
    const src = pickMark(resolved)
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={cn("block select-none", className)}
        draggable={false}
        {...rest}
      />
    )
  }

  if (variant === "stack") {
    return (
      <span className={cn("inline-flex flex-col items-center gap-2", className)} {...rest}>
        <img src={pickMark(resolved)} alt="" width={Math.round(height * 1.4)} height={Math.round(height * 1.4)} aria-hidden="true" draggable={false} />
        <img src={pickFull(resolved)} alt={alt} height={height} draggable={false} />
      </span>
    )
  }

  // full
  return (
    <img
      src={pickFull(resolved)}
      alt={alt}
      height={height}
      className={cn("block h-[var(--brand-h)] w-auto select-none", className)}
      style={{ "--brand-h": `${height}px` }}
      draggable={false}
      {...rest}
    />
  )
}

function pickFull(theme) {
  switch (theme) {
    case "dark": return logoWhite
    case "light":
    default: return logoCharcoal
  }
}

function pickMark(theme) {
  switch (theme) {
    case "dark": return markWhite
    case "violet": return markViolet
    case "azure": return markAzure
    case "terra": return markTerra
    case "light":
    default: return markCharcoal
  }
}

function cn(...args) {
  return args.filter(Boolean).join(" ")
}
