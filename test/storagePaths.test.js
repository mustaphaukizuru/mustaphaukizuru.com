/**
 * config/storagePaths — where user-generated files live.
 *
 * Regression guard for a data-loss bug: nine call sites resolved storage
 * relative to the app directory, which on Hostinger is a NEW
 * hbuilds/versions/<uuid>/nodejs/ on every deploy. Avatars, admin media
 * uploads, product files added after the seed, invoices and receipts all
 * vanished on deploy while the database kept pointing at them.
 *
 * The resolver picks the base once at require time, so each scenario loads
 * the module fresh from a simulated directory tree in a child process.
 */

const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")

const REAL = path.join(__dirname, "..", "src", "config", "storagePaths.js")

function resolveIn({ hostinger, env = {} }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "storage-test-"))
  const appDir = hostinger
    ? path.join(root, "hbuilds", "versions", "01a0-uuid", "nodejs")
    : path.join(root, "plain-repo")
  fs.mkdirSync(path.join(appDir, "src", "config"), { recursive: true })
  fs.copyFileSync(REAL, path.join(appDir, "src", "config", "storagePaths.js"))

  const target = path.join(appDir, "src", "config", "storagePaths.js").replace(/\\/g, "/")
  const childEnv = { ...process.env, ...env }
  delete childEnv.STORAGE_DIR
  if (env.STORAGE_DIR) childEnv.STORAGE_DIR = env.STORAGE_DIR

  const res = spawnSync(
    process.execPath,
    ["-e", `const m=require(${JSON.stringify(target)});console.log(JSON.stringify(m.STORAGE_PATHS))`],
    { encoding: "utf8", env: childEnv }
  )
  fs.rmSync(root, { recursive: true, force: true })
  if (res.status !== 0) throw new Error(res.stderr)
  return { root, appDir, paths: JSON.parse(res.stdout) }
}

const norm = (p) => p.replace(/\\/g, "/")

describe("storagePaths", () => {
  test("on a Hostinger hbuilds tree, storage lives OUTSIDE the versioned deploy dir", () => {
    const { appDir, paths } = resolveIn({ hostinger: true })
    const base = norm(paths.base)

    // Must sit at <hbuilds>/storage — a sibling of hbuilds/config/, which is
    // the location Hostinger already keeps persistent across deploys.
    expect(base).toMatch(/\/hbuilds\/storage$/)
    // And must NOT be inside versions/<uuid>/ — that is the whole bug.
    expect(base).not.toContain("/versions/")
    expect(base).not.toContain(norm(appDir))
  })

  test("outside an hbuilds tree, keeps the historical <repo>/storage location", () => {
    const { appDir, paths } = resolveIn({ hostinger: false })
    expect(norm(paths.base)).toBe(norm(path.join(appDir, "storage")))
  })

  test("STORAGE_DIR overrides everything, including a detected hbuilds tree", () => {
    const explicit = path.join(os.tmpdir(), "explicit-storage-root")
    const { paths } = resolveIn({ hostinger: true, env: { STORAGE_DIR: explicit } })
    expect(norm(paths.base)).toBe(norm(path.resolve(explicit)))
  })

  test("every kind hangs off the single base — no call site can drift", () => {
    const { paths } = resolveIn({ hostinger: true })
    const base = norm(paths.base)
    for (const [kind, p] of Object.entries(paths)) {
      if (kind === "base") continue
      expect(norm(p).startsWith(base + "/")).toBe(true)
    }
    expect(norm(paths.avatars)).toBe(`${base}/uploads/avatars`)
    expect(norm(paths.productFile)).toBe(`${base}/productfile`)
    expect(norm(paths.receipts)).toBe(`${base}/receipts`)
  })
})
