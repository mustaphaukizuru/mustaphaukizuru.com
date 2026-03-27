import { motion } from "framer-motion"
import { RotateCcw, Calendar, Mail, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Link } from "react-router-dom"

export default function RefundPage() {
  return (
    <div className="bg-[#F7F9F4]">
      <section className="bg-[#420060] py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-[#FFCCAF]">
            <RotateCcw className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[2.2rem] font-bold text-white">Refund Policy</h1>
          <p className="mt-3 text-[15px] text-white/55">Our policy for digital product purchases and consulting services.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/50">
            <Calendar className="h-3.5 w-3.5" /> Last updated: March 2026
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-6">

          {/* Eligible */}
          <div className="rounded-xl border border-[#2FA36B]/20 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#420060]">
              <CheckCircle2 className="h-5 w-5 text-[#2FA36B]" /> When Refunds Are Eligible
            </h2>
            <ul className="space-y-3 text-[14px] text-[#634F40]/70">
              {[
                "Technical issue preventing download that our team cannot resolve within 48 hours",
                "Digital product significantly different from what was described",
                "Duplicate charge due to a processing error",
                "Service not delivered as outlined in the service agreement",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2FA36B]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Not eligible */}
          <div className="rounded-xl border border-red-200/40 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#420060]">
              <XCircle className="h-5 w-5 text-red-500" /> Refunds Are Not Available For
            </h2>
            <ul className="space-y-3 text-[14px] text-[#634F40]/70">
              {[
                "Change of mind after a digital product has been downloaded",
                "Incompatibility with third-party software not specified in the product description",
                "Partially consumed consulting or service packages",
                "Requests made more than 14 days after the purchase date",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Process */}
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
            <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-[#420060]">
              <Clock className="h-5 w-5 text-[#4A6CFA]" /> How to Request a Refund
            </h2>
            <div className="space-y-4">
              {[
                { step: "1", label: "Contact us",      desc: "Email hello@mustaphaukizuru.com with your order number and reason." },
                { step: "2", label: "Review",           desc: "Our team reviews your request within 3 business days." },
                { step: "3", label: "Decision",         desc: "You receive a decision and, if approved, the refund is processed." },
                { step: "4", label: "Refund issued",    desc: "Approved refunds are returned to the original payment method within 5–10 business days." },
              ].map(({ step, label, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[12px] font-bold text-[#420060]">{step}</div>
                  <div>
                    <div className="text-[14px] font-semibold text-[#420060]">{label}</div>
                    <div className="text-[13px] text-[#634F40]/65">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-[#420060] p-6 text-white">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Need help with a refund?</div>
              <a href="mailto:hello@mustaphaukizuru.com" className="mt-1 text-[13px] text-white/60 hover:text-white hover:underline">hello@mustaphaukizuru.com</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
