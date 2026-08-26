/**
 * Request correlation — middleware/requestId + lib/requestContext +
 * the requestId echo in the global error handler.
 *
 * A3. During the 2026-08-25 outage the diagnosis needed SSH and a status
 * script because there was no trail to read. These tests pin the properties
 * that make the next incident a log query instead of an expedition:
 *
 *   - every response carries an X-Request-Id
 *   - a caller-supplied id is honoured, so an upstream trace can be joined
 *   - a hostile caller-supplied id is REPLACED, never echoed or logged
 *   - the id is visible deep inside the request, across awaits, with no
 *     argument threading (AsyncLocalStorage)
 *   - two concurrent requests never see each other's id
 *   - error bodies carry the id, so a screenshot is enough to find the trace
 *   - outside a request the context is simply absent
 */

const express = require("express")
const request = require("supertest")

jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const { requestId, SAFE_ID } = require("../src/middleware/requestId")
const { getRequestId, getContext } = require("../src/lib/requestContext")
// errorHandler.js exports the function directly; accept a named export too
// so this test does not break if that module is ever reshaped.
const errorHandlerModule = require("../src/middleware/errorHandler")
const errorHandler = typeof errorHandlerModule === "function" ? errorHandlerModule : errorHandlerModule.errorHandler

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function buildApp() {
  const app = express()
  app.use(requestId)

  // Reads the id three layers down, after real async hops — the situation a
  // service or Prisma call is in. No req is passed; that is the point.
  app.get("/deep", async (req, res) => {
    const seen = []
    seen.push(getRequestId())
    await new Promise((r) => setTimeout(r, 5))
    seen.push(getRequestId())
    await Promise.resolve().then(() => seen.push(getRequestId()))
    res.json({ header: req.id, seen })
  })

  // Holds the request open so two can overlap.
  app.get("/slow", async (req, res) => {
    await new Promise((r) => setTimeout(r, 30))
    res.json({ id: getRequestId() })
  })

  app.get("/api/boom", () => { throw new Error("kaboom") })
  app.use(errorHandler)
  return app
}

describe("request id", () => {
  let app
  beforeEach(() => { app = buildApp(); jest.clearAllMocks() })

  test("every response carries a UUID X-Request-Id that matches req.id", async () => {
    const res = await request(app).get("/deep")
    expect(res.status).toBe(200)
    expect(res.headers["x-request-id"]).toMatch(UUID)
    expect(res.body.header).toBe(res.headers["x-request-id"])
  })

  test("the id survives awaits and microtasks with no argument threading", async () => {
    const res = await request(app).get("/deep")
    const id = res.headers["x-request-id"]
    expect(res.body.seen).toEqual([id, id, id])
  })

  test("a safe caller-supplied X-Request-Id is honoured end to end", async () => {
    const res = await request(app).get("/deep").set("X-Request-Id", "trace-abc.123:xyz-1")
    expect(res.headers["x-request-id"]).toBe("trace-abc.123:xyz-1")
    expect(res.body.seen).toEqual(["trace-abc.123:xyz-1", "trace-abc.123:xyz-1", "trace-abc.123:xyz-1"])
  })

  test.each([
    ["too short", "abc"],
    ["too long", "x".repeat(129)],
    ["html", "<script>alert(1)</script>"],
    ["shell/sql punctuation", "id; DROP TABLE users --"],
  ])("a hostile X-Request-Id (%s) is replaced, never echoed", async (_label, bad) => {
    const res = await request(app).get("/deep").set("X-Request-Id", bad)
    expect(res.headers["x-request-id"]).toMatch(UUID)
    expect(res.headers["x-request-id"]).not.toBe(bad)
    expect(SAFE_ID.test(bad)).toBe(false)
  })

  test("a log-injection payload (newline) can never pass the allow-list", () => {
    // Node's http layer rejects a header containing \n before it reaches any
    // middleware, so this cannot be exercised over the wire — superagent
    // throws at setHeader. The regex is the guarantee for any other path the
    // value could arrive by, so it is asserted directly.
    expect(SAFE_ID.test("id\nlevel=error msg=pwned")).toBe(false)
    expect(SAFE_ID.test("id\r\nX-Injected: 1")).toBe(false)
  })

  test("concurrent requests never see each other's id", async () => {
    const [a, b, c] = await Promise.all([
      request(app).get("/slow"),
      request(app).get("/slow"),
      request(app).get("/slow"),
    ])
    const ids = [a, b, c].map((r) => r.headers["x-request-id"])
    expect(new Set(ids).size).toBe(3)
    expect(a.body.id).toBe(ids[0])
    expect(b.body.id).toBe(ids[1])
    expect(c.body.id).toBe(ids[2])
  })

  test("error bodies carry the request id in both the legacy and nested shapes", async () => {
    const res = await request(app).get("/api/boom")
    expect(res.status).toBeGreaterThanOrEqual(500)
    const id = res.headers["x-request-id"]
    expect(id).toMatch(UUID)
    expect(res.body.requestId).toBe(id)
    expect(res.body.error.requestId).toBe(id)
  })

  test("outside a request there is no context and no id", () => {
    expect(getContext()).toBeUndefined()
    expect(getRequestId()).toBeUndefined()
  })
})
