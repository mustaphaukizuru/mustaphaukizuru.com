// Blog post metadata · src/controllers/adminBlogController.js requires
// title + categoryId; body must be an array of blocks (block shape is owned
// by the block editor, so it is validated loosely here). Tags may arrive as
// a comma string or an array.
import { z } from "zod"
import { requiredStr, optionalStr, optionalUrlOrPath, slugField, numberField, bool, tagList } from "./common"

export const BLOG_STATUSES = ["draft", "published", "archived"]

export const blogBlockSchema = z.object({ type: z.string().min(1) }).passthrough()

export const blogPostSchema = z.object({
  title: requiredStr("Title", 200),
  slug: slugField,
  excerpt: z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(500, "Excerpt must be at most 500 characters")),
  cover: optionalUrlOrPath("Cover image"),
  readMinutes: numberField("Read time", { int: true, min: 1, max: 240, fallback: 5 }),
  status: z.enum(BLOG_STATUSES),
  isFeatured: bool(false),
  metaTitle: optionalStr(200),
  metaDescription: optionalStr(320),
  categoryId: z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().min(1, "Category is required")),
  authorName: optionalStr(120),
  authorRole: optionalStr(200),
  authorAvatar: optionalUrlOrPath("Author avatar"),
  tags: tagList,
  body: z.array(blogBlockSchema).min(1, "Add at least one content block"),
  // Spanish overlay — all optional; empty = fall back to English
  titleEs: optionalStr(200),
  excerptEs: optionalStr(500),
  metaTitleEs: optionalStr(200),
  metaDescriptionEs: optionalStr(320),
  bodyEs: z.array(blogBlockSchema).optional().default([]),
})
