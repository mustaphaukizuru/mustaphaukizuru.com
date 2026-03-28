import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import profilePhoto from "../assets/Ukizuru Mustapha Photo.jpg"

// ─────────────────────────────────────────────────────────────────────────────
// AuthBrandPanel — shared left panel for all auth pages
// Shows ONE profile block (top-center), no duplicate at bottom
// ─────────────────────────────────────────────────────────────────────────────
export default function AuthBrandPanel({ title, subtitle, bullets = [] }) {
  return (
    <div className="relative hidden overflow-hidden bg-[#420060] lg:flex lg:flex-col lg:p-12">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#FFCCAF]/6" />
      <div className="pointer-events-none absolute bottom-32 right-8 h-32 w-32 rounded-full bg-[#4A6CFA]/10" />

      {/* Back link */}
      <Link
        to="/"
        className="relative inline-flex w-fit items-center gap-2 text-[13px] font-medium text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      {/* Center content — profile + message */}
      <div className="relative mt-auto mb-auto flex flex-col gap-7 py-8">
        {/* Single profile block at the top of content — NO duplicate at bottom */}
        <div className="flex items-center gap-4">
          <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border-2 border-white/25 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <img
              src={profilePhoto}
              alt="Mustapha Ukizuru"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <div className="text-[17px] font-bold text-white">Mustapha Ukizuru</div>
            <div className="text-[13px] text-white/50">Technology Consultant</div>
          </div>
        </div>

        {/* Heading + subtitle */}
        <div>
          <h2 className="text-[2rem] font-bold leading-tight text-white">{title}</h2>
          <p className="mt-3 text-[15px] leading-7 text-white/55 max-w-xs">{subtitle}</p>
        </div>

        {/* Feature bullets */}
        {bullets.length > 0 && (
          <div className="flex flex-col gap-3">
            {bullets.map((b) => (
              <div key={b} className="flex items-center gap-3 text-[13px] text-white/70">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFCCAF]/20">
                  <div className="h-2 w-2 rounded-full bg-[#FFCCAF]" />
                </div>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom tagline — small branding only, no duplicate photo */}
      <div className="relative mt-auto">
        <p className="text-[11px] text-white/25">
          © {new Date().getFullYear()} Mustapha Ukizuru · mustaphaukizuru.com
        </p>
      </div>
    </div>
  )
}
