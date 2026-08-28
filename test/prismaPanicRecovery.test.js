/**
 * Prisma engine panic self-healing (prod incident 2026-08-27: every request
 * failed with "PANIC: timer has gone away" until a manual Passenger restart).
 */
jest.mock("@prisma/client", () => {
  const client = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $extends: undefined,
  }
  return { PrismaClient: jest.fn(() => client), __client: client }
})

describe("prisma engine panic recovery", () => {
  let prisma, client
  beforeAll(() => {
    process.env.NODE_ENV = "test"
    prisma = require("../src/lib/prisma")
    client = require("@prisma/client").__client
  })

  test("isEnginePanic recognises rust panics by name and by message", () => {
    expect(prisma.isEnginePanic({ name: "PrismaClientRustPanicError", message: "x" })).toBe(true)
    expect(prisma.isEnginePanic(new Error("Invalid `prisma.user.findUnique()` invocation:\n\nPANIC: timer has gone away"))).toBe(true)
    expect(prisma.isEnginePanic(new Error("Can't reach database"))).toBe(false)
    expect(prisma.isEnginePanic(null)).toBe(false)
  })

  test("recoverIfPanicked recycles the engine once for a panic, not for other errors", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    client.$disconnect.mockClear(); client.$connect.mockClear()

    expect(prisma.recoverIfPanicked(new Error("P2002 unique"))).toBe(false)
    expect(client.$disconnect).not.toHaveBeenCalled()

    const panic = new Error("PANIC: timer has gone away")
    expect(prisma.recoverIfPanicked(panic)).toBe(true)
    expect(prisma.recoverIfPanicked(panic)).toBe(true) // concurrent — debounced
    await new Promise((r) => setImmediate(r))
    // A fresh client is built and the dead one torn down — never reconnected.
    const { PrismaClient } = require("@prisma/client")
    expect(PrismaClient.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(client.$disconnect).toHaveBeenCalledTimes(1)
    expect(client.$connect.mock.calls.length).toBeGreaterThanOrEqual(1)
    // Queries through the exported proxy still work after the swap.
    await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeTruthy()
  })
})

describe("errorHandler on engine panic", () => {
  test("answers 503 DB_UNAVAILABLE and triggers a recycle", () => {
    jest.resetModules()
    const recoverIfPanicked = jest.fn(() => true)
    jest.doMock("../src/lib/prisma", () => ({
      isEnginePanic: (e) => /timer has gone away/.test(e?.message || ""),
      recoverIfPanicked,
    }))
    jest.doMock("../src/utils/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }))
    const errorHandler = require("../src/middleware/errorHandler")
    const err = new Error("PANIC: timer has gone away")
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), setHeader: jest.fn(), send: jest.fn() }
    const req = { headers: { accept: "application/json" }, originalUrl: "/api/v1/auth/login", method: "POST" }
    errorHandler(err, req, res, jest.fn())
    expect(recoverIfPanicked).toHaveBeenCalledWith(err)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json.mock.calls[0][0].code).toBe("DB_UNAVAILABLE")
  })
})

describe("exitIfUnrecoverable", () => {
  test("exits only in production, only for a panic signature, only after 60s uptime", async () => {
    jest.resetModules()
    jest.useFakeTimers()
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {})
    const uptime = jest.spyOn(process, "uptime").mockReturnValue(120)
    jest.spyOn(console, "error").mockImplementation(() => {})
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "test"
    jest.dontMock("../src/lib/prisma")
    const lib = require("../src/lib/prisma")
    const { exitIfUnrecoverable } = lib
    // The guard only fires for an engine that worked at least once here.
    await lib.isAlive()
    exitIfUnrecoverable("PANIC: timer has gone away"); jest.runAllTimers()
    expect(exit).not.toHaveBeenCalled()                       // not production

    process.env.NODE_ENV = "production"
    exitIfUnrecoverable("Can't reach database server"); jest.runAllTimers()
    expect(exit).not.toHaveBeenCalled()                       // connectivity, not a panic

    uptime.mockReturnValue(10)
    exitIfUnrecoverable("PANIC: timer has gone away"); jest.runAllTimers()
    expect(exit).not.toHaveBeenCalled()                       // just booted

    uptime.mockReturnValue(120)
    exitIfUnrecoverable("PANIC: timer has gone away"); jest.runAllTimers()
    expect(exit).toHaveBeenCalledWith(1)                      // the real case
    process.env.NODE_ENV = prev
    jest.useRealTimers()
    exit.mockRestore(); uptime.mockRestore()
  })
})

test("module helpers survive a recycle (they live on the proxy target, not the client)", async () => {
  jest.resetModules()
  jest.dontMock("../src/lib/prisma")
  process.env.NODE_ENV = "test"
  const prisma = require("../src/lib/prisma")
  expect(typeof prisma.isAlive).toBe("function")
  await prisma.recycle()
  expect(typeof prisma.isAlive).toBe("function")
  expect(typeof prisma.recoverIfPanicked).toBe("function")
  expect(typeof prisma.exitIfUnrecoverable).toBe("function")
})

