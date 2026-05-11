import { Children } from "react"
import { motion, useReducedMotion } from "framer-motion"

/**
 * StaggerGrid · grid container that reveals its children in a wave
 *
 * Wraps each direct child in a `motion.div` with a fade+lift entrance and
 * staggers the entrance timing across siblings so items appear sequentially
 * rather than all at once. Respects prefers-reduced-motion (renders the
 * grid statically when set).
 *
 * Caller is responsible for the grid styling (gap, columns) via className.
 * The component only handles motion orchestration.
 *
 * Props:
 *   children   — grid items (any number)
 *   className  — grid utility classes (e.g. "grid grid-cols-3 gap-6")
 *   stagger    — seconds between each child's entrance (default 0.08)
 *   y          — child translate-y start (default 20)
 *   duration   — per-child transition duration in seconds (default 0.5)
 *   amount     — viewport fraction before firing (default 0.15)
 *   once       — true → fire one time (default true)
 *   itemClassName — extra classes on each wrapped child (optional)
 *
 * Example:
 *   <StaggerGrid className="grid grid-cols-3 gap-6">
 *     {products.map((p) => <ProductCard key={p.id} {...p} />)}
 *   </StaggerGrid>
 */
export default function StaggerGrid({
  children,
  className = "",
  stagger = 0.08,
  y = 20,
  duration = 0.5,
  amount = 0.15,
  once = true,
  itemClassName = "",
}) {
  const reduced = useReducedMotion()
  const items   = Children.toArray(children)

  if (reduced) {
    return (
      <div className={className}>
        {items.map((child, i) => (
          <div key={child?.key ?? i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    )
  }

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: stagger } },
  }
  const item = {
    hidden: { opacity: 0, y },
    show:   { opacity: 1, y: 0, transition: { duration, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount, margin: "0px 0px -60px 0px" }}
    >
      {items.map((child, i) => (
        <motion.div key={child?.key ?? i} variants={item} className={itemClassName}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
