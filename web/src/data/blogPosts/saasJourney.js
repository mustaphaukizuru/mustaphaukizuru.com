import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "shipping-mustaphaukizuru-com-from-zero-to-saas",
  title: "From zero to SaaS: shipping mustaphaukizuru.com end to end",
  excerpt:
    "How a personal portfolio became a full-stack SaaS platform, store, services, payments, admin CMS, and dashboards, all on a Hostinger VPS.",
  category: "product-updates",
  tags: ["React", "Express", "Prisma", "Hostinger", "MercadoPago"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-04-22T09:00:00Z",
  readMinutes: 9,
  cover: null,
  featured: true,
  body: [
    { type: "takeaways", title: "What you'll learn", items: [
      "How a single Hostinger VPS runs a full-stack SaaS with payments, auth, and an admin CMS.",
      "Why Prisma + MySQL beats Postgres-on-cloud for a solo-operated product at this scale.",
      "The three architectural decisions I'd make differently starting over today.",
    ]},
    { type: "p", text: "What started as a one-page portfolio quietly turned into a full SaaS platform. Today **mustaphaukizuru.com** runs an e-commerce store, consulting service orders, a member dashboard, an admin CMS, MercadoPago + PayPal payments, JWT auth, support tickets, and a newsletter, on a single Hostinger VPS, deployed from `git push`." },
    { type: "p", text: "This post is the honest tour: what's in production, what I'd do differently, and what's still on the runway." },

    { type: "h2", text: "The stack, and why" },
    { type: "p", text: "I picked the boring, productive parts of the JavaScript ecosystem on purpose. Vite + React 18 on the frontend, Express + Prisma on the backend, MySQL on Hostinger, JWT for auth, Helmet + CORS for hardening. Tailwind handles the design system; Framer Motion drives every animation. There is no Next.js, no Redis (yet), no microservices." },
    { type: "p", text: "The Tailwind + Framer + Lucide trio is the secret sauce, three libraries that compose so cleanly the design language stays coherent across 60+ pages with zero CSS files." },

    { type: "h2", text: "What's actually live" },
    { type: "list", items: [
      "**Public surfaces**, Home, About, Services, Solutions, Store, Product detail, Contact, Blog, Recommendations, plus the legal trio (Terms, Privacy, Refund, Cookies).",
      "**Member dashboard**, profile, addresses, orders, downloads, consultations, projects with milestones, support tickets, wishlist, 2FA.",
      "**Admin CMS**, products, orders, payments, users, services, service orders, support, pages, email templates, media library, audit log, analytics.",
      "**Payments**, MercadoPago for LATAM, PayPal for international, both with webhook verification and idempotent order finalization.",
    ] },

    { type: "h2", text: "The hardest decision" },
    { type: "p", text: "Choosing **Prisma + MySQL on shared-style hosting** over the comfortable cloud path. Hostinger blocks shadow-database creation, which means `prisma migrate dev` doesn't work, every schema change goes through `prisma db push`. That trade is fine for a solo product but it forces discipline: no destructive changes without a backup." },
    { type: "callout", variant: "info", title: "Lesson", text: "Hosting constraints are features. The Hostinger budget is what made me trim every dependency, ship a single-binary backend, and treat the VPS like a Unix box, not a black box." },

    { type: "h2", text: "What's still on the runway" },
    { type: "ordered", items: [
      "Harden MercadoPago + PayPal webhook flows against retries and partial captures.",
      "Ship the consulting booking + service-order flow end to end (calendar, deposit, kickoff email).",
      "Wire the BlogPost backend so this very page reads from the API instead of a static data file.",
      "Move toward Core Web Vitals greens, the one place I haven't yet earned the green badge.",
      "Finish the bilingual public-page rollout — EN/ES tabs on Home, Solutions, and Services have shipped; About is the last large page on the queue.",
    ] },

    { type: "p", text: "The point of this whole project was never to ship perfect software. It was to **own every layer** so that when a school asks how something works, I can answer from first principles. Six months in, that part is paying off." },
  ],
}
