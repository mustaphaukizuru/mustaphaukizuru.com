/**
 * cvTracks.js — the three CV flavours served by GET /api/v1/bio/cv.pdf.
 *
 * Mirrors CV_OPTIONS in web/src/components/heroes/AboutHero.jsx (and the
 * static PDFs under web/public/cv/). Each track is the same underlying data
 * (Experience · Education · Certificate · Skill rows) rendered with a
 * different headline, summary and skill-category emphasis, so a recruiter
 * gets the profile that matches their role without three sets of rows to
 * maintain in the admin.
 *
 * `emphasis` lists SkillCategory values (prisma enum) in the order they are
 * printed in the skills section; categories not listed follow afterwards.
 */

const CV_TRACKS = Object.freeze({
  fullstack: {
    slug: "fullstack",
    title: { en: "Full-Stack Software Engineer", es: "Ingeniero de Software Full-Stack" },
    summary: {
      en: "Full-stack engineer shipping production web platforms end to end: Node and Django APIs, React front-ends, MySQL/PostgreSQL data layers and cloud deployment. I turn business problems into maintainable systems that teams can run without me.",
      es: "Ingeniero full-stack que entrega plataformas web en producción de punta a punta: APIs en Node y Django, front-ends en React, capas de datos MySQL/PostgreSQL y despliegue en la nube. Convierto problemas de negocio en sistemas mantenibles que los equipos pueden operar sin mí.",
    },
    emphasis: ["backend", "frontend", "database", "cloud", "language", "tools", "soft_skill"],
  },
  "ict-stem": {
    slug: "ict-stem",
    title: { en: "ICT Coordinator & STEM Instructor", es: "Coordinador TIC e Instructor STEM" },
    summary: {
      en: "ICT coordinator and computer-science educator with classroom and infrastructure experience across Rwanda, Turkey, Ethiopia and Mexico. I design curricula, run school technology, and teach coding and robotics so students build things that work.",
      es: "Coordinador TIC y educador en ciencias de la computación con experiencia en aula e infraestructura en Ruanda, Turquía, Etiopía y México. Diseño currículos, gestiono la tecnología escolar y enseño programación y robótica para que los estudiantes construyan cosas que funcionan.",
    },
    emphasis: ["soft_skill", "language", "tools", "frontend", "backend", "cloud", "database"],
  },
  support: {
    slug: "support",
    title: { en: "Technical Support Engineer", es: "Ingeniero de Soporte Técnico" },
    summary: {
      en: "Technical support engineer focused on IT operations, networks and end-user support. I keep systems available, document what I fix, and translate between users and engineering so incidents are closed for good.",
      es: "Ingeniero de soporte técnico enfocado en operaciones de TI, redes y soporte a usuarios finales. Mantengo los sistemas disponibles, documento lo que arreglo y hago de puente entre usuarios e ingeniería para que los incidentes se cierren definitivamente.",
    },
    emphasis: ["tools", "cloud", "database", "soft_skill", "language", "backend", "frontend"],
  },
})

const DEFAULT_TRACK = "fullstack"
const CV_LANGS = Object.freeze(["en", "es"])

/** Resolve a `?track=` query value to a track config (unknown → default). */
function resolveTrack(slug) {
  return CV_TRACKS[String(slug || "").toLowerCase()] || CV_TRACKS[DEFAULT_TRACK]
}

/** Resolve a `?lang=` query value to a supported CV language (unknown → en). */
function resolveLang(lang) {
  const l = String(lang || "").toLowerCase().slice(0, 2)
  return CV_LANGS.includes(l) ? l : "en"
}

module.exports = { CV_TRACKS, CV_LANGS, DEFAULT_TRACK, resolveTrack, resolveLang }
