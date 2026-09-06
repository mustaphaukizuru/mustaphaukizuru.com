// ─────────────────────────────────────────────────────────────────────────────
// T2-8 · the decision records, and the index that has to match them.
//
// The point of an ADR folder is that a contributor can trust it: if a question
// is not in there, nobody decided it. Two ways that trust breaks —
//
//   1. a record exists but says nothing checkable (no date, no status, no
//      consequences), so a reader cannot tell a decision from a note;
//   2. the README drifts from the files, listing a record that was never
//      written or claiming "accepted" for something still open. An index that
//      lies is worse than no index, because it is the thing people read first.
//
// Both are cheap to check and neither is caught by any other gate.
//
// The status vocabulary is deliberately two words. `proposed` means NOT
// DECIDED — three of these exist because deciding them would have meant
// inventing an answer, and a record that says so out loud is what stops the
// next person answering it by accident.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const DIR = path.join(__dirname, "..", "docs", "decisions")

const files = fs.readdirSync(DIR)
  .filter((f) => /^\d{4}-.+\.md$/.test(f))
  .sort()

const readme = fs.readFileSync(path.join(DIR, "README.md"), "utf8")

const parse = (file) => {
  const src = fs.readFileSync(path.join(DIR, file), "utf8")
  const title = (src.match(/^# (\d{4}) · (.+)$/m) || [])
  const meta = src.match(/\*\*Date:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Status:\*\* ([a-z]+)/)
  return {
    file,
    src,
    number: title[1] || null,
    heading: title[2] || null,
    date: meta?.[1] || null,
    status: meta?.[2] || null,
  }
}

const records = files.map(parse)

describe("there are records to check", () => {
  test("the folder holds every record, numbered without a gap", () => {
    // A count rather than a fixed list of seven: records are added by the
    // change that decides them, so the assertion that matters is that the
    // numbering has no hole and no duplicate — a gap means a record was
    // deleted rather than superseded.
    expect(files.length).toBeGreaterThanOrEqual(8)
    expect(files.map((f) => f.slice(0, 4)))
      .toEqual(files.map((_, i) => String(i + 1).padStart(4, "0")))
  })
})

describe("every record has the shape a record needs", () => {
  test.each(records)("$file", (rec) => {
    expect(rec.number).toBeTruthy()
    expect(rec.heading).toBeTruthy()
    expect(rec.date).toBeTruthy()
    expect(["accepted", "proposed", "superseded"]).toContain(rec.status)
  })

  test("the number in the heading matches the filename", () => {
    const mismatched = records
      .filter((r) => r.number !== r.file.slice(0, 4))
      .map((r) => `${r.file} says ${r.number}`)
    expect(mismatched).toEqual([])
  })

  test("each one says what it is deciding about and what follows", () => {
    const thin = records
      .filter((r) => !/## Context/.test(r.src))
      .map((r) => r.file)
    expect(thin).toEqual([])
  })

  test("an accepted record states its consequences", () => {
    // "Decision" without "Consequences" is an opinion, not a record.
    const missing = records
      .filter((r) => r.status === "accepted")
      .filter((r) => !/## Decision/.test(r.src) || !/## Consequences/.test(r.src))
      .map((r) => r.file)
    expect(missing).toEqual([])
  })

  test("a proposed record says plainly that it is not a decision", () => {
    // The whole risk with a placeholder is being read as settled.
    const unclear = records
      .filter((r) => r.status === "proposed")
      .filter((r) => !/NOT DECIDED/.test(r.src))
      .map((r) => r.file)
    expect(unclear).toEqual([])
  })

  test("a proposed record offers options rather than pretending to choose", () => {
    const noOptions = records
      .filter((r) => r.status === "proposed")
      .filter((r) => !/## Options|## What is actually undecided/.test(r.src))
      .map((r) => r.file)
    expect(noOptions).toEqual([])
  })

  test("every record names the tier item it came from", () => {
    const missing = records
      .filter((r) => !/\*\*Item:\*\* T\d-\d+/.test(r.src))
      .map((r) => r.file)
    expect(missing).toEqual([])
  })
})

describe("the index matches the records", () => {
  test("every record is listed", () => {
    const unlisted = records.filter((r) => !readme.includes(`(${r.file})`)).map((r) => r.file)
    expect(unlisted).toEqual([])
  })

  test("the index lists nothing that does not exist", () => {
    const linked = [...readme.matchAll(/\((\d{4}-[a-z0-9-]+\.md)\)/g)].map((m) => m[1])
    const phantom = linked.filter((name) => !files.includes(name))
    expect(phantom).toEqual([])
  })

  test("the status in the index is the status in the file", () => {
    const wrong = []
    for (const rec of records) {
      const row = readme.split("\n").find((l) => l.includes(`(${rec.file})`))
      if (!row) continue
      // The table marks proposed rows in bold; strip emphasis before comparing.
      const cells = row.split("|").map((c) => c.replace(/\*/g, "").trim())
      if (!cells.includes(rec.status)) wrong.push(`${rec.file}: file says ${rec.status}, index row does not`)
    }
    expect(wrong).toEqual([])
  })

  test("the index explains what proposed means, since three records are", () => {
    expect(records.filter((r) => r.status === "proposed").length).toBeGreaterThan(0)
    expect(readme).toMatch(/proposed/)
    expect(readme).toMatch(/NOT DECIDED|not decided/i)
  })
})

describe("the project instructions point at the folder", () => {
  test("CLAUDE.md links it, so every session loads the rule", () => {
    const claude = fs.readFileSync(path.join(__dirname, "..", "CLAUDE.md"), "utf8")
    expect(claude).toContain("docs/decisions/")
  })
})
