// ─────────────────────────────────────────────────────────────────────────────
// T2-7 · a cited document version has to exist.
//
// Source comments cited "Instructions v4.0 § 06" and "Description v4.0 § 03"
// while the repository held v3.0 of both, and cited "Brand v3.1 §00" while no
// Brand Identity v3.1 existed at all. A citation nobody can follow is worse
// than no citation: it reads as authority, and the next contributor either
// hunts for a document that was never written or quietly invents what they
// think it said.
//
// The v4.0 documents were not missing, as it turned out — the sections and the
// R-numbered recommendations match docs/PUBLIC_SURFACE_BLUEPRINT_v4.0.html,
// which is in the repo under a different title. Those citations were retitled
// rather than replaced.
//
// This walks the source, extracts every "<Document> v<major>.<minor>", and
// requires a file in docs/ that declares that version.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const DOCS = path.join(ROOT, "docs")

const SOURCE_ROOTS = [
  path.join(ROOT, "src"),
  path.join(ROOT, "prisma"),
  path.join(ROOT, "web", "src"),
  path.join(ROOT, "web", "scripts"),
]

const SOURCE_EXT = /\.(js|jsx|mjs|cjs|css)$/

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) out.push(...walk(full))
    else if (SOURCE_EXT.test(name)) out.push(full)
  }
  return out
}

// "Instructions v4.0", "Brand Identity v3.1", "Blueprint v4.0", ...
const CITATION_RE = /\b((?:[A-Z][A-Za-z]+ ){0,2}(?:Instructions|Description|Blueprint|Brand|Identity|System))\s+v(\d+)\.(\d+)/g

/**
 * Every document in docs/, with the version strings it declares. A document
 * declares a version by carrying it in its filename or in its first 60 lines
 * — a title block, a front-matter line, or a section heading.
 */
function declaredVersions() {
  const found = new Map() // "3.1" → [files]
  const add = (v, file) => {
    if (!found.has(v)) found.set(v, [])
    found.get(v).push(file)
  }
  for (const name of fs.readdirSync(DOCS)) {
    const full = path.join(DOCS, name)
    if (fs.statSync(full).isDirectory()) continue
    for (const m of name.matchAll(/v(\d+)\.(\d+)/g)) add(`${m[1]}.${m[2]}`, name)
    if (!/\.(md|html|txt)$/i.test(name)) continue
    const head = fs.readFileSync(full, "utf8").split("\n").slice(0, 60).join("\n")
    for (const m of head.matchAll(/v(\d+)\.(\d+)/g)) add(`${m[1]}.${m[2]}`, name)
  }
  return found
}

const files = SOURCE_ROOTS.flatMap(walk)

describe("the walk found something to check", () => {
  test("source files were read", () => {
    expect(files.length).toBeGreaterThan(200)
  })

  test("docs/ declares versions", () => {
    expect(declaredVersions().size).toBeGreaterThan(0)
  })
})

describe("every cited document version exists in docs/", () => {
  test("no citation points at a missing version", () => {
    const versions = declaredVersions()
    const orphans = []
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8")
      for (const m of src.matchAll(CITATION_RE)) {
        const version = `${m[2]}.${m[3]}`
        if (versions.has(version)) continue
        orphans.push(`${path.relative(ROOT, file)}: "${m[0]}"`)
      }
    }
    expect(orphans).toEqual([])
  })
})

describe("the two documents that never existed are not cited any more", () => {
  test('no source file cites "Instructions v4.0" or "Description v4.0"', () => {
    // The repository holds v3.0 of both. What those comments meant is the
    // Public Surface Blueprint v4.0.
    const bad = files
      .filter((f) => /Instructions v4\.0|Description v4\.0/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f))
    expect(bad).toEqual([])
  })

  test("the blueprint they meant is in the repo", () => {
    expect(fs.existsSync(path.join(DOCS, "PUBLIC_SURFACE_BLUEPRINT_v4.0.html"))).toBe(true)
  })

  test("and the citations now name it", () => {
    const citing = files.filter((f) => /Blueprint v4\.0/.test(fs.readFileSync(f, "utf8")))
    expect(citing.length).toBeGreaterThan(0)
  })
})

describe("the stack sections describe the stack that is installed", () => {
  const web = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "package.json"), "utf8"))
  const major = (range) => String(range || "").replace(/^[^\d]*/, "").split(".")[0]

  test.each(["PROJECT_INSTRUCTIONS.md", "PROJECT_DESCRIPTION.md"])("%s names the live majors", (name) => {
    const src = fs.readFileSync(path.join(DOCS, name), "utf8")
    expect(src).toContain(`React ${major(web.dependencies.react)}`)
    expect(src).toContain(`Vite ${major(web.devDependencies.vite)}`)
    expect(src).toContain(`Tailwind v${major(web.dependencies.tailwindcss || web.devDependencies.tailwindcss)}`)
  })

  test.each(["PROJECT_INSTRUCTIONS.md", "PROJECT_DESCRIPTION.md"])("%s no longer lists axios", (name) => {
    // It was in both stack lists and is not a dependency of web/ at all.
    expect(web.dependencies.axios).toBeUndefined()
    const src = fs.readFileSync(path.join(DOCS, name), "utf8")
    const lines = src.split("\n").filter((l) => /axios/.test(l))
    // The amendment note explains the removal; nothing else may mention it.
    for (const line of lines) expect(line).toMatch(/not a dependency/)
  })

  test("the instructions point at the generated catalogue, not at themselves", () => {
    const src = fs.readFileSync(path.join(DOCS, "PROJECT_INSTRUCTIONS.md"), "utf8")
    expect(src).toContain("docs/catalogue/")
    expect(src).toContain("docs/decisions/")
  })
})
