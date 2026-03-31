import { useState } from "react"
import { Link } from "react-router-dom"
import { Linkedin, Github, Twitter, Facebook, Youtube, Instagram, ArrowRight, Mail, Sparkles } from "lucide-react"
import { apiRequest } from "../lib/api"
import profilePhoto from "../assets/Ukizuru Mustapha Photo.jpg"
import mercadoPagoLogo from "../assets/MP_CMYK_HANDSHAKE_color_horizontal.png"
import paypalLogo from "../assets/pp-logo-150px.png"

/* ── Custom TikTok icon (matches lucide style: 24×24, stroke-based) ──── */
function TikTokIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  )
}

const socials = [
  { name: "Instagram", href: "https://www.instagram.com/mustaphaukizuru/",       icon: Instagram },
  { name: "YouTube",   href: "https://www.youtube.com/@mustaphaukizuru",         icon: Youtube },
  { name: "Facebook",  href: "https://www.facebook.com/mrukizurumustapha/",      icon: Facebook },
  { name: "TikTok",    href: "https://www.tiktok.com/@mustaphaukizuru",          icon: TikTokIcon },
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
      {/* ── Newsletter band — wider & modern card ───────────────────────── */}
      <div className="mx-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#420060]/80 via-[#2E2F3A] to-[#420060]/50 p-[1px]">
            {/* Inner card */}
            <div className="relative rounded-xl bg-[#2E2F3A]/90 px-6 py-14 backdrop-blur sm:px-12 lg:px-16">
              {/* Decorative glow */}
              <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-[#420060]/30 blur-3xl" />

              <div className="relative flex flex-col items-center gap-8 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FFCCAF]/20 bg-[#FFCCAF]/10 px-3.5 py-1">
                  <Sparkles className="h-3 w-3 text-[#FFCCAF]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFCCAF]">
                    Stay connected
                  </span>
                </div>

                <div>
                  <h2 className="text-[2rem] font-bold tracking-tight text-white sm:text-[2.4rem]">
                    Let's connect!
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-white/50">
                    Audience and partners can stay up to date with the latest insights,
                    product updates, and announcements.
                  </p>
                </div>

                <form
                  onSubmit={handleSubscribe}
                  className="flex w-full max-w-3xl flex-col gap-3 sm:flex-row"
                >
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Type your email here…"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-4 text-[14px] text-white placeholder-white/30 outline-none transition-all duration-200 focus:border-[#FFCCAF]/40 focus:bg-white/[0.09] focus:ring-2 focus:ring-[#FFCCAF]/15"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-7 py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_28px_rgba(66,0,96,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#52007a] hover:shadow-[0_12px_32px_rgba(66,0,96,0.55)] disabled:opacity-60"
                  >
                    {loading ? "Joining…" : "Subscribe"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </form>

                {success && (
                  <p className="animate-[fadeIn_0.3s_ease] text-[13px] font-medium text-[#FFCCAF]">
                    ✓ {success}
                  </p>
                )}
                {error && (
                  <p className="animate-[fadeIn_0.3s_ease] text-[13px] font-medium text-red-300">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle row: socials · links · payments ───────────────────────── */}
      <div className="mx-auto max-w-7xl border-b border-[#ffe600]/8">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                  <Icon className="h-[18px] w-[18px]" />
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

            {/* Payment badges — official logos */}
            <div className="flex items-center gap-3">
              {/* Mercado Pago — black-bg logo sits in a subtle bordered pill */}
              <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-[#ffe600] px-3 py-0">
                <img
                  src={mercadoPagoLogo}
                  alt="Mercado Pago"
                  className="h-10 w-auto object-contain"
                />
              </div>

              {/* PayPal — dark-text logo needs a white container to stay legible */}
              <div className="flex items-center overflow-hidden rounded-md border border-white/10 bg-white px-3 py-2">
                <img
                  src={paypalLogo}
                  alt="PayPal"
                  className="h-6 w-auto object-contain"
                />
              </div>
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
