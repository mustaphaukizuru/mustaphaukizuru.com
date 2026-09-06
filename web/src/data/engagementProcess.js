/* ════════════════════════════════════════════════════════════════════════
   engagementProcess.js · the full six-step process (T2-9)
   ────────────────────────────────────────────────────────────────────────
   Its own module, not part of servicesCatalogue.js, for a measured reason:
   servicesCatalogue is on the homepage's critical path, and this content —
   six steps, a submission table, two delivery modes and five access rules,
   all in two languages — put first paint 6.6 KB over the budget that
   web/e2e/first-paint-payload.spec.js enforces. Only /how-we-work and the
   catalogue generator import it.

   The three-step summary on /services stays in servicesCatalogue.js and is
   checked against these six by engagementProcess.test.js, so the short and
   long versions cannot drift without failing a test.
   ════════════════════════════════════════════════════════════════════════ */
import {
  FileText, KeyRound, MapPin, PackageCheck, PenLine, Send, Video,
} from "lucide-react"

/* ════════════════════════════════════════════════════════════════════════
   Content (T2-9)
   ────────────────────────────────────────────────────────────────────────
   Ported from docs/catalogue/engagement-process-content.md, which rewrote
   the internal Client Engagement Guide for a prospect audience. None of it
   was on the site: the Services page showed three steps of one sentence
   each, so someone arriving from a proposal link had no way to see what
   they were agreeing to before signing.

   The commitments in here are load-bearing and are quoted elsewhere:
   response within 1 business day, proposal within 3 business days,
   proposals valid 14 days, kickoff within 5 business days of the deposit,
   feedback within 2 business days, a 30-day support window. T2-4's SLA
   rewrite uses the same figures deliberately — "next-business-day
   response" here and in the plan features, so the process page and the
   package feature list cannot contradict each other.

   Spanish is the tu register (ADR 0004) and is authored, not translated.
   ════════════════════════════════════════════════════════════════════════ */
