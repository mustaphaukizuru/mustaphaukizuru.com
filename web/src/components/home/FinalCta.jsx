import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ArrowRight, Calendar } from "lucide-react"
import Image from "../ui/Image"
import { Container } from "./primitives"

/**
 * FinalCta · book a call. Primary = /book, secondary = /store, mirroring the
 * hero so the page opens and closes on the same two doors.
 * Uses the global `.ukz-cta-bg` gradient (index.css) which already falls
 * back to flat violet under prefers-reduced-motion; the animated ring stack,
 * shine sweep, MagneticButtons and the 8-item stagger from V3 are gone.
 */
export default function FinalCta() {
  const { t } = useTranslation("home")

  return (
    <section className="py-16 lg:py-24" aria-labelledby="home-cta-heading">
      <Container>
        <div className="ukz-cta-bg relative overflow-hidden rounded-[28px] text-white shadow-[0_30px_80px_-20px_rgba(93,63,211,0.50)]">
          <div className="relative px-6 py-14 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
            <div className="max-w-[44ch]">
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{
                  backgroundColor: "rgba(233, 196, 106, 0.16)",
                  color: "#E9C46A",
                  border: "1px solid rgba(233, 196, 106, 0.32)",
                }}
              >
                {t("cta.eyebrow")}
              </span>

              <h2 id="home-cta-heading" className="mt-4 text-display !text-white text-balance">
                {t("cta.title")}
              </h2>

              <p className="mt-4 max-w-md text-[15px] leading-[1.65] text-white/80">{t("cta.body")}</p>

              <div className="mt-6 flex items-center gap-3">
                <Image
                  src="/images/profile/Ukizuru_Mustapha_Photo.jpg"
                  alt=""
                  aria-hidden="true"
                  width={44}
                  height={44}
                  widths={[112, 224, 448]}
                  sizes="44px"
                  loading="lazy"
                  className="h-11 w-11 shrink-0"
                  imgClassName="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
                />
                <div>
                  <p className="text-[13px] font-bold leading-tight text-white">Mustapha Ukizuru</p>
                  <p className="text-[12px] leading-tight text-white/70">{t("cta.signature")}</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to="/book"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-bold text-violet shadow-[0_10px_28px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/50 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
                >
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {t("cta.ctaBook")}
                </Link>
                <Link
                  to="/store"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/50 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
                >
                  {t("cta.ctaStore")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
