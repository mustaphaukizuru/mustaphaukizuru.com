// ─────────────────────────────────────────────────────────────────────────────
// T5-13 · request presets, and a credential that travels as a credential.
//
// The failure this replaces was mundane and total: credentials arrived as
// files. A hosting password in a .txt, the registrar login in a screenshot.
// Every one landed in storage/projects/, stayed for the retention window,
// and would have gone into any handover ZIP built afterwards.
//
// So the tests are about two guarantees and nothing else.
//
//   ONCE      the reveal wipes the ciphertext in the same conditional write,
//             two simultaneous reveals cannot both win, and nothing else in
//             the service can return a value.
//   ONE WAY   the direction is the access model: whoever wrote it cannot
//             read it back, or the wipe only wipes the recipient's copy.
//
// Plus the refusal that stops the old habit: a request titled "hosting
// password" is turned away and told where to go instead.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  clientProject: { findUnique: jest.fn() },
  secretHandoff: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  projectFileRequest: { create: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/projectEventService", () => ({
  record: jest.fn().mockResolvedValue({ id: "e1" }),
}))

const fs = require("fs")
const path = require("path")

const prisma = require("../src/lib/prisma")
const projectEvents = require("../src/services/projectEventService")
const secrets = require("../src/services/secretHandoffService")
const fileRequests = require("../src/services/projectFileRequestService")
const { FILE_REQUEST_PRESETS, looksLikeCredentialRequest, presetById } = require("../src/data/fileRequestPresets")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

// Jest workers share a process — put it back (invariant 6).
const KEY_BEFORE = process.env.SECRET_HANDOFF_KEY
const KEY = "a".repeat(64)
beforeAll(() => { process.env.SECRET_HANDOFF_KEY = KEY })
afterAll(() => {
  if (KEY_BEFORE === undefined) delete process.env.SECRET_HANDOFF_KEY
  else process.env.SECRET_HANDOFF_KEY = KEY_BEFORE
})

const FUTURE = new Date(Date.now() + 86_400_000)
const PAST = new Date(Date.now() - 1000)

const stored = (over = {}) => {
  const enc = secrets._encrypt("hunter2-the-real-one")
  return {
    id: "s1", projectId: "p1", direction: "to_client", label: "cPanel password",
    ...enc, expiresAt: FUTURE, viewedAt: null, createdAt: new Date(), createdById: "admin1",
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.clientProject.findUnique.mockResolvedValue({ id: "p1", userId: "u1", projectName: "Colegio Vista" })
  prisma.secretHandoff.create.mockImplementation(async ({ data }) => ({ id: "s1", createdAt: new Date(), ...data }))
  prisma.secretHandoff.updateMany.mockResolvedValue({ count: 1 })
})

/* ── the bytes ───────────────────────────────────────────────────────── */

