/**
 * Codemod · react-router Link/NavLink → LocalizedLink/LocalizedNavLink.
 *
 *   node scripts/codemods/localize-links.mjs --dry     # report, write nothing
 *   node scripts/codemods/localize-links.mjs           # rewrite
 *
 * T2-1. An unprefixed `to="/services"` clicked from /es switches the whole
 * interface to English, because LanguageWrapper reads the language off the
 * URL prefix on every navigation. Roughly 150 links in the public tree were
 * unprefixed, so a Spanish visitor lost Spanish at the first click.
 *
 * WHAT IT DOES
 *   · rewrites the import specifier: `Link` → `LocalizedLink as Link`, so
 *     every JSX call site in the file keeps working untouched. Reviewing a
 *     150-file diff is hard enough without also re-reading every <Link>.
 *   · adds the import from the right relative depth
 *   · rewrites `useNavigate` to the localized hook the same way
 *   · leaves every other react-router export (useLocation, Outlet,
 *     useParams…) on the original import
 *
 * WHAT IT SKIPS, AND WHY
 *   · the admin and dashboard trees — App.jsx mirrors only public and auth
 *     routes under /es, so a prefixed operator link points at a route that
 *     does not exist
 *   · LocalizedLink.jsx and useLocalizedNavigate.js — they own the raw
 *     primitives
 *   · anything already importing the localized versions (idempotent)
 *   · LanguageWrapper and LanguageSwitcher — they navigate ACROSS languages
 *     deliberately and must not be re-prefixed
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, relative, dirname, sep } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..")
const SRC = join(WEB, "src")
const DRY = process.argv.includes("--dry")

const DIRS = ["pages", "components", "layout"].map((d) => join(SRC, d))

const SKIP_RE = [
  /[\\/]pages[\\/]Admin/i,
  /[\\/]pages[\\/]Dashboard/i,
  /[\\/]components[\\/]admin[\\/]/i,
  /[\\/]layout[\\/]AdminLayout\.jsx$/i,
  /[\\/]layout[\\/]DashboardLayout\.jsx$/i,
  /[\\/]components[\\/]LocalizedLink\.jsx$/i,
  /[\\/]hooks[\\/]useLocalizedNavigate\.js$/i,
  /LanguageWrapper\.jsx$/i,
  /LanguageSwitcher\.jsx$/i,
  /\.test\.jsx?$/i,
]

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(e)) out.push(p)
  }
  return out
}

/** "../../components/LocalizedLink" for a file at any depth. */
function importPath(file, targetAbs) {
  let rel = relative(dirname(file), targetAbs).split(sep).join("/")
  if (!rel.startsWith(".")) rel = `./${rel}`
  return rel.replace(/\.jsx?$/, "")
}

// Note the absence of \s* before the optional semicolon. An earlier version
// had one, and it swallowed the newline separating this import from the next,
// producing `...useLocalizedNavigate"import { m } from "framer-motion"` in 77
// files in one pass.
const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])react-router-dom\2;?/

const files = DIRS.flatMap((d) => walk(d)).filter((f) => !SKIP_RE.some((re) => re.test(f)))

let changed = 0
const report = []

for (const file of files) {
  const src = readFileSync(file, "utf8")
  const m = src.match(IMPORT_RE)
  if (!m) continue

  const names = m[1].split(",").map((s) => s.trim()).filter(Boolean)
  const wanted = { Link: null, NavLink: null, useNavigate: null }
  const keep = []

  for (const spec of names) {
    // Handles "Link", "Link as RRLink" and stray whitespace.
    const [orig, , alias] = spec.split(/\s+(as)\s+/)
    if (orig in wanted) wanted[orig] = alias || orig
    else keep.push(spec)
  }

  const swaps = Object.entries(wanted).filter(([, v]) => v)
  if (!swaps.length) continue

  const linkTarget = join(SRC, "components", "LocalizedLink.jsx")
  const hookTarget = join(SRC, "hooks", "useLocalizedNavigate.js")

  const localizedNames = []
  if (wanted.Link) localizedNames.push(`LocalizedLink as ${wanted.Link}`)
  if (wanted.NavLink) localizedNames.push(`LocalizedNavLink as ${wanted.NavLink}`)

  const lines = []
  if (localizedNames.length) {
    lines.push(`import { ${localizedNames.join(", ")} } from "${importPath(file, linkTarget)}"`)
  }
  if (wanted.useNavigate) {
    lines.push(`import ${wanted.useNavigate} from "${importPath(file, hookTarget)}"`)
  }

  // Keep the original import only if something else came from it.
  const rrLine = keep.length
    ? `import { ${keep.join(", ")} } from "react-router-dom"`
    : null

  const replacement = [rrLine, ...lines].filter(Boolean).join("\n")
  const out = src.replace(IMPORT_RE, replacement)

  report.push(`${relative(SRC, file).split(sep).join("/")}  ${swaps.map(([k]) => k).join(", ")}`)
  if (!DRY) writeFileSync(file, out)
  changed += 1
}

console.log(`${DRY ? "[dry run] " : ""}${changed} file(s) ${DRY ? "would be" : ""} rewritten\n`)
for (const r of report) console.log("  " + r)

const excluded = DIRS.flatMap((d) => walk(d)).filter((f) => SKIP_RE.some((re) => re.test(f)))
  .filter((f) => IMPORT_RE.test(readFileSync(f, "utf8")))
if (excluded.length) {
  console.log(`\n  skipped ${excluded.length} file(s) by design (admin/dashboard, the localized wrappers, the language switchers):`)
  for (const f of excluded.slice(0, 12)) console.log("    " + relative(SRC, f).split(sep).join("/"))
  if (excluded.length > 12) console.log(`    … and ${excluded.length - 12} more`)
}
