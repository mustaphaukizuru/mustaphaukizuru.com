/**
 * auditData.js — the self-audit instrument (rebuilt, T2-3).
 *
 * WHAT WAS WRONG
 *
 * The old instrument had 82 statements in six sections keyed to the SKU
 * taxonomy that preceded the closed set of four categories. 38 of those 82
 * pointed at offerings that no longer exist — a visitor could score badly on
 * "Brand & Digital Presence" and be pointed at a service the site does not
 * sell. Every statement was English-only, so a Spanish visitor answered an
 * English questionnaire. And SOLUTIONS/matchBundle recommended bespoke
 * programmes with USD ranges that appear nowhere else on the site; two of
 * them were composed entirely of retired ids and could not be delivered.
 *
 * WHAT IT IS NOW
 *
 * 32 statements across the four catalogue categories. Every statement names
 * the offering that closes the gap, by slug, and that slug must resolve
 * through getOfferingBySlug() — the test in auditData.test.js is what
 * enforces it. So the result screen is a real funnel entry: the same slug
 * feeds /services/:category#offering and /book?service=<slug>.
 *
 * Item shape — objects, not tuples. The old eight-position tuple meant
 * `it[5]` was the audience list and `it[6]` was the risk, which is
 * unreadable at every call site and is part of why the retired ids survived
 * so long inside it.
 *
 *   id            "ITS.1"
 *   offeringSlug  the offering that closes this gap
 *   statement     what the visitor rates 0–4
 *   statementEs   the same, authored in Spanish (tú register, ADR 0004)
 *   risk          what happens if the gap is not closed
 *   riskEs
 *   audiences     who is asked — a SUBSET of the offering's own audiences,
 *                 because a priority recommends that offering, and
 *                 recommending a service to an audience it is not sold to is
 *                 the drift this rebuild exists to remove
 *   weight        1–3, how much a gap here costs. Breaks ties after score.
 *
 * Section titles are NOT written here: they come from CATEGORIES, so the
 * audit cannot name a category differently from the rest of the site.
 */
import {
  CATEGORIES,
  getCategoryByCode,
  getOfferingBySlug,
} from "./servicesCatalogue"

/* ── Statements, by category code ────────────────────────────────────────
 * Roughly one and a half per offering: the offerings whose absence costs
 * most carry two, covering different failure modes, so a visitor who is
 * fine on one can still surface the other.
 */
const ITEMS = {
  ITS: [
    {
      id: "ITS.1",
      offeringSlug: "software-stack-audit",
      statement: "We know what every software subscription costs us and who uses it, and we have reviewed that list in the last twelve months.",
      statementEs: "Sabemos cuánto nos cuesta cada suscripción de software y quién la usa, y revisamos esa lista en los últimos doce meses.",
      risk: "Duplicate and unused licences accumulate quietly. Most teams find they are paying for two tools that do the same job, and for people who left.",
      riskEs: "Las licencias duplicadas y sin usar se acumulan en silencio. Casi siempre aparecen dos herramientas que hacen lo mismo, y pagos por gente que ya no está.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "ITS.2",
      offeringSlug: "digital-transformation-roadmap",
      statement: "We have a written twelve-month technology plan with priorities and a budget, not just a list of things that are broken.",
      statementEs: "Tenemos un plan tecnológico escrito a doce meses, con prioridades y presupuesto, no sólo una lista de cosas descompuestas.",
      risk: "Without a sequence, spending goes to whatever broke most recently. The important work never starts because there is always something on fire.",
      riskEs: "Sin una secuencia, el gasto se va a lo último que se descompuso. El trabajo importante nunca arranca porque siempre hay un incendio.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "ITS.3",
      offeringSlug: "digital-transformation-roadmap",
      statement: "Our core processes run on systems rather than on spreadsheets and message threads that one person understands.",
      statementEs: "Nuestros procesos principales corren en sistemas, no en hojas de cálculo y cadenas de mensajes que sólo una persona entiende.",
      risk: "The knowledge lives in someone's head. When that person is unavailable the process stops — and it cannot be improved, because nobody can see it.",
      riskEs: "El conocimiento vive en la cabeza de alguien. Cuando esa persona no está, el proceso se detiene, y no se puede mejorar porque nadie lo ve.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "ITS.4",
      offeringSlug: "fractional-cto",
      statement: "Someone senior owns our technology decisions — architecture, vendors, hiring — rather than each one being made ad hoc by whoever is closest.",
      statementEs: "Alguien con experiencia es responsable de las decisiones tecnológicas —arquitectura, proveedores, contrataciones— en lugar de que cada decisión la tome quien esté más cerca.",
      risk: "Decisions made in isolation do not add up to a system. Six months later the pieces do not fit, and the rework costs more than the original build.",
      riskEs: "Las decisiones aisladas no suman un sistema. Seis meses después las piezas no embonan y rehacerlo cuesta más que haberlo construido bien.",
      audiences: ["SMB"],
      weight: 3,
    },
    {
      id: "ITS.5",
      offeringSlug: "vendor-evaluation-rfp",
      statement: "When we buy significant software we compare options against written requirements, rather than choosing the first vendor who demoed well.",
      statementEs: "Cuando compramos software importante comparamos opciones contra requisitos escritos, en lugar de elegir al primer proveedor que hizo una buena demo.",
      risk: "You find out what the tool cannot do after the annual contract is signed, and by then switching costs more than staying.",
      riskEs: "Descubres lo que la herramienta no puede hacer después de firmar el contrato anual, y para entonces cambiarte cuesta más que quedarte.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "ITS.6",
      offeringSlug: "compliance-risk-assessment",
      statement: "We know what personal data we hold, where it lives, and who can reach it.",
      statementEs: "Sabemos qué datos personales tenemos, dónde viven y quién puede acceder a ellos.",
      risk: "You cannot protect or delete what you cannot find. Under the LFPDPPP the obligation exists whether or not the inventory does.",
      riskEs: "No puedes proteger ni borrar lo que no encuentras. Bajo la LFPDPPP la obligación existe exista o no el inventario.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "ITS.7",
      offeringSlug: "compliance-risk-assessment",
      statement: "Our privacy notice matches what our systems actually do, and someone reviews it when the systems change.",
      statementEs: "Nuestro aviso de privacidad corresponde con lo que nuestros sistemas realmente hacen, y alguien lo revisa cuando los sistemas cambian.",
      risk: "A notice written once and never revisited describes a system that no longer exists — which is worse than none, because it is a documented mismatch.",
      riskEs: "Un aviso escrito una vez y nunca revisado describe un sistema que ya no existe, lo cual es peor que no tenerlo: es una discrepancia documentada.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "ITS.8",
      offeringSlug: "software-stack-audit",
      statement: "Our tools talk to each other. The same customer or student record does not have to be typed into three systems.",
      statementEs: "Nuestras herramientas se comunican entre sí. El mismo registro de cliente o de alumno no se captura en tres sistemas distintos.",
      risk: "Re-keying is where the errors come from, and the copies drift apart until nobody knows which system is right.",
      riskEs: "La recaptura es de donde salen los errores, y las copias se separan hasta que nadie sabe cuál sistema tiene la razón.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
  ],

  AIA: [
    {
      id: "AIA.1",
      offeringSlug: "custom-persona-bots",
      statement: "Routine customer or parent questions get answered without a person retyping the same reply.",
      statementEs: "Las preguntas rutinarias de clientes o de padres de familia se responden sin que una persona vuelva a escribir la misma respuesta.",
      risk: "Answering the same twenty questions consumes the hours that would have gone to the work only a person can do.",
      riskEs: "Responder las mismas veinte preguntas consume las horas que se irían al trabajo que sólo una persona puede hacer.",
      audiences: ["SMB", "IND"],
      weight: 2,
    },
    {
      id: "AIA.2",
      offeringSlug: "custom-persona-bots",
      statement: "New enquiries are qualified and routed automatically, and none of them sits unread over a weekend.",
      statementEs: "Los prospectos nuevos se califican y se turnan automáticamente, y ninguno se queda sin leer todo un fin de semana.",
      risk: "Response speed decides most enquiries. A lead answered on Monday morning has usually already talked to someone else.",
      riskEs: "La velocidad de respuesta decide la mayoría de los prospectos. Uno que contestas el lunes por la mañana casi siempre ya habló con alguien más.",
      audiences: ["SMB", "IND"],
      weight: 3,
    },
    {
      id: "AIA.3",
      offeringSlug: "cross-platform-api-pipelines",
      statement: "Data moves between our systems automatically — nobody exports a spreadsheet and imports it somewhere else on a schedule.",
      statementEs: "Los datos se mueven entre nuestros sistemas automáticamente: nadie exporta una hoja de cálculo para importarla en otro lado cada semana.",
      risk: "Manual transfer is unreliable and invisible. It fails quietly, and you find out from a customer.",
      riskEs: "La transferencia manual es poco confiable e invisible. Falla en silencio y te enteras por un cliente.",
      audiences: ["SMB", "IND"],
      weight: 2,
    },
    {
      id: "AIA.4",
      offeringSlug: "cross-platform-api-pipelines",
      statement: "When an automated process fails, someone is told. It does not just stop.",
      statementEs: "Cuando un proceso automático falla, alguien se entera. No simplemente se detiene.",
      risk: "Silent failure is the expensive kind: the automation stops paying off weeks before anybody notices it stopped running.",
      riskEs: "La falla silenciosa es la cara: la automatización deja de servir semanas antes de que alguien note que dejó de correr.",
      audiences: ["SMB"],
      weight: 2,
    },
    {
      id: "AIA.5",
      offeringSlug: "rag-knowledge-base",
      statement: "Our team can find an answer in our own documents in under a minute, without asking a colleague.",
      statementEs: "Nuestro equipo encuentra una respuesta en nuestros propios documentos en menos de un minuto, sin preguntarle a un colega.",
      risk: "Every unanswerable question becomes an interruption for the one person who knows, and the answer still never gets written down.",
      riskEs: "Cada pregunta sin respuesta se convierte en una interrupción para la única persona que sabe, y la respuesta sigue sin escribirse.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "AIA.6",
      offeringSlug: "rag-knowledge-base",
      statement: "If we use AI tools with our own information, we know which vendor processes that data and have said so in writing.",
      statementEs: "Si usamos herramientas de IA con nuestra información, sabemos qué proveedor procesa esos datos y lo hemos dicho por escrito.",
      risk: "Staff paste confidential material into whatever tool is open. Without a stated policy the organisation has no idea where its data went.",
      riskEs: "El personal pega material confidencial en la herramienta que tenga abierta. Sin una política escrita, la organización no sabe a dónde fueron sus datos.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "AIA.7",
      offeringSlug: "data-extraction-workflows",
      statement: "Information arriving as PDFs, forms or invoices becomes usable data without someone typing it in.",
      statementEs: "La información que llega en PDFs, formatos o facturas se convierte en datos utilizables sin que alguien la capture a mano.",
      risk: "Manual data entry is slow, expensive and error-prone, and it scales only by hiring.",
      riskEs: "La captura manual es lenta, cara y propensa a errores, y sólo escala contratando más gente.",
      audiences: ["SMB"],
      weight: 2,
    },
  ],

  CAM: [
    {
      id: "CAM.1",
      offeringSlug: "on-premise-to-cloud-migration",
      statement: "Our critical systems do not depend on a server sitting in our own building.",
      statementEs: "Nuestros sistemas críticos no dependen de un servidor que está en nuestro propio edificio.",
      risk: "An on-site server is one power cut, one flood or one theft away from taking the organisation offline, and usually nobody has tested the alternative.",
      riskEs: "Un servidor en sitio está a un apagón, una inundación o un robo de dejar a la organización sin operar, y casi nunca se ha probado la alternativa.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "CAM.2",
      offeringSlug: "on-premise-to-cloud-migration",
      statement: "Our team can work from anywhere without a VPN into an office machine.",
      statementEs: "Nuestro equipo puede trabajar desde cualquier lugar sin conectarse por VPN a una máquina de la oficina.",
      risk: "Work stops when the office does. Remote days, sick days and holidays all become blocked days.",
      riskEs: "El trabajo se detiene cuando la oficina se detiene. Los días remotos, las incapacidades y los puentes se vuelven días bloqueados.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "CAM.3",
      offeringSlug: "disaster-recovery-planning",
      statement: "We have restored from a backup on purpose, recently, and it worked.",
      statementEs: "Hemos restaurado un respaldo a propósito, hace poco, y funcionó.",
      risk: "An untested backup is a belief, not a safeguard. The first real restore is not the moment to discover the job has been failing for months.",
      riskEs: "Un respaldo sin probar es una creencia, no una protección. La primera restauración real no es el momento de descubrir que el proceso llevaba meses fallando.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "CAM.4",
      offeringSlug: "disaster-recovery-planning",
      statement: "We know how long we could be down before it becomes serious, and our recovery plan is built to that number.",
      statementEs: "Sabemos cuánto tiempo podríamos estar caídos antes de que sea grave, y nuestro plan de recuperación está hecho para ese número.",
      risk: "Without an agreed target, recovery takes as long as it takes, and everyone discovers together that four hours was the limit.",
      riskEs: "Sin un objetivo acordado, la recuperación tarda lo que tarde, y todos descubren juntos que el límite eran cuatro horas.",
      audiences: ["SMB", "EDU"],
      weight: 2,
    },
    {
      id: "CAM.5",
      offeringSlug: "zero-trust-security-hardening",
      statement: "Everyone signs in with their own account and multi-factor authentication. There are no shared logins.",
      statementEs: "Cada persona entra con su propia cuenta y autenticación multifactor. No hay accesos compartidos.",
      risk: "A shared password cannot be revoked for one person, and a breach cannot be traced to anyone. Both problems arrive at once.",
      riskEs: "Una contraseña compartida no se le puede revocar a una sola persona, y una brecha no se le puede rastrear a nadie. Los dos problemas llegan juntos.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "CAM.6",
      offeringSlug: "zero-trust-security-hardening",
      statement: "When someone leaves, their access is removed the same day, from every system.",
      statementEs: "Cuando alguien se va, sus accesos se eliminan el mismo día, en todos los sistemas.",
      risk: "Forgotten accounts are the ones that get used. Most organisations cannot list every system a departing person could still reach.",
      riskEs: "Las cuentas olvidadas son las que se usan. Casi ninguna organización puede enumerar todos los sistemas a los que alguien que ya se fue todavía llega.",
      audiences: ["SMB", "EDU"],
      weight: 3,
    },
    {
      id: "CAM.7",
      offeringSlug: "cloud-bill-optimization",
      statement: "We know what our cloud and hosting bill is made of, line by line.",
      statementEs: "Sabemos de qué se compone nuestra factura de nube y hosting, línea por línea.",
      risk: "Cloud spend grows by accident — oversized instances, forgotten environments, storage nobody reads. It is rarely the thing anyone reviews.",
      riskEs: "El gasto en nube crece por accidente: instancias más grandes de lo necesario, ambientes olvidados, almacenamiento que nadie lee. Casi nunca es lo que alguien revisa.",
      audiences: ["SMB"],
      weight: 2,
    },
    {
      id: "CAM.8",
      offeringSlug: "docker-containerization",
      statement: "Our applications run the same way on a developer's machine as they do in production.",
      statementEs: "Nuestras aplicaciones corren igual en la máquina de quien desarrolla que en producción.",
      risk: "“It works on my machine” is a deployment risk, not a joke: the differences surface during the release, in front of users.",
      riskEs: "“En mi máquina funciona” es un riesgo de despliegue, no un chiste: las diferencias aparecen durante la publicación, frente a los usuarios.",
      audiences: ["SMB"],
      weight: 2,
    },
  ],

  DPE: [
    {
      id: "DPE.1",
      offeringSlug: "mvp-web-app-development",
      statement: "The software we depend on does what we need, rather than being a tool we have bent into an awkward shape.",
      statementEs: "El software del que dependemos hace lo que necesitamos, en lugar de ser una herramienta que hemos doblado a la fuerza.",
      risk: "Working around a tool costs a little every day and never appears as a line item. It is usually the largest hidden cost in the operation.",
      riskEs: "Darle la vuelta a una herramienta cuesta un poco cada día y nunca aparece como una partida. Suele ser el mayor costo oculto de la operación.",
      audiences: ["SMB", "IND"],
      weight: 3,
    },
    {
      id: "DPE.2",
      offeringSlug: "mvp-web-app-development",
      statement: "When we have an idea for a product or an internal tool, we can get a working version in front of real users within weeks.",
      statementEs: "Cuando tenemos una idea de producto o de herramienta interna, podemos poner una versión funcional frente a usuarios reales en semanas.",
      risk: "Ideas that take a year to test are not tested. The market answers the question long before the build finishes.",
      riskEs: "Las ideas que tardan un año en probarse no se prueban. El mercado responde la pregunta mucho antes de que termine el desarrollo.",
      audiences: ["SMB", "IND"],
      weight: 2,
    },
    {
      id: "DPE.3",
      offeringSlug: "ui-ux-wireframing",
      statement: "Before anything is built, we agree on what the screens do — with something we can click, not a description.",
      statementEs: "Antes de construir cualquier cosa, acordamos qué hacen las pantallas, con algo que se puede clicar y no con una descripción.",
      risk: "Disagreements that surface in code cost many times what they cost in a wireframe, and they always surface.",
      riskEs: "Los desacuerdos que aparecen ya en el código cuestan muchas veces lo que costaban en un wireframe, y siempre aparecen.",
      audiences: ["SMB", "IND"],
      weight: 2,
    },
    {
      id: "DPE.4",
      offeringSlug: "secure-api-design",
      statement: "Our systems talk to each other over documented interfaces with real authentication, not shared database access or scraped pages.",
      statementEs: "Nuestros sistemas se comunican por interfaces documentadas con autenticación real, no por acceso compartido a la base de datos ni raspando páginas.",
      risk: "An undocumented integration breaks whenever either side changes, and nobody can tell in advance what will break.",
      riskEs: "Una integración sin documentar se rompe cada vez que alguno de los dos lados cambia, y nadie puede saber de antemano qué se va a romper.",
      audiences: ["SMB"],
      weight: 2,
    },
    {
      id: "DPE.5",
      offeringSlug: "ci-cd-pipeline-automation",
      statement: "Releasing a change is routine — automated tests run, and deploying does not require one specific person to be available.",
      statementEs: "Publicar un cambio es rutina: las pruebas automáticas corren y desplegar no requiere que una persona específica esté disponible.",
      risk: "When releasing is frightening, changes get batched, and a big batch is exactly what makes the next release more frightening.",
      riskEs: "Cuando publicar da miedo, los cambios se acumulan, y un lote grande es justo lo que hace que la siguiente publicación dé más miedo.",
      audiences: ["SMB"],
      weight: 2,
    },
    {
      id: "DPE.6",
      offeringSlug: "ci-cd-pipeline-automation",
      statement: "We would know our site or application was down before a customer told us.",
      statementEs: "Nos enteraríamos de que nuestro sitio o aplicación está caído antes de que un cliente nos lo dijera.",
      risk: "Learning about an outage from a customer costs the outage plus the trust. The second one is the part that does not come back.",
      riskEs: "Enterarte de una caída por un cliente cuesta la caída más la confianza. La segunda es la parte que no regresa.",
      audiences: ["SMB"],
      weight: 3,
    },
    {
      id: "DPE.7",
      offeringSlug: "managed-maintenance",
      statement: "Our software gets security updates and small improvements on a regular schedule, not only when something breaks.",
      statementEs: "Nuestro software recibe actualizaciones de seguridad y mejoras pequeñas de forma regular, no sólo cuando algo se rompe.",
      risk: "Unmaintained software does not stay still — it accumulates known vulnerabilities, and the eventual catch-up is a project rather than a task.",
      riskEs: "El software sin mantenimiento no se queda quieto: acumula vulnerabilidades conocidas, y ponerse al día acaba siendo un proyecto y no una tarea.",
      audiences: ["SMB", "IND"],
      weight: 3,
    },
    {
      id: "DPE.8",
      offeringSlug: "managed-maintenance",
      statement: "If the person who built our system disappeared tomorrow, someone else could pick it up from the documentation.",
      statementEs: "Si la persona que construyó nuestro sistema desapareciera mañana, alguien más podría continuar con la documentación.",
      risk: "A system only one person understands is an outage waiting for a holiday. The handover cost gets paid either way — the only choice is when.",
      riskEs: "Un sistema que sólo una persona entiende es una caída esperando unas vacaciones. El costo de la transferencia se paga de todos modos; lo único que eliges es cuándo.",
      audiences: ["SMB", "IND"],
      weight: 3,
    },
    {
      id: "DPE.9",
      offeringSlug: "cross-platform-mobile-apps",
      statement: "Where our users need a mobile app, they have one — not a website squeezed onto a phone screen.",
      statementEs: "Donde nuestros usuarios necesitan una app móvil, la tienen: no un sitio web apretado en la pantalla de un teléfono.",
      risk: "A phone-shaped website loses the things people came to the phone for — notifications, offline use, the camera.",
      riskEs: "Un sitio web con forma de teléfono pierde justo aquello por lo que la gente usa el teléfono: notificaciones, uso sin conexión, la cámara.",
      audiences: ["SMB"],
      weight: 1,
    },
  ],
}

/* ── Sections ────────────────────────────────────────────────────────────
 * One per catalogue category, in the catalogue's own order. Titles come
 * from CATEGORIES so the audit cannot name a category differently from the
 * rest of the site; only the audit-specific framing is written here.
 *
 * `benchmark` is the typical score for that audience, used to draw the
 * "you versus typical" bar. These are the only numbers here that are not
 * derived from something else, and they are kept deliberately modest.
 */
const SECTION_META = {
  ITS: {
    letter: "A",
    intro: "How decisions get made, and whether anyone can see the whole picture.",
    introEs: "Cómo se toman las decisiones y si alguien alcanza a ver el panorama completo.",
    benchmark: { EDU: 42, SMB: 45, IND: 40 },
  },
  AIA: {
    letter: "B",
    intro: "The repetitive work a system could be doing instead of a person.",
    introEs: "El trabajo repetitivo que un sistema podría estar haciendo en lugar de una persona.",
    benchmark: { EDU: 30, SMB: 34, IND: 32 },
  },
  CAM: {
    letter: "C",
    intro: "What happens when something fails, and who can reach what.",
    introEs: "Qué pasa cuando algo falla y quién puede acceder a qué.",
    benchmark: { EDU: 36, SMB: 40, IND: 38 },
  },
  DPE: {
    letter: "D",
    intro: "The software you depend on, and whether it can keep changing.",
    introEs: "El software del que dependes y si puede seguir cambiando.",
    benchmark: { EDU: 33, SMB: 38, IND: 36 },
  },
}

export const AUDIT_SECTIONS = CATEGORIES.map((category) => {
  const meta = SECTION_META[category.code]
  const items = ITEMS[category.code] || []
  return {
    letter: meta.letter,
    code: category.code,
    slug: category.slug,
    // From the catalogue, not written twice.
    title: category.name,
    titleEs: category.nameEs,
    subtitle: category.tagline,
    subtitleEs: category.taglineEs,
    intro: meta.intro,
    introEs: meta.introEs,
    benchmark: meta.benchmark,
    audiences: [...new Set(items.flatMap((it) => it.audiences))],
    items,
  }
})

/* ── Pre-qualification options ───────────────────────────────────────────
 * Bilingual, because a Spanish visitor answering English multiple choice was
 * half the reason this rebuild exists.
 */
export const PREQUAL_CHALLENGES = [
  { id: "budget", label: "Budget constraints", labelEs: "Presupuesto limitado" },
  { id: "legacy", label: "Ageing systems we cannot easily change", labelEs: "Sistemas viejos que no podemos cambiar fácilmente" },
  { id: "capacity", label: "No one has time to lead it", labelEs: "Nadie tiene tiempo de liderarlo" },
  { id: "skills", label: "We lack the in-house skills", labelEs: "Nos faltan las habilidades internas" },
  { id: "security", label: "Security or privacy concerns", labelEs: "Preocupaciones de seguridad o privacidad" },
  { id: "buyin", label: "Getting the decision made", labelEs: "Lograr que se tome la decisión" },
  { id: "integration", label: "Systems that do not talk to each other", labelEs: "Sistemas que no se comunican entre sí" },
  { id: "growth", label: "Growing faster than our systems", labelEs: "Crecemos más rápido que nuestros sistemas" },
]

export const PREQUAL_TIMELINES = [
  { id: "now", label: "Immediately — this is urgent", labelEs: "De inmediato: es urgente" },
  { id: "quarter", label: "This quarter", labelEs: "Este trimestre" },
  { id: "half", label: "In the next six months", labelEs: "En los próximos seis meses" },
  { id: "year", label: "Six to twelve months", labelEs: "De seis a doce meses" },
  { id: "exploring", label: "Exploring for now", labelEs: "Por ahora estoy explorando" },
]

/* ── Score bands ─────────────────────────────────────────────────────── */
export const TIERS = [
  {
    min: 0, max: 30,
    name: "Foundation", nameEs: "Cimientos",
    color: "var(--color-rose)",
    headline: "Significant gaps across the basics.",
    headlineEs: "Huecos importantes en lo básico.",
    desc: "Start with the two or three that would hurt most if they failed this month, not with the longest list.",
    descEs: "Empieza por los dos o tres que más dolerían si fallaran este mes, no por la lista más larga.",
  },
  {
    min: 31, max: 55,
    name: "Developing", nameEs: "En desarrollo",
    color: "var(--color-amber)",
    headline: "The essentials are in place; the reliability is not.",
    headlineEs: "Lo esencial está; la confiabilidad no.",
    desc: "Most of what is missing is the part that only matters on a bad day — backups, access, monitoring.",
    descEs: "Casi todo lo que falta es lo que sólo importa un mal día: respaldos, accesos, monitoreo.",
  },
  {
    min: 56, max: 80,
    name: "Established", nameEs: "Consolidado",
    color: "var(--color-azure)",
    headline: "Solid ground, with specific gaps worth closing.",
    headlineEs: "Base sólida, con huecos concretos que vale la pena cerrar.",
    desc: "You are past firefighting. The next gains come from automation and from removing single points of failure.",
    descEs: "Ya saliste de apagar incendios. Las siguientes ganancias vienen de automatizar y de quitar puntos únicos de falla.",
  },
  {
    min: 81, max: 100,
    name: "Advanced", nameEs: "Avanzado",
    color: "var(--color-mint)",
    headline: "Ahead of most organisations your size.",
    headlineEs: "Por delante de la mayoría de organizaciones de tu tamaño.",
    desc: "What remains are refinements. A second opinion is worth more here than a project.",
    descEs: "Lo que queda son refinamientos. Aquí vale más una segunda opinión que un proyecto.",
  },
]

/* ── Lookups ─────────────────────────────────────────────────────────── */

/** Sections with at least one item for this audience. */
export function sectionsForAudience(audience) {
  return AUDIT_SECTIONS.filter((s) => itemsForAudience(s, audience).length > 0)
}

/** Items within a section that this audience is asked about. */
export function itemsForAudience(section, audience) {
  return section.items.filter((it) => it.audiences.includes(audience))
}

/** The offering that closes the gap a statement describes. */
export function offeringForItem(item) {
  return item ? getOfferingBySlug(item.offeringSlug) : null
}

/** The band for a 0–100 score. */
export function tierForScore(pct) {
  return TIERS.find((t) => pct >= t.min && pct <= t.max) || TIERS[0]
}

/** The benchmark for a section and audience. */
export function benchmarkFor(section, audience) {
  return section.benchmark?.[audience] ?? null
}

/**
 * How long the audit is for each audience. Derived, because the page used to
 * advertise "82 items · All 6 sections" from three hardcoded strings that
 * were wrong the moment the instrument changed — and they were wrong.
 */
export function auditLength(audience) {
  const sections = sectionsForAudience(audience)
  return {
    items: sections.reduce((n, s) => n + itemsForAudience(s, audience).length, 0),
    sections: sections.length,
  }
}

/* ── Scoring ─────────────────────────────────────────────────────────── */

export function computeSectionScores(scores, audience) {
  const out = {}
  sectionsForAudience(audience).forEach((sec) => {
    const items = itemsForAudience(sec, audience)
    const max = items.length * 4
    let raw = 0
    items.forEach((it) => { if (scores[it.id] !== undefined) raw += scores[it.id] })
    out[sec.letter] = {
      raw,
      max,
      pct: max ? Math.round((raw / max) * 100) : 0,
      name: sec.title,
      code: sec.code,
      answered: items.filter((it) => scores[it.id] !== undefined).length,
      total: items.length,
    }
  })
  return out
}

export function computeOverall(scores, audience) {
  let raw = 0
  let max = 0
  sectionsForAudience(audience).forEach((sec) => {
    itemsForAudience(sec, audience).forEach((it) => {
      max += 4
      if (scores[it.id] !== undefined) raw += scores[it.id]
    })
  })
  return { pct: max ? Math.round((raw / max) * 100) : 0, raw, max }
}

/**
 * The lowest-scoring gaps, worst first, with the offering that closes each
 * one attached. Ties break on weight — a 1 on something that takes the
 * organisation offline outranks a 1 on a nice-to-have.
 *
 * Every entry carries a live offering: a priority whose slug does not
 * resolve is dropped rather than rendered without a next step, which is what
 * 38 of the old 82 statements did.
 */
export function computeTopPriorities(scores, audience, n = 5) {
  const candidates = []
  sectionsForAudience(audience).forEach((sec) => {
    itemsForAudience(sec, audience).forEach((it) => {
      const score = scores[it.id]
      if (score === undefined || score > 2) return
      const offering = offeringForItem(it)
      if (!offering) return
      candidates.push({
        id: it.id,
        offeringSlug: it.offeringSlug,
        offering,
        section: sec,
        statement: it.statement,
        statementEs: it.statementEs,
        risk: it.risk,
        riskEs: it.riskEs,
        weight: it.weight ?? 2,
        score,
      })
    })
  })
  candidates.sort((a, b) => (a.score - b.score) || (b.weight - a.weight))
  return candidates.slice(0, n)
}

/**
 * The category to recommend: whichever appears most often among the top
 * priorities, ties broken by the catalogue's own order.
 *
 * This replaces SOLUTIONS/matchBundle, which recommended bespoke programmes
 * ("School Tech Transformation Program", "$8,000 – $24,000 USD") that are not
 * on the site, not in the catalogue, and composed of retired ids — two of
 * them could no longer be delivered at all.
 */
export function recommendCategory(topPriorities = []) {
  const counts = new Map()
  topPriorities.forEach((p) => {
    const code = p.offering?.category?.code
    if (code) counts.set(code, (counts.get(code) || 0) + 1)
  })
  let best = null
  CATEGORIES.forEach((c) => {
    const n = counts.get(c.code) || 0
    if (n > 0 && (!best || n > best.n)) best = { n, category: getCategoryByCode(c.code) || c }
  })
  return best ? best.category : null
}
