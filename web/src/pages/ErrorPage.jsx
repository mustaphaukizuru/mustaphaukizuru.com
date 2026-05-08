import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { ArrowLeft, RefreshCw, Home, WifiOff, ServerCrash, Lock, SearchX } from "lucide-react"

/**
 * ErrorPage — universal error/404 display used by:
 *   • The `*` catch-all route (e.g. <ErrorPage type="404" />)
 *   • Any page that wants to render a themed error inline
 *
 * NOTE: This component deliberately does NOT use `useRouteError()` from
 * react-router-dom. That hook only works inside a data router created via
 * `createBrowserRouter`, and this app uses the component-based `<Routes>`
 * pattern. Calling it here would throw during render.
 *
 * If you need to display route-specific errors, pass them explicitly via
 * `type`, `title`, and `message` props.
 *
 * I18N · Phase 118 — copy keyed under the `errors` namespace; the icon
 * + colour-class CONFIGS stay static (presentation only) and the user-
 * visible labels resolve via t() at render time.
 */

const fadeUp = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.45,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.08}} }

const CONFIGS = {
  NETWORK_ERROR: {
    icon: WifiOff,
    iconBg: "bg-[#fff3e2] text-[#b46909]",
    code: "",
    actions: ["retry", "home"],
  },
  DB_UNAVAILABLE: {
    icon: ServerCrash,
    iconBg: "bg-violet-pale text-violet",
    code: "503",
    actions: ["retry", "home"],
  },
  FORBIDDEN: {
    icon: Lock,
    iconBg: "bg-red-50 text-red-600",
    code: "403",
    actions: ["back", "home"],
  },
  404: {
    icon: SearchX,
    iconBg: "bg-violet-pale text-violet",
    code: "404",
    actions: ["back", "home"],
  },
  500: {
    icon: ServerCrash,
    iconBg: "bg-red-50 text-red-600",
    code: "500",
    actions: ["retry", "home"],
  },
}

function getConfig(type) {
  return CONFIGS[type] || CONFIGS[500]
}

export default function ErrorPage({ type, title, message, showRetry = true }) {
  const navigate = useNavigate()
  const { t } = useTranslation("errors")

  const resolvedType = type || "500"
  const cfg = getConfig(resolvedType)
  const Icon = cfg.icon
  // Configs map onto i18n keys: errors.configs.<type>.{title,message}.
  // `title`/`message` props still win when explicitly passed by callers
  // (callers may already be passing pre-translated strings from a parent).
  const label = title || t(`configs.${resolvedType}.title`)
  const desc  = message || t(`configs.${resolvedType}.message`)
  const code  = cfg.code

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <motion.div
        variants={stagger} initial="hidden" animate="show"
        className="flex flex-col items-center text-center max-w-md"
      >
        {/* Icon */}
        <motion.div variants={fadeUp}
          className={`flex h-24 w-24 items-center justify-center rounded-xl ${cfg.iconBg} shadow-[0_12px_32px_rgba(93,63,211,0.08)]`}
        >
          <Icon className="h-12 w-12" />
        </motion.div>

        {/* Code */}
        {code && (
          <motion.div variants={fadeUp}
            className="mt-4 text-display font-bold leading-none text-violet/8 select-none"
          >
            {code}
          </motion.div>
        )}

        {/* Title */}
        <motion.h1 variants={fadeUp}
          className="text-section font-bold tracking-tight text-violet"
          style={{ marginTop: code ? "-1rem" : "1.5rem" }}
        >
          {label}
        </motion.h1>

        {/* Message */}
        <motion.p variants={fadeUp}
          className="mt-3 text-body leading-7 text-charcoal-80/65 max-w-sm"
        >
          {desc}
        </motion.p>

        {/* Actions */}
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap justify-center gap-3">
          {(cfg.actions.includes("retry") && showRetry) && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-meta font-semibold text-white shadow-[0_8px_24px_rgba(93,63,211,0.20)] transition hover:-translate-y-0.5 hover:bg-violet-deep"
            >
              <RefreshCw className="h-4 w-4" /> {t("actions.tryAgain")}
            </button>
          )}
          {cfg.actions.includes("back") && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/15 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
            >
              <ArrowLeft className="h-4 w-4" /> {t("actions.goBack")}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-charcoal-80/15 px-6 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
          >
            <Home className="h-4 w-4" /> {t("actions.home")}
          </button>
        </motion.div>

        {/* Help link */}
        <motion.p variants={fadeUp} className="mt-6 text-micro text-charcoal-80/40">
          {t("support.prefix")}{" "}
          <a href="/contact" className="text-violet hover:underline">{t("support.linkText")}</a>{t("support.suffix")}
        </motion.p>
      </motion.div>
    </div>
  )
}
