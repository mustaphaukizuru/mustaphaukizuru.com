═══════════════════════════════════════════════════════════════════════════════
PROJECT DESCRIPTION
mustaphaukizuru.com — Full-Stack SaaS Platform
v3.0 · May 2026 · Supersedes v2.0 (April 2026)
═══════════════════════════════════════════════════════════════════════════════

ROLE: You are a senior full-stack engineer, product architect, and UI/UX
collaborator working exclusively on the mustaphaukizuru.com — Full-Stack SaaS
Platform. The uploaded project ZIP is the absolute source of truth for
architecture, naming, patterns, and implementation decisions. Reference
existing code before any technical decision. Continue from where the project
is — never restart, never propose rewriting the stack.

═══════════════════════════════════════
§ 01 · WHAT THIS PROJECT ACTUALLY IS
═══════════════════════════════════════
The mustaphaukizuru.com — Full-Stack SaaS Platform is NOT a portfolio. It is
a production-grade, multi-surface SaaS platform and personal brand hub in
active development, hosted on Hostinger Business Web Hosting with auto-deploy
from GitHub master. It serves as Mustapha Ukizuru's professional brand
headquarters and primary revenue vehicle.

The platform unifies eight distinct surfaces under a single Node.js + React
monolith:

  — Personal brand & professional identity hub
  — Digital products store (cart, checkout, orders, secure downloads)
  — Consulting services platform (service orders, consultations)
  — Client project management (milestones, files, timelines)
  — Member dashboard (profile, downloads, orders, support)
  — Admin control panel (full CMS and business operations)
  — Support ticket system (member ↔ admin)
  — Newsletter, notifications, and SEO-optimized public website

Owner:        Mustapha Ukizuru
              IT Manager · Full-Stack Developer · CS Educator · Tech Consultant
              Tlalnepantla de Baz, Estado de México, Mexico
Brand:        Technology Consulting · Digital Products · STEM & School Solutions
Mantra:       Complexity, simplified.
Sub-tagline:  Build it. Simplify it. Scale it.
Live URL:     https://mustaphaukizuru.com
Repository:   D:\mustaphaukizuru-repo (local) · github.com/mustaphaukizuru
Hosting:      Hostinger Business Web Hosting (Node.js 22.x · MySQL)
Deployment:   GitHub master → Hostinger auto-deploy

═══════════════════════════════════════
§ 02 · STRATEGIC POSITIONING
═══════════════════════════════════════
Dimension          Description
─────────────────  ──────────────────────────────────────────────────────────
Brand Promise      Technology Consulting · Digital Products · STEM Solutions
Primary Markets    LATAM (MercadoPago) · International (PayPal)
Languages          English (primary) · Spanish (planned · § 11) · Turkish ·
                   Kinyarwanda (founder languages, marketing-only)
Revenue Streams    Digital products · Service orders · Project retainers ·
                   Future newsletter monetization
Differentiator     Engineer-operator-educator triple stack delivered from
                   Mexico with global reach; bilingual EN/ES delivery
Audiences          (1) Prospective clients evaluating consulting services
                   (2) Customers purchasing digital products
                   (3) Active clients tracking project delivery
                   (4) Administrator operating the entire business

═══════════════════════════════════════
§ 03 · CONFIRMED TECHNOLOGY STACK
═══════════════════════════════════════
THIS IS THE EXACT STACK — never assume Django, PostgreSQL, GCP, or Stripe.

Backend:      Node.js 22.x + Express.js (src/app.js, src/server.js)
⚠️  AMENDED 4 Sep 2026 (T2-7). The list below is read from package.json, not
    from memory. What it used to say and no longer does: React 18 (it is 19),
    "Vite" and "Tailwind CSS" without versions (7 and 4 — Tailwind 4 is a
    different configuration model, @theme in CSS rather than a JS config), and
    `axios`, which is not a dependency of web/ at all. Every API call goes
    through web/src/lib/api.js on the platform fetch.

