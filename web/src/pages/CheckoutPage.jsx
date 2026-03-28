import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Lock, CreditCard, User, Mail, ShoppingCart,
  ChevronRight, Shield, Zap, Package, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, ExternalLink
} from "lucide-react"
import { useCart }   from "../store/CartContext"
import { createOrder } from "../services/orderService"
import { createMercadoPagoPreference } from "../services/mercadoPagoService"
import { createPaypalSession, capturePaypalSession } from "../services/paypalService"
import { useAuth }   from "../context/AuthContext"
import { API_BASE_URL } from "../lib/api"

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID
const IS_DEV = import.meta.env.DEV

// ─────────────────────────────────────────────────────────────────────────────
// Progress indicator
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutProgress({ step }) {
  const steps = ["Cart", "Review", "Checkout"]
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-xl text-[12px] font-bold transition-all ${
            i < step  ? "bg-[#2FA36B] text-white"    :
            i === step ? "bg-[#420060] text-white"   :
                         "bg-[#634F40]/12 text-[#634F40]/50"
          }`}>
            {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`hidden text-[12px] font-semibold sm:block ${
            i === step ? "text-[#420060]" : "text-[#634F40]/50"
          }`}>{s}</span>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-[#634F40]/25" />}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order item row
// ─────────────────────────────────────────────────────────────────────────────
function OrderItem({ item }) {
  const imgUrl = item.imageUrl
    ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}`)
    : null
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#634F40]/8 bg-[#fafafa] p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#ede4ef]">
        {imgUrl ? (
          <img src={imgUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#420060]/30">
            <Package className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#420060]">{item.title}</div>
        <div className="text-[11px] text-[#634F40]/55">{item.category || "Digital"} · Qty {item.quantity}</div>
      </div>
      <div className="shrink-0 text-[14px] font-bold text-[#420060]">
        ${(Number(item.price) * item.quantity).toFixed(2)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment method selector card
// ─────────────────────────────────────────────────────────────────────────────
function PaymentOption({ id, active, onClick, title, subtitle, badge, logo }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
        active
          ? "border-[#420060] bg-[#faf7fb] shadow-[0_0_0_3px_rgba(66,0,96,0.08)]"
          : "border-[#634F40]/12 bg-white hover:border-[#420060]/30"
      }`}
    >
      {/* Logo or icon */}
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
        active ? "border-[#420060]/20 bg-[#ede4ef]" : "border-[#634F40]/10 bg-[#f4f4f4]"
      }`}>
        {logo || <CreditCard className={`h-5 w-5 ${active ? "text-[#420060]" : "text-[#634F40]/50"}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-[#420060]">{title}</span>
          {badge && (
            <span className="rounded-full bg-[#420060] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[12px] text-[#634F40]/60">{subtitle}</div>
      </div>
      <div className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
        active ? "border-[#420060] bg-[#420060]" : "border-[#634F40]/25"
      }`}>
        {active && <div className="h-full w-full scale-50 rounded-full bg-white" />}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago logo SVG
// ─────────────────────────────────────────────────────────────────────────────
function MPLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="25" fill="#009EE3"/>
      <path d="M13 25C13 18.373 18.373 13 25 13s12 5.373 12 12-5.373 12-12 12S13 31.627 13 25z" fill="#fff"/>
      <path d="M25 20l3.09 6.26L35 27.27l-5 4.87 1.18 6.86L25 35.77l-6.18 3.23L20 32.14 15 27.27l6.91-1.01L25 20z" fill="#009EE3"/>
    </svg>
  )
}

// PayPal logo
function PayPalLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <circle cx="25" cy="25" r="25" fill="#003087"/>
      <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="#fff" fontFamily="Arial" fontSize="12" fontWeight="bold">PP</text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main checkout page
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { cartItems, subtotal, clearCart } = useCart()
  const { isAuthenticated, user, loading: authLoading } = useAuth()

  const [form, setForm]           = useState({ customerName: "", customerEmail: "" })
  const [paymentMethod, setMethod]= useState("mercadopago")
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState("")
  const [info,     setInfo]       = useState("")
  const submittingRef = useRef(false)   // prevents duplicate order creation
  const [paypalReady, setPaypalReady]     = useState(false)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [orderCreated, setOrderCreated]   = useState(null)
  const [agreedTerms, setAgreedTerms]     = useState(false)

  const paypalRef      = useRef(null)
  const paypalRendered = useRef(false)

  // Redirect if unauthenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/login", { replace: true })
  }, [authLoading, isAuthenticated, navigate])

  // Pre-fill name/email from user
  useEffect(() => {
    if (user) setForm({ customerName: user.fullName || "", customerEmail: user.email || "" })
  }, [user])

  // Load PayPal SDK
  useEffect(() => {
    if (!PAYPAL_CLIENT_ID) return
    if (window.paypal) { setPaypalReady(true); return }
    const existing = document.querySelector('script[data-paypal-sdk="true"]')
    if (existing) { existing.addEventListener("load", () => setPaypalReady(true)); return }
    const s = document.createElement("script")
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD`
    s.async = true
    s.dataset.paypalSdk = "true"
    s.onload  = () => setPaypalReady(true)
    s.onerror = () => console.warn("PayPal SDK failed to load")
    document.body.appendChild(s)
  }, [])

  // Render PayPal buttons when order ready
  useEffect(() => {
    async function renderPaypal() {
      if (paymentMethod !== "paypal" || !paypalReady || !window.paypal || !orderCreated?.id || !paypalRef.current || paypalRendered.current) return
      paypalRef.current.innerHTML = ""
      try {
        await window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: async () => {
            const id = await createPaypalSession(orderCreated.id)
            if (!id) throw new Error("No PayPal order ID returned.")
            return id
          },
          onApprove: async (data) => {
            setPaypalLoading(true)
            try {
              await capturePaypalSession(data.orderID, orderCreated.id)
              clearCart()
              navigate(`/checkout/success/${orderCreated.id}`, { replace: true })
            } catch (err) {
              setError(err.message || "PayPal payment failed.")
            } finally {
              setPaypalLoading(false)
            }
          },
          onCancel: () => setInfo("PayPal checkout was cancelled. You can try again."),
          onError:  (err) => setError(err?.message || "PayPal encountered an error."),
        }).render(paypalRef.current)
        paypalRendered.current = true
      } catch (err) {
        setError("Unable to render PayPal button. Please refresh and try again.")
      }
    }
    renderPaypal()
  }, [paymentMethod, paypalReady, orderCreated, navigate, clearCart])

  function validate() {
    if (!isAuthenticated)    { setError("Please sign in first."); return false }
    if (!form.customerName || !form.customerEmail) { setError("Please fill in your name and email."); return false }
    if (cartItems.length === 0) { setError("Your cart is empty."); return false }
    if (!agreedTerms)        { setError("Please agree to the Terms & Conditions."); return false }
    return true
  }

  async function ensureOrder() {
    if (orderCreated?.id) return orderCreated
    const order = await createOrder({
      customerName:  form.customerName,
      customerEmail: form.customerEmail,
      items: cartItems.map((i) => ({ productId: i.id, quantity: i.quantity })),
    })
    setOrderCreated(order)
    return order
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(""); setInfo("")
    if (!validate()) return
    if (submittingRef.current) return  // prevent double-submit
    submittingRef.current = true

    setLoading(true)
    try {
      const order = await ensureOrder()

      // ── Mercado Pago — redirect to Checkout Pro ─────────────────────────
      if (paymentMethod === "mercadopago") {
        const mp = await createMercadoPagoPreference(order.id)
        if (!mp?.initPoint) throw new Error("Failed to create Mercado Pago preference.")
        // Use sandbox URL in dev, production URL in prod
        const redirectUrl = IS_DEV && mp.sandboxPoint ? mp.sandboxPoint : mp.initPoint
        window.location.href = redirectUrl
        return
      }

      // ── PayPal — show buttons ────────────────────────────────────────────
      if (paymentMethod === "paypal") {
        if (!PAYPAL_CLIENT_ID) throw new Error("PayPal is not configured.")
        paypalRendered.current = false
        setInfo("Order ready. Use the PayPal button below to complete payment.")
        return
      }
    } catch (err) {
      setError(err.message || "Failed to start checkout. Please try again.")
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  if (authLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#420060]" />
    </div>
  )

  return (
    <div className="bg-[#F7F9F4]">
      {/* Header */}
      <div className="border-b border-[#634F40]/10 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/cart" className="flex items-center gap-2 text-[13px] font-medium text-[#634F40]/60 hover:text-[#420060]">
            <ArrowLeft className="h-4 w-4" /> Back to Cart
          </Link>
          <CheckoutProgress step={2} />
          <div className="flex items-center gap-1.5 text-[12px] text-[#634F40]/50">
            <Lock className="h-3.5 w-3.5 text-[#2FA36B]" /> Secure Checkout
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">

          {/* ── LEFT ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Contact info */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-5 text-[17px] font-bold text-[#420060]">Contact Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key:"customerName",  label:"Full Name",     icon:User, type:"text",  placeholder:"Your full name" },
                  { key:"customerEmail", label:"Email Address", icon:Mail, type:"email", placeholder:"you@example.com" },
                ].map(({ key, label, icon: Icon, type, placeholder }) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">{label}</label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35" />
                      <input type={type} value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-10 pr-4 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:ring-2 focus:ring-[#420060]/8"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-4 text-[17px] font-bold text-[#420060]">Delivery</h2>
              <div className="flex items-center gap-3 rounded-xl border border-[#2FA36B]/25 bg-[#f0faf3] p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2FA36B] text-white">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#420060]">Instant Digital Delivery</div>
                  <div className="text-[12px] text-[#634F40]/60">Download immediately from your dashboard after payment</div>
                </div>
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[#2FA36B]" />
              </div>
            </div>

            {/* Payment method */}
            <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
              <h2 className="mb-4 text-[17px] font-bold text-[#420060]">Payment Method</h2>
              <div className="flex flex-col gap-3">
                <PaymentOption
                  id="mercadopago"
                  active={paymentMethod === "mercadopago"}
                  onClick={() => setMethod("mercadopago")}
                  title="Mercado Pago"
                  subtitle="Cards, bank transfer, cash, and more"
                  badge="Recommended"
                  logo={<MPLogo />}
                />
                <PaymentOption
                  id="paypal"
                  active={paymentMethod === "paypal"}
                  onClick={() => setMethod("paypal")}
                  title="PayPal"
                  subtitle="Pay with your PayPal account or balance"
                  logo={<PayPalLogo />}
                />
              </div>

              {/* Info boxes */}
              {paymentMethod === "mercadopago" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#009EE3]/20 bg-[#f0f9ff] p-4 text-[12px] text-[#0369a1]">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    You'll be redirected to Mercado Pago's secure checkout. Accepted: cards (Visa, Mastercard, Amex),
                    bank transfer, cash, and installment plans. You'll return here after payment.
                  </span>
                </div>
              )}
              {paymentMethod === "paypal" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#003087]/15 bg-[#f0f4ff] p-4 text-[12px] text-[#1e3a8a]">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Pay securely with your PayPal account, debit, or credit card. Buyer protection included.</span>
                </div>
              )}
            </div>

            {/* Error / info */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
              </div>
            )}
            {info && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />{info}
              </div>
            )}

            {/* Terms */}
            <label className="flex cursor-pointer items-start gap-3 text-[13px] text-[#634F40]/70">
              <div onClick={() => setAgreedTerms(!agreedTerms)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                  agreedTerms ? "border-[#420060] bg-[#420060]" : "border-[#634F40]/25 bg-white"
                }`}
              >
                {agreedTerms && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span>I agree to the{" "}
                <Link to="/terms" target="_blank" className="font-semibold text-[#420060] hover:underline">Terms & Conditions</Link>
                {" "}and{" "}
                <Link to="/privacy" target="_blank" className="font-semibold text-[#420060] hover:underline">Privacy Policy</Link>
              </span>
            </label>

            {/* Submit */}
            <button type="button" onClick={handleSubmit} disabled={loading || paypalLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#420060] py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(66,0,96,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
            >
              {(loading || paypalLoading) ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
              ) : paymentMethod === "mercadopago" ? (
                <><ExternalLink className="h-5 w-5" /> Continue to Mercado Pago</>
              ) : (
                <><CreditCard className="h-5 w-5" /> Prepare PayPal Checkout</>
              )}
            </button>

            {/* PayPal buttons */}
            {paymentMethod === "paypal" && orderCreated?.id && (
              <div className="rounded-xl border border-[#634F40]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
                <div className="mb-3 text-[14px] font-semibold text-[#420060]">Complete with PayPal</div>
                <div ref={paypalRef} className="min-h-[50px]" />
              </div>
            )}

            {/* Security */}
            <div className="flex items-center justify-center gap-3 text-[11px] text-[#634F40]/45">
              <Shield className="h-4 w-4 text-[#2FA36B]" />
              Payments are encrypted and processed securely through certified providers.
            </div>

            {/* Payment badges */}
            <div className="flex items-center justify-center gap-3">
              {[
                { name:"Mercado Pago", bg:"#009EE3", text:"#fff" },
                { name:"PayPal",       bg:"#003087", text:"#fff" },
              ].map(({ name, bg, text }) => (
                <span key={name} className="rounded-xl border border-[#634F40]/10 bg-white px-3 py-1.5 text-[11px] font-bold shadow-sm"
                  style={{ color: bg }}>
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Order summary ────────────────────────────────────── */}
          <div>
            <div className="sticky top-24 rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_8px_24px_rgba(66,0,96,0.06)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-[#420060]">Order Summary</h2>
                <span className="rounded-xl bg-[#ede4ef] px-3 py-1 text-[12px] font-semibold text-[#420060]">
                  {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-3">
                {cartItems.map((item) => <OrderItem key={item.id} item={item} />)}
              </div>

              {/* Discount code */}
              <div className="mt-5">
                <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Discount Code</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="Enter code"
                    className="flex-1 rounded-xl border border-[#634F40]/15 bg-[#fafafa] px-4 py-2.5 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
                  />
                  <button type="button" className="rounded-xl border border-[#420060]/20 px-4 py-2.5 text-[12px] font-semibold text-[#420060] transition hover:bg-[#ede4ef]">
                    Apply
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-5 space-y-3 border-t border-[#634F40]/10 pt-5">
                <div className="flex justify-between text-[14px] text-[#634F40]/70">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#420060]">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[14px] text-[#634F40]/70">
                  <span>Service fee</span>
                  <span className="font-semibold text-[#2FA36B]">Free</span>
                </div>
                <div className="flex justify-between border-t border-[#634F40]/10 pt-3">
                  <span className="text-[16px] font-bold text-[#420060]">Total</span>
                  <span className="text-[22px] font-bold text-[#420060]">${subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-5 space-y-2.5 border-t border-[#634F40]/10 pt-5">
                {[
                  { icon: Shield,       text: "Encrypted & secure checkout" },
                  { icon: Zap,          text: "Instant digital delivery" },
                  { icon: CheckCircle2, text: "Available in your dashboard immediately" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5 text-[12px] text-[#634F40]/55">
                    <Icon className="h-4 w-4 shrink-0 text-[#420060]" />{text}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
