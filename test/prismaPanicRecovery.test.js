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
  test("exits only in production, only for a panic signature, only after 60s uptime", () => {
    jest.resetModules()
    jest.useFakeTimers()
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {})
    const uptime = jest.spyOn(process, "uptime").mockReturnValue(120)
    jest.spyOn(console, "error").mockImplementation(() => {})
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = "test"
    jest.dontMock("../src/lib/prisma")
    const { exitIfUnrecoverable } = require("../src/lib/prisma")
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
