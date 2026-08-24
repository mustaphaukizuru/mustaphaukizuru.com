/* ════════════════════════════════════════════════════════════════════════
   AuthBrandPanel.jsx · v5 · Existing dark-violet layout · Animated bg
   ────────────────────────────────────────────────────────────────────────
   Left-side panel for all four auth pages (Login · Signup ·
   ForgotPassword · ResetPassword). Right-side form is untouched.

   v5 brief — what changed vs. the screenshots you provided:
     · Content layout · IDENTICAL (back link → profile → title →
       subtitle → bullets → © footer).
     · Background · was static decorative circles · now an ANIMATED
       composition of drifting blobs, pulsing particles, and a faint
       dot grid layered over a deep-violet gradient base.
     · Footer · "© year Mustapha Ukizuru · mustaphaukizuru.com" now
       reads "© year Mustapha Ukizuru · mustaphaukizuru.com ·
       All rights reserved."

   Performance note · all animation uses transform / opacity only
   (GPU-accelerated). No animated CSS backgrounds. useReducedMotion
   disables every loop for accessibility.

   Prop API · backwards compatible with the existing pages:
     · title    · used (large headline)
     · subtitle · used (supporting paragraph)
     · bullets  · used (feature list)
     · pageEyebrow, pageIcon, pageAccent · accepted, intentionally unused
   ════════════════════════════════════════════════════════════════════════ */

import { m, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import profilePhoto from "../assets/avatar/avatar-master.png"

import { useTranslation } from "react-i18next"
/* ── Animation variants ──────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
}

/* ── Floating-particle positions · fixed (avoids hydration mismatch) ── */
const PARTICLES = [
  { top: "12%", left: "62%", size: 2, duration: 3.4, delay: 0 },
  { top: "22%", left: "82%", size: 1.5, duration: 2.8, delay: 0.4 },
  { top: "38%", left: "10%", size: 2, duration: 3.6, delay: 0.7 },
  { top: "48%", left: "70%", size: 1.5, duration: 3.0, delay: 1.0 },
  { top: "62%", left: "85%", size: 2, duration: 3.2, delay: 0.2 },
  { top: "72%", left: "12%", size: 1.5, duration: 2.6, delay: 1.3 },
  { top: "82%", left: "55%", size: 2, duration: 3.4, delay: 0.6 },
  { top: "30%", left: "45%", size: 1.5, duration: 2.9, delay: 0.9 },
  { top: "55%", left: "30%", size: 1.5, duration: 3.1, delay: 1.4 },
]

/* ════════════════════════════════════════════════════════════════════════
   AnimatedBackground · drifting blobs + particles + grid + gradient base
   ════════════════════════════════════════════════════════════════════════ */
function AnimatedBackground({ reduce }) {
  return (
    <>
      {/* ── Deep-violet gradient base · static, GPU-cheap ─────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-charcoal via-violet-deep to-violet"
      />

      {/* ── Blob 1 · top-right · large · slow drift ───────────────── */}
      <m.div
        aria-hidden="true"
        animate={
          reduce
            ? undefined
            : {
                x: [0, -28, 18, 0],
                y: [0, 24, -14, 0],
                scale: [1, 1.08, 0.95, 1],
              }
        }
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#7A2DA3]/35 blur-3xl"
      />

      {/* ── Blob 2 · mid-right · medium · counter-phase drift ─────── */}
      <m.div
        aria-hidden="true"
        animate={
          reduce
            ? undefined
            : {
                x: [0, 22, -16, 0],
                y: [0, -22, 18, 0],
                scale: [1, 0.92, 1.10, 1],
              }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        className="pointer-events-none absolute -right-12 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#6B2A8C]/30 blur-3xl"
      />

      {/* ── Blob 3 · bottom-right · small · gentle pulse ──────────── */}
      <m.div
        aria-hidden="true"
        animate={
          reduce
            ? undefined
            : {
                x: [0, -16, 22, 0],
                y: [0, -18, 8, 0],
                scale: [1, 1.12, 0.94, 1],
              }
        }
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2.8 }}
        className="pointer-events-none absolute bottom-20 right-24 h-56 w-56 rounded-full bg-[#9333EA]/22 blur-3xl"
      />

      {/* ── Blob 4 · bottom-left edge · subtle ────────────────────── */}
      <m.div
        aria-hidden="true"
        animate={
          reduce
            ? undefined
            : {
                x: [0, 26, -8, 0],
                y: [0, -12, 22, 0],
                scale: [1, 1.10, 0.95, 1],
              }
        }
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#5E0086]/45 blur-3xl"
      />

      {/* ── Floating particles · soft white pulses ────────────────── */}
      {PARTICLES.map((p, i) => (
        <m.span
          key={i}
          aria-hidden="true"
          animate={
            reduce
              ? undefined
              : { opacity: [0.15, 0.55, 0.15], scale: [1, 1.5, 1] }
          }
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
          style={{
            top: p.top,
            left: p.left,
            height: `${p.size * 4}px`,
            width: `${p.size * 4}px`,
          }}
          className="pointer-events-none absolute rounded-full bg-white/40 blur-[1px]"
        />
      ))}

      {/* ── Faint dot grid · static texture ────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT · default export · same prop API as previous versions
   ════════════════════════════════════════════════════════════════════════ */
export default function AuthBrandPanel({ title, subtitle, bullets = [] }) {
  const { t } = useTranslation("common")
  const reduce = useReducedMotion()
  const year = new Date().getFullYear()

  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:p-12">
      {/* Animated background · sits behind everything */}
      <AnimatedBackground reduce={reduce} />

      {/* ── Top: {t("auth.shell.backHome")} · always visible escape route ───────── */}
      <Link
        to="/"
        className="group relative inline-flex w-fit items-center gap-2 rounded-md px-1 py-0.5 text-[12.5px] font-semibold text-white/65 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        {t("auth.brand.backHome")}
      </Link>

      {/* ── Centered content stack ───────────────────────────────── */}
      <m.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative my-auto flex max-w-md flex-col gap-5"
      >
        {/* Profile row · avatar + name + role */}
        <m.div variants={fadeUp} className="flex items-center gap-3.5">
          <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl ring-2 ring-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <img
              src={profilePhoto}
              alt={t("loading.brandAlt")}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight text-white">
              {t("auth.brand.name")}
            </div>
            <div className="mt-0.5 text-[12.5px] text-white/55">
              {t("auth.brand.title")}
            </div>
          </div>
        </m.div>

        {/* Title · primary content */}
        <m.h1
          variants={fadeUp}
          className="text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.25rem] lg:text-[2.375rem]"
        >
          {title}
        </m.h1>

        {/* Subtitle · supporting copy */}
        {subtitle && (
          <m.p
            variants={fadeUp}
            className="text-[14.5px] leading-7 text-white/65"
          >
            {subtitle}
          </m.p>
        )}

        {/* Bullets · feature list with ringed dot accent */}
        {Array.isArray(bullets) && bullets.length > 0 && (
          <m.ul variants={fadeUp} className="mt-1 flex flex-col gap-2.5">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-center gap-3 text-[13.5px] text-white/75"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/25"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF8E5E]" />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </m.ul>
        )}
      </m.div>

      {/* ── Bottom: © + All Rights Reserved · professional footer ─── */}
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="relative text-[10.5px] font-medium text-white/40"
      >
        © {year} {t("auth.brand.rights")}
      </m.p>
    </div>
  )
}
