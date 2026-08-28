// Spanish locale bundle · I18N01
//
// PERF · This module is ONLY ever reached through a dynamic `import()` in
// `resources.js`, so Rollup emits it (and the 16 JSON files it pulls in) as
// a standalone chunk. Never import it statically from application code —
// doing so would drag ~150 KB of Spanish JSON back into the entry bundle.
//
// Add a new namespace here AND in resources.en.js AND in NAMESPACES
// (resources.js) when you create the corresponding JSON file.

import common from "./locales/es/common.json"
import home from "./locales/es/home.json"
import about from "./locales/es/about.json"
import services from "./locales/es/services.json"
import store from "./locales/es/store.json"
import product from "./locales/es/product.json"
import cart from "./locales/es/cart.json"
import checkout from "./locales/es/checkout.json"
import auth from "./locales/es/auth.json"
import dashboard from "./locales/es/dashboard.json"
import admin from "./locales/es/admin.json"
import contact from "./locales/es/contact.json"
import portfolio from "./locales/es/portfolio.json"
import legal from "./locales/es/legal.json"
import errors from "./locales/es/errors.json"
import blog from "./locales/es/blog.json"
import audit from "./locales/es/audit.json"

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
  dashboard,
  admin,
  contact,
  portfolio,
  legal,
  errors,
  blog,
  audit,
}
