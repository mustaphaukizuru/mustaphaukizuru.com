/**
 * scripts/restore-db-json.js — the type coercion, which is the part that can
 * silently corrupt a restore.
 *
 * JSON has no Date, BigInt or Buffer, so backupService stringifies them on the
 * way out. Handing those strings back to Prisma either throws or, worse,
 * writes the wrong thing. These tests pin the round trip, and pin the rule
 * that decides it: the SCHEMA declares the type, never the shape of the value.
 * A String column holding something that looks like a date must stay a string.
 */
jest.mock("../src/lib/prisma", () => ({ $disconnect: jest.fn() }))

const { coerceValue, coerceRow, scalarFieldsByModel } = require("../scripts/restore-db-json")

describe("restore · type coercion", () => {
  test("an ISO string in a DateTime column becomes a Date", () => {
    const v = coerceValue("2026-08-28T07:58:00.000Z", { type: "DateTime", isList: false })
    expect(v).toBeInstanceOf(Date)
    expect(v.toISOString()).toBe("2026-08-28T07:58:00.000Z")
  })

  test("an ISO string in a String column stays a string", () => {
    // The schema decides, not the value. Getting this backwards would rewrite
    // every text column that happens to hold a timestamp.
    const v = coerceValue("2026-08-28T07:58:00.000Z", { type: "String", isList: false })
    expect(typeof v).toBe("string")
  })

  test("a stringified BigInt becomes a BigInt", () => {
    expect(coerceValue("9007199254740993", { type: "BigInt", isList: false })).toBe(9007199254740993n)
  })

  test("Bytes round-trip through base64", () => {
    const b = coerceValue(Buffer.from("hello").toString("base64"), { type: "Bytes", isList: false })
    expect(Buffer.isBuffer(b)).toBe(true)
    expect(b.toString()).toBe("hello")
  })

  test("Decimal stays a string — Prisma accepts that form", () => {
    expect(coerceValue("1234.56", { type: "Decimal", isList: false })).toBe("1234.56")
  })

  test("null and undefined pass through untouched", () => {
    expect(coerceValue(null, { type: "DateTime", isList: false })).toBeNull()
    expect(coerceValue(undefined, { type: "BigInt", isList: false })).toBeUndefined()
  })

  test("list columns coerce element-wise", () => {
    const v = coerceValue(["2026-01-01T00:00:00.000Z"], { type: "DateTime", isList: true })
    expect(v[0]).toBeInstanceOf(Date)
  })
})

describe("restore · row shaping", () => {
  const fields = new Map([
    ["id", { type: "String", isList: false }],
    ["createdAt", { type: "DateTime", isList: false }],
  ])

  test("keeps known columns and converts them", () => {
    const dropped = new Set()
    const row = coerceRow({ id: "a", createdAt: "2026-08-28T00:00:00.000Z" }, fields, dropped)
    expect(row.id).toBe("a")
    expect(row.createdAt).toBeInstanceOf(Date)
    expect(dropped.size).toBe(0)
  })

  test("drops a column the schema no longer has, and reports it", () => {
    // An old dump restored against a newer schema. Passing the stale column
    // through would fail the whole 500-row chunk, so it is dropped — but
    // silently dropping data is worse, hence the reported set.
    const dropped = new Set()
    const row = coerceRow({ id: "a", removedColumn: 1 }, fields, dropped)
    expect(row).toEqual({ id: "a" })
    expect([...dropped]).toEqual(["removedColumn"])
  })
})

describe("restore · schema parsing", () => {
  const models = scalarFieldsByModel()

  test("reads every model in the real schema", () => {
    expect(models.size).toBeGreaterThan(70)
  })

  test("keeps scalar columns but not relation fields", () => {
    const user = models.get("User")
    expect(user).toBeDefined()
    expect(user.get("id")).toEqual({ type: "String", isList: false })
    // `orders Order[]` is a relation — it has no column and must not be
    // sent to createMany.
    expect(user.has("orders")).toBe(false)
  })

  test("enum columns are kept as scalars", () => {
    const user = models.get("User")
    expect(user.has("role")).toBe(true)
  })
})
