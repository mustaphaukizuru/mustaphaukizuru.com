/* ════════════════════════════════════════════════════════════════════════
   servicesCatalogue.js · Service catalogue · August 2026
   ────────────────────────────────────────────────────────────────────────
   Source of truth: docs/SERVICE_CATALOGUE_2026-08.md ("CONSULTORÍA
   ESTRATÉGICA DE TI", PDF 2026-08-24). Structure: 4 categories → 21
   offerings. Spanish is the primary voice; English is a faithful
   translation.

   Top-level exports (stable API — other modules import these):
     CATEGORIES            4 categories, each with nested `offerings`
     SERVICES              flat list of the 21 offerings (legacy shape:
                           id / categoryCode / name / outcome / tier /
                           audience / engagement / duration / pricingModel)
     getServiceById, getServicesByIds, servicesByCategory,
     servicesByAudience, servicesByEngagement, getFlagshipServices,
     filterServices, FLAGSHIP_SERVICE_IDS
     AUDIENCE_PRICING_PLANS / AUDIENCE_PRICING_ORDER (checkout, unchanged)

   Pricing (Sept 2026, owner-set rate — dual currency, matches lib/format.js
   formatPriceWhole for the MXN half):
     Every project offering carries priceMxn + priceUsd (Fixed — a settled
     figure) or priceFromMxn + priceFromUsd (From quote / Retainer — a
     starting figure, confirmed in the written proposal). Rate basis:
     USD $30/hour, the owner's stated minimum, converted at a flat 20
     MXN/USD (matches AUDIENCE_PRICING_PLANS below — a stable round
     conversion, not tracked to live FX). NOTE: this floor sits BELOW the
     USD $50-80/hr Mexico-market senior-developer band this file's pricing
     was originally benchmarked against in August 2026 — flagged, not
     silently corrected, since it is the owner's explicit instruction.
     Duration -> hours uses a conservative hours/week assumption per
     engagement type, so the published figure is a genuine floor, not a
     padded anchor. To reprice everything, change RATE_USD_PER_HOUR below
     and recompute — never hand-edit individual price fields out of sync
     with each other.
   RATE_USD_PER_HOUR = 30 · MXN_PER_USD = 20 (see offeringPriceLabel in
   components/services/localize.js for the display format, and
   scripts/generate-service-catalog.mjs to regenerate the PDF/MD catalog.)

   Related offerings (added Sept 2026):
     relatedOfferings on an offering is an array of other offering ids that
     are commonly needed to complete it — a real technical/business
     dependency or common pairing (e.g. DPE-002 MVP Web App Development
     often needs AIA-003 Cross-Platform API Pipelines to connect payments/
     CRM/email). Not every offering has one; only add a relationship you
     can justify in one sentence if asked.

   Funnel helpers (new):
     getCategoryBySlug(slug)         category + offerings, legacy-aware
     getOfferingBySlug(slug)         offering + its category
     resolveLegacySlug(slug)         old category/SKU slug → new category slug
     legacyIdMap                     old SKU id → new offering id (or null)
     LEGACY_CATEGORY_SLUG_MAP        old category slug → new category slug
     bookHref(slug)                  "/book?service=<slug>"
     HOW_IT_WORKS                    call → proposal → delivery
   ════════════════════════════════════════════════════════════════════════ */

import {
  Compass, Workflow, CloudCog, Blocks,
  Award, ShieldCheck, BookMarked, Globe2, Languages, UserCheck,
  Calendar, Mail, Phone, FileText,
  User, Briefcase, GraduationCap,
} from "lucide-react"

/* ── Pricing model constants ─────────────────────────────────────────────── */
export const PRICING_FROM_QUOTE = "From quote"
export const PRICING_FIXED = "Fixed"
export const PRICING_RETAINER = "Retainer"

/* ── Engagement type constants ───────────────────────────────────────────── */
export const ENGAGEMENT_TYPES = [
  "Audit", "Retainer", "Engagement", "Roadmap", "Build",
  "Integration", "Migration", "Implementation", "Sprint",
]

/* ── Audience labels (kept for filterServices / servicesByAudience) ─────── */
export const AUDIENCE_LABELS = {
  SMB: { code: "SMB", label: "SMEs & Businesses", tone: "azure", priority: "Primary" },
  EDU: { code: "EDU", label: "Schools & Education", tone: "mint", priority: "Secondary" },
  IND: { code: "IND", label: "Individuals & Pros", tone: "terracotta", priority: "Inbound" },
}

export const TIER_LABELS = {
  1: { label: "Flagship", description: "Featured offering", chip: "bg-violet text-white" },
  2: { label: "Standard", description: "Actively sold", chip: "bg-violet-pale text-violet" },
}

/* ── The 4 categories × 21 offerings ─────────────────────────────────────
   Category slugs are stable and double as the `Service.slug` DB rows
   (prisma/seed/services-seed.js). Offering `slug` is used by
   /book?service=<slug> and resolves back to its category for the
   Service row.
   ──────────────────────────────────────────────────────────────────────── */