Frontend:     React 19 + Vite 7 + Tailwind v4 + Framer Motion 12 + Lucide React
ORM:          Prisma (schema.prisma — MySQL provider)
Database:     MySQL — hosted on Hostinger
              ⚠️  Use `prisma db push` NOT `prisma migrate dev`
              (Hostinger blocks shadow database creation)
Auth:         JWT (jsonwebtoken + bcryptjs) + Google OAuth
              (google-auth-library)
Payments:     MercadoPago (primary — LATAM) + PayPal (international)
              ⛔ Stripe has been REMOVED — never propose it
Email:        Nodemailer via SMTP
Hosting:      Hostinger Business Web Hosting (NOT GCP, NOT AWS)
Build:        Vite builds React → /public, served by Express as static
Security:     Helmet.js + CORS + JWT middleware + rate limiting + compression
Logging:      Morgan + AdminAuditLog model + ActivityLog model
Compression:  compression middleware (gzip level 6)

Frontend dependencies (confirmed in package.json):
  react-router-dom · framer-motion · lucide-react · tailwindcss ·
  @tailwindcss/vite · @vitejs/plugin-react · react-i18next

Brand fonts (load self-hosted .woff2 in production · Google Fonts CDN in dev):
  Sora           — display + body (300 · 400 · 500 · 600 · 700 · 800)
  JetBrains Mono — code, prices, metrics, timestamps, labels (400 · 500 · 600)

⛔ All animations use Framer Motion — no CSS-only animation libraries
⛔ All icons use Lucide React — no other icon libraries
⛔ All API calls go through web/src/lib/api.js — never raw fetch in components
⛔ No ad-hoc hex colors — every color resolves through the v3.0 token system (§ 06)

═══════════════════════════════════════
§ 04 · SYSTEM ARCHITECTURE — HIGH LEVEL
═══════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────┐
  │                       BROWSER (React 19 SPA)                        │
  │  Vite-built bundle · Tailwind tokens · Framer Motion · Lucide       │
  │  Router: react-router-dom 7 · HTTP: fetch via web/src/lib/api.js    │
  │  State: component + CartContext · SEO: Seo.jsx + pageSeo.js         │
  └────────────────────────────────┬────────────────────────────────────┘
                                   │ HTTPS
  ┌────────────────────────────────▼────────────────────────────────────┐
  │                    EXPRESS APPLICATION (Node 22.x)                  │
  │  app.js · helmet · cors · compression · morgan · rate-limit         │
  │  Static serve /public · BigInt serializer · authMiddleware          │
  │  ──────────────────────────────────────────────────────────────     │
  │  Controllers (HTTP) → Services (business logic) → Prisma Client     │
  └──┬──────────────┬──────────────┬──────────────┬────────────────┬────┘
     │              │              │              │                │
     ▼              ▼              ▼              ▼                ▼
  ┌──────┐    ┌─────────┐    ┌──────────┐   ┌─────────┐     ┌──────────┐
  │MySQL │    │MercadoPago    │ PayPal  │   │SMTP/Mail│     │ Google   │
  │(Prisma)   │  REST   │    │  REST   │    │ Nodemailer    │  OAuth   │
  └──────┘    └─────────┘    └──────────┘   └─────────┘     └──────────┘

  Webhooks → /api/mercadopago, /api/paypal → PaymentWebhook persistence
  File uploads → multer → MediaLibrary records → served from /public/uploads

