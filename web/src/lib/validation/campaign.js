// Email campaign · src/controllers/adminCampaignController.js requires
// name + subject; body must be an array of blocks.
import { z } from "zod"
import { requiredStr, optionalStr, optionalEmail, tagList, isEmail } from "./common"

export const campaignSchema = z.object({
  name: requiredStr("Name", 200),
  subject: requiredStr("Subject", 300),
  preheader: optionalStr(300),
  fromName: optionalStr(120),
  fromEmail: optionalEmail("From email"),
  replyTo: optionalEmail("Reply-to"),
  audience: z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim().min(1, "Audience is required")),
  recipientEmails: tagList,
  scheduledAt: z.preprocess((v) => (v == null ? "" : String(v)), z.string()).transform((v) => v || null),
  body: z.array(z.object({ type: z.string().min(1) }).passthrough()),
}).passthrough().superRefine((v, ctx) => {
  if (v.audience === "custom" && v.recipientEmails.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipientEmails"], message: "Add at least one recipient for a custom audience" })
  }
  if (!v.recipientEmails.every(isEmail)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recipientEmails"], message: "Every recipient must be a valid email" })
  }
})
