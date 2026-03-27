import { useNavigate, useRouteError, isRouteErrorResponse } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, RefreshCw, Home, WifiOff, ServerCrash, Lock, SearchX } from "lucide-react"

const fadeUp = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.45,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.08}} }

const CONFIGS = {
  NETWORK_ERROR: {
    icon: WifiOff,
    iconBg: "bg-[#fff3e2] text-[#b46909]",
    code: "",
    title: "No Connection",
    message: "We couldn't reach the server. Please check your internet connection and try again.",
    actions: ["retry", "home"],
  },
  DB_UNAVAILABLE: {
    icon: ServerCrash,
    iconBg: "bg-[#ede4ef] text-[#420060]",
    code: "503",
    title: "Service Temporarily Unavailable",
    message: "Our servers are taking a short break. We'll be back up in a moment. Please try again shortly.",
    actions: ["retry", "home"],
  },
  FORBIDDEN: {
    icon: Lock,
    iconBg: "bg-red-50 text-red-600",
    code: "403",
    title: "Access Denied",
    message: "You don't have permission to access this page. Please sign in or contact support if you believe this is an error.",
    actions: ["back", "home"],
  },
  404: {
    icon: SearchX,
    iconBg: "bg-[#ede4ef] text-[#420060]",
    code: "404",
    title: "Page Not Found",
    message: "The page you're looking for doesn't exist or may have been moved. Check the URL or head back home.",
    actions: ["back", "home"],
  },
  500: {
    icon: ServerCrash,
    iconBg: "bg-red-50 text-red-600",
    code: "500",
    title: "Something Went Wrong",
    message: "An unexpected error occurred on our end. Our team has been notified. Please try again in a moment.",
    actions: ["retry", "home"],
  },
}

function getConfig(type) {
  return CONFIGS[type] || CONFIGS[500]
}

export default function ErrorPage({ type, title, message, showRetry = true }) {
  const navigate   = useNavigate()
  const routeError = useRouteError?.()

  // Derive type from route error if not explicitly provided
  let resolvedType = type
  if (!resolvedType && routeError) {
    if (isRouteErrorResponse?.(routeError)) {
      resolvedType = String(routeError.status)
    } else {
      resolvedType = routeError?.code || "500"
    }
  }

  const cfg    = getConfig(resolvedType)
  const Icon   = cfg.icon
  const label  = title   || cfg.title
  const desc   = message || cfg.message
  const code   = cfg.code

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <motion.div
        variants={stagger} initial="hidden" animate="show"
        className="flex flex-col items-center text-center max-w-md"
      >
        {/* Icon */}
        <motion.div variants={fadeUp}
          className={`flex h-24 w-24 items-center justify-center rounded-xl ${cfg.iconBg} shadow-[0_12px_32px_rgba(66,0,96,0.08)]`}
        >
          <Icon className="h-12 w-12" />
        </motion.div>

        {/* Code */}
        {code && (
          <motion.div variants={fadeUp}
            className="mt-4 text-[5rem] font-bold leading-none text-[#420060]/8 select-none"
          >
            {code}
          </motion.div>
        )}

        {/* Title */}
        <motion.h1 variants={fadeUp}
          className="text-[1.8rem] font-bold tracking-tight text-[#420060]"
          style={{ marginTop: code ? "-1rem" : "1.5rem" }}
        >
          {label}
        </motion.h1>

        {/* Message */}
        <motion.p variants={fadeUp}
          className="mt-3 text-[15px] leading-7 text-[#634F40]/65 max-w-sm"
        >
          {desc}
        </motion.p>

        {/* Actions */}
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap justify-center gap-3">
          {(cfg.actions.includes("retry") && showRetry) && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          )}
          {cfg.actions.includes("back") && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/15 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
            >
              <ArrowLeft className="h-4 w-4" /> Go Back
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/15 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
          >
            <Home className="h-4 w-4" /> Home
          </button>
        </motion.div>

        {/* Help link */}
        <motion.p variants={fadeUp} className="mt-6 text-[12px] text-[#634F40]/40">
          If this keeps happening,{" "}
          <a href="/contact" className="text-[#420060] hover:underline">contact support</a>.
        </motion.p>
      </motion.div>
    </div>
  )
}
