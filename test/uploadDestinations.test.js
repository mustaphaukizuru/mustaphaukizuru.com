/**
 * Regression guard: no upload middleware may write into public/.
 *
 * public/ is the versioned deploy directory on Hostinger (a fresh
 * hbuilds/versions/<uuid>/ per deploy) AND Vite's emptyOutDir target. Three
 * middlewares (project files, product images, portfolio images) used to
 * write there, so every deploy silently deleted client deliverables and
 * admin-uploaded images while the database kept pointing at them.
 *
 * This is a source-level check on purpose: requiring the middlewares would
 * mkdir real directories, and a runtime probe can't see a path that is only
 * built inside a multer `destination` callback.
 */
const fs = require("fs")
const path = require("path")

const MIDDLEWARE_DIR = path.join(__dirname, "..", "src", "middleware")

const uploadMiddlewares = fs
  .readdirSync(MIDDLEWARE_DIR)
  .filter((f) => /^upload.*\.js$/i.test(f))

describe("upload middlewares never write into public/", () => {
  test("there are upload middlewares to check", () => {
    expect(uploadMiddlewares.length).toBeGreaterThanOrEqual(5)
  })

  test.each(uploadMiddlewares)("%s resolves its destination through STORAGE_PATHS", (file) => {
    const src = fs.readFileSync(path.join(MIDDLEWARE_DIR, file), "utf8")
    // Strip comments so a historical note about public/ doesn't fail the gate.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

    expect(code).toMatch(/require\(["']\.\.\/config\/storagePaths["']\)/)
    expect(code).not.toMatch(/["'`][^"'`]*\/public\//)
    expect(code).not.toMatch(/["'`]\.\.\/\.\.\/public/)
  })
})

describe("STORAGE_PATHS covers every upload kind", () => {
  const { STORAGE_PATHS } = require("../src/config/storagePaths")
  test.each(["avatars", "media", "productFile", "productImages", "portfolioImages", "projectFiles"])(
    "%s is defined under base",
    (kind) => {
      expect(STORAGE_PATHS[kind]).toBeTruthy()
      expect(STORAGE_PATHS[kind].startsWith(STORAGE_PATHS.base)).toBe(true)
    }
  )
})
