import { useMemo } from "react"
import { m, useReducedMotion } from "framer-motion"
import { Languages, MessageCircle, Globe2 } from "lucide-react"

import { useTranslation } from "react-i18next"
/* SpokenLanguages F06.v5 — CEFR strip with self-hosted flag SVGs.
   Flag mapping: EN→UK, ES→Mexico, TR→Türkiye, RW→Rwanda.
   Resolver tolerates ISO codes (RW/EN/TR/ES) AND name-derived (KI/EN/TU/SP). */

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
const PROFICIENCY_TO_CEFR = { 1: "A1", 2: "A2", 3: "B1", 4: "C1", 5: "C2" }
const CEFR_LABEL = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate",
  B2: "Upper intermediate", C1: "Professional", C2: "Proficient",
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const FLAG_SOURCES = {
  EN: { src: "/flags/gb.svg", country: "United Kingdom" },
  ES: { src: "/flags/mx.svg", country: "Mexico" },
  TR: { src: "/flags/tr.svg", country: "Turkiye" },
  RW: { src: "/flags/rw.svg", country: "Rwanda" },
}

const CODE_ALIASES = {
  KI: "RW", KIN: "RW", KINY: "RW", RW: "RW", RWA: "RW",
  EN: "EN", ENG: "EN", GB: "EN", UK: "EN",
  TU: "TR", TUR: "TR", TR: "TR", TRK: "TR",
  SP: "ES", SPA: "ES", ES: "ES", MX: "ES", MEX: "ES",
}

function resolveFlag(language) {
  const code = String(language?.code || "").toUpperCase().trim()
  if (FLAG_SOURCES[code]) return FLAG_SOURCES[code]
  const aliased = CODE_ALIASES[code]
  if (aliased && FLAG_SOURCES[aliased]) return FLAG_SOURCES[aliased]
  const name = String(language?.name || "").toLowerCase()
  if (/kinyarwanda|rwanda/.test(name)) return FLAG_SOURCES.RW
  if (/english|britain|united\s*kingdom/.test(name)) return FLAG_SOURCES.EN
  if (/turk/.test(name)) return FLAG_SOURCES.TR
  if (/spanish|espan|mexic/.test(name)) return FLAG_SOURCES.ES
  return null
}

const DEFAULT_LANGUAGES = [
  { name: "English", code: "EN", proficiency: 5, native: false, accent: "Quadrilingual professional" },
  { name: "Turkish", code: "TR", proficiency: 4, native: false, accent: "Lived & studied in Turkiye" },
  { name: "Spanish", code: "ES", proficiency: 3, native: false, accent: "Workplace fluency in Mexico" },
  { name: "Kinyarwanda", code: "RW", proficiency: 5, native: true, accent: "Mother tongue - Rwanda" },
]

function CefrMeter({ name, level, value }) {
  const reduce = useReducedMotion()
  return (
    <div
      role="meter"
      aria-label={`${name} proficiency`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={6}
      aria-valuetext={level === "NATIVE" ? "Native speaker" : `${level} on the CEFR scale`}
    >
      <div className="flex gap-[3px]">
        {CEFR_ORDER.map((step, i) => {
          const filled = i < value
          return (
            <m.span
              key={step}
              initial={reduce ? false : { scaleX: 0, originX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: 0.08 * i, ease: [0.22, 1, 0.36, 1] }}
              className={`h-[6px] flex-1 rounded-full ${filled ? "bg-gradient-to-r from-violet to-[#7B5FE0] shadow-[0_2px_6px_rgb(var(--color-violet-rgb)/0.18)]" : "bg-violet-pale"}`}
              aria-hidden="true"
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[9px] tabular-nums tracking-wider text-charcoal-80/65" aria-hidden="true">
        {CEFR_ORDER.map((step) => <span key={step}>{step}</span>)}
      </div>
    </div>
  )
}

function LanguageCard({ language }) {
  const reduce = useReducedMotion()
  const isNative = Boolean(language.native)
  const cefrLevel = isNative ? "NATIVE" : (PROFICIENCY_TO_CEFR[language.proficiency] || "B1")
  const meterValue = isNative ? 6 : (language.proficiency || 3) + 1
  const displayLevel = isNative ? "Native" : cefrLevel
  const displayLabel = isNative ? "Mother tongue" : (CEFR_LABEL[cefrLevel] || "")
  const flag = resolveFlag(language)

  return (
    <m.li
      variants={fadeUp}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="group relative overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e3)] transition-shadow hover:shadow-[0_18px_44px_rgb(var(--color-violet-rgb)/0.12)]"
      aria-label={`${language.name}, ${displayLabel}`}
    >
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-7 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
            role="img"
            aria-label={`${flag?.country || language.name} flag`}
          >
            {flag && (
              <img
                src={flag.src}
                alt=""
                width="40"
                height="28"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-meta font-bold leading-tight text-violet truncate">{language.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/65">{language.code}</div>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-violet px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-wider text-white shadow-[var(--shadow-lift-1)]">
          {displayLevel}
        </span>
      </header>

      <div className="mb-3 text-micro leading-5 text-charcoal-80/65">{displayLabel}</div>
      <CefrMeter name={language.name} level={cefrLevel} value={meterValue} />

      {language.accent && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] italic leading-4 text-charcoal-80/65">
          <MessageCircle className="h-3 w-3 shrink-0 text-violet/45" aria-hidden="true" />
          {language.accent}
        </p>
      )}

      <span
        aria-hidden="true"
        className="absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-violet via-violet/40 to-transparent transition-transform duration-500 group-hover:scale-x-100"
      />
    </m.li>
  )
}

export default function SpokenLanguages({ languages = null }) {
  const { t } = useTranslation("common")
  const data = useMemo(() => {
    if (!Array.isArray(languages) || languages.length === 0) return DEFAULT_LANGUAGES
    return languages
  }, [languages])

  return (
    <section
      aria-labelledby="languages-heading"
      className="relative overflow-hidden py-16 lg:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-10 h-72 w-72 rounded-full bg-violet/5 blur-3xl" />

      <div className="relative">
        <m.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mb-10 flex flex-col items-center gap-3 text-center"
        >
          <m.span
            variants={fadeUp}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet"
          >
            <Globe2 className="h-3 w-3" aria-hidden="true" />
            Languages
          </m.span>
          <m.h2
            id="languages-heading"
            variants={fadeUp}
            className="max-w-3xl text-[26px] font-bold tracking-tight text-violet sm:text-section md:text-[34px]"
          >
            Four languages.{" "}
            <span className="bg-gradient-to-r from-violet via-[#6A4FD8] to-terracotta bg-clip-text text-transparent">
              {t("languages.threeContinents")}
            </span>{" "}
            One conversation.
          </m.h2>
          <m.p
            variants={fadeUp}
            className="max-w-xl text-body leading-7 text-charcoal-80/70"
          >
            {t("components.spokenLanguages")}
          </m.p>
        </m.div>

        <m.ul
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {data.map((lang) => (
            <LanguageCard key={lang.code + lang.name} language={lang} />
          ))}
        </m.ul>

        <m.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-micro text-charcoal-80/65"
        >
          <span className="flex items-center gap-1.5">
            <Languages className="h-3 w-3 text-violet/60" aria-hidden="true" />
            {t("languages.cefrScale")}
          </span>
          <span aria-hidden="true">·</span>
          <span><span className="font-mono text-violet">A1</span> Beginner → <span className="font-mono text-violet">C2</span> Proficient → <span className="font-mono text-violet">Native</span></span>
        </m.div>
      </div>
    </section>
  )
}
