/**
 * Integration · T0-4 · the avatar upload chain and the /images/* mounts.
 *
 * Before: `imageFilter` only regex-matched the declared MIME, the stored
 * filename took its extension from the upload's own name, and the five
 * /images/* static mounts sat above helmet. A member could upload
 * "x.html" declared as image/png, have it stored as avatar-<id>.html, and
 * have it served on the origin as a document with no CSP.
 *
 * Now: extension + MIME allowlist, canonical extension from the allowlist,
 * magic-byte check after the write, a per-user upload throttle, and every
 * /images/* response carries helmet's headers.
 */
const fs   = require("fs")
const os   = require("os")
const path = require("path")
const request = require("supertest")

// storagePaths resolves its base at require time; buildApp resets modules,
// so setting this first sends every upload in this file to a temp dir.
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mu-avatar-test-"))
process.env.STORAGE_DIR = STORAGE_DIR

const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })
afterAll(() => { delete process.env.STORAGE_DIR; fs.rmSync(STORAGE_DIR, { recursive: true, force: true }) })

const PNG  = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.from("IHDR-and-nothing-real")])
const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.from("JFIF-stub")])
const HTML = Buffer.from("<html><script>alert(document.cookie)</script></html>")

const avatarDir = () => path.join(STORAGE_DIR, "uploads", "avatars")
// The limiter skips localhost outside production; `trust proxy` is 1, so a
// forwarded address makes the request look like a real visitor.
const upload = (user, buffer, filename, contentType) => request(ctx.app)
  .post("/api/v1/member/profile/avatar")
  .set("Authorization", `Bearer ${ctx.signToken(user.id)}`)
  .set("X-Forwarded-For", "203.0.113.5")
  .attach("avatar", buffer, { filename, contentType })

describe("avatar upload allowlist", () => {
  let member
  beforeAll(() => { member = ctx.seedUser({ email: "avatar@example.com", passwordHash: "x" }) })

  test("image/png named x.html is refused with 400 and nothing is written", async () => {
    const res = await upload(member, PNG, "x.html", "image/png")
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE")
    expect(fs.existsSync(avatarDir()) ? fs.readdirSync(avatarDir()) : []).toEqual([])
  })

  test("a .png whose bytes are HTML is refused after the write and the file is removed", async () => {
    const res = await upload(member, HTML, "x.png", "image/png")
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE")
    expect(fs.readdirSync(avatarDir())).toEqual([])
    expect(ctx.prisma.rows("user").find((u) => u.id === member.id).avatarUrl).toBeNull()
  })

  test("declared image/svg+xml is refused (not in the allowlist)", async () => {
    const res = await upload(member, Buffer.from("<svg onload=alert(1)/>"), "x.svg", "image/svg+xml")
    expect(res.status).toBe(400)
  })

  test("a real PNG is stored as avatar-<userId>.png and the URL is saved on the user", async () => {
    const res = await upload(member, PNG, "Photo Of Me.PNG", "image/png")
    expect(res.status).toBe(200)
    expect(res.body.data.avatarUrl).toMatch(new RegExp(`^/images/avatars/avatar-${member.id}\\.png\\?v=\\d+$`))
    expect(fs.readdirSync(avatarDir())).toEqual([`avatar-${member.id}.png`])
    expect(ctx.prisma.rows("user").find((u) => u.id === member.id).avatarUrl).toBe(res.body.data.avatarUrl)
  })

  test(".jpeg is stored with the canonical .jpg extension", async () => {
    const res = await upload(member, JPEG, "me.jpeg", "image/jpeg")
    expect(res.status).toBe(200)
    expect(res.body.data.avatarUrl).toContain(`/images/avatars/avatar-${member.id}.jpg?v=`)
    expect(fs.existsSync(path.join(avatarDir(), `avatar-${member.id}.jpg`))).toBe(true)
  })
})

describe("/images/* is served behind helmet", () => {
  test("a stored avatar comes back with CSP, HSTS and nosniff headers", async () => {
    const member = ctx.seedUser({ email: "avatar-headers@example.com", passwordHash: "x" })
    expect((await upload(member, PNG, "a.png", "image/png")).status).toBe(200)

    const res = await request(ctx.app).get(`/images/avatars/avatar-${member.id}.png`)
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toMatch(/^image\/png/)
    expect(res.headers["content-security-policy"]).toMatch(/default-src 'self'/)
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=63072000/)
    expect(res.headers["x-content-type-options"]).toBe("nosniff")
    expect(res.headers["content-disposition"]).toBe("inline")
  })

  test("a missing product image still answers with the security headers", async () => {
    const res = await request(ctx.app).get("/images/products/does-not-exist.png")
    expect(res.headers["content-security-policy"]).toMatch(/default-src 'self'/)
  })
})

describe("avatar upload throttle", () => {
  // Limits are unbounded under NODE_ENV=test (rateLimiter.devScale), so the
  // 429 cannot be produced over HTTP here. Pin the chain instead: the
  // per-user limiter (20 / hour, shared with admin media) runs before multer
  // touches the disk, and the signature check runs after it.
  test("POST /avatar chains protect → uploadRateLimiter → multer → verifyAvatarSignature", () => {
    const router = require("../../src/routes/profileRoutes")
    const { protect } = require("../../src/middleware/authMiddleware")
    const { uploadRateLimiter } = require("../../src/middleware/rateLimiter")
    const { verifyAvatarSignature } = require("../../src/middleware/uploadAvatar")

    const layer = router.stack.find((l) => l.route?.path === "/avatar" && l.route.methods.post)
    expect(layer).toBeDefined()
    const handles = layer.route.stack.map((s) => s.handle)
    const at = (fn) => handles.indexOf(fn)
    expect(at(protect)).toBeGreaterThanOrEqual(0)
    expect(at(uploadRateLimiter)).toBeGreaterThan(at(protect))
    expect(at(verifyAvatarSignature)).toBeGreaterThan(at(uploadRateLimiter) + 1) // multer sits between
  })
})
