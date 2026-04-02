import { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import {
  ArrowRight, ArrowLeft, Star, CheckCircle2, Sparkles,
  ChevronDown, Globe, RefreshCcw, Server, Cloud,
  TrendingUp, Shield, Users, Zap, Search, Lightbulb,
  Settings2, LineChart, Headphones, BookOpen, MessageCircle,
  BrainCircuit,
} from "lucide-react"
import {
  servicesCards, servicePricing, testimonials,
  faqItems, seamlessProcess, serviceBenefits,
} from "../data/sitePagesData"

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

const serviceIcons = [Globe, RefreshCcw, Server, Cloud]
const serviceColors = ["#420060","#4A6CFA","#2E2F3A","#2FA36B"]

const processIcons = [Search, Lightbulb, Zap, Settings2, LineChart, Headphones]
const benefitIcons = [TrendingUp, Shield, Globe, Users]

const audiences = ["Professionals & Individuals","SMEs & Businesses","Schools & Education"]

function PricingCard({ plan, highlight }) {
  return (
    <div className={`relative flex flex-col rounded-xl border p-7 transition-all ${
      plan.popular
        ? "border-[#420060] bg-[#420060] text-white shadow-[0_24px_60px_rgba(66,0,96,0.28)]"
        : "border-[#634F40]/12 bg-white shadow-[0_8px_24px_rgba(66,0,96,0.06)]"
    }`}>
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFCCAF] px-4 py-1.5 text-[11px] font-bold text-[#2d003f] shadow-sm">
            <Star className="h-3 w-3 fill-current" /> Most Popular
          </span>
        </div>
      )}

      <div className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${plan.popular?"text-white/60":"text-[#634F40]/50"}`}>
        {plan.title}
      </div>
      <div className={`mt-2 text-[13px] ${plan.popular?"text-white/65":"text-[#634F40]/65"}`}>
        {plan.description}
      </div>

      <div className={`my-6 border-t ${plan.popular?"border-white/15":"border-[#634F40]/10"}`} />

      <div className={`text-[3rem] font-bold leading-none ${plan.popular?"text-white":"text-[#420060]"}`}>
        {plan.price}
      </div>

      <div className={`my-6 border-t ${plan.popular?"border-white/15":"border-[#634F40]/10"}`} />

      <ul className="flex flex-1 flex-col gap-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-[14px]">
            <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${plan.popular?"text-[#FFCCAF]":"text-[#2FA36B]"}`} />
            <span className={plan.popular?"text-white/80":"text-[#634F40]/75"}>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/contact"
        className={`mt-8 flex items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold transition hover:-translate-y-0.5 ${
          plan.popular
            ? "bg-white text-[#420060] shadow-sm hover:shadow-md"
            : "bg-[#420060] shadow-[0_8px_22px_rgba(66,0,96,0.20)]"
        }`}
      >
        Get Started <ArrowRight className="h-4 w-4 " />
      </Link>
    </div>
  )
}

