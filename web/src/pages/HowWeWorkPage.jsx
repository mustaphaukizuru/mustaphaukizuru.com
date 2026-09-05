/* ════════════════════════════════════════════════════════════════════════
   HowWeWorkPage.jsx · /how-we-work · T2-9
   ────────────────────────────────────────────────────────────────────────
   The engagement process, in full, for a prospect who arrived from a
   proposal link and wants the whole picture before signing anything.

   Until now the Services page showed three steps of one sentence each and
   nothing else. Everything a client actually needs to know before
   committing — what to send at each stage, whether anyone comes on site,
   who gets access to what and when it is revoked — lived in an internal
   guide that no visitor could read.

   Four sections, in the source document's order: the six steps, what to
   submit by stage, delivery modality, and access and data privacy. All
   content comes from servicesCatalogue.js so the page, the three-step
   summary on /services and the downloadable catalogue cannot disagree;
   only the framing strings live in services.json.
   ════════════════════════════════════════════════════════════════════════ */
import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { LocalizedLink as Link } from "../components/LocalizedLink"
import Seo from "../components/seo/Seo"
import { SectionHeader } from "../components/services/Primitives"
import ServicesLeadCapture from "../components/services/ServicesLeadCapture"
import { pick, useCatalogueLang } from "../components/services/localize"
import { bookHref } from "../data/servicesCatalogue"
// Its own module, and only this page and the catalogue generator import it —
// see the note in that file about the first-paint payload budget.
import {
  ACCESS_PRIVACY,
  DELIVERY_MODALITY,
  HOW_IT_WORKS_DETAILED,
  SUBMIT_BY_STAGE,
} from "../data/engagementProcess"
import { howToSchema } from "../seo/schemas/howToSchema"

const EASE = [0.22, 1, 0.36, 1]
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

/* ── The six steps, as a numbered vertical stepper ───────────────────────
   <ol> because the order is the meaning: a reader has to see that access
   (05) comes after the NDA (04), not before. */
