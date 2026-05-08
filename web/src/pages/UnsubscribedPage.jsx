import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { CheckCircle2, ArrowLeft, Mail } from "lucide-react"

/**
 * UnsubscribedPage — /unsubscribed
 *
 * Public confirmation page shown after the backend processes a
 * token-based newsletter unsubscribe (GET /api/newsletter/unsubscribe/:token
 * redirects here). No query params required — arriving here means the
 * unsubscribe was recorded.
 *
 * I18N · Phase 118 — strings keyed under `common.unsub.*` so they share
 * the small "common" namespace already mounted everywhere.
 */
const SUPPORT_EMAIL = "hello@mustaphaukizuru.com"

export default function UnsubscribedPage() {
  const { t } = useTranslation("common")
  return (
    <section className="relative min-h-[calc(100vh-240px)] overflow-hidden bg-[#F8FAFC] py-24">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#5D3FD3]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-terracotta/10 blur-2xl" />

      <div className="relative mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-3xl border border-charcoal-80/10 bg-white p-10 text-center shadow-[0_30px_80px_rgba(93,63,211,0.08)] lg:p-14"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f4ea] text-[#2FA36B]"
          >
            <CheckCircle2 className="h-9 w-9" />
          </motion.div>

          <h1 className="mt-6 text-section font-bold tracking-tight text-violet">
            {t("unsub.title")}
          </h1>
          <p className="mt-3 text-body leading-7 text-charcoal-80/70">
            {t("unsub.body")}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-3 text-meta font-semibold text-white shadow-[0_10px_28px_rgba(93,63,211,0.22)] transition hover:-translate-y-0.5 hover:bg-violet-deep"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("unsub.back")}
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-violet/15 bg-white px-5 py-3 text-meta font-semibold text-violet transition hover:bg-violet-pale"
            >
              <Mail className="h-4 w-4" />
              {t("unsub.support")}
            </Link>
          </div>

          <p className="mt-6 text-micro text-charcoal-80/45">
            {t("unsub.trailer")}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-violet underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </motion.div>
      </div>
    </section>
  )
}
