/**
 * T1-1 / T1-7 · deploy.sh is transactional, and the bundle-freshness check
 * exists. Source-level on purpose: running the deploy needs a host. What is
 * pinned here is the ORDER of the guards and the things the script must
 * never do (`--accept-data-loss`, building the tracked bundle by default),
 * plus a `bash -n` parse of every shell script touched.
 */
const fs   = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const ROOT = path.join(__dirname, "..")
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8")
const at   = (src, needle) => { const i = src.indexOf(needle); if (i === -1) throw new Error(`missing: ${needle}`); return i }

const deploy = read("scripts/deploy.sh")
// Command lines only — the header comments name the things the script must not do.
const code = deploy.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")

test("records the previous SHA before pulling, and pulls fast-forward only", () => {
  expect(at(deploy, 'PREV_SHA="$(git rev-parse HEAD)"')).toBeLessThan(at(deploy, "git pull --ff-only"))
})

test("drift check and snapshot both precede db push; db push never accepts data loss", () => {
  const push = at(deploy, "npx prisma db push")
  expect(at(deploy, "node scripts/check-db-drift.js")).toBeLessThan(push)
  expect(at(deploy, "node scripts/backup-db-json.js")).toBeLessThan(push)
  expect(code).not.toMatch(/accept-data-loss/)
})

test("uses scripts/prisma-generate.js, not a bare prisma generate", () => {
  expect(code).toMatch(/node scripts\/prisma-generate\.js/)
  expect(code).not.toMatch(/npx prisma generate/)
})

test("the health gate requires database:ok and the smoke test, and both roll back", () => {
  expect(deploy).toMatch(/"database":"ok"/)
  expect(deploy).toMatch(/rollback "health gate failed/)
  expect(deploy).toMatch(/rollback "smoke test failed/)
  const rb = deploy.slice(at(deploy, "rollback() {"), at(deploy, "# ── 1 · pull"))
  expect(rb).toMatch(/git reset --hard "\$PREV_SHA"/)
  expect(rb).toMatch(/npm ci --omit=dev/)
  expect(rb).toMatch(/node scripts\/prisma-generate\.js/)
  expect(rb).toMatch(/exit 1/)
})

test("raises the maintenance page before the restart and drops it after the gate, and on rollback", () => {
  const on  = at(deploy, "maintenance_on\n")
  const gate = at(deploy, "# ── 6 · gate")
  const off = deploy.lastIndexOf("maintenance_off")
  expect(on).toBeLessThan(gate)
  expect(off).toBeGreaterThan(gate)
  expect(deploy.slice(at(deploy, "rollback() {"), at(deploy, "# ── 1 · pull"))).toMatch(/maintenance_off/)
})

test("deploys the committed bundle and only builds on the host when asked", () => {
  expect(deploy).toMatch(/DEPLOY_BUILD_SPA/)
  expect(deploy).toMatch(/public\/index\.html/)
  expect(deploy).not.toMatch(/NOT\s+tracked in git/)
})

test(".htaccess serves 503 while maintenance.flag exists, error pages excluded; the flag is ignored by git", () => {
  const ht = read("public/.htaccess")
  expect(ht).toMatch(/RewriteCond %\{DOCUMENT_ROOT\}\/maintenance\.flag -f/)
  expect(ht).toMatch(/RewriteCond %\{REQUEST_URI\} !\^\/\(404\|500\|503\)\\\.html\$/)
  expect(ht).toMatch(/RewriteRule \^ - \[R=503,L\]/)
  expect(read(".gitignore")).toMatch(/^\/public\/maintenance\.flag$/m)
})

test("the smoke test covers login 401, the jobs switch and the deep probe on v1 paths", () => {
  const smoke = read("scripts/smoke-test.sh")
  expect(smoke).toMatch(/\/api\/v1\/auth\/login/)
  expect(smoke).toMatch(/expected 401/)
  expect(smoke).toMatch(/\/api\/v1\/health\/jobs/)
  expect(smoke).toMatch(/X-Health-Token/)
  expect(smoke).not.toMatch(/"\/api\/health"/)
})

test("CLAUDE.md and .gitignore agree that the bundle is tracked", () => {
  const claude = read("CLAUDE.md")
  expect(claude).toMatch(/SPA bundle is committed, not built on the server/)
  expect(claude).not.toMatch(/gitignored and rebuilt on the server/)
  expect(read(".gitignore")).not.toMatch(/^\/public\/assets\/?$/m)
  expect(fs.existsSync(path.join(ROOT, "docs/decisions/0001-tracked-spa-bundle.md"))).toBe(true)
})

describe("shell scripts parse", () => {
  const bash = spawnSync("bash", ["--version"])
  const maybe = bash.status === 0 ? test : test.skip
  maybe.each(["scripts/deploy.sh", "scripts/smoke-test.sh", "scripts/check-bundle-fresh.sh"])("bash -n %s", (file) => {
    const r = spawnSync("bash", ["-n", path.join(ROOT, file)], { encoding: "utf8" })
    expect(r.stderr).toBe("")
    expect(r.status).toBe(0)
  })
})
