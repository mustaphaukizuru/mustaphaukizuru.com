// =============================================================================
// F03 · Typography component primitives (Layer 3 of the type system)
//
// Use these instead of writing <h1 className="text-page text-charcoal"> manually.
// They enforce the design system at the JSX level: every page title, eyebrow,
// section heading is consistent because every page imports the same component.
//
// Usage:
//   import { Eyebrow, PageTitle, SectionTitle, Lead, Body, Meta, Numeric } from "@/components/ui/typography"
//
//   <Eyebrow>PRODUCTS</Eyebrow>
//   <PageTitle>Modern tools for modern teams</PageTitle>
//   <Lead>Build faster with our digital products...</Lead>
//   <Body>Body text...</Body>
//   <Numeric>$49.00</Numeric>
//
// Decision tree:
//   Page hero / oversize marketing       → <Display>
//   Page title (one per page, the H1)    → <PageTitle>
//   Major section heading (H2)           → <SectionTitle>
//   Sub-section heading (H3)             → <SubsectionTitle>
//   Card / component title (H4)          → <CardTitle>
//   Lead paragraph (intro, hero subcopy) → <Lead>
//   Regular body text                    → <Body>
//   Helper / metadata / timestamps       → <Meta>
//   Fine print / tiny labels             → <Micro>
//   Small uppercase label above heading  → <Eyebrow>
//   Numbers, prices, code                → <Numeric>
// =============================================================================

import { forwardRef } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function makeRole(roleClass, defaultTag, defaultColorClass = "") {
  return forwardRef(function TypographyRole(
    { as, className, color, children, ...rest },
    ref
  ) {
    const Tag = as || defaultTag;
    return (
      <Tag
        ref={ref}
        className={cx(roleClass, color || defaultColorClass, className)}
        {...rest}
      >
        {children}
      </Tag>
    );
  });
}

// ─── Headings ───────────────────────────────────────────────────────────────

/** Oversized hero / marketing display text. Use sparingly — landing pages, hero sections. */
export const Display = makeRole("text-display", "h1", "text-charcoal");

/** Page title. ONE per page. The semantic H1. */
export const PageTitle = makeRole("text-page", "h1", "text-charcoal");

/** Major section heading. The semantic H2. */
export const SectionTitle = makeRole("text-section", "h2", "text-charcoal");

/** Sub-section heading within a major section. The semantic H3. */
export const SubsectionTitle = makeRole("text-subsection", "h3", "text-charcoal");

/** Card / component-level heading. The semantic H4. */
export const CardTitle = makeRole("text-card", "h4", "text-charcoal");

// ─── Body & metadata ────────────────────────────────────────────────────────

/** Lead paragraph — intro copy after a heading, hero subcopy. Larger than body. */
export const Lead = makeRole("text-lead", "p", "text-charcoal-80");

/** Regular body text. The default for paragraphs. */
export const Body = makeRole("text-body", "p", "text-charcoal-80");

/** Metadata: timestamps, author names, helper text under inputs. */
export const Meta = makeRole("text-meta", "span", "text-charcoal-50");

/** Fine print: tiny labels, footer copyright, terms references. */
export const Micro = makeRole("text-micro", "span", "text-charcoal-50");

// ─── Editorial ──────────────────────────────────────────────────────────────

/** Uppercase label above a heading. e.g. "PRODUCTS" / "TESTIMONIALS" / "PRICING". */
export const Eyebrow = makeRole("text-eyebrow", "div", "text-violet");

// ─── Numeric ────────────────────────────────────────────────────────────────

/**
 * Numeric content: prices, totals, order numbers, KPIs, file sizes, timestamps.
 * Renders in JetBrains Mono with tabular-nums + slashed-zero so digits align
 * in columns and 0 is unambiguous from O.
 *
 * Default tag is <span> so it can be inlined inside any context:
 *   <Body>Total: <Numeric>${total.toFixed(2)}</Numeric></Body>
 */
export const Numeric = makeRole("text-mono", "span", "");

/**
 * Numeric block — same as Numeric but renders as a <code> element.
 * Use for standalone displays like a single price on a product card.
 */
export const NumericBlock = makeRole("text-mono", "code", "");

// ─── Aliases / compat ───────────────────────────────────────────────────────

/** Alias for Body — for cases where the semantic role is "paragraph". */
export const Paragraph = Body;

/** Alias for Numeric — keeps backward compat with `<Mono>` usage. */
export const Mono = Numeric;

// ─── Default export · for convenience ───────────────────────────────────────
export default {
  Display,
  PageTitle,
  SectionTitle,
  SubsectionTitle,
  CardTitle,
  Lead,
  Body,
  Meta,
  Micro,
  Eyebrow,
  Numeric,
  NumericBlock,
  Paragraph,
  Mono,
};
