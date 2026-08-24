import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { MessageCircle, X, Mail, Calendar, ArrowRight, ArrowUp } from "lucide-react"
import { FaWhatsapp } from "react-icons/fa"
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

  const scrollToTop = () =>
    window.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : "smooth" })

  const menuItems = [
    {
      icon: FaWhatsapp,
      label: t("fab.whatsappLabel"),
      // Reuses the site's canonical WhatsApp number (same as SocialLinks),
      // with a pre-filled greeting so the chat opens ready to send.
      href: `https://wa.me/525552139993?text=${encodeURIComponent(t("fab.whatsappText"))}`,
      external: true,
    },
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
        <m.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          aria-label={t("fab.openLabel")}
        >
          {/* Scroll-to-top — secondary action, sits above the contact FAB and
              hides while the menu is open so the two never collide. */}
          <AnimatePresence>
            {!open && (
              <m.button
                type="button"
                onClick={scrollToTop}
                aria-label={t("system.scrollTop")}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 8 }}
                transition={{ duration: 0.2 }}
                whileHover={reduced ? undefined : { y: -2 }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-80/10 bg-white text-violet shadow-[0_8px_24px_rgba(93,63,211,0.18)] transition hover:border-violet/30 hover:text-violet-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                <ArrowUp className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
              </m.button>
            )}
          </AnimatePresence>

          {/* Expanded menu */}
          <AnimatePresence>
            {open && (
              <m.div
                variants={menuVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col gap-2"
                role="menu"
              >
                {menuItems.map(({ icon: Icon, label, href, to, external }, i) => {
                  const inner = (
                    <m.div
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
                    </m.div>
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
              </m.div>
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
                  <m.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-5 w-5 text-white" aria-hidden="true" />
                  </m.span>
                ) : (
                  <m.span
                    key="chat"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <MessageCircle className="h-5 w-5 text-white" aria-hidden="true" />
                  </m.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
