import { siteConfig, absoluteUrl } from "../siteSeo"

/**
 * Person — schema.org/Person
 *
 * Used on the About page (ProfilePage). Pulls profile data from siteConfig
 * and lets callers extend with `knowsAbout`, `award`, `alumniOf`, etc.
 */
export function personSchema(extra = {}) {
  const p = siteConfig.person
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    url: p.url,
    image: p.image,
    jobTitle: p.jobTitle,
    sameAs: p.sameAs || [],
    worksFor: {
      "@type": "Organization",
      name: siteConfig.organization.name,
      url: siteConfig.organization.url,
    },
    knowsAbout: extra.knowsAbout || [
      "Full-Stack Development",
      "Technology Consulting",
      "Educational Technology",
      "School IT Infrastructure",
      "STEM Program Development",
      "Computer Science Education",
    ],
    nationality: extra.nationality || { "@type": "Country", name: "Rwanda" },
    homeLocation: extra.homeLocation || {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Tlalnepantla de Baz",
        addressRegion: "Estado de México",
        addressCountry: "MX",
      },
    },
    ...extra,
  }
}

/** ProfilePage wrapper — combine with personSchema on the /about route. */
export function profilePageSchema(pathname = "/about") {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl(pathname),
    mainEntity: personSchema(),
  }
}
