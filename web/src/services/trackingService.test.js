import { describe, expect, test } from "vitest"

import { formatTrackingCode, isCompleteTrackingCode } from "./trackingService"

/**
 * The field a client types their code into (T5-5).
 *
 * The code is read off a printed invoice, one character at a time, by
 * somebody who is not thinking about string formats. Everything here is a
 * way that goes wrong.
 */

describe("formatTrackingCode", () => {
  test("inserts the hyphens as the reader types", () => {
    expect(formatTrackingCode("7")).toBe("MU-7")
    expect(formatTrackingCode("7K4C")).toBe("MU-7K4C")
    expect(formatTrackingCode("7K4C9")).toBe("MU-7K4C-9")
    expect(formatTrackingCode("7K4C9XQF")).toBe("MU-7K4C-9XQF")
  })

  test("accepts what a client actually pastes", () => {
    // The whole code from an email, lowercase from a phone keyboard, with
    // the hyphens already in it, or with a stray space from a bad selection.
    for (const input of ["MU-7K4C-9XQF", "mu7k4c9xqf", "MU 7K4C 9XQF", "7k4c-9xqf"]) {
      expect(formatTrackingCode(input)).toBe("MU-7K4C-9XQF")
    }
  })

  test("survives being re-applied on every keystroke", () => {
    // How the field actually behaves: the value is re-formatted after each
    // character, so this function is fed its own output plus one letter. Its
    // first version stripped only ONE leading MU, so the prefix it had just
    // added became data and "mu7k4c9xqf" typed out as MU-MU7K-4C9X.
    let value = ""
    for (const ch of "mu7k4c9xqf") value = formatTrackingCode(value + ch)
    expect(value).toBe("MU-7K4C-9XQF")
  })

  test("an empty field stays empty rather than becoming a bare prefix", () => {
    // Otherwise clearing the input leaves "MU-" behind and the reader has to
    // delete three characters they never typed.
    expect(formatTrackingCode("")).toBe("")
    expect(formatTrackingCode(null)).toBe("")
    expect(formatTrackingCode("---")).toBe("")
  })

  test("stops at eight characters, so a double paste cannot overflow", () => {
    expect(formatTrackingCode("7K4C9XQFZZZZ")).toBe("MU-7K4C-9XQF")
  })
})

describe("isCompleteTrackingCode", () => {
  test("a full code is complete", () => {
    expect(isCompleteTrackingCode("MU-7K4C-9XQF")).toBe(true)
  })

  test("a partial code is not", () => {
    for (const input of ["", "MU-", "MU-7K4C", "MU-7K4C-9XQ"]) {
      expect(isCompleteTrackingCode(input)).toBe(false)
    }
  })

  test("the excluded glyphs are refused rather than corrected", () => {
    // src/utils/trackingCode.js drops both halves of every confusable pair,
    // so O, 0, I, 1, L and U never appear in a real code. Mapping a typo to
    // the "obvious" neighbour would resolve it to a DIFFERENT client's
    // project, which is worse than refusing it.
    for (const bad of ["MU-O234-5678", "MU-0234-5678", "MU-I234-5678", "MU-1234-5678"]) {
      expect(isCompleteTrackingCode(bad)).toBe(false)
    }
  })
})