describe("what actually goes into the row", () => {
  test("the ciphertext is ciphertext — the value appears nowhere in the record", async () => {
    await secrets.createSecret("p1", { direction: "to_client", label: "cPanel password", value: "hunter2" })
    const data = prisma.secretHandoff.create.mock.calls[0][0].data
    const serialised = JSON.stringify(data)

    expect(serialised).not.toContain("hunter2")
    expect(data.ciphertext).toBeTruthy()
    expect(data.iv).toHaveLength(24)   // 12 bytes, hex
    expect(data.tag).toHaveLength(32)  // 16 bytes, hex
  })

  test("the label is deliberately NOT encrypted", async () => {
    // Both parties need to see "cPanel password" in a list to know what is
    // waiting for them. That is the one thing in the clear.
    await secrets.createSecret("p1", { direction: "to_client", label: "cPanel password", value: "x" })
    expect(prisma.secretHandoff.create.mock.calls[0][0].data.label).toBe("cPanel password")
  })

  test("a round trip returns exactly what went in, including awkward bytes", () => {
    for (const value of ["hunter2", "ñ é 中文 🙂", "a".repeat(4000), "line\nbreak\ttab", '{"json":"too"}']) {
      expect(secrets._decrypt(secrets._encrypt(value))).toBe(value)
    }
  })

  test("altered ciphertext fails loudly instead of decrypting to garbage", () => {
    // The entire reason for GCM over CBC.
    const enc = secrets._encrypt("hunter2")
    const bytes = Buffer.from(enc.ciphertext, "base64")
    bytes[0] ^= 0xff
    expect(() => secrets._decrypt({ ...enc, ciphertext: bytes.toString("base64") })).toThrow()
  })

  test("a different key cannot read it — which is what rotation means", () => {
    const enc = secrets._encrypt("hunter2")
    process.env.SECRET_HANDOFF_KEY = "b".repeat(64)
    try {
      expect(() => secrets._decrypt(enc)).toThrow()
    } finally {
      process.env.SECRET_HANDOFF_KEY = KEY
    }
  })

  test("two encryptions of the same value differ, because the IV is random", () => {
    const a = secrets._encrypt("hunter2")
    const b = secrets._encrypt("hunter2")
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
})

describe("with no key configured there is no degraded mode", () => {
  test("creating is refused rather than storing plaintext", async () => {
    delete process.env.SECRET_HANDOFF_KEY
    try {
      await expect(secrets.createSecret("p1", { direction: "to_client", label: "l", value: "v" }))
        .rejects.toMatchObject({ code: "SECRET_HANDOFF_UNCONFIGURED", statusCode: 503 })
      expect(prisma.secretHandoff.create).not.toHaveBeenCalled()
      expect(secrets.isConfigured()).toBe(false)
    } finally {
      process.env.SECRET_HANDOFF_KEY = KEY
    }
  })

  test("a key of the wrong length counts as no key, not as a weaker key", async () => {
    process.env.SECRET_HANDOFF_KEY = "too-short"
    try {
      expect(secrets.isConfigured()).toBe(false)
    } finally {
      process.env.SECRET_HANDOFF_KEY = KEY
    }
  })

  test("a 32-character passphrase is accepted, because that is a reasonable mistake", () => {
    process.env.SECRET_HANDOFF_KEY = "x".repeat(32)
    try {
      expect(secrets.isConfigured()).toBe(true)
      expect(secrets._decrypt(secrets._encrypt("hunter2"))).toBe("hunter2")
    } finally {
      process.env.SECRET_HANDOFF_KEY = KEY
    }
  })
})

/* ── once ────────────────────────────────────────────────────────────── */

describe("read once, and then it is gone", () => {
  test("the first reveal returns the value", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    const out = await secrets.revealSecret("s1", "p1", "client")
    expect(out).toEqual({ label: "cPanel password", value: "hunter2-the-real-one" })
  })

  test("the wipe is part of the SAME write that claims it", async () => {
    // Not a second update afterwards: a claim that succeeds and a wipe that
    // fails would leave a readable secret marked as read.
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    await secrets.revealSecret("s1", "p1", "client")
    const call = prisma.secretHandoff.updateMany.mock.calls[0][0]

    expect(call.where).toEqual({ id: "s1", viewedAt: null })
    expect(call.data.ciphertext).toBeNull()
    expect(call.data.iv).toBeNull()
    expect(call.data.tag).toBeNull()
    expect(call.data.viewedAt).toBeInstanceOf(Date)
  })

  test("the claim happens BEFORE the decrypt", async () => {
    const order = []
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    prisma.secretHandoff.updateMany.mockImplementation(async () => { order.push("claim"); return { count: 1 } })
    projectEvents.record.mockImplementation(async () => { order.push("event"); return {} })

    await secrets.revealSecret("s1", "p1", "client")
    expect(order[0]).toBe("claim")
  })

  test("losing the race gets the honest answer, not the value", async () => {
    // Two tabs, two clicks. Only one may return a credential.
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    prisma.secretHandoff.updateMany.mockResolvedValue({ count: 0 })
    await expect(secrets.revealSecret("s1", "p1", "client"))
      .rejects.toMatchObject({ code: "SECRET_ALREADY_VIEWED", statusCode: 410 })
  })

  test("an already-viewed row says WHY it is gone", async () => {
    // 404 here would be wrong: a client who is told "not found" assumes the
    // system lost it and asks for it again by email, in plain text.
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ viewedAt: new Date(), ciphertext: null }))
    await expect(secrets.revealSecret("s1", "p1", "client"))
      .rejects.toMatchObject({ code: "SECRET_ALREADY_VIEWED" })
  })

  test("an expired row is refused, and says that too", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ expiresAt: PAST }))
    await expect(secrets.revealSecret("s1", "p1", "client"))
      .rejects.toMatchObject({ code: "SECRET_EXPIRED", statusCode: 410 })
    expect(prisma.secretHandoff.updateMany).not.toHaveBeenCalled()
  })

  test("a rotated key gives a specific answer rather than a retry loop", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    process.env.SECRET_HANDOFF_KEY = "c".repeat(64)
    try {
      await expect(secrets.revealSecret("s1", "p1", "client"))
        .rejects.toMatchObject({ code: "SECRET_UNDECRYPTABLE" })
    } finally {
      process.env.SECRET_HANDOFF_KEY = KEY
    }
  })
})

