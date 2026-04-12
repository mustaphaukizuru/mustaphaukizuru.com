import React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import {
  Download, ArrowRight, Target, Eye, Heart,
  Code, Cloud, Network, GraduationCap, Award,
  Briefcase, ChevronRight, ExternalLink, Sparkles, Star,
  Monitor, Settings,
} from "lucide-react"
import {
  FaHtml5, FaCss3Alt, FaJs, FaReact, FaNodeJs,
  FaGitAlt, FaSass, FaFigma, FaLinux,
} from "react-icons/fa"
import { SiMongodb, SiNpm } from "react-icons/si"
import { VscVscode } from "react-icons/vsc"
import { FaLinkedinIn, FaTelegramPlane, FaWhatsapp } from "react-icons/fa"
import ResumePDF from "/documents/public-downloads/Ukizuru_Mustapha_CV.pdf?url";

const HeadshotPhoto = "/images/profile/Ukizuru_Mustapha_Professional_Headshot.png";
// ── Certificate imports (add these at the top of your file with other imports) ──
const CertPython  = "/documents/certificates/Certificate___Python_for_Data_Science_UKIZURU_Mustapha.pdf";
const CertEnglish = "/documents/certificates/Certificate_English_for_Career_Development_UKIZURU_Mustapha.pdf";
const CertPhilosophy  = "/documents/certificates/Certificate_Philosophy_of_SCience_UKIZURU_Mustapha.pdf";
const CertTeaching   = "/documents/certificates/Certificate_Teaching_with_technology_UKIZURU_Mustapha.pdf";
const CertGoogleEdu   = "/documents/certificates/Google_Certified_Educator_Level_2_UKIZURU_Mustapha.pdf";
const CertGoogleIT   = "/documents/certificates/Certificate_Google_IT_Support_Professional_UKIZURU_Mustapha.pdf";
const CertTechSupport   = "/documents/certificates/Certificate_Technical_Support_Fundamentals_UKIZURU_Mustapha.pdf";
const CertSysAdmin    = "/documents/certificates/Certificate_System_Administration_and_IT_Infrastructure_UKIZURU_Mustapha.pdf";
const CertConstancia  = "/documents/certificates/Certificate_Constancia_UKIZURU_Mustapha.pdf";

// Certificate preview images (PNG, same name as PDF, in /images/certificates/preview/)
const ImgPython      = "/images/certificates/preview/Certificate___Python_for_Data_Science_UKIZURU_Mustapha.png";
const ImgEnglish     = "/images/certificates/preview/Certificate_English_for_Career_Development_UKIZURU_Mustapha.png";
const ImgPhilosophy  = "/images/certificates/preview/Certificate_Philosophy_of_SCience_UKIZURU_Mustapha.png";
const ImgTeaching    = "/images/certificates/preview/Certificate_Teaching_with_technology_UKIZURU_Mustapha.png";
const ImgGoogleEdu   = "/images/certificates/preview/Google_Certified_Educator_Level_2_UKIZURU_Mustapha.png";
const ImgGoogleIT    = "/images/certificates/preview/Certificate_Google_IT_Support_Professional_UKIZURU_Mustapha.png";
const ImgTechSupport = "/images/certificates/preview/Certificate_Technical_Support_Fundamentals_UKIZURU_Mustapha.png";
const ImgSysAdmin    = "/images/certificates/preview/Certificate_System_Administration_and_IT_Infrastructure_UKIZURU_Mustapha.png";
const ImgConstancia  = "/images/certificates/preview/Certificate_Constancia_UKIZURU_Mustapha.png";

