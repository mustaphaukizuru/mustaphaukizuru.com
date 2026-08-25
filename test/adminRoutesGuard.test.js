// ─────────────────────────────────────────────────────────────────────────────
// Every /admin router must enforce `protect` itself.
//
// routes/index.js mounts admin routers bare (no middleware at the mount), so
// a router that forgets to call `router.use(protect, adminOnly)` is publicly
// reachable. This test walks every adminXRoutes.js file and asserts the
// `protect` middleware is present on the router's stack before any handler.
// Also asserts `protect` rejects purpose-scoped (2FA-pending) tokens.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({ user: { findUnique: jest.fn() } }))

const fs   = require("fs")
const path = require("path")
const jwt  = require("jsonwebtoken")
const { protect } = require("../src/middleware/authMiddleware")

const ROUTES_DIR = path.join(__dirname, "..", "src", "routes")
const adminRouteFiles = fs.readdirSync(ROUTES_DIR).filter((f) => /^admin.*Routes\.js$/.test(f))

const isProtect = (layer) => layer.handle === protect || layer.name === protect.name

/**
 * A route is guarded if a router-level `protect` precedes it on the stack,
 * or `protect` appears in the route's own handler chain.
 */
function unguardedRoutes(router) {
  const bad = []
  let routerGuarded = false
  for (const layer of router.stack) {
    if (!layer.route) {
      if (isProtect(layer)) routerGuarded = true
      continue
    }
    const routeGuarded = layer.route.stack.some(isProtect)
    if (!routerGuarded && !routeGuarded) {
      bad.push(`${Object.keys(layer.route.methods).join(",").toUpperCase()} ${layer.route.path}`)
    }
  }
  return bad
}

describe("admin routers are self-guarded", () => {
  test("found admin route files", () => {
    expect(adminRouteFiles.length).toBeGreaterThan(10)
  })

  test.each(adminRouteFiles)("%s guards every route with protect", (file) => {
    const router = require(path.join(ROUTES_DIR, file))
    expect(unguardedRoutes(router)).toEqual([])
  })
})

describe("protect rejects purpose-scoped tokens", () => {
  const SECRET = "x".repeat(64)
  beforeAll(() => { process.env.JWT_SECRET = SECRET })

  function run(token) {
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    const next = jest.fn()
    return protect(req, res, next).then(() => ({ res, next }))
  }

  test("2fa-pending token is not a session", async () => {
    const token = jwt.sign({ userId: "u1", purpose: "2fa-pending" }, SECRET, { expiresIn: 300 })
    const { res, next } = await run(token)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  test("plain session token reaches the user lookup", async () => {
    const prisma = require("../src/lib/prisma")
    prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "user", status: "active" })
    const token = jwt.sign({ userId: "u1", email: "a@b.c", role: "user" }, SECRET, { expiresIn: 300 })
    const { next } = await run(token)
    expect(next).toHaveBeenCalled()
  })
})