/* ── one way ─────────────────────────────────────────────────────────── */

describe("the direction IS the access model", () => {
  test("a secret we sent the client cannot be read back by an admin", async () => {
    // If the sender could re-reveal, "read once" would only mean the
    // recipient's copy was destroyed.
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ direction: "to_client" }))
    await expect(secrets.revealSecret("s1", "p1", "admin")).rejects.toMatchObject({ statusCode: 404 })
    expect(prisma.secretHandoff.updateMany).not.toHaveBeenCalled()
  })

  test("a secret the client sent us cannot be read back by the client", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ direction: "to_admin" }))
    await expect(secrets.revealSecret("s1", "p1", "client")).rejects.toMatchObject({ statusCode: 404 })
  })

  test("and each side CAN read what was sent to it", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ direction: "to_admin" }))
    await expect(secrets.revealSecret("s1", "p1", "admin")).resolves.toMatchObject({ value: expect.any(String) })
  })

  test("a secret on another project answers 404, like one that does not exist", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored({ projectId: "other" }))
    await expect(secrets.revealSecret("s1", "p1", "client")).rejects.toMatchObject({ statusCode: 404 })
    prisma.secretHandoff.findUnique.mockResolvedValue(null)
    await expect(secrets.revealSecret("s1", "p1", "client")).rejects.toMatchObject({ statusCode: 404 })
  })

  test("neither surface lets the CALLER choose the direction", () => {
    // A client who could pick "to_client" would be minting a note to self
    // that we can never read — a handoff that hands nothing off.
    const member = read("src", "controllers", "clientProjectController.js")
    const admin = read("src", "controllers", "adminClientProjectController.js")
    const portal = read("src", "controllers", "portalController.js")
    expect(member).toContain('direction: "to_admin"')
    expect(portal).toContain('direction: "to_admin"')
    expect(admin).toContain('direction: "to_client"')
  })

  test("reveal is a POST on every surface, because it destroys what it returns", () => {
    // A GET is burned by a link scanner, a prefetch, a chat preview or a
    // restored tab — every one of which spends the client's single read.
    for (const file of ["memberClientProjectRoutes.js", "adminClientProjectRoutes.js", "portalRoutes.js"]) {
      const routes = read("src", "routes", file)
      expect(routes).toMatch(/router\.post\s*\(\s*"[^"]*secrets\/:secretId\/reveal"/)
      expect(routes).not.toMatch(/router\.get\s*\(\s*"[^"]*secrets\/:secretId\/reveal"/)
    }
  })
})

/* ── listing, events, expiry ─────────────────────────────────────────── */

