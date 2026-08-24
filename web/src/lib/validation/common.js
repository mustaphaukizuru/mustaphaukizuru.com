import { z } from "zod"

/** Trimmed string; "" allowed unless `.min(1)` is chained by the caller. */
export const str = (max = 10000) => z.string().trim().max(max)

export const requiredStr = (label, max = 10000) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** Optional string → null when blank. */
export const optionalStr = (max = 10000) =>
  z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().max(max, `Must be at most ${max} characters`))
    .transform((v) => v || null)

/** Optional http(s) URL or same-origin path → null when blank. */
export const optionalUrlOrPath = (label = "URL") =>
  z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string())
    .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\/\S+$/i.test(v), `${label} must be a full URL or a /path`)
    .transform((v) => v || null)

/** Optional absolute http(s) URL → null when blank. */
export const optionalHttpUrl = (label = "URL") =>
  z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string())
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), `${label} must start with http:// or https://`)
    .transform((v) => v || null)

/** "YYYY-MM-DD" required date. */
export const requiredDate = (label) =>
  z.string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), `${label} is not a valid date`)

/** Optional date → null when blank. */
export const optionalDate = (label = "Date") =>
  z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string())
    .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), `${label} is not a valid date`)
    .transform((v) => v || null)

/** Numeric input (string from <input type=number> or number). */
export const numberField = (label, { min, max, int = false, fallback } = {}) =>
  z.preprocess(
    (v) => {
      if (v === "" || v == null) return fallback === undefined ? undefined : fallback
      const n = Number(v)
      return Number.isFinite(n) ? n : v
    },
    (() => {
      let s = z.number({ invalid_type_error: `${label} must be a number`, required_error: `${label} is required` })
      if (int) s = s.int(`${label} must be a whole number`)
      if (min !== undefined) s = s.min(min, `${label} must be at least ${min}`)
      if (max !== undefined) s = s.max(max, `${label} must be at most ${max}`)
      return s
    })(),
  )

/** Optional number → null when blank. */
export const optionalNumber = (label, opts = {}) =>
  z.preprocess((v) => (v === "" || v == null ? null : v), numberField(label, opts).nullable())

export const bool = (fallback = false) => z.preprocess((v) => (v == null ? fallback : Boolean(v)), z.boolean())

export const slugField = z.preprocess((v) => (v == null ? "" : String(v).trim().toLowerCase()), z.string())
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Slug may only contain lowercase letters, numbers and hyphens")

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const emailField = (label = "Email") =>
  z.string().trim().min(1, `${label} is required`).email(`${label} must be a valid email`).max(320)

export const optionalEmail = (label = "Email") =>
  z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string())
    .refine((v) => v === "" || EMAIL_RE.test(v), `${label} must be a valid email`)
    .transform((v) => v || null)

export const isEmail = (v) => EMAIL_RE.test(String(v || ""))

/** Comma-separated string or array → array of trimmed non-empty strings. */
export const tagList = z.preprocess(
  (v) => (Array.isArray(v) ? v : String(v || "").split(",")),
  z.array(z.string()).transform((arr) => arr.map((t) => String(t).trim()).filter(Boolean)),
)
