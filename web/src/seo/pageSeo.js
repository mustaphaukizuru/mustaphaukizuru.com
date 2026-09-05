import { DEFAULT_OG_IMAGE, absoluteUrl, siteConfig, trimText } from "./siteSeo.js"
// Explicit extension: web/scripts/generate-og-static.mjs imports this module
// from Node, which does not resolve extensionless paths the way Vite does.
import { CATEGORIES } from "../data/servicesCatalogue.js"

/* ─────────────────────────────────────────────────────────────────────────
   STATIC ROUTE SEO — used by SeoRouteManager + each page's <Seo /> render.
   Titles target 55–60 characters (after the brand suffix appended by
   Seo.jsx), descriptions 150–160 characters. Brand identity v3.0.
───────────────────────────────────────────────────────────────────────── */
export const staticSeoByRoute = {
  "/": {
    title: "Technology Consulting · Digital Products · STEM Solutions",
    description:
      "Technology consulting, digital products, and STEM solutions for businesses and schools across Mexico and LATAM. Full-stack delivery, publication-ready.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
    keywords: [
      "technology consulting Mexico",
      "digital products store",
      "STEM education",
      "school IT transformation",
      "full-stack developer",
    ],
  },

  "/about": {
    title: "About Mustapha Ukizuru · Full-Stack Developer & IT Manager",
    description:
      "Meet Mustapha Ukizuru — Full-Stack Developer, IT Manager, CS Educator. 8+ years across Rwanda, Turkey, Ethiopia, and Mexico. Available for new projects.",
    type: "profile",
    image: absoluteUrl("/og/og-profile.png"),
    schemaType: "ProfilePage",
    keywords: [
      "Mustapha Ukizuru",
      "full-stack developer Mexico",
      "IT manager Mexico",
      "computer science educator",
      "tech consultant Rwanda Mexico",
    ],
  },

  "/services": {
    title: "Technology Services · IT Strategy · AI & Automation · Cloud · Product Engineering",
    description:
      "Four service lines, 20 services: IT strategy consulting, AI & workflow automation, cloud architecture & migration, and end-to-end digital product engineering for SMBs.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: [
      "IT consulting services Mexico",
      "fractional CTO",
      "AI automation consulting",
      "cloud migration consultant",
      "MVP development",
    ],
  },

  "/schools": {
    title: "School IT & STEM Solutions · Technology for Schools in Mexico",
    description:
      "IT strategy, admissions automation, backups and school platforms for K-12 schools in Mexico — from an IT manager who runs a school's technology every day.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
    keywords: [
      "school IT consultant Mexico",
      "school technology solutions",
      "STEM program planning",
      "school website admissions",
      "EdTech consultant Mexico",
    ],
  },

  "/services/it-strategy-consulting": {
    title: "IT Strategy Consulting · Software Audit · Fractional CTO · Compliance",
    description:
      "Software-stack audits, fractional CTO leadership, vendor evaluation and RFPs, digital-transformation roadmaps, and LFPDPPP compliance and risk assessment.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: ["IT strategy consulting", "fractional CTO Mexico", "software audit", "LFPDPPP compliance"],
  },

  "/services/ai-automation": {
    title: "AI Integration & Workflow Automation · Bots · RAG · WhatsApp Lead Qualifiers",
    description:
      "Custom LLM persona bots, WhatsApp lead qualifiers synced to your CRM, cross-platform API pipelines, private RAG knowledge bases, and document data-extraction workflows.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: ["AI automation consulting", "WhatsApp chatbot CRM", "RAG knowledge base", "Make Zapier integration"],
  },

  "/services/cloud-architecture-migration": {
    title: "Cloud Architecture & Migration · AWS · Azure · GCP · Docker · Zero Trust",
    description:
      "On-premise to cloud migration, cloud-bill optimisation, disaster-recovery planning, Docker containerisation, and zero-trust security hardening.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: ["cloud migration consultant", "AWS Azure GCP migration", "cloud cost optimisation", "Docker containerization"],
  },

  "/services/digital-product-engineering": {
    title: "Digital Product Engineering · UI/UX · MVP Web Apps · Mobile · APIs · CI/CD",
    description:
      "Interactive UI/UX wireframing, MVP web applications, cross-platform mobile apps, secure API design, CI/CD automation, and managed maintenance retainers.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: ["MVP development Mexico", "cross-platform mobile app", "API design", "CI/CD automation"],
  },

  "/store": {
    title: "Digital Products Store · Templates · Toolkits · STEM Resources",
    description:
      "Shop digital products: School AI Automation Kit, IT templates, coding resources, STEM materials. Instant download · PayPal · MercadoPago.",
    type: "website",
    image: absoluteUrl("/og/og-store.png"),
    schemaType: "CollectionPage",
    keywords: [
      "digital products store",
      "STEM resources",
      "school AI automation kit",
      "IT templates",
      "coding resources",
    ],
  },

  "/portfolio": {
    title: "Portfolio · Selected Projects by Mustapha Ukizuru",
    description:
      "Selected work: school IT transformations, custom websites, educational platforms, and digital product launches. Mexico, Rwanda, international.",
    type: "website",
    image: absoluteUrl("/og/og-portfolio.png"),
    schemaType: "CollectionPage",
    keywords: [
      "portfolio Mustapha Ukizuru",
      "school IT case studies",
      "custom websites Mexico",
      "EdTech projects",
      "digital product launches",
    ],
  },

  "/how-we-work": {
    title: "How We Work · Six Steps From First Message to Handover",
    description:
      "The full engagement process: what to send at each stage, response and proposal timelines, remote and on-site delivery, and the access and data-privacy rules.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
    keywords: [
      "engagement process",
      "how we work consulting",
      "IT consulting process Mexico",
      "consulting proposal timeline",
      "NDA and access policy",
    ],
  },

  "/self-audit": {
    title: "Free Digital Self-Audit · Score Your School or Business Tech",
    description:
      "A 5-minute self-assessment of your website, security, cloud and digital workflows — get a score and the three fixes with the biggest payoff.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
    keywords: ["digital audit", "IT self-assessment", "school technology audit", "website audit Mexico"],
  },

  "/track": {
    title: "Track Your Project · Mustapha Ukizuru",
    description:
      "Enter the tracking code from your invoice to see where your project stands — phase, milestones and what we are waiting on from you.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
    keywords: ["project tracking", "project status"],
  },

  "/contact": {
    title: "Contact Mustapha Ukizuru · Technology Consulting Inquiries",
    description:
      "Get in touch for technology consulting, custom development, EdTech implementations, school IT services. Based in Mexico · responds within 24 hours.",
    type: "website",
    image: absoluteUrl("/og/og-contact.png"),
    schemaType: "ContactPage",
    keywords: [
      "contact Mustapha Ukizuru",
      "technology consulting inquiry",
      "tech consultant Mexico",
      "EdTech consulting",
    ],
  },

  "/blog": {
    title: "Blog · Notes on IT, Full-Stack, EdTech & STEM",
    description:
      "Field notes on IT strategy, full-stack engineering, EdTech, STEM education, and the occasional career story, written from Mexico by way of Rwanda.",
    type: "website",
    image: absoluteUrl("/og/og-blog.png"),
    schemaType: "Blog",
    keywords: [
      "IT strategy blog",
      "full-stack engineering",
      "EdTech blog",
      "STEM education blog",
    ],
  },

  "/book": {
    title: "Book a Discovery Call · Free 30-Minute Consultation",
    description:
      "Schedule a free 30-minute discovery call to discuss IT consulting, full-stack development, school technology, or STEM education projects.",
    type: "website",
    image: absoluteUrl("/og/og-book.png"),
    schemaType: "WebPage",
    keywords: ["book a consultation", "free discovery call", "tech consultant Mexico"],
  },

  "/terms": {
    title: "Terms of Service · mustaphaukizuru.com",
    description:
      "Terms governing use of mustaphaukizuru.com — digital products, consulting services, and site access. Last updated 2026.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/privacy": {
    title: "Privacy Policy · mustaphaukizuru.com",
    description:
      "How mustaphaukizuru.com collects, uses, and protects your personal data. GDPR and Mexican privacy law compliant.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/refund": {
    title: "Refund Policy · 30-Day Guarantee on Digital Products",
    description:
      "30-day refund policy for digital products and consulting services. Conditions, request process, and support contact.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/cookies": {
    title: "Cookie Policy · How We Use Cookies",
    description:
      "Plain-language explanation of how mustaphaukizuru.com uses cookies, what categories exist, and how to manage your preferences at any time.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

}

/* ─────────────────────────────────────────────
   pageSeo aliases (import-by-key convenience)
───────────────────────────────────────────── */
export const pageSeo = {
  home: staticSeoByRoute["/"],
  about: staticSeoByRoute["/about"],
  services: staticSeoByRoute["/services"],
  schools: staticSeoByRoute["/schools"],
  store: staticSeoByRoute["/store"],
  portfolio: staticSeoByRoute["/portfolio"],
  contact: staticSeoByRoute["/contact"],
  terms: staticSeoByRoute["/terms"],
  privacy: staticSeoByRoute["/privacy"],
  refund: staticSeoByRoute["/refund"],
  cookies: staticSeoByRoute["/cookies"],
  blog: staticSeoByRoute["/blog"],
  book: staticSeoByRoute["/book"],
}

/* ─────────────────────────────────────────────
   NOINDEX ROUTES
───────────────────────────────────────────── */
export const noindexPrefixes = [
  "/portal",
  // T5-5 · /track/:code puts a live tracking code in a URL. Indexed, that is
  // a client's progress in a search result and a code anyone can replay.
  "/track",
  "/unsubscribed",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/checkout",
  "/dashboard",
  "/admin",
  "/cart",
  "/_system",
]

export function shouldNoindex(pathname = "/") {
  return noindexPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/* ─────────────────────────────────────────────
   PRODUCT SEO (DYNAMIC)
   Now delegates JSON-LD building to schemas/productSchema for consistency
   with the rest of the schema library. The legacy inline jsonLd remains
   for back-compat but the schemas/* path is the canonical one going forward.
───────────────────────────────────────────── */
export function buildProductSeo(product = {}, pathname = "/store") {
  const title = trimText(
    product.metaTitle || `${product.title || "Digital Product"} | Digital Product Store`,
    65,
  )

  const description = trimText(
    product.metaDescription || product.shortDescription || product.description || siteConfig.defaultDescription,
    160,
  )

  const image = Array.isArray(product.images)
    ? product.images.find((i) => i?.isPrimary)?.url || product.images[0]?.url || DEFAULT_OG_IMAGE
    : DEFAULT_OG_IMAGE

  return {
    title,
    description,
    image: /^https?:\/\//i.test(image) ? image : absoluteUrl(image || DEFAULT_OG_IMAGE),
    type: "product",
    schemaType: "Product",
    // Inline JSON-LD retained for callers that still read pageSeo.jsonLd directly.
    // New code should prefer: import { productSchema } from "@/seo/schemas".
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description,
      sku: product.sku || undefined,
      image: Array.isArray(product.images)
        ? product.images.map((i) => (/^https?:\/\//i.test(i?.url) ? i.url : absoluteUrl(i?.url))).filter(Boolean)
        : undefined,
      brand: { "@type": "Brand", name: siteConfig.siteName },
      category: product.category?.name || product.category || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: product.currency || "MXN",
        price: Number(product.price || 0).toFixed(2),
        availability:
          product.isActive === false
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        url: absoluteUrl(pathname),
      },
    },
  }
}

/* ─────────────────────────────────────────────
   SERVICES SEO
───────────────────────────────────────────── */
export function buildServiceCollectionSeo(pathname = "/services") {
  return {
    ...staticSeoByRoute["/services"],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: siteConfig.siteName,
      url: absoluteUrl(pathname),
      areaServed: ["MX", "US", "RW", "TR", "Worldwide"],
      // Derived from the closed set, not hand-listed. The six strings that
      // used to sit here were the retired pre-catalogue taxonomy — structured
      // data telling Google about service lines the site no longer sells,
      // while the four it does sell went unnamed.
      serviceType: CATEGORIES.map((c) => c.name),
      provider: {
        "@type": "Person",
        name: siteConfig.person.name,
        url: siteConfig.person.url,
      },
    },
  }
}