describe("nothing else can return a value", () => {
  test("the list is metadata only", async () => {
    prisma.secretHandoff.findMany.mockResolvedValue([
      { id: "s1", direction: "to_client", label: "cPanel", createdAt: new Date(), expiresAt: FUTURE, viewedAt: null },
    ])
    const [row] = await secrets.listForProject("p1", "client")
    expect(JSON.stringify(row)).not.toMatch(/ciphertext|value|iv|tag/)
    expect(row).toMatchObject({ label: "cPanel", state: "pending", isRevealable: true })
  })

  test("the list only offers a reveal to the recipient", async () => {
    prisma.secretHandoff.findMany.mockResolvedValue([
      { id: "s1", direction: "to_admin", label: "hosting", createdAt: new Date(), expiresAt: FUTURE, viewedAt: null },
    ])
    expect((await secrets.listForProject("p1", "client"))[0].isRevealable).toBe(false)
    expect((await secrets.listForProject("p1", "admin"))[0].isRevealable).toBe(true)
  })

  test("the select never asks the database for the ciphertext at all", () => {
    const svc = read("src", "services", "secretHandoffService.js")
    const listBlock = svc.slice(svc.indexOf("async function listForProject"))
    expect(listBlock.slice(0, 600)).not.toContain("ciphertext: true")
  })

  test("expired, viewed and pending are three distinguishable states", async () => {
    prisma.secretHandoff.findMany.mockResolvedValue([
      { id: "a", direction: "to_client", label: "a", createdAt: new Date(), expiresAt: FUTURE, viewedAt: null },
      { id: "b", direction: "to_client", label: "b", createdAt: new Date(), expiresAt: PAST, viewedAt: null },
      { id: "c", direction: "to_client", label: "c", createdAt: new Date(), expiresAt: FUTURE, viewedAt: new Date() },
    ])
    expect((await secrets.listForProject("p1", "client")).map((r) => r.state))
      .toEqual(["pending", "expired", "viewed"])
  })

  test("the timeline records the label and NEVER the value", async () => {
    await secrets.createSecret("p1", { direction: "to_client", label: "cPanel password", value: "hunter2" })
    const call = projectEvents.record.mock.calls[0][0]
    expect(call).toMatchObject({ type: "secret.shared", detail: "cPanel password" })
    expect(JSON.stringify(call)).not.toContain("hunter2")
  })

  test("reading one is recorded too — both sides can see it was collected", async () => {
    prisma.secretHandoff.findUnique.mockResolvedValue(stored())
    await secrets.revealSecret("s1", "p1", "client")
    expect(projectEvents.record).toHaveBeenCalledWith(expect.objectContaining({ type: "secret.viewed" }))
  })

  test("both event types are client-visible, never public", () => {
    const svc = read("src", "services", "projectEventService.js")
    const block = svc.slice(svc.indexOf('"secret.shared"'), svc.indexOf('"comment.added"'))
    expect(block.match(/visibility: "client"/g)).toHaveLength(2)
    expect(block).not.toContain('visibility: "public"')
  })
})

