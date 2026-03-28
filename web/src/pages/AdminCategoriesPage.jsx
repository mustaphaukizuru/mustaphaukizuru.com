import { useEffect, useState } from "react"
import { BookOpen, Cpu, FlaskConical, Wrench, Briefcase, Sparkles, Package, TrendingUp, AlertCircle } from "lucide-react"
import { fetchAdminCategories } from "../services/adminCategoryService"
import { SectionCard, SkeletonCard } from "../components/ui/index"

// ─────────────────────────────────────────────────────────────────────────────
// Canonical store categories — exactly 6
// ─────────────────────────────────────────────────────────────────────────────
const CANONICAL_CATEGORIES = [
  { name: "Templates",                  icon: BookOpen,     color: "bg-[#eef3fb] text-[#2f5ea8]", border: "border-[#2f5ea8]/15" },
  { name: "Digital & IT Toolkits",      icon: Cpu,          color: "bg-[#f6efe3] text-[#9c5c00]", border: "border-[#9c5c00]/15" },
  { name: "Computer Science Resources", icon: FlaskConical, color: "bg-[#e8f4ea] text-[#3b8f47]", border: "border-[#3b8f47]/15" },
  { name: "STEM & Robotics Kits",       icon: Wrench,       color: "bg-[#fff3e2] text-[#b46909]", border: "border-[#b46909]/15" },
  { name: "Digital Business Resources", icon: Briefcase,    color: "bg-[#eef2ff] text-[#4f46e5]", border: "border-[#4f46e5]/15" },
  { name: "Uncategorized",              icon: Sparkles,     color: "bg-[#ede4ef] text-[#420060]", border: "border-[#420060]/15" },
]

export default function AdminCategoriesPage() {
  const [apiCategories, setApiCategories] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true); setError("")
      try {
        const result = await fetchAdminCategories()
        setApiCategories(Array.isArray(result) ? result : [])
      } catch (err) {
        setError(err.message || "Failed to load categories.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Merge API data into canonical list
  const merged = CANONICAL_CATEGORIES.map((cat) => {
    const api = apiCategories.find(
      (a) => a.name?.toLowerCase().trim() === cat.name.toLowerCase().trim()
    )
    return {
      ...cat,
      totalProducts:  api?.totalProducts  ?? 0,
      activeProducts: api?.activeProducts ?? 0,
      slug:           api?.slug           ?? cat.name.toLowerCase().replace(/\s+/g, "-"),
    }
  })

  const totalProducts  = merged.reduce((s, c) => s + c.totalProducts, 0)
  const activeProducts = merged.reduce((s, c) => s + c.activeProducts, 0)

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1,2,3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map((i) => <SkeletonCard key={i} height="h-[160px]" />)}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error} — showing canonical category definitions below.
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Categories", value: 6,             icon: Sparkles,   tone: "bg-[#ede4ef] text-[#420060]" },
          { label: "Total Products",   value: totalProducts,  icon: Package,    tone: "bg-[#eef3fb] text-[#2f5ea8]" },
          { label: "Active Products",  value: activeProducts, icon: TrendingUp, tone: "bg-[#e8f4ea] text-[#3b8f47]" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-medium text-[#634F40]/70">{label}</div>
                <div className="mt-2 text-[28px] font-bold text-[#420060]">{value}</div>
              </div>
              <div className={`rounded-xl p-3 ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category list */}
      <SectionCard
        title="Product Categories"
        subtitle="The 6 official store categories. Products must belong to one of these categories."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {merged.map(({ name, icon: Icon, color, border, totalProducts, activeProducts, slug }) => (
            <div
              key={name}
              className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-[0_2px_8px_rgba(66,0,96,0.04)] transition hover:shadow-[0_8px_24px_rgba(66,0,96,0.08)] ${border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#634F40]/50">Active / Total</div>
                  <div className="text-[16px] font-bold text-[#420060]">
                    {activeProducts} / {totalProducts}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[14px] font-bold text-[#420060]">{name}</h3>
                <div className="mt-1 text-[11px] text-[#634F40]/50">/{slug}</div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#ede4ef]">
                <div
                  className="h-full rounded-full bg-[#420060] transition-all"
                  style={{ width: totalProducts > 0 ? `${(activeProducts/totalProducts)*100}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  )
}