export const CATEGORIES = [
  {
    code: "ITS",
    slug: "it-strategy-consulting",
    name: "IT Strategy Consulting",
    nameEs: "Consultoría Estratégica de TI",
    tagline: "Independent senior advice on what to keep, what to cut, and what to build next.",
    taglineEs: "Asesoría senior independiente sobre qué conservar, qué eliminar y qué construir después.",
    outcome: "Cut wasted software spend and get a clear, sequenced technology roadmap your team can execute.",
    outcomeEs: "Reduce el gasto desperdiciado en software y obtén una hoja de ruta tecnológica clara y secuenciada que tu equipo pueda ejecutar.",
    Icon: Compass,
    accent: "violet",
    tile: "bg-violet",
    offerings: [
      {
        id: "UKZ-ITS-001", slug: "software-stack-audit",
        name: "Software Stack Audit", nameEs: "Auditoría de la pila de software",
        description: "Review of existing licences to eliminate duplicate subscriptions and cut waste.",
        descriptionEs: "Revisión de licencias existentes para eliminar suscripciones duplicadas y reducir el desperdicio.",
        engagement: "Audit", duration: "2–3 weeks", durationEs: "2–3 semanas",
        pricingModel: PRICING_FIXED, tier: 2, audience: ["SMB", "EDU"],
        priceMxn: 15000, priceUsd: 750,
        deliverables: ["Licence and subscription inventory", "Duplicate / unused tooling report", "Savings estimate", "Consolidation plan"],
        deliverablesEs: ["Inventario de licencias y suscripciones", "Informe de herramientas duplicadas o sin uso", "Estimación de ahorro", "Plan de consolidación"],
        relatedOfferings: ["UKZ-ITS-004", "UKZ-CAM-002"],
      },
      {
        id: "UKZ-ITS-002", slug: "fractional-cto",
        name: "Fractional CTO Engagement", nameEs: "Participación fraccional de CTO",
        description: "Part-time technical leadership: roadmaps and hiring guidance.",
        descriptionEs: "Liderazgo técnico a tiempo parcial: hojas de ruta y orientación en contratación.",
        engagement: "Retainer", duration: "Ongoing · 3-month minimum", durationEs: "Continuo · mínimo 3 meses",
        pricingModel: PRICING_RETAINER, tier: 1, audience: ["SMB"],
        priceFromMxn: 15500, priceFromUsd: 775,
        priceIncludes: "Covers a light-advisory cadence: weekly leadership sync, roadmap ownership, and vendor/architecture decisions for one product line, up to about 6 hours a week. Billed monthly in advance, 3-month minimum, then cancel with 30 days' notice.",
        priceIncludesEs: "Cubre una cadencia de asesoría ligera: sincronización semanal de liderazgo, responsabilidad de la hoja de ruta y decisiones de proveedores/arquitectura para una línea de producto, hasta unas 6 horas por semana. Se factura mensualmente por adelantado, mínimo 3 meses, después cancela con 30 días de aviso.",
        priceScalesWith: ["More hours per week (10–20h, standard leadership cadence)", "More than one product line or team", "Hands-on hiring panels beyond rubric design", "On-site days in CDMX or Estado de México"],
        priceScalesWithEs: ["Más horas por semana (10–20h, cadencia de liderazgo estándar)", "Más de una línea de producto o equipo", "Paneles de contratación presenciales más allá del diseño de rúbricas", "Días presenciales en CDMX o Estado de México"],
        deliverables: ["Weekly leadership cadence", "Technology roadmap ownership", "Hiring rubrics and interviews", "Vendor and architecture decisions"],
        deliverablesEs: ["Cadencia semanal de liderazgo", "Responsabilidad de la hoja de ruta tecnológica", "Rúbricas de contratación y entrevistas", "Decisiones de proveedores y arquitectura"],
        relatedOfferings: ["UKZ-ITS-004", "UKZ-ITS-003"],
      },
      {
        id: "UKZ-ITS-003", slug: "vendor-evaluation-rfp",
        name: "Vendor Evaluation & RFP", nameEs: "Evaluación de proveedores y RFP",
        description: "Independent expert review of third-party software offers for fairness.",
        descriptionEs: "Experto independiente que revisa ofertas de software de terceros en cuanto a equidad.",
        engagement: "Engagement", duration: "3–6 weeks", durationEs: "3–6 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB", "EDU"],
        priceFromMxn: 18000, priceFromUsd: 900,
        priceIncludes: "Covers one RFP cycle for a single software category: requirements definition, a shortlist of up to five vendors, one comparison matrix, and a recommendation.",
        priceIncludesEs: "Cubre un ciclo de RFP para una sola categoría de software: definición de requisitos, una lista corta de hasta cinco proveedores, una matriz comparativa y una recomendación.",
        priceScalesWith: ["More than five vendors shortlisted", "Multiple software categories evaluated in parallel", "Live demo coordination and reference calls", "Contract negotiation support beyond the written review"],
        priceScalesWithEs: ["Más de cinco proveedores en la lista corta", "Varias categorías de software evaluadas en paralelo", "Coordinación de demos en vivo y llamadas de referencia", "Apoyo en negociación de contrato más allá de la revisión escrita"],
        deliverables: ["Requirements definition", "RFP drafting and management", "Comparison matrix", "Contract review and recommendation"],
        deliverablesEs: ["Definición de requisitos", "Redacción y gestión de la RFP", "Matriz comparativa", "Revisión de contrato y recomendación"],
        relatedOfferings: ["UKZ-ITS-001", "UKZ-ITS-004"],
      },
      {
        id: "UKZ-ITS-004", slug: "digital-transformation-roadmap",
        name: "Digital Transformation Roadmap", nameEs: "Hoja de ruta para la transformación digital",
        description: "Step-by-step migrations from paper and spreadsheets to automated platforms.",
        descriptionEs: "Migraciones paso a paso de papel/hojas de cálculo a plataformas automatizadas.",
        engagement: "Roadmap", duration: "4–6 weeks", durationEs: "4–6 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 1, audience: ["SMB", "EDU"],
        priceFromMxn: 19000, priceFromUsd: 950,
        priceIncludes: "Covers the audit and twelve-month roadmap for one department or campus, one stakeholder workshop, and the written plan.",
        priceIncludesEs: "Cubre la auditoría y la hoja de ruta a doce meses para un departamento o plantel, un taller con interesados y el plan escrito.",
        priceScalesWith: ["Multi-department or multi-campus scope", "Additional stakeholder workshops", "A detailed change-management or training-rollout plan", "Budget modelling across multiple vendor scenarios"],
        priceScalesWithEs: ["Alcance multi-departamento o multi-plantel", "Talleres adicionales con interesados", "Un plan detallado de gestión del cambio o despliegue de capacitación", "Modelado de presupuesto en varios escenarios de proveedores"],
        deliverables: ["Process and systems audit", "Prioritised opportunity matrix", "12-month sequenced roadmap", "Budget and change-management plan"],
        deliverablesEs: ["Auditoría de procesos y sistemas", "Matriz de oportunidades priorizada", "Hoja de ruta secuenciada a 12 meses", "Plan de presupuesto y gestión del cambio"],
        relatedOfferings: ["UKZ-ITS-001", "UKZ-ITS-002", "UKZ-DPE-002", "UKZ-CAM-001"],
      },
      {
        id: "UKZ-ITS-005", slug: "compliance-risk-assessment",
        name: "Compliance & Risk Assessment", nameEs: "Cumplimiento y evaluación de riesgos",
        description: "Architecture audit to comply with Mexican privacy law (LFPDPPP).",
        descriptionEs: "Auditoría de arquitectura para cumplir leyes mexicanas de privacidad (LFPDPPP).",
        engagement: "Audit", duration: "2–3 weeks", durationEs: "2–3 semanas",
        pricingModel: PRICING_FIXED, tier: 2, audience: ["SMB", "EDU"],
        priceMxn: 15000, priceUsd: 750,
        deliverables: ["Data inventory and flow map", "LFPDPPP gap analysis", "Risk register", "Remediation roadmap"],
        deliverablesEs: ["Inventario y mapa de flujo de datos", "Análisis de brechas LFPDPPP", "Registro de riesgos", "Hoja de ruta de remediación"],
        relatedOfferings: ["UKZ-CAM-005", "UKZ-AIA-004"],
      },
    ],
  },
  {
    code: "AIA",
    slug: "ai-automation",
    name: "AI Integration & Workflow Automation",
    nameEs: "Integración con IA y Automatización de Flujos de Trabajo",
    tagline: "Assistants, agents and pipelines that remove repetitive work from your team's week.",
    taglineEs: "Asistentes, agentes y pipelines que quitan el trabajo repetitivo de la semana de tu equipo.",
    outcome: "Answer customers faster, sync leads automatically, and turn documents into clean data without adding headcount.",
    outcomeEs: "Responde a clientes más rápido, sincroniza prospectos automáticamente y convierte documentos en datos limpios sin contratar más personal.",
    Icon: Workflow,
    accent: "terracotta",
    // Plain bg-terracotta is a light hue — white text on it is 1.67:1. Every
    // consumer of `tile` pairs it with text-white, so the tile has to sit at
    // the dark end of the ramp: terracotta-800 is 5.60:1 with white.
    tile: "bg-terracotta-800",
    offerings: [
      {
        id: "UKZ-AIA-001", slug: "custom-persona-bots",
        name: "Custom AI Assistants & WhatsApp Bots", nameEs: "Asistentes de IA y bots de WhatsApp personalizados",
        description: "LLM assistants trained on your brand voice and documents, deployed on WhatsApp Business, your website, or both — from answering FAQs to qualifying and routing every new lead.",
        descriptionEs: "Asistentes LLM entrenados con la voz y documentos de tu marca, desplegados en WhatsApp Business, tu sitio web o ambos — desde responder preguntas frecuentes hasta calificar y enrutar cada prospecto nuevo.",
        engagement: "Build", duration: "2–4 weeks", durationEs: "2–4 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 1, audience: ["SMB", "IND"],
        priceFromMxn: 19000, priceFromUsd: 950,
        priceIncludes: "One assistant on one primary channel (WhatsApp Business or web chat), trained on the documents you provide, with guardrails and CRM sync to one system (HubSpot, Zoho, or a sheet).",
        priceIncludesEs: "Un asistente en un canal principal (WhatsApp Business o chat web), entrenado con los documentos que proporciones, con salvaguardas y sincronización a un CRM (HubSpot, Zoho o una hoja).",
        priceScalesWith: ["Deploying on more than one channel at once (web + WhatsApp + app)", "Syncing to more than one CRM or data source", "Custom escalation and handoff workflows", "Multilingual response sets", "High message-volume infrastructure"],
        priceScalesWithEs: ["Desplegar en más de un canal a la vez (web + WhatsApp + app)", "Sincronizar con más de un CRM o fuente de datos", "Flujos de escalamiento y traspaso personalizados", "Conjuntos de respuesta multilingües", "Infraestructura para alto volumen de mensajes"],
        deliverables: ["WhatsApp Business API setup", "Voice and tone guide ingestion", "Assistant with guardrails", "Qualification flow and CRM sync (HubSpot, Zoho or sheet)", "Web, WhatsApp, or in-app chat deployment", "Evaluation set, monitoring, and handover to a human"],
        deliverablesEs: ["Configuración de WhatsApp Business API", "Ingesta de guía de voz y tono", "Asistente con salvaguardas", "Flujo de calificación y sincronización con CRM (HubSpot, Zoho u hoja)", "Despliegue web, WhatsApp o chat en app", "Conjunto de evaluación, monitoreo y traspaso a un humano"],
        relatedOfferings: ["UKZ-AIA-003", "UKZ-DPE-006"],
      },
      {
        id: "UKZ-AIA-003", slug: "cross-platform-api-pipelines",
        name: "Cross-Platform API Pipelines", nameEs: "Pipelines API multiplataforma",
        description: "Connect disconnected tools (e.g. payments, Slack, email) with Make or Zapier.",
        descriptionEs: "Conectar herramientas desconectadas (p. ej. pagos, Slack, email) con Make o Zapier.",
        engagement: "Integration", duration: "1–3 weeks", durationEs: "1–3 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB", "IND"],
        priceFromMxn: 6000, priceFromUsd: 300,
        priceIncludes: "Covers one integration path between two tools (for example, payments to Slack), built in Make or Zapier, with basic error alerts.",
        priceIncludesEs: "Cubre una ruta de integración entre dos herramientas (por ejemplo, pagos a Slack), construida en Make o Zapier, con alertas básicas de error.",
        priceScalesWith: ["Each additional tool or integration path", "Custom code instead of Make/Zapier scenarios", "High-volume or real-time processing needs", "Separate staging and production environments"],
        priceScalesWithEs: ["Cada herramienta o ruta de integración adicional", "Código a medida en lugar de escenarios de Make/Zapier", "Necesidades de procesamiento de alto volumen o en tiempo real", "Entornos separados de staging y producción"],
        deliverables: ["Integration map", "Make / Zapier scenarios", "Error handling and alerts", "Runbook"],
        deliverablesEs: ["Mapa de integraciones", "Escenarios en Make / Zapier", "Manejo de errores y alertas", "Manual operativo"],
        relatedOfferings: ["UKZ-DPE-002", "UKZ-AIA-001", "UKZ-AIA-005"],
      },
      {
        id: "UKZ-AIA-004", slug: "rag-knowledge-base",
        name: "Internal RAG Knowledge Base", nameEs: "Base de conocimiento interna RAG",
        description: "Private corporate search engines built on vector databases (Pinecone).",
        descriptionEs: "Motores de búsqueda corporativos privados con bases vectoriales (Pinecone).",
        engagement: "Build", duration: "4–8 weeks", durationEs: "4–8 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 1, audience: ["SMB", "EDU"],
        priceFromMxn: 38500, priceFromUsd: 1925,
        priceIncludes: "Covers ingestion of one document set, a Pinecone vector index, and a search/chat interface with citations for one team.",
        priceIncludesEs: "Cubre la ingesta de un conjunto de documentos, un índice vectorial en Pinecone y una interfaz de búsqueda/chat con citas para un equipo.",
        priceScalesWith: ["Multiple document sets or data sources", "Role-based access control across teams", "A custom interface beyond the standard chat UI", "An ongoing re-indexing pipeline for frequently changing documents"],
        priceScalesWithEs: ["Varios conjuntos de documentos o fuentes de datos", "Control de acceso basado en roles entre equipos", "Una interfaz personalizada más allá del chat estándar", "Un pipeline de reindexado continuo para documentos que cambian con frecuencia"],
        deliverables: ["Document ingestion pipeline", "Vector index (Pinecone)", "Search / chat interface with citations", "Access control"],
        deliverablesEs: ["Pipeline de ingesta de documentos", "Índice vectorial (Pinecone)", "Interfaz de búsqueda / chat con citas", "Control de acceso"],
        relatedOfferings: ["UKZ-CAM-005", "UKZ-ITS-005"],
      },
      {
        id: "UKZ-AIA-005", slug: "data-extraction-workflows",
        name: "Data Extraction Workflows", nameEs: "Flujos de extracción de datos",
        description: "Tools that parse PDFs, invoices or forms into clean spreadsheets.",
        descriptionEs: "Herramientas que analizan PDFs, facturas o formularios en hojas de cálculo limpias.",
        engagement: "Build", duration: "2–4 weeks", durationEs: "2–4 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB"],
        priceFromMxn: 19000, priceFromUsd: 950,
        priceIncludes: "Covers one document type (for example, invoices), with field extraction, validation, and a single spreadsheet or database output.",
        priceIncludesEs: "Cubre un tipo de documento (por ejemplo, facturas), con extracción de campos, validación y una sola salida a hoja de cálculo o base de datos.",
        priceScalesWith: ["Additional document types or formats", "Higher accuracy or validation requirements needing human-in-the-loop review", "Direct write-back to an ERP or accounting system instead of a spreadsheet", "High monthly document volume"],
        priceScalesWithEs: ["Tipos o formatos de documento adicionales", "Requisitos de precisión o validación más altos que requieren revisión humana", "Escritura directa a un ERP o sistema contable en lugar de una hoja de cálculo", "Alto volumen mensual de documentos"],
        deliverables: ["Document classifier", "Field extraction with validation", "Spreadsheet / database output", "Exception review queue"],
        deliverablesEs: ["Clasificador de documentos", "Extracción de campos con validación", "Salida a hoja de cálculo / base de datos", "Cola de revisión de excepciones"],
        relatedOfferings: ["UKZ-AIA-003", "UKZ-DPE-006"],
      },
    ],
  },
  {
    code: "CAM",
    slug: "cloud-architecture-migration",
    name: "Cloud Architecture & Infrastructure Migration",
    nameEs: "Arquitectura en la Nube y Migración de Infraestructura",
    tagline: "Move to the cloud safely, pay less for it, and survive the bad day.",
    taglineEs: "Migra a la nube con seguridad, paga menos por ella y sobrevive al mal día.",
    outcome: "Retire the office server, pay only for the cloud capacity you use, and know your backups actually restore.",
    outcomeEs: "Retira el servidor de la oficina, paga solo la capacidad en la nube que usas y confirma que tus respaldos realmente restauran.",
    Icon: CloudCog,
    accent: "azure",
    // Plain bg-azure is 4.10:1 with white — under AA for the 11-14px text these
    // tiles carry. azure-deep is 5.93:1.
    tile: "bg-azure-deep",
    offerings: [
      {
        id: "UKZ-CAM-001", slug: "on-premise-to-cloud-migration",
        name: "On-Premise to Cloud Migration", nameEs: "Migración on-premise a la nube",
        description: "Safely move physical office servers to AWS, Azure or GCP.",
        descriptionEs: "Mover servidores físicos de oficina de forma segura a AWS, Azure o GCP.",
        engagement: "Migration", duration: "6–12 weeks", durationEs: "6–12 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 1, audience: ["SMB", "EDU"],
        priceFromMxn: 57500, priceFromUsd: 2875,
        priceIncludes: "Covers migration of one office server or workload to a single cloud provider, with a landing zone and one rehearsed cutover.",
        priceIncludesEs: "Cubre la migración de un servidor u carga de trabajo de oficina a un solo proveedor en la nube, con una landing zone y un corte ensayado.",
        priceScalesWith: ["Multiple servers or workloads migrated together", "Multi-region or multi-cloud architecture", "Legacy application refactoring beyond a lift-and-shift", "An extended post-migration support window"],
        priceScalesWithEs: ["Varios servidores o cargas de trabajo migrados juntos", "Arquitectura multi-región o multi-nube", "Refactorización de aplicaciones heredadas más allá de un lift-and-shift", "Una ventana extendida de soporte posterior a la migración"],
        deliverables: ["Migration assessment", "Landing zone (VPC, IAM)", "Workload migration and cutover", "Post-migration support"],
        deliverablesEs: ["Evaluación de migración", "Landing zone (VPC, IAM)", "Migración de cargas y corte", "Soporte posterior a la migración"],
        relatedOfferings: ["UKZ-CAM-003", "UKZ-CAM-005", "UKZ-CAM-002"],
      },
      {
        id: "UKZ-CAM-002", slug: "cloud-bill-optimization",
        name: "Cloud Bill Optimisation", nameEs: "Optimización de facturas en la nube",
        description: "Audit configurations to right-size servers and remove capacity you pay for but never use.",
        descriptionEs: "Auditar configuraciones para dimensionar servidores y eliminar la capacidad que pagas sin usar.",
        engagement: "Audit", duration: "1–2 weeks", durationEs: "1–2 semanas",
        pricingModel: PRICING_FIXED, tier: 2, audience: ["SMB"],
        priceMxn: 9000, priceUsd: 450,
        deliverables: ["Billing analysis", "Right-sizing recommendations", "Reserved / committed-use plan", "Savings tracker"],
        deliverablesEs: ["Análisis de facturación", "Recomendaciones de dimensionamiento", "Plan de instancias reservadas / uso comprometido", "Seguimiento de ahorros"],
        relatedOfferings: ["UKZ-CAM-001"],
      },
      {
        id: "UKZ-CAM-003", slug: "disaster-recovery-planning",
        name: "Disaster Recovery Planning", nameEs: "Planificación de recuperación ante desastres",
        description: "Automated, encrypted backups with failover.",
        descriptionEs: "Respaldos automatizados y cifrados con conmutación por error.",
        engagement: "Implementation", duration: "2–4 weeks", durationEs: "2–4 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB", "EDU"],
        priceFromMxn: 14500, priceFromUsd: 725,
        priceIncludes: "Covers RPO/RTO definition, encrypted backup automation, and one live restore drill for a single environment.",
        priceIncludesEs: "Cubre la definición de RPO/RTO, automatización de respaldos cifrados y un simulacro de restauración en vivo para un solo entorno.",
        priceScalesWith: ["Multiple environments or regions", "Sub-hour RTO requirements (hot standby / active-active)", "Compliance-driven audit documentation (LFPDPPP or industry-specific)", "A recurring quarterly drill program"],
        priceScalesWithEs: ["Varios entornos o regiones", "Requisitos de RTO menores a una hora (respaldo activo / activo-activo)", "Documentación de auditoría por cumplimiento (LFPDPPP o específica de la industria)", "Un programa recurrente de simulacros trimestrales"],
        deliverables: ["RPO / RTO definition", "Encrypted backup automation", "Failover configuration", "Restore drill and runbook"],
        deliverablesEs: ["Definición de RPO / RTO", "Automatización de respaldos cifrados", "Configuración de conmutación por error", "Simulacro de restauración y manual"],
        relatedOfferings: ["UKZ-CAM-001", "UKZ-ITS-005"],
      },
      {
        id: "UKZ-CAM-004", slug: "docker-containerization",
        name: "Docker & Containerisation", nameEs: "Docker y contenedorización",
        description: "Package legacy applications into containers for fast deployments.",
        descriptionEs: "Empaquetar aplicaciones antiguas en contenedores para despliegues rápidos.",
        engagement: "Implementation", duration: "2–4 weeks", durationEs: "2–4 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB"],
        priceFromMxn: 14500, priceFromUsd: 725,
        priceIncludes: "Covers containerizing one application and its environments, with a basic registry and deployment flow.",
        priceIncludesEs: "Cubre la contenedorización de una aplicación y sus entornos, con un registro básico y flujo de despliegue.",
        priceScalesWith: ["Multiple applications or microservices", "Full orchestration (Kubernetes) instead of single-host Docker Compose", "Multi-environment parity (dev/staging/prod) with automated promotion", "Legacy application refactoring to containerize cleanly"],
        priceScalesWithEs: ["Varias aplicaciones o microservicios", "Orquestación completa (Kubernetes) en lugar de Docker Compose de un solo host", "Paridad multi-entorno (dev/staging/prod) con promoción automatizada", "Refactorización de aplicaciones heredadas para contenedorizar limpiamente"],
        deliverables: ["Dockerfiles and compose / orchestration", "Environment parity", "Registry and deployment flow", "Documentation"],
        deliverablesEs: ["Dockerfiles y compose / orquestación", "Paridad de entornos", "Registro y flujo de despliegue", "Documentación"],
        relatedOfferings: ["UKZ-DPE-005", "UKZ-CAM-001"],
      },
      {
        id: "UKZ-CAM-005", slug: "zero-trust-security-hardening",
        name: "Zero-Trust Security Hardening", nameEs: "Endurecimiento de seguridad zero-trust",
        description: "Enterprise-grade access controls for remote work.",
        descriptionEs: "Controles de acceso para trabajo remoto de nivel empresarial.",
        engagement: "Implementation", duration: "3–5 weeks", durationEs: "3–5 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB", "EDU"],
        priceFromMxn: 21500, priceFromUsd: 1075,
        priceIncludes: "Covers identity and MFA rollout and a device/network policy baseline for one office or up to about 50 users.",
        priceIncludesEs: "Cubre el despliegue de identidad y MFA y una línea base de políticas de dispositivos/red para una oficina o hasta unos 50 usuarios.",
        priceScalesWith: ["More than about 50 users or devices", "Multiple office locations", "Custom compliance reporting beyond the baseline report", "An ongoing quarterly policy review"],
        priceScalesWithEs: ["Más de unos 50 usuarios o dispositivos", "Varias sedes de oficina", "Reportes de cumplimiento personalizados más allá del reporte base", "Una revisión trimestral continua de políticas"],
        deliverables: ["Identity and MFA rollout", "Device and network policies", "Least-privilege access review", "Security baseline report"],
        deliverablesEs: ["Despliegue de identidad y MFA", "Políticas de dispositivos y red", "Revisión de acceso de mínimo privilegio", "Informe de línea base de seguridad"],
        relatedOfferings: ["UKZ-CAM-001", "UKZ-ITS-005"],
      },
    ],
  },
  {
    code: "DPE",
    slug: "digital-product-engineering",
    name: "End-to-End Digital Product Engineering",
    nameEs: "Ingeniería de Producto Digital de Extremo a Extremo",
    tagline: "From clickable prototype to shipped product, with the pipeline and maintenance to keep it running.",
    taglineEs: "Del prototipo clicable al producto publicado, con el pipeline y el mantenimiento para mantenerlo funcionando.",
    outcome: "Validate before you build, ship an MVP in weeks, and keep it patched and improving every month.",
    outcomeEs: "Valida antes de construir, publica un MVP en semanas y mantenlo parchado y mejorando cada mes.",
    Icon: Blocks,
    accent: "mint",
    tile: "bg-mint-700",
    offerings: [
      {
        id: "UKZ-DPE-001", slug: "ui-ux-wireframing",
        name: "Interactive UI/UX Wireframing", nameEs: "Wireframing interactivo UI/UX",
        description: "High-fidelity clickable prototypes before writing any backend.",
        descriptionEs: "Prototipos clicables de alta fidelidad antes de escribir backend.",
        engagement: "Sprint", duration: "1–2 weeks", durationEs: "1–2 semanas",
        pricingModel: PRICING_FIXED, tier: 2, audience: ["SMB", "IND"],
        priceMxn: 18000, priceUsd: 900,
        deliverables: ["User flows", "Clickable Figma prototype", "Design tokens", "Handoff notes"],
        deliverablesEs: ["Flujos de usuario", "Prototipo clicable en Figma", "Tokens de diseño", "Notas de entrega"],
        relatedOfferings: ["UKZ-DPE-002"],
      },
      {
        id: "UKZ-DPE-002", slug: "mvp-web-app-development",
        name: "MVP Web App Development", nameEs: "Desarrollo de aplicaciones web MVP",
        description: "Fast, working minimum viable products built on modern ecosystems.",
        descriptionEs: "Productos mínimos viables rápidos y funcionales con ecosistemas modernos.",
        engagement: "Build", duration: "4–10 weeks", durationEs: "4–10 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 1, audience: ["SMB", "IND"],
        priceFromMxn: 38500, priceFromUsd: 1925,
        priceIncludes: "Covers a scoped MVP backlog and a working web app (React + API) with core auth, deployed with thirty days of support.",
        priceIncludesEs: "Cubre un backlog de MVP delimitado y una aplicación web funcional (React + API) con autenticación básica, desplegada con treinta días de soporte.",
        priceScalesWith: ["Payment processing integration", "Third-party integrations beyond authentication", "A native mobile companion app", "Multi-tenant or multi-role permission systems", "An extended support window beyond thirty days"],
        priceScalesWithEs: ["Integración de procesamiento de pagos", "Integraciones de terceros más allá de la autenticación", "Una app móvil nativa complementaria", "Sistemas de permisos multi-tenant o multi-rol", "Una ventana de soporte extendida más allá de treinta días"],
        deliverables: ["Scoped MVP backlog", "Web application (React + API)", "Auth and payments if needed", "Deployment and 30-day support"],
        deliverablesEs: ["Backlog del MVP delimitado", "Aplicación web (React + API)", "Autenticación y pagos si se requieren", "Despliegue y 30 días de soporte"],
        relatedOfferings: ["UKZ-DPE-001", "UKZ-AIA-003", "UKZ-DPE-005", "UKZ-DPE-006"],
      },
      {
        id: "UKZ-DPE-003", slug: "cross-platform-mobile-apps",
        name: "Cross-Platform Mobile Apps", nameEs: "Aplicaciones móviles multiplataforma",
        description: "A single codebase for iOS and Android.",
        descriptionEs: "Base de código única para iOS y Android.",
        engagement: "Build", duration: "6–12 weeks", durationEs: "6–12 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB"],
        priceFromMxn: 57500, priceFromUsd: 2875,
        priceIncludes: "Covers one React Native / Expo app with store-ready builds for iOS and Android, push notifications, and a release pipeline.",
        priceIncludesEs: "Cubre una app en React Native / Expo con compilaciones listas para tienda en iOS y Android, notificaciones push y un pipeline de publicación.",
        priceScalesWith: ["Offline-first or complex local-data sync", "Native module work outside Expo's managed workflow", "Multiple user roles or white-label variants", "App Store / Play Store review handling beyond submission"],
        priceScalesWithEs: ["Sincronización de datos local offline-first o compleja", "Trabajo con módulos nativos fuera del flujo administrado de Expo", "Varios roles de usuario o variantes de marca blanca", "Gestión de la revisión de App Store / Play Store más allá del envío"],
        deliverables: ["React Native / Expo app", "Store-ready builds", "Push notifications and analytics", "Release pipeline"],
        deliverablesEs: ["App en React Native / Expo", "Compilaciones listas para tiendas", "Notificaciones push y analítica", "Pipeline de publicación"],
        relatedOfferings: ["UKZ-AIA-003", "UKZ-DPE-004", "UKZ-DPE-006"],
      },
      {
        id: "UKZ-DPE-004", slug: "secure-api-design",
        name: "Secure API Design", nameEs: "Diseño seguro de APIs",
        description: "Fast, well-documented backend APIs that link business applications.",
        descriptionEs: "APIs backend rápidas y bien documentadas para enlazar aplicaciones de negocio.",
        engagement: "Build", duration: "2–6 weeks", durationEs: "2–6 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB"],
        priceFromMxn: 19000, priceFromUsd: 950,
        priceIncludes: "Covers one API contract (OpenAPI), authentication and rate limiting, implementation, and developer documentation.",
        priceIncludesEs: "Cubre un contrato de API (OpenAPI), autenticación y límites de tasa, implementación y documentación para desarrolladores.",
        priceScalesWith: ["Multiple services or microservices", "Complex authorization models (multi-tenant, role hierarchies)", "Third-party API consumers requiring versioning or SLAs", "Load-testing and performance tuning beyond the baseline"],
        priceScalesWithEs: ["Varios servicios o microservicios", "Modelos de autorización complejos (multi-tenant, jerarquías de roles)", "Consumidores de API externos que requieren versionado o SLAs", "Pruebas de carga y ajuste de rendimiento más allá de la línea base"],
        deliverables: ["API contract (OpenAPI)", "Auth, rate limiting, audit logs", "Implementation and tests", "Developer documentation"],
        deliverablesEs: ["Contrato de API (OpenAPI)", "Autenticación, límites de tasa y registros de auditoría", "Implementación y pruebas", "Documentación para desarrolladores"],
        relatedOfferings: ["UKZ-DPE-002", "UKZ-DPE-005"],
      },
      {
        id: "UKZ-DPE-005", slug: "ci-cd-pipeline-automation",
        name: "CI/CD Pipeline Automation", nameEs: "Automatización de pipeline CI/CD",
        description: "Automated, zero-downtime deployment scripts.",
        descriptionEs: "Scripts de despliegue automatizados sin tiempo de inactividad.",
        engagement: "Implementation", duration: "1–3 weeks", durationEs: "1–3 semanas",
        pricingModel: PRICING_FROM_QUOTE, tier: 2, audience: ["SMB"],
        priceFromMxn: 7000, priceFromUsd: 350,
        priceIncludes: "Covers one deployment pipeline (GitHub Actions or similar), automated tests, and a documented rollback procedure.",
        priceIncludesEs: "Cubre un pipeline de despliegue (GitHub Actions o similar), pruebas automatizadas y un procedimiento de reversión documentado.",
        priceScalesWith: ["Multiple environments or services in the same pipeline", "Blue-green or canary deployment strategies", "Infrastructure-as-code setup alongside the pipeline", "Multi-repo or monorepo orchestration"],
        priceScalesWithEs: ["Varios entornos o servicios en el mismo pipeline", "Estrategias de despliegue blue-green o canary", "Configuración de infraestructura como código junto con el pipeline", "Orquestación multi-repo o monorepo"],
        deliverables: ["Pipeline (GitHub Actions or similar)", "Automated tests and checks", "Zero-downtime deploy strategy", "Rollback procedure"],
        deliverablesEs: ["Pipeline (GitHub Actions o similar)", "Pruebas y verificaciones automatizadas", "Estrategia de despliegue sin tiempo de inactividad", "Procedimiento de reversión"],
        relatedOfferings: ["UKZ-DPE-002", "UKZ-CAM-004"],
      },
      {
        id: "UKZ-DPE-006", slug: "managed-maintenance",
        name: "Managed Maintenance", nameEs: "Mantenimiento gestionado",
        description: "Recurring monthly support: fixes, patches and feature rollouts.",
        descriptionEs: "Soporte mensual recurrente: correcciones, parches y despliegue de funciones.",
        engagement: "Retainer", duration: "Monthly · no minimum term", durationEs: "Mensual · sin plazo mínimo",
        pricingModel: PRICING_RETAINER, tier: 2, audience: ["SMB", "IND"],
        priceFromMxn: 5000, priceFromUsd: 250,
        priceIncludes: "Covers bug fixes, security patches, and dependency updates for one application, with one feature-deployment slot a month. Billed monthly in advance; cancel with 30 days' notice, no minimum term.",
        priceIncludesEs: "Cubre corrección de errores, parches de seguridad y actualización de dependencias para una aplicación, con un espacio de despliegue de funciones al mes. Se factura mensualmente por adelantado; cancela con 30 días de aviso, sin plazo mínimo.",
        priceScalesWith: ["Additional feature-deployment slots per month", "Multiple applications under the same retainer", "A faster response SLA than standard business hours", "After-hours, on-call incident coverage"],
        priceScalesWithEs: ["Espacios adicionales de despliegue de funciones al mes", "Varias aplicaciones bajo el mismo retainer", "Un SLA de respuesta más rápido que el horario laboral estándar", "Cobertura de incidentes en guardia fuera de horario"],
        deliverables: ["Bug fixes and security patches", "Dependency updates", "Feature deployment slots", "Monthly report"],
        deliverablesEs: ["Corrección de errores y parches de seguridad", "Actualización de dependencias", "Espacios para despliegue de funciones", "Informe mensual"],
        relatedOfferings: ["UKZ-DPE-002", "UKZ-AIA-001"],
      },
    ],
  },
]

