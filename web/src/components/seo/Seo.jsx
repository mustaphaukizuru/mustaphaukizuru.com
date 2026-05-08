import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_OG_IMAGE,
  LOCAL_BUSINESS_SCHEMA,
  buildBreadcrumbList,
  normalizeCanonical,
  siteConfig,
} from "../../seo/siteSeo";
import { pathWithLanguage } from "../../i18n/utils/pathWithLanguage";
import { detectLanguageFromPath } from "../../i18n/utils/detectLanguageFromPath";

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function buildDefaultSchemas(canonicalUrl, pageTitle, description, image) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.organization.name,
      url: siteConfig.organization.url,
      logo: siteConfig.organization.logo,
      email: siteConfig.organization.email,
      sameAs: siteConfig.organization.sameAs,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
      inLanguage: "en",
      publisher: {
        "@type": "Organization",
        name: siteConfig.organization.name,
        logo: {
          "@type": "ImageObject",
          url: siteConfig.organization.logo,
        },
      },
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteConfig.siteUrl}/store?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: pageTitle,
      url: canonicalUrl,
      description,
      primaryImageOfPage: image,
      isPartOf: {
        "@type": "WebSite",
        name: siteConfig.siteName,
        url: siteConfig.siteUrl,
      },
    },
  ];
}

export default function Seo({
  title,
  description,
  canonical,
  image,
  type = "website",
  robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  keywords = [],
  jsonLd = [],
  publishedTime,
  modifiedTime,
  author = siteConfig.legalName,
  // SEO02 · explicit breadcrumbs (array of { name, path } overrides for pathname segments)
  breadcrumbs = null,
  // SEO02 · disable auto-breadcrumb generation if this page intentionally has none (e.g. landing /)
  noBreadcrumbs = false,
  // SEO08 · attach LocalBusiness schema (use on home, about, contact, services)
  includeLocalBusiness = false,
}) {
  const location = useLocation();
  const { i18n } = useTranslation();
  // I18N02 · derive language from URL (single source of truth) so every Seo
  // emission is correct on first paint, not after i18next finishes detecting.
  const urlLang = detectLanguageFromPath(location.pathname || "/");
  const activeLang = urlLang || i18n.language || "en";
  const htmlLang = activeLang === "es" ? "es-MX" : "en-US";
  const altLocale = activeLang === "es" ? "en_US" : "es_MX";
  const ogLocale = activeLang === "es" ? "es_MX" : "en_US";

  // Build canonical + hreflang alternate URLs. The current path stripped
  // of any /es prefix lets us derive both language URLs cleanly.
  const englishPath = pathWithLanguage(location.pathname || "/", "en");
  const spanishPath = pathWithLanguage(location.pathname || "/", "es");
  const enHref = `${siteConfig.siteUrl}${englishPath === "/" ? "/" : englishPath.replace(/\/$/, "")}`;
  const esHref = `${siteConfig.siteUrl}${spanishPath === "/" ? "/es" : spanishPath.replace(/\/$/, "")}`;

  const canonicalUrl = normalizeCanonical(
    canonical || `${location.pathname}${location.search || ""}`
  );

  const safeTitle =
    title || siteConfig.defaultTitle || siteConfig.siteName || "Mustapha Ukizuru";

  const pageTitle = safeTitle.includes(siteConfig.titleTemplateSuffix)
    ? safeTitle
    : `${safeTitle}${siteConfig.titleSeparator}${siteConfig.titleTemplateSuffix}`;

  const safeDescription =
    description || siteConfig.defaultDescription || "";

  const safeImage = image || DEFAULT_OG_IMAGE;

  // SEO02 · auto-build BreadcrumbList unless caller opted out.
  // Caller can pass `breadcrumbs` as either:
  //   - an array  → custom items (advanced)
  //   - an object → { "/store": "Store", "/store/products": "Products" } pathname overrides
  let breadcrumbSchema = null;
  if (!noBreadcrumbs) {
    if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
      breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: b.name,
          item: b.path?.startsWith("http")
                        ? b.path
                        : `${siteConfig.siteUrl}${b.path || "/"}`,
        })),
      };
    } else {
      breadcrumbSchema = buildBreadcrumbList(
        location.pathname || "/",
        breadcrumbs && typeof breadcrumbs === "object" && !Array.isArray(breadcrumbs)
          ? breadcrumbs
          : {}
      );
    }
  }

  const schemaPayload = [
    ...buildDefaultSchemas(canonicalUrl, pageTitle, safeDescription, safeImage),
    ...(breadcrumbSchema ? [breadcrumbSchema] : []),
    ...(includeLocalBusiness ? [LOCAL_BUSINESS_SCHEMA] : []),
    ...toArray(jsonLd),
  ];

  return (
    <Helmet prioritizeSeoTags>
      <html lang={htmlLang} />
      <title>{pageTitle}</title>

      <meta name="description" content={safeDescription} />
      <meta name="author" content={author} />
      <meta name="robots" content={robots} />
      {keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}

      <meta name="theme-color" content={siteConfig.themeColor} />

      <link rel="canonical" href={canonicalUrl} />
      <link rel="icon" href="/favicon.ico" sizes="48x48" />
      <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />

      <meta property="og:locale" content={ogLocale} />
      <meta property="og:locale:alternate" content={altLocale} />

      {/* I18N02 · hreflang alternates — Google reads these to map en â es. */}
      <link rel="alternate" hrefLang="en" href={enHref} />
      <link rel="alternate" hrefLang="es" href={esHref} />
      <link rel="alternate" hrefLang="x-default" href={enHref} />
      <meta property="og:site_name" content={siteConfig.siteName} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={safeImage} />
      <meta property="og:image:alt" content={pageTitle} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@ukizurumustapha" />
      <meta name="twitter:creator" content="@ukizurumustapha" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={safeImage} />

      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}

      {schemaPayload.map((item, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
