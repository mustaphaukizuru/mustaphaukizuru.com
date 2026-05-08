/**
 * Schema builder barrel — single import for every SEO02 schema.
 *
 *   import { productSchema, breadcrumbSchema, faqSchema } from "@/seo/schemas"
 *
 * Each builder is pure — takes data in, returns a valid JSON-LD object
 * (or null if data is missing). Pass through the Seo component's jsonLd
 * prop, which merges with the default Organization + WebSite + WebPage
 * (+ optional BreadcrumbList + LocalBusiness) emitted from Seo.jsx.
 */

export { breadcrumbSchema }     from "./breadcrumbSchema"
export { productSchema }        from "./productSchema"
export { serviceSchema }        from "./serviceSchema"
export { personSchema, profilePageSchema } from "./personSchema"
export { faqSchema }            from "./faqSchema"
export { itemListSchema }       from "./itemListSchema"
export { creativeWorkSchema }   from "./creativeWorkSchema"
export { siteNavigationSchema } from "./siteNavigationSchema"
export { reviewSchema }         from "./reviewSchema"
export { localBusinessSchema }  from "./localBusinessSchema"