export const HOW_IT_WORKS_DETAILED = [
  {
    id: "request",
    step: "01",
    Icon: Send,
    title: "Submit a request",
    titleEs: "Envía una solicitud",
    summary: "Tell me which offering interests you and what problem you are solving. No technical detail needed yet.",
    summaryEs: "Cuéntame qué servicio te interesa y qué problema quieres resolver. Todavía no hace falta detalle técnico.",
    how: "The contact form on the Services page, email to hello@mustaphaukizuru.com, or WhatsApp.",
    howEs: "El formulario de contacto en la página de Servicios, un correo a hello@mustaphaukizuru.com o WhatsApp.",
    when: "Any time — response within 1 business day.",
    whenEs: "Cuando quieras: respondo en 1 día hábil.",
    include: "Which offering or category interests you, a one-paragraph description of the problem or goal, and your organisation type (business, school, individual). Technical detail is what the discovery call is for.",
    includeEs: "Qué servicio o categoría te interesa, una descripción del problema o la meta en un párrafo, y tu tipo de organización (empresa, escuela, persona). El detalle técnico es justo para lo que sirve la llamada.",
  },
  {
    id: "call",
    step: "02",
    Icon: Video,
    title: "Discovery call",
    titleEs: "Llamada de diagnóstico",
    summary: "Thirty minutes to confirm scope, constraints and timeline. Free, and it ends with a clear next step either way.",
    summaryEs: "Treinta minutos para confirmar alcance, restricciones y plazos. Gratis, y termina con un siguiente paso claro en cualquier caso.",
    how: "A 30-minute video call on Google Meet, Zoom or Teams.",
    howEs: "Videollamada de 30 minutos por Google Meet, Zoom o Teams.",
    when: "No cost, no obligation.",
    whenEs: "Sin costo y sin compromiso.",
    include: "Whoever will make the final decision on scope and budget. It ends with either a written proposal, or — if the request is out of scope — a referral or an honest no.",
    includeEs: "Quien vaya a decidir sobre alcance y presupuesto. Termina con una propuesta escrita o, si la solicitud queda fuera de alcance, con una recomendación o un no honesto.",
  },
  {
    id: "proposal",
    step: "03",
    Icon: FileText,
    title: "Written proposal",
    titleEs: "Propuesta escrita",
    summary: "Scope, deliverables, price in both currencies, payment schedule, timeline and delivery modality, in one document.",
    summaryEs: "Alcance, entregables, precio en ambas monedas, calendario de pagos, plazos y modalidad de entrega, en un solo documento.",
    how: "Delivered within 3 business days of the discovery call.",
    howEs: "Se entrega dentro de los 3 días hábiles siguientes a la llamada.",
    when: "Valid for 14 days.",
    whenEs: "Válida durante 14 días.",
    include: "Exact scope and deliverables, price in USD and MXN, payment schedule, estimated timeline, and whether delivery is remote or on-site.",
    includeEs: "Alcance y entregables exactos, precio en USD y MXN, calendario de pagos, plazos estimados y si la entrega es remota o presencial.",
  },
  {
    id: "agreement",
    step: "04",
    Icon: PenLine,
    title: "Agreement and deposit",
    titleEs: "Acuerdo y anticipo",
    summary: "A short service agreement is signed and the deposit is paid before work is scheduled. The NDA is signed here, ahead of any access.",
    summaryEs: "Se firma un acuerdo de servicio breve y se paga el anticipo antes de agendar el trabajo. El NDA se firma aquí, antes de cualquier acceso.",
    how: "Signature on the agreement, then the deposit specified in the proposal.",
    howEs: "Firma del acuerdo y luego el anticipo indicado en la propuesta.",
    when: "Before work is scheduled.",
    whenEs: "Antes de agendar el trabajo.",
    include: "Legal or trade name, billing contact, tax ID (RFC) if you need a CFDI invoice, and signing authority.",
    includeEs: "Razón social o nombre comercial, contacto de facturación, RFC si necesitas factura CFDI, y quién tiene facultad de firma.",
  },
  {
    id: "kickoff",
    step: "05",
    Icon: KeyRound,
    title: "Kickoff and access",
    titleEs: "Arranque y accesos",
    summary: "A kickoff call within 5 business days of the deposit clearing, and any system access granted under least privilege.",
    summaryEs: "Llamada de arranque dentro de los 5 días hábiles posteriores al anticipo, y los accesos necesarios bajo el principio de menor privilegio.",
    how: "Scoped, named-collaborator access — never a shared password — wherever the platform supports it.",
    howEs: "Accesos acotados y nominales, nunca una contraseña compartida, siempre que la plataforma lo permita.",
    when: "Within 5 business days of the deposit clearing.",
    whenEs: "Dentro de los 5 días hábiles posteriores a que se acredite el anticipo.",
    include: "Primary contact, technical contact if different, confirmed modality, and any brand assets or existing documentation relevant to the work.",
    includeEs: "Contacto principal, contacto técnico si es otro, modalidad confirmada, y los recursos de marca o documentación existente que sean relevantes.",
  },
  {
    id: "delivery",
    step: "06",
    Icon: PackageCheck,
    title: "Delivery and handover",
    titleEs: "Entrega y cierre",
    summary: "Weekly status against the agreed timeline, then a formal handover with documentation and a 30-day support window.",
    summaryEs: "Estatus semanal contra el plan acordado y, al final, una entrega formal con documentación y 30 días de soporte.",
    how: "A weekly status update — async, or a short sync call on larger engagements.",
    howEs: "Un estatus semanal, asincrónico o con una llamada breve en proyectos más grandes.",
    when: "Feedback within 2 business days keeps the schedule on track.",
    whenEs: "Tu retroalimentación en 2 días hábiles mantiene el calendario en pie.",
    include: "Handover means documentation, credentials transferred or revoked as agreed, and 30 days of support on the delivered work. Feedback speed is the single biggest factor in whether a project lands on time.",
    includeEs: "El cierre incluye documentación, credenciales transferidas o revocadas según lo acordado, y 30 días de soporte sobre lo entregado. La rapidez de tu retroalimentación es el factor que más pesa en si el proyecto llega a tiempo.",
  },
]

/* What a client supplies, by stage. The rows are the same six steps plus
   delivery, so a reader can see the whole ask before committing to any of
   it. T5-13's request presets ask for exactly these. */
export const SUBMIT_BY_STAGE = [
  {
    id: "request",
    stage: "Initial request",
    stageEs: "Solicitud inicial",
    needs: "Offering of interest, problem description, organisation type",
    needsEs: "Servicio de interés, descripción del problema, tipo de organización",
  },
  {
    id: "call",
    stage: "Discovery call",
    stageEs: "Llamada de diagnóstico",
    needs: "Whoever will make the final decision on scope and budget",
    needsEs: "Quien decida sobre alcance y presupuesto",
  },
  {
    id: "proposal",
    stage: "Proposal acceptance",
    stageEs: "Aceptación de la propuesta",
    needs: "Legal or trade name, billing contact, tax ID (RFC) if a CFDI invoice is needed, signing authority",
    needsEs: "Razón social o nombre comercial, contacto de facturación, RFC si necesitas factura CFDI, facultad de firma",
  },
  {
    id: "agreement",
    stage: "Agreement and deposit",
    stageEs: "Acuerdo y anticipo",
    needs: "Signature, deposit payment",
    needsEs: "Firma y pago del anticipo",
  },
  {
    id: "kickoff",
    stage: "Kickoff",
    stageEs: "Arranque",
    needs: "Primary contact, technical contact if different, confirmed modality, brand assets or existing documentation",
    needsEs: "Contacto principal, contacto técnico si es otro, modalidad confirmada, recursos de marca o documentación existente",
  },
  {
    id: "delivery",
    stage: "During delivery",
    stageEs: "Durante la entrega",
    needs: "Timely feedback, a reachable decision-maker",
    needsEs: "Retroalimentación oportuna y una persona que pueda decidir",
  },
]

