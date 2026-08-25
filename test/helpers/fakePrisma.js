/**
 * In-memory Prisma fake for HTTP-level integration tests.
 *
 * Supports the subset of the Prisma client surface the money + booking
 * flows touch: findUnique / findFirst / findMany / create / createMany /
 * update / updateMany / delete / deleteMany / count / upsert on any model,
 * plus $transaction (callback form receives the same fake, array form is
 * Promise.all), $queryRaw, $connect, $disconnect.
 *
 * Semantics that matter for the flows under test:
 *   - `where` supports scalar equality, in / notIn / not / gt / gte / lt /
 *     lte / contains / startsWith, AND / OR / NOT, relation filters, and
 *     compound-unique selectors (`{ a_b: { a, b } }`).
 *   - `updateMany` honours its full `where` (so an optimistic-lock
 *     `usedCount` clause only matches the un-bumped row), returns `{ count }`.
 *   - Unique constraints (see UNIQUES) throw a P2002-shaped error on
 *     create / update — this is what the booking race relies on.
 *   - Nested writes: `{ rel: { connect: { id } } }`, `{ rel: { create: [...] } }`.
 *   - `include` / `select` resolve relations from RELATIONS.
 *   - Every operation yields to the macrotask queue once so two concurrent
 *     requests interleave the way they would against a real DB.
 */

const RELATIONS = {
  order: {
    items:         { model: "orderItem",    fk: "orderId",  many: true },
    payments:      { model: "payment",      fk: "orderId",  many: true },
    refunds:       { model: "refund",       fk: "orderId",  many: true },
    userDownloads: { model: "userDownload", fk: "orderId",  many: true },
    invoice:       { model: "invoice",      fk: "orderId",  many: false },
    user:          { model: "user",         localKey: "userId" },
    coupon:        { model: "coupon",       localKey: "couponId" },
  },
  orderItem: {
    product: { model: "product", localKey: "productId" },
    order:   { model: "order",   localKey: "orderId" },
  },
  product: {
    images:   { model: "productImage", fk: "productId", many: true },
    files:    { model: "productFile",  fk: "productId", many: true },
    category: { model: "category",     localKey: "categoryId" },
  },
  payment: {
    order: { model: "order", localKey: "orderId" },
    user:  { model: "user",  localKey: "userId" },
  },
  refund: {
    order:   { model: "order",   localKey: "orderId" },
    payment: { model: "payment", localKey: "paymentId" },
  },
  userDownload: {
    product:   { model: "product",   localKey: "productId" },
    order:     { model: "order",     localKey: "orderId" },
    orderItem: { model: "orderItem", localKey: "orderItemId" },
  },
  consultation: {
    user:          { model: "user",    localKey: "userId" },
    assignedAdmin: { model: "user",    localKey: "assignedAdminId" },
    service:       { model: "service", localKey: "serviceId" },
  },
  clientProject: {
    user:         { model: "user",         localKey: "userId" },
    serviceOrder: { model: "serviceOrder", localKey: "serviceOrderId" },
  },
  serviceOrder: {
    service: { model: "service", localKey: "serviceId" },
    user:    { model: "user",    localKey: "userId" },
  },
  couponUsage: {
    coupon: { model: "coupon", localKey: "couponId" },
    user:   { model: "user",   localKey: "userId" },
  },
  cart: {
    appliedCoupon: { model: "coupon", localKey: "appliedCouponId" },
  },
}

// Unique constraints enforced on create/update. Each entry is a list of
// field names; a null in any field skips the check (Prisma semantics).
const UNIQUES = {
  user:           [["email"]],
  order:          [["orderNumber"]],
  coupon:         [["code"]],
  consultation:   [["assignedAdminId", "scheduledAt"], ["confirmationToken"]],
  paymentWebhook: [["paymentGateway", "gatewayEventId"]],
  userDownload:   [["userId", "orderItemId"]],
  couponUsage:    [["couponId", "orderId"]],
  clientProject:  [["serviceOrderId"], ["consultationId"]],
  invoice:        [["orderId"]],
}

