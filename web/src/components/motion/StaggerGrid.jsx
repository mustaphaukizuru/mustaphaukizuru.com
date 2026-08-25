import { Children } from "react"
import { m, useReducedMotion } from "framer-motion"

/**
 * StaggerGrid · grid container that reveals its children in a wave
 *
 * Wraps each direct child in a motion element with a fade+lift entrance
 * and staggers the entrance timing across siblings so items appear
 * sequentially rather than all at once. Respects prefers-reduced-motion
 * (renders the grid statically when set).
 *
 * Caller is responsible for the grid styling (gap, columns) via className.
 * The component only handles motion orchestration.
 *
 * Props:
 *   children      — grid items (any number)
 *   className     — grid utility classes (e.g. "grid grid-cols-3 gap-6")
 *   as            — wrapper element tag (default "div"; pass "ul" / "ol"
 *                   for semantic lists)
 *   itemAs        — wrapper element for each child (default "div"; pass
 *                   "li" when `as="ul"`)
 *   stagger       — seconds between each child's entrance (default 0.08)
 *   y             — child translate-y start (default 20)
 *   duration      — per-child transition duration in seconds (default 0.5)
 *   amount        — viewport fraction before firing (default 0.15)
 *   once          — true → fire one time (default true)
 *   itemClassName — extra classes on each wrapped child (optional)
 *   role          — passed through (e.g. "list" on ul)
 *
 * Example (div grid):
 *   <StaggerGrid className="grid grid-cols-3 gap-6">
 *     {products.map((p) => <ProductCard key={p.id} {...p} />)}
 *   </StaggerGrid>
 *
 * Example (semantic list):
 *   <StaggerGrid as="ul" itemAs="li" role="list"
 *                className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
 *     {posts.map((p) => <PostCard key={p.slug} post={p} />)}
 *   </StaggerGrid>
 */
export default function StaggerGrid({
  children,
  className = "",
  as = "div",
  itemAs = "div",
  stagger = 0.08,
  y = 20,
  duration = 0.5,
  amount = 0.15,
  once = true,
  itemClassName = "",
  role,
  ...rest
}) {
  const reduced = useReducedMotion()
  const items   = Children.toArray(children)

  const Container = as
  const Item      = itemAs

  if (reduced) {
    return (
      <Container className={className} role={role} {...rest}>
        {items.map((child, i) => (
          <Item key={child?.key ?? i} className={itemClassName}>
            {child}
          </Item>
        ))}
      </Container>
    )
  }

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y },
    show:   { opacity: 1, y: 0, transition: { duration, ease: [0.22, 1, 0.36, 1] } },
  }

  const MotionContainer = m[as] || m.div
  const MotionItem      = m[itemAs] || m.div

  return (
    <MotionContainer
      className={className}
      role={role}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount, margin: "0px 0px -60px 0px" }}
      {...rest}
    >
      {items.map((child, i) => (
        <MotionItem
          key={child?.key ?? i}
          variants={itemVariants}
          className={itemClassName}
        >
          {child}
        </MotionItem>
      ))}
    </MotionContainer>
  )
}
