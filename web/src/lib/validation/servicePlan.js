// Services + packages · src/services/adminServiceService.js
//   createService requires title, shortDescription, deliveryType
//   addPackage    requires name, price
import { z } from "zod"
import { requiredStr, optionalStr, slugField, numberField, bool } from "./common"

const currency = z.preprocess(
  (v) => String(v || "MXN").trim().toUpperCase(),
  z.string().length(3, "Currency must be a 3-letter code"),
)

export const serviceSchema = z.object({
  id: z.string().optional(),
  title: requiredStr("Title", 200),
  slug: slugField,
  shortDescription: requiredStr("Short description", 500),
  fullDescription: optionalStr(20000),
  basePrice: numberField("Base price", { min: 0, fallback: 0 }),
  currency,
  deliveryType: z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().min(1, "Delivery type is required")),
  status: z.preprocess((v) => (v == null ? "draft" : String(v)), z.string().trim().min(1)),
  isFeatured: bool(false),
  metaTitle: optionalStr(200),
  metaDescription: optionalStr(320),
  audienceCode: optionalStr(50),
  titleEs: optionalStr(200),
  shortDescriptionEs: optionalStr(500),
  descriptionEs: optionalStr(20000),
  metaTitleEs: optionalStr(200),
  metaDescriptionEs: optionalStr(320),
}).passthrough()

export const servicePackageSchema = z.object({
  id: z.string().optional(),
  name: requiredStr("Name", 120),
  description: optionalStr(2000),
  price: numberField("Price", { min: 0 }),
  currency,
  isActive: bool(true),
  sortOrder: numberField("Sort order", { int: true, fallback: 0 }),
  tierKey: optionalStr(50),
  period: optionalStr(50),
  popular: bool(false),
  saveLabel: optionalStr(80),
  nameEs: optionalStr(120),
  descriptionEs: optionalStr(2000),
  featureIds: z.array(z.string()).optional(),
}).passthrough()
