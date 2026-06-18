import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { MessageCircle, X, Mail, Calendar, ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * FloatingContactButton · global fixed-position action button — 21st.dev FAB
 * ─────────────────────────────────────────────────────────────────────────
 * A pulsing brand-violet circle that floats at the bottom-right corner on
 * every public page. On click it expands into a mini contact menu offering:
 *   · Send an email (mailto)
 *   · Book a consultation (/book)
 *   · Go to contact page (/contact)
 *
 * Visibility: hidden for the first 3 seconds (so it doesn't distract from
 * the hero), hidden on scroll-to-top (< 300px), always visible after that.
 *
 * Accessibility:
 *   · aria-label on trigger + menu items
 *   · Keyboard-closeable (Escape)
 *   · Focus-visible rings
 *   · Respects prefers-reduced-motion (no pulse animation)
 *
 * Brand tokens: Royal Violet, Innovation Gradient, Cloud Mist.
 */
export default function FloatingContactButton() {
  const { t } = useTranslation("common")
  const [visible, setVisible]   = useState(false)
  const [open, setOpen]         = useState(false)
  const reduced = useReducedMotion()

  /* Show after 3 s + scrolled past 300px */
  useEffect(() => {
    const timer = setTimeout(() => {
      const onScroll = () => setVisible(window.scrollY > 300)
      window.addEventListener("scroll", onScroll, { passive: true })
      onScroll()
      return () => window.removeEventListener("scroll", onScroll)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  /* Escape to close */
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const menuItems = [
    {
      icon: Mail,
      label: t("fab.emailLabel"),
      href: "mailto:hello@mustaphaukizuru.com",
      external: true,
    },
    {
      icon: Calendar,
      label: t("fab.bookLabel"),
      to: "/book",
    },
    {
      icon: ArrowRight,
      label: t("fab.contactLabel"),
      to: "/contact",
    },
  ]

  const menuVariants = {
    hidden: { opacity: 0, scale: 0.85, y: 12 },
    show:   {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    },
    exit:   { opacity: 0, scale: 0.85, y: 8, transition: { duration: 0.18 } },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: 16 },
    show:   (i) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.06, duration: 0.28, ease: [0.22, 1, 0.36, 1] },
    }),
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          aria-label={t("fab.openLabel")}
        >
          {/* Expanded menu */}
          <AnimatePresence>
            {open && (
              <motion.div
                variants={menuVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col gap-2"
                role="menu"
              >
                {menuItems.map(({ icon: Icon, label, href, to, external }, i) => {
                  const inner = (
                    <motion.div
                      custom={i}
                      variants={itemVariants}
                      initial="hidden"
                      animate="show"
                      className="flex items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-4 py-3 shadow-[0_8px_28px_rgba(93,63,211,0.12)] transition hover:-translate-x-0.5 hover:border-violet/30 hover:shadow-[0_12px_36px_rgba(93,63,211,0.18)]"
                      role="menuitem"
                      key={label}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="whitespace-nowrap text-[13px] font-semibold text-charcoal">
                        {label}
                      </span>
                    </motion.div>
                  )
                  return href ? (
                    <a
                      key={label}
                      href={href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      aria-label={label}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 rounded-2xl"
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      key={label}
                      to={to}
                      aria-label={label}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 rounded-2xl"
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </Link>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trigger button */}
          <div className="relative">
            {/* Pulse ring — only when menu is closed */}
            {!open && !reduced && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-violet opacity-20" />
                <span className="absolute inset-[-4px] animate-pulse rounded-full bg-violet/10" />
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? t("fab.closeLabel") : t("fab.openLabel")}
              aria-expanded={open}
              className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_32px_rgba(93,63,211,0.40)] transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_40px_rgba(93,63,211,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(135deg, #5D3FD3, #0284C7)" }}
            >
              <AnimatePresence mode="wait">
                {open ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-5 w-5 text-white" aria-hidden="true" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="chat"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageCircle className="h-5 w-5 text-white" aria-hidden="true" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
