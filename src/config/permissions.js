// @ts-check
/**
 * permissions.js · canonical admin permission catalogue
 *
 * Every fine-grained admin capability the platform supports is listed here.
 * - Seed (prisma/seed-permissions.js) syncs this list into the
 *   AdminPermission table.
 * - Middleware (requirePermission) checks that the authenticated user's
 *   role(s) carry one of these keys.
 *
 * Naming convention: `domain:action` — "review:moderate", "user:suspend".
 * Keep keys stable; add new entries, do not rename old ones.
 */

const PERMISSIONS = Object.freeze({
  // Catalog
  PRODUCT_CREATE:        { key: "product:create",        label: "Create products" },
  PRODUCT_UPDATE:        { key: "product:update",        label: "Update products" },
  PRODUCT_DELETE:        { key: "product:delete",        label: "Delete products" },
  CATEGORY_MANAGE:       { key: "category:manage",       label: "Manage categories" },
  COUPON_MANAGE:         { key: "coupon:manage",         label: "Manage coupons" },

  // Commerce
  ORDER_VIEW:            { key: "order:view",            label: "View orders" },
  ORDER_FULFILL:         { key: "order:fulfill",         label: "Fulfil orders" },
  ORDER_REFUND:          { key: "order:refund",          label: "Issue refunds" },
  PAYMENT_VIEW:          { key: "payment:view",          label: "View payments" },
  DOWNLOAD_VIEW:         { key: "download:view",         label: "View downloads" },

  // Reviews & content
  REVIEW_MODERATE:       { key: "review:moderate",       label: "Moderate reviews" },
  REVIEW_DELETE:         { key: "review:delete",         label: "Delete reviews" },
  RECOMMENDATION_MANAGE: { key: "recommendation:manage", label: "Manage recommendations" },
  PORTFOLIO_MANAGE:      { key: "portfolio:manage",      label: "Manage portfolio" },
  BLOG_MANAGE:           { key: "blog:manage",           label: "Manage blog posts" },
  BIO_MANAGE:            { key: "bio:manage",            label: "Manage bio (experience, skills, certs)" },

  // Services & projects
  SERVICE_MANAGE:        { key: "service:manage",        label: "Manage service catalogue" },
  SERVICE_ORDER_MANAGE:  { key: "service_order:manage",  label: "Manage service orders" },
  CONSULTATION_MANAGE:   { key: "consultation:manage",   label: "Manage consultations" },
  AVAILABILITY_MANAGE:   { key: "availability:manage",   label: "Manage availability" },
  CLIENT_PROJECT_MANAGE: { key: "client_project:manage", label: "Manage client projects" },

  // Users & access
  USER_VIEW:             { key: "user:view",             label: "View users" },
  USER_SUSPEND:          { key: "user:suspend",          label: "Suspend / restore users" },
  ROLE_MANAGE:           { key: "role:manage",           label: "Create / edit roles & permissions" },
  SESSION_REVOKE:        { key: "session:revoke",        label: "Revoke sessions" },

  // Communication
  CONTACT_VIEW:          { key: "contact:view",          label: "View contact messages" },
  SUPPORT_MANAGE:        { key: "support:manage",        label: "Manage support tickets" },
  NEWSLETTER_MANAGE:     { key: "newsletter:manage",     label: "Manage newsletter" },
  EMAIL_TEMPLATE_MANAGE: { key: "email_template:manage", label: "Manage email templates" },
  CAMPAIGN_MANAGE:       { key: "campaign:manage",       label: "Manage marketing campaigns" },

  // System
  PAGE_MANAGE:           { key: "page:manage",           label: "Manage CMS pages" },
  MEDIA_MANAGE:          { key: "media:manage",          label: "Manage media library" },
  ANALYTICS_VIEW:        { key: "analytics:view",        label: "View analytics" },
  AUDIT_VIEW:            { key: "audit:view",            label: "View audit log" },
})

// Flat list of all keys — convenient for seeders and validators.
const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS).map((p) => p.key)
const ALL_PERMISSIONS     = Object.values(PERMISSIONS)

module.exports = { PERMISSIONS, ALL_PERMISSION_KEYS, ALL_PERMISSIONS }
