import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"
import { MessageCircle, X, Mail, Calendar, ArrowRight, ArrowUp } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * PERF · the WhatsApp mark is inlined rather than imported from react-icons.
 *
 * This component renders at App level, so a single `react-icons` import here
 * pulled the whole library into a chunk that loaded on EVERY page — measured
 * at 24 kB of which 23 kB was unused on /terms. One brand glyph is not worth
 * a site-wide dependency, so it lives here as an SVG path.
 * Official mark, viewBox 0 0 448 512 (matches react-icons/fa geometry).
 */
function FaWhatsapp({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 448 512"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-71.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  )
}

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
                className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-80/10 bg-white text-violet shadow-[var(--shadow-lift-4)] transition hover:border-violet/30 hover:text-violet-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
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
                      className="flex items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white px-4 py-3 shadow-[0_8px_28px_rgb(var(--color-violet-rgb)/0.12)] transition hover:-translate-x-0.5 hover:border-violet/30 hover:shadow-[0_12px_36px_rgb(var(--color-violet-rgb)/0.18)]"
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
              className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-[0_8px_32px_rgb(var(--color-violet-rgb)/0.40)] transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_40px_rgb(var(--color-violet-rgb)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(135deg, var(--color-violet), var(--color-azure))" }}
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
