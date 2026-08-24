import { m } from "framer-motion"
import { useTranslation, Trans } from "react-i18next"
import {
  RotateCcw, Calendar, Mail, CheckCircle2, XCircle, Clock,
  ShieldCheck, Globe2, FileSearch,
} from "lucide-react"
import { Link } from "react-router-dom"

/* ──────────────────────────────────────────────────────────────────────────
 *  RefundPage · M15 — Option A policy, made explicit.
 *
 *  Policy in plain language:
 *    Refunds are available within 14 days of purchase, ONLY IF the product
 *    has not been downloaded. Downloaded items are non-refundable. Admins
 *    can override in exceptional cases (defective file, duplicate charge,
 *    not-as-described).
 *
 *  Why explicit:
 *    – PROFECO/Mexico (LFPC Art. 56): distance-sales cancellation right
 *      generally does not apply once a digital good has been accessed.
 *      Stating this clearly + requiring acceptance at checkout is the
 *      strongest legal defence in a consumer complaint.
 *    – Payment processors (PayPal/MercadoPago) side with the merchant in
 *      a chargeback dispute when the policy is published, accepted, and
 *      the access log proves delivery.
 *
 *  I18N · Phase 118 — every visible string is keyed under
 *  `legal.refund.*`. Inline <strong> emphasis inside body copy is
 *  preserved via <Trans> / dangerouslySetInnerHTML so we don't lose
 *  the typographic emphasis in either locale.
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" },
}

const SUPPORT_EMAIL = "hello@mustaphaukizuru.com"

export default function RefundPage() {
  const { t } = useTranslation("legal")

  // i18next returnObjects path returns the array straight from JSON; we
  // use this for the eligible/ineligible bullet lists and the 5-step
  // process diagram so the page DOM stays identical to the original.
  const eligibleItems   = t("refund.eligible.items",   { returnObjects: true }) || []
  const ineligibleItems = t("refund.ineligible.items", { returnObjects: true }) || []
  const processSteps    = t("refund.process.steps",    { returnObjects: true }) || []

  return (
    <div className="bg-mist">
      <section className="py-16 text-center" style={{ backgroundColor: "#5D3FD3" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <m.div {...fadeUp} className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-white">
            <RotateCcw className="h-7 w-7" />
          </m.div>
          <m.h1 {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }} className="mt-5 text-page font-bold text-white">
            {t("refund.title")}
          </m.h1>
          <m.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="mt-3 text-body text-white/65">
            {t("refund.subtitle")}
          </m.p>
          <m.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white/55">
            <Calendar className="h-3.5 w-3.5" /> {t("refund.lastUpdated")}
          </m.div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-6">

          {/* Headline policy statement */}
          <m.div
            {...fadeUp}
            className="rounded-xl border border-violet/15 bg-violet-pale p-6 shadow-[0_4px_16px_rgba(93,63,211,0.08)]"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-white/70 p-3 text-violet shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-body font-bold text-violet">{t("refund.headline.title")}</h2>
                <p
                  className="mt-2 text-meta text-violet/85"
                  dangerouslySetInnerHTML={{ __html: t("refund.headline.body") }}
                />
              </div>
            </div>
          </m.div>

          {/* Eligible */}
          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="rounded-xl border border-mint-600/20 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
          >
            <h2 className="mb-4 flex items-center gap-2 text-body font-bold text-violet">
              <CheckCircle2 className="h-5 w-5 text-mint-600" /> {t("refund.eligible.title")}
            </h2>
            <ul className="space-y-3 text-meta text-charcoal-80/75">
              {eligibleItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </m.div>

          {/* Not eligible */}
          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="rounded-xl border border-rose/20/40 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
          >
            <h2 className="mb-4 flex items-center gap-2 text-body font-bold text-violet">
              <XCircle className="h-5 w-5 text-red-500" /> {t("refund.ineligible.title")}
            </h2>
            <ul className="space-y-3 text-meta text-charcoal-80/75">
              {ineligibleItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </m.div>

          {/* Process */}
          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
          >
            <h2 className="mb-4 flex items-center gap-2 text-body font-bold text-violet">
              <Clock className="h-5 w-5 text-azure" /> {t("refund.process.title")}
            </h2>
            <div className="space-y-4">
              {processSteps.map((step, idx) => {
                const stepNum = String(idx + 1)
                // Step 1 has the inline support-ticket Link + email anchor —
                // we render its body manually from the keyed pieces so we
                // can keep the <Link> + <em> + <a> elements untouched.
                const isStepOne = idx === 0
                return (
                  <div key={stepNum} className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-micro font-bold text-violet">
                      {stepNum}
                    </div>
                    <div>
                      <div className="text-meta font-semibold text-violet">{step.label}</div>
                      <div className="text-meta text-charcoal-80/70">
                        {isStepOne ? (
                          <>
                            {step.descPrefix}{" "}
                            <Link to="/dashboard/support" className="font-semibold text-violet underline-offset-2 hover:underline">
                              {step.descLink}
                            </Link>{" "}
                            {step.descMid} <em>{step.descEm}</em> {step.descSuffix}{" "}
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-violet underline-offset-2 hover:underline">
                              {SUPPORT_EMAIL}
                            </a>
                            .
                          </>
                        ) : step.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </m.div>

          {/* Chargebacks notice */}
          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="rounded-xl border border-amber/20/60 bg-amber/10 p-6"
          >
            <h2 className="mb-3 flex items-center gap-2 text-body font-bold text-amber-700">
              <FileSearch className="h-5 w-5" /> {t("refund.chargebacks.title")}
            </h2>
            <p className="text-meta text-amber-700/85">
              {t("refund.chargebacks.body")}
            </p>
          </m.div>

          {/* Spanish summary, PROFECO compliance */}
          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.25 }}
            className="rounded-xl border border-violet/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
            lang="es"
          >
            <h2 className="mb-3 flex items-center gap-2 text-body font-bold text-violet">
              <Globe2 className="h-5 w-5" /> {t("refund.spanishSummary.title")}
            </h2>
            <p
              className="text-meta text-charcoal-80/80"
              dangerouslySetInnerHTML={{
                __html: t("refund.spanishSummary.body", {
                  email: `<a href="mailto:${SUPPORT_EMAIL}" class="font-semibold text-violet underline-offset-2 hover:underline">${SUPPORT_EMAIL}</a>`,
                }),
              }}
            />
          </m.div>

          <m.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.3 }}
            className="flex items-center gap-4 rounded-xl bg-violet p-6 text-white"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">{t("refund.support.title")}</div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-1 text-meta text-white/65 hover:text-white hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </m.div>
        </div>
      </div>
    </div>
  )
}