describe("expiry and size", () => {
  test("seven days by default, and thirty is the ceiling", async () => {
    await secrets.createSecret("p1", { direction: "to_client", label: "l", value: "v" })
    const a = prisma.secretHandoff.create.mock.calls[0][0].data.expiresAt
    expect(Math.round((a - Date.now()) / 86_400_000)).toBe(7)

    await secrets.createSecret("p1", { direction: "to_client", label: "l", value: "v", ttlDays: 3650 })
    const b = prisma.secretHandoff.create.mock.calls[1][0].data.expiresAt
    expect(Math.round((b - Date.now()) / 86_400_000)).toBe(secrets.MAX_TTL_DAYS)
  })

  test("anything file-sized is refused and pointed at the document request", async () => {
    await expect(secrets.createSecret("p1", {
      direction: "to_client", label: "l", value: "x".repeat(secrets.MAX_SECRET_BYTES + 1),
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })

  test("an empty value, a missing label and a bad direction are all refused", async () => {
    const bad = [
      { direction: "to_client", label: "l", value: "   " },
      { direction: "to_client", label: "", value: "v" },
      { direction: "sideways", label: "l", value: "v" },
      { label: "l", value: "v" },
    ]
    for (const data of bad) {
      await expect(secrets.createSecret("p1", data)).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    }
    expect(prisma.secretHandoff.create).not.toHaveBeenCalled()
  })

  test("purgeExpired wipes bytes rather than trusting the check to keep refusing", async () => {
    prisma.secretHandoff.updateMany.mockResolvedValue({ count: 4 })
    expect(await secrets.purgeExpired({ now: new Date("2026-09-05") })).toBe(4)
    expect(prisma.secretHandoff.updateMany.mock.calls[0][0].where).toMatchObject({ viewedAt: null })
  })
})

/* ── presets and the refusal ─────────────────────────────────────────── */

describe("the presets", () => {
  test("every one has both languages and an extension list", () => {
    // The Spanish half going missing is the exact failure this replaces —
    // it was retyped by hand every time.
    for (const p of FILE_REQUEST_PRESETS) {
      expect(p.title.trim()).toBeTruthy()
      expect(p.titleEs.trim()).toBeTruthy()
      expect(p.instructions.trim()).toBeTruthy()
      expect(p.instructionsEs.trim()).toBeTruthy()
      expect(p.acceptExt).toMatch(/^\.[a-z]/)
    }
  })

  test("ids are unique and stable-looking, because they are the contract", () => {
    const ids = FILE_REQUEST_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  test("the six the spec names are all there", () => {
    for (const id of ["cv", "constancia-fiscal", "logo-vector", "brand-assets", "registrar-confirmation", "content-copy"]) {
      expect(presetById(id)).toBeTruthy()
    }
  })

  test("a preset fills the request in, and explicit values still win", async () => {
    prisma.projectFileRequest.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data }))
    await fileRequests.createRequest("p1", { presetId: "constancia-fiscal", dueAt: "2026-10-01" })
    const data = prisma.projectFileRequest.create.mock.calls[0][0].data
    expect(data.title).toBe("Constancia de situación fiscal")
    expect(data.titleEs).toBeTruthy()
    expect(data.instructionsEs).toBeTruthy()
    expect(data.acceptExt).toContain(".pdf")

    await fileRequests.createRequest("p1", { presetId: "cv", title: "Your CV, updated" })
    expect(prisma.projectFileRequest.create.mock.calls[1][0].data.title).toBe("Your CV, updated")
  })

  test("an unknown preset id is refused rather than silently ignored", async () => {
    await expect(fileRequests.createRequest("p1", { presetId: "nope" }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })
})

describe("a request for a credential is refused, and told where to go", () => {
  test.each([
    "Hosting password",
    "cPanel login and password",
    "Contraseña del hosting",
    "API key for the payment gateway",
    "Send us your access token",
    "Clave de acceso al registrador",
  ])("%s", async (title) => {
    prisma.projectFileRequest.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data }))
    await expect(fileRequests.createRequest("p1", { title }))
      .rejects.toMatchObject({ code: "USE_SECRET_HANDOFF" })
    expect(prisma.projectFileRequest.create).not.toHaveBeenCalled()
  })

  test("the refusal names the alternative", async () => {
    // A refusal that does not say what to do instead is how somebody finds a
    // workaround — which here means the password in an email.
    const e = await fileRequests.createRequest("p1", { title: "hosting password" }).catch((x) => x)
    expect(e.message.toLowerCase()).toContain("credential handoff")
  })

  test("the Spanish title is checked too, not only the English one", async () => {
    await expect(fileRequests.createRequest("p1", { title: "Datos del hosting", titleEs: "Contraseña del hosting" }))
      .rejects.toMatchObject({ code: "USE_SECRET_HANDOFF" })
  })

  test("ordinary document requests are unaffected", async () => {
    prisma.projectFileRequest.create.mockImplementation(async ({ data }) => ({ id: "r1", ...data }))
    for (const title of ["Your logo in vector", "Constancia de situación fiscal", "The text for the homepage"]) {
      await expect(fileRequests.createRequest("p1", { title })).resolves.toBeTruthy()
    }
  })

  test("only the TITLE is checked — instructions legitimately say the word", () => {
    // The registrar preset's instructions read "DO NOT send the login".
    // Refusing that would be exactly backwards.
    expect(looksLikeCredentialRequest("Domain registrar — written confirmation")).toBe(false)
    expect(presetById("registrar-confirmation").instructions.toLowerCase()).toContain("login")
  })
})
