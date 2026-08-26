// @ts-check
import { defineConfig, devices } from "@playwright/test"

/**
 * Q2 · End-to-end tests for the checkout funnel.
 *
 * Drives a real Chromium through store → cart → checkout → success against
 * the PRODUCTION build (`vite preview` serving ../public). There is no dev
 * database — `.env` points at production — so every API call is answered
 * at the network layer with page.route(). What the suite proves is the
 * SPA side of the money path: the right requests, with the right payloads,
 * in the right order, and the right screens in between. The backend side
 * is covered by Jest at the HTTP layer.
 *
 * Locally: `npm run build` once, then `npm run test:e2e` (boots preview on
 * :4173). In CI the frontend job's artifact is downloaded into public/.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
