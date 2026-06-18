import { useEffect, useMemo, useState } from "react";
import { useLocation, matchPath } from "react-router-dom";
import Seo from "./seo/Seo";
import { buildProductSeo, buildServiceCollectionSeo, shouldNoindex, staticSeoByRoute } from "../seo/pageSeo";
import { getSpanishOverride, stripLanguagePrefix } from "../seo/pageSeoEs";
import { detectLanguageFromPath } from "../i18n/utils/detectLanguageFromPath";
import { DEFAULT_OG_IMAGE, absoluteUrl, siteConfig, trimText } from "../seo/siteSeo";
import { fetchProductBySlug } from "../services/productService";
import { API_BASE_URL } from "../lib/api";

function resolveAsset(url = "") {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url}`;
}

function buildHomeSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: siteConfig.person.name,
      url: siteConfig.person.url,
      image: siteConfig.person.image,
      jobTitle: siteConfig.person.jobTitle,
      sameAs: siteConfig.person.sameAs,
      worksFor: {
        "@type": "Organization",
        name: siteConfig.organization.name,
        url: siteConfig.organization.url,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SiteNavigationElement",
      name: ["Home", "About", "Services", "Store", "Contact"],
      url: ["/", "/about", "/services", "/store", "/contact"].map(absoluteUrl),
    },
  ];
}

export default function SeoRouteManager() {
  const location = useLocation();
  const [productSeo, setProductSeo] = useState(null);

  const pathname = location.pathname;
  const productMatch = matchPath("/store/:slug", pathname);
  const projectMatch = matchPath("/projects/:slug", pathname);

  useEffect(() => {
    let active = true;

    async function loadProductSeo() {
      if (!productMatch?.params?.slug) {
        setProductSeo(null);
        return;
      }

      try {
        const product = await fetchProductBySlug(productMatch.params.slug);
        if (!active || !product) return;

        const normalized = {
          ...product,
          price: product.price ?? product.basePrice,
          images: Array.isArray(product.images)
            ? product.images.map((img) => ({ ...img, url: resolveAsset(img?.url) }))
            : [],
        };

        setProductSeo(buildProductSeo(normalized, pathname));
      } catch {
        if (active) setProductSeo(null);
      }
    }

    loadProductSeo();
    return () => {
      active = false;
    };
  }, [pathname, productMatch?.params?.slug]);

  const seo = useMemo(() => {
    // I18N07 · Spanish pageSeo merge — strip /es prefix, look up the
    // English base, then merge the Spanish override on top.
    const cleanPath = stripLanguagePrefix(pathname);
    const lang = detectLanguageFromPath(pathname);
    const esOverride = lang === "es" ? getSpanishOverride(pathname) : null;

    if (cleanPath === "/") {
      return {
        ...staticSeoByRoute["/"],
        ...(esOverride || {}),
        jsonLd: buildHomeSchemas(),
      };
    }

    if (cleanPath === "/services") {
      const base = buildServiceCollectionSeo(pathname);
      return esOverride ? { ...base, ...esOverride, jsonLd: base.jsonLd } : base;
    }

    if (productMatch) {
      return productSeo || {
        title: "Digital Product Store",
        description: siteConfig.defaultDescription,
        image: DEFAULT_OG_IMAGE,
        type: "product",
      };
    }

    if (projectMatch) {
      return {
        title: "Project Case Overview",
        description: "Review project outcomes, system improvements, implementation goals, and delivery details.",
        image: absoluteUrl("/og/og-solutions.png"),
        type: "article",
      };
    }

    return { ...(staticSeoByRoute[cleanPath] || {}), ...(esOverride || {}) } || {
      title: "Professional Technology Platform",
      description: siteConfig.defaultDescription,
      image: DEFAULT_OG_IMAGE,
      type: "website",
    };
  }, [pathname, productMatch, productSeo, projectMatch]);

  const robots = shouldNoindex(pathname)
    ? "noindex,nofollow,noarchive,nosnippet,max-image-preview:none"
    : undefined;

  return (
    <Seo
      title={trimText(seo.title || siteConfig.defaultTitle, 70)}
      description={trimText(seo.description || siteConfig.defaultDescription, 160)}
      image={seo.image || DEFAULT_OG_IMAGE}
      type={seo.type || "website"}
      robots={robots}
      jsonLd={seo.jsonLd}
    />
  );
}
