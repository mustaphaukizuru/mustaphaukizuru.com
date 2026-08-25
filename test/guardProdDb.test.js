/**
 * scripts/guard-prod-db.js — refuses destructive Prisma work on a remote DB.
 *
 * Runs in child processes: the guard calls process.exit and reads the ambient
 * environment, neither of which belongs in a jest worker.
 *
 * The guard is allow-list based on purpose — an unrecognised host counts as
 * production, because guessing wrong destroys live data. These tests pin that
 * direction so a future "helpful" tweak cannot quietly invert it.
 */

const path = require("path")
const { spawnSync } = require("child_process")

const GUARD = path.join(__dirname, "..", "scripts", "guard-prod-db.js")

function runGuard({ url, allow }) {
  const env = { ...process.env }
  delete env.ALLOW_PROD_DB
  // dotenv does not override existing vars, so setting this wins over .env.
  if (url === undefined) delete env.DATABASE_URL
  else env.DATABASE_URL = url
  if (allow) env.ALLOW_PROD_DB = allow

  return spawnSync(process.execPath, [GUARD, "prisma db push"], { encoding: "utf8", env })
}

describe("guard-prod-db", () => {
  test.each([
    ["mysql://u:p@localhost:3306/dev", "localhost"],
    ["mysql://u:p@127.0.0.1:3306/dev", "127.0.0.1"],
    ["mysql://u:p@db.local:3306/dev", "a .local host"],
  ])("allows %s (%s)", (url) => {
    expect(runGuard({ url }).status).toBe(0)
  })

  test("blocks a remote host and names it", () => {
    const res = runGuard({ url: "mysql://u:p@srv1300.hstgr.io:3306/live" })
    expect(res.status).toBe(1)
    expect(res.stderr).toContain("srv1300.hstgr.io")
    expect(res.stderr).toMatch(/Refusing to run/)
  })

  test("blocks an unknown host — unrecognised must mean production, not safe", () => {
    expect(runGuard({ url: "mysql://u:p@some-new-host.example.com:3306/live" }).status).toBe(1)
  })

  test("blocks when DATABASE_URL is unset rather than assuming local", () => {
    expect(runGuard({ url: undefined }).status).toBe(1)
  })

  test("ALLOW_PROD_DB=1 permits the intended case, and warns", () => {
    const res = runGuard({ url: "mysql://u:p@srv1300.hstgr.io:3306/live", allow: "1" })
    expect(res.status).toBe(0)
    expect(res.stderr).toMatch(/ALLOW_PROD_DB=1/)
    expect(res.stderr).toMatch(/backup/i)
  })

  test("only the exact value 1 overrides — not any truthy string", () => {
    expect(runGuard({ url: "mysql://u:p@srv1300.hstgr.io:3306/live", allow: "true" }).status).toBe(1)
    expect(runGuard({ url: "mysql://u:p@srv1300.hstgr.io:3306/live", allow: "yes" }).status).toBe(1)
  })

  test("survives a password containing URL-hostile characters", () => {
    // new URL() throws on some raw passwords; the guard falls back to a regex.
    // It must still identify the host rather than failing open.
    const res = runGuard({ url: "mysql://user:p@ss w[rd@srv1300.hstgr.io:3306/live" })
    expect(res.status).toBe(1)
  })
})
