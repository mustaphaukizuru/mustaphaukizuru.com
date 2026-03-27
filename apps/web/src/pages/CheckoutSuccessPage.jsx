import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  CheckCircle2, Download, LayoutDashboard, ArrowRight,
  Mail, ShoppingBag, Star, Package, Shield, Sparkles, Clock3, AlertCircle, Loader2
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { authFetch } from "../lib/api"

const fadeUp = { hidden:{opacity:0,y:20}, show:{opacity:1,y:0,transition:{duration:0.45,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.1}} }

export default function CheckoutSuccessPage() {
  const { orderId }       = useParams()
  const [searchParams]    = useSearchParams()
  const { clearCart }     = useCart()

  const gateway   = searchParams.get("gateway")          // "mercadopago" | "paypal" | null
  const isPending = searchParams.get("pending") === "true" // MP pending state

  const [orderStatus, setOrderStatus] = useState(isPending ? "pending" : "paid")
  const [polling,     setPolling]     = useState(isPending)
  const [pollCount,   setPollCount]   = useState(0)

  // Clear cart on mount
  useEffect(() => { clearCart() }, [clearCart])

  // Poll order status when pending (MP returns pending before confirming)
  useEffect(() => {
    if (!isPending || !orderId || !polling) return
    if (pollCount >= 10) { setPolling(false); return }   // max 20 seconds

    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/mercadopago/status/${orderId}`)
        const status = res?.data?.status
        if (status === "paid") {
          setOrderStatus("paid")
          setPolling(false)
        } else if (status === "failed" || status === "cancelled") {
          setOrderStatus("failed")
          setPolling(false)
        } else {
          setPollCount((c) => c + 1)
        }
      } catch {
        setPollCount((c) => c + 1)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isPending, orderId, polling, pollCount])

  const isPaid   = orderStatus === "paid"
  const isFailed = orderStatus === "failed"

  return (
    <div className="bg-[#F7F9F4]">
      {/* Hero band */}
      <div className={`py-16 text-center ${isFailed ? "bg-[#2E2F3A]" : polling ? "bg-[#2E2F3A]" : "bg-[#420060]"}`}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] ${
            isFailed ? "bg-[#E5484D]" : polling ? "bg-[#F59E0B]" : "bg-[#2FA36B]"
          }`}
        >
          {isFailed ? <AlertCircle className="h-12 w-12 text-white" /> :
           polling   ? <Loader2 className="h-12 w-12 animate-spin text-white" /> :
                       <CheckCircle2 className="h-12 w-12 text-white" />}
        </motion.div>
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5, delay:0.2 }}>
          <h1 className="mt-6 text-[2.4rem] font-bold text-white">
            {isFailed ? "Payment Failed" : polling ? "Confirming Payment…" : "Payment Successful!"}
          </h1>
          <p className="mt-2 text-[15px] text-white/60">
            {isFailed  ? "Your payment could not be processed. Please try again." :
             polling    ? "Waiting for payment confirmation. This takes a moment…" :
                          "Your order is confirmed and your digital products are ready."}
          </p>
          {gateway && !isFailed && !polling && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/60">
              Paid via {gateway === "mercadopago" ? "Mercado Pago" : "PayPal"}
            </div>
          )}
        </motion.div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        {isFailed ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5 text-center">
            <motion.p variants={fadeUp} className="text-[15px] text-[#634F40]/65">
              No charge was made to your account. You can return to checkout and try again.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link to="/checkout"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#420060] px-6 py-3.5 text-[14px] font-semibold text-white transition hover:bg-[#2d003f]"
              >
                Try Again
              </Link>
              <Link to="/store"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#420060]/20 px-6 py-3.5 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]"
              >
                Back to Store
              </Link>
            </motion.div>
          </motion.div>
        ) : polling ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-center gap-5 text-center">
            <motion.div variants={fadeUp} className="rounded-xl border border-[#F59E0B]/20 bg-[#fffbeb] p-6 text-[13px] text-[#92400e] max-w-sm">
              <Clock3 className="mx-auto mb-3 h-8 w-8 text-[#F59E0B]" />
              Payment is being processed by Mercado Pago. This page will update automatically within 20 seconds.
            </motion.div>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5">
            {/* Order reference */}
            {orderId && (
              <motion.div variants={fadeUp} className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.05)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f4ea] text-[#2FA36B]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#634F40]/50">Order Reference</div>
                    <div className="mt-0.5 text-[16px] font-bold text-[#420060]">#{orderId}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* What happens next */}
            <motion.div variants={fadeUp} className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.05)]">
              <h3 className="mb-4 text-[16px] font-bold text-[#420060]">What Happens Next</h3>
              <div className="space-y-4">
                {[
                  { icon: Mail,     title: "Confirmation Email Sent",    desc: "Check your inbox for the order confirmation and receipt.",         done: true },
                  { icon: Package,  title: "Products Ready to Download", desc: "Your digital products are available immediately in your dashboard.", done: true },
                  { icon: Shield,   title: "Lifetime Access",            desc: "Access your purchased products anytime from your dashboard.",      done: false },
                ].map(({ icon: Icon, title, desc, done }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-[#e8f4ea] text-[#2FA36B]" : "bg-[#ede4ef] text-[#420060]"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-[#420060]">{title}</span>
                        {done && <CheckCircle2 className="h-4 w-4 text-[#2FA36B]" />}
                      </div>
                      <p className="mt-0.5 text-[13px] text-[#634F40]/60">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard/products"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#420060] py-4 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f]"
              >
                <Download className="h-5 w-5" /> Download Resources
              </Link>
              <Link to="/dashboard"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#420060]/20 py-4 text-[14px] font-semibold text-[#420060] transition hover:bg-[#ede4ef] hover:-translate-y-0.5"
              >
                <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
              </Link>
            </motion.div>

            {/* Rating */}
            <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 rounded-xl border border-[#634F40]/10 bg-white p-5 text-center">
              <div className="flex gap-1 text-[#FFCCAF]">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
              </div>
              <p className="text-[13px] text-[#634F40]/65">Thank you for your purchase! We hope the resources support your work and goals.</p>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center justify-center">
              <Link to="/store" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#634F40]/55 hover:text-[#420060] hover:underline">
                <ShoppingBag className="h-4 w-4" /> Continue Shopping <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