/* ── Flat offering list (legacy `SERVICES` shape) ───────────────────────── */
export const SERVICES = CATEGORIES.flatMap((c) =>
  c.offerings.map((o) => ({
    ...o,
    categoryCode: c.code,
    categorySlug: c.slug,
    outcome: o.description,
    outcomeEs: o.descriptionEs,
    status: "active",
    format: "Service",
    related: [],
  })),
)

export const FLAGSHIP_SERVICE_IDS = SERVICES.filter((s) => s.tier === 1).map((s) => s.id)

/* ── Lookups ─────────────────────────────────────────────────────────────── */
export const getServiceById = (id) => SERVICES.find((s) => s.id === id) || null
export const getServicesByIds = (ids = []) => ids.map(getServiceById).filter(Boolean)
export const servicesByCategory = (code) => SERVICES.filter((s) => s.categoryCode === code)
export const servicesByAudience = (code) => SERVICES.filter((s) => s.audience.includes(code))
export const servicesByEngagement = (label) => SERVICES.filter((s) => s.engagement === label)
export const getFlagshipServices = () => SERVICES.filter((s) => s.tier === 1)

export function filterServices(opts = {}) {
  const { q = "", audience = null, engagement = null, categoryCode = null } = opts
  const needle = q.trim().toLowerCase()
  return SERVICES.filter((s) => {
    if (categoryCode && s.categoryCode !== categoryCode) return false
    if (audience && !s.audience.includes(audience)) return false
    if (engagement && s.engagement !== engagement) return false
    if (needle) {
      const hay = [s.id, s.name, s.nameEs, s.outcome, s.outcomeEs, ...(s.deliverables || [])].join(" ").toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

/* ── Legacy → new mapping (for 301s and old bookmarks) ──────────────────── */
export const LEGACY_CATEGORY_SLUG_MAP = {
  "consulting-strategy": "it-strategy-consulting",
  "brand-digital-presence": "digital-product-engineering",
  "infrastructure-cloud": "cloud-architecture-migration",
  "web-app-ai": "digital-product-engineering",
  "edtech-training": "it-strategy-consulting",
  "managed-services": "digital-product-engineering",
  // Older DB slugs from the first services seed
  "digital-transformation-consulting": "it-strategy-consulting",
  "it-infrastructure": "cloud-architecture-migration",
  "cloud-migration-automation": "cloud-architecture-migration",
  "branding-digital-presence": "digital-product-engineering",
}

/** Old SKU id → new offering id (null = retired; falls back to the category). */
export const legacyIdMap = {
  "UKZ-AIA-002": "UKZ-AIA-001", // retired Sept 2026 — merged into AIA-001 (WhatsApp folded into the assistant offering)
  "UKZ-CS-001": "UKZ-ITS-001", "UKZ-CS-002": "UKZ-ITS-004", "UKZ-CS-003": "UKZ-DPE-004",
  "UKZ-CS-004": "UKZ-ITS-003", "UKZ-CS-005": null, "UKZ-CS-006": "UKZ-ITS-005",
  "UKZ-CS-007": "UKZ-ITS-004", "UKZ-CS-008": "UKZ-ITS-002", "UKZ-CS-009": null,
  "UKZ-CS-010": "UKZ-ITS-002", "UKZ-CS-011": "UKZ-ITS-002", "UKZ-CS-012": null,
  "UKZ-BD-001": null, "UKZ-BD-002": null, "UKZ-BD-003": null, "UKZ-BD-004": null,
  "UKZ-BD-005": null, "UKZ-BD-006": null, "UKZ-BD-007": "UKZ-DPE-002", "UKZ-BD-008": "UKZ-DPE-002",
  "UKZ-BD-009": "UKZ-DPE-001", "UKZ-BD-010": null, "UKZ-BD-011": null, "UKZ-BD-012": null,
  "UKZ-BD-013": null, "UKZ-BD-014": null,
  "UKZ-IC-001": null, "UKZ-IC-002": "UKZ-CAM-001", "UKZ-IC-003": null, "UKZ-IC-004": null,
  "UKZ-IC-005": null, "UKZ-IC-006": "UKZ-CAM-005", "UKZ-IC-007": null, "UKZ-IC-008": "UKZ-CAM-001",
  "UKZ-IC-009": "UKZ-CAM-001", "UKZ-IC-010": "UKZ-CAM-001", "UKZ-IC-011": "UKZ-CAM-004",
  "UKZ-IC-012": "UKZ-AIA-003", "UKZ-IC-013": "UKZ-CAM-002", "UKZ-IC-014": "UKZ-CAM-005",
  "UKZ-IC-015": "UKZ-CAM-003", "UKZ-IC-016": null,
  "UKZ-WD-001": "UKZ-DPE-002", "UKZ-WD-002": "UKZ-DPE-002", "UKZ-WD-003": "UKZ-DPE-002",
  "UKZ-WD-004": null, "UKZ-WD-005": "UKZ-DPE-002", "UKZ-WD-006": "UKZ-DPE-004",
  "UKZ-WD-007": "UKZ-AIA-003", "UKZ-WD-008": "UKZ-AIA-003", "UKZ-WD-009": "UKZ-AIA-001",
  "UKZ-WD-010": "UKZ-AIA-001", "UKZ-WD-011": "UKZ-AIA-004", "UKZ-WD-012": "UKZ-AIA-005",
  "UKZ-WD-013": "UKZ-AIA-003", "UKZ-WD-014": null, "UKZ-WD-015": null, "UKZ-WD-016": null,
  "UKZ-WD-017": null, "UKZ-WD-018": "UKZ-CAM-004",
  "UKZ-ET-001": "UKZ-ITS-003", "UKZ-ET-002": null, "UKZ-ET-003": null, "UKZ-ET-004": null,
  "UKZ-ET-005": null, "UKZ-ET-006": null, "UKZ-ET-007": null, "UKZ-ET-008": null,
  "UKZ-ET-009": null, "UKZ-ET-010": null, "UKZ-ET-011": null, "UKZ-ET-012": "UKZ-ITS-005",
  "UKZ-MS-001": "UKZ-DPE-006", "UKZ-MS-002": "UKZ-DPE-006", "UKZ-MS-003": "UKZ-DPE-006",
  "UKZ-MS-004": "UKZ-DPE-006", "UKZ-MS-005": null, "UKZ-MS-006": null, "UKZ-MS-007": null,
  "UKZ-MS-008": "UKZ-CAM-005", "UKZ-MS-009": "UKZ-ITS-005", "UKZ-MS-010": "UKZ-DPE-006",
}

const LEGACY_PREFIX_TO_CATEGORY = {
  CS: "it-strategy-consulting", BD: "digital-product-engineering", IC: "cloud-architecture-migration",
  WD: "digital-product-engineering", ET: "it-strategy-consulting", MS: "digital-product-engineering",
}

export const getCategoryByCode = (code) => CATEGORIES.find((c) => c.code === code) || null

export function getOfferingBySlug(slug) {
  if (!slug) return null
  const needle = String(slug).toLowerCase()
  for (const category of CATEGORIES) {
    const offering = category.offerings.find(
      (o) => o.slug === needle || o.id.toLowerCase() === needle,
    )
    if (offering) return { ...offering, category }
  }
  return null
}

/**
 * Resolve any slug (new category, new offering, legacy category slug, legacy
 * SKU id) to the new category slug. Returns null when nothing matches.
 */
export function resolveLegacySlug(slug) {
  if (!slug) return null
  const needle = String(slug).toLowerCase()
  const direct = CATEGORIES.find((c) => c.slug === needle)
  if (direct) return direct.slug
  const offering = getOfferingBySlug(needle)
  if (offering) return offering.category.slug
  if (LEGACY_CATEGORY_SLUG_MAP[needle]) return LEGACY_CATEGORY_SLUG_MAP[needle]
  const upper = String(slug).toUpperCase()
  if (upper in legacyIdMap) {
    const mapped = legacyIdMap[upper]
    if (mapped) return getOfferingBySlug(mapped)?.category.slug || null
    const prefix = upper.split("-")[1]
    return LEGACY_PREFIX_TO_CATEGORY[prefix] || null
  }
  return null
}

export function getCategoryBySlug(slug) {
  const resolved = resolveLegacySlug(slug)
  return resolved ? CATEGORIES.find((c) => c.slug === resolved) || null : null
}

/* ── Funnel: single CTA everywhere ──────────────────────────────────────── */
export const bookHref = (slug) => (slug ? `/book?service=${encodeURIComponent(slug)}` : "/book")

export const HOW_IT_WORKS = [
  { id: "call", step: "01", Icon: Calendar, title: "30-minute call", titleEs: "Llamada de 30 min",
    body: "Free. We diagnose the situation and agree on whether there is a fit.",
    bodyEs: "Gratis. Diagnosticamos la situación y acordamos si hay encaje." },
  { id: "proposal", step: "02", Icon: FileText, title: "Written proposal", titleEs: "Propuesta escrita",
    body: "Scope, timeline and price in one document, usually within 3 business days.",
    bodyEs: "Alcance, plazos y precio en un solo documento, normalmente en 3 días hábiles." },
  { id: "delivery", step: "03", Icon: ShieldCheck, title: "Delivery", titleEs: "Entrega",
    body: "Weekly sync, written status every Friday, runbooks at handover.",
    bodyEs: "Sincronización semanal, estatus escrito cada viernes y manuales en la entrega." },
]

/* ── Per-category FAQ (3–5 each) ────────────────────────────────────────── */
export const CATEGORY_FAQS = {
  "it-strategy-consulting": [
    { id: "who", q: "Is this only for companies with an IT department?", qEs: "¿Es solo para empresas con departamento de TI?",
      a: "No. Most clients are SMEs with 5–80 people and no internal IT lead. The engagement replaces that role for the duration.",
      aEs: "No. La mayoría de los clientes son PyMEs de 5 a 80 personas sin un líder de TI interno. El servicio cubre ese rol durante el proyecto." },
    { id: "vendor", q: "Do you resell software or earn vendor commissions?", qEs: "¿Revendes software o cobras comisiones de proveedores?",
      a: "No. Recommendations are independent; you pay for the advice, not for a product I am paid to push.",
      aEs: "No. Las recomendaciones son independientes; pagas por la asesoría, no por un producto que me paguen por impulsar." },
    { id: "lfpdppp", q: "Does the compliance assessment cover LFPDPPP?", qEs: "¿La evaluación de cumplimiento cubre la LFPDPPP?",
      a: "Yes. The architecture audit maps personal data flows against the Mexican privacy law and produces a remediation roadmap.",
      aEs: "Sí. La auditoría de arquitectura mapea los flujos de datos personales contra la ley mexicana de privacidad y produce una hoja de ruta de remediación." },
    { id: "cto-min", q: "What is the minimum for the fractional CTO engagement?", qEs: "¿Cuál es el mínimo para la participación fraccional de CTO?",
      a: "Three months, so roadmap decisions have time to land. Cancel with 30 days' notice after that.",
      aEs: "Tres meses, para que las decisiones de la hoja de ruta tengan tiempo de asentarse. Después, cancela con 30 días de aviso." },
  ],
  "ai-automation": [
    { id: "data", q: "Where does our data go when you build a bot or a RAG system?", qEs: "¿A dónde van nuestros datos cuando construyes un bot o un sistema RAG?",
      a: "Into infrastructure you own (your cloud account and your vector database). Model providers are configured with no-training terms.",
      aEs: "A infraestructura que tú posees (tu cuenta en la nube y tu base vectorial). Los proveedores de modelos se configuran con términos de no entrenamiento." },
    { id: "whatsapp", q: "Do we need the official WhatsApp Business API?", qEs: "¿Necesitamos la API oficial de WhatsApp Business?",
      a: "Yes, for anything automated. Setup and Meta verification are included in the engagement.",
      aEs: "Sí, para cualquier automatización. La configuración y la verificación de Meta están incluidas en el servicio." },
    { id: "tools", q: "Make, Zapier or custom code?", qEs: "¿Make, Zapier o código a medida?",
      a: "Make or Zapier when the volume is modest and speed matters; custom code when you need reliability at scale or non-standard logic.",
      aEs: "Make o Zapier cuando el volumen es moderado y la velocidad importa; código a medida cuando necesitas fiabilidad a escala o lógica no estándar." },
    { id: "maint", q: "What happens when a model or an API changes?", qEs: "¿Qué pasa cuando cambia un modelo o una API?",
      a: "Every build ships with an evaluation set and monitoring. Managed Maintenance covers the updates month to month.",
      aEs: "Cada construcción incluye un conjunto de evaluación y monitoreo. El Mantenimiento gestionado cubre las actualizaciones mes a mes." },
  ],
  "cloud-architecture-migration": [
    { id: "provider", q: "AWS, Azure or GCP?", qEs: "¿AWS, Azure o GCP?",
      a: "Whichever fits your team, licences and budget. I have shipped production workloads on all three and will recommend one on the call.",
      aEs: "El que encaje con tu equipo, licencias y presupuesto. He publicado cargas en producción en los tres y recomendaré uno en la llamada." },
    { id: "downtime", q: "Will the migration take us offline?", qEs: "¿La migración nos dejará fuera de línea?",
      a: "Cutover is planned outside business hours with a rehearsed rollback. Typical downtime is minutes, not days.",
      aEs: "El corte se planifica fuera del horario laboral con una reversión ensayada. El tiempo de inactividad típico es de minutos, no días." },
    { id: "savings", q: "How much will right-sizing save us?", qEs: "¿Cuánto nos ahorrará el redimensionamiento?",
      a: "It depends on how over-provisioned the current deployment is. The audit measures your real usage and quantifies the figure before you commit to any change — no number is promised up front.",
      aEs: "Depende de cuánto sobredimensionamiento tenga el despliegue actual. La auditoría mide tu uso real y cuantifica la cifra antes de que te comprometas a cualquier cambio; no se promete ninguna cifra por adelantado." },
    { id: "drtest", q: "How do we know the backups work?", qEs: "¿Cómo sabemos que los respaldos funcionan?",
      a: "Every DR engagement ends with a live restore drill you watch, plus a runbook your team can repeat.",
      aEs: "Cada proyecto de DR termina con un simulacro de restauración en vivo que observas, más un manual que tu equipo puede repetir." },
  ],
  "digital-product-engineering": [
    { id: "stack", q: "Which stack do you build on?", qEs: "¿Con qué tecnologías construyes?",
      a: "React and Node or Django for web, React Native for mobile, PostgreSQL, deployed on GCP or AWS. Other stacks by agreement.",
      aEs: "React y Node o Django para web, React Native para móvil, PostgreSQL, desplegado en GCP o AWS. Otras tecnologías por acuerdo." },
    { id: "own", q: "Who owns the code?", qEs: "¿Quién es dueño del código?",
      a: "You do, from the first commit. Repositories live in your organisation and IP assignment is in the contract.",
      aEs: "Tú, desde el primer commit. Los repositorios viven en tu organización y la cesión de propiedad intelectual está en el contrato." },
    { id: "mvp", q: "How fast is an MVP?", qEs: "¿Qué tan rápido es un MVP?",
      a: "Four to ten weeks after scope is signed, depending on integrations. The wireframing sprint before it removes most surprises.",
      aEs: "De cuatro a diez semanas después de firmar el alcance, según las integraciones. El sprint de wireframing previo elimina la mayoría de las sorpresas." },
    { id: "after", q: "What happens after launch?", qEs: "¿Qué pasa después del lanzamiento?",
      a: "Thirty days of support are included. After that, Managed Maintenance keeps the product patched and shipping features monthly.",
      aEs: "Se incluyen treinta días de soporte. Después, el Mantenimiento gestionado mantiene el producto parchado y publicando funciones cada mes." },
  ],
}

/* ── Trust strip credentials ────────────────────────────────────────────── */
export const CREDENTIALS = [
  { id: "google-l2", label: "Google Certified Educator L2", issuer: "Google", type: "certification", Icon: Award },
  { id: "google-it", label: "Google IT Support Professional", issuer: "Google", type: "certification", Icon: ShieldCheck },
  { id: "meta-fe", label: "Meta Front-End Developer", issuer: "Meta", type: "certification", Icon: Award },
  { id: "msc", label: "MSc · Software Engineering (in progress)", issuer: "UNEATLANTICO", type: "academic", Icon: BookMarked },
  { id: "bsc", label: "BEd · IT, Distinction", issuer: "AUCA, Rwanda", type: "academic", Icon: BookMarked },
  { id: "raindrop", label: "Colegio de Excelencia Raindrop", issuer: "IT Manager · CS Teacher", type: "institution", Icon: ShieldCheck },
  { id: "intellectual", label: "Intellectual Schools, Ethiopia", issuer: "ICT Director (2021)", type: "institution", Icon: ShieldCheck },
  { id: "design-office", label: "Design Office of Africa", issuer: "Project Manager (2022)", type: "institution", Icon: ShieldCheck },
]

/* ── Differentiation pillars ────────────────────────────────────────────── */
export const DIFFERENTIATION_PILLARS = [
  { id: "international", title: "International Reach", claim: "Four countries, three continents, one delivery standard",
    support: "Production track record across Rwanda, Turkey, Ethiopia, and Mexico, with over eight years of shipping reliable systems.", proof: "8+ years", accent: "violet", Icon: Globe2 },
  { id: "bilingual", title: "Bilingual Delivery", claim: "Bilingual delivery as a default, not an upcharge",
    support: "Technical artifacts in English, Spanish, or Turkish. You choose the language, with no translation overhead.", proof: "EN · ES · TR", accent: "terracotta", Icon: Languages },
  { id: "solo-senior", title: "Senior Solo Execution", claim: "You brief me; I write the code and the runbooks.",
    support: "No junior handoffs, no agency overhead, no telephone game between specs and shipping.", proof: "No handoffs", accent: "azure", Icon: UserCheck },
  { id: "documented", title: "Documented Handover", claim: "Every engagement ends with runbooks, not just code",
    support: "Architecture diagrams, deployment runbooks, and clean knowledge transfer included by default.", proof: "Runbooks included", accent: "violet", Icon: FileText },
]

/* ── Services-wide FAQ (overview page) ──────────────────────────────────── */
export const SERVICES_FAQ_ITEMS = [
  { id: "start", category: "Engagement", question: "Where do I start if I'm not sure which service I need?",
    answer: "Book the 30-minute call. The first job is a clear diagnosis, even if we do not end up working together." },
  { id: "pricing", category: "Pricing", question: "How is pricing structured?",
    answer: "Every offering shows an indicative starting price in both US dollars and Mexican pesos, based on a $30 USD/hour minimum rate. Audits and the wireframing sprint are fixed price; bespoke builds, migrations, and retainers show a starting price, confirmed in the written proposal once scope is set." },
  { id: "nda", category: "Engagement", question: "Do you sign NDAs?", answer: "Yes, before scoping. Bring your template or use mine." },
  { id: "geo", category: "Reach", question: "Do you work outside Mexico?",
    answer: "Yes. Operation is 100 % remote, with on-site sessions in CDMX or Estado de México when they add value." },
  { id: "direct", category: "Engagement", question: "Will I work directly with you?",
    answer: "Yes, on every engagement. No junior handoffs, no account managers." },
]

export const FAQ_CONTACT_ACTIONS = [
  { Icon: Calendar, title: "Book a 30-min call", desc: "Free · no commitment · clear next step.", to: "/book" },
  { Icon: Mail, title: "Email me directly", desc: "hello@mustaphaukizuru.com", to: "mailto:hello@mustaphaukizuru.com", external: true },
  { Icon: Phone, title: "WhatsApp / Telegram", desc: "Async-friendly, fast turnaround.", to: "https://wa.me/+525552139993", external: true },
]

export const CATALOG_STATS = {
  totalServices: SERVICES.length,
  flagshipCount: SERVICES.filter((s) => s.tier === 1).length,
  categoryCount: CATEGORIES.length,
  audienceCount: Object.keys(AUDIENCE_LABELS).length,
}

/* ════════════════════════════════════════════════════════════════════════
   AUDIENCE_PRICING_PLANS · fixed-price packages (existing checkout keeps
   working: /checkout/service?audience=<code>&tier=<key>). Unchanged.
   ════════════════════════════════════════════════════════════════════════ */
export const AUDIENCE_PRICING_PLANS = {
  professional: {
    code: "professional",
    name: "Professional",
    short: "For independent experts",
    description: "For consultants, freelancers, and solo professionals building a credible digital presence.",
    Icon: User,
    accent: "violet",
    features: [
      "Custom personal-brand identity and visual system",
      "Premium domain and production website (up to 8 pages)",
      "SEO architecture, schema markup, and search optimization",
      "Privacy-compliant analytics and conversion dashboards",
      "Email newsletter and automated lead-capture funnel",
      "Portfolio and case-study showcase pages",
      "Online booking and calendar integration",
      "Automated client-onboarding workflow",
      "Invoicing and payment-processor setup (PayPal + MercadoPago)",
      "AI-assisted content production system and prompt library",
      "Multi-platform social presence kit and templates",
      "Conversion-optimized landing pages and A/B testing",
      "Quarterly brand-strategy and positioning review",
      "Monthly performance, growth, and traffic report",
      "Priority email support with 24-hour response SLA",
      "Dedicated 1:1 monthly strategy session",
    ],
    tiers: {
      basic: {
        name: "Basic",
        priceUsd: 290,
        priceMxn: 5800,
        period: "month",
        saveLabel: "Best to start",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, false, false, false, false, false, false, false, false, false],
      },
      medium: {
        name: "Medium",
        priceUsd: 590,
        priceMxn: 11800,
        period: "month",
        saveLabel: "Save 20%",
        popular: true,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false],
      },
      advanced: {
        name: "Advanced",
        priceUsd: 990,
        priceMxn: 19800,
        period: "month",
        saveLabel: "All-inclusive",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
      },
    },
  },

  business: {
    code: "business",
    name: "Business",
    short: "For SMBs and growth-stage teams",
    description: "For growing companies that need a complete digital operating system: brand, web, infrastructure, and operations.",
    Icon: Briefcase,
    accent: "terracotta",
    features: [
      "Custom corporate website with multi-language headless CMS",
      "Full brand identity and corporate visual system",
      "Branded email, professional domain, and DNS configuration",
      "CRM integration and contact-pipeline automation",
      "SEO program and inbound content strategy",
      "Marketing automation, nurture flows, and segmented campaigns",
      "Payment-processor integration (MercadoPago + PayPal + invoicing)",
      "E-commerce storefront, product catalog, and checkout funnel",
      "Customer-support helpdesk and ticket workflows",
      "Team collaboration, file-sharing, and intranet platform",
      "Identity and access management (SSO + MFA + RBAC)",
      "Cloud hosting with monitored uptime and CDN",
      "Automated backups, restores, and disaster-recovery runbooks",
      "Real-time analytics and business-intelligence dashboards",
      "Quarterly business review and strategic roadmap session",
      "Dedicated account manager and customer-success contact",
      "24/7 incident response with 4-hour critical SLA",
      "On-demand strategic advisory and architecture hours",
    ],
    tiers: {
      basic: {
        name: "Basic",
        priceUsd: 890,
        priceMxn: 17800,
        period: "month",
        saveLabel: "Launch-ready",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, false, false, false, false, false, false, false, false, false],
      },
      medium: {
        name: "Medium",
        priceUsd: 1890,
        priceMxn: 37800,
        period: "month",
        saveLabel: "Save 20%",
        popular: true,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false],
      },
      advanced: {
        name: "Advanced",
        priceUsd: 3500,
        priceMxn: 70000,
        period: "month",
        saveLabel: "Enterprise-grade",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
      },
    },
  },

  schools: {
    code: "schools",
    name: "Schools",
    short: "For K-12, higher ed, and training institutions",
    description: "For schools, colleges, and training institutions modernizing teaching, learning, and operations end to end.",
    Icon: GraduationCap,
    accent: "mint",
    features: [
      "LMS deployment, configuration, and content migration program",
      "Google Workspace for Education tenant setup and policies",
      "Smart classroom configuration and AV integration",
      "STEM lab, robotics, and maker-space curriculum implementation",
      "Faculty professional-development cohort (8 sessions)",
      "Student onboarding and digital-literacy curriculum",
      "Bilingual content library (English and Spanish)",
      "AI acceptable-use policy and ethics framework",
      "Parent and community engagement portal",
      "Attendance, gradebook, and SIS automation and integration",
      "Network security, content filtering, and CIPA compliance",
      "Device management for Chromebooks, iPads, and BYOD",
      "Data privacy audit and FERPA / GDPR compliance program",
      "Bilingual leadership development and admin training",
      "Quarterly board-level strategic review",
      "Six-month post-deployment administrative support",
      "Emergency response with same-day on-site SLA",
      "Innovation lab and maker-space program design",
    ],
    tiers: {
      basic: {
        name: "Basic",
        priceUsd: 1200,
        priceMxn: 24000,
        period: "month",
        saveLabel: "Foundations",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, false, false, false, false, false, false, false, false, false],
      },
      medium: {
        name: "Medium",
        priceUsd: 2400,
        priceMxn: 48000,
        period: "month",
        saveLabel: "Save 20%",
        popular: true,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, false, false, false, false],
      },
      advanced: {
        name: "Advanced",
        priceUsd: 4500,
        priceMxn: 90000,
        period: "month",
        saveLabel: "Whole-institution",
        popular: false,
        cta: "Choose Plan",
        includes: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true],
      },
    },
  },
}

/* Order used to render the audience toggle (left to right) */
export const AUDIENCE_PRICING_ORDER = ["professional", "business", "schools"]
