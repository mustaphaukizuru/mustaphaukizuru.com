// ─────────────────────────────────────────────────────────────────────────────
// AdminPlaceholderPage.jsx
//
// Reusable placeholder for admin pages whose backend integration is pending.
// Shows the page title, what the page will do once backend is ready, and the
// schema model(s) the data will come from. Keeps the sidebar nav consistent
// while we build out the missing endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion"
import { Construction, ArrowRight, FileCode2 } from "lucide-react"

export default function AdminPlaceholderPage({
  icon: Icon = Construction,
  title,
  description,
  whatItWillDo = [],
  backendModels = [],
  apiPlan = [],
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Status banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#FEF3C7] bg-[#FEF3C7]/40 px-4 py-3">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-[#92400E]" aria-hidden="true" />
        <div className="text-[13px] text-[#92400E]">
          <p className="font-semibold">Backend integration pending</p>
          <p className="mt-0.5 text-[12px] leading-[1.55]">
            This page is wired into the admin sidebar and routing, but the API endpoints behind it
            are not yet implemented. Frontend will be drop-in once the backend ships.
          </p>
        </div>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[20px] font-bold text-charcoal">{title}</h2>}
            {description && (
              <p className="mt-1.5 text-[14px] leading-[1.6] text-[#475569]">{description}</p>
            )}
          </div>
        </div>

        {whatItWillDo.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              What this page will do
            </h3>
            <ul className="mt-3 space-y-2">
              {whatItWillDo.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] text-charcoal/85">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Implementation plan */}
      {(backendModels.length > 0 || apiPlan.length > 0) && (
        <div className="rounded-2xl border border-slate-100 bg-mist/60 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              Implementation notes
            </h3>
          </div>

          {backendModels.length > 0 && (
            <div className="mt-4">
              <p className="text-[12px] font-semibold text-[#475569]">Prisma models in use</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {backendModels.map((m) => (
                  <li key={m} className="rounded-md bg-violet-pale px-2 py-0.5 font-mono text-[11px] font-semibold text-violet">
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {apiPlan.length > 0 && (
            <div className="mt-4">
              <p className="text-[12px] font-semibold text-[#475569]">Backend endpoints needed</p>
              <ul className="mt-1.5 space-y-1">
                {apiPlan.map((line) => (
                  <li key={line} className="font-mono text-[11px] text-charcoal/85">{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
