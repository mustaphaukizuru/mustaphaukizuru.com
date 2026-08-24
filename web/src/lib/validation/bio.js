// Bio CMS entry schemas · mirror src/controllers/adminBioController.js and
// src/services/adminBioService.js (required strings, valid dates, skill
// category enum, proficiency clamped 1-5).
import { z } from "zod"
import {
  requiredStr, optionalStr, optionalUrlOrPath, optionalHttpUrl,
  requiredDate, optionalDate, numberField, optionalNumber, bool,
} from "./common"

export const SKILL_CATEGORIES = [
  "frontend", "backend", "tools", "database", "cloud", "language", "soft_skill",
]

const idField = z.string().optional()

const withDateRange = (schema) =>
  schema.refine(
    (v) => !v.endDate || new Date(v.endDate).getTime() >= new Date(v.startDate).getTime(),
    { path: ["endDate"], message: "End date must be after the start date" },
  )

export const experienceSchema = withDateRange(z.object({
  id: idField,
  role: requiredStr("Role", 200),
  company: requiredStr("Company", 200),
  companyLogo: optionalUrlOrPath("Company logo"),
  location: optionalStr(200),
  startDate: requiredDate("Start date"),
  endDate: optionalDate("End date"),
  description: requiredStr("Description", 5000),
  highlights: z.array(z.string()).nullable().optional(),
  tools: z.array(z.string()).nullable().optional(),
  displayOrder: numberField("Display order", { int: true, fallback: 0 }),
  isVisible: bool(true),
}))

export const educationSchema = withDateRange(z.object({
  id: idField,
  degree: requiredStr("Degree", 200),
  institution: requiredStr("Institution", 200),
  institutionLogo: optionalUrlOrPath("Institution logo"),
  location: optionalStr(200),
  fieldOfStudy: optionalStr(200),
  grade: optionalStr(100),
  startDate: requiredDate("Start date"),
  endDate: optionalDate("End date"),
  description: requiredStr("Description", 5000),
  highlights: z.array(z.string()).nullable().optional(),
  displayOrder: numberField("Display order", { int: true, fallback: 0 }),
  isVisible: bool(true),
}))

export const certificateSchema = z.object({
  id: idField,
  title: requiredStr("Title", 200),
  issuer: requiredStr("Issuer", 200),
  issuerLogo: optionalUrlOrPath("Issuer logo"),
  issueDate: requiredDate("Issue date"),
  expiryDate: optionalDate("Expiry date"),
  credentialId: optionalStr(200),
  credentialUrl: optionalHttpUrl("Credential URL"),
  pdfUrl: optionalUrlOrPath("PDF URL"),
  category: optionalStr(100),
  displayOrder: numberField("Display order", { int: true, fallback: 0 }),
  isVisible: bool(true),
}).refine(
  (v) => !v.expiryDate || new Date(v.expiryDate).getTime() >= new Date(v.issueDate).getTime(),
  { path: ["expiryDate"], message: "Expiry date must be after the issue date" },
)

export const skillSchema = z.object({
  id: idField,
  name: requiredStr("Skill name", 100),
  category: z.enum(SKILL_CATEGORIES, { errorMap: () => ({ message: "Choose a category" }) }),
  proficiency: numberField("Proficiency", { int: true, min: 1, max: 5, fallback: 3 }),
  yearsUsing: optionalNumber("Years using", { min: 0, max: 60 }),
  iconKey: optionalStr(100),
  displayOrder: numberField("Display order", { int: true, fallback: 0 }),
  isVisible: bool(true),
})
