/**
 * formatDay vs formatDate — the one-day-early bug (D0-2).
 *
 * A field somebody picked in an `<input type="date">` arrives as
 * "2026-10-01" and `new Date("2026-10-01")` is MIDNIGHT UTC. Rendered with
 * the browser's local timezone, every reader west of Greenwich saw the
 * previous day: in Mexico City (UTC-6) a project due 1 October read
 * "Sep 30", and that was true of every due date, start date and invoice
 * due date on the dashboard.
 *
 * These tests run with TZ pinned to America/Mexico_City, because in UTC the
 * bug is invisible and the suite would pass either way. That is exactly why
 * it survived: the formatter was correct for half the fields it was used on
 * and correct everywhere for a developer in London.
 */
import { describe, expect, it } from "vitest"

import { formatDate, formatDay } from "./format"

// Vitest reads TZ at process start, so the pin lives in vitest.config.js.
// This assertion is here so the file fails loudly rather than silently
// passing in UTC if that config is ever changed.
describe("the test environment is west of Greenwich", () => {
  it("is running in a negative-offset timezone, or these tests prove nothing", () => {
    const offsetMinutes = new Date("2026-10-01T00:00:00Z").getTimezoneOffset()
    // getTimezoneOffset is POSITIVE for zones behind UTC.
    expect(offsetMinutes).toBeGreaterThan(0)
  })
})

describe("formatDay · a calendar day somebody picked", () => {
  it("renders the day that was chosen, not the day before it", () => {
    // The exact case from the screenshot that started this.
    expect(formatDay("2026-10-01T00:00:00.000Z", "en")).toBe("Oct 1, 2026")
    expect(formatDay("2026-06-01T00:00:00.000Z", "en")).toBe("Jun 1, 2026")
  })

  it("holds across a month boundary, which is where it is most visible", () => {
    expect(formatDay("2026-01-01T00:00:00.000Z", "en")).toBe("Jan 1, 2026")
    expect(formatDay("2026-03-01T00:00:00.000Z", "en")).toBe("Mar 1, 2026")
  })

  it("holds across a year boundary", () => {
    expect(formatDay("2027-01-01T00:00:00.000Z", "en")).toBe("Jan 1, 2027")
  })

  it("takes a bare date string, which is what an <input type=date> gives", () => {
    expect(formatDay("2026-10-01", "en")).toBe("Oct 1, 2026")
  })

  it("renders in Spanish too", () => {
    expect(formatDay("2026-10-01T00:00:00.000Z", "es")).toMatch(/1 oct/)
  })

  it("a caller cannot override the timezone away", () => {
    // timeZone is applied last on purpose: the one thing that makes this
    // function different from formatDate must not be optional.
    expect(formatDay("2026-10-01T00:00:00.000Z", "en", { timeZone: "Asia/Tokyo" })).toBe("Oct 1, 2026")
  })

  it("still accepts option overrides that are not the timezone", () => {
    expect(formatDay("2026-10-01T00:00:00.000Z", "en", { month: "long" })).toBe("October 1, 2026")
  })

  it("an invalid or missing value is empty, not 'Invalid Date'", () => {
    expect(formatDay(null)).toBe("")
    expect(formatDay(undefined)).toBe("")
    expect(formatDay("not-a-date")).toBe("")
  })
})

describe("formatDate · an instant the server stamped", () => {
  it("stays LOCAL, because 'when did this happen' is about the reader's clock", () => {
    // A comment posted at 02:00 UTC happened on the previous evening in
    // Mexico City, and saying so is correct.
    expect(formatDate("2026-10-01T02:00:00.000Z", "en")).toBe("Sep 30, 2026")
  })

  it("and is unchanged by this fix — same output as before", () => {
    expect(formatDate("2026-10-01T18:00:00.000Z", "en")).toBe("Oct 1, 2026")
  })
})

describe("the two are different, which is the whole point", () => {
  it("disagree on a midnight-UTC value, by exactly one day", () => {
    const midnightUtc = "2026-10-01T00:00:00.000Z"
    expect(formatDay(midnightUtc, "en")).toBe("Oct 1, 2026")
    expect(formatDate(midnightUtc, "en")).toBe("Sep 30, 2026")
  })

  it("agree on a mid-afternoon value, which is why the bug was subtle", () => {
    const afternoon = "2026-10-01T18:00:00.000Z"
    expect(formatDay(afternoon, "en")).toBe(formatDate(afternoon, "en"))
  })
})
