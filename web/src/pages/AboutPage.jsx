import { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Download, ArrowRight, Target, Eye, Heart,
  Code, Cloud, Network, GraduationCap, Award,
  Briefcase, ChevronRight, ExternalLink, Sparkles, Star,
} from "lucide-react"
import {
  FaHtml5, FaCss3Alt, FaJs, FaReact, FaNodeJs,
  FaGitAlt, FaSass, FaFigma, FaLinux,
} from "react-icons/fa"
import { SiMongodb, SiNpm } from "react-icons/si"
import { VscVscode } from "react-icons/vsc"
import { FaLinkedinIn, FaTelegramPlane, FaWhatsapp } from "react-icons/fa"
import profilePhoto from "../assets/Ukizuru Mustapha Photo.jpg"
import {
  aboutMissionVisionValues, expertiseAreas,
  educationTimeline, experienceTimeline,
  certifications, skillsColumns,
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

function TimelineItem({ item, side }) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-2 h-3 w-3 rounded-full border-2 border-[#420060] bg-white" />
      <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_6px_20px_rgba(66,0,96,0.05)]">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#634F40]/50">{item.period}</div>
        <div className="text-[15px] font-bold text-[#420060]">{item.title}</div>
        <p className="mt-1.5 text-[13px] leading-5 text-[#634F40]/65">{item.description}</p>
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

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] overflow-hidden bg-[#F7F9F4]" style={{ background: "linear-gradient(160deg, #F7F9F4 0%, #f3eaf5 40%, #F1EAE3 100%)" }}>
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#420060]/4 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[350px] w-[350px] rounded-full bg-[#FFCCAF]/20 blur-2xl" />

        <Container className="flex min-h-[85vh] items-center py-24">
          <div className="grid w-full items-center gap-0 lg:grid-cols-[1fr_auto_1fr]">

            {/* LEFT */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-7 pr-0 lg:pr-10">
              <motion.div variants={fadeUp} className="flex flex-col gap-2">
                <p className="text-[1.1rem] font-semibold text-[#634F40]/70">Hello, I Am</p>
                <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-[#420060] sm:text-[3.2rem]">
                  Mustapha <span className="text-[#FFCCAF]">Ukizuru.</span>
                </h1>
                <p className="text-[15px] font-medium text-[#634F40]/65">Technology Consultant & Digital Systems Expert</p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-center gap-5">
                <div>
                  <div className="text-[2.8rem] font-extrabold leading-none text-[#420060]">5+</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/50">Years Experience</div>
                </div>
                <div className="h-10 w-px bg-[#634F40]/15" />
                <div>
                  <div className="text-[2rem] font-extrabold leading-none text-[#420060]">50+</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/50">Projects Done</div>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]">
                  Hire Me <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="/resume.pdf" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef] hover:-translate-y-0.5">
                  <Download className="h-4 w-4" /> Resume
                </a>
              </motion.div>

              {/* Social icons */}
              <motion.div variants={fadeUp} className="flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/40">Follow</span>
                <div className="h-px flex-1 max-w-[32px] bg-[#634F40]/15" />
                <div className="flex gap-2.5">
                  {[
                    { name:"LinkedIn", href:"https://www.linkedin.com/in/mustaphaukizuru/", Icon: FaLinkedinIn,    bg:"#0077B5" },
                    { name:"Telegram", href:"https://t.me/mustaphaukizuru",                  Icon: FaTelegramPlane, bg:"#0088cc" },
                    { name:"WhatsApp", href:"https://wa.me/250000000000",                    Icon: FaWhatsapp,      bg:"#25D366" },
                  ].map(({ name, href, Icon, bg }) => (
                    <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                      style={{ background: bg }}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </motion.div>
            </motion.div>

            {/* CENTER: Circular portrait */}
            <motion.div
              initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }}
              transition={{ duration:0.7, ease:"easeOut", delay:0.1 }}
              className="relative mx-auto my-12 flex items-center justify-center lg:my-0"
              style={{ width: 340, height: 400 }}
            >
              {/* Dashed arrow arc */}
              <svg className="pointer-events-none absolute -left-14 top-1/3 hidden xl:block" width="110" height="130" viewBox="0 0 110 130" fill="none">
                <path d="M85,8 C38,18 8,55 18,105 C20,116 26,124 34,126" stroke="#420060" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" fill="none" opacity="0.3"/>
                <path d="M26,100 L34,126 L56,118" stroke="#420060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.3"/>
              </svg>

              {/* Gold gradient ring */}
              <div className="absolute inset-0 rounded-full" style={{ padding: 5, background: "linear-gradient(135deg, #FFCCAF 0%, #420060 55%, #FFCCAF 100%)" }}>
                <div className="h-full w-full rounded-full bg-[#F7F9F4]" />
              </div>

              {/* Photo */}
              <div className="relative z-10 overflow-hidden rounded-full shadow-[0_16px_48px_rgba(66,0,96,0.18)]" style={{ width:322, height:382 }}>
                <img src={profilePhoto} alt="Mustapha Ukizuru" className="h-full w-full object-cover object-top" />
              </div>

              {/* Floating badges */}
              {[
                { label:"IT Manager",     top:"6%",  left:"-30%",  delay:0,    icon:"💼" },
                { label:"CS Teacher",     top:"25%", right:"-35%", delay:0.15, icon:"👨‍💻" },
                { label:"STEM Expert",    top:"60%", left:"-32%",  delay:0.3,  icon:"🤖" },
                { label:"Consultant",     top:"75%", right:"-33%", delay:0.2,  icon:"🎯" },
                { label:"MSc Graduate",   top:"44%", left:"-36%",  delay:0.4,  icon:"🎓" },
                { label:"Digital Builder",top:"90%", left:"10%",   delay:0.35, icon:"⚡" },
              ].map(({ label, top, left, right, delay, icon }) => (
                <motion.div
                  key={label}
                  initial={{ opacity:0, scale:0.6 }} animate={{ opacity:1, scale:1 }}
                  transition={{ duration:0.45, delay: 0.55 + delay, ease:"backOut" }}
                  className="absolute z-20 flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-[11px] font-semibold text-[#420060] shadow-[0_6px_20px_rgba(66,0,96,0.12)] backdrop-blur-sm"
                  style={{ top, left, right }}
                >
                  <span className="text-[13px]">{icon}</span>{label}
                </motion.div>
              ))}
            </motion.div>

            {/* RIGHT */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-7 pl-0 lg:pl-10">
              <motion.div variants={fadeUp} className="text-right">
                <p className="text-[1rem] leading-7 text-[#634F40]/60 italic">
                  I build modern digital systems,<br />
                  <span className="not-italic font-semibold text-[#420060]">and I love what I do.</span>
                </p>
              </motion.div>

              {/* Reviews card */}
              <motion.div variants={fadeUp} className="flex justify-end">
                <div className="rounded-xl border border-[#634F40]/10 bg-white px-5 py-4 shadow-[0_12px_32px_rgba(66,0,96,0.10)]">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#634F40]/55">Client Reviews</span>
                    <div className="flex gap-0.5 text-[#FFCCAF]">
                      {Array.from({length:5}).map((_,i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {["AM","JN","CK","TM"].map((init) => (
                        <div key={init} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#420060] text-[9px] font-bold text-white">
                          {init}
                        </div>
                      ))}
                    </div>
                    <span className="text-[20px] font-extrabold text-[#420060]">4.9</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#634F40]/40">Based on client feedback</div>
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="text-right">
                <p className="text-[0.9rem] font-semibold uppercase tracking-[0.18em] text-[#634F40]/45">Technology</p>
                <p className="text-[1.9rem] font-extrabold leading-tight text-[#420060]" style={{ fontStyle:"italic" }}>Consultant.</p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-col gap-2.5">
                {[
                  { label: "Specialist", desc: "Digital systems & infrastructure" },
                  { label: "Educator",   desc: "CS, STEM & robotics programs" },
                  { label: "Consultant", desc: "Technology strategy & delivery" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-center justify-end gap-3 text-[13px]">
                    <div className="text-right">
                      <div className="font-semibold text-[#420060]">{label}</div>
                      <div className="text-[11px] text-[#634F40]/50">{desc}</div>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                ))}
              </motion.div>
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
                  {/* Decorative circle */}
                  <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-10" style={{ background:"currentColor" }} />

                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${s.icon}`}>
                    {Icon && <Icon className="h-7 w-7" />}
                  </div>

                  <div>
                    <h3 className={`text-[18px] font-bold ${s.text}`}>{title}</h3>
                    <p className={`mt-3 text-[14px] leading-6 ${s.sub}`}>{description}</p>
                  </div>

                  {/* Bottom accent bar */}
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
                {/* Vertical line */}
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
                      {/* Node */}
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
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="Credentials" title="Certifications and Professional Recognition" subtitle="Industry credentials that demonstrate technical expertise and continuous professional development." />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }} className="space-y-4">
            {certifications.map(({ title, description }) => (
              <motion.div key={title} variants={fadeUp}
                className="flex flex-col gap-4 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_6px_20px_rgba(66,0,96,0.05)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#420060]">{title}</div>
                    <div className="mt-0.5 text-[13px] text-[#634F40]/65">{description}</div>
                  </div>
                </div>
                <button type="button" className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-[#420060]/20 px-4 py-2 text-[12px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]">
                  <ExternalLink className="h-3.5 w-3.5" /> View Certificate
                </button>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* ── SKILLS ────────────────────────────────────────────────────────── */}
      <section className="bg-[#F7F9F4] py-20 lg:py-28">
        <Container>
          <SH eyebrow="Skills" title="Technical and Professional Skills" subtitle="A balanced combination of engineering expertise, strategic thinking, and communication skills." />

          {/* Tab switcher */}
          <div className="mb-8 flex justify-center">
            <div className="flex overflow-hidden rounded-xl border border-[#634F40]/12 bg-white p-1 shadow-sm">
              {Object.entries(skillTabs).map(([key, { label }]) => (
                <button key={key} type="button" onClick={() => setActiveSkillTab(key)}
                  className={`rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all ${
                    activeSkillTab === key
                      ? "bg-[#420060] text-white shadow-sm"
                      : "text-[#634F40]/60 hover:text-[#420060]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-xl space-y-5">
            {skillTabs[activeSkillTab].data.map(({ name, value }) => (
              <SkillBar key={name} name={name} value={value} />
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
            {aboutProjects.map(({ id, title, description, image, tags, year, link }) => (
              <motion.div key={id} variants={fadeUp}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
              >
                <div className="relative h-48 overflow-hidden bg-[#ede4ef]">
                  <img src={image} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-[11px] font-semibold text-white/80">{year}</div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-lg bg-[#ede4ef] px-2.5 py-1 text-[11px] font-semibold text-[#420060]">{tag}</span>
                    ))}
                  </div>
                  <Link to={link} className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#420060] hover:underline">
                    Learn More <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
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
