import { Link } from "react-router-dom"
import { SearchX, Home, ArrowRight } from "lucide-react"

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[70vh] items-center py-20">
      <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <SearchX className="h-10 w-10" />
        </div>

        <div className="mt-6 text-[6rem] font-bold leading-none text-[#420060]/8 select-none">404</div>

        <h1 className="mt-2 text-[2rem] font-bold tracking-tight text-[#420060]">Page Not Found</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[#634F40]/65">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(66,0,96,0.24)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]">
            <Home className="h-4 w-4" /> Back to Home
          </Link>
          <Link to="/store" className="inline-flex items-center gap-2 rounded-xl border border-[#420060]/20 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]">
            Explore Store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
