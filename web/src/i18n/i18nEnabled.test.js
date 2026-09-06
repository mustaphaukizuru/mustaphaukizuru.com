/**
 * One polarity for VITE_I18N_ENABLED (T2-2).
 *
 * The flag was read in opposite directions in two places, so they only ever
 * agreed when it was explicitly set — and it is set in neither CI nor the
 * host. The SPA shipped and served /es while generate-sitemap.mjs emitted no
 * /es alternates and dropped the xhtml namespace, so Google was never told
 * the Spanish mirror exists.
 *
 * The last test is the one that matters long-term: it fails if anyone reads
 * the variable directly again instead of going through this helper.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { isI18nEnabled } from "./i18nEnabled"

describe("unset means enabled — the site is bilingual by default", () => {
  it.each([undefined, null, ""])("%s → enabled", (raw) => {
    expect(isI18nEnabled(raw)).toBe(true)
  })
})

describe('only the literal "false" disables it', () => {
  it.each(["false", "FALSE", "False", " false ", "false\n"])("%j → disabled", (raw) => {
    expect(isI18nEnabled(raw)).toBe(false)
  })

  it.each(["true", "TRUE", "1", "0", "no", "off", "yes", "enabled"])("%j → enabled", (raw) => {
    // Deliberately permissive in one direction only. Turning the Spanish site
    // off is a decision someone has to spell out; a typo must not do it
    // silently, which is how "=== true" managed to disable the sitemap half
    // on every build.
    expect(isI18nEnabled(raw)).toBe(true)
  })
})

describe("nobody reads the variable directly any more", () => {
  // vitest.config.js roots this at web/, and jsdom gives import.meta.url an
  // http: scheme so fileURLToPath cannot be used here. The walk asserts it
  // found files, so a wrong cwd fails instead of passing vacuously.
  const WEB = process.cwd()

  const walk = (dir) => {
    const out = []
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name === ".git") continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) out.push(...walk(full))
      else if (/\.(js|jsx|mjs|cjs)$/.test(name)) out.push(full)
    }
    return out
  }

  it("every VITE_I18N_ENABLED read goes through isI18nEnabled", () => {
    const files = [...walk(join(WEB, "src")), ...walk(join(WEB, "scripts"))]
    expect(files.length).toBeGreaterThan(100)
    // The two readers this exists to keep in step must be among them.
    expect(files.some((f) => f.endsWith(join("i18n", "index.js")))).toBe(true)
    expect(files.some((f) => f.endsWith("generate-sitemap.mjs"))).toBe(true)

    const offenders = []
    for (const file of files) {
      if (file.endsWith("i18nEnabled.js") || file.endsWith("i18nEnabled.test.js")) continue
      for (const [i, line] of readFileSync(file, "utf8").split("\n").entries()) {
        if (!line.includes("VITE_I18N_ENABLED")) continue
        // A comment mentioning the flag is documentation, not a second reading.
        const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "")
        if (!code.includes("VITE_I18N_ENABLED")) continue
        if (code.includes("isI18nEnabled")) continue
        offenders.push(`${file.slice(WEB.length + 1)}:${i + 1} ${line.trim()}`)
      }
    }
    expect(offenders, "read the flag through isI18nEnabled so both halves agree").toEqual([])
  })
})
