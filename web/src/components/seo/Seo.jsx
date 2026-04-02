import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_OG_IMAGE,
  normalizeCanonical,
  siteConfig,
} from "../../seo/siteSeo";

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
}) {
  const location = useLocation();

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

  const schemaPayload = [
    ...buildDefaultSchemas(canonicalUrl, pageTitle, safeDescription, safeImage),
    ...toArray(jsonLd),
  ];

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
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

      <meta property="og:locale" content={siteConfig.locale} />
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