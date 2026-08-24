import { useTranslation } from "react-i18next"
import { processSteps } from "../../data/homeData"
import { Container, SectionHeading } from "./primitives"

/**
 * Process · "How I work" — three numbered steps.
 * AnimatedBeam connectors and per-card stagger removed (motion budget);
 * a static hairline joins the steps on lg+.
 */
const TINTS = ["bg-violet-ghost", "bg-azure-pale/50", "bg-terracotta/10"]

export default function Process() {
  const { t } = useTranslation("home")

  return (
    <section className="py-20 lg:py-24" aria-labelledby="home-process-heading">
      <Container>
        <SectionHeading
          id="home-process-heading"
          eyebrow={t("process.eyebrow")}
          title={t("process.title")}
          subtitle={t("process.subtitle")}
          align="center"
        />
        <ol className="relative grid gap-5 lg:grid-cols-3">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-violet/20 via-azure/25 to-terracotta/40 lg:block"
          />
          {processSteps.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              className={`relative flex flex-col gap-4 rounded-2xl ${TINTS[i % TINTS.length]} p-6 ring-1 ring-charcoal-80/8`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
                  <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                </span>
                <span className="font-mono text-[28px] font-bold tabular-nums text-violet/15">
                  0{i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-charcoal">{t(`process.steps.${key}.title`)}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-charcoal-80/70">{t(`process.steps.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
