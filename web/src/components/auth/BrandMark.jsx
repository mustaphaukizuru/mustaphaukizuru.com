/* ────────────────────────────────────────────────────────────────────────
   BrandMark.jsx
   ────────────────────────────────────────────────────────────────────────
   Small reusable header used at the top of every auth form panel.
   Renders the violet logomark + the brand wordmark, with focus-visible
   keyboard support and a hover cue.

   Why a component? — so a future re-brand only touches one file, and the
   four auth pages stay easy to read.
   ──────────────────────────────────────────────────────────────────────── */

import { LocalizedLink as Link } from "../LocalizedLink"
import logoMark from "../../assets/logo-mark/m-mark-violet.svg"

import { useTranslation } from "react-i18next"
export default function BrandMark({ size = "md" }) {
  const { t } = useTranslation("common")
  const dim = size === "lg" ? "h-12 w-12" : "h-10 w-10"
  return (
    <Link
      to="/"
      aria-label={t("header.homeAria")}
      className="group mx-auto inline-flex items-center justify-center rounded-2xl focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
    >
      <span
        className={`relative inline-flex ${dim} items-center justify-center rounded-2xl bg-violet-pale ring-1 ring-violet/15 transition group-hover:bg-white group-hover:ring-violet/30`}
      >
        <img
          src={logoMark}
          alt=""
          aria-hidden="true"
          className={`${size === "lg" ? "h-7 w-7" : "h-6 w-6"}`}
          width={28}
          height={28}
        />
      </span>
    </Link>
  )
}
