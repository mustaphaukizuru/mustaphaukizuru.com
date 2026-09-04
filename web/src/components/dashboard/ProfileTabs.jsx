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
    <nav
      aria-label={t("layout.profileTabsAria")}
      className={`-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-charcoal-80/10 bg-white p-1 shadow-[var(--shadow-e3)] ${className}`}
    >
      {TABS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-micro font-semibold transition",
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
  )
}