const DEFAULTS = {
  user:           () => ({ role: "member", status: "active", authProvider: "local", passwordHash: null, tokensValidFrom: null, avatarUrl: null }),
  order:          () => ({ status: "pending", currency: "MXN", paidAt: null, discountAmount: 0, userId: null, couponId: null }),
  coupon:         () => ({ usedCount: 0, isActive: true, usageLimit: null, maxUsesPerUser: null, minOrderAmount: null, stackable: true, startsAt: null, expiresAt: null }),
  product:        () => ({ isActive: true }),
  userDownload:   () => ({ downloadAccessStatus: "active", downloadCount: 0, lastDownloadedAt: null }),
  payment:        () => ({ paidAt: null, failureReason: null }),
  consultation:   () => ({ status: "pending", meetingLink: null, meetingProvider: null, googleEventId: null }),
  refund:         () => ({ refundStatus: "pending", processedAt: null }),
  paymentWebhook: () => ({ processed: false, processedAt: null }),
}

function p2002(model, fields) {
  const err = new Error(`Unique constraint failed on the fields: (${fields.join(",")})`)
  err.name = "PrismaClientKnownRequestError"
  err.code = "P2002"
  err.meta = { target: fields, modelName: model }
  return err
}

function p2025(model) {
  const err = new Error(`No ${model} record found`)
  err.name = "PrismaClientKnownRequestError"
  err.code = "P2025"
  return err
}

function same(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a).getTime()
    const tb = b instanceof Date ? b.getTime() : new Date(b).getTime()
    return ta === tb
  }
  return a === b
}

function cmp(a, b) {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime()
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && !Buffer.isBuffer(v)
}

function matchField(rowValue, cond) {
  if (!isPlainObject(cond)) return same(rowValue, cond)
  const insensitive = cond.mode === "insensitive"
  const norm = (v) => (insensitive && typeof v === "string" ? v.toLowerCase() : v)
  for (const [op, v] of Object.entries(cond)) {
    switch (op) {
      case "equals":     if (!same(norm(rowValue), norm(v))) return false; break
      case "not":
        if (isPlainObject(v)) { if (matchField(rowValue, v)) return false }
        else if (same(rowValue, v)) return false
        break
      case "in":         if (!v.some((x) => same(rowValue, x))) return false; break
      case "notIn":      if (v.some((x) => same(rowValue, x))) return false; break
      case "gt":         if (!(cmp(rowValue, v) > 0)) return false; break
      case "gte":        if (!(cmp(rowValue, v) >= 0)) return false; break
      case "lt":         if (!(cmp(rowValue, v) < 0)) return false; break
      case "lte":        if (!(cmp(rowValue, v) <= 0)) return false; break
      case "contains":   if (!String(norm(rowValue) ?? "").includes(norm(v))) return false; break
      case "startsWith": if (!String(norm(rowValue) ?? "").startsWith(norm(v))) return false; break
      case "endsWith":   if (!String(norm(rowValue) ?? "").endsWith(norm(v))) return false; break
      case "mode":       break
      default:           return false // unsupported operator → no match (loud)
    }
  }
  return true
}

