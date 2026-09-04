/**
 * postinstall picks the Prisma engine per environment.
 *
 * This is the compromise that keeps production alive without taxing everyone
 * else: the binary engine survives the host's recurring library-engine panic
 * (separate process) but spawns an engine per client, which took this very
 * suite from ~90s to over seven minutes when it was baked into the schema.
 */
const { chooseEngineType } = require("../scripts/prisma-generate")

test("production gets the crash-immune binary engine", () => {
  expect(chooseEngineType({ NODE_ENV: "production" }).engineType).toBe("binary")
})

test("development and CI keep the fast library engine", () => {
  expect(chooseEngineType({}).engineType).toBe("library")
  expect(chooseEngineType({ NODE_ENV: "test" }).engineType).toBe("library")
  expect(chooseEngineType({ NODE_ENV: "development" }).engineType).toBe("library")
})

test("an explicit env var wins over both, so the host can force either", () => {
  expect(chooseEngineType({ PRISMA_CLIENT_ENGINE_TYPE: "library", NODE_ENV: "production" }).engineType).toBe("library")
  expect(chooseEngineType({ PRISMA_CLIENT_ENGINE_TYPE: "binary" }).engineType).toBe("binary")
  expect(chooseEngineType({ PRISMA_CLIENT_ENGINE_TYPE: "binary" }).reason).toMatch(/explicit/)
})

describe("the generate-failed marker (T1-6)", () => {
  const fs = require("fs")
  const os = require("os")
  const path = require("path")
  const { markGenerateResult } = require("../scripts/prisma-generate")

  test("a failed generate leaves a dated marker; a successful one removes it", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mu-gen-"))
    const marker = path.join(dir, "logs", "prisma-generate.failed")
    try {
      expect(markGenerateResult(false, { marker })).toBe(true)
      expect(fs.existsSync(marker)).toBe(true)
      expect(fs.readFileSync(marker, "utf8")).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(markGenerateResult(true, { marker })).toBe(true)
      expect(fs.existsSync(marker)).toBe(false)
      // removing an absent marker is fine
      expect(markGenerateResult(true, { marker })).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test("the marker path lives under the persistent logs directory", () => {
    const { GENERATE_FAILED_MARKER, STORAGE_PATHS } = require("../src/config/storagePaths")
    expect(GENERATE_FAILED_MARKER.startsWith(STORAGE_PATHS.logs)).toBe(true)
    expect(GENERATE_FAILED_MARKER.endsWith("prisma-generate.failed")).toBe(true)
  })
})
