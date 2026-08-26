/**
 * src/jobs/backupDatabaseJob + services/backupService — nightly JSON backup.
 *
 * D1. The backup script existed and worked; it just never ran unless someone
 * remembered. These tests pin what the scheduled job must guarantee:
 *
 *   - a backup actually lands on disk, parses, and counts rows
 *   - it goes to the directory it was told, not a path relative to the app
 *   - retention keeps the newest N and NEVER touches files it did not write
 *   - a dead database means NO file (a truncated backup that looks complete
 *     is worse than a missing one) — and the skip is logged as an error
 *   - one recycle is attempted before giving up
 *   - client/DB column drift (P2022) falls back to raw SQL instead of
 *     skipping the table
 */

const fs = require("fs")
const os = require("os")
const path = require("path")

// Hand-mocked Prisma: two model delegates plus the connection-health surface
// the job drives (isAlive -> $queryRaw, recycle -> $disconnect/$connect).
jest.mock("../src/lib/prisma", () => {
  const client = {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(),
    $connect: jest.fn().mockResolvedValue(),
    user: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
  }
  // isAlive/recycle are real functions in lib/prisma; mirror their contract
  // on top of the mocked client so the job exercises the real decision path.
  client.isAlive = async () => { try { await client.$queryRaw(); return true } catch { return false } }
  client.recycle = async () => { await client.$disconnect(); await client.$connect() }
  return client
})
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

// The service derives model names from schema.prisma. Point it at a tiny
// schema so the test does not depend on the real 72-model file.
jest.mock("fs", () => {
  const real = jest.requireActual("fs")
  return {
    ...real,
    readFileSync: (p, enc) =>
      String(p).endsWith("schema.prisma")
        ? "model User {\n  id String @id\n}\nmodel Order {\n  id String @id\n}\n"
        : real.readFileSync(p, enc),
  }
})

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const { runBackupPass } = require("../src/jobs/backupDatabaseJob")
const { pruneBackups } = require("../src/services/backupService")

let dir
beforeEach(() => {
  jest.clearAllMocks()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-test-"))
  process.env.DATABASE_URL = "mysql://u:p@localhost:3306/testdb"
  prisma.$queryRaw.mockResolvedValue([{ 1: 1 }])
  prisma.user.findMany.mockResolvedValue([{ id: "u1", email: "a@b.c" }, { id: "u2", email: "d@e.f" }])
  prisma.order.findMany.mockResolvedValue([{ id: "o1", totalAmount: 100n }])
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const files = () => fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()

describe("runBackupPass", () => {
  test("writes a parseable dump to the given directory and counts rows", async () => {
    const r = await runBackupPass({ outDir: dir })

    expect(r.skipped).toBe(false)
    expect(files()).toHaveLength(1)
    expect(files()[0]).toMatch(/^testdb-\d{4}-\d{2}-\d{2}T/)

    const dump = JSON.parse(fs.readFileSync(path.join(dir, files()[0]), "utf8"))
    expect(dump.database).toBe("testdb")
    expect(dump.tables.User).toHaveLength(2)
    expect(dump.tables.Order).toHaveLength(1)
    // BigInt survived serialisation as a string rather than throwing.
    expect(dump.tables.Order[0].totalAmount).toBe("100")
    expect(r.rows).toBe(3)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("3 rows / 2 tables"))
  })

  test("a dead database writes NOTHING and logs an error", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED"))

    const r = await runBackupPass({ outDir: dir })

    expect(r).toEqual({ skipped: true, reason: "db-unreachable" })
    expect(files()).toHaveLength(0)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("skipping tonight's backup"))
  })

  test("recycles the connection once and proceeds if that brings it back", async () => {
    prisma.$queryRaw
      .mockRejectedValueOnce(new Error("timer has gone away"))   // first probe: dead
      .mockResolvedValue([{ 1: 1 }])                              // after recycle: alive

    const r = await runBackupPass({ outDir: dir })

    expect(prisma.$disconnect).toHaveBeenCalledTimes(1)
    expect(prisma.$connect).toHaveBeenCalledTimes(1)
    expect(r.skipped).toBe(false)
    expect(files()).toHaveLength(1)
  })

  test("client/DB column drift (P2022) falls back to raw SQL instead of skipping the table", async () => {
    const drift = Object.assign(new Error("column missing"), { code: "P2022" })
    prisma.order.findMany.mockRejectedValue(drift)
    prisma.$queryRawUnsafe.mockResolvedValue([{ id: "o1" }, { id: "o2" }])

    const r = await runBackupPass({ outDir: dir })

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith("SELECT * FROM `Order`")
    const dump = JSON.parse(fs.readFileSync(path.join(dir, files()[0]), "utf8"))
    expect(dump.tables.Order).toHaveLength(2)
    expect(r.skipped).toBe(false)
    // The drifted table was recovered via raw SQL, so nothing was skipped.
    expect(r.skippedTables).toEqual([])
  })

  test("retention keeps the newest N dumps and leaves everything else alone", async () => {
    // Four older dumps plus two files that are NOT ours.
    const older = ["testdb-2026-08-20T00-00-00.json", "testdb-2026-08-21T00-00-00.json",
                   "testdb-2026-08-22T00-00-00.json", "testdb-2026-08-23T00-00-00.json"]
    older.forEach((f, i) => {
      const p = path.join(dir, f)
      fs.writeFileSync(p, "{}")
      const t = new Date(2026, 7, 20 + i)
      fs.utimesSync(p, t, t)
    })
    fs.writeFileSync(path.join(dir, "manual-export.json"), "{}")
    fs.writeFileSync(path.join(dir, "testdb-2026-08-19.sql.gz"), "")

    const r = await runBackupPass({ outDir: dir, keep: 3 })

    // 4 old + 1 new = 5 of ours; keep 3 => the 2 oldest go.
    expect(r.pruned.removed.sort()).toEqual(["testdb-2026-08-20T00-00-00.json", "testdb-2026-08-21T00-00-00.json"])
    expect(r.pruned.kept).toBe(3)
    const remaining = fs.readdirSync(dir).sort()
    expect(remaining).toContain("manual-export.json")
    expect(remaining).toContain("testdb-2026-08-19.sql.gz")
    expect(remaining.filter((f) => /^testdb-.*\.json$/.test(f))).toHaveLength(3)
  })
})

describe("pruneBackups", () => {
  test("is a no-op on a directory that does not exist", async () => {
    await expect(pruneBackups({ dir: path.join(dir, "nope"), keep: 5 })).resolves.toEqual({ kept: 0, removed: [] })
  })
})
