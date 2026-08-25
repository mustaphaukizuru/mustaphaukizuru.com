/**
 * src/config/env.js — Hostinger shared-config fallback.
 *
 * Regression guard for a real production outage (2026-08-25): auto-deploy
 * clones master into a fresh hbuilds/versions/<uuid>/nodejs/, `.env` is
 * gitignored so it is absent from the clone, and the app exited at boot on
 * "Missing required env var: DATABASE_URL". Every API request hung while the
 * SPA kept serving, because Passenger serves public/ statically without Node.
 *
 * env.js runs its validation (and process.exit) at require time and mutates
 * process.env, so each case runs in a CHILD process against a simulated
 * directory tree. That keeps the jest worker's environment untouched.
 */

const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const REAL_ENV_JS = path.join(__dirname, "..", "src", "config", "env.js")
const REPO_MODULES = path.join(__dirname, "..", "node_modules")

/** Build hbuilds/versions/<uuid>/nodejs/src/config/env.js + optional shared config. */
function buildTree({ withSharedEnv }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hbuild-test-"))
  const appDir = path.join(root, "hbuilds", "versions", "01a03a0d-uuid", "nodejs")
  fs.mkdirSync(path.join(appDir, "src", "config"), { recursive: true })
  fs.copyFileSync(REAL_ENV_JS, path.join(appDir, "src", "config", "env.js"))

  if (withSharedEnv) {
    const cfgDir = path.join(root, "hbuilds", "config")
    fs.mkdirSync(cfgDir, { recursive: true })
    fs.writeFileSync(
      path.join(cfgDir, ".env"),
      [
        "DATABASE_URL=mysql://sim:sim@localhost:3306/simdb",
        `JWT_SECRET=${"s".repeat(80)}`,
        "CLIENT_URL=https://example.test",
      ].join("\n")
    )
  }
  return { root, appDir }
}

/** Require env.js in a child with NO ambient DATABASE_URL/JWT_SECRET/CLIENT_URL. */
function loadEnvIn(appDir) {
  const target = path.join(appDir, "src", "config", "env.js").replace(/\\/g, "/")
  const childEnv = { ...process.env }
  delete childEnv.DATABASE_URL
  delete childEnv.JWT_SECRET
  delete childEnv.CLIENT_URL
  childEnv.NODE_PATH = REPO_MODULES

  return spawnSync(
    process.execPath,
    [
      "-e",
      `module.paths.push(${JSON.stringify(REPO_MODULES)});` +
        `require(${JSON.stringify(target)});` +
        `console.log("DB=" + (process.env.DATABASE_URL || "<none>"));`,
    ],
    { encoding: "utf8", cwd: appDir, env: childEnv }
  )
}

describe("config/env.js · Hostinger shared-config fallback", () => {
  const made = []
  afterAll(() => {
    for (const dir of made) fs.rmSync(dir, { recursive: true, force: true })
  })

  test("loads hbuilds/config/.env when the deploy directory has no .env", () => {
    const { root, appDir } = buildTree({ withSharedEnv: true })
    made.push(root)

    const res = loadEnvIn(appDir)

    expect(res.status).toBe(0)
    expect(res.stdout).toContain("DB=mysql://sim:sim@localhost:3306/simdb")
  })

  test("still exits 1 when neither a local nor a shared .env exists", () => {
    // Guards the fallback against becoming a silent catch-all: a genuinely
    // misconfigured deploy must still fail loudly at boot rather than start
    // up half-configured.
    const { root, appDir } = buildTree({ withSharedEnv: false })
    made.push(root)

    const res = loadEnvIn(appDir)

    expect(res.status).toBe(1)
    expect(`${res.stderr}${res.stdout}`).toMatch(/Missing required env var: DATABASE_URL/)
  })
})
