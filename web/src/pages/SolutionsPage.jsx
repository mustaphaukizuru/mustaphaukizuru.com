import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { useState } from "react"
import {
  BookOpen, GraduationCap, MonitorSmartphone, BrainCircuit, Wrench, Server,
  Search, Lightbulb, Settings2, LineChart, ArrowRight, Sparkles, CheckCircle2
} from "lucide-react"
import { solutions, processSteps } from "../data/homeData"

const fadeUp = { hidden:{opacity:0,y:24}, show:{opacity:1,y:0,transition:{duration:0.52,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.09}} }

function Container({ children, className="" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

const solutionCards = [
  { title:"Digital Products",                           desc:"Ready-to-use digital resources, templates, and technology tools designed to accelerate productivity and innovation.", icon: BookOpen, color:"bg-[#420060]" },
  { title:"Professional Training & Workshops",          desc:"Hands-on training programs that help teams and professionals develop modern technology and digital skills.", icon: GraduationCap, color:"bg-[#4A6CFA]" },
  { title:"Website and Digital Systems",                desc:"Design and development of modern websites, digital platforms, and integrated online systems.", icon: MonitorSmartphone, color:"bg-[#2E2F3A]" },
  { title:"Technology Consulting",                      desc:"Strategic technology advisory services that help organizations design, implement, and optimize digital solutions.", icon: BrainCircuit, color:"bg-[#420060]" },
  { title:"STEM, Coding & Robotics Program Development",desc:"Development of educational STEM programs that introduce coding, robotics, and computational thinking.", icon: Wrench, color:"bg-[#2FA36B]" },
  { title:"IT Infrastructure & Digital Transformation", desc:"Modernization of IT systems, cloud infrastructure, and digital environments for scalable and secure operations.", icon: Server, color:"bg-[#634F40]" },
]

const benefits = [
  "Simplified digital workflows",
  "Faster technology adoption",
  "Better digital presence and platforms",
  "Empowered teams through training",
  "Secure and scalable infrastructure",
  "Continuous technical guidance and support",
]

const processExtended = [
  { n:"01", title:"Discovery",          desc:"Understanding your current systems, goals, and technology challenges.", icon: Search },
  { n:"02", title:"Strategy & Planning",desc:"Building a clear roadmap for digital improvement and implementation.", icon: Lightbulb },
  { n:"03", title:"Solution Design",    desc:"Designing the right approach, tools, and systems for your context.", icon: BrainCircuit },
  { n:"04", title:"Implementation",     desc:"Executing the plan with precision and clear communication throughout.", icon: Settings2 },
  { n:"05", title:"Optimization",       desc:"Refining systems for performance, reliability, and long-term value.", icon: LineChart },
  { n:"06", title:"Ongoing Support",    desc:"Providing continued guidance after delivery to ensure sustained results.", icon: ArrowRight },
]

export default function SolutionsPage() {
  const [toggle, setToggle] = useState("with")

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#420060] py-20 lg:py-32">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-6">
              <motion.span variants={fadeUp} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFCCAF]">
                <Sparkles className="h-3.5 w-3.5" /> Technology Solutions
              </motion.span>
              <motion.h1 variants={fadeUp} className="text-[2.4rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.9rem]">
                Technology Solutions for Modern Organizations
              </motion.h1>
              <motion.p variants={fadeUp} className="max-w-[480px] text-[16px] leading-7 text-white/60">
                Digital platforms, consulting services, and infrastructure solutions designed to help organizations operate more efficiently and scale confidently.
              </motion.p>
              <motion.div variants={fadeUp}>
                <Link to="/services" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  Explore Solutions <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>

            {/* Right visual */}
            <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.6, delay:0.2 }} className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                {solutionCards.slice(0, 4).map(({ title, icon: Icon, color }) => (
                  <div key={title} className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_6px_20px_rgba(66,0,96,0.05)]">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-[12px] font-semibold leading-5 text-[#420060]">{title}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* Solutions grid */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">Explore Our Solutions</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2.1rem]">Explore the Solutions</h2>
            <p className="max-w-2xl text-[15px] leading-7 text-[#634F40]/70">Six strategic technology solutions designed to support digital transformation and long-term growth.</p>
          </div>

          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {solutionCards.map(({ title, desc, icon: Icon, color }) => (
              <motion.div key={title} variants={fadeUp}
                className="group flex flex-col gap-5 rounded-xl border border-[#634F40]/10 bg-white p-7 shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-110 ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-[#634F40]/65">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* Benefits toggle */}
      <section className="bg-[#F1EAE3] py-20 lg:py-28">
        <Container>
          <div className="mb-12 flex flex-col items-center gap-4 text-center">
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">Value</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2.1rem]">How These Solutions Benefit Your Organization</h2>
            <p className="max-w-xl text-[15px] leading-7 text-[#634F40]/70">See how the right technology systems improve productivity, reliability, and operational efficiency.</p>

            <div className="flex overflow-hidden rounded-xl border border-[#634F40]/15 bg-white p-1">
              {["with", "without"].map((v) => (
                <button key={v} type="button" onClick={() => setToggle(v)}
                  className={`rounded-xl px-5 py-2.5 text-[13px] font-semibold capitalize transition-all ${
                    toggle === v ? "bg-[#420060] text-white shadow-sm" : "text-[#634F40]/60 hover:text-[#420060]"
                  }`}
                >
                  {v === "with" ? "With Our Solutions" : "Without Our Solutions"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <div key={b} className={`flex items-start gap-3 rounded-xl border p-5 transition-all ${
                toggle === "with"
                  ? "border-[#2FA36B]/20 bg-white shadow-[0_6px_20px_rgba(47,163,107,0.06)]"
                  : "border-[#634F40]/10 bg-white/40 opacity-50"
              }`}>
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${toggle === "with" ? "bg-[#e8f4ea] text-[#2FA36B]" : "bg-[#f2f2f2] text-[#999]"}`}>
                  {toggle === "with" ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[12px] font-bold">✕</span>}
                </div>
                <p className={`text-[14px] leading-6 font-medium ${toggle === "with" ? "text-[#420060]" : "text-[#634F40]/50"}`}>
                  {b} {toggle === "with" ? "✓" : ""}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Process */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">Process</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2.1rem]">A Seamless Implementation Process</h2>
            <p className="max-w-xl text-[15px] leading-7 text-[#634F40]/70">A clear workflow that ensures every technology solution is carefully planned, implemented, and optimized.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {processExtended.map(({ n, title, desc, icon: Icon }) => (
              <div key={title} className="flex flex-col gap-4 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_6px_20px_rgba(66,0,96,0.04)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[2rem] font-bold text-[#420060]/8">{n}</span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#634F40]/65">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="pb-20 lg:pb-28">
        <Container>
          <div className="relative overflow-hidden rounded-xl bg-[#420060] px-8 py-14 text-center shadow-[0_24px_80px_rgba(66,0,96,0.28)]">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Ready?</span>
            <h2 className="mx-auto mt-4 max-w-xl text-[1.9rem] font-bold text-white">Ready to Transform Your Digital Environment?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-white/60">Explore practical solutions designed to modernize your systems and accelerate innovation.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/services" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:-translate-y-0.5 hover:shadow-md">
                Book Consultation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/store" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10 hover:-translate-y-0.5">
                Visit Store
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
