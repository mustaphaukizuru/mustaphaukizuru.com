/**
 * check-i18n.mjs · I18N01 verification
 *
 * The web/ workspace has no test runner configured, so this is a plain Node
 * smoke test. It runs OUTSIDE Vite (no import.meta.env, no bundler), so it
 * rebuilds the same wiring src/i18n/index.js uses — lazy per-language
 * bundles + a changeLanguage wrapper that loads a bundle before switching —
 * and asserts that real translated text comes back for both languages.
 *
 * It also asserts exact en/es key parity across all namespaces.
 *
 *   node scripts/check-i18n.mjs
 */

import { readFile, readdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import assert from "node:assert/strict"

import i18next from "i18next"

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)))
const localesDir = path.join(root, "src", "i18n", "locales")

let failures = 0
function ok(label, extra = "") {
  console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ""}`)
}
function fail(label, err) {
  failures += 1
  console.log(`  FAIL  ${label}\n        ${err?.message || err}`)
}
async function check(label, fn) {
  try {
    const extra = await fn()
    ok(label, extra)
  } catch (err) {
    fail(label, err)
  }
}

// ── Namespace list, read from src/i18n/resources.js so the two cannot drift ──
const resourcesSrc = await readFile(path.join(root, "src", "i18n", "resources.js"), "utf8")
const nsBlock = resourcesSrc.match(/export const NAMESPACES = \[([\s\S]*?)\]/)
assert.ok(nsBlock, "could not read NAMESPACES from src/i18n/resources.js")
const NAMESPACES = [...nsBlock[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1])

const LANGS = ["en", "es"]

async function loadBundle(lng) {
  const dir = path.join(localesDir, lng)
  const bundle = {}
  for (const ns of NAMESPACES) {
    bundle[ns] = JSON.parse(await readFile(path.join(dir, `${ns}.json`), "utf8"))
  }
  return bundle
}

console.log("\ni18n smoke test\n")

// ── 1 · every namespace declared in resources.js exists on disk, both langs ──
await check("namespace files exist for en + es", async () => {
  for (const lng of LANGS) {
    const files = (await readdir(path.join(localesDir, lng)))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
    assert.deepEqual(files, [...NAMESPACES].sort(), `locales/${lng} does not match NAMESPACES`)
  }
  return `${NAMESPACES.length} namespaces × ${LANGS.length} languages`
})

// ── 2 · exact en/es key parity ──────────────────────────────────────────────
function flatten(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out)
    else out.push(key)
  }
  return out
}

const enBundle = await loadBundle("en")
const esBundle = await loadBundle("es")

await check("en/es key parity is exact", () => {
  let total = 0
  for (const ns of NAMESPACES) {
    const en = flatten(enBundle[ns]).sort()
    const es = flatten(esBundle[ns]).sort()
    const missingInEs = en.filter((k) => !es.includes(k))
    const missingInEn = es.filter((k) => !en.includes(k))
    assert.equal(
      missingInEs.length + missingInEn.length,
      0,
      `${ns}: missing in es [${missingInEs.slice(0, 5)}] · missing in en [${missingInEn.slice(0, 5)}]`,
    )
    total += en.length
  }
  return `${total} keys per language, 0 drift`
})

// ── 3 · the key the runtime assertions use really exists ────────────────────
const PROBE_NS = "common"
const PROBE_KEY = "nav.home"
await check(`probe key ${PROBE_NS}:${PROBE_KEY} exists in both languages`, () => {
  for (const lng of LANGS) {
    const bundle = lng === "en" ? enBundle : esBundle
    const value = PROBE_KEY.split(".").reduce((acc, part) => acc?.[part], bundle[PROBE_NS])
    assert.equal(typeof value, "string", `${lng}:${PROBE_NS}.${PROBE_KEY} is not a string`)
    assert.ok(value.length > 0, `${lng}:${PROBE_NS}.${PROBE_KEY} is empty`)
  }
  return `en="${enBundle.common.nav.home}" · es="${esBundle.common.nav.home}"`
})

// ── 4 · runtime: init with ONE language, then lazily add the other ──────────
const loaded = new Set()
const bundles = { en: enBundle, es: esBundle }
const loadCounts = { en: 0, es: 0 }

function hasBundle(lng) {
  return NAMESPACES.every((ns) => i18next.hasResourceBundle(lng, ns))
}
async function ensureBundle(lng) {
  if (hasBundle(lng)) return
  loadCounts[lng] += 1 // stands in for the dynamic import()
  loaded.add(lng)
  for (const ns of NAMESPACES) i18next.addResourceBundle(lng, ns, bundles[lng][ns], false, false)
}

await i18next.init({
  resources: { en: enBundle }, // ← only ONE language at init, as in production
  fallbackLng: "en",
  supportedLngs: LANGS,
  defaultNS: "common",
  ns: NAMESPACES,
  interpolation: { escapeValue: false },
  returnNull: false,
})
loaded.add("en")
loadCounts.en += 1

const nativeChangeLanguage = i18next.changeLanguage.bind(i18next)
i18next.changeLanguage = (lng, cb) =>
  hasBundle(lng)
    ? nativeChangeLanguage(lng, cb)
    : ensureBundle(lng).then(() => nativeChangeLanguage(lng, cb))

await check("init ships only the active language", () => {
  assert.equal(hasBundle("en"), true, "en bundle missing after init")
  assert.equal(hasBundle("es"), false, "es bundle should NOT be present at init")
  return "es absent from the initial store"
})

await check('en · t("common:nav.home") returns real text', () => {
  const value = i18next.t("common:nav.home")
  assert.notEqual(value, "common:nav.home", "returned the raw key")
  assert.notEqual(value, "nav.home", "returned the raw key")
  assert.equal(value, enBundle.common.nav.home)
  return `"${value}"`
})

await check('es · t("common:nav.home") after switching returns real Spanish text', async () => {
  await i18next.changeLanguage("es")
  assert.equal(i18next.language, "es")
  assert.equal(hasBundle("es"), true, "es bundle was not registered by the switch")
  const value = i18next.t("common:nav.home")
  assert.notEqual(value, "common:nav.home", "returned the raw key")
  assert.equal(value, esBundle.common.nav.home)
  return `"${value}"`
})

await check("es · every namespace resolves a real key after the switch", () => {
  const unresolved = []
  for (const ns of NAMESPACES) {
    const first = flatten(esBundle[ns])[0]
    if (!first) continue
    const value = i18next.t(`${ns}:${first}`)
    if (value === first || value === `${ns}:${first}`) unresolved.push(`${ns}:${first}`)
  }
  assert.equal(unresolved.length, 0, `unresolved: ${unresolved.join(", ")}`)
  return `${NAMESPACES.length}/${NAMESPACES.length} namespaces resolve`
})

await check("switching back to en still resolves, without a refetch", async () => {
  await i18next.changeLanguage("en")
  assert.equal(i18next.t("common:nav.home"), enBundle.common.nav.home)
  await i18next.changeLanguage("es")
  await i18next.changeLanguage("en")
  assert.equal(loadCounts.es, 1, `es bundle loaded ${loadCounts.es}× — memoisation broken`)
  assert.equal(loadCounts.en, 1, `en bundle loaded ${loadCounts.en}× — memoisation broken`)
  return "each bundle loaded exactly once across 4 switches"
})

// ── 5 · pre-init language detection (the /es/* first-paint case) ───────────
const { detectInitialLanguage } = await import(
  new URL("../src/i18n/detectInitialLanguage.js", import.meta.url)
)
const ORDER = ["path", "localStorage", "navigator"]
const noStore = () => null

await check("/es/* URLs resolve to Spanish BEFORE init (no English-then-swap)", () => {
  for (const pathname of ["/es", "/es/", "/es/about", "/es/store/some-product"]) {
    const got = detectInitialLanguage(ORDER, {
      pathname,
      getStored: noStore,
      navigatorLanguages: ["en-US"], // browser says English — the URL must win
    })
    assert.equal(got, "es", `${pathname} → ${got}`)
  }
  return "4 /es paths → es, even with an en-US browser"
})

await check("non-/es URLs resolve to English", () => {
  for (const pathname of ["/", "/about", "/store", "/estonia", "/blog/es-something"]) {
    const got = detectInitialLanguage(ORDER, {
      pathname,
      getStored: noStore,
      navigatorLanguages: ["en-US"],
    })
    assert.equal(got, "en", `${pathname} → ${got}`)
  }
  return "/estonia is NOT treated as /es"
})

await check("detector precedence: path > localStorage > navigator", () => {
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/es/about", getStored: () => "en", navigatorLanguages: ["en-US"] }),
    "es",
    "path should beat localStorage",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: () => "es", navigatorLanguages: ["en-US"] }),
    "es",
    "localStorage should beat navigator",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: noStore, navigatorLanguages: ["es-MX", "en"] }),
    "es",
    "navigator es-MX should resolve to es",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: noStore, navigatorLanguages: ["en-GB", "es"] }),
    "en",
    "navigator en-GB should resolve to en",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: noStore, navigatorLanguages: ["fr-FR", "de"] }),
    "es",
    "non-en navigator languages resolve to es (Spanish-first)",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: noStore, navigatorLanguages: ["pt-BR", "en"] }),
    "es",
    "only the FIRST navigator language counts — pt-BR then en is still es",
  )
  assert.equal(
    detectInitialLanguage(ORDER, { pathname: "/about", getStored: noStore, navigatorLanguages: [] }),
    "es",
    "no signal at all falls back to es",
  )
  // VITE_I18N_ENABLED=false is handled in i18n/index.js (it hard-codes "en"
  // and never calls the detector); the pure function just returns the fallback.
  assert.equal(
    detectInitialLanguage([], { pathname: "/es/about", getStored: () => "es", navigatorLanguages: ["es"] }),
    "es",
    "empty order returns the fallback language",
  )
  return "all 8 precedence cases correct"
})

await check("localStorage throwing (private mode) does not break detection", () => {
  const got = detectInitialLanguage(ORDER, {
    pathname: "/about",
    getStored: () => { throw new Error("SecurityError") },
    navigatorLanguages: ["es-MX"],
  })
  assert.equal(got, "es")
  return "falls through to navigator"
})

console.log(
  failures === 0
    ? "\ni18n smoke test: ALL CHECKS PASSED\n"
    : `\ni18n smoke test: ${failures} FAILED\n`,
)
process.exit(failures === 0 ? 0 : 1)