// -- PdfThumbnail: renders PDF page 1 as a sharp canvas, fits card like a photo --
function PdfThumbnail({ pdf, title }) {
  const wrapRef   = React.useRef(null)
  const canvasRef = React.useRef(null)
  const pageRef   = React.useRef(null)
  const [loading, setLoading] = React.useState(true)
  const [error,   setError]   = React.useState(false)

  // Draw the page scaled to fit the current container width, preserving aspect ratio
  function drawPage(page, width) {
    const canvas = canvasRef.current
    if (!canvas || !page) return
    const dpr      = window.devicePixelRatio || 1
    const vp1      = page.getViewport({ scale: 1 })
    const scale    = (width * dpr) / vp1.width
    const viewport = page.getViewport({ scale })
    // Set canvas pixel size
    canvas.width  = viewport.width
    canvas.height = viewport.height
    // Set CSS display size so height follows naturally
    canvas.style.width  = width + 'px'
    canvas.style.height = (viewport.height / dpr) + 'px'
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    page.render({ canvasContext: ctx, viewport }).promise.then(() => {
      setLoading(false)
    })
  }

  React.useEffect(() => {
    if (!pdf) { setError(true); setLoading(false); return }
    let cancelled = false

    async function load() {
      try {
        // Load pdf.js from CDN once
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script')
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
            s.onload = resolve; s.onerror = reject
            document.head.appendChild(s)
          })
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
        const doc  = await window.pdfjsLib.getDocument(pdf).promise
        if (cancelled) return
        const page = await doc.getPage(1)
        if (cancelled) return
        pageRef.current = page

        const containerW = wrapRef.current?.clientWidth || 300
        drawPage(page, containerW)

        // Re-draw if container resizes (responsive)
        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(entries => {
            const w = entries[0]?.contentRect?.width
            if (w && pageRef.current) drawPage(pageRef.current, w)
          })
          if (wrapRef.current) ro.observe(wrapRef.current)
          return () => ro.disconnect()
        }
      } catch {
        if (!cancelled) { setError(true); setLoading(false) }
      }
    }

    load()
    return () => { cancelled = true }
  }, [pdf])

  if (error) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1a0028] via-[#2d0050] to-[#420060] p-8" style={{minHeight:'180px'}}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCCAF]/10 ring-1 ring-[#FFCCAF]/20">
          <Award className="h-6 w-6 text-[#FFCCAF]" />
        </div>
        <p className="line-clamp-2 px-2 text-center text-[11px] font-bold leading-tight text-white/90">{title}</p>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative w-full bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F7F9F4]" style={{minHeight:'180px'}}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#420060]/20 border-t-[#420060]" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: loading ? 'none' : 'block', maxWidth: '100%' }}
        aria-label={title}
      />
    </div>
  )
}


// ── Certifications data (place inside the component or at module level) ──
const certifications = [
  { title: "Python 101 for Data Science",                   description: "IBM / Cognitive Class",              pdf: CertPython,      image: ImgPython },
  { title: "English for Career Development",                description: "UPenn / Coursera",                   pdf: CertEnglish,     image: ImgEnglish },
  { title: "Philosophy of Science",                         description: "UPenn / Coursera",                   pdf: CertPhilosophy,  image: ImgPhilosophy },
  { title: "Practical Teaching with Technology",             description: "University of London / Coursera",    pdf: CertTeaching,    image: ImgTeaching },
  { title: "Google Certified Educator Level 2",             description: "Google for Education",               pdf: CertGoogleEdu,   image: ImgGoogleEdu },
  { title: "Google IT Support Professional",                description: "Google / Coursera",                  pdf: CertGoogleIT,    image: ImgGoogleIT },
  { title: "Technical Support Fundamentals",                description: "Google / Coursera",                  pdf: CertTechSupport, image: ImgTechSupport },
  { title: "System Administration & IT Infrastructure",     description: "Google / Coursera",                  pdf: CertSysAdmin,    image: ImgSysAdmin },
  { title: "Maestras y Maestros Construimos Igualdad",      description: "Gobierno del Estado de México",      pdf: CertConstancia,  image: ImgConstancia },
]

import {
  aboutMissionVisionValues, expertiseAreas,
  educationTimeline, experienceTimeline, skillsColumns,
} from "../data/sitePagesData"
import { aboutProjects } from "../data/aboutProjectsData"

const fadeUp = { hidden:{opacity:0,y:24}, show:{opacity:1,y:0,transition:{duration:0.52,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.09}} }