─────────────────────────────────────────────────────────────────────────
DEPLOYMENT TOPOLOGY
─────────────────────────────────────────────────────────────────────────
  Developer  →  D:\mustaphaukizuru-repo  →  git push origin feature/*
                                          │
                                          ▼
                               GitHub Pull Request
                                          │
                              Squash-merge to master
                                          │
                                          ▼
                              Hostinger Git Auto-Deploy
                                          │
                                          ▼
                       Express boots · serves /public + /api
                                          │
                                          ▼
                              https://mustaphaukizuru.com

═══════════════════════════════════════
§ 05 · FULL DATA MODEL — 71 PRISMA MODELS
═══════════════════════════════════════
Always check schema.prisma before any database or API work.
Reconciled against live schema 2026-05-09 — supersedes the legacy
"44 confirmed" / "48 named" figures from earlier docs.

AUTH · USERS · ROLES (11):
  User · UserProfile · Address · AuthOtp · PasswordReset · Session ·
  TwoFactorAuth · Role · UserRole · AdminPermission · RolePermission

PRODUCTS & STORE (9):
  ProductCategory · Product · ProductFeature · ProductFile ·
  ProductImage · ProductTag · ProductTagMap · Wishlist · WishlistItem

SERVICES & CONSULTING (11):
  Service · ServiceFeature · ServicePackage · PackageFeatureSlot ·
  ServiceOrder · Consultation · ClientProject · ProjectMilestone ·
  ProjectFile · AvailabilityRule · AvailabilityException

COMMERCE (12):
  Cart · CartItem · Coupon · CouponUsage · Order · OrderItem ·
  Invoice · Payment · PaymentWebhook · Refund · UserDownload · DownloadLog

REVIEWS (2):
  Review · ReviewVote

COMMUNICATION & SUPPORT (7):
  SupportTicket · SupportMessage · ContactMessage ·
  NewsletterSubscriber · Notification · EmailTemplate · EmailLog

EMAIL CAMPAIGNS (2):
  EmailCampaign · EmailCampaignRecipient

BLOG (4):
  BlogPost · BlogCategory · BlogTag · BlogTagMap

PORTFOLIO & PROFILE (6):
  Portfolio · Education · Experience · Skill · Certificate · Recommendation

ANALYTICS (3):
  AnalyticsEvent · PageView · DailyMetric

CMS & SYSTEM (4):
  Page · MediaLibrary · ActivityLog · AdminAuditLog

  Total: 71 named Prisma models, verified by direct count of
  `^model ` declarations in prisma/schema.prisma on 2026-05-09.

═══════════════════════════════════════
§ 06 · BRAND IDENTITY SYSTEM v3.0  ⚠ AUTHORITATIVE
═══════════════════════════════════════
⚠️  The pre-v3.0 palette (#420060 purple · #634F40 warm neutral) is RETIRED.
    Any code, copy, or asset still referencing those values is legacy and
    must be migrated. The full canonical specification lives in the
    companion document "MUSTAPHA UKIZURU — Brand Identity System v3.0".
    Section 06 below is the operational summary.

────────────────────────────────────────────────────
TIER 1 · BRAND ANCHORS
────────────────────────────────────────────────────
  Midnight Charcoal  #1A1B23   --u-charcoal     Dominant — text, headings,
                                                footer bg, inactive icons
  Cloud Mist         #F8FAFC   --u-mist         Canvas — page bg, card bg
  Royal Violet       #5D3FD3   --u-violet       Brand Anchor — active nav,
                                                primary icons, ghost borders
  Violet Light       #8B6FE8   --u-violet-lt    Violet text on dark surfaces
  Violet Pale        #EDE9FB   --u-violet-pale  Callout bg, eyebrow chips

────────────────────────────────────────────────────
TIER 2 · ACTION
────────────────────────────────────────────────────
  Deep Azure         #0284C7   --u-azure        Interactive — text links,
                                                hover, secondary CTAs, info
  Azure Pale         #E0F2FE   --u-azure-pale   Focus rings, info banners
  Electric Cyan      #7DD3FC   --u-cyan         Accent — chart markers, glow,
                                                live indicators, "New" badges

────────────────────────────────────────────────────
TIER 3 · WARM ACCENT  (max 10% of any page surface)
────────────────────────────────────────────────────
  Soft Terracotta    #E9C46A   --u-terracotta   Humanity — underlines, ★ stars,
                                                "10+ Years" highlights,
                                                testimonials

────────────────────────────────────────────────────
TIER 4 · NEUTRAL SURFACES  (≈ 80% of UI surface area)
────────────────────────────────────────────────────
  Slate 100          #EFF1F5   --u-slate-100    Dashboard canvas, dividers
  Slate 200          #DCDCE4   --u-slate-200    Borders and dividers
  Slate Blue         #64748B   --u-steel        Secondary text, metadata
  White              #FFFFFF   --u-white        Elevated surfaces — modals

────────────────────────────────────────────────────
TIER 5 · SEMANTIC / FEEDBACK  (sacred to feedback states only)
────────────────────────────────────────────────────
  Neon Mint          #10B981   --u-mint         Success — verified, "In Stock"
  Amber Glow         #F59E0B   --u-amber        Warning — pending, low stock
  Rose Signal        #E11D48   --u-rose         Error — destructive, "Out of Stock"
  Info               #5D3FD3   --u-info         Informational (= Brand Anchor)

────────────────────────────────────────────────────
GRADIENT SYSTEM
────────────────────────────────────────────────────
⚠️  THE SACRED RULE: The Innovation Gradient is reserved for conversion only.
    Never use it for decoration, dividers, text backgrounds, or icon fills.
    It must appear EXACTLY ONCE per viewport, on the primary conversion CTA.

  Innovation  --u-grad-innovation
              linear-gradient(135deg, #5D3FD3, #0284C7)
              SACRED — Buy, Checkout, Contact only
  Dawn        linear-gradient(135deg, #5D3FD3, #0284C7 50%, #7DD3FC)
              Hero sections, premium surfaces, launch banners
  Electric    linear-gradient(135deg, #0284C7, #7DD3FC)
              Accent CTAs, live indicators, data highlights
  Mesh Aurora Multi-radial Violet, Azure, Cyan, Terracotta over Cloud Mist
              Hero backgrounds — single use per viewport
  Humanity    linear-gradient(135deg, #E9C46A, #F8FAFC)
              Testimonials, founder story, case study openers

────────────────────────────────────────────────────
TYPOGRAPHY · TYPE SCALE · MOTION
────────────────────────────────────────────────────
TYPE SCALE (Sora unless marked Mono):
  Hero    5.5rem · line 0.95 · track −2.5%   (one per page)
  H1      3.5rem · line 1.0  · track −2.5%
  H2      2.5rem · line 1.05 · track −2%
  H3      1.5rem · line 1.15 · track −1.5%
  H4      1.25rem · line 1.3 · track −1%
  Body L  1.125rem · line 1.65
  Body    1rem · line 1.65
  Small   0.875rem · line 1.55
  Mono    0.75rem · line 1.4 (JetBrains Mono with tabular-nums for KPIs)

MOTION TOKENS:
  --u-dur-fast      120ms   Micro-feedback: button press, toggle, checkbox
  --u-dur-base      220ms   Default state transitions: hover, focus, active
  --u-dur-slow      420ms   Panel slides, modal entrance, page transitions
  --u-ease-spring   cubic-bezier(0.34, 1.56, 0.64, 1)   Slight overshoot
  --u-ease-standard cubic-bezier(0.4, 0, 0.2, 1)        Material smooth

⚠️  Every animation MUST respect @media (prefers-reduced-motion: reduce).

────────────────────────────────────────────────────
COMPONENT VARIANTS · LVFHA ORDERING
────────────────────────────────────────────────────
BUTTONS:    Primary (Innovation Gradient · 1/viewport) · Secondary (Royal
            Violet) · Ghost (Violet border) · Default (Cloud Mist + shadow) ·
            Link (Deep Azure)
BADGES:     In Stock (Mint) · New (Azure) · Low Stock (Amber) ·
            Out of Stock (Rose) · ★ Rating (Terracotta)
FIELDS:     Resting (1.5px slate stroke) · Hover (Slate-300) ·
            Focus (Deep Azure + 4px blue-15% ring) · Error (Rose) ·
            Disabled (50% opacity)
LVFHA:      :link · :visited · :focus-visible · :hover · :active
            ("Love Visited Focus HoArd") · focus-visible ≥ 3:1 contrast

═══════════════════════════════════════
§ 07 · BRAND ASSET CATALOGUE
═══════════════════════════════════════
All brand assets ship under web/src/assets/brand/. Import via module —
never inline base64 or external CDN URLs.

LOGO — FULL WORDMARK
  mu-logo-charcoal.png   Primary · light mode · 3000×3000 with sub-tagline
  mu-logo-white.png      Inverse · ⚠ ASSET ISSUE — see § 14

  Sub-tagline baked into the lockup: "Build it. Simplify it. Scale it."
  Distinct from the brand mantra "Complexity, simplified." — do not
  re-typeset or remove either.

MONOGRAM — M-MARK (5 variants, all proper alpha)
  m-mark-charcoal.png    Default mark on light surfaces
  m-mark-violet.png      Brand anchor moments, hero accents, mobile menu
  m-mark-azure.png       Interactive contexts, link-heavy surfaces
  m-mark-terracotta.png  Humanity contexts, testimonials, founder story
  m-mark-white.png       Inverse on dark surfaces (proper alpha — works)

  Use when wordmark space < 120px. Min legible: 24px avatar / 16px favicon.

FAVICON SET
  web-app-manifest-512x512.png · web-app-manifest-192x192.png ·
  apple-touch-icon.png (180px) · favicon-96x96.png · favicon.svg ·
  favicon.ico · site.webmanifest

AVATAR
  avatar-master.png · avatar-{azure | charcoal | terracotta | violet | white}.png

LOGO USAGE RULES
  ✅ Keep the / separator: Azure on light, Peach on Indigo/gradient
  ✅ Preserve tight tracking (−2.5%) at every size
  ✅ Use the monogram alone when space is under 120px wide
  ✅ Give at least one U-height clearspace on all sides
  ⛔ Rotate, skew, outline, or drop-shadow the wordmark
  ⛔ Change separator color or replace with dot/hyphen
  ⛔ Place on low-contrast photography without an overlay
  ⛔ Introduce a second typeface inside the wordmark

═══════════════════════════════════════
§ 08 · CONFIRMED API SURFACE
═══════════════════════════════════════
Public:    /api/health · /api/products · /api/auth · /api/contact
Payments:  /api/paypal · /api/mercadopago
Member:    /api/downloads · /api/orders · /api/member/profile ·
           /api/member/notifications · /api/member/support
Admin:     /api/admin/dashboard · /api/admin/products · /api/admin/orders ·
           /api/admin/downloads · /api/admin/payments · /api/admin/categories ·
           /api/admin/users · /api/admin/support · /api/admin/pages ·
           /api/admin/email-templates · /api/admin/media ·
           /api/admin/service-orders · /api/admin/audit

⚠️  Stripe payment route is removed and commented out — do not reintroduce.
⚠️  All NEW endpoints follow the versioned /api/v1/[resource] pattern.
⚠️  Webhook endpoints use raw-body parsing — never JSON-body before signature
    verification (see PaymentWebhook model and signature validation flow).

═══════════════════════════════════════
§ 09 · CONFIRMED FRONTEND SURFACE
═══════════════════════════════════════
Public:   Home · About · Services · Solutions · Store · ProductDetail ·
          Contact · Privacy · Terms · Refund · NotFound · Error
Auth:     Login · Signup · ForgotPassword · ResetPassword
Member:   Cart · Checkout · CheckoutSuccess · Dashboard · DashboardProfile ·
          DashboardDownloads · DashboardOrders · DashboardSupport ·
          DashboardProducts · ProjectDetail
Admin:    AdminDashboard · AdminProducts (+ form) · AdminOrders ·
          AdminOrderDetail · AdminCategories · AdminDownloads · AdminUsers ·
          AdminPayments · AdminSupport · AdminServices · AdminPages ·
          AdminEmailTemplates · AdminMedia · AdminAudit
Layouts:  MainLayout · AdminLayout · DashboardLayout · AuthLayout ·
          PublicShell · Header · Footer

═══════════════════════════════════════
§ 10 · KNOWN STRUCTURAL ISSUES — FIX PRIORITY
═══════════════════════════════════════
⚠️  CRITICAL: Duplicated nested directories exist in the codebase:
    src/controllers/controllers/   (duplicate of src/controllers/)
    src/middleware/middleware/     (duplicate of src/middleware/)

Always work from the ROOT level files only:
  ✅  src/controllers/*.js
  ✅  src/middleware/*.js
  ⛔  Never reference or edit the nested duplicates

Flag this proactively whenever doing backend work.

═══════════════════════════════════════
§ 11 · ROADMAP — PHASED
═══════════════════════════════════════

────────────────────────────────────────────────────
PHASE 1 · STABILIZE & MIGRATE  (target: Q2 2026)
────────────────────────────────────────────────────
  1.  Delete duplicate src/controllers/controllers/ and src/middleware/middleware/
  2.  Migrate ALL legacy color references (#420060, #634F40, bg-[#ede4ef])
      to v3.0 brand tokens — single largest UI debt item
  3.  Reconcile Prisma model count (48 named here vs. "44 confirmed" legacy)
  4.  Stabilize all existing pages to v3.0 brand standard
  5.  Self-host Sora + JetBrains Mono variable fonts (.woff2) in production

────────────────────────────────────────────────────
PHASE 2 · COMMERCE & OPERATIONS  (target: Q3 2026)
────────────────────────────────────────────────────
  6.  Harden MercadoPago + PayPal flows — webhook reconciliation, idempotency,
      retry policy, refund automation
  7.  Complete Admin panel for full operational use (no DB direct access)
  8.  Complete email notification flows via Nodemailer using brand templates
      (Sora + JetBrains Mono · v3.0 tokens · responsive HTML email)
  9.  Launch Store publicly — digital products + downloads with entitlement
      enforcement

────────────────────────────────────────────────────
PHASE 3 · SERVICES & DELIVERY  (target: Q4 2026)
────────────────────────────────────────────────────
  10. Activate consulting services booking + service order flow
  11. Build client project management feature end-to-end (milestones, files)
  12. Implement full SEO strategy across public pages — JSON-LD, sitemap.xml,
      robots.txt, OpenGraph, Twitter cards, breadcrumbs
  13. Improve Core Web Vitals to meet § 13 performance targets
  14. Establish dark mode as a first-class theme alongside default light

────────────────────────────────────────────────────
PHASE 4 · SCALE & INTERNATIONALIZATION  (target: 2027)
────────────────────────────────────────────────────
  15. Add bilingual EN/ES content delivery (i18n routing, locale-aware SEO)
  16. Add comprehensive automated test coverage to critical flows
  17. Newsletter monetization activation (paid tiers, member-only content)
  18. Productize consulting offerings into packaged digital products

═══════════════════════════════════════
§ 12 · OBSERVABILITY & OPERATIONS
═══════════════════════════════════════

LOGGING
  Morgan (HTTP access logs) · console.* (structured server-side) ·
  AdminAuditLog (admin actions) · ActivityLog (user actions) ·
  EmailLog (Nodemailer dispatches) · DownloadLog (digital product fulfillment)

ERROR HANDLING
  Centralized errorHandler.js middleware · async/await + try/catch on every
  route · Prisma error mapping to user-safe responses · stack traces
  suppressed in production responses

WEBHOOK RECONCILIATION
  PaymentWebhook records every inbound payload · Payment ↔ Order linkage
  enforced at the service layer · refund flow updates Refund model and
  invalidates UserDownload entitlements

PERFORMANCE OBSERVATION
  Lighthouse CI (manual baseline · automation in Phase 3) · Web Vitals
  reported in browser via the "web-vitals" library (planned · Phase 3)

DISASTER RECOVERY
  Source: GitHub master is authoritative; local working copy is
  D:\mustaphaukizuru-repo. Recovery from local mid-edit corruption uses
  `git checkout HEAD -- <path>`.
  Database: Hostinger nightly snapshot retention (verify plan).
  Environment: All secrets in .env (never committed); rotate JWT secret
  triggers a forced session invalidation pass.
  AV truncation: Windows Defender has truncated files mid-edit. Mitigation
  is to add D:\mustaphaukizuru-repo to Defender exclusions and recover
  truncated files from local git history.
  Boot guards: Missing payment env vars trigger a "Refusing to start"
  forgery guard — local and production env vars must mirror each other.

═══════════════════════════════════════
§ 13 · PERFORMANCE & ACCESSIBILITY TARGETS
═══════════════════════════════════════

CORE WEB VITALS
  LCP          < 2.5s    Hero image preloaded · self-hosted variable fonts
                         with font-display: swap
  CLS          < 0.1     Explicit width/height on images · no above-fold
                         injection · skeletons reserve space
  INP          < 200ms   No blocking JS on main thread · React concurrent
  FCP          < 1.8s    Critical CSS inlined · async non-critical
  Lighthouse   ≥ 95      Performance · Accessibility · Best Practices · SEO
  Bundle size  < 150kB   gzip · tree-shaking · dynamic imports per route

ACCESSIBILITY · WCAG 2.1 AA MIN, AAA TARGET
  Color contrast       AA min, AAA target for body text and primary UI
  Focus states         3px Deep Azure offset ring on every interactive element
  Keyboard navigation  Tab order follows visual flow · modals trap focus ·
                       ESC dismisses overlays
  Screen readers       Descriptive alt text on non-decorative images ·
                       alt="" on decorative
  Touch targets        ≥ 44 × 44px on touch devices
  Reduced motion       Every animation honors prefers-reduced-motion
  Form labels          Every input has an associated <label>
  ARIA                 Used sparingly — only when native semantics fall short

═══════════════════════════════════════
§ 14 · KNOWN ASSET ISSUES TO TRACK
═══════════════════════════════════════
1. mu-logo-white.png lacks an alpha channel
   ImageMagick inspection confirms TrueColor (no alpha) — wordmark rendered
   in near-white tint (#F8FAFC) on opaque white background, making it
   invisible on dark surfaces. Workaround: use m-mark-white (proper alpha)
   inside a charcoal container until a corrected version ships.
   ACTION: Re-export from source with TrueColorAlpha + transparent background.

2. Social handle inconsistency on three platforms
   Facebook Page, Twitter/X, and Pinterest still use ukizurumustapha instead
   of @mustaphaukizuru. Consolidate when each platform allows handle changes.

3. Master's degree status — RESOLVED in v3.0
   Personal Preferences and Creator Profile previously diverged. Current
   confirmed status: "Strategic Management in Software Engineering —
   Universidad Europea del Atlántico · Expected June 2026." This single
   statement supersedes any earlier "Completed March 2026" reference.

═══════════════════════════════════════
§ 15 · RISK REGISTER
═══════════════════════════════════════
Risk                                           Mitigation
─────────────────────────────────────────────  ──────────────────────────────
Hostinger blocks `prisma migrate dev`          Mandate `prisma db push`;
                                               document in onboarding
Duplicate controllers/middleware nested dirs   Phase 1 Priority 1 cleanup;
                                               flag on every backend touch
Single-region MySQL latency for non-LATAM      Cache headers, CDN-fronted
                                               static assets, font preconnect
Dual-payment webhook reconciliation drift      PaymentWebhook + Payment
                                               models · idempotent handlers
JWT secret rotation                            Env-managed secrets · session
                                               invalidation strategy ready
Single-operator delivery capacity              Productize via Store ·
                                               templatize service packages
Windows Defender mid-edit truncation           Defender exclusion on
                                               D:\mustaphaukizuru-repo · git
                                               recovery via `git checkout`
Payment env var drift local ↔ prod             Mirror env vars; document new
                                               vars in PR description
Legacy palette regressions                     Phase 1 Priority 2 migration ·
                                               grep gate before merge

═══════════════════════════════════════
§ 16 · SUCCESS KPIs
═══════════════════════════════════════
The platform is operationally complete when ALL of the following hold true:

  ☐  All Phase 1–3 roadmap items are closed
  ☐  Payment success rate > 98% across both gateways with full webhook
     reconciliation
  ☐  Lighthouse scores ≥ 95 across all four categories on every public page
  ☐  Admin panel supports full business operations without direct DB access
  ☐  End-to-end purchase journey (browse → cart → checkout → payment →
     download) executes in under 60s on standard broadband
  ☐  Mean time to recover from a payment provider outage < 15 min via the
     secondary gateway
  ☐  Zero legacy palette references (#420060, #634F40, bg-[#ede4ef]) anywhere
     in src/** or web/src/**
  ☐  100% of API endpoints have explicit input validation, error handling,
     and rate limiting
  ☐  All public pages return 200 with valid JSON-LD structured data and
     correct OpenGraph metadata

═══════════════════════════════════════
§ 17 · COMPANION DOCUMENTS
═══════════════════════════════════════
The uploaded project ZIP is the single source of truth for all architecture,
naming conventions, patterns, and implementation decisions. Companion docs
are canonical for adjacent concerns:

  • PROJECT_INSTRUCTIONS v3.0           — operational rulebook for
                                          AI collaborators (this doc's
                                          authoritative pair)
  • Brand Identity System v3.0          — visual language, tokens, components
  • Creator Profile v1.0                — biographical & platform context
  • Personal Preferences v1.0           — AI operating standards

Always read and reference existing code before writing new code. Always
continue from where the project is — never restart, never propose
rewriting the stack.

═══════════════════════════════════════
§ 18 · DOCUMENT CHANGELOG
═══════════════════════════════════════
v3.0 · May 2026
  + Added § 02 · Strategic Positioning (markets, audiences, differentiator)
  + Added § 04 · System Architecture diagram (component + deployment topology)
  + Added § 11 · Phased roadmap (Phase 1–4 with quarterly targets)
  + Added § 12 · Observability & Operations (logging, DR, AV truncation,
                                              env-var boot guard)
  + Added § 15 · Risk Register
  + Added § 16 · Success KPIs (replaces ad-hoc closure criteria)
  + Resolved § 14 · Master's degree status discrepancy (Expected June 2026)
  + Documented Hostinger auto-deploy from GitHub master
  + Documented Node.js 22.x runtime
  + Reconciled "44 confirmed" Prisma models against schema (48 named here);
    reconciliation listed in Phase 1
  ~ Tightened cross-references with PROJECT_INSTRUCTIONS v3.0
  ~ Re-numbered sections § 01 – § 18 for stable cross-reference

v2.0 · April 2026
  + Brand Identity System v3.0 (tier 1–5 palette, gradients, typography,
    motion, LVFHA ordering)
  + Brand Asset Catalogue
  + Definition of Done checklist
  + Known Asset Issues
  ! BREAKING: Retired pre-v3.0 palette
  ~ Section numbering introduced

v1.0 · April 2026
  Initial project description.

═══════════════════════════════════════════════════════════════════════════════
The mustaphaukizuru.com — Full-Stack SaaS Platform represents Mustapha
Ukizuru's professional brand and primary revenue vehicle to the world.
Every decision must be worthy of that standard — technically excellent,
visually polished, and built to scale.

Complexity, simplified.
═══════════════════════════════════════════════════════════════════════════════
