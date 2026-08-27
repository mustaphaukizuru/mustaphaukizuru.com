/**
 * storagePaths.js — ONE place that decides where user-generated files live.
 *
 * WHY THIS EXISTS
 * ---------------
 * Nine call sites used to resolve storage independently, each as
 * `path.resolve(__dirname, "../../storage/<kind>")` (and one as
 * `process.cwd()`). Relative to the app directory.
 *
 * On Hostinger the app directory is hbuilds/versions/<uuid>/nodejs/, and a
 * deploy creates a NEW uuid. So every deploy started with an empty storage
 * tree: user avatars, media uploaded through the admin console, product files
 * added after the initial seed, generated invoices and receipts — gone, while
 * the database still pointed at them. A paying customer's download link would
 * 404 after the next deploy. Only two product ZIPs survived, because they
 * happened to be tracked in git.
 *
 * This is the same bug shape that took production down twice on 2026-08-25
 * (a gitignored SPA bundle, then a gitignored .env): anything not in git is
 * absent from a fresh deploy. Config was made to survive by looking for
 * hbuilds/config/.env. Files get the same treatment here.
 *
 * RESOLUTION ORDER
 * ----------------
 *   1. STORAGE_DIR env var — explicit always wins.
 *   2. <hbuilds>/storage — found by walking up from here, the persistent
 *      sibling of hbuilds/config/. Survives every deploy.
 *   3. <repo>/storage — the historical location, used everywhere that is not
 *      a Hostinger hbuilds tree (local dev, CI, a plain server).
 *
 * The base is resolved once at require time and every kind hangs off it, so
 * there is exactly one answer to "where do files go" per process.
 */

const fs = require("fs")
const path = require("path")

function findHbuildsDir(startDir) {
  let dir = startDir
  for (let hops = 0; hops < 10; hops += 1) {
    if (path.basename(dir) === "hbuilds") return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function resolveStorageBase() {
  if (process.env.STORAGE_DIR) return path.resolve(process.env.STORAGE_DIR)

  const hbuilds = findHbuildsDir(__dirname)
  if (hbuilds) return path.join(hbuilds, "storage")

  return path.resolve(__dirname, "../../storage")
}

const STORAGE_BASE = resolveStorageBase()

const STORAGE_PATHS = Object.freeze({
  base:        STORAGE_BASE,
  avatars:     path.join(STORAGE_BASE, "uploads", "avatars"),
  media:       path.join(STORAGE_BASE, "uploads", "media"),
  productFile: path.join(STORAGE_BASE, "productfile"),
  // Runtime image uploads. Served at the SAME public URL prefixes as the
  // tracked seed images under public/images/* (see app.js), so existing
  // database URLs keep resolving — but the bytes live outside the deploy dir.
  productImages:   path.join(STORAGE_BASE, "uploads", "products"),
  portfolioImages: path.join(STORAGE_BASE, "uploads", "portfolio"),
  // Private client deliverables — never static-served; streamed through
  // ownership-checked controllers only.
  projectFiles:    path.join(STORAGE_BASE, "projects"),
  invoices:    path.join(STORAGE_BASE, "invoices"),
  receipts:    path.join(STORAGE_BASE, "receipts"),
  logs:        path.join(STORAGE_BASE, "logs"),
  backups:     path.join(STORAGE_BASE, "backups"),
  cv:          path.join(STORAGE_BASE, "cv"),
})

/** Create a storage directory on demand. Idempotent; safe to call per write. */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

module.exports = { STORAGE_PATHS, ensureDir, resolveStorageBase, findHbuildsDir }
