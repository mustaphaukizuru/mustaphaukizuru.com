import { DEFAULT_OG_IMAGE, absoluteUrl } from "./siteSeo.js"

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

  "/schools": {
    title: "Tecnología para Escuelas · TI Escolar y Soluciones STEM",
    description:
      "Estrategia de TI, admisiones automatizadas, respaldos y plataformas escolares para colegios K-12 en México, de un IT manager que opera la tecnología de un colegio a diario.",
    keywords: [
      "consultor TI escolar México",
      "tecnología para escuelas",
      "planeación programa STEM",
      "sitio web escolar admisiones",
      "consultor EdTech México",
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

  "/services": {
    title: "Servicios Tecnológicos · Consultoría de TI · IA y Automatización · Nube · Producto Digital",
    description:
      "Cuatro líneas de servicio, 20 servicios: consultoría estratégica de TI, integración con IA y automatización, arquitectura en la nube y migración, e ingeniería de producto digital para PyMEs.",
    keywords: [
      "consultoría de TI México",
      "CTO fraccional",
      "automatización con IA",
      "migración a la nube",
      "desarrollo de MVP",
    ],
  },

  "/services/it-strategy-consulting": {
    title: "Consultoría Estratégica de TI · Auditoría de software · CTO fraccional · Cumplimiento",
    description:
      "Auditoría de la pila de software, CTO fraccional, evaluación de proveedores y RFP, hoja de ruta de transformación digital y cumplimiento LFPDPPP.",
    keywords: ["consultoría estratégica de TI", "CTO fraccional México", "auditoría de software", "cumplimiento LFPDPPP"],
  },

  "/services/ai-automation": {
    title: "Integración con IA y Automatización · Bots · RAG · Calificadores de WhatsApp",
    description:
      "Bots de persona con LLM, calificadores de leads por WhatsApp sincronizados al CRM, pipelines API multiplataforma, bases de conocimiento RAG y extracción de datos.",
    keywords: ["automatización con IA", "chatbot WhatsApp CRM", "base de conocimiento RAG", "integración Make Zapier"],
  },

  "/services/cloud-architecture-migration": {
    title: "Arquitectura en la Nube y Migración · AWS · Azure · GCP · Docker · Zero Trust",
    description:
      "Migración on-premise a la nube, optimización de facturas hasta 40 %, recuperación ante desastres, contenedorización con Docker y seguridad zero-trust.",
    keywords: ["migración a la nube", "AWS Azure GCP", "optimización de costos en la nube", "contenedorización Docker"],
  },

  "/services/digital-product-engineering": {
    title: "Ingeniería de Producto Digital · UI/UX · MVP web · Móvil · APIs · CI/CD",
    description:
      "Wireframing interactivo UI/UX, aplicaciones web MVP, apps móviles multiplataforma, diseño seguro de APIs, automatización CI/CD y mantenimiento gestionado.",
    keywords: ["desarrollo de MVP México", "app móvil multiplataforma", "diseño de APIs", "automatización CI/CD"],
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
