/**
 * lib/cacheInvalidation — one Prisma hook clears the read cache on writes.
 *
 * A5. Pinned:
 *   - every catalogue model maps to a namespace; nothing else does
 *   - a WRITE to a catalogue model clears exactly that namespace, after the
 *     query has run
 *   - a READ clears nothing; a write to a non-catalogue model clears nothing
 *   - a failed write clears nothing (the query threw before invalidation)
 *   - a client without $extends is returned untouched, so a stubbed client
 *     can never stop the app from booting
 */

const { cache } = require("../src/lib/ttlCache")
const {
  extendWithInvalidation,
  invalidatingOperation,
  namespaceForModel,
  NAMESPACE_FOR_MODEL,
  WRITE_OPS,
} = require("../src/lib/cacheInvalidation")

beforeEach(() => cache.clear())

describe("namespace map", () => {
  test.each([
    ["Product", "products"], ["ProductImage", "products"], ["ProductFile", "products"], ["ProductCategory", "products"],
    ["Service", "services"], ["ServicePackage", "services"],
    ["Portfolio", "portfolio"],
    ["BlogPost", "blog"], ["BlogCategory", "blog"], ["BlogTag", "blog"], ["BlogPostTag", "blog"],
  ])("%s -> %s", (model, ns) => expect(namespaceForModel(model)).toBe(ns))

  test("non-catalogue models map to nothing", () => {
    for (const m of ["User", "Order", "Payment", "EmailLog", "Cart", "Consultation"]) {
      expect(namespaceForModel(m)).toBeNull()
    }
    expect(Object.isFrozen(NAMESPACE_FOR_MODEL)).toBe(true)
  })

  test("the write set covers every mutating Prisma operation and no reads", () => {
    for (const op of ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]) expect(WRITE_OPS.has(op)).toBe(true)
    for (const op of ["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"]) expect(WRITE_OPS.has(op)).toBe(false)
  })
})

describe("invalidatingOperation", () => {
  const seed = () => {
    cache.set("products:list", [1], 60_000, "products")
    cache.set("services:list", [2], 60_000, "services")
  }

  test("a write to a catalogue model clears its namespace AFTER running the query", async () => {
    seed()
    const order = []
    const query = jest.fn(async (args) => { order.push("query"); expect(cache.get("products:list")).toEqual([1]); return { id: "p1", ...args.data } })

    const out = await invalidatingOperation({ model: "Product", operation: "update", args: { data: { title: "x" } }, query })

    expect(out).toEqual({ id: "p1", title: "x" })
    expect(cache.get("products:list")).toBeUndefined()   // cleared
    expect(cache.get("services:list")).toEqual([2])      // untouched
  })

  test("a read clears nothing", async () => {
    seed()
    await invalidatingOperation({ model: "Product", operation: "findMany", args: {}, query: async () => [] })
    expect(cache.get("products:list")).toEqual([1])
  })

  test("a write to a non-catalogue model clears nothing", async () => {
    seed()
    await invalidatingOperation({ model: "Order", operation: "create", args: {}, query: async () => ({}) })
    expect(cache.get("products:list")).toEqual([1])
    expect(cache.get("services:list")).toEqual([2])
  })

  test("a failed write clears nothing and rethrows", async () => {
    seed()
    await expect(invalidatingOperation({ model: "Product", operation: "delete", args: {}, query: async () => { throw new Error("P2025") } }))
      .rejects.toThrow("P2025")
    expect(cache.get("products:list")).toEqual([1])
  })

  test("createMany on a child model (ProductImage) clears the parent namespace", async () => {
    seed()
    await invalidatingOperation({ model: "ProductImage", operation: "createMany", args: {}, query: async () => ({ count: 3 }) })
    expect(cache.get("products:list")).toBeUndefined()
  })
})

describe("extendWithInvalidation", () => {
  test("returns the client untouched when it has no $extends", () => {
    const plain = { $connect: jest.fn() }
    expect(extendWithInvalidation(plain)).toBe(plain)
    expect(extendWithInvalidation(null)).toBeNull()
  })

  test("registers a single $allModels/$allOperations hook", () => {
    let captured
    const client = { $extends: jest.fn((ext) => { captured = ext; return "extended" }) }
    expect(extendWithInvalidation(client)).toBe("extended")
    expect(captured.name).toBe("catalogue-cache-invalidation")
    expect(captured.query.$allModels.$allOperations).toBe(invalidatingOperation)
  })
})