function Container({ children, className="" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}
function SH({ eyebrow,title,subtitle,align="center" }) {
  const c = align==="center"
  return (
    <div className={`mb-12 flex flex-col gap-3 ${c?"items-center text-center":"items-start"}`}>
      {eyebrow && <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">{eyebrow}</span>}
      <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem] lg:text-[2.2rem]">{title}</h2>
      {subtitle && <p className={`max-w-2xl text-[15px] leading-7 text-[#634F40]/70 ${c?"mx-auto":""}`}>{subtitle}</p>}
    </div>
  )
}

const MVVIcons = { "Our Mission": Target, "Our Vision": Eye, "Our Values": Heart }
const ExpertiseIcons = { "Software Engineering": Code, "Cloud Systems": Cloud, "Digital Infrastructure": Network, "Education Technology": GraduationCap }

const toolIcons = {
  "HTML5": FaHtml5, "CSS3": FaCss3Alt, "JavaScript": FaJs, "React": FaReact,
  "Node.js": FaNodeJs, "MongoDB": SiMongodb, "Git": FaGitAlt, "npm": SiNpm,
  "Sass": FaSass, "Figma": FaFigma, "VS Code": VscVscode, "Linux": FaLinux,
}
const toolColorMap = {
  "HTML5":"#E34F26","CSS3":"#1572B6","JavaScript":"#F7DF1E","React":"#61DAFB",
  "Node.js":"#339933","MongoDB":"#47A248","Git":"#F05032","npm":"#CB3837",
  "Sass":"#CC6699","Figma":"#F24E1E","VS Code":"#007ACC","Linux":"#FCC624",
}

function SkillBar({ name, value }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[13px] font-medium">
        <span className="text-[#420060]">{name}</span>
        <span className="text-[#634F40]/60">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#ede4ef]">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
          className="h-full rounded-full bg-[#420060]"
        />
      </div>
    </div>
  )
}

export default function AboutPage() {
  const [activeSkillTab, setActiveSkillTab] = useState("technical")

  const skillTabs = {
    technical:   { label: "Technical",    data: skillsColumns.technical },
    professional:{ label: "Professional", data: skillsColumns.professional },
    language:    { label: "Languages",    data: skillsColumns.language },
  }

  const toolsList = ["HTML5","CSS3","JavaScript","React","Node.js","MongoDB","Git","npm","Sass","Figma","VS Code","Linux"]

  /* ── Animation variants ───────────────────────────────────────────── */
  const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.7, ease: "easeOut" } } }
  const floatBadge = (delay) => ({
    hidden: { opacity: 0, scale: 0.8, y: 16 },
    show:   { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: "easeOut", delay } },
  })

  /* ── Floating service badges (shown around the photo) ─────────────── */
