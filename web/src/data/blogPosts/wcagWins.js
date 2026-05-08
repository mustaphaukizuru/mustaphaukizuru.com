import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "wcag-quick-wins-for-marketing-pages",
  title: "WCAG 2.1 AA quick wins for marketing pages",
  excerpt:
    "Ten high-impact accessibility fixes that take less than an afternoon and quietly improve your conversion rate at the same time.",
  category: "web-development",
  tags: ["Accessibility", "WCAG", "SEO"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2025-12-20T09:00:00Z",
  readMinutes: 6,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "Accessibility audits get framed as legal risk and cost. They're also a quiet conversion optimisation tool, the same fixes that meet WCAG 2.1 AA tend to also fix the friction your sighted, mouse-using buyers feel but don't articulate." },
    { type: "p", text: "Here's the ten-fix list I run on every marketing page before launch. None take more than thirty minutes." },

    { type: "ordered", items: [
      "**Real headings.** One `<h1>` per page, then a sensible h2/h3 hierarchy. Stop styling `<div>`s to look like headings.",
      "**Alt text on every meaningful image.** Decorative images get `alt=\"\"`, not omitted alt.",
      "**Visible focus rings.** Don't `outline: none` without a replacement. Tailwind's `focus-visible:ring-*` is the right pattern.",
      "**Touch targets ≥ 44×44px.** Buttons, icon-only links, social chips. Below that and your phone users are quietly bouncing.",
      "**Color contrast ≥ 4.5:1 for body, 3:1 for large text.** Run [Stark](https://www.getstark.co/) or the Chrome DevTools contrast picker.",
      "**Form labels.** Every input has a real `<label htmlFor>`. Placeholders are not labels.",
      "**Error messages near the field**, and tied with `aria-describedby`, not just colored red.",
      "**Skip-to-content link.** First focusable element on every page. Visually hidden until focused.",
      "**Respect `prefers-reduced-motion`.** Wrap animations in a media query or use Framer Motion's `useReducedMotion` hook.",
      "**Semantic landmarks.** `<header>`, `<nav>`, `<main>`, `<footer>` with `aria-label` where there's more than one.",
    ] },

    { type: "callout", variant: "success", text: "Run Lighthouse + axe-core after each fix. The accessibility score is the cheapest performance signal Google gives you, and it correlates with bounce rate more than most teams think." },
  ],
}
