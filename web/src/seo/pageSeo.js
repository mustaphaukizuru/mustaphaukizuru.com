import { DEFAULT_OG_IMAGE, absoluteUrl, siteConfig, trimText } from "./siteSeo"

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
      "Meet Mustapha Ukizuru — Full-Stack Developer, IT Manager, CS Educator. 6+ years across Rwanda, Turkey, Ethiopia, and Mexico. Available for new projects.",
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

  "/solutions": {
    title: "Digital Solutions for Schools, SMEs & Professionals",
    description:
      "Tailored digital solutions: school IT infrastructure, EdTech, custom websites, business systems, STEM programs. Mexico, LATAM, international.",
    type: "website",
    image: absoluteUrl("/og/og-solutions.png"),
    schemaType: "CollectionPage",
    keywords: [
      "digital solutions for schools Mexico",
      "school IT infrastructure",
      "STEM program implementation",
      "custom business software Mexico",
      "EdTech solutions LATAM",
    ],
  },

  "/services": {
    title: "Technology Services · IT Consulting · EdTech · School IT",
    description:
      "Professional IT consulting, website systems, school IT transformation, and STEM program development for businesses and educational institutions.",
    type: "website",
    image: absoluteUrl("/og/og-services.png"),
    schemaType: "Service",
    keywords: [
      "IT consulting services Mexico",
      "EdTech consulting",
      "school IT consulting",
      "technology consulting LATAM",
      "STEM program development",
    ],
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
    image: absoluteUrl("/og/og-portfolio.jpg"),
    schemaType: "CollectionPage",
    keywords: [
      "portfolio Mustapha Ukizuru",
      "school IT case studies",
      "custom websites Mexico",
      "EdTech projects",
      "digital product launches",
    ],
  },

  "/contact": {
    title: "Contact Mustapha Ukizuru · Technology Consulting Inquiries",
    description:
      "Get in touch for technology consulting, custom development, EdTech implementations, school IT services. Based in Mexico · responds within 24 hours.",
    type: "website",
    image: absoluteUrl("/og/og-contact.jpg"),
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
    image: DEFAULT_OG_IMAGE,
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
    image: DEFAULT_OG_IMAGE,
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

  "/recommendations": {
    title: "Recommendations · Tools, Books & Resources I Use",
    description:
      "Hand-picked tools, books, courses, templates, services, and partners I have personally used and stand behind.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "ItemList",
  },
}

/* ─────────────────────────────────────────────
   pageSeo aliases (import-by-key convenience)
───────────────────────────────────────────── */
export const pageSeo = {
  home: staticSeoByRoute["/"],
  about: staticSeoByRoute["/about"],
  solutions: staticSeoByRoute["/solutions"],
  services: staticSeoByRoute["/services"],
  store: staticSeoByRoute["/store"],
  portfolio: staticSeoByRoute["/portfolio"],
  contact: staticSeoByRoute["/contact"],
  terms: staticSeoByRoute["/terms"],
  privacy: staticSeoByRoute["/privacy"],
  refund: staticSeoByRoute["/refund"],
  cookies: staticSeoByRoute["/cookies"],
  recommendations: staticSeoByRoute["/recommendations"],
  blog: staticSeoByRoute["/blog"],
  book: staticSeoByRoute["/book"],
}

/* ─────────────────────────────────────────────
   NOINDEX ROUTES
───────────────────────────────────────────── */
export const noindexPrefixes = [
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
      serviceType: [
        "Technology Consulting",
        "School IT Infrastructure & Digital Transformation",
        "Educational Technology Consulting",
        "Website & Digital Systems",
        "STEM/Coding/Robotics Programs",
        "Professional Training & Workshops",
      ],
      provider: {
        "@type": "Person",
        name: siteConfig.person.name,
        url: siteConfig.person.url,
      },
    },
  }
}
