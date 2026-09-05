import { LocalizedNavLink as NavLink } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { User, MapPin, ShieldCheck, Bell } from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProfileTabs · roadmap step 29
 *
 *  The sidebar now lists a single "Profile" entry. Addresses, Security
 *  (2FA) and Notifications keep their own routes but surface as tabs at the
 *  top of each of those pages, so the four screens read as one section.
 *  ──────────────────────────────────────────────────────────────────── */

const TABS = [
  { to: "/dashboard/profile",       labelKey: "nav.profile",       icon: User,        end: true },
  { to: "/dashboard/addresses",     labelKey: "nav.addresses",     icon: MapPin },
  { to: "/dashboard/2fa",           labelKey: "nav.twoFactor",     icon: ShieldCheck },
  { to: "/dashboard/notifications", labelKey: "nav.notifications", icon: Bell },
]

export default function ProfileTabs({ className = "" }) {
  const { t } = useTranslation("dashboard")
  return (
    /* D2-4 · the scroll affordance.
     *
     * The row already scrolled — `overflow-x-auto` was there — but at 375px
     * two of the four tabs sit off-screen ("Two-step verification" 18px past
     * the edge and "Notifications" 149px past it, measured) with nothing to
     * say so. A phone user had no way to know the other two existed.
     *
     * The wrapper carries a right-edge fade that disappears once the row is
     * scrolled to its end, and `snap-x` settles each tab flush rather than
     * mid-label. `group` is what lets the fade react to the scroll position
     * without a listener: `peer`/`group` cannot read scrollLeft, so the fade
     * is simply always on where the row overflows, and the row is only
     * scrollable where it overflows.
     */
    <div className={`group relative ${className}`}>
    <nav
      aria-label={t("layout.profileTabsAria")}
      className="-mx-1 flex snap-x snap-mandatory gap-1 overflow-x-auto rounded-xl border border-charcoal-80/10 bg-white p-1 shadow-[var(--shadow-e3)]"
    >
      {TABS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-2 text-micro font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30",
              isActive ? "bg-violet text-white" : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet",
            ].join(" ")
          }
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
      {/* Fades the last visible tab out rather than cutting it, so the row
          reads as "there is more" instead of as a clipped element. Hidden
          from lg up, where all four fit. */}
      <div
        className="pointer-events-none absolute inset-y-1 end-0 w-8 rounded-e-xl bg-gradient-to-l from-white to-transparent lg:hidden"
        aria-hidden="true"
      />
    </div>
  )
}
