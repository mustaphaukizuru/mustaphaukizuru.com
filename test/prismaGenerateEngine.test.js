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
