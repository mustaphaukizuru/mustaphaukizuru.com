import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import profilePhoto from "../../assets/ukizuru-photo.jpg"

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#F7F9F4]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#420060,#634F40)] px-8 py-10 text-white">
          <div className="relative z-10 flex h-full flex-col">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-white/85 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <div className="my-auto max-w-xl">
              <h1 className="font-['Sora'] text-4xl font-bold leading-tight sm:text-5xl">
                Welcome to Your Digital Hub
              </h1>

              <p className="mt-6 text-base leading-8 text-white/85 sm:text-lg">
                Access your purchased digital products, manage consulting services,
                and track your digital transformation journey in one secure place.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-white/10">
                <img
                  src={profilePhoto}
                  alt="Mustapha Ukizuru"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="font-['Sora'] text-lg font-semibold">
                  Mustapha Ukizuru
                </div>
                <div className="text-sm text-white/80">Technology Consultant</div>
              </div>
            </div>
          </div>

          <div className="absolute -left-10 top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-[#FFCCAF]/15 blur-3xl" />
        </div>

        <div className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-xl rounded-[32px] border border-[#634F40]/10 bg-white p-8 shadow-[0_18px_48px_rgba(66,0,96,0.08)] sm:p-10">
            {/* Mobile-only back link */}
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-2 text-[13px] font-medium text-[#420060] transition hover:text-[#2d003f] lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>

            <h2 className="font-['Sora'] text-4xl font-bold text-[#420060]">
              {title}
            </h2>
            <p className="mt-3 text-base leading-8 text-[#634F40]/75">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}