const badges = [
  { label: "Digital Systems",   Icon: Monitor,       top: "18%",  right: "6%",  delay: 0.3 },
  { label: "Tech Consulting",   Icon: Settings,      top: "42%", right: "-2%", delay: 0.5 },
  { label: "STEM & Robotics",   Icon: GraduationCap, top: "72%", right: "6%",  delay: 0.7 },
]

  /* ── Stats data ───────────────────────────────────────────────────── */
  const stats = [
    { value: "8+",  label: "Years Experience" },
    { value: "10+", label: "Projects Done" },
    { value: "93%", label: "Client Satisfaction" },
  ]

  return (
    <>
      <Seo {...pageSeo.AboutPage} />


      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden bg-[#F7F9F4]"
        style={{ background: "linear-gradient(160deg, #F7F9F4 0%, #f3eaf5 40%, #F1EAE3 100%)" }}
      >
        {/* Background blurs */}
        <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-[#420060]/4 blur-3xl sm:h-[500px] sm:w-[500px]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[250px] w-[250px] rounded-full bg-[#FFCCAF]/20 blur-2xl sm:h-[350px] sm:w-[350px]" />

        <Container className="sm:py-20 xl:flex xl:min-h-[85vh] xl:items-center xl:py-8">
          <div className="grid w-full items-center gap-10 xl:grid-cols-2 xl:gap-12">

            {/* ── LEFT COLUMN ───────────────────────────────────────── */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center sm:gap-6 xl:items-start xl:text-left">

              {/* Headline */}
              <motion.div variants={fadeUp} className="flex flex-col gap-2 sm:gap-3">
                <p className="text-[0.85rem] font-semibold text-[#634F40]/70 sm:text-[1rem]">Hello, I Am</p>
                <h1 className="text-[1.8rem] font-extrabold leading-[1.08] tracking-tight text-[#420060] sm:text-[2.6rem] md:text-[3rem] xl:text-[3.6rem]">
                  Let's Build{" "}
                  <span className="text-[#634F40]/80">Together,</span>
                  <br />
                  <span className="text-[#FFCCAF]">Digital</span> Solutions
                </h1>
              </motion.div>

              {/* Description */}
              <motion.p variants={fadeUp} className="max-w-2xl text-[13.5px] leading-6 text-[#634F40]/60 sm:text-[15px] sm:leading-7">
                A technology consultant & digital systems expert,
                crafting modern infrastructure and STEM programs.
                Adept at turning complex challenges into streamlined digital reality.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3 xl:justify-start">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] sm:px-7 sm:py-3.5 sm:text-[14px]"
                >
                  Let's Talk <ArrowRight className="h-4 w-4" />
                </Link>
                <a
href={ResumePDF}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#420060] transition hover:-translate-y-0.5 hover:bg-[#ede4ef] sm:px-7 sm:py-3.5 sm:text-[14px]"
>
  <Download className="h-4 w-4" /> 
  Download Resume
</a>


              </motion.div>

              {/* Social icons */}
              <motion.div variants={fadeUp} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/40">Follow</span>
                <div className="h-px w-8 bg-[#634F40]/15" />
                <div className="flex gap-2.5">
                  {[
                    { name: "LinkedIn", href: "https://www.linkedin.com/in/mustaphaukizuru/", Icon: FaLinkedinIn,    bg: "#0077B5" },
                    { name: "Telegram", href: "https://t.me/mustaphaukizuru",                  Icon: FaTelegramPlane, bg: "#0088cc" },
                    { name: "WhatsApp", href: "https://wa.me/+525552139993",                    Icon: FaWhatsapp,      bg: "#25D366" },
                  ].map(({ name, href, Icon, bg }) => (
                    <a
                      key={name}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={name}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)] sm:h-10 sm:w-10"
                      style={{ background: bg }}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </a>
                  ))}
                </div>
              </motion.div>

              {/* Stats row — always 3 columns, never wraps */}
              <motion.div variants={fadeUp} className="grid w-full max-w-sm grid-cols-3 gap-4 pt-3 sm:max-w-md sm:gap-8 sm:pt-4 xl:max-w-none xl:w-auto xl:flex xl:gap-10">
                {stats.map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center xl:items-start">
                    <span className="text-[1.6rem] font-extrabold leading-none text-[#420060] sm:text-[2.2rem] xl:text-[2.6rem]">
                      {value}
                    </span>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#634F40]/50 sm:text-[10px] sm:tracking-[0.15em] xl:text-[11px]">
                      {label}
                    </span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── RIGHT COLUMN: Photo with floating badges ──────────── */}
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="show"
              className="relative mx-auto flex items-center justify-center xl:mx-0 xl:justify-end"
            >
         
              {/* Soft glow behind person */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#420060]/[0.06] blur-2xl h-[58vw] w-[58vw] sm:h-[290px] sm:w-[290px] md:h-[340px] md:w-[340px] xl:h-[440px] xl:w-[440px]" />

              {/* Photo — circular, scales per breakpoint */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                className="relative z-10 overflow-hidden rounded-full h-[65vw] w-[65vw] sm:h-[550px] sm:w-[550px] md:h-[600px] md:w-[600px] xl:h-[650px] xl:w-[650px]"
              >
                <img
                  src={HeadshotPhoto}
                  alt="Mustapha Ukizuru"
                  className="h-full w-full object-cover object-top object-center"
                />

              </motion.div>

              {/* Floating badges — hidden until xl (1280px+) */}
              {badges.map(({ label, Icon, top, right, delay }) => (
                <motion.div
                  key={label}
                  variants={floatBadge(delay)}
                  initial="hidden"
                  animate="show"
                  className="absolute z-20 hidden items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-[0_8px_28px_rgba(66,0,96,0.12)] xl:flex"
                  style={{ top, right }}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ede4ef]">
                    <Icon className="h-4 w-4 text-[#420060]" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#2E2F3A]">{label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ── MISSION VISION VALUES ──────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="mb-14 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">Core Principles</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem]">Mission, Vision, and Values</h2>
            <p className="max-w-xl text-[15px] leading-7 text-[#634F40]/65">A commitment to delivering practical technology solutions that empower organizations and individuals to grow.</p>
          </div>

          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-3"
          >
            {aboutMissionVisionValues.map(({ title, description }, i) => {
              const Icon = MVVIcons[title]
              const schemes = [
                { bg:"bg-[#420060]",   icon:"bg-white/15 text-white",      text:"text-white",      sub:"text-white/65",  ring:"ring-[#420060]/20" },
                { bg:"bg-white",       icon:"bg-[#ede4ef] text-[#420060]", text:"text-[#420060]",  sub:"text-[#634F40]/65", ring:"ring-[#634F40]/10" },
                { bg:"bg-[#2E2F3A]",   icon:"bg-white/10 text-[#FFCCAF]", text:"text-white",      sub:"text-white/55",  ring:"ring-[#2E2F3A]/20" },
              ]
              const s = schemes[i]
              return (
                <motion.div key={title} variants={fadeUp}
                  className={`group relative flex flex-col gap-6 overflow-hidden rounded-xl p-7 shadow-[0_12px_40px_rgba(66,0,96,0.10)] ring-1 transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(66,0,96,0.16)] ${s.bg} ${s.ring}`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10" style={{ background:"currentColor" }} />
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${s.icon}`}>
                    {Icon && <Icon className="h-7 w-7" />}
                  </div>
                  <div>
                    <h3 className={`text-[18px] font-bold ${s.text}`}>{title}</h3>
                    <p className={`mt-3 text-[14px] leading-6 ${s.sub}`}>{description}</p>
                  </div>
                  <div className="mt-auto h-1 w-12 rounded-full bg-[#FFCCAF]" />
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ── EXPERTISE ─────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="Expertise" title="Areas of Expertise" subtitle="Specialized knowledge in modern technology systems, infrastructure, and digital transformation." />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {expertiseAreas.map(({ title, description }) => {
              const Icon = ExpertiseIcons[title]
              return (
                <motion.div key={title} variants={fadeUp}
                  className="group flex flex-col gap-5 rounded-xl border border-[#634F40]/10 bg-white p-7 shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060] transition group-hover:bg-[#420060] group-hover:text-white">
                    {Icon && <Icon className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#420060]">{title}</h3>
                    <p className="mt-2 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
                  </div>
                  <Link to="/contact" className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#420060] hover:underline">
                    View expertise <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ── PROFESSIONAL JOURNEY ───────────────────────────────────────────── */}
      <section className="bg-[#2E2F3A] py-20 lg:py-28">
        <Container>
          <div className="mb-14 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Journey</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem]">Professional Journey</h2>
            <p className="max-w-xl text-[15px] leading-7 text-white/55">A career built through technology leadership, education, and hands-on consulting experience.</p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Education */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#420060] text-white shadow-[0_8px_20px_rgba(66,0,96,0.30)]">
                  <GraduationCap className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-white">Education</div>
                  <div className="text-[11px] text-white/40">Academic & formal training</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-[19px] top-0 h-full w-px bg-gradient-to-b from-[#420060] via-[#420060]/40 to-transparent" />
                <div className="space-y-6">
                  {educationTimeline.map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity:0, x:-20 }}
                      whileInView={{ opacity:1, x:0 }}
                      viewport={{ once:true }}
                      transition={{ duration:0.5, delay: i * 0.1 }}
                      className="relative flex gap-5 pl-12"
                    >
                      <div className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#420060] text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(66,0,96,0.35)] ring-4 ring-[#2E2F3A]">
                        {String(educationTimeline.length - i).padStart(2,"0")}
                      </div>
                      <div className="flex-1 overflow-hidden rounded-xl border border-white/8 bg-white/6 p-5 transition hover:bg-white/10">
                        <div className="mb-1.5 inline-flex rounded-full bg-[#420060]/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FFCCAF]">
                          {item.period}
                        </div>
                        <div className="text-[14px] font-bold text-white leading-5">{item.title}</div>
                        <p className="mt-1.5 text-[12px] leading-5 text-white/50">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Experience */}
            <div>
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFCCAF] text-[#420060] shadow-[0_8px_20px_rgba(255,204,175,0.30)]">
                  <Briefcase className="h-5.5 w-5.5" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-white">Experience</div>
                  <div className="text-[11px] text-white/40">Professional career</div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-[19px] top-0 h-full w-px bg-gradient-to-b from-[#FFCCAF] via-[#FFCCAF]/40 to-transparent" />
                <div className="space-y-6">
                  {experienceTimeline.map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity:0, x:20 }}
                      whileInView={{ opacity:1, x:0 }}
                      viewport={{ once:true }}
                      transition={{ duration:0.5, delay: i * 0.1 }}
                      className="relative flex gap-5 pl-12"
                    >
                      <div className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFCCAF] text-[#420060] text-[11px] font-bold shadow-[0_4px_12px_rgba(255,204,175,0.35)] ring-4 ring-[#2E2F3A]">
                        {String(experienceTimeline.length - i).padStart(2,"0")}
                      </div>
                      <div className="flex-1 overflow-hidden rounded-xl border border-white/8 bg-white/6 p-5 transition hover:bg-white/10">
                        <div className="mb-1.5 inline-flex rounded-full bg-[#FFCCAF]/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FFCCAF]">
                          {item.period}
                        </div>
                        <div className="text-[14px] font-bold text-white leading-5">{item.title}</div>
                        <p className="mt-1.5 text-[12px] leading-5 text-white/50">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

        {/* ── CERTIFICATIONS ────────────────────────────────────────────────── */}
      <section className="bg-[#2E2F3A] py-20 lg:py-28">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[320px_1fr] xl:grid-cols-[380px_1fr] xl:gap-14">

            {/* Left intro column */}
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="flex flex-col items-center gap-5 text-center lg:sticky lg:top-28 lg:items-start lg:text-left">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Credentials</span>
              <div>
                <p className="text-[1rem] italic text-[#FFCCAF]/70">Check Out</p>
                <h2 className="mt-1 text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem]">
                  My Certifications
                </h2>
              </div>
              <p className="max-w-xs text-[14px] leading-6 text-white/50">
                Industry credentials that demonstrate technical expertise and continuous professional development.
              </p>
              <Link
                to="/contact"
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#FFCCAF]/30 px-6 py-3 text-[13px] font-semibold text-[#FFCCAF] transition hover:bg-[#FFCCAF]/10"
              >
                Know More <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Right certificate grid — 3 columns */}
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {certifications.map(({ title, description, image, pdf }) => (
                <motion.a
                  key={title}
                  href={pdf || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={fadeUp}
                  className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.04] transition-all hover:-translate-y-1 hover:bg-white/[0.08] hover:shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
                >
                  {/* Certificate preview: real PDF render via pdf.js, responsive like a photo */}
                  <div className="relative w-full overflow-hidden rounded-t-xl">
                    {image ? (
                      <img
                        src={image}
                        alt={title}
                        className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <PdfThumbnail pdf={pdf} title={title} />
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-[#420060]/0 opacity-0 transition-all duration-300 group-hover:bg-[#420060]/50 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-[#420060] shadow-lg">
                        <ExternalLink className="h-3.5 w-3.5" /> Open PDF
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center">
                    <h3 className="text-[13px] font-bold leading-snug text-white">{title}</h3>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFCCAF]/60">{description}</p>
                  </div>
                </motion.a>
              ))}
            </motion.div>
          </div>
        </Container>
      </section>



{/* ── SKILLS ────────────────────────────────────────────────────────── */}
      <section className="bg-[#F7F9F4] py-20 lg:py-20">
        <Container>
          <SH eyebrow="Skills" title="Technical and Professional Skills" subtitle="A balanced combination of engineering expertise, strategic thinking, and communication skills." />

          {/* 3 equal columns — Technical, Professional, Languages */}
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
            {Object.entries(skillTabs).map(([key, { label, data }]) => (
              <div key={key} className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_8px_24px_rgba(66,0,96,0.05)]">
                <h3 className="mb-6 text-center text-[15px] font-bold text-[#420060]">{label}</h3>
                <div className="space-y-4">
                  {data.map(({ name, value }) => (
                    <SkillBar key={name} name={name} value={value} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tools grid */}
          <div className="mt-16">
            <h3 className="mb-6 text-center text-[17px] font-bold text-[#420060]">Tools & Technologies</h3>
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
            >
              {toolsList.map((tool) => {
                const Icon = toolIcons[tool]
                const color = toolColorMap[tool] || "#420060"
                return (
                  <motion.div key={tool} variants={fadeUp}
                    className="flex flex-col items-center gap-2.5 rounded-xl border border-[#634F40]/10 bg-white p-4 shadow-[0_4px_12px_rgba(66,0,96,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(66,0,96,0.09)]"
                  >
                    {Icon && <Icon className="h-7 w-7" style={{ color }} />}
                    <span className="text-[11px] font-semibold text-[#420060]">{tool}</span>
                  </motion.div>
                )
              })}
            </motion.div>
          </div>
        </Container>
      </section>
      
{/* ── PROJECTS ──────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="Portfolio" title="Selected Projects" subtitle="Technology solutions and digital systems delivered across multiple industries and organizations." />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {aboutProjects.map(({ id, title, description, image, images, tags, year, link, website }) => {
              const gallery = images && images.length > 0 ? images : [image]
              const [active, setActive] = useState(0)

              useEffect(() => {
                if (gallery.length <= 1) return
                const t = setInterval(() => setActive((p) => (p + 1) % gallery.length), 3000)
                return () => clearInterval(t)
              }, [gallery.length])

              return (
                <motion.div key={id} variants={fadeUp}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
                >
                  {/* Auto-rotating image */}
                  <div className="relative h-48 overflow-hidden bg-[#ede4ef]">
                    <img src={gallery[active]} alt={title} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 text-[11px] font-semibold text-white/80">{year}</div>
                    {gallery.length > 1 && (
                      <div className="absolute bottom-3 right-3 flex gap-1">
                        {gallery.map((_, i) => (
                          <button key={i} type="button" onClick={() => setActive(i)}
                            className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                    <p className="mt-2 flex-1 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-lg bg-[#ede4ef] px-2.5 py-1 text-[11px] font-semibold text-[#420060]">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Link to={link} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#420060] hover:underline">
                        Learn More <ChevronRight className="h-4 w-4" />
                      </Link>
                      {website && (
                        <a href={website} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#420060]/60 transition hover:text-[#420060]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Visit Site
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="pb-20 lg:pb-28">
        <Container>
          <div className="relative overflow-hidden rounded-xl bg-[#420060] px-8 py-14 text-center">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Work Together</span>
            <h2 className="mx-auto mt-4 max-w-xl text-[1.9rem] font-bold text-white">Ready to Build Something Together?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/60">Let's discuss your technology needs and create solutions that drive real results.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:-translate-y-0.5 hover:shadow-md">
                Get In Touch <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/store" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10">
                Explore Store
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
