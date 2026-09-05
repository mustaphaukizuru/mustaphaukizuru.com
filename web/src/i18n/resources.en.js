// English locale bundle · I18N01
//
// PERF · This module is ONLY ever reached through a dynamic `import()` in
// `resources.js`, so Rollup emits it (and the 16 JSON files it pulls in) as
// a standalone chunk. Never import it statically from application code —
// doing so would drag ~150 KB of English JSON back into the entry bundle.
//
// `audit` and `dashboard` are deliberately absent: both are route-scoped
// and loaded by ensureNamespace() when their route mounts
// (LAZY_NAMESPACES in resources.js). Adding either back puts it on every
// page's critical path — 6.6 KB for audit, 50 KB for dashboard.
//
// Add a new namespace here AND in resources.es.js AND in NAMESPACES
// (resources.js) when you create the corresponding JSON file.

import common from "./locales/en/common.json"
import home from "./locales/en/home.json"
import about from "./locales/en/about.json"
import services from "./locales/en/services.json"
import store from "./locales/en/store.json"
import product from "./locales/en/product.json"
import cart from "./locales/en/cart.json"
import checkout from "./locales/en/checkout.json"
import auth from "./locales/en/auth.json"
import admin from "./locales/en/admin.json"
import contact from "./locales/en/contact.json"
import portfolio from "./locales/en/portfolio.json"
import legal from "./locales/en/legal.json"
import errors from "./locales/en/errors.json"
import blog from "./locales/en/blog.json"
import schools from "./locales/en/schools.json"

export default {
  common,
  home,
  about,
  services,
  store,
  product,
  cart,
  checkout,
  auth,
  admin,
  contact,
  portfolio,
  legal,
  errors,
  blog,
  schools,
}
