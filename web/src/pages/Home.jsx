import { useEffect, useState, useRef } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import {
  ArrowRight, ArrowLeft, Star, Sparkles, ChevronRight,
  BookOpen, GraduationCap, MonitorSmartphone, BrainCircuit,
  Wrench, Server, Building2, BriefcaseBusiness, Search,
  Lightbulb, Settings2, LineChart, ShoppingCart, BadgeCheck,
} from "lucide-react"
// social icons use inline SVG components below
import { fetchProducts } from "../services/productService"
import { useCart } from "../store/CartContext"
import { API_BASE_URL } from "../lib/api"
import { audiences, solutions, processSteps, testimonials } from "../data/homeData"

const profilePhoto = "/images/profile/Ukizuru_Mustapha_Photo.jpg";
/* ─── shared animation variants ─── */
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

function Container({ children, className="" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

function SectionHeading({ eyebrow,title,subtitle,align="center",action=null }) {
  const c = align==="center"
  return (
    <div className={`mb-12 flex flex-col gap-4 ${action?"lg:flex-row lg:items-end lg:justify-between":""}`}>
      <div className={`flex flex-col gap-3 ${c?"items-center text-center":"items-start"}`}>
        {eyebrow && <span className="inline-flex items-center rounded-full bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#420060]">{eyebrow}</span>}
        <h2 className="text-[1.75rem] font-bold tracking-tight text-[#420060] sm:text-[2rem] lg:text-[2.2rem]">{title}</h2>
        {subtitle && <p className={`max-w-2xl text-[15px] leading-7 text-[#634F40]/70 ${c?"mx-auto":""}`}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ─────────────────── HERO — matches reference: circular portrait, floating badges, social icons, stats ─────────────────── */
function Hero() {
  const socials = [
    { name: "LinkedIn",  href: "https://www.linkedin.com/in/mustaphaukizuru/", icon: FaLinkedinIn,   bg: "#0077B5" },
    { name: "Telegram",  href: "https://t.me/mustaphaukizuru",                  icon: FaTelegramPlane, bg: "#0088cc" },
    { name: "WhatsApp",  href: "https://wa.me/+525552139993",                    icon: FaWhatsapp,      bg: "#25D366" },
  ]
  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[#F7F9F4]" style={{ background: "linear-gradient(160deg, #F7F9F4 0%, #f3eaf5 40%, #F1EAE3 100%)" }}>
      {/* Subtle background orbs */}
      <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-[#420060]/4 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-[#FFCCAF]/20 blur-2xl" />

      <Container className="flex min-h-[100dvh] items-center py-8 lg:py-8 xl:py-8">
        <div className="grid w-full items-center gap-8 lg:gap-0 lg:grid-cols-[1fr_auto_1fr]">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="flex flex-col gap-8 pr-0 lg:pr-8"
          >
            {/* Greeting */}
            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              <p className="text-[1.15rem] font-semibold text-[#634F40]/70 sm:text-[1.3rem]">
                Hello, I Am
              </p>
              <h1 className="text-[2.8rem] font-extrabold leading-[1.05] tracking-tight text-[#420060] sm:text-[3.4rem] lg:text-[3.8rem]">
                Mustapha{" "}
                <span className="relative inline-block text-[#FFCCAF]">
                  Ukizuru.
                  <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-[#420060]/20" />
                </span>
              </h1>
            </motion.div>

            {/* Experience stat */}
            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <div>
                <span className="text-[3.2rem] font-extrabold leading-none text-[#420060]">8+</span>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/55">Years{" "}Experience</div>
              </div>
              <div className="h-12 w-px bg-[#634F40]/15" />
              <div>
                <span className="text-[2rem] font-extrabold leading-none text-[#420060]">10+</span>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#634F40]/55">Projects{" "}Delivered</div>
              </div>
            </motion.div>

            {/* CTA buttons */}
            <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
              <Link to="/services" className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]">
                Book Consultation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/store" className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef] hover:-translate-y-0.5">
                Explore Store
              </Link>
            </motion.div>

            {/* Social icons — matching footer circular design */}
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#634F40]/40">Connect</span>
              <div className="h-px flex-1 max-w-[40px] bg-[#634F40]/15" />
              <div className="flex gap-2.5">
                {socials.map(({ name, href, icon: Icon, bg }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 text-white shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                    style={{ background: bg }}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* ── CENTER: Circular portrait + floating badges ─────────────── */}
          <motion.div
            initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
            transition={{ duration:0.7, ease:"easeOut", delay:0.1 }}
            className="relative mx-auto my-10 flex items-center justify-center lg:my-0"
            style={{ width: "min(340px, 85vw)", height: "min(400px, 100vw)" }}
          >
            {/* Dashed curved decorative arc — like the reference 
            <svg className="pointer-events-none absolute -left-16 top-1/4 hidden xl:block" width="120" height="140" viewBox="0 0 120 140" fill="none">
              <path d="M90,10 C40,20 10,60 20,110 C22,120 28,128 36,130" stroke="#420060" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" fill="none" opacity="0.35"/>
              <path d="M28,104 L36,130 L58,122" stroke="#420060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.35"/>
            </svg> */}

            {/* Gold ring around circle */}
            <div className="absolute inset-0 rounded-full" style={{ padding: 6, background: "linear-gradient(135deg, #FFCCAF 0%, #420060 60%, #FFCCAF 100%)" }}>
              <div className="h-full w-full rounded-full bg-[#F7F9F4]" />
            </div>

            {/* Portrait */}
            <div className="relative z-10 overflow-hidden rounded-full shadow-[0_20px_60px_rgba(66,0,96,0.20)]"
              style={{ width: "min(320px, 80vw)", height: "min(380px, 95vw)" }}>
              <img src={profilePhoto} alt="Mustapha Ukizuru" className="h-full w-full object-cover object-top" />
            </div>


          </motion.div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="hidden lg:flex flex-col gap-8 pl-0 lg:pl-8"
          >
            {/* Tagline */}
            <motion.div variants={fadeUp} className="text-right">
              <p className="text-[1.05rem] leading-7 text-[#634F40]/65 italic">
                I design modern digital systems,<br />
                <span className="not-italic font-semibold text-[#420060]">and I love what I do.</span>
              </p>
            </motion.div>

            {/* Review / trust card */}
            <motion.div variants={fadeUp} className="flex justify-end">
              <div className="rounded-xl border border-[#634F40]/10 bg-white px-5 py-4 shadow-[0_12px_32px_rgba(66,0,96,0.10)]">
                <div className="flex items-center gap-3 text-[13px] font-semibold text-[#420060]">
                  <span className="text-[#634F40]/60 font-normal text-[12px]">Client Reviews</span>
                  <div className="flex gap-0.5 text-[#FFCCAF]">
                    {Array.from({length:5}).map((_,i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  {/* Avatar stack */}
                  <div className="flex -space-x-2">
                    {["AM","JN","CK","TM"].map((init) => (
                      <div key={init} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#420060] text-[9px] font-bold text-white">
                        {init}
                      </div>
                    ))}
                  </div>
                  <span className="text-[20px] font-extrabold text-[#420060]">4.3</span>
                </div>
                <div className="mt-1 text-[10px] text-[#634F40]/45">Based on client feedback</div>
              </div>
            </motion.div>

            {/* Role title — styled like reference "Creative Designer." */}
            <motion.div variants={fadeUp} className="text-right">
              <p className="text-[1rem] font-semibold text-[#634F40]/50 uppercase tracking-[0.18em]">Technology</p>
              <p className="text-[2rem] font-extrabold leading-tight text-[#420060] tracking-tight" style={{ fontStyle: "italic" }}>
                Consultant.
              </p>
            </motion.div>

            {/* Trust bullets */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              {[
                { icon: BadgeCheck, label: "Proven Results", desc: "Delivered across schools & businesses" },
                { icon: Settings2,  label: "Expert Systems", desc: "Infrastructure & digital platforms" },
                { icon: Sparkles,   label: "STEM & EdTech",  desc: "Coding, robotics, digital learning" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 text-[13px]">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#420060]">{label}</div>
                    <div className="text-[11px] text-[#634F40]/55">{desc}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

/* ─────────────────── WHO I WORK WITH ─────────────────── */
function Audiences() {
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow="Who I Work With"
          title="Serving Organizations That Want to Grow"
          subtitle="I collaborate with organizations and individuals who want to modernize their systems, improve digital presence, and adopt smarter technology solutions."
        />
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true, margin:"-60px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {audiences.map(({ title, description, icon: Icon }, i) => (
            <motion.div
              key={title} variants={fadeUp}
              className="group flex flex-col gap-5 rounded-xl border border-[#634F40]/10 bg-white p-7 shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060] transition-colors group-hover:bg-[#420060] group-hover:text-white">
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#420060]">{title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#634F40]/70">{description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── SOLUTIONS OVERVIEW ─────────────────── */
function Solutions() {
  return (
    <section className="bg-[#2E2F3A] py-20 lg:py-28">
      <Container>
        <div className="mb-14 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-20">
          <div className="lg:max-w-[380px]">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">Solutions</span>
            <h2 className="mt-4 text-[2rem] font-bold tracking-tight text-white lg:text-[2.3rem]">
              Solutions Designed for Modern Organizations
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-white/55">
              Technology solutions that improve efficiency, strengthen digital infrastructure, and accelerate innovation.
            </p>
            <Link
              to="/solutions"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-white/8 hover:-translate-y-0.5"
            >
              Explore Solutions <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <motion.div
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true, margin:"-60px" }}
            className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {solutions.map(({ title, icon: Icon }) => (
              <motion.div
                key={title} variants={fadeUp}
                className="group flex flex-col gap-4 rounded-xl border border-white/8 bg-white/5 p-5 transition-all hover:border-[#FFCCAF]/25 hover:bg-white/8"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#420060]/60 text-[#FFCCAF]">
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className="text-[13px] font-semibold leading-5 text-white/80">{title}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

// ── 5 store categories (matching the canonical list)
const STORE_CATEGORIES = [
  "Templates",
  "Digital & IT Toolkits",
  "Computer Science Resources",
  "STEM & Robotics Kits",
  "Digital Business Resources",
]

/* ─────────────────── FEATURED PRODUCTS ─────────────────── */
function FeaturedProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const { addToCart }           = useCart()
  const [added, setAdded]       = useState({})

  useEffect(() => {
    // Fetch latest product from each category — shows breadth of catalog
    async function loadFeaturedProducts() {
      try {
        // Primary: fetch all products then pick latest from each category
        const data = await fetchProducts("")
        const arr = Array.isArray(data) ? data : []

        if (arr.length > 0) {
          // Build a map of category -> newest product
          const catMap = new Map()
          const sorted = [...arr].sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          )
          // First pass: one per category
          for (const p of sorted) {
            const cat = p.category || "General"
            if (!catMap.has(cat)) catMap.set(cat, p)
          }
          let featured = Array.from(catMap.values()).slice(0, 6)
          // Pad to 6 if fewer than 6 categories
          if (featured.length < 6) {
            const extras = sorted.filter((p) => !featured.find((f) => f.id === p.id))
            featured = [...featured, ...extras].slice(0, 6)
          }
          setProducts(featured)
        } else {
          setProducts([])
        }
      } catch (err) {
        console.warn("Featured products fetch failed:", err.message)
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    loadFeaturedProducts()
  }, [])

  function handleAdd(product) {
    addToCart(product, 1)
    setAdded((p) => ({ ...p, [product.id]: true }))
    setTimeout(() => setAdded((p) => ({ ...p, [product.id]: false })), 1800)
  }

  function getImg(product) {
    const imgs = Array.isArray(product?.images) ? product.images : []
    const img = imgs.find((i) => i?.imageRole === "cover") || imgs[0]
    if (!img?.url) return null
    return img.url.startsWith("http") ? img.url : `${API_BASE_URL}${img.url}`
  }

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow="Featured Resources"
          title="Featured Digital Resources"
          subtitle="Practical templates, toolkits, and digital assets designed to help you work faster and smarter."
          action={
            <Link to="/store" className="inline-flex items-center gap-1.5 rounded-xl border border-[#420060]/20 px-5 py-2.5 text-[13px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]">
              Explore Store <ArrowRight className="h-4 w-4" />
            </Link>
          }
          align="left"
        />

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-[300px] animate-pulse rounded-xl bg-[#ede4ef]" />
            ))}
          </div>
        ) : (
          <motion.div
            variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true, margin:"-40px" }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {products.map((product) => {
              const imgUrl = getImg(product)
              const price  = Number(product.price || 0)
              const cat    = product.category || product.categoryRef?.name || "Digital"

              return (
                <motion.div
                  key={product.id} variants={fadeUp}
                  className="group flex flex-col overflow-hidden rounded-xl border border-[#634F40]/10 bg-white shadow-[0_8px_24px_rgba(66,0,96,0.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(66,0,96,0.10)]"
                >
                  <Link to={`/store/${product.slug}`} className="relative block h-48 overflow-hidden bg-[#ede4ef]">
                    {imgUrl ? (
                      <img src={imgUrl} alt={product.title} className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#420060]/30">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-lg bg-[#420060] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      {cat}
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-1 text-[#FFCCAF]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                      <span className="ml-1 text-[11px] text-[#634F40]/55">(5.0)</span>
                    </div>

                    <Link to={`/store/${product.slug}`} className="mt-2">
                      <h3 className="text-[15px] font-bold leading-5 text-[#420060] transition hover:text-[#2d003f]">
                        {product.title}
                      </h3>
                    </Link>

                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-[#634F40]/65">
                      {product.description || product.shortDescription}
                    </p>

                    <div className="mt-auto flex items-center justify-between border-t border-[#634F40]/8 pt-4">
                      <span className="text-[17px] font-bold text-[#420060]">
                        ${price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdd(product)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                          added[product.id]
                            ? "bg-[#2FA36B] text-white"
                            : "bg-[#ede4ef] text-[#420060] hover:bg-[#420060] hover:text-white"
                        }`}
                      >
                        {added[product.id] ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </Container>
    </section>
  )
}

/* ─────────────────── PROCESS ─────────────────── */
function Process() {
  return (
    <section className="bg-[#F1EAE3] py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow="How We Work"
          title="A Proven Approach to Technology Implementation"
          subtitle="A structured process that transforms ideas into reliable digital systems and scalable technology solutions."
        />
        <motion.div
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once:true, margin:"-60px" }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {processSteps.map(({ title, description, icon: Icon }, i) => (
            <motion.div
              key={title} variants={fadeUp}
              className="relative flex flex-col gap-4 rounded-xl bg-white p-6 shadow-[0_6px_20px_rgba(66,0,96,0.06)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
                  {Icon ? <Icon className="h-5.5 w-5.5" /> : null}
                </div>
                <span className="text-[2.2rem] font-bold text-[#420060]/8">0{i+1}</span>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#420060]">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-[#634F40]/65">{description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── TESTIMONIALS ─────────────────── */
function Testimonials() {
  const [current, setCurrent]   = useState(0)
  const visibleCount = typeof window !== "undefined" && window.innerWidth >= 1024 ? 4 : 1

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)
  const next = () => setCurrent((c) => (c + 1) % testimonials.length)

  const visible = Array.from({ length: Math.min(4, testimonials.length) }, (_, i) =>
    testimonials[(current + i) % testimonials.length]
  )

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <div className="mb-10 flex items-end justify-between">
          <SectionHeading
            eyebrow="Testimonials"
            title="What Clients Say"
            subtitle="Organizations and professionals share how strategic technology solutions improved their digital operations."
            align="left"
          />
          <div className="hidden shrink-0 gap-3 lg:flex">
            {[prev, next].map((fn, i) => (
              <button
                key={i} type="button" onClick={fn}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#634F40]/15 bg-white text-[#420060] shadow-sm transition hover:bg-[#420060] hover:text-white"
              >
                {i === 0 ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="flex flex-col gap-4 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_8px_24px_rgba(66,0,96,0.05)]"
            >
              <div className="flex gap-0.5 text-[#FFCCAF]">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="flex-1 text-[14px] leading-6 text-[#634F40]/75">"{t.text}"</p>
              <div className="flex items-center gap-3 border-t border-[#634F40]/8 pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#420060] text-[13px] font-bold text-white">
                  {t.initials}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#420060]">{t.name}</div>
                  <div className="text-[11px] text-[#634F40]/55">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile arrows */}
        <div className="mt-6 flex justify-center gap-3 lg:hidden">
          {[prev, next].map((fn, i) => (
            <button
              key={i} type="button" onClick={fn}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#634F40]/15 bg-white text-[#420060] shadow-sm transition hover:bg-[#420060] hover:text-white"
            >
              {i === 0 ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ─────────────────── CTA ─────────────────── */
function CTA() {
  return (
    <section className="py-16 lg:py-20">
      <Container>
        <div className="relative overflow-hidden rounded-xl bg-[#420060] px-8 py-14 text-center shadow-[0_24px_80px_rgba(66,0,96,0.28)] lg:px-16">
          {/* Subtle gradient shapes */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-[#FFCCAF]/8" />

          <div className="relative">
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFCCAF]">
              Ready to start?
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-[1.9rem] font-bold tracking-tight text-white lg:text-[2.2rem]">
              Ready to Strengthen Your Digital Strategy?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-white/60">
              Let's design practical technology solutions that support your growth and long-term success.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/services" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[14px] font-semibold text-[#420060] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                Book Consultation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/solutions" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10 hover:-translate-y-0.5">
                Explore Solutions
              </Link>
              <Link to="/store" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-white/10 hover:-translate-y-0.5">
                Visit Store
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ─────────────────── PAGE ─────────────────── */
export default function Home() {
  return (
    
    <>
      <Seo {...pageSeo.AboutPage} />
      <Hero />
      <Audiences />
      <Solutions />
      <FeaturedProducts />
      <Process />
      <Testimonials />
      <CTA />
    </>
  )
}
