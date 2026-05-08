import { DEFAULT_OG_IMAGE, absoluteUrl } from "./siteSeo"

/**
 * staticSeoEsByRoute · I18N07
 *
 * Spanish-language page metadata, optimised for Mexican search intent.
 * Mirrors the shape of `staticSeoByRoute` in pageSeo.js — when a Spanish
 * page renders, SeoRouteManager merges the Spanish entry on top of the
 * English one so any unspecified field falls back to English.
 *
 * Targets — Mexican keyword research:
 *
 *   /          consultoría tecnológica México
 *   /services  consultoría IT México · EdTech · transformación digital escuelas
 *   /store     productos digitales México · plantillas IT · recursos STEM
 *   /solutions soluciones tecnológicas escuelas México
 *
 * Title budget 55–60 chars, description 150–160 chars (after the brand
 * suffix Seo.jsx appends).
 */
export const staticSeoEsByRoute = {
  "/": {
    title: "Consultoría Tecnológica · Productos Digitales · STEM",
    description:
      "Consultoría tecnológica, productos digitales y soluciones STEM para empresas y escuelas en México y LATAM. Entrega full-stack, lista para producción.",
    keywords: [
      "consultoría tecnológica México",
      "tienda de productos digitales",
      "educación STEM",
      "transformación IT escolar",
      "desarrollador full-stack México",
    ],
  },

  "/about": {
    title: "Acerca de Mustapha Ukizuru · Desarrollador Full-Stack",
    description:
      "Conoce a Mustapha Ukizuru — desarrollador full-stack, IT manager y docente de CS. Seis años de experiencia entre Ruanda, Turquía, Etiopía y México.",
    keywords: [
      "Mustapha Ukizuru",
      "desarrollador full-stack México",
      "IT manager México",
      "docente de ciencias de la computación",
      "consultor tecnológico Ruanda México",
    ],
  },

  "/solutions": {
    title: "Soluciones Digitales para Escuelas, PyMES y Profesionales",
    description:
      "Soluciones digitales a la medida: infraestructura IT escolar, EdTech, sitios web, sistemas para PyMES y programas STEM. México, LATAM e internacional.",
    keywords: [
      "soluciones digitales escuelas México",
      "infraestructura IT escolar",
      "implementación programas STEM",
      "software empresarial PyMES",
      "soluciones EdTech LATAM",
    ],
  },

  "/services": {
    title: "Servicios Tecnológicos · Consultoría IT · EdTech",
    description:
      "Consultoría IT profesional, sistemas web, transformación IT escolar y desarrollo de programas STEM para empresas e instituciones educativas.",
    keywords: [
      "servicios de consultoría IT México",
      "consultoría EdTech",
      "consultoría IT escolar",
      "consultoría tecnológica LATAM",
      "desarrollo de programas STEM",
    ],
  },

  "/store": {
    title: "Tienda Digital · Plantillas · Kits · Recursos STEM",
    description:
      "Compra productos digitales: School AI Automation Kit, plantillas IT, recursos para programación y STEM. Descarga inmediata · PayPal y MercadoPago.",
    keywords: [
      "tienda de productos digitales México",
      "recursos STEM",
      "kit automático escolar AI",
      "plantillas IT",
      "recursos de programación",
    ],
  },

  "/portfolio": {
    title: "Portafolio · Proyectos de Mustapha Ukizuru",
    description:
      "Trabajo seleccionado: transformaciones IT escolares, sitios web a la medida, plataformas educativas y lanzamientos de productos digitales.",
    keywords: [
      "portafolio Mustapha Ukizuru",
      "casos de éxito IT escolar",
      "sitios web México",
      "proyectos EdTech",
    ],
  },

  "/contact": {
    title: "Contacto Mustapha Ukizuru · Consultoría Tecnológica",
    description:
      "Contáctame para consultoría tecnológica, desarrollo a la medida, implementaciones EdTech y servicios IT escolares. Respondo en menos de 24 horas.",
    keywords: [
      "contactar Mustapha Ukizuru",
      "consulta de consultoría tecnológica",
      "consultor IT México",
      "consultoría EdTech",
    ],
  },

  "/blog": {
    title: "Blog · IT, Full-Stack, EdTech y STEM",
    description:
      "Notas de campo sobre estrategia IT, ingeniería full-stack, EdTech, educación STEM y la ocasional historia de carrera, escritas desde México vía Ruanda.",
    keywords: [
      "blog estrategia IT",
      "ingeniería full-stack",
      "blog EdTech",
      "blog educación STEM",
    ],
  },

  "/book": {
    title: "Agenda una Llamada · 30 Minutos Gratis",
    description:
      "Agenda una llamada de descubrimiento gratis de 30 minutos para discutir consultoría IT, desarrollo full-stack, tecnología escolar o proyectos STEM.",
  },

  "/terms": {
    title: "Términos del Servicio · mustaphaukizuru.com",
    description:
      "Términos que rigen el uso de mustaphaukizuru.com — productos digitales, servicios de consultoría y acceso al sitio. Última actualización 2026.",
  },

  "/privacy": {
    title: "Política de Privacidad · mustaphaukizuru.com",
    description:
      "Cómo mustaphaukizuru.com recopila, utiliza y protege tus datos personales. Cumple con GDPR y la legislación mexicana de privacidad.",
  },

  "/refund": {
    title: "Política de Reembolso · Garantía de 30 Días",
    description:
      "Política de reembolso de 30 días para productos digitales y servicios de consultoría. Condiciones, proceso de solicitud y soporte.",
  },

  "/cookies": {
    title: "Política de Cookies · Cómo las Usamos",
    description:
      "Explicación clara de cómo mustaphaukizuru.com utiliza cookies, qué categorías existen y cómo gestionar tus preferencias en cualquier momento.",
  },

  "/recommendations": {
    title: "Recomendaciones · Herramientas y Recursos que Uso",
    description:
      "Herramientas, libros, cursos, plantillas y servicios seleccionados a mano que he usado personalmente y respaldo.",
  },
}

/**
 * stripLanguagePrefix("/es/about") → "/about"
 *                    "/es")        → "/"
 *                    "/about")     → "/about"
 */
export function stripLanguagePrefix(pathname = "/") {
  if (typeof pathname !== "string") return "/"
  return pathname.replace(/^\/es(?=\/|$)/, "") || "/"
}

/**
 * getSpanishOverride(pathname) — returns the Spanish entry for the given
 * (en or es) URL, or null if no entry exists. Used by SeoRouteManager to
 * merge Spanish over English when the URL is /es/*.
 */
export function getSpanishOverride(pathname = "/") {
  const clean = stripLanguagePrefix(pathname)
  return staticSeoEsByRoute[clean] || null
}

export { DEFAULT_OG_IMAGE, absoluteUrl }
