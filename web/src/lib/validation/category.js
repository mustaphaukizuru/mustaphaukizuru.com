// Product category · src/services/adminCategoryService.js accepts
// { name (required), slug?, description?, icon?, isActive?, sortOrder? }
import { z } from "zod"
import { requiredStr, optionalStr, slugField, numberField, bool } from "./common"

export const categorySchema = z.object({
  id: z.string().optional(),
  name: requiredStr("Name", 100),
  slug: slugField,
  description: optionalStr(1000),
  icon: optionalStr(100),
  isActive: bool(true),
  sortOrder: numberField("Sort order", { int: true, fallback: 0 }),
})
