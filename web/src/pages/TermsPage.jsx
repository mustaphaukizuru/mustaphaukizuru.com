import { motion } from "framer-motion"
import { FileText, Calendar, Scale, Mail } from "lucide-react"

const LAST_UPDATED = "March 2026"

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using the Mustapha Ukizuru digital platform (mustaphaukizuru.com), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services or purchase our digital products."
  },
  {
    title: "2. Digital Products",
    content: "All digital products sold through this platform are for personal or professional use only. You may not redistribute, resell, or share downloaded products without explicit written permission. Digital products are delivered via your member dashboard after successful payment."
  },
  {
    title: "3. Payment and Pricing",
    content: "Prices are displayed in USD unless stated otherwise. Payments are processed securely through Mercado Pago, PayPal, and Link. You are responsible for any applicable taxes in your jurisdiction. Prices may be updated without notice, but changes will not affect confirmed orders."
  },
  {
    title: "4. Refund Policy",
    content: "Due to the digital nature of our products, refunds are handled on a case-by-case basis. Please review our dedicated Refund Policy page for detailed information about eligibility and the process for requesting a refund."
  },
  {
    title: "5. Intellectual Property",
    content: "All content, products, designs, and materials on this platform are the intellectual property of Mustapha Ukizuru or their respective owners. Unauthorized reproduction or distribution is prohibited."
  },
  {
    title: "6. User Accounts",
    content: "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to terminate accounts that violate these terms."
  },
  {
    title: "7. Service Consulting",
    content: "Consulting service packages described on this platform are subject to availability and mutual agreement. Service delivery timelines and deliverables are defined within individual service agreements."
  },
  {
    title: "8. Limitation of Liability",
    content: "To the maximum extent permitted by law, Mustapha Ukizuru shall not be liable for any indirect, incidental, or consequential damages arising from the use of our platform or digital products."
  },
  {
    title: "9. Governing Law",
    content: "These Terms are governed by applicable international law and the regulations of the jurisdiction in which services are delivered. Any disputes shall be resolved through good-faith negotiation or appropriate legal channels."
  },
  {
    title: "10. Contact",
    content: "For questions about these Terms, please contact us at hello@mustaphaukizuru.com."
  }
]

export default function TermsPage() {
  return (
    <div className="bg-[#F7F9F4]">
      {/* Hero */}
      <section className="bg-[#420060] py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-[#FFCCAF]">
            <Scale className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[2.2rem] font-bold text-white">Terms & Conditions</h1>
          <p className="mt-3 text-[15px] text-white/55">
            Please read these terms carefully before using our platform or purchasing digital products.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/50">
            <Calendar className="h-3.5 w-3.5" /> Last updated: {LAST_UPDATED}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-4">
          {sections.map(({ title, content }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_2px_10px_rgba(66,0,96,0.04)]"
            >
              <h2 className="mb-3 text-[15px] font-bold text-[#420060]">{title}</h2>
              <p className="text-[14px] leading-7 text-[#634F40]/70">{content}</p>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 flex items-center gap-4 rounded-xl bg-[#420060] p-6 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">Questions about these Terms?</div>
            <a href="mailto:hello@mustaphaukizuru.com" className="mt-1 text-[13px] text-white/60 hover:text-white hover:underline">
              hello@mustaphaukizuru.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
