// ─────────────────────────────────────────────────────────────────────────────
// T5-1 · the code a client types, reads aloud, or copies off an invoice.
//
// Two properties carry the whole design:
//
//   1. the alphabet excludes BOTH halves of every confusable pair (0/O, 1/I/L,
//      and U), so an unknown glyph can be refused rather than guessed at. A
//      "helpful" mapping would resolve a mistyped code to another VALID code,
//      which is another client's project.
//
//   2. the code is a lookup key, not a secret. ~2^39 with a rate limit in
//      front (ADR 0006), never used for authorisation.
// ─────────────────────────────────────────────────────────────────────────────

const {
  ALPHABET,
  LENGTH,
  generateTrackingCode,
  normalizeTrackingCode,
  isValidTrackingCode,
  withUniqueTrackingCode,
} = require("../src/utils/trackingCode")

describe("the alphabet", () => {
  test("excludes every ambiguous glyph, both halves of each pair", () => {
    const present = []
    for (const ch of "01ILOU") {
      present.push(...(ALPHABET.includes(ch) ? [ch] : []))
    }
    expect(present).toEqual([])
  })

  test("has no duplicates and is 30 symbols", () => {
    expect(new Set(ALPHABET).size).toBe(ALPHABET.length)
    expect(ALPHABET.length).toBe(30)
  })

  test("carries about 39 bits over 8 characters — enough for a key, not a secret", () => {
    const bits = Math.log2(ALPHABET.length ** LENGTH)
    expect(bits).toBeGreaterThan(38)
    expect(bits).toBeLessThan(41)
  })
})

describe("generated codes", () => {
  const codes = Array.from({ length: 500 }, generateTrackingCode)

  test("look like MU-XXXX-XXXX and validate", () => {
    for (const code of codes.slice(0, 50)) {
      expect(code).toMatch(/^MU-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}$/)
      expect(isValidTrackingCode(code)).toBe(true)
    }
  })

  test("use only alphabet symbols", () => {
    const stray = new Set()
    for (const code of codes) {
      for (const ch of code.replace(/^MU-/, "").replace(/-/g, "")) {
        if (!ALPHABET.includes(ch)) stray.add(ch)
      }
    }
    expect([...stray]).toEqual([])
  })

  test("do not repeat across 500 draws", () => {
    // Not a uniqueness guarantee — that is the database's job — but a
    // generator with a broken random source shows up here immediately.
    expect(new Set(codes).size).toBe(codes.length)
  })

  test("spread across the alphabet rather than clustering", () => {
    // Guards the modulo-bias rejection loop. 256 is not a multiple of 30, so
    // a naive `byte % 30` would over-represent the first 16 symbols by ~7%.
    const counts = new Map()
    for (const code of codes) {
      for (const ch of code.replace(/^MU-/, "").replace(/-/g, "")) {
        counts.set(ch, (counts.get(ch) || 0) + 1)
      }
    }
    expect(counts.size).toBe(ALPHABET.length)
    const values = [...counts.values()]
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    // Generous band: this catches a systematically skewed generator, not
    // ordinary sampling noise, and must not be flaky.
    const skewed = []
    for (const [ch, n] of counts) {
      if (n < mean * 0.4 || n > mean * 1.8) skewed.push(`${ch}: ${n} vs mean ${mean.toFixed(1)}`)
    }
    expect(skewed).toEqual([])
  })
})

describe("reading back what someone typed", () => {
  const code = "MU-7K4C-9XQF"

  test.each([
    ["MU-7K4C-9XQF", "exactly as printed"],
    ["mu-7k4c-9xqf", "lower case"],
    ["MU7K4C9XQF", "no hyphens"],
    ["7K4C9XQF", "no prefix"],
    ["7k4c-9xqf", "neither"],
    ["  MU-7K4C-9XQF  ", "padded"],
    ["MU 7K4C 9XQF", "spaces instead of hyphens"],
  ])("%s (%s) resolves", (input) => {
    expect(normalizeTrackingCode(input)).toBe(code)
  })

  test("an excluded glyph is REFUSED, never corrected", () => {
    // The important one. Mapping O→Q or I→J would turn a typo into a
    // different client's project, silently.
    const accepted = []
    for (const bad of ["MU-OOOO-2222", "MU-1111-2222", "MU-IIII-2222", "MU-LLLL-2222", "MU-UUUU-2222", "MU-0000-2222"]) {
      accepted.push(...(normalizeTrackingCode(bad) === null ? [] : [bad]))
    }
    expect(accepted).toEqual([])
  })

  test.each([
    [null], [undefined], [12345678], [{}], [""],
    ["MU-7K4C"], ["MU-7K4C-9XQF-EXTRA"], ["7K4C9XQ"], ["7K4C9XQFF"],
  ])("%j is not a code", (input) => {
    expect(normalizeTrackingCode(input)).toBeNull()
  })

  test("round-trips whatever the generator produces", () => {
    for (let i = 0; i < 200; i += 1) {
      const generated = generateTrackingCode()
      expect(normalizeTrackingCode(generated)).toBe(generated)
      expect(normalizeTrackingCode(generated.toLowerCase().replace(/-/g, ""))).toBe(generated)
    }
  })
})

describe("isValidTrackingCode", () => {
  test("accepts the canonical form only", () => {
    expect(isValidTrackingCode("MU-7K4C-9XQF")).toBe(true)
    // Not a normaliser: these are inputs, not stored values.
    expect(isValidTrackingCode("mu-7k4c-9xqf")).toBe(false)
    expect(isValidTrackingCode("MU7K4C9XQF")).toBe(false)
    expect(isValidTrackingCode("MU-OOOO-9XQF")).toBe(false)
    expect(isValidTrackingCode(null)).toBe(false)
  })
})

describe("collisions are retried, not raised", () => {
  const p2002 = () => Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { target: ["trackingCode"] },
  })

  test("redraws on a duplicate and succeeds", async () => {
    let calls = 0
    const result = await withUniqueTrackingCode(async (code) => {
      calls += 1
      if (calls < 3) throw p2002()
      return code
    })
    expect(calls).toBe(3)
    expect(isValidTrackingCode(result)).toBe(true)
  })

  test("draws a different code each attempt", async () => {
    const seen = []
    await withUniqueTrackingCode(async (code) => {
      seen.push(code)
      if (seen.length < 4) throw p2002()
      return code
    })
    expect(new Set(seen).size).toBe(seen.length)
  })

  test("gives up eventually rather than looping forever", async () => {
    await expect(withUniqueTrackingCode(async () => { throw p2002() }, { retries: 3 }))
      .rejects.toMatchObject({ code: "P2002" })
  })

  test("does not swallow an unrelated failure", async () => {
    // A P2002 on a different column, or any other error, is a real bug and
    // must surface on the first attempt rather than being retried five times.
    const other = Object.assign(new Error("nope"), { code: "P2002", meta: { target: ["serviceOrderId"] } })
    let calls = 0
    await expect(withUniqueTrackingCode(async () => { calls += 1; throw other })).rejects.toThrow("nope")
    expect(calls).toBe(1)

    calls = 0
    await expect(withUniqueTrackingCode(async () => { calls += 1; throw new Error("db down") })).rejects.toThrow("db down")
    expect(calls).toBe(1)
  })
})