test("a cold engine panic waits 5 minutes before restarting (no storm), then exits", async () => {
  jest.resetModules()
  jest.dontMock("../src/lib/prisma")
  const exit = jest.spyOn(process, "exit").mockImplementation(() => {})
  const uptime = jest.spyOn(process, "uptime").mockReturnValue(120)
  jest.spyOn(console, "error").mockImplementation(() => {})
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  process.env.DISABLE_DB_KEEPALIVE = "1"
  jest.useFakeTimers()
  const prisma = require("../src/lib/prisma")
  // everHealthy is false until a query succeeds.
  expect(prisma.engineInfo().everHealthy).toBe(false)
  // 120s in: past the warm threshold (60s) but not the cold one (300s).
  prisma.exitIfUnrecoverable("PANIC: timer has gone away")
  jest.advanceTimersByTime(5000)
  expect(exit).not.toHaveBeenCalled()
  // Past 5 minutes a fresh process is worth trying even for a cold engine.
  uptime.mockReturnValue(301)
  prisma.exitIfUnrecoverable("PANIC: timer has gone away")
  jest.advanceTimersByTime(5000)
  expect(exit).toHaveBeenCalledWith(1)
  process.env.NODE_ENV = prev
  jest.useRealTimers()
  exit.mockRestore(); uptime.mockRestore()
})

describe("keepalive during a connectivity outage", () => {
  test("does NOT build a new client when the DB is merely unreachable", async () => {
    jest.resetModules()
    jest.useFakeTimers()
    jest.spyOn(console, "warn").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
    const prev = process.env.NODE_ENV
    const prevDisable = process.env.DISABLE_DB_KEEPALIVE
    process.env.NODE_ENV = "production"     // keepalive only runs outside tests
    delete process.env.DISABLE_DB_KEEPALIVE

    jest.doMock("@prisma/client", () => {
      const client = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        // P1001 = can't reach database server (NOT an engine panic)
        $queryRaw: jest.fn().mockRejectedValue(Object.assign(new Error("Can't reach database server at `db:3306`"), { code: "P1001" })),
        $extends: undefined,
      }
      return { PrismaClient: jest.fn(() => client), __client: client }
    })

    require("../src/lib/prisma")
    const { PrismaClient } = require("@prisma/client")
    const clientsAtBoot = PrismaClient.mock.calls.length

    // Run several ping cycles' worth of time.
    for (let i = 0; i < 8; i++) {
      await jest.advanceTimersByTimeAsync(60_000)
    }
    // No recycle => no additional PrismaClient instances.
    expect(PrismaClient.mock.calls.length).toBe(clientsAtBoot)

    process.env.NODE_ENV = prev
    if (prevDisable !== undefined) process.env.DISABLE_DB_KEEPALIVE = prevDisable
    jest.useRealTimers()
    jest.dontMock("@prisma/client")
  })
})

describe("database probe timeout (a wedged engine must not hang the app)", () => {
  test("probeWithTimeout resolves TIMED_OUT instead of waiting on a query that never settles", async () => {
    jest.resetModules()
    jest.dontMock("../src/lib/prisma")
    process.env.DISABLE_DB_KEEPALIVE = "1"
    const { probeWithTimeout, TIMED_OUT } = require("../src/lib/prisma")

    // The production failure mode: the query never settles at all.
    const started = Date.now()
    await expect(probeWithTimeout(new Promise(() => {}), 40)).resolves.toBe(TIMED_OUT)
    expect(Date.now() - started).toBeLessThan(2000)

    // A healthy query still reports ok, and a failing one still rejects.
    await expect(probeWithTimeout(Promise.resolve([{ 1: 1 }]), 1000)).resolves.toBe("ok")
    await expect(probeWithTimeout(Promise.reject(new Error("P1001")), 1000)).rejects.toThrow("P1001")
  })

  test("a stuck engine can trigger the restart, still under the uptime guards", () => {
    jest.resetModules()
    jest.dontMock("../src/lib/prisma")
    process.env.DISABLE_DB_KEEPALIVE = "1"
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {})
    const uptime = jest.spyOn(process, "uptime").mockReturnValue(10)
    jest.spyOn(console, "error").mockImplementation(() => {})
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    jest.useFakeTimers()
    const prisma = require("../src/lib/prisma")

    // Too early: a just-booted process is never traded in.
    prisma.exitIfUnrecoverable("probe did not answer", { stuck: true })
    jest.advanceTimersByTime(5000)
    expect(exit).not.toHaveBeenCalled()

    // Past the cold threshold a fresh process is warranted.
    uptime.mockReturnValue(400)
    prisma.exitIfUnrecoverable("probe did not answer", { stuck: true })
    jest.advanceTimersByTime(5000)
    expect(exit).toHaveBeenCalledWith(1)

    process.env.NODE_ENV = prev
    jest.useRealTimers()
    exit.mockRestore(); uptime.mockRestore()
  })
})

test("summariseDbError reports the cause, not Prisma's boilerplate preamble", () => {
  jest.resetModules()
  jest.dontMock("../src/lib/prisma")
  process.env.DISABLE_DB_KEEPALIVE = "1"
  const { summariseDbError } = require("../src/lib/prisma")

  // The first line of every Prisma error is the useless invocation preamble.
  expect(summariseDbError("Invalid `prisma.$queryRaw()` invocation:\n\n\nPANIC: timer has gone away\n\nmore"))
    .toBe("PANIC: timer has gone away")
  expect(summariseDbError("Invalid `prisma.user.findMany()` invocation:\n\nCan't reach database server at `db:3306`"))
    .toBe("Can't reach database server at `db:3306`")
  expect(summariseDbError("Timed out fetching a new connection from the connection pool"))
    .toBe("Timed out fetching a new connection from the connection pool")
  expect(summariseDbError("")).toBeNull()
  expect(summariseDbError(null)).toBeNull()
})
