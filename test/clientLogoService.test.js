/**
 * clientLogoService — the /about client logo wall.
 *
 * What matters here is that the wall cannot be broken from the admin: a bad
 * `scale` must not blow the row apart, the Spanish column must not leak to
 * the public payload, and a partial edit must not wipe the other fields.
 */
jest.mock("../src/lib/prisma", () => ({
  clientLogo: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
}))

const prisma = require("../src/lib/prisma")
const svc = require("../src/services/clientLogoService")

const row = (over = {}) => ({
  id: "cl1",
  name: "Colegio Interlaken",
  slug: "interlaken",
  logoUrl: "/images/brand/companies/interlaken.webp",
  sector: "K-12 school · Mexico",
  sectorEs: "Colegio K-12 · México",
  websiteUrl: null,
  scale: 1.1,
  boxed: false,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

beforeEach(() => jest.clearAllMocks())

describe("public read", () => {
  test("returns active logos in order and resolves the Spanish sector", async () => {
    prisma.clientLogo.findMany.mockResolvedValue([row()])

    const en = await svc.listPublicClientLogos("en")
    expect(prisma.clientLogo.findMany.mock.calls[0][0]).toMatchObject({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    expect(en[0].sector).toBe("K-12 school · Mexico")

    const es = await svc.listPublicClientLogos("es")
    expect(es[0].sector).toBe("Colegio K-12 · México")
    // The raw translation column is an implementation detail of the admin.
    expect(es[0]).not.toHaveProperty("sectorEs")
  })

  test("a nonsense scale can never blow the row apart", async () => {
    prisma.clientLogo.findMany.mockResolvedValue([
      row({ id: "a", scale: 99 }),
      row({ id: "b", slug: "b", scale: 0 }),
      row({ id: "c", slug: "c", scale: null }),
    ])
    const out = await svc.listPublicClientLogos("en")
    expect(out.map((r) => r.scale)).toEqual([2, 0.5, 0.5])
  })
})

describe("admin writes", () => {
  test("create slugifies the name, clamps the scale and appends to the end", async () => {
    prisma.clientLogo.findFirst.mockResolvedValue({ sortOrder: 6 })
    prisma.clientLogo.create.mockImplementation(({ data }) => Promise.resolve(row({ ...data, id: "new" })))

    const created = await svc.createClientLogo({ name: "Açme & Co!", logoUrl: "/x.webp", scale: 12 })
    const data = prisma.clientLogo.create.mock.calls[0][0].data
    expect(data.slug).toBe("a-me-co")
    expect(data.scale).toBe(2)
    expect(data.sortOrder).toBe(7) // after the current last row
    expect(created.id).toBe("new")
  })

  test("create refuses a row that would render as a broken frame", async () => {
    await expect(svc.createClientLogo({ name: "No logo" })).rejects.toMatchObject({ statusCode: 400 })
    await expect(svc.createClientLogo({ logoUrl: "/x.webp" })).rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.clientLogo.create).not.toHaveBeenCalled()
  })

  test("a partial edit only writes the fields it was given", async () => {
    prisma.clientLogo.update.mockImplementation(({ data }) => Promise.resolve(row(data)))
    await svc.updateClientLogo("cl1", { isActive: false })
    const data = prisma.clientLogo.update.mock.calls[0][0].data
    expect(data).toEqual({ isActive: false })
    // Untouched columns must not be sent, or hiding a logo would erase its copy.
    expect(data).not.toHaveProperty("name")
    expect(data).not.toHaveProperty("sector")
  })

  test("duplicate slug and missing row surface as 409 / 404, not 500", async () => {
    prisma.clientLogo.create.mockRejectedValue({ code: "P2002" })
    await expect(svc.createClientLogo({ name: "Dup", logoUrl: "/x.webp" })).rejects.toMatchObject({ statusCode: 409 })

    prisma.clientLogo.update.mockRejectedValue({ code: "P2025" })
    await expect(svc.updateClientLogo("nope", { name: "x" })).rejects.toMatchObject({ statusCode: 404 })

    prisma.clientLogo.delete.mockRejectedValue({ code: "P2025" })
    await expect(svc.deleteClientLogo("nope")).rejects.toMatchObject({ statusCode: 404 })
  })

  test("reorder writes one sortOrder per id, in the given order", async () => {
    prisma.clientLogo.update.mockResolvedValue(row())
    prisma.clientLogo.findMany.mockResolvedValue([])
    await svc.reorderClientLogos(["c", "a", "b"])
    const seen = prisma.clientLogo.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.sortOrder])
    expect(seen).toEqual([["c", 0], ["a", 1], ["b", 2]])
    expect(prisma.$transaction).toHaveBeenCalled() // all-or-nothing
  })

  test("reorder rejects an empty payload rather than wiping the order", async () => {
    await expect(svc.reorderClientLogos([])).rejects.toMatchObject({ statusCode: 400 })
    await expect(svc.reorderClientLogos(undefined)).rejects.toMatchObject({ statusCode: 400 })
  })
})
