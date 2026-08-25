// Codemod · framer-motion `motion` → `m` (LazyMotion). Run: node scripts/codemods/framer-motion-to-m.mjs
// - `import { motion, ... } from "framer-motion"` → `import { m, ... }`
// - `<motion.div` / `</motion.div>` → `<m.div` / `</m.div>`
// - `motion(Comp)` / `motion.create(Comp)` → `m(Comp)` / `m.create(Comp)`
// Only touches files that import `motion` from framer-motion.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = new URL("../../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")
const files = []
;(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|tsx?)$/.test(n)) files.push(p)
  }
})(root)

const importRe = /import\s*\{([^}]*)\}\s*from\s*(['"])framer-motion\2/g
let changed = 0
for (const f of files) {
  const src = readFileSync(f, "utf8")
  if (!/\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/.test(src)) continue
  let out = src.replace(importRe, (all, names, q) => {
    const list = names.split(",").map(s => s.trim()).filter(Boolean)
      .map(s => (s === "motion" ? "m" : s))
    return `import { ${list.join(", ")} } from ${q}framer-motion${q}`
  })
  out = out
    .replace(/<motion\.([A-Za-z][\w]*)/g, "<m.$1")
    .replace(/<\/motion\.([A-Za-z][\w]*)>/g, "</m.$1>")
    .replace(/\bmotion\.create\(/g, "m.create(")
    .replace(/(?<![\w.])motion\((?=[A-Z\w"'])/g, "m(")
  if (out !== src) { writeFileSync(f, out); changed++; console.log("modified", f.slice(root.length + 1)) }
}
console.log(`\n${changed} files changed`)
