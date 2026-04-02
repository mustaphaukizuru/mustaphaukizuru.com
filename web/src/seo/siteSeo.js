const RAW_SITE_URL = import.meta.env.VITE_SITE_URL || "https://mustaphaukizuru.com";

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
  themeColor: "#420060",
  backgroundColor: "#F7F9F4",
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
    image: `${SITE_URL}/og/og-profile.jpg`,
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
