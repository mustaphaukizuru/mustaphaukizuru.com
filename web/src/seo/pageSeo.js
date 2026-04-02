import { DEFAULT_OG_IMAGE, absoluteUrl, siteConfig, trimText } from "./siteSeo";

/* ─────────────────────────────────────────────
   STATIC ROUTE SEO (used by SeoRouteManager)
───────────────────────────────────────────── */
export const staticSeoByRoute = {
  "/": {
    title: "Technology Consulting, Digital Products, STEM & School Solutions",
    description:
      "Technology consulting, digital products, website systems, school IT transformation, and STEM education solutions for businesses, professionals, and educational institutions.",
    type: "website",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/about": {
    title: "About Mustapha Ukizuru",
    description:
      "Learn about Mustapha Ukizuru’s experience in IT management, educational technology, STEM program development, and digital transformation.",
    type: "profile",
    image: absoluteUrl("/og/og-profile.jpg"),
    schemaType: "AboutPage",
  },

  "/solutions": {
    title: "Solutions for Schools, SMEs, and Professionals",
    description:
      "Explore digital solutions for school IT infrastructure, educational technology, websites, digital systems, and business growth.",
    type: "website",
    image: absoluteUrl("/og/og-solutions.jpg"),
    schemaType: "CollectionPage",
  },

  "/services": {
    title: "Technology Services & Consulting",
    description:
      "Professional services in IT consulting, website systems, educational technology, STEM program development, and digital transformation.",
    type: "website",
    image: absoluteUrl("/og/og-services.jpg"),
    schemaType: "Service",
  },

  "/store": {
    title: "Digital Products Store",
    description:
      "Shop digital products, templates, toolkits, coding resources, STEM materials, and business-ready implementation assets.",
    type: "website",
    image: absoluteUrl("/og/og-store.jpg"),
    schemaType: "CollectionPage",
  },

  "/contact": {
    title: "Contact Mustapha Ukizuru",
    description:
      "Get in touch for consulting, school technology projects, digital systems, STEM programs, collaborations, and digital product inquiries.",
    type: "website",
    image: absoluteUrl("/og/og-contact.jpg"),
    schemaType: "ContactPage",
  },

  "/terms": {
    title: "Terms and Conditions",
    description:
      "Read the terms and conditions for using mustaphaukizuru.com and purchasing digital products or services.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/privacy": {
    title: "Privacy Policy",
    description:
      "Review how mustaphaukizuru.com collects, uses, stores, and protects personal information.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },

  "/refund": {
    title: "Refund Policy",
    description:
      "Understand the refund policy for digital products, services, payments, and order support on mustaphaukizuru.com.",
    type: "article",
    image: DEFAULT_OG_IMAGE,
    schemaType: "WebPage",
  },
};

/* ─────────────────────────────────────────────
   👉 THIS FIXES YOUR ERROR (pageSeo export)
───────────────────────────────────────────── */
export const pageSeo = {
  home: staticSeoByRoute["/"],
  about: staticSeoByRoute["/about"],
  solutions: staticSeoByRoute["/solutions"],
  services: staticSeoByRoute["/services"],
  store: staticSeoByRoute["/store"],
  contact: staticSeoByRoute["/contact"],
  terms: staticSeoByRoute["/terms"],
  privacy: staticSeoByRoute["/privacy"],
  refund: staticSeoByRoute["/refund"],
};

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
];

export function shouldNoindex(pathname = "/") {
  return noindexPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/* ─────────────────────────────────────────────
   PRODUCT SEO (DYNAMIC)
───────────────────────────────────────────── */
export function buildProductSeo(product = {}, pathname = "/store") {
  const title = trimText(
    product.metaTitle || `${product.title || "Digital Product"} | Digital Product Store`,
    65
  );

  const description = trimText(
    product.metaDescription ||
      product.shortDescription ||
      product.description ||
      siteConfig.defaultDescription,
    160
  );

  const image = Array.isArray(product.images)
    ? product.images.find((i) => i?.isPrimary)?.url ||
      product.images[0]?.url ||
      DEFAULT_OG_IMAGE
    : DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    image: /^https?:\/\//i.test(image)
      ? image
      : absoluteUrl(image || DEFAULT_OG_IMAGE),
    type: "product",
    schemaType: "Product",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      description,
      sku: product.sku || undefined,
      image: Array.isArray(product.images)
        ? product.images
            .map((i) =>
              /^https?:\/\//i.test(i?.url)
                ? i.url
                : absoluteUrl(i?.url)
            )
            .filter(Boolean)
        : undefined,
      brand: {
        "@type": "Brand",
        name: siteConfig.siteName,
      },
      category: product.category || undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: product.currency || "USD",
        price: Number(product.price || 0).toFixed(2),
        availability:
          product.isActive === false
            ? "https://schema.org/OutOfStock"
            : "https://schema.org/InStock",
        url: absoluteUrl(pathname),
      },
    },
  };
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
      areaServed: "Worldwide",
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
  };
}