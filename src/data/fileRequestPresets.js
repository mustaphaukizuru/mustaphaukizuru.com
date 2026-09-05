/**
 * fileRequestPresets.js · the documents we ask for over and over (T5-13).
 *
 * Every project starts with the same six or seven "can you send me…"
 * messages, and each one was retyped by hand — which means the instructions
 * were slightly different every time, the Spanish half was usually missing,
 * and nobody thought about which file types to accept until a client sent a
 * photograph of a logo.
 *
 * These are the presets, in both languages, with the accepted extensions
 * already decided. The admin form offers them as one-click fills, so the
 * default is the version somebody thought about.
 *
 * A STATIC LIST, NOT A TABLE. There is no admin screen to manage presets and
 * there should not be one: seven rows that change twice a year belong in
 * source, where a change is reviewable and arrives with the deploy. A
 * database table would need a CRUD screen, seeds, and a migration path, to
 * hold text that is edited less often than the code around it.
 *
 * The `id` is what the API accepts and is part of the contract — rename one
 * and an admin's saved shortcut stops working. Adding is free.
 */

/**
 * Instructions are written as instructions, not as labels. "A PDF or a
 * photograph is fine, as long as the RFC is readable" prevents an exchange;
 * "Constancia fiscal" does not.
 */
const FILE_REQUEST_PRESETS = Object.freeze([
  {
    id: "cv",
    title: "Your CV or résumé",
    titleEs: "Tu CV o currículum",
    instructions:
      "The most recent version, in PDF if you have it. If you only have a Word file that is fine — send it as it is rather than exporting it, because the conversion usually breaks the layout.",
    instructionsEs:
      "La versión más reciente, en PDF si la tienes. Si sólo tienes el archivo de Word no hay problema — mándalo tal cual en lugar de exportarlo, porque la conversión suele romper el formato.",
    acceptExt: ".pdf,.doc,.docx",
  },
  {
    id: "constancia-fiscal",
    title: "Constancia de situación fiscal",
    titleEs: "Constancia de situación fiscal",
    instructions:
      "Download it from the SAT portal — it is the one that lists your RFC, your régimen fiscal and your fiscal address. A photograph is fine as long as all three are readable. We need it to issue a CFDI; without it an invoice can only be issued to público en general.",
    instructionsEs:
      "Descárgala del portal del SAT — es la que trae tu RFC, tu régimen fiscal y tu domicilio fiscal. Una fotografía sirve, siempre que los tres se lean bien. La necesitamos para emitir el CFDI; sin ella la factura sólo puede salir a público en general.",
    acceptExt: ".pdf,.png,.jpg,.jpeg",
  },
  {
    id: "logo-vector",
    title: "Your logo, in vector",
    titleEs: "Tu logotipo, en vectorial",
    instructions:
      "An SVG, AI, EPS or PDF from whoever designed it. Not a PNG or a screenshot: a logo has to be resized for a favicon and for a sign on a wall, and a raster file can only ever do one of those. If the vector is genuinely lost, send the largest PNG you have and say so.",
    instructionsEs:
      "Un SVG, AI, EPS o PDF de quien lo diseñó. No un PNG ni una captura: un logotipo tiene que escalarse para un favicon y para un letrero en una pared, y un archivo de mapa de bits sólo puede con uno de los dos. Si el vectorial se perdió de verdad, manda el PNG más grande que tengas y avísanos.",
    acceptExt: ".svg,.ai,.eps,.pdf",
  },
  {
    id: "brand-assets",
    title: "Brand assets",
    titleEs: "Materiales de marca",
    instructions:
      "Whatever exists: the brand manual, the exact colours, the fonts you have licences for, photographs you own the rights to. A ZIP is easiest. If there is no manual, tell us which existing material is the one to copy.",
    instructionsEs:
      "Lo que exista: el manual de marca, los colores exactos, las tipografías con licencia, fotografías cuyos derechos tengas. Un ZIP es lo más fácil. Si no hay manual, dinos qué material existente es el que hay que seguir.",
    acceptExt: ".zip,.pdf,.svg,.png,.jpg,.jpeg,.ai,.psd",
  },
  {
    id: "registrar-confirmation",
    title: "Domain registrar — written confirmation",
    titleEs: "Registrador del dominio — confirmación por escrito",
    instructions:
      "A screenshot of the registrar's dashboard showing the domain and who it is registered to, or the renewal email. DO NOT send the login — if we need access, we will ask for it through the secure credential handoff, which can be read once and is then destroyed.",
    instructionsEs:
      "Una captura del panel del registrador que muestre el dominio y a nombre de quién está, o el correo de renovación. NO mandes el acceso — si necesitamos entrar, te lo pediremos por el traspaso seguro de credenciales, que se lee una sola vez y después se destruye.",
    acceptExt: ".pdf,.png,.jpg,.jpeg",
  },
  {
    id: "content-copy",
    title: "The text for the pages",
    titleEs: "El texto de las páginas",
    instructions:
      "A document per page, or one document with a heading per page — whichever is easier. Send it unfinished rather than not at all: real text that needs editing tells us far more about the layout than placeholder ever will.",
    instructionsEs:
      "Un documento por página, o uno solo con un título por página — como te resulte más fácil. Mándalo sin terminar antes que no mandarlo: un texto real que hay que corregir dice mucho más sobre el diseño que cualquier relleno.",
    acceptExt: ".doc,.docx,.pdf,.txt,.md",
  },
  {
    id: "existing-analytics",
    title: "Access to your current analytics",
    titleEs: "Acceso a tus analíticas actuales",
    instructions:
      "An export or a screenshot of the last twelve months — visits, the top pages, and where the traffic came from. It is how we know which pages actually matter before anything is redesigned.",
    instructionsEs:
      "Una exportación o una captura de los últimos doce meses — visitas, páginas principales y de dónde viene el tráfico. Es como sabemos qué páginas importan de verdad antes de rediseñar nada.",
    acceptExt: ".pdf,.csv,.xlsx,.png,.jpg,.jpeg",
  },
])

/**
 * Words that mean "this is a credential, not a document".
 *
 * A request titled "hosting password" is answered with a .txt containing a
 * hosting password, which then lives in storage/projects/ for the whole
 * retention window and goes into any handover pack built afterwards. So the
 * request itself is refused and pointed at the secret handoff.
 *
 * Matched on both languages and as substrings — "contraseña de cPanel" and
 * "API key for Stripe" both have to be caught. `clave` is here for Mexican
 * usage ("clave de acceso"); it also means "key" in the musical and the
 * "clave única" senses, and a false refusal that names the alternative is
 * much cheaper than a password on disk.
 */
const CREDENTIAL_WORDS = Object.freeze([
  "password", "passwd", "contraseña", "contrasena",
  "api key", "apikey", "api-key", "llave api",
  "token", "credential", "credencial",
  "secret key", "secreto",
  "clave", "acceso ftp", "ftp access",
  "login", "usuario y", "user and pass",
])

/** Does this title read like somebody asking for a credential? */
function looksLikeCredentialRequest(title) {
  const t = String(title || "").toLowerCase()
  if (!t) return false
  return CREDENTIAL_WORDS.some((word) => t.includes(word))
}

/** One preset by id, or null. */
function presetById(id) {
  if (!id) return null
  return FILE_REQUEST_PRESETS.find((p) => p.id === String(id)) || null
}

module.exports = {
  FILE_REQUEST_PRESETS,
  CREDENTIAL_WORDS,
  looksLikeCredentialRequest,
  presetById,
}
