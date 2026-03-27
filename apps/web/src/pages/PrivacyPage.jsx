import { motion } from "framer-motion"
import { Shield, Calendar, Mail, Lock, Eye } from "lucide-react"

const LAST_UPDATED = "March 2026"

const sections = [
  { title: "1. Information We Collect", content: "We collect information you provide directly, including name, email address, and payment information during account registration and checkout. We also collect usage data such as pages visited and interactions with the platform." },
  { title: "2. How We Use Your Information", content: "Your information is used to process orders, deliver digital products, send order confirmations, provide member dashboard access, and improve our platform. We do not sell your personal information to third parties." },
  { title: "3. Payment Security", content: "Payment information is processed exclusively by our payment partners (Mercado Pago and PayPal). We do not store your full card details on our servers. All transactions are SSL encrypted." },
  { title: "4. Cookies", content: "We use essential cookies for authentication and session management. Analytics cookies help us understand how visitors interact with the platform. You can manage cookie preferences in your browser settings." },
  { title: "5. Data Sharing", content: "We may share limited information with payment processors, email service providers, and analytics services strictly necessary to operate the platform. These partners are contractually bound to protect your data." },
  { title: "6. Data Retention", content: "Account data is retained as long as your account is active. Order records are kept for legal and accounting purposes. You may request data deletion by contacting us, subject to applicable legal requirements." },
  { title: "7. Your Rights", content: "You have the right to access, correct, or request deletion of your personal data. You may also opt out of marketing communications at any time using the unsubscribe link in emails." },
  { title: "8. Security", content: "We implement industry-standard security measures to protect your data, including encrypted storage, HTTPS enforcement, and access controls. However, no online transmission is 100% secure." },
  { title: "9. Children's Privacy", content: "Our platform is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us data, please contact us immediately." },
  { title: "10. Contact Us", content: "For privacy-related inquiries or data requests, contact us at hello@mustaphaukizuru.com." }
]

export default function PrivacyPage() {
  return (
    <div className="bg-[#F7F9F4]">
      <section className="bg-[#2E2F3A] py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-[#FFCCAF]">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[2.2rem] font-bold text-white">Privacy Policy</h1>
          <p className="mt-3 text-[15px] text-white/55">
            How we collect, use, and protect your personal information.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/50">
            <Calendar className="h-3.5 w-3.5" /> Last updated: {LAST_UPDATED}
          </div>
        </div>
      </section>

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
        <div className="mt-8 flex items-center gap-4 rounded-xl bg-[#2E2F3A] p-6 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">Privacy questions?</div>
            <a href="mailto:hello@mustaphaukizuru.com" className="mt-1 text-[13px] text-white/60 hover:text-white hover:underline">hello@mustaphaukizuru.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}
