import { motion, useReducedMotion } from "framer-motion"

/**
 * KineticHeadline · word-by-word reveal headline
 *
 * Renders text as a sequence of `<span>` words that animate in with a
 * staggered upward slide + opacity ramp. Optional `gradient` prop tints
 * one of the word-groups with a gradient sweep for emphasis. Respects
 * prefers-reduced-motion (renders static text).
 *
 * Two API shapes:
 *
 *   1) Pass `text` as a string — the whole thing animates as one block:
 *      <KineticHeadline text="Built with care · Shipped with intent" />
 *
 *   2) Pass `parts` as an array of { text, gradient?, highlight? } — each
 *      part animates with the same stagger but can carry its own colour:
 *      <KineticHeadline parts={[
 *        { text: "Built with" },
 *        { text: "care", highlight: true },
 *        { text: "· Shipped with" },
 *        { text: "intent", gradient: true },
 *      ]} />
 *
 * Props:
 *   text       — single string (mutually exclusive with `parts`)
 *   parts      — array (mutually exclusive with `text`)
 *   stagger    — seconds between word reveals (default 0.06)
 *   as         — heading tag (default "h1")
 *   className  — utility classes (font, size, tracking, colour)
 *   gradientClassName — Tailwind classes applied to `gradient: true` words
 *                       (default uses brand violet → terracotta sweep)
 *   highlightClassName — applied to `highlight: true` words (default
 *                        violet text)
 */
export default function KineticHeadline({
  text,
  parts,
  stagger = 0.06,
  as = "h1",
  className = "",
  gradientClassName = "bg-grad-innovation bg-clip-text text-transparent",
  highlightClassName = "text-violet",
  ...rest
}) {
  const reduced = useReducedMotion()

  // Normalise input to a list of { text, gradient, highlight } parts.
  const resolvedParts = parts && parts.length
    ? parts
    : [{ text: text || "" }]

  // Flatten parts → individual words, retaining the part-level styling
  // flags so each word inherits the right tint.
  const tokens = resolvedParts.flatMap((part, partIdx) => {
    const words = String(part.text || "").split(/\s+/).filter(Boolean)
    return words.map((word, wordIdx) => ({
      key: `${partIdx}-${wordIdx}-${word}`,
      word,
      gradient:  !!part.gradient,
      highlight: !!part.highlight,
      // Mark word with a leading space unless it's the very first token.
      leadingSpace: partIdx > 0 || wordIdx > 0,
    }))
  })

  const Tag = as

  // ── Reduced motion: static render ──────────────────────────────────
  if (reduced) {
    return (
      <Tag className={className} {...rest}>
        {tokens.map((tk) => (
          <span key={tk.key}>
            {tk.leadingSpace ? " " : ""}
            <span
              className={
                tk.gradient ? gradientClassName :
                tk.highlight ? highlightClassName : undefined
              }
            >
              {tk.word}
            </span>
          </span>
        ))}
      </Tag>
    )
  }

  // ── Animated render ────────────────────────────────────────────────
  // We animate at the WORD level (not character) — letter-by-letter
  // animation reads as gimmicky on a serious brand site, and word-level
  // gives plenty of dynamic feel without the noise.
  const MotionTag = motion[as] || motion.h1
  const container = {
    hidden: {},
    show:   { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
  }
  const word = {
    hidden: { opacity: 0, y: "0.6em", filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  }

  return (
    <MotionTag
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
      aria-label={tokens.map((tk) => tk.word).join(" ")}
      {...rest}
    >
      {tokens.map((tk) => (
        // The outer wrapper carries the inline-block + overflow so the
        // y-translate can rise from beneath a clean baseline; the inner
        // motion.span carries the actual motion.
        <span
          key={tk.key}
          className="inline-block overflow-hidden align-baseline"
          aria-hidden="true"
        >
          {tk.leadingSpace && <span>&nbsp;</span>}
          <motion.span
            variants={word}
            className={`inline-block ${
              tk.gradient ? gradientClassName :
              tk.highlight ? highlightClassName : ""
            }`}
          >
            {tk.word}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  )
}
