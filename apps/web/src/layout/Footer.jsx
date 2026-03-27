import { useState } from "react"
import { Link } from "react-router-dom"
import { Linkedin, Github, Twitter, Facebook, Youtube, Instagram, Music2, ArrowRight, Mail } from "lucide-react"
import { apiRequest } from "../lib/api"

const socials = [
  { name: "LinkedIn",  href: "https://www.linkedin.com/in/mustaphaukizuru/",     icon: Linkedin },
  { name: "GitHub",    href: "https://github.com/mustaphaukizuru",               icon: Github },
  { name: "X",         href: "https://x.com/ukizurumustapha",                    icon: Twitter },
  { name: "Instagram", href: "https://www.instagram.com/mustaphaukizuru/",       icon: Instagram },
  { name: "YouTube",   href: "https://www.youtube.com/@mustaphaukizuru",         icon: Youtube },
  { name: "Facebook",  href: "https://www.facebook.com/mrukizurumustapha/",      icon: Facebook },
  { name: "TikTok",    href: "https://www.tiktok.com/@mustaphaukizuru",          icon: Music2 },
]

const quickLinks = [
  { name: "Home",          path: "/" },
  { name: "About",         path: "/about" },
  { name: "Solutions",     path: "/solutions" },
  { name: "Contact",       path: "/contact" },
  { name: "Explore Store", path: "/store" },
]

const legalLinks = [
  { name: "Terms & Conditions", path: "/terms" },
  { name: "Privacy Policy",     path: "/privacy" },
  { name: "Refund Policy",      path: "/refund" },
]

const paymentBadges = [
  { name: "Mercado Pago", bg: "#009EE3", text: "#fff" },
  { name: "PayPal",       bg: "#003087", text: "#fff" },
]

export default function Footer() {
  const [email, setEmail]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState("")
  const [error, setError]       = useState("")

  async function handleSubscribe(e) {
    e.preventDefault()
    setSuccess(""); setError("")
    if (!email) { setError("Please enter your email."); return }
    try {
      setLoading(true)
      const res = await apiRequest("/api/newsletter", { method: "POST", body: JSON.stringify({ email }) })
      setSuccess(res.message || "You're subscribed!")
      setEmail("")
    } catch (err) {
      setError(err.message || "Subscription failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="bg-[#2E2F3A] text-white">
      {/* ── Newsletter band ─────────────────────────────────────────────── */}
      <div className="border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 text-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFCCAF]">Stay connected</div>
              <h2 className="mt-3 text-[1.9rem] font-bold tracking-tight text-white sm:text-[2.1rem]">
                Let's connect!
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-white/55">
                Audience and partners can stay up to date with the latest insights, product updates, and announcements.
              </p>
            </div>

            <form onSubmit={handleSubscribe} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Type your email here…"
                  className="w-full rounded-xl border border-white/12 bg-white/8 py-3 pl-11 pr-4 text-[14px] text-white placeholder-white/35 outline-none focus:border-[#FFCCAF]/40 focus:ring-1 focus:ring-[#FFCCAF]/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(66,0,96,0.35)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
              >
                {loading ? "Joining…" : "Subscribe"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {success && <p className="text-[13px] text-[#FFCCAF]">{success}</p>}
            {error   && <p className="text-[13px] text-red-300">{error}</p>}
          </div>
        </div>
      </div>

      {/* ── Middle row: socials · links · payments ───────────────────────── */}
      <div className="border-b border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between">

            {/* Socials */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {socials.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-white/60 transition hover:border-[#FFCCAF]/40 hover:bg-[#FFCCAF]/10 hover:text-[#FFCCAF]"
                >
                  <Icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>

            {/* Quick links */}
            <nav className="flex flex-wrap items-center justify-center gap-1">
              {quickLinks.map((link, i) => (
                <span key={link.name} className="flex items-center">
                  <Link
                    to={link.path}
                    className="px-3 text-[13px] font-medium text-white/55 transition hover:text-[#FFCCAF]"
                  >
                    {link.name}
                  </Link>
                  {i < quickLinks.length - 1 && (
                    <span className="text-white/20">|</span>
                  )}
                </span>
              ))}
            </nav>

            {/* Payment badges */}
            <div className="flex items-center gap-2">
              {paymentBadges.map(({ name, bg, text }) => (
                <span
                  key={name}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-wide"
                  style={{ backgroundColor: bg, color: text }}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legal bar ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[12px] text-white/35">
            © {new Date().getFullYear()} Mustapha Ukizuru. All rights reserved.
          </p>

          <nav className="flex flex-wrap items-center justify-center gap-1">
            {legalLinks.map((link, i) => (
              <span key={link.name} className="flex items-center">
                <Link to={link.path} className="px-2 text-[12px] text-white/35 transition hover:text-white/70">
                  {link.name}
                </Link>
                {i < legalLinks.length - 1 && <span className="text-white/15">|</span>}
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
