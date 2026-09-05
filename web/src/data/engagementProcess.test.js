/**
 * The engagement process, and the promises inside it (T2-9).
 *
 * The six steps carry commitments a client will hold us to: response within
 * one business day, a proposal within three, proposals valid fourteen days,
 * kickoff within five business days of the deposit, feedback within two, and
 * a thirty-day support window. Those figures also appear in the plan feature
 * lists that T2-4 rewrote, in the FAQ answer, and in the downloadable
 * catalogue. The failure mode is not a typo — it is one of those places
 * saying something different from the others a year from now.
 *
 * So: the short summary is derived rather than duplicated, the Spanish is
 * complete rather than falling back, and the structured data is built from
 * the same six steps as the page.
 */
import { describe, expect, it } from "vitest"

import { HOW_IT_WORKS, getOfferingBySlug } from "./servicesCatalogue"
import {
  ACCESS_PRIVACY,
  DELIVERY_MODALITY,
  HOW_IT_WORKS_DETAILED,
  SUBMIT_BY_STAGE,
} from "./engagementProcess"
import { howToSchema } from "../seo/schemas/howToSchema"

const LOCALIZED = ["title", "summary", "how", "when", "include"]

describe("the six steps are complete", () => {
  it("there are six, numbered 01 to 06 in order", () => {
    expect(HOW_IT_WORKS_DETAILED).toHaveLength(6)
    expect(HOW_IT_WORKS_DETAILED.map((s) => s.step)).toEqual(["01", "02", "03", "04", "05", "06"])
  })

  it("every step has an id, an icon and both languages of every field", () => {
    const gaps = []
    for (const step of HOW_IT_WORKS_DETAILED) {
      if (!step.id) gaps.push("missing id")
      if (!step.Icon) gaps.push(`${step.id}: no icon`)
      for (const field of LOCALIZED) {
        if (!step[field]) gaps.push(`${step.id}.${field}`)
        // A missing Es field silently renders English on the Spanish page,
        // which is the exact failure the i18n wave existed to end.
        if (!step[`${field}Es`]) gaps.push(`${step.id}.${field}Es`)
      }
    }
    expect(gaps).toEqual([])
  })

  it("the Spanish is authored, not copied from the English", () => {
    const identical = HOW_IT_WORKS_DETAILED
      .flatMap((s) => LOCALIZED.filter((f) => s[f] === s[`${f}Es`]).map((f) => `${s.id}.${f}`))
    expect(identical).toEqual([])
  })

  it("access comes after the NDA, because that is the point of the order", () => {
    const ids = HOW_IT_WORKS_DETAILED.map((s) => s.id)
    expect(ids.indexOf("agreement")).toBeLessThan(ids.indexOf("kickoff"))
  })
})

describe("the commitments are the ones the rest of the site quotes", () => {
  const all = HOW_IT_WORKS_DETAILED.map((s) => Object.values(s).filter((v) => typeof v === "string").join(" ")).join(" ")

  it.each([
    ["1 business day", /1 business day/],
    ["3 business days", /3 business days/],
    ["14 days", /14 days/],
    ["5 business days", /5 business days/],
    ["2 business days", /2 business days/],
    ["30 days of support", /30 days of support/],
  ])("still promises %s", (_label, re) => {
    expect(all).toMatch(re)
  })

  it("does not promise 24/7 or same-day on-site, which T2-4 removed elsewhere", () => {
    expect(all).not.toMatch(/24\/7|same-day on-site/)
  })
})

describe("the three-step summary is derived, not written twice", () => {
  it("is the call, the proposal and the delivery step", () => {
    expect(HOW_IT_WORKS.map((s) => s.id)).toEqual(["call", "proposal", "delivery"])
  })

  it("takes its copy from the detailed steps", () => {
    for (const short of HOW_IT_WORKS) {
      const full = HOW_IT_WORKS_DETAILED.find((s) => s.id === short.id)
      expect(short.title).toBe(full.title)
      expect(short.titleEs).toBe(full.titleEs)
      expect(short.body).toBe(full.summary)
      expect(short.bodyEs).toBe(full.summaryEs)
      expect(short.Icon).toBe(full.Icon)
    }
  })

  it("renumbers 01-02-03, because it is a summary of three and not steps 2, 3 and 6", () => {
    expect(HOW_IT_WORKS.map((s) => s.step)).toEqual(["01", "02", "03"])
  })
})

describe("the supporting sections", () => {
  it("the submission table has a row per step, in the same order", () => {
    expect(SUBMIT_BY_STAGE.map((r) => r.id)).toEqual(HOW_IT_WORKS_DETAILED.map((s) => s.id))
  })

  it("every table row and rule is bilingual", () => {
    const gaps = []
    for (const row of SUBMIT_BY_STAGE) {
      for (const f of ["stage", "needs"]) {
        if (!row[f] || !row[`${f}Es`]) gaps.push(`submit.${row.id}.${f}`)
      }
    }
    for (const set of [DELIVERY_MODALITY, ACCESS_PRIVACY]) {
      for (const item of set) {
        for (const f of ["title", "body"]) {
          if (!item[f] || !item[`${f}Es`]) gaps.push(`${item.id}.${f}`)
        }
      }
    }
    expect(gaps).toEqual([])
  })

  it("names the two on-site cases, and they are real offerings", () => {
    const onsite = DELIVERY_MODALITY.find((m) => m.id === "onsite")
    expect(onsite.offerings).toHaveLength(2)
    const missing = onsite.offerings.filter((slug) => !getOfferingBySlug(slug))
    expect(missing).toEqual([])
  })

  it("has five access rules, and the two that link somewhere link inside the site", () => {
    expect(ACCESS_PRIVACY).toHaveLength(5)
    for (const rule of ACCESS_PRIVACY.filter((r) => r.href)) {
      expect(rule.href).toMatch(/^\//)
    }
  })
})

describe("the HowTo structured data is built from the same steps", () => {
  it("has one step per process step, in order, with deep links", () => {
    const schema = howToSchema({ lang: "en" })
    expect(schema["@type"]).toBe("HowTo")
    expect(schema.step).toHaveLength(HOW_IT_WORKS_DETAILED.length)
    expect(schema.step.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6])
    for (const [i, step] of schema.step.entries()) {
      expect(step.name).toBe(HOW_IT_WORKS_DETAILED[i].title)
      expect(step.url).toContain(`/how-we-work#${HOW_IT_WORKS_DETAILED[i].id}`)
    }
  })

  it("the Spanish variant is Spanish and points at the Spanish URL", () => {
    const schema = howToSchema({ lang: "es" })
    expect(schema.inLanguage).toBe("es-MX")
    expect(schema.url).toContain("/es/how-we-work")
    expect(schema.step[0].name).toBe(HOW_IT_WORKS_DETAILED[0].titleEs)
  })

  it("claims no totalTime — the elapsed time depends entirely on the engagement", () => {
    // An invented ISO duration in structured data is a claim, not a formality.
    expect(howToSchema({ lang: "en" }).totalTime).toBeUndefined()
  })
})
