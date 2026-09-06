// ─────────────────────────────────────────────────────────────────────────────
// T5-6 · the seeded email templates.
//
// These are DATABASE ROWS, which is the whole reason this file exists. A
// template is not code: an unresolved {{placeholder}} does not throw, it
// renders literally in somebody's inbox, and a key that exists in English and
// not in Spanish silently falls back to English for a Spanish client. Neither
// failure shows up anywhere until a real person reads a broken email.
//
// So: every key in both languages, every placeholder in one language present
// in the other, and every placeholder the seven new templates use actually
// supplied by the service that sends them.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  emailTemplate: { upsert: jest.fn() },
  $disconnect: jest.fn(),
}))

const fs = require("fs")
const path = require("path")

const { TEMPLATES, TEMPLATES_ES } = require("../prisma/seed-email-templates")
const projectEmails = require("../src/services/projectEmailService")

const keysOf = (list) => list.map((t) => t.key)
const placeholders = (t) => {
  const found = new Set()
  for (const m of `${t.subject}\n${t.html}\n${t.text}`.matchAll(/\{\{(\w+)\}\}/g)) found.add(m[1])
  return found
}
const byKey = (list) => new Map(list.map((t) => [t.key, t]))

describe("English and Spanish stay in step", () => {
  test("the seed exports both arrays and neither is empty", () => {
    // A silent zero would make every assertion below vacuously true.
    expect(TEMPLATES.length).toBeGreaterThan(20)
    expect(TEMPLATES_ES.length).toBe(TEMPLATES.length)
  })

  test("every key exists in both languages", () => {
    const en = keysOf(TEMPLATES)
    const es = keysOf(TEMPLATES_ES)
    expect(en.filter((k) => !es.includes(k))).toEqual([])
    expect(es.filter((k) => !en.includes(k))).toEqual([])
  })

  test("no key is defined twice in either language", () => {
    // An upsert means the second definition silently wins, so a duplicate is
    // a template nobody can find the source of.
    for (const list of [TEMPLATES, TEMPLATES_ES]) {
      const keys = keysOf(list)
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
    }
  })

  test("both languages use exactly the same placeholders", () => {
    // The senders pass ONE variable bag per key. A placeholder that exists
    // only in the Spanish body renders literally for every Spanish reader.
    const es = byKey(TEMPLATES_ES)
    const drift = []
    for (const en of TEMPLATES) {
      const a = placeholders(en)
      const b = placeholders(es.get(en.key))
      const missing = [...a].filter((k) => !b.has(k))
      const extra = [...b].filter((k) => !a.has(k))
      if (missing.length || extra.length) drift.push({ key: en.key, missing, extra })
    }
    expect(drift).toEqual([])
  })

  test("every template has a subject, an html body and a text body", () => {
    const bad = []
    for (const list of [TEMPLATES, TEMPLATES_ES]) {
      for (const t of list) {
        if (!t.subject?.trim() || !t.html?.trim() || !t.text?.trim()) bad.push(t.key)
      }
    }
    expect(bad).toEqual([])
  })
})

describe("the seven project templates (T5-6)", () => {
  const en = byKey(TEMPLATES)
  const es = byKey(TEMPLATES_ES)

  test("all seven are seeded in both languages", () => {
    for (const key of projectEmails.PROJECT_TEMPLATES) {
      expect(en.get(key)).toBeDefined()
      expect(es.get(key)).toBeDefined()
    }
  })

  test("every one carries the tracking code in the eyebrow", () => {
    // The point of the code is that it is the one string a client recognises
    // across an engagement. That only works if it is on all of them.
    for (const key of projectEmails.PROJECT_TEMPLATES) {
      for (const t of [en.get(key), es.get(key)]) {
        // The eyebrow is the pill in the header band, rendered inside a
        // span with the uppercase letter-spacing.
        expect(t.html).toMatch(/letter-spacing:0\.18em;[^>]*">\s*\{\{trackingCode\}\}/)
      }
    }
  })

  test("every placeholder they use is supplied by projectEmailService", () => {
    // This is the assertion that matters. The failure it catches is a
    // template edited to add {{somethingNew}} with no matching change in the
    // sender, which mails the literal string.
    const source = fs.readFileSync(
      path.join(__dirname, "..", "src", "services", "projectEmailService.js"),
      "utf8",
    )
    const unsupplied = []
    for (const key of projectEmails.PROJECT_TEMPLATES) {
      for (const name of placeholders(en.get(key))) {
        // `year` is substituted by the seed script itself, not by a sender.
        if (name === "year") continue
        // Either built into every send (the base bag) or named in a wrapper.
        if (!new RegExp(`\\b${name}\\b`).test(source)) unsupplied.push(`${key}.${name}`)
      }
    }
    expect(unsupplied).toEqual([])
  })

  test("the client-facing six never name a file", () => {
    // project.file-received is the operator's, and is the only one allowed to
    // say what was uploaded. A file name can carry the client's own client,
    // a case number, a salary band.
    for (const key of projectEmails.PROJECT_TEMPLATES) {
      if (key === "project.file-received") continue
      for (const t of [en.get(key), es.get(key)]) {
        expect(placeholders(t).has("fileName")).toBe(false)
      }
    }
  })

  test("the tracking-code email explains what the code does NOT show", () => {
    // A client who thinks /track exposes their invoices will not forward the
    // code, and forwarding it is what it is for.
    expect(en.get("project.tracking-code").html).toMatch(/never amounts, file names or messages/i)
    expect(es.get("project.tracking-code").html).toMatch(/nunca montos, nombres de archivos ni mensajes/i)
  })
})
