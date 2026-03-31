import { useState } from "react"
import { motion } from "framer-motion"
import {
  Send, CheckCircle2, Mail, User, MessageSquare,
  MapPin, Clock, ArrowRight, Sparkles, Phone,
} from "lucide-react"
// social icons use inline SVG components below
import contactPhoto from "../assets/contactimage.svg"
import { apiRequest } from "../lib/api"

// Lightweight inline social icons (replaces react-icons/fa bundle)
function LinkedInIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
}
function TelegramIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.015 9.497c-.148.665-.54.827-1.093.514l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.887.718z"/></svg>
}
function WhatsAppIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.72.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 1.856.001 3.598.723 4.907 2.034 1.31 1.311 2.031 3.054 2.03 4.908-.001 3.825-3.113 6.938-6.937 6.938z"/></svg>
}
const FaLinkedinIn = LinkedInIcon
const FaTelegramPlane = TelegramIcon
const FaWhatsapp = WhatsAppIcon

const fadeUp = { hidden:{opacity:0,y:24}, show:{opacity:1,y:0,transition:{duration:0.52,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.09}} }

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────
function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-[#2E2F3A] py-20 lg:py-28">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#420060]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 left-1/4 h-56 w-56 rounded-full bg-[#FFCCAF]/10 blur-2xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-6 text-center">
          <motion.span variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">
            <Sparkles className="h-3.5 w-3.5" /> Let's Connect
          </motion.span>

          <motion.h1 variants={fadeUp} className="max-w-3xl text-[2.6rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[3.2rem]">
            Start Your Digital{" "}
            <span className="text-[#FFCCAF]">Transformation</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="max-w-xl text-[16px] leading-7 text-white/55">
            Whether you need digital consulting, infrastructure support, STEM programs, or technology strategy — reach out and let's discuss your goals.
          </motion.p>

          {/* Quick contact stats */}
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-6 pt-2">
            {[
              { icon: Clock, label: "Response Time", value: "Within 24h" },
              { icon: MapPin, label: "Location",      value: "Worldwide" },
              { icon: Phone, label: "Availability",   value: "Mon – Sat" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-5 py-3">
                <Icon className="h-5 w-5 text-[#FFCCAF]" />
                <div>
                  <div className="text-[11px] text-white/40">{label}</div>
                  <div className="text-[14px] font-semibold text-white">{value}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTACT SECTION — image left, form right
// ─────────────────────────────────────────────────────────────────────────────
function ContactSection() {
  const [form, setForm]       = useState({ name:"", email:"", message:"" })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState("")

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in all fields."); return
    }
    setError(""); setLoading(true)
    try {
      await apiRequest("/api/contact", { method:"POST", body: JSON.stringify(form) })
      setSuccess(true); setForm({ name:"", email:"", message:"" })
    } catch (err) {
      setError(err.message || "Failed to send. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const socialLinks = [
    {
      label: "LinkedIn",
      href:  "https://www.linkedin.com/in/mustaphaukizuru/",
      icon:  FaLinkedinIn,
      bg:    "bg-[#0077B5]",
      hover: "hover:bg-[#005f93]",
    },
    {
      label: "Telegram",
      href:  "https://t.me/mustaphaukizuru",
      icon:  FaTelegramPlane,
      bg:    "bg-[#0088cc]",
      hover: "hover:bg-[#006fa8]",
    },
    {
      label: "WhatsApp",
      href:  "https://wa.me/250000000000",
      icon:  FaWhatsapp,
      bg:    "bg-[#25D366]",
      hover: "hover:bg-[#1aad52]",
    },
  ]

  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">

          {/* ── LEFT: Image + info + social ──────────────────────────────── */}
          <motion.div
            initial={{ opacity:0, x:-24 }} whileInView={{ opacity:1, x:0 }}
            viewport={{ once:true }} transition={{ duration:0.55, ease:"easeOut" }}
            className="flex flex-col gap-8"
          >
            {/* Portrait image */}
            <div className="relative overflow-hidden rounded-xl border border-[#634F40]/10">
              <img
                src={contactPhoto}
                alt="Mustapha Ukizuru — Contact - Technology Consultant"
                className="h-[320px] w-full object-cover object-top sm:h-[480px]"
              />
            </div>

            {/* Social media icons */}
            <div className="flex flex-col gap-4">
              <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#634F40]/50">
                Connect on
              </div>
              <div className="flex gap-3">
                {socialLinks.map(({ label, href, icon: Icon, bg, hover }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${bg} ${hover}`}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>

              {/* Contact info */}
              <div className="space-y-3">
                {[
                  { icon: Mail,  label: "Email",    value: "hello@mustaphaukizuru.com" },
                  { icon: Clock, label: "Response",  value: "Within 24 hours" },
                  { icon: MapPin, label: "Location", value: "Available worldwide" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 text-[14px] text-[#634F40]/70">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[#634F40]/50">{label}:</span>
                    <span className="font-medium text-[#420060]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: Contact form ───────────────────────────────────────── */}
          <motion.div
            initial={{ opacity:0, x:24 }} whileInView={{ opacity:1, x:0 }}
            viewport={{ once:true }} transition={{ duration:0.55, ease:"easeOut", delay:0.1 }}
          >
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-8 shadow-[0_16px_48px_rgba(66,0,96,0.08)] lg:p-10">
              <div className="mb-7">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">
                  <Sparkles className="h-3 w-3" /> Get in Touch
                </span>
                <h2 className="mt-3 text-[1.7rem] font-bold tracking-tight text-[#420060]">
                  Send a Message
                </h2>
                <p className="mt-2 text-[14px] leading-6 text-[#634F40]/60">
                  Tell us about your project or technology needs and we'll get back to you within 24 hours.
                </p>
              </div>

              {success ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#e8f4ea] text-[#2FA36B]">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h4 className="text-[17px] font-bold text-[#420060]">Message Sent!</h4>
                  <p className="text-[14px] text-[#634F40]/60">We'll respond within 24 hours.</p>
                  <button type="button" onClick={() => setSuccess(false)}
                    className="mt-2 text-[13px] font-medium text-[#420060] hover:underline"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
                  )}

                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#420060]">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35" />
                      <input type="text" value={form.name} onChange={update("name")}
                        placeholder="Your full name"
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-4 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#420060]">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35" />
                      <input type="email" value={form.email} onChange={update("email")}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-4 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-semibold text-[#420060]">Message</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-4 top-4 h-4 w-4 text-[#634F40]/35" />
                      <textarea rows={5} value={form.message} onChange={update("message")}
                        placeholder="Tell us about your project or technology needs…"
                        className="w-full resize-none rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-4 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#420060] to-[#2d003f] py-4 text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(66,0,96,0.30)] disabled:opacity-60"
                  >
                    {loading ? "Sending…" : "Get a Free Consultation"}
                    <Send className="h-4 w-4" />
                  </button>

                  <p className="text-center text-[11px] text-[#634F40]/40">
                    We respect your privacy. Your information is never shared.
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ContactPage() {
  return (
    <>
      <ContactHero />
      <ContactSection />
    </>
  )
}
