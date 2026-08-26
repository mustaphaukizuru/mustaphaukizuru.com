// ─────────────────────────────────────────────────────────────────────────────
// Step 42 · soft delete — Product / Service / BlogPost
//
//   • public reads always carry `deletedAt: null`
//   • admin delete sets deletedAt (hard delete only with { hard: true })
//   • restore clears it
//
// Run:  npm test -- softDelete
// ─────────────────────────────────────────────────────────────────────────────

const mockModel = () => ({
  findMany: jest.fn().mockResolvedValue([]),
  findFirst: jest.fn().mockResolvedValue(null),
  findUnique: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  delete: jest.fn(async ({ where }) => ({ id: where.id })),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  aggregate: jest.fn(),
  groupBy: jest.fn().mockResolvedValue([]),
})

jest.mock("../src/lib/prisma", () => ({
  product: mockModel(),
  service: mockModel(),
  blogPost: mockModel(),
  blogCategory: mockModel(),
  blogTag: mockModel(),
  productCategory: mockModel(),
  productFile: mockModel(),
  productImage: mockModel(),
  userDownload: { aggregate: jest.fn() },
  review: { aggregate: jest.fn(), groupBy: jest.fn() },
  // listArchive groups in SQL — the soft-delete filter lives in this query.
  $queryRaw: jest.fn().mockResolvedValue([]),
}))
jest.mock("../src/middleware/uploadProductFile",  () => ({ PRODUCT_FILE_DIR: "/tmp/x", upload: {} }))
jest.mock("../src/middleware/uploadProductImage", () => ({ PRODUCT_IMAGE_DIR: "/tmp/y", uploadProductImage: {} }))

const prisma = require("../src/lib/prisma")
const productService      = require("../src/services/productService")
const adminProductService = require("../src/services/adminProductService")
const blogService         = require("../src/services/blogService")
const adminBlogService    = require("../src/services/adminBlogService")
const serviceService      = require("../src/services/serviceService")
const adminServiceService = require("../src/services/adminServiceService")

const whereOf = (fn, n = 0) => fn.mock.calls[n][0].where

beforeEach(() => jest.clearAllMocks())

describe("public reads filter deletedAt: null", () => {
  test("products: list / featured / search / category / bySlug / related", async () => {
    await productService.getAllProducts({})
    expect(whereOf(prisma.product.findMany)).toMatchObject({ deletedAt: null })

    await productService.getFeaturedProducts()
    expect(whereOf(prisma.product.findMany, 1)).toMatchObject({ deletedAt: null })

    await productService.searchProducts("x")
    expect(whereOf(prisma.product.findMany, 2).AND).toEqual(expect.arrayContaining([{ deletedAt: null }]))

    await productService.getProductBySlug("s")
    expect(whereOf(prisma.product.findFirst)).toMatchObject({ slug: "s", deletedAt: null })

    prisma.product.findFirst.mockResolvedValueOnce({ id: "p1", category: "Cat" })
    await productService.getRelatedProducts("s")
    expect(whereOf(prisma.product.findFirst, 1)).toMatchObject({ deletedAt: null })
    expect(whereOf(prisma.product.findMany, 3)).toMatchObject({ deletedAt: null, id: { not: "p1" } })

    await productService.getCategories()
    expect(whereOf(prisma.product.findMany, 4)).toMatchObject({ deletedAt: null })
  })

  test("services: list / bySlug / featured / related", async () => {
    await serviceService.listServices({})
    expect(whereOf(prisma.service.findMany)).toMatchObject({ status: "published", deletedAt: null })
    await serviceService.getServiceBySlug("s")
    expect(whereOf(prisma.service.findFirst)).toMatchObject({ deletedAt: null })
    await serviceService.getFeaturedServices()
    expect(whereOf(prisma.service.findMany, 1)).toMatchObject({ deletedAt: null })
    await serviceService.getRelatedServices("x")
    expect(whereOf(prisma.service.findMany, 2)).toMatchObject({ deletedAt: null })
  })

  test("blog: list / bySlug / archive / tag counts", async () => {
    await blogService.listPublicPosts({})
    expect(whereOf(prisma.blogPost.findMany)).toMatchObject({ status: "published", deletedAt: null })
    await blogService.getPublicPostBySlug("s")
    expect(whereOf(prisma.blogPost.findFirst)).toMatchObject({ deletedAt: null })
    // listArchive groups in SQL now (it used to load every published post and
    // bucket them in JS). The soft-delete guarantee is unchanged but it lives
    // in the WHERE clause of a raw query, so assert on the SQL rather than on
    // a findMany that no longer happens.
    await blogService.listArchive()
    const archiveSql = prisma.$queryRaw.mock.calls.at(-1)[0].join("?")
    expect(archiveSql).toMatch(/deletedAt IS NULL/)
    expect(archiveSql).toMatch(/status = 'published'/)
    await blogService.listTopTags()
    const inc = prisma.blogTag.findMany.mock.calls[0][0].include._count.select.posts.where
    expect(inc).toEqual({ post: { status: "published", deletedAt: null } })
  })
})

