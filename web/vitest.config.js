/**
 * Vitest · the frontend unit lane (T3-4).
 *
 * The SPA had no unit tests at all: the only automated browser coverage was
 * the Playwright lane, which answers every API call with page.route() and so
 * cannot see a bug in the code that BUILDS a request. That is exactly where
 * the session lives — the CSRF header, the 401 teardown, the consent record.
 *
 * This lane exists ahead of the Spanish link codemod on purpose. That job
 * rewrites about 150 call sites in one pass; doing it with no unit test
 * under the request and context layers is how a regression reaches
 * production and is found by a customer.
 *
 * Deliberately NOT sharing web/vite.config.js: that config carries the
 * production chunking strategy, four custom plugins that rewrite HTML at
 * build time, and a PWA generator. None of it belongs in a unit run, and
 * loading it makes every test suite pay for it.
 */
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // D0-2 · pinned, deliberately. The date-only formatting bug is INVISIBLE
    // in UTC: `new Date("2026-10-01")` renders as "Oct 1" there and as
    // "Sep 30" in the home market, so a suite running in UTC would have
    // passed either way — which is how it shipped. This is the timezone the
    // clients are in.
    env: { TZ: "America/Mexico_City" },
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    // Unit lane only. e2e/ is Playwright's; node_modules and the build
    // output would otherwise be walked on every run.
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    exclude: ["node_modules/**", "dist/**", "e2e/**", "../public/**"],
    restoreMocks: true,
    clearMocks: true,
    // A jsdom suite that hangs is nearly always a pending timer or an
    // unresolved fetch; fail it rather than let CI sit for six minutes.
    testTimeout: 10_000,
  },
})
