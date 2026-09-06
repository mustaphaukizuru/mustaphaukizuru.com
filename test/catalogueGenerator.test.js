// ─────────────────────────────────────────────────────────────────────────────
// T2-10 · the catalogue references are outputs, and the drift gate can work.
//
// docs/catalogue/*.md were hand-written snapshots whose own front matter said
// "regenerate after any edit; do not hand-edit prices here" — and nothing
// regenerated them. They are generated now, and CI re-runs the generator and
// fails when the committed copy differs.
//
// The thing that would quietly break that check is non-determinism. The
// generator used to stamp `new Date()` into every document, so a committed
// output stopped matching a fresh run the day after it was committed and the
// gate would have failed on every PR for a reason unrelated to the PR. These
// tests run the generator twice, into two different directories, and compare.
// ─────────────────────────────────────────────────────────────────────────────

const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const WEB = path.join(ROOT, "web")
const SCRIPT = path.join(WEB, "scripts", "generate-service-catalog.mjs")
const REF_DIR = path.join(ROOT, "docs", "catalogue")

/**
 * Run the generator with `public/` and `../docs/catalogue/` inside a scratch
 * directory, so it writes nothing into the repo.
 */
function runInScratch() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"))
  const cwd = path.join(base, "web")
  fs.mkdirSync(path.join(cwd, "public", "documents"), { recursive: true })
  execFileSync(process.execPath, [SCRIPT], { cwd, stdio: "pipe", timeout: 120_000 })
  return base
}

const readAll = (dir) => Object.fromEntries(
  fs.readdirSync(dir).sort().map((name) => [name, fs.readFileSync(path.join(dir, name), "utf8")]),
)

describe("the generated references exist and say what they are", () => {
  const files = [
    "services-and-categories.md",
    "services-and-categories.es.md",
    "packages-and-pricing-plans.md",
    "engagement-process-content.md",
  ]

  test.each(files)("docs/catalogue/%s is committed", (name) => {
    expect(fs.existsSync(path.join(REF_DIR, name))).toBe(true)
  })

  test("each generated file warns that it is generated", () => {
    const missing = files
      .filter((n) => n !== "engagement-process-content.md") // authored, not generated
      .filter((n) => !/never hand-edit|nunca editar/i.test(fs.readFileSync(path.join(REF_DIR, n), "utf8")))
    expect(missing).toEqual([])
  })

  test("web/docs is gone — docs/ is the documented location", () => {
    expect(fs.existsSync(path.join(WEB, "docs"))).toBe(false)
  })
})

describe("counts come from the data, not from prose", () => {
  const en = fs.readFileSync(path.join(REF_DIR, "services-and-categories.md"), "utf8")
  const packages = fs.readFileSync(path.join(REF_DIR, "packages-and-pricing-plans.md"), "utf8")

  test("the reference says 20 offerings, not the 21 that was written down", () => {
    expect(en).toContain("4 categories · 20 offerings")
    expect(en).not.toContain("21 offerings")
  })

  test("the category table rows sum to the stated total", () => {
    const rows = [...en.matchAll(/^\| \d \| .+? \| (\d+) \|/gm)].map((m) => Number(m[1]))
    expect(rows).toHaveLength(4)
    expect(rows.reduce((a, b) => a + b, 0)).toBe(20)
  })

  test("the packages reference states the quote-only rule from T2-4", () => {
    expect(packages).toMatch(/quote-only/)
    expect(packages).toContain("MX$50,000")
  })

  test("the packages reference says which prices it is printing", () => {
    // The live site reads prices from the DB and only features from the static
    // file. A reference that does not say so reads as authoritative when it is
    // the code's view, not the site's.
    expect(packages).toContain("GET /services/plans")
  })
})

describe("the Spanish reference is Spanish", () => {
  const es = fs.readFileSync(path.join(REF_DIR, "services-and-categories.es.md"), "utf8")

  test("headings and labels are translated", () => {
    expect(es).toContain("# Catálogo de Servicios — Referencia")
    expect(es).toContain("| # | Categoría | Servicios | Audiencia principal |")
    expect(es).toContain("**Entregables:**")
  })

  test("audience labels are translated too, not left in English", () => {
    // These printed as "SMEs & Businesses" in the Spanish document, so a
    // Spanish proposal named its own audience in the wrong language.
    expect(es).toContain("PyMEs y empresas")
    expect(es).not.toContain("SMEs & Businesses")
  })

  test("it covers the same offerings as the English one", () => {
    const en = fs.readFileSync(path.join(REF_DIR, "services-and-categories.md"), "utf8")
    const count = (s) => (s.match(/^### /gm) || []).length
    expect(count(es)).toBe(count(en))
  })
})

describe("output is a pure function of the source", () => {
  // Slow: two full generator runs. It is the test that makes the CI gate
  // trustworthy, so it earns the seconds.
  jest.setTimeout(180_000)

  test("two runs produce byte-identical documents", () => {
    const a = runInScratch()
    const b = runInScratch()
    for (const rel of [["docs", "catalogue"], ["web", "public", "documents"]]) {
      const left = readAll(path.join(a, ...rel))
      const right = readAll(path.join(b, ...rel))
      expect(Object.keys(left).length).toBeGreaterThan(0)
      expect(right).toEqual(left)
    }
  })

  test("nothing in the generator reads the clock", () => {
    const src = fs.readFileSync(SCRIPT, "utf8")
    // `new Date(CATALOG_LAST_UPDATED...)` is fine — a bare `new Date()` is not.
    expect(src).not.toMatch(/new Date\(\)/)
    expect(src).toContain("CATALOG_LAST_UPDATED")
  })

  test("a fresh run matches what is committed", () => {
    const scratch = runInScratch()
    const generated = readAll(path.join(scratch, "docs", "catalogue"))
    for (const [name, body] of Object.entries(generated)) {
      expect(fs.readFileSync(path.join(REF_DIR, name), "utf8")).toBe(body)
    }
  })
})

describe("the drift gate is wired", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(WEB, "package.json"), "utf8"))

  test("catalog:check regenerates and then diffs against HEAD", () => {
    const check = pkg.scripts["catalog:check"]
    expect(check).toContain("generate-service-catalog.mjs")
    // Against HEAD, not the index: staging a stale generated file must not
    // make the check pass.
    expect(check).toContain("git diff --exit-code HEAD")
    expect(check).toContain("../docs/catalogue")
  })

  test("build:seo regenerates the catalogue with the rest of the output", () => {
    expect(pkg.scripts["build:seo"]).toContain("catalog:generate")
  })

  test("CI runs it", () => {
    const ci = fs.readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8")
    expect(ci).toContain("npm run catalog:check")
  })
})

describe("the retired catalogue docs point somewhere", () => {
  test.each(["SERVICE_CATALOGUE.md", "SERVICE_CATALOGUE_2026-08.md"])("%s is a pointer", (name) => {
    const src = fs.readFileSync(path.join(ROOT, "docs", name), "utf8")
    expect(src).toMatch(/Retired/i)
    expect(src).toContain("docs/catalogue/")
    expect(src).toContain("servicesCatalogue.js")
  })

  test("no source file still calls the retired markdown the source of truth", () => {
    const src = fs.readFileSync(path.join(WEB, "src", "data", "servicesCatalogue.js"), "utf8")
    expect(src).toContain("THIS FILE IS THE SOURCE OF TRUTH")
    expect(src).not.toMatch(/Source of truth: docs\/SERVICE_CATALOGUE/)
  })
})
