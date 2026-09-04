/**
 * T1-5 · the connection_limit=1 workaround announces itself.
 *
 * A source comment cannot be read from production. Every boot that
 * serialises onto one connection logs a line naming the date the
 * workaround was installed and the variable that lifts it; a raised limit
 * logs nothing.
 */
jest.mock("@prisma/client", () => ({ PrismaClient: class { $on() {} $connect() {} $disconnect() {} } }))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const { warnIfSerialised, poolBoundsUrl, POOL_WORKAROUND_INSTALLED } = require("../src/lib/prisma")

let warnSpy
beforeEach(() => { warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {}) })
afterEach(() => { warnSpy.mockRestore(); delete process.env.DB_CONNECTION_LIMIT })

test("a pool of 1 warns, naming the install date and the env var", () => {
  const line = warnIfSerialised("mysql://u:p@h:3306/db?connection_limit=1&pool_timeout=10")
  expect(line).toMatch(/connection_limit=1/)
  expect(line).toMatch(POOL_WORKAROUND_INSTALLED)
  expect(line).toMatch(/DB_CONNECTION_LIMIT/)
  expect(line).toMatch(/health\/deep/)
  expect(warnSpy).toHaveBeenCalledWith(line)
})

test("a raised pool says nothing", () => {
  expect(warnIfSerialised("mysql://u:p@h:3306/db?connection_limit=3&pool_timeout=10")).toBeNull()
  expect(warnIfSerialised("mysql://u:p@h:3306/db")).toBeNull()
  expect(warnSpy).not.toHaveBeenCalled()
})

test("a URL new URL() cannot parse never throws out of the warning", () => {
  expect(warnIfSerialised("not a url at all")).toBeNull()
})

test("poolBoundsUrl reports the effective limit the health check reads", () => {
  process.env.DATABASE_URL = "mysql://u:p@127.0.0.1:3306/db"
  process.env.DB_CONNECTION_LIMIT = "3"
  expect(poolBoundsUrl()).toMatch(/connection_limit=3/)
})