function Steps({ lang, t }) {
  return (
    <ol className="mt-8 space-y-4">
      {HOW_IT_WORKS_DETAILED.map((step) => {
        const Icon = step.Icon
        return (
          <m.li
            key={step.id}
            variants={fadeUp}
            id={step.id}
            className="rounded-2xl border border-charcoal-80/10 bg-white p-6 sm:p-7"
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-meta font-bold tabular-nums text-violet">{step.step}</span>
                  <h3 className="text-body font-bold text-violet">{pick(step, "title", lang)}</h3>
                </div>
                <p className="mt-2 text-meta leading-6 text-charcoal-80/80">{pick(step, "summary", lang)}</p>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
                      {t("process.step.how")}
                    </dt>
                    <dd className="mt-1 text-micro leading-5 text-charcoal-80/80">{pick(step, "how", lang)}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
                      {t("process.step.when")}
                    </dt>
                    <dd className="mt-1 text-micro leading-5 text-charcoal-80/80">{pick(step, "when", lang)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
                      {t("process.step.include")}
                    </dt>
                    <dd className="mt-1 text-micro leading-5 text-charcoal-80/80">{pick(step, "include", lang)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </m.li>
        )
      })}
    </ol>
  )
}

/* ── What to submit, by stage ────────────────────────────────────────────
   A real <table>: it is tabular data, and a screen reader announcing
   "stage / what is needed" per row is the whole point. It scrolls inside
   its own container so the page body never scrolls sideways on a phone. */
function SubmitTable({ lang, t }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-charcoal-80/10 bg-white">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">{t("process.submit.title")}</caption>
        <thead>
          <tr className="border-b border-charcoal-80/10">
            <th scope="col" className="px-5 py-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
              {t("process.submit.stageHeading")}
            </th>
            <th scope="col" className="px-5 py-3 font-mono text-micro font-bold uppercase tracking-[0.14em] text-charcoal-80/65">
              {t("process.submit.needsHeading")}
            </th>
          </tr>
        </thead>
        <tbody>
          {SUBMIT_BY_STAGE.map((row) => (
            <tr key={row.id} className="border-b border-charcoal-80/10 last:border-0">
              <th scope="row" className="px-5 py-3 align-top text-meta font-semibold text-violet">
                {pick(row, "stage", lang)}
              </th>
              <td className="px-5 py-3 align-top text-meta leading-6 text-charcoal-80/80">
                {pick(row, "needs", lang)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function HowWeWorkPage() {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()

  return (
    <section className="bg-mist">
      {/* jsonLd is an array on this component, not a `schema` prop. */}
      <Seo
        title={t("process.seo.title")}
        description={t("process.seo.description")}
        jsonLd={[howToSchema({ lang })]}
      />

      <Container className="py-12 sm:py-16 lg:py-20">
        <m.div variants={stagger} initial="hidden" animate="show">
          <m.p variants={fadeUp} className="font-mono text-micro font-bold uppercase tracking-[0.18em] text-violet">
            {t("process.hero.eyebrow")}
          </m.p>
          <m.h1 variants={fadeUp} className="mt-3 max-w-3xl text-display font-bold leading-tight tracking-tight text-violet">
            {t("process.hero.title")}
          </m.h1>
          <m.p variants={fadeUp} className="mt-4 max-w-2xl text-body leading-7 text-charcoal-80/80">
            {t("process.hero.subtitle")}
          </m.p>

          <Steps lang={lang} t={t} />
        </m.div>

        <m.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mt-14">
          <m.div variants={fadeUp}>
            <SectionHeader
              eyebrow={t("process.submit.eyebrow")}
              title={t("process.submit.title")}
              subtitle={t("process.submit.subtitle")}
            />
          </m.div>
          <m.div variants={fadeUp}>
            <SubmitTable lang={lang} t={t} />
          </m.div>
        </m.div>

        <m.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mt-14">
          <m.div variants={fadeUp}>
            <SectionHeader
              eyebrow={t("process.modality.eyebrow")}
              title={t("process.modality.title")}
              subtitle={t("process.modality.subtitle")}
            />
          </m.div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {DELIVERY_MODALITY.map((mode) => {
              const Icon = mode.Icon
              return (
                <m.div key={mode.id} variants={fadeUp} className="rounded-2xl border border-charcoal-80/10 bg-white p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-pale text-violet">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-body font-bold text-violet">{pick(mode, "title", lang)}</h3>
                  <p className="mt-2 text-meta leading-6 text-charcoal-80/80">{pick(mode, "body", lang)}</p>
                  {Array.isArray(mode.offerings) && mode.offerings.length > 0 && (
                    <p className="mt-3 text-micro leading-5">
                      <Link
                        to="/services/cloud-architecture-migration"
                        className="font-semibold text-violet underline-offset-2 hover:underline"
                      >
                        {t("process.modality.seeOfferings")}
                      </Link>
                    </p>
                  )}
                </m.div>
              )
            })}
          </div>
        </m.div>

        <m.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mt-14">
          <m.div variants={fadeUp}>
            <SectionHeader
              eyebrow={t("process.access.eyebrow")}
              title={t("process.access.title")}
              subtitle={t("process.access.subtitle")}
            />
          </m.div>
          <ul className="mt-6 space-y-3">
            {ACCESS_PRIVACY.map((rule) => (
              <m.li
                key={rule.id}
                variants={fadeUp}
                className="flex items-start gap-3 rounded-2xl border border-charcoal-80/10 bg-white p-5"
              >
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="text-meta font-bold text-violet">{pick(rule, "title", lang)}</h3>
                  <p className="mt-1 text-meta leading-6 text-charcoal-80/80">
                    {pick(rule, "body", lang)}
                    {rule.href && (
                      <>
                        {" "}
                        <Link to={rule.href} className="font-semibold text-violet underline-offset-2 hover:underline">
                          {rule.id === "lfpdppp" ? t("process.access.privacyLink") : t("process.access.aiLink")}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </m.li>
            ))}
          </ul>
        </m.div>

        <m.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mt-14 rounded-2xl border border-charcoal-80/10 bg-white p-7 text-center sm:p-9"
        >
          <h2 className="text-[22px] font-bold text-violet sm:text-[26px]">{t("process.cta.title")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-meta leading-6 text-charcoal-80/80">{t("process.cta.body")}</p>
          <Link
            to={bookHref()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-3 text-meta font-semibold text-white transition hover:bg-violet-deep focus:outline-none focus-visible:ring-4 focus-visible:ring-violet/40"
          >
            {t("process.cta.button")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </m.div>

        <div className="mt-14">
          <ServicesLeadCapture slug="how-we-work" />
        </div>
      </Container>
    </section>
  )
}
