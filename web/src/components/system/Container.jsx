// ════════════════════════════════════════════════════════════════════════════
// Container · system surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Centered max-width wrapper with responsive gutters. Use this for every
// page section instead of ad-hoc `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
// snippets — the spec says one container, one set of gutters, everywhere.
//
// Token references:
//   --container-max  · 1280px
//   --gutter-mobile  · 16px
//   --gutter-tablet  · 24px
//   --gutter-desktop · 32px
//
// Sizes (max-width):
//   sm   · 640px   (auth forms, focused content)
//   md   · 768px   (article/blog body)
//   lg   · 1024px  (dashboards, admin)
//   xl   · 1280px  (default — public pages, marketing)
//   full · no max-width — gutters only
//
// Verticals (optional `py` prop applies a section padding ladder):
//   none · 0
//   sm   · 48 / 64
//   md   · 64 / 96 (default for marketing sections)
//   lg   · 80 / 128 (heroes)
// ════════════════════════════════════════════════════════════════════════════

const SIZE_CLASS = {
  sm: "max-w-[640px]",
  md: "max-w-[768px]",
  lg: "max-w-[1024px]",
  xl: "max-w-[1280px]",
  full: "max-w-none",
}

const PY_CLASS = {
  none: "",
  sm: "py-12 sm:py-16",
  md: "py-16 sm:py-24",
  lg: "py-20 sm:py-32",
}

/**
 * Container · centered max-width wrapper.
 *
 * Props:
 *   size?      · "sm" · "md" · "lg" · "xl" (default) · "full"
 *   py?        · "none" (default) · "sm" · "md" · "lg"
 *   as?        · "div" (default) · "section" · "main" · "article"
 *   className? · escape hatch
 */
export default function Container({
  children,
  size = "xl",
  py = "none",
  as: Component = "div",
  className = "",
  ...rest
}) {
  return (
    <Component
      className={[
        "mx-auto w-full px-4 sm:px-6 lg:px-8",
        SIZE_CLASS[size] || SIZE_CLASS.xl,
        PY_CLASS[py] || PY_CLASS.none,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Component>
  )
}

export { Container }