/* Remote by default, and the two cases that are not. Named here rather than
   implied, because "do you come on site?" is asked on nearly every school
   call and the answer costs money if it is assumed either way. */
export const DELIVERY_MODALITY = [
  {
    id: "remote",
    Icon: Video,
    title: "Remote by default",
    titleEs: "Remoto por defecto",
    body: "Every offering across all four categories is delivered online — video call, screen share, shared documentation. It schedules faster, leaves a written record, and costs less.",
    bodyEs: "Todos los servicios de las cuatro categorías se entregan en línea: videollamada, pantalla compartida y documentación compartida. Se agenda más rápido, deja constancia escrita y cuesta menos.",
  },
  {
    id: "onsite",
    Icon: MapPin,
    title: "On-site where the work needs hands",
    titleEs: "Presencial cuando el trabajo lo exige",
    body: "Two cases: physical network hardware that cannot be assessed remotely — On-Premise to Cloud Migration and Zero-Trust Security Hardening — and schools with device fleets, smart-classroom installation or in-person staff training. On-site work is scoped and priced separately in the proposal; it is never assumed.",
    bodyEs: "Dos casos: hardware de red físico que no se puede evaluar en remoto —Migración a la Nube y Endurecimiento Zero-Trust— y escuelas con flotas de equipos, instalación de aulas inteligentes o capacitación presencial. Lo presencial se cotiza aparte en la propuesta; nunca se da por hecho.",
    offerings: ["on-premise-to-cloud-migration", "zero-trust-security-hardening"],
  },
]

/* Trust is earned before access is granted, not after. T4-1's reviewer
   grades this posture, so it says what is actually done rather than what
   sounds reassuring. */
export const ACCESS_PRIVACY = [
  {
    id: "least-privilege",
    title: "Least privilege",
    titleEs: "Menor privilegio",
    body: "Named-collaborator invites are the default — a GitHub collaborator role, a scoped GCP or AWS IAM role, a Google Workspace admin role. Never a shared root login. Where a platform has no scoped role, a password-manager vault is used instead of a plain-text credential.",
    bodyEs: "Lo normal son invitaciones nominales: rol de colaborador en GitHub, un rol IAM acotado en GCP o AWS, un rol de administrador en Google Workspace. Nunca un acceso raíz compartido. Si la plataforma no tiene roles acotados, se usa una bóveda de gestor de contraseñas en lugar de una credencial en texto plano.",
  },
  {
    id: "nda",
    title: "NDA first",
    titleEs: "NDA primero",
    body: "A mutual non-disclosure agreement is signed before any credential or system access is granted, whatever the engagement size.",
    bodyEs: "Se firma un acuerdo mutuo de confidencialidad antes de entregar cualquier credencial o acceso, sin importar el tamaño del proyecto.",
  },
  {
    id: "revoked",
    title: "Reviewed and revoked",
    titleEs: "Revisado y revocado",
    body: "Access is reviewed at handover and revoked unless the engagement continues as an active retainer.",
    bodyEs: "Los accesos se revisan en la entrega y se revocan salvo que el proyecto continúe como retainer activo.",
  },
  {
    id: "lfpdppp",
    title: "LFPDPPP compliance",
    titleEs: "Cumplimiento LFPDPPP",
    body: "Personal data handled during an engagement is processed under Mexico's Federal Law on Protection of Personal Data Held by Private Parties.",
    bodyEs: "Los datos personales que se manejen durante un proyecto se tratan conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
    href: "/privacy",
  },
  {
    id: "ai-subprocessors",
    title: "AI sub-processors are named",
    titleEs: "Los sub-procesadores de IA se nombran",
    body: "For AI Integration and Workflow Automation work, any third-party model or API that processes your data is named in the proposal before work begins. No undisclosed sub-processors.",
    bodyEs: "En los proyectos de Integración con IA y Automatización, cualquier modelo o API de terceros que procese tus datos se nombra en la propuesta antes de empezar. Sin sub-procesadores ocultos.",
    href: "/services/ai-automation",
  },
]
