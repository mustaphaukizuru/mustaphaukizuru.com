import { useTranslation } from "react-i18next"
import Counter from "./motion/Counter"
import TechStackShowcase from "./TechStackShowcase"
import { resolveStats } from "../data/homeData"
import useProof from "../hooks/useProof"

/**
 * HomeStatsStrip · V2 — compact proof strip (roadmap step 24)
 * ─────────────────────────────────────────────────────────────────────────
 * V1 was a 2×2 bento with BorderBeam, a scroll-driven spine, two stagger
 * containers and hover lifts (13 motion elements). V2 is a single band
 * directly under the hero: four numbers in a row + the stack logo row.
 * The only motion left is Counter (counts once on entry, static under
 * reduced motion); the section itself is revealed by the page-level
 * RevealSection wrapper.
 *
 * Numbers: live from GET /api/v1/bio/proof (years · projects · clients ·
 * reviews); the static homeData values show while loading and any live
 * value of 0 hides its tile.
 */
export default function HomeStatsStrip() {
  const { t } = useTranslation("home")
  const proof = useProof()
  const stats = resolveStats(proof.data)

  return (
    <section
      className="border-y border-charcoal-80/8 bg-white"
      aria-label={t("stats.ariaLabel")}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map(({ key, to, suffix }) => (
            <div key={key} className="flex flex-col gap-1" data-live={proof.data ? "true" : undefined}>
              <dd className="order-1 flex items-baseline gap-0.5 font-mono text-[clamp(30px,4vw,44px)] font-bold leading-none tracking-tight tabular-nums text-violet">
                <Counter to={to} />
                {suffix && <span className="text-[0.6em] font-semibold opacity-70">{suffix}</span>}
              </dd>
              <dt className="order-2 text-[13px] leading-snug text-charcoal-80/65">
                {t(`stats.${key}Label`)}
              </dt>
            </div>
          ))}
        </dl>

        <TechStackShowcase
          label={t("stats.stackLabel")}
          className="mt-8 border-t border-charcoal-80/8 pt-6"
        />
      </div>
    </section>
  )
}
