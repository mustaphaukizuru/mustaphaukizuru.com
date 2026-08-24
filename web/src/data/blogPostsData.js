/**
 * blogPostsData.js · single source of truth for the public /blog surface.
 *
 * Posts are split one-file-per-post under `./blogPosts/*.js` so each
 * article body stays small and reviewable. This module does the
 * aggregation + helpers; BlogPage and BlogPostPage import from here.
 *
 * Future migration plan
 * ─────────────────────
 *   1. Add Prisma models: BlogPost, BlogCategory, BlogTag, BlogTagMap.
 *   2. Build /api/blog (public list/detail) and /api/admin/blog (CRUD).
 *   3. Create AdminBlogPage + AdminBlogFormPage with TipTap editor that
 *      emits the same `body` block schema documented below.
 *   4. Replace these constants with `apiRequest("/api/blog")` calls in
 *      BlogPage / BlogPostPage. Component contracts stay identical.
 *
 * Body block schema (used by BlogPostPage's renderer)
 * ───────────────────────────────────────────────────
 *   { type: "p",       text }                   — paragraph
 *   { type: "h2",      text }                   — section heading
 *   { type: "h3",      text }                   — subsection heading
 *   { type: "list",    items: [...] }           — bulleted list
 *   { type: "ordered", items: [...] }           — numbered list
 *   { type: "callout", variant, title?, text }  — info | success | warning
 *   { type: "quote",   text, cite? }            — pull quote
 *
 * Inline formatting inside `text` fields and list items:
 *   **bold**     · *italic*     · `code`     · [text](url)
 */

import postAiCodingAgents2026 from "./blogPosts/aiCodingAgents2026"
import postSaasJourney from "./blogPosts/saasJourney"
import postSchoolStrategy from "./blogPosts/schoolStrategy"
import postReactDjango from "./blogPosts/reactDjango"
import postEdtechTeachers from "./blogPosts/edtechTeachers"
import postRoboticsClass from "./blogPosts/roboticsClass"
import postPaymentsLatam from "./blogPosts/paymentsLatam"
import postHostingerVps from "./blogPosts/hostingerVps"
import postRwandaMexico from "./blogPosts/rwandaMexico"
import postWcagWins from "./blogPosts/wcagWins"
import { TOKENS } from "../styles/tokens.js"

export const BLOG_CATEGORIES = [
  { slug: "it-strategy", label: "IT Strategy", accent: TOKENS.violet },
  { slug: "web-development", label: "Web Development", accent: TOKENS.violetMid },
  { slug: "edtech", label: "EdTech", accent: TOKENS.azure },
  { slug: "stem-education", label: "STEM Education", accent: TOKENS.terracotta },
  { slug: "career", label: "Career & Mindset", accent: TOKENS.charcoal },
  { slug: "product-updates", label: "Product Updates", accent: TOKENS.mint },
]

export const BLOG_TAGS = [
  "React", "Django", "Node.js", "Express", "Prisma", "MySQL", "PostgreSQL",
  "GCP", "Hostinger", "MercadoPago", "PayPal", "JWT", "Tailwind",
  "Framer Motion", "SEO", "Performance", "Accessibility", "WCAG",
  "Robotics", "AI", "Mexico", "Rwanda", "Schools", "SMBs", "Productivity",
]

export const BLOG_POSTS = [
  postAiCodingAgents2026,
  postSaasJourney,
  postSchoolStrategy,
  postReactDjango,
  postEdtechTeachers,
  postRoboticsClass,
  postPaymentsLatam,
  postHostingerVps,
  postRwandaMexico,
  postWcagWins,
]

/* ── Derived helpers (memo-friendly: no re-creation per render) ───── */

export function getAllPosts() {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  )
}

export function getFeaturedPost() {
  return BLOG_POSTS.find((p) => p.featured) || getAllPosts()[0] || null
}

export function getCategoryCounts() {
  const map = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.slug, 0]))
  for (const post of BLOG_POSTS) {
    if (map[post.category] != null) map[post.category] += 1
  }
  return BLOG_CATEGORIES.map((c) => ({ ...c, count: map[c.slug] }))
}

export function getTopTags(n = 12) {
  const map = new Map()
  for (const post of BLOG_POSTS) {
    for (const t of post.tags) map.set(t, (map.get(t) || 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([tag, count]) => ({ tag, count }))
}

export function getArchive() {
  const groups = new Map()
  for (const post of getAllPosts()) {
    const d = new Date(post.publishedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleString("en-US", { month: "long", year: "numeric" })
    if (!groups.has(key)) groups.set(key, { key, label, count: 0 })
    groups.get(key).count += 1
  }
  return [...groups.values()]
}

export function getPostBySlug(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null
}

export function getRelatedPosts(slug, limit = 3) {
  const current = getPostBySlug(slug)
  if (!current) return []
  return getAllPosts()
    .filter((p) => p.slug !== slug && p.category === current.category)
    .slice(0, limit)
}