describe("admin delete is soft by default", () => {
  test("product", async () => {
    prisma.product.findUnique.mockResolvedValueOnce({ id: "p1" })
    const row = await adminProductService.deleteAdminProduct("p1")
    expect(prisma.product.delete).not.toHaveBeenCalled()
    expect(row.deletedAt).toBeInstanceOf(Date)
    expect(row.isActive).toBe(false)
  })

  test("product: unknown id -> null; hard -> real delete", async () => {
    expect(await adminProductService.deleteAdminProduct("nope")).toBeNull()
    await adminProductService.deleteAdminProduct("p1", { hard: true })
    expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: "p1" } })
  })

  test("blog post", async () => {
    prisma.blogPost.findUnique.mockResolvedValueOnce({ id: "b1" })
    await adminBlogService.deletePost("b1")
    expect(prisma.blogPost.delete).not.toHaveBeenCalled()
    expect(prisma.blogPost.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    await adminBlogService.deletePost("b1", { hard: true })
    expect(prisma.blogPost.delete).toHaveBeenCalledWith({ where: { id: "b1" } })
  })

  test("service", async () => {
    prisma.service.findUnique.mockResolvedValueOnce({ id: "s1", status: "published" })
    await adminServiceService.softDeleteService("s1")
    expect(prisma.service.update.mock.calls[0][0].data).toMatchObject({ status: "archived", isFeatured: false })
    expect(prisma.service.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    expect(prisma.service.delete).not.toHaveBeenCalled()
  })

  test("admin product list flags deleted rows", async () => {
    prisma.product.findMany.mockResolvedValueOnce([{ id: "a", deletedAt: new Date() }, { id: "b", deletedAt: null }])
    const rows = await adminProductService.getAdminProducts()
    expect(rows.map((r) => r.isDeleted)).toEqual([true, false])
  })
})

describe("restore clears deletedAt", () => {
  test("product", async () => {
    prisma.product.findUnique.mockResolvedValueOnce({ id: "p1", deletedAt: new Date() })
    const row = await adminProductService.restoreAdminProduct("p1")
    expect(row).toMatchObject({ id: "p1", deletedAt: null })
    expect(await adminProductService.restoreAdminProduct("nope")).toBeNull()
  })

  test("blog post", async () => {
    prisma.blogPost.findUnique
      .mockResolvedValueOnce({ id: "b1" })
      .mockResolvedValueOnce({ id: "b1", deletedAt: null, status: "draft", tags: [], category: null })
    await adminBlogService.restorePost("b1")
    expect(prisma.blogPost.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { deletedAt: null } })
  })

  test("service: archived -> draft", async () => {
    prisma.service.findUnique.mockResolvedValueOnce({ id: "s1", status: "archived", deletedAt: new Date() })
    await adminServiceService.restoreService("s1")
    expect(prisma.service.update.mock.calls[0][0].data).toEqual({ deletedAt: null, status: "draft" })
  })
})