function FAQItem({ question, answer, open, onToggle, isLast }) {
  return (
    <div className={`${isLast ? "" : "border-b border-[#634F40]/10"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
      >
        <span className={`min-w-0 flex-1 break-words text-[14px] font-semibold leading-6 transition-colors sm:text-[15px] ${open ? "text-[#420060]" : "text-[#2E2F3A]"}`}>
          {question}
        </span>
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${open ? "bg-[#420060] text-white" : "bg-[#ede4ef] text-[#420060]"}`}>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-[400px]" : "max-h-0"}`}
      >
        <div className="px-6 pb-5">
          <p className="text-[14px] leading-7 text-[#634F40]/70">{answer}</p>
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const [activeAudience, setActiveAudience] = useState("Professionals & Individuals")
  const [openFAQ, setOpenFAQ] = useState(0)
  const [testimonialIndex, setTestimonialIndex] = useState(0)

  const allTestimonials = [
    ...testimonials,
    { name:"Theo M.", role:"Operations Lead", rating:5, text:"Strong communication, thoughtful planning, and modern systems thinking made the implementation process smooth.", initials:"TM" },
    { name:"Claudine K.", role:"Education Coordinator", rating:4, text:"The STEM and technology planning support gave us a clear path for building engaging learning experiences.", initials:"CK" },
  ]

  const visibleTestimonials = Array.from({ length: Math.min(4, allTestimonials.length) }, (_, i) =>
    allTestimonials[(testimonialIndex + i) % allTestimonials.length]
  )

  const extendedFAQ = [
    ...faqItems,
    { question:"Do you handle cloud migrations and automation projects?", answer:"Yes. Cloud migration, workflow automation, and infrastructure planning are core service areas with structured implementation support." },
    { question:"How long does a typical technology implementation take?", answer:"Timelines vary based on scope. Consulting sessions start within days, while full digital transformation projects may span several weeks to months." },
    { question:"Do you offer post-deployment support?", answer:"Yes. Ongoing guidance and system support are available after project completion to ensure continued performance and adoption." },
  ]

  return (
    <>
     <Seo {...pageSeo.ServicesPage} />
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#420060] py-20 lg:py-32">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-6">
              <motion.span variants={fadeUp} className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFCCAF]">
                <Sparkles className="h-3.5 w-3.5" /> Services
              </motion.span>
              <motion.h1 variants={fadeUp} className="text-[2.4rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.9rem]">
                Professional Technology Services
              </motion.h1>
              <motion.p variants={fadeUp} className="max-w-[480px] text-[16px] leading-7 text-white/60">
                Practical, scalable services designed to help businesses, professionals, and educational institutions strengthen digital presence, modernize infrastructure, and accelerate transformation.
              </motion.p>
              <motion.div variants={fadeUp}>
                <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  Explore Services <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </motion.div>

            {/* Visual */}
            <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.6, delay:0.2 }} className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                {servicesCards.map(({ title }, i) => {
                  const Icon = serviceIcons[i]
                  const color = serviceColors[i]
                  return (
                    <div key={title} className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_6px_20px_rgba(66,0,96,0.05)]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: color }}>
                        {Icon && <Icon className="h-5 w-5" />}
                      </div>
                      <p className="text-[12px] font-semibold leading-5 text-[#420060]">{title}</p>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ── SERVICE CARDS ─────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="What We Offer" title="Technology Services" subtitle="Specialized services designed to improve digital systems, infrastructure reliability, and technology strategy." />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {servicesCards.map(({ title, description }, i) => {
              const Icon = serviceIcons[i] || Globe
              const color = serviceColors[i] || "#420060"
              return (
                <motion.div key={title} variants={fadeUp}
                  className="group flex flex-col gap-5 rounded-xl border border-[#634F40]/10 bg-white p-7 shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: color }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[17px] font-bold text-[#420060]">{title}</h3>
                    <p className="mt-2 text-[14px] leading-6 text-[#634F40]/65">{description}</p>
                  </div>
                  <Link to="/contact" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#420060] hover:underline">
                    Read more <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>

          <div className="mt-10 flex justify-center">
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-8 py-4 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]">
              Hire Us Today <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section className="bg-[#F1EAE3] py-20 lg:py-28">
        <Container>
          <SH eyebrow="Pricing" title="Flexible Service Packages" subtitle="Choose the service plan that best supports your organization's technology goals." />

          {/* Audience toggle */}
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            {audiences.map((a) => (
              <button key={a} type="button" onClick={() => setActiveAudience(a)}
                className={`rounded-xl border px-5 py-2.5 text-[13px] font-semibold transition-all ${
                  activeAudience === a
                    ? "border-[#420060] bg-[#420060] text-white shadow-sm"
                    : "border-[#634F40]/15 bg-white text-[#634F40] hover:border-[#420060]/30 hover:text-[#420060]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>

          <motion.div key={activeAudience} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
            className="grid gap-6 lg:grid-cols-3"
          >
            {(servicePricing[activeAudience] || []).map((plan) => (
              <PricingCard key={plan.title} plan={plan} />
            ))}
          </motion.div>
        </Container>
      </section>

      {/* ── BENEFITS ──────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="Value" title="Technology That Works for You" subtitle="Modern systems and infrastructure that improve productivity, reduce risks, and support growth." />
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {serviceBenefits.map(({ title, description }, i) => {
              const Icon = benefitIcons[i] || Zap
              return (
                <motion.div key={title} variants={fadeUp}
                  className="flex flex-col gap-4 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_6px_20px_rgba(66,0,96,0.05)] transition hover:-translate-y-0.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#420060]">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </Container>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="bg-[#2E2F3A] py-20 lg:py-28">
        <Container>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Testimonials</span>
              <h2 className="mt-3 text-[1.75rem] font-bold text-white">Client Experiences</h2>
            </div>
            <div className="flex gap-3">
              {[
                () => setTestimonialIndex((c) => (c-1+allTestimonials.length)%allTestimonials.length),
                () => setTestimonialIndex((c) => (c+1)%allTestimonials.length),
              ].map((fn, i) => (
                <button key={i} type="button" onClick={fn}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/15"
                >
                  {i === 0 ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {visibleTestimonials.map((t, i) => (
              <div key={`${t.name}-${i}`} className="flex flex-col gap-4 rounded-xl border border-white/8 bg-white/6 p-6">
                <div className="flex gap-0.5 text-[#FFCCAF]">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="flex-1 text-[14px] leading-6 text-white/65">"{t.text}"</p>
                <div className="flex items-center gap-3 border-t border-white/10 pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#420060] text-[13px] font-bold text-white">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{t.name}</div>
                    <div className="text-[11px] text-white/45">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── PROCESS ───────────────────────────────────────────────────────── */}
      <section className="py-20 lg:py-28">
        <Container>
          <SH eyebrow="Process" title="Service Delivery Process" subtitle="A structured approach that ensures reliable and successful technology implementation." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {seamlessProcess.map(({ title, description }, i) => {
              const Icon = processIcons[i] || Zap
              return (
                <div key={title} className="flex flex-col gap-4 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_6px_20px_rgba(66,0,96,0.04)]">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[2rem] font-bold text-[#420060]/8">0{i+1}</span>
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Container>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="bg-[#F1EAE3] py-20 lg:py-28">
        <Container>
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">FAQ</span>
            <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem]">Frequently Asked Questions</h2>
            <p className="max-w-xl text-[15px] leading-7 text-[#634F40]/65">Answers to common questions about technology consulting, services, and implementation.</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            {/* Left support cards */}
            <div className="flex flex-col gap-4">
              {[
                { icon: BrainCircuit, title: "Consult a Technology Expert", desc: "Get personalized guidance for digital presence, infrastructure, and cloud systems." },
                { icon: BookOpen,     title: "Browse Technical Resources",  desc: "Learn how our solutions improve digital operations and productivity." },
                { icon: LineChart,    title: "Book Implementation Demo",    desc: "See how automation and infrastructure services work in practice." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_6px_20px_rgba(66,0,96,0.05)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-[#420060]">{title}</div>
                    <p className="mt-1 text-[13px] leading-5 text-[#634F40]/65">{desc}</p>
                  </div>
                </div>
              ))}
              <Link to="/contact" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5">
                Ask an Expert <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Right: accordion — fully responsive */}
            <div className="overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_12px_40px_rgba(66,0,96,0.06)]">
              {extendedFAQ.map(({ question, answer }, i) => (
                <FAQItem
                  key={i}
                  question={question}
                  answer={answer}
                  open={openFAQ === i}
                  onToggle={() => setOpenFAQ(openFAQ === i ? -1 : i)}
                  isLast={i === extendedFAQ.length - 1}
                />
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="pb-20 lg:pb-28">
        <Container>
          <div className="relative overflow-hidden rounded-xl bg-[#420060] px-8 py-14 text-center">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/5" />
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Start Today</span>
            <h2 className="mx-auto mt-4 max-w-xl text-[1.9rem] font-bold text-white">Ready to Modernize Your Technology Systems?</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-white/60">Let's build digital solutions that move your organization forward.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:-translate-y-0.5 hover:shadow-md">
                Book Consultation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/solutions" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10">
                Explore Solutions
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
