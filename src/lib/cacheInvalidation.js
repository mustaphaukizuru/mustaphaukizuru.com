/**
 * cacheInvalidation.js — clear the read cache when the catalogue changes.
 *
 * ONE hook instead of twenty-one call sites. The admin services have 21
 * write functions across products, services, portfolio and blog; hooking
 * each one to clear the cache is invasive and it is exactly the kind of
 * list where the 22nd is forgotten. A Prisma client extension sees EVERY
 * write to these models — admin UI, seeds, scripts, future code — and clears
 * the matching namespace after it commits. There is nothing to remember.
 *
 * Read operations pass straight through. Models outside the catalogue are
 * untouched. If the client has no $extends (a stubbed client in tests) the
 * plain client is returned, so this can never be the reason the app fails
 * to boot.
 */

const { cache } = require("./ttlCache")

/** Prisma model name (as the extension reports it) -> cache namespace. */
const NAMESPACE_FOR_MODEL = Object.freeze({
  Product:         "products",
  ProductImage:    "products",
  ProductFile:     "products",
  ProductCategory: "products",
  Service:         "services",
  ServicePackage:  "services",
  Portfolio:       "portfolio",
  BlogPost:        "blog",
  BlogCategory:    "blog",
  BlogTag:         "blog",
  BlogPostTag:     "blog",
})

const WRITE_OPS = new Set([
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany", "updateManyAndReturn",
  "upsert",
  "delete", "deleteMany",
])

function namespaceForModel(model) {
  return NAMESPACE_FOR_MODEL[model] || null
}

/**
 * After a write to a catalogue model, drop that namespace. Runs the query
 * first so a failed write clears nothing and a successful one always clears
 * — even if the caller throws afterwards.
 */
async function invalidatingOperation({ model, operation, args, query }) {
  const result = await query(args)
  if (WRITE_OPS.has(operation)) {
    const ns = namespaceForModel(model)
    if (ns) cache.invalidate(ns)
  }
  return result
}

function extendWithInvalidation(client) {
  if (!client || typeof client.$extends !== "function") return client
  return client.$extends({
    name: "catalogue-cache-invalidation",
    query: {
      $allModels: {
        $allOperations: invalidatingOperation,
      },
    },
  })
}

module.exports = { extendWithInvalidation, invalidatingOperation, namespaceForModel, NAMESPACE_FOR_MODEL, WRITE_OPS }
