// Store product · src/services/adminProductService.js create/update take
// { title, slug, description, shortDescription?, fullDescription?, price,
//   category, isActive, isFeatured, isNew, features[], specifications[], productFaqs[] }
import { z } from "zod"
import { requiredStr, optionalStr, slugField, numberField, bool } from "./common"

export const productSchema = z.object({
  title: requiredStr("Title", 200),
  slug: slugField,
  description: requiredStr("Description", 5000),
  shortDescription: optionalStr(300),
  fullDescription: optionalStr(20000),
  price: numberField("Price", { min: 0 }),
  category: z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().min(1, "Category is required")),
  isActive: bool(true),
  isFeatured: bool(false),
  isNew: bool(false),
  features: z.array(z.string()).default([]),
  specifications: z.array(z.object({}).passthrough()).default([]),
  productFaqs: z.array(z.object({}).passthrough()).default([]),
  // T3 · tiered licences: [{ tier, name, price, currency, seats, isActive }]
  licenses: z.array(z.object({}).passthrough()).default([]),
}).passthrough()