class FakePrisma {
  constructor() {
    this.tables = new Map()
    this._seq = 0
    this.log = []

    // Assigned once the Proxy below exists: interactive transactions must
    // receive the *proxied* client, otherwise `tx.order` (resolved by the
    // `get` trap) is undefined and every tx body throws.
    this.$transaction = async (arg) => {
      if (typeof arg === "function") return arg(this._proxy || this)
      return Promise.all(arg)
    }
    this.$queryRaw = async () => []
    this.$executeRaw = async () => 0
    this.$connect = async () => {}
    this.$disconnect = async () => {}
    this.isAlive = async () => true
    this.recycle = async () => {}

    const proxy = new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) return target[prop]
        if (typeof prop !== "string" || prop.startsWith("$") || prop === "then") return undefined
        return target._delegate(prop)
      },
    })
    this._proxy = proxy
    return proxy
  }

  /* ── seeding / inspection helpers (test-facing) ─────────────────────── */

  table(model) {
    if (!this.tables.has(model)) this.tables.set(model, [])
    return this.tables.get(model)
  }

  /** Insert a row synchronously, applying defaults. Returns the row. */
  seed(model, data) {
    const row = this._materialise(model, data)
    this.table(model).push(row)
    return row
  }

  rows(model) { return this.table(model).map((r) => ({ ...r })) }
  reset() { this.tables.clear(); this.log = [] }

  /* ── internals ──────────────────────────────────────────────────────── */

  _id(model) { this._seq += 1; return `${model}_${String(this._seq).padStart(4, "0")}` }

  _materialise(model, data) {
    const now = new Date()
    const defaults = DEFAULTS[model] ? DEFAULTS[model]() : {}
    const row = { id: this._id(model), createdAt: now, updatedAt: now, ...defaults }
    const rels = RELATIONS[model] || {}
    const nested = []
    for (const [k, v] of Object.entries(data || {})) {
      const rel = rels[k]
      if (rel && isPlainObject(v)) {
        if (v.connect) {
          if (rel.localKey) row[rel.localKey] = v.connect.id
          continue
        }
        if (v.create) { nested.push({ rel, items: Array.isArray(v.create) ? v.create : [v.create] }); continue }
        if (v.createMany) { nested.push({ rel, items: v.createMany.data || [] }); continue }
      }
      row[k] = v
    }
    for (const { rel, items } of nested) {
      for (const item of items) {
        const childData = { ...item, [rel.fk]: row.id }
        this._checkUnique(rel.model, childData)
        this.table(rel.model).push(this._materialise(rel.model, childData))
      }
    }
    return row
  }

  _checkUnique(model, candidate, excludeId = null) {
    for (const fields of UNIQUES[model] || []) {
      if (fields.some((f) => candidate[f] == null)) continue
      const clash = this.table(model).find((r) =>
        r.id !== excludeId && fields.every((f) => same(r[f], candidate[f])))
      if (clash) throw p2002(model, fields)
    }
  }

  _normaliseWhere(where) {
    if (!where) return {}
    const out = {}
    for (const [k, v] of Object.entries(where)) {
      // compound unique selector `{ userId_productId: { userId, productId } }`
      if (k.includes("_") && isPlainObject(v) && !["AND", "OR", "NOT"].includes(k)
          && Object.keys(v).length > 0
          && Object.keys(v).every((f) => k.split("_").includes(f))) {
        Object.assign(out, v)
      } else {
        out[k] = v
      }
    }
    return out
  }

  _matches(model, row, where) {
    where = this._normaliseWhere(where)
    for (const [k, cond] of Object.entries(where)) {
      if (cond === undefined) continue
      if (k === "AND") { const list = Array.isArray(cond) ? cond : [cond]; if (!list.every((w) => this._matches(model, row, w))) return false; continue }
      if (k === "OR")  { const list = Array.isArray(cond) ? cond : [cond]; if (!list.some((w) => this._matches(model, row, w))) return false; continue }
      if (k === "NOT") { const list = Array.isArray(cond) ? cond : [cond]; if (list.some((w) => this._matches(model, row, w))) return false; continue }
      const rel = (RELATIONS[model] || {})[k]
      if (rel) {
        const related = this._related(model, row, k)
        if (cond === null) { if (related != null && !(Array.isArray(related) && related.length === 0)) return false; continue }
        if (cond.some)  { if (!(related || []).some((r) => this._matches(rel.model, r, cond.some))) return false; continue }
        if (cond.every) { if (!(related || []).every((r) => this._matches(rel.model, r, cond.every))) return false; continue }
        if (cond.none)  { if ((related || []).some((r) => this._matches(rel.model, r, cond.none))) return false; continue }
        const sub = cond.is || cond
        if (!related || !this._matches(rel.model, related, sub)) return false
        continue
      }
      if (!matchField(row[k], cond)) return false
    }
    return true
  }

  _related(model, row, relName) {
    const rel = RELATIONS[model][relName]
    if (rel.localKey) {
      const fkVal = row[rel.localKey]
      if (fkVal == null) return null
      return this.table(rel.model).find((r) => same(r.id, fkVal)) || null
    }
    const rows = this.table(rel.model).filter((r) => same(r[rel.fk], row.id))
    return rel.many ? rows : rows[0] || null
  }

  _sort(rows, orderBy) {
    if (!orderBy) return rows
    const list = Array.isArray(orderBy) ? orderBy : [orderBy]
    return [...rows].sort((a, b) => {
      for (const o of list) {
        const [field, dir] = Object.entries(o)[0]
        const c = cmp(a[field], b[field])
        if (c !== 0) return dir === "desc" ? -c : c
      }
      return 0
    })
  }

  _project(model, row, args = {}) {
    if (!row) return null
    const rels = RELATIONS[model] || {}
    let out
    if (args.select) {
      out = {}
      for (const [k, v] of Object.entries(args.select)) {
        if (!v) continue
        if (rels[k]) out[k] = this._projectRelation(model, row, k, v)
        else if (k === "_count") out._count = this._count(model, row, v)
        else out[k] = row[k]
      }
      return out
    }
    out = { ...row }
    for (const [k, v] of Object.entries(args.include || {})) {
      if (!v) continue
      if (k === "_count") { out._count = this._count(model, row, v); continue }
      if (rels[k]) out[k] = this._projectRelation(model, row, k, v)
    }
    return out
  }

  _count(model, row, spec) {
    const out = {}
    for (const k of Object.keys(spec.select || {})) {
      const related = RELATIONS[model]?.[k] ? this._related(model, row, k) : []
      out[k] = Array.isArray(related) ? related.length : related ? 1 : 0
    }
    return out
  }

  _projectRelation(model, row, relName, spec) {
    const rel = RELATIONS[model][relName]
    const args = isPlainObject(spec) ? spec : {}
    const related = this._related(model, row, relName)
    if (rel.many) {
      let list = related.filter((r) => !args.where || this._matches(rel.model, r, args.where))
      list = this._sort(list, args.orderBy)
      if (args.skip) list = list.slice(args.skip)
      if (args.take != null) list = list.slice(0, args.take)
      return list.map((r) => this._project(rel.model, r, args))
    }
    return this._project(rel.model, related, args)
  }

  _applyUpdate(model, row, data) {
    const rels = RELATIONS[model] || {}
    const next = { ...row }
    for (const [k, v] of Object.entries(data || {})) {
      const rel = rels[k]
      if (rel && isPlainObject(v)) {
        if (v.connect && rel.localKey) next[rel.localKey] = v.connect.id
        else if (v.disconnect && rel.localKey) next[rel.localKey] = null
        else if (v.create) {
          const items = Array.isArray(v.create) ? v.create : [v.create]
          for (const item of items) this.table(rel.model).push(this._materialise(rel.model, { ...item, [rel.fk]: row.id }))
        }
        continue
      }
      if (isPlainObject(v) && ("increment" in v || "decrement" in v || "set" in v || "multiply" in v)) {
        if ("increment" in v) next[k] = Number(row[k] || 0) + Number(v.increment)
        else if ("decrement" in v) next[k] = Number(row[k] || 0) - Number(v.decrement)
        else if ("multiply" in v) next[k] = Number(row[k] || 0) * Number(v.multiply)
        else next[k] = v.set
        continue
      }
      next[k] = v
    }
    next.updatedAt = new Date()
    return next
  }

  async _yield() { await new Promise((r) => setImmediate(r)) }

  _delegate(model) {
    const self = this
    const t = () => self.table(model)
    const record = (op, args) => self.log.push({ model, op, args })

    return {
      async findUnique(args = {}) {
        record("findUnique", args); await self._yield()
        const row = t().find((r) => self._matches(model, r, args.where))
        return self._project(model, row, args)
      },
      async findUniqueOrThrow(args = {}) {
        const r = await this.findUnique(args)
        if (!r) throw p2025(model)
        return r
      },
      async findFirst(args = {}) {
        record("findFirst", args); await self._yield()
        const rows = self._sort(t().filter((r) => self._matches(model, r, args.where)), args.orderBy)
        return self._project(model, rows[args.skip || 0], args)
      },
      async findFirstOrThrow(args = {}) {
        const r = await this.findFirst(args)
        if (!r) throw p2025(model)
        return r
      },
      async findMany(args = {}) {
        record("findMany", args); await self._yield()
        let rows = self._sort(t().filter((r) => self._matches(model, r, args.where)), args.orderBy)
        if (args.skip) rows = rows.slice(args.skip)
        if (args.take != null) rows = rows.slice(0, args.take)
        return rows.map((r) => self._project(model, r, args))
      },
      async count(args = {}) {
        record("count", args); await self._yield()
        return t().filter((r) => self._matches(model, r, args.where)).length
      },
      async aggregate(args = {}) {
        record("aggregate", args); await self._yield()
        const rows = t().filter((r) => self._matches(model, r, args.where))
        const out = {}
        if (args._count) out._count = rows.length
        if (args._sum) {
          out._sum = {}
          for (const f of Object.keys(args._sum)) out._sum[f] = rows.reduce((s, r) => s + Number(r[f] || 0), 0)
        }
        return out
      },
      async create(args = {}) {
        record("create", args); await self._yield()
        // Check the parent's uniques BEFORE materialising (materialise also
        // writes nested children, which must not leak on a P2002).
        const rels = RELATIONS[model] || {}
        const probe = {}
        for (const [k, v] of Object.entries(args.data || {})) {
          if (rels[k] && isPlainObject(v)) { if (v.connect && rels[k].localKey) probe[rels[k].localKey] = v.connect.id; continue }
          probe[k] = v
        }
        self._checkUnique(model, probe)
        const row = self._materialise(model, args.data)
        t().push(row)
        return self._project(model, row, args)
      },
      async createMany(args = {}) {
        record("createMany", args); await self._yield()
        const items = Array.isArray(args.data) ? args.data : [args.data]
        let count = 0
        for (const item of items) {
          try { self._checkUnique(model, item) } catch (e) { if (args.skipDuplicates) continue; throw e }
          t().push(self._materialise(model, item)); count += 1
        }
        return { count }
      },
      async update(args = {}) {
        record("update", args); await self._yield()
        const idx = t().findIndex((r) => self._matches(model, r, args.where))
        if (idx === -1) throw p2025(model)
        const next = self._applyUpdate(model, t()[idx], args.data)
        self._checkUnique(model, next, next.id)
        t()[idx] = next
        return self._project(model, next, args)
      },
      async updateMany(args = {}) {
        record("updateMany", args); await self._yield()
        let count = 0
        const rows = t()
        for (let i = 0; i < rows.length; i += 1) {
          if (self._matches(model, rows[i], args.where)) {
            rows[i] = self._applyUpdate(model, rows[i], args.data); count += 1
          }
        }
        return { count }
      },
      async upsert(args = {}) {
        record("upsert", args); await self._yield()
        const idx = t().findIndex((r) => self._matches(model, r, args.where))
        if (idx === -1) return this.create({ data: args.create, include: args.include, select: args.select })
        return this.update({ where: args.where, data: args.update, include: args.include, select: args.select })
      },
      async delete(args = {}) {
        record("delete", args); await self._yield()
        const idx = t().findIndex((r) => self._matches(model, r, args.where))
        if (idx === -1) throw p2025(model)
        const [row] = t().splice(idx, 1)
        return self._project(model, row, args)
      },
      async deleteMany(args = {}) {
        record("deleteMany", args); await self._yield()
        const before = t().length
        const kept = t().filter((r) => !self._matches(model, r, args.where))
        self.tables.set(model, kept)
        return { count: before - kept.length }
      },
    }
  }
}

function createFakePrisma() { return new FakePrisma() }

module.exports = { createFakePrisma, FakePrisma, RELATIONS, UNIQUES, p2002 }
