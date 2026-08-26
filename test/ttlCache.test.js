/**
 * lib/ttlCache — the in-process read cache behind the public catalogue.
 *
 * A5. What has to hold for it to be safe to put in front of MySQL:
 *   - an entry never outlives its TTL
 *   - a namespace can be dropped wholesale (writes do this)
 *   - concurrent cold callers share ONE computation, not N
 *   - a rejected computation is not cached
 *   - eviction drops the least recently USED, bounded by maxEntries
 *   - a non-positive TTL is a pure call-through (used under test)
 */

const { TtlCache } = require("../src/lib/ttlCache")

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, tick: (ms) => { t += ms } }
}

describe("get / set / expiry", () => {
  test("returns a stored value until its TTL elapses, then misses", () => {
    const c = clock(); const cache = new TtlCache({ now: c.now })
    cache.set("products:a", { x: 1 }, 1000)
    expect(cache.get("products:a")).toEqual({ x: 1 })
    c.tick(999)
    expect(cache.get("products:a")).toEqual({ x: 1 })
    c.tick(1)
    expect(cache.get("products:a")).toBeUndefined()
    expect(cache.stats()).toMatchObject({ hits: 2, misses: 1, size: 0 })
  })

  test("key() is stable for equal args and distinct for different args", () => {
    expect(TtlCache.key("p", { a: 1, b: [2] })).toBe(TtlCache.key("p", { a: 1, b: [2] }))
    expect(TtlCache.key("p", { a: 1 })).not.toBe(TtlCache.key("p", { a: 2 }))
    expect(TtlCache.key("p", undefined)).toBe("p:")
  })
})

describe("wrap", () => {
  test("computes once per TTL per argument set", async () => {
    const c = clock(); const cache = new TtlCache({ now: c.now })
    const fn = jest.fn(async () => ({ rows: [1, 2] }))

    await expect(cache.wrap("products", [{ page: 1 }], 500, fn)).resolves.toEqual({ rows: [1, 2] })
    await expect(cache.wrap("products", [{ page: 1 }], 500, fn)).resolves.toEqual({ rows: [1, 2] })
    await cache.wrap("products", [{ page: 2 }], 500, fn)
    expect(fn).toHaveBeenCalledTimes(2)

    c.tick(500)
    await cache.wrap("products", [{ page: 1 }], 500, fn)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test("concurrent cold callers share one in-flight computation", async () => {
    const cache = new TtlCache()
    let resolve
    const fn = jest.fn(() => new Promise((r) => { resolve = r }))

    const a = cache.wrap("services", [], 1000, fn)
    const b = cache.wrap("services", [], 1000, fn)
    const c = cache.wrap("services", [], 1000, fn)
    expect(fn).toHaveBeenCalledTimes(1)

    resolve({ ok: true })
    await expect(Promise.all([a, b, c])).resolves.toEqual([{ ok: true }, { ok: true }, { ok: true }])
    // The in-flight marker is gone and the real entry is present.
    expect(cache.stats().size).toBe(1)
  })

  test("a rejected computation is not cached and the next caller retries", async () => {
    const cache = new TtlCache()
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ ok: true })

    await expect(cache.wrap("blog", [], 1000, fn)).rejects.toThrow("db down")
    expect(cache.stats().size).toBe(0)
    await expect(cache.wrap("blog", [], 1000, fn)).resolves.toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test("a non-positive TTL calls straight through every time and stores nothing", async () => {
    const cache = new TtlCache()
    const fn = jest.fn(async () => "v")
    await cache.wrap("products", [], 0, fn)
    await cache.wrap("products", [], 0, fn)
    await cache.wrap("products", [], -5, fn)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(cache.stats().size).toBe(0)
  })
})

describe("invalidate", () => {
  test("drops every entry in a namespace and leaves the others", async () => {
    const cache = new TtlCache()
    cache.set("products:a", 1, 1000, "products")
    cache.set("products:b", 2, 1000, "products")
    cache.set("services:a", 3, 1000, "services")

    expect(cache.invalidate("products")).toBe(2)
    expect(cache.get("products:a")).toBeUndefined()
    expect(cache.get("products:b")).toBeUndefined()
    expect(cache.get("services:a")).toBe(3)
  })

  test("wrap stores under its namespace so invalidate reaches it", async () => {
    const cache = new TtlCache()
    await cache.wrap("portfolio", [{ f: 1 }], 1000, async () => "p")
    expect(cache.invalidate("portfolio")).toBe(1)
  })
})

describe("eviction", () => {
  test("is bounded by maxEntries and drops the least recently used", () => {
    const cache = new TtlCache({ maxEntries: 3 })
    cache.set("n:1", 1, 1000); cache.set("n:2", 2, 1000); cache.set("n:3", 3, 1000)
    cache.get("n:1")                 // n:1 is now most recently used
    cache.set("n:4", 4, 1000)        // evicts the LRU: n:2
    expect(cache.get("n:2")).toBeUndefined()
    expect(cache.get("n:1")).toBe(1)
    expect(cache.get("n:3")).toBe(3)
    expect(cache.get("n:4")).toBe(4)
    expect(cache.stats().size).toBe(3)
  })
})
