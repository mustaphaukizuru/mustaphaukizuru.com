import { TOKENS } from "../styles/tokens.js"

// SITE_URL is deliberately a constant, not env-derived: it is the
// canonical origin that goes into canonical/hreflang/OG URLs, and those
// must name production no matter which environment did the build.
// (A dead `RAW_SITE_URL = import.meta.env.VITE_SITE_URL` sat here and was
// referenced nowhere; it also made this module un-importable from Node,
// where import.meta.env is undefined — which is what generate-og-static
// needs in order to read the same page metadata the SPA renders.)
export const SITE_URL = "https://mustaphaukizuru.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og/og-default.png`;
export const DEFAULT_TWITTER_HANDLE = "@ukizurumustapha";
export const siteConfig = {
  siteName: "Mustapha Ukizuru",
  legalName: "Mustapha Ukizuru",
  titleSeparator: " | ",
  defaultTitle: "Mustapha Ukizuru | Technology Consulting, Digital Products, STEM & School Solutions",
  titleTemplateSuffix: "Mustapha Ukizuru",
  defaultDescription:
    "Technology consulting, digital products, website systems, school IT transformation, and STEM education solutions for businesses, professionals, and educational institutions.",
  siteUrl: SITE_URL,
  locale: "en_US",
  themeColor: TOKENS.violet,
  backgroundColor: TOKENS.mist,
  contactEmail: "hello@mustaphaukizuru.com",
  social: {
    linkedin: "https://www.linkedin.com/in/mustaphaukizuru/",
    telegram: "https://t.me/mustaphaukizuru",
    whatsapp: "https://wa.me/250000000000",
    x: "https://x.com/ukizurumustapha",
  },
  logos: {
    primary: `${SITE_URL}/favicon.svg`,
    square: `${SITE_URL}/web-app-manifest-512x512.png`,
    favicon: `${SITE_URL}/favicon.ico`,
    appleTouch: `${SITE_URL}/apple-touch-icon.png`,
  },
  organization: {
    name: "Mustapha Ukizuru",
    url: SITE_URL,
    logo: `${SITE_URL}/web-app-manifest-512x512.png`,
    email: "hello@mustaphaukizuru.com",
    sameAs: [
      "https://www.linkedin.com/in/mustaphaukizuru/",
      "https://t.me/mustaphaukizuru",
    ],
  },
  person: {
    name: "Mustapha Ukizuru",
    url: SITE_URL,
    image: `${SITE_URL}/og/og-profile.png`,
    jobTitle: "IT Manager, Technology Consultant, and Computer Science Educator",
    sameAs: [
      "https://www.linkedin.com/in/mustaphaukizuru/",
      "https://t.me/mustaphaukizuru",
    ],
  },
};

export function absoluteUrl(pathname = "/") {
  if (!pathname) return SITE_URL;
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function normalizeCanonical(pathname = "/") {
  const [pathWithoutHash] = String(pathname || "/").split("#");
  const [cleanPath] = pathWithoutHash.split("?");
  if (!cleanPath || cleanPath === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${cleanPath.replace(/\/$/, "")}`;
}

export function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function trimText(value = "", maxLength = 160) {
  const normalized = stripHtml(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SEO08 · Local SEO — LocalBusiness schema (Tlalnepantla, Estado de México, MX)
   Used by Seo.jsx on home / about / contact / services pages.
   ───────────────────────────────────────────────────────────────────────────── */
export const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE_URL}/#localbusiness`,
  name: "Mustapha Ukizuru, Technology Consulting",
  url: SITE_URL,
  email: "hello@mustaphaukizuru.com",
  image: `${SITE_URL}/og/og-default.png`,
  logo: `${SITE_URL}/web-app-manifest-512x512.png`,
  priceRange: "$$",
  areaServed: ["MX", "US", "RW", "TR", "Worldwide"],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Tlalnepantla de Baz",
    addressRegion: "Estado de México",
    postalCode: "54080",
    addressCountry: "MX",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 19.5419,
    longitude: -99.1957,
  },
  sameAs: [
    "https://www.linkedin.com/in/mustaphaukizuru/",
    "https://github.com/mustaphaukizuru",
    "https://t.me/mustaphaukizuru",
    "https://www.instagram.com/mustaphaukizuru/",
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   SEO02 · Auto-build BreadcrumbList from a pathname
   E.g. /store/products/great-product → Home › Store › Products › Great Product
   ───────────────────────────────────────────────────────────────────────────── */
export function buildBreadcrumbList(pathname = "/", overrides = {}) {
  const safe = String(pathname || "/").split("?")[0].split("#")[0];
  if (!safe || safe === "/") return null;

  const segments = safe.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL + "/",
    },
  ];

  let acc = "";
  segments.forEach((seg, idx) => {
    acc += "/" + seg;
    const overrideName = overrides[acc];
    const name =
      overrideName ||
      decodeURIComponent(seg)
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());

    items.push({
      "@type": "ListItem",
      position: idx + 2,
      name,
      item: SITE_URL + acc,
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
