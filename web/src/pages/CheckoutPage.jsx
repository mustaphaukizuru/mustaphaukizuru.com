import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import {
  Lock, CreditCard, User, Mail, ShoppingCart,
  ChevronRight, Shield, Zap, Package, ArrowLeft,
  CheckCircle2, AlertCircle, Loader2, ExternalLink,
  MapPin, Plus, Star, Globe, Building2, FileText,
  RefreshCw, Tag, X, Check,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { useAuth } from "../context/AuthContext"
import { createOrder } from "../services/orderService"
import { createMercadoPagoPreference } from "../services/mercadoPagoService"
import { createPaypalSession, capturePaypalSession } from "../services/paypalService"
import { API_BASE_URL } from "../lib/api"
import { formatPrice } from "../lib/format"
import { includedTax, TAX_RATE_PCT } from "../lib/tax"
import FiscalFields from "../components/checkout/FiscalFields"
import { trackBeginCheckout } from "../lib/analytics"
import { fetchAddresses, formatAddressLine, COUNTRY_OPTIONS } from "../services/addressService"

/* ──────────────────────────────────────────────────────────────────────────
 *  CheckoutPage · F08.B · Batch 5
 *
 *  Refinements applied:
 *    - Payment selector: 3px Royal Violet border on selected card (was 2px),
 *      richer subtitles describing accepted methods.
 *    - Optional fields added: Country select, Company name, Tax ID / RFC.
 *      Stored in form state and threaded into createOrder payload alongside
 *      the existing customerName/customerEmail (backend can ignore unknown
 *      keys safely).
 *    - Discount code input in the order summary sidebar wired to the cart
 *      context's applyCoupon/removeCoupon (was previously a non-functional
 *      placeholder).
 *    - "Place order" button promoted to Innovation Gradient (the ONE CTA).
 *    - Trust row below CTA: SSL · Lifetime updates · PayPal · MercadoPago.
 *    - All numerics (subtotal, total) render in JetBrains Mono · tabular-nums.
 *
 *  PRESERVED VERBATIM (DO NOT TOUCH per F08 spec):
 *    - PayPal SDK loader useEffect (lines that load the SDK script)
 *    - PayPal Buttons render useEffect (createOrder/onApprove/onCancel/onError)
 *    - MercadoPago redirect logic in handleSubmit
 *    - createOrder, createMercadoPagoPreference, createPaypalSession,
 *      capturePaypalSession imports and call shapes
 *    - Single-page checkout layout (no 3-step wizard)
 *    - B08 saved addresses behavior
 *  ──────────────────────────────────────────────────────────────────── */

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID
const IS_DEV = import.meta.env.DEV

// ─────────────────────────────────────────────────────────────────────────────
// Progress indicator (visual only — single-page checkout per spec)
// ─────────────────────────────────────────────────────────────────────────────
function CheckoutProgress({ step }) {
  const steps = ["Cart", "Review", "Checkout"]
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-xl text-micro font-bold transition-all ${
            i < step ? "bg-mint text-charcoal" :
            i === step ? "bg-violet text-white" :
                         "bg-charcoal-80/12 text-charcoal-80/65"
          }`}>
            {i < step ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : i + 1}
          </div>
          <span className={`hidden text-micro font-semibold sm:block ${
            i === step ? "text-violet" : "text-charcoal-80/65"
          }`}>{s}</span>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-charcoal-80/25" aria-hidden="true" />}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Order item row (sidebar)
// ─────────────────────────────────────────────────────────────────────────────
function OrderItem({ item }) {
  const { t } = useTranslation("checkout")
  const imgUrl = item.imageUrl
    ? (item.imageUrl.startsWith("http") ? item.imageUrl : `${API_BASE_URL}${item.imageUrl}`)
    : null
  const [imgBroken, setImgBroken] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-charcoal-80/8 bg-mist p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-violet-pale">
        {imgUrl && !imgBroken ? (
          <img
            src={imgUrl}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-violet/30">
            <Package className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-meta font-semibold text-violet">{item.title}</div>
        <div className="text-micro text-charcoal-80/65">
          {item.category || "Digital"} ·{" "}
          <span className="font-mono tabular-nums">{t("misc.qty")} {item.quantity}</span>
        </div>
      </div>
      <div className="shrink-0 font-mono text-meta font-bold tabular-nums text-violet">
        {formatPrice(Number(item.price) * item.quantity)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment method selector card · F08.B · 3px Royal Violet border on selected
// ─────────────────────────────────────────────────────────────────────────────
function PaymentOption({ active, onClick, title, subtitle, badge, logo }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all sm:gap-4 sm:p-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
        active
          ? "border-[3px] border-violet bg-violet-ghost shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.10)]"
          : "border-2 border-charcoal-80/12 bg-white hover:border-violet/30"
      }`}
    >
      <div className="shrink-0">
        {logo || (
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
            active ? "border-violet/20 bg-violet-pale" : "border-charcoal-80/10 bg-[var(--color-slate-50)]"
          }`}>
            <CreditCard className={`h-5 w-5 ${active ? "text-violet" : "text-charcoal-80/65"}`} aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-meta font-bold text-violet">{title}</span>
          {badge && (
            <span className="hidden rounded-full bg-violet px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-white sm:inline">
              {badge}
            </span>
          )}
        </div>
        <div className="text-micro text-charcoal-80/65">{subtitle}</div>
      </div>
      <div className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all ${
        active ? "border-violet bg-violet" : "border-charcoal-80/25"
      }`} aria-hidden="true">
        {active && <div className="h-full w-full scale-50 rounded-full bg-white" />}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment logos · v2 · 2026-05-10
//
// Design rules:
//   • Equal pill dimensions (h-14 w-20) so MP and PayPal carry the same
//     visual weight in the radio group regardless of brand artwork.
//   • Brand mark sized at ~50% of pill height — gives generous breathing
//     room and prevents the "logo over the card" overflow seen pre-fix.
//   • MercadoPago keeps its sacred yellow brand chip (LATAM
//     recognition); PayPal sits on a neutral surface that tints to
//     violet-pale on selection so the active card reads decisively.
//   • Border softens on selection to ring the pill in violet, mirroring
//     the parent card's selected state.
// ─────────────────────────────────────────────────────────────────────────────

function MPLogo({ active = false }) {
  const { t } = useTranslation("checkout")
  return (
    <div
      className={`flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl border transition-colors ${
        active ? "border-violet/30" : "border-[#FFE600]"
      } bg-[#FFE600]`}
    >
      <img
        src="/images/brand/MP_CMYK_HANDSHAKE_color_horizontal.png"
        alt={t("misc.mercadoPagoAlt")}
        className="h-7 w-auto object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

function PayPalLogo({ active = false }) {
  const { t } = useTranslation("checkout")
  return (
    <div
      className={`flex h-14 w-20 items-center justify-center overflow-hidden rounded-xl border transition-colors ${
        active
          ? "border-violet/30 bg-violet-pale"
          : "border-charcoal-80/10 bg-mist"
      }`}
    >
      <img
        src="/images/brand/pp-logo-150px.png"
        alt={t("misc.paypalAlt")}
        className="h-6 w-auto object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main checkout page
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { t } = useTranslation("checkout")
  // Reuse the cart namespace for the right-sidebar Subtotal/Discount/Tax/Total
  // labels — they're populated there from earlier phases, no duplicate keys.
  const { t: tCart } = useTranslation("cart")
  const navigate = useNavigate()
  const {
    cartItems, subtotal, discount, total, appliedCoupon,
    applyCoupon, removeCoupon, clearCart, loading: cartLoading,
  } = useCart()
  const { isAuthenticated, user, loading: authLoading } = useAuth()

  // F08.B · expanded billing form (country/company/taxId optional)
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    country: "",
    company: "",
    taxId: "",
    // CFDI 4.0 receiver data — shown only when country is MX and an RFC is typed.
    legalName: "",
    regimenFiscal: "",
    usoCfdi: "",
    fiscalPostalCode: "",
  })
  const wantsFactura = form.country === "MX" && form.taxId.trim().length > 0
  const [paymentMethod, setMethod] = useState("mercadopago")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const submittingRef = useRef(false)
  const [paypalReady, setPaypalReady] = useState(false)
  const [paypalLoading, setPaypalLoading] = useState(false)
  const [orderCreated, setOrderCreated] = useState(null)
  const [agreedTerms, setAgreedTerms] = useState(false)

  // F08.B · sidebar coupon state
  const [couponCode, setCouponCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [couponBusy, setCouponBusy] = useState(false)

  // B08 · saved addresses
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [addressesLoading, setAddressesLoading] = useState(true)

  const paypalRef = useRef(null)
  const paypalRendered = useRef(false)

  // Guest checkout enabled — no redirect. CheckoutPage now works for both
  // signed-in members AND anonymous buyers. The backend auto-creates a
  // passwordless account from customerEmail and emails a "set your
  // password" claim link inside the order confirmation. See
  // src/controllers/orderController.createOrder.

  // Pre-fill name/email from user
  useEffect(() => {
    if (user) setForm((f) => ({
      ...f,
      customerName: user.fullName || "",
      customerEmail: user.email || "",
    }))
  }, [user])

  // G4 · begin_checkout, once per visit, as soon as a non-empty cart is on
  // screen. Guarded by a ref so coupon edits re-rendering the totals do not
  // re-fire the step.
  const checkoutTracked = useRef(false)
  useEffect(() => {
    if (checkoutTracked.current || cartLoading || !cartItems?.length) return
    checkoutTracked.current = true
    trackBeginCheckout({ items: cartItems, totalAmount: total ?? subtotal }, cartItems[0]?.currency || "MXN")
  }, [cartItems, cartLoading, total, subtotal])

  // B08 · load saved addresses after auth resolves, auto-select default
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      setAddressesLoading(true)
      try {
        const rows = await fetchAddresses()
        if (cancelled) return
        setAddresses(rows)
        const def = rows.find((a) => a.isDefault)
        if (def) {
          setSelectedAddressId(def.id)
          // Pre-fill country from default address if user hasn't typed one
          if (def.country) {
            setForm((f) => f.country ? f : { ...f, country: def.country })
          }
        }
      } catch {
        /* non-blocking */
      } finally {
        if (!cancelled) setAddressesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated])

  // ── PayPal SDK loader · CWV optimization ──────────────────────────────
  // Defers the ~280 KB PayPal SDK download until the user actually picks
  // PayPal as the payment method. Saves Time-to-Interactive on every
  // checkout open where the buyer chooses MercadoPago (the LATAM default).
  // The buyer's first PayPal-button click triggers the load, and the SDK
  // is cached for the rest of the session via the data-paypal-sdk marker.
  useEffect(() => {
    if (paymentMethod !== "paypal") return
    if (!PAYPAL_CLIENT_ID) return
    if (window.paypal) { setPaypalReady(true); return }
    const existing = document.querySelector('script[data-paypal-sdk="true"]')
    if (existing) { existing.addEventListener("load", () => setPaypalReady(true)); return }
    const s = document.createElement("script")
    // PayPal SDK is bound to the platform's billing currency (MXN). The SDK
    // refuses to render Buttons if the order currency doesn't match.
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=MXN`
    s.async = true
    s.dataset.paypalSdk = "true"
    s.onload = () => setPaypalReady(true)
    s.onerror = () => console.warn("PayPal SDK failed to load")
    document.body.appendChild(s)
  }, [paymentMethod])

  // ── PRESERVED VERBATIM · PayPal Buttons render (DO NOT TOUCH) ────────
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
          onError: (err) => setError(err?.message || "PayPal encountered an error."),
        }).render(paypalRef.current)
        paypalRendered.current = true
      } catch {
        setError("Unable to render PayPal button. Please refresh and try again.")
      }
    }
    renderPaypal()
  }, [paymentMethod, paypalReady, orderCreated, navigate, clearCart])

  function validate() {
    // Guest checkout — auth no longer required. Backend auto-creates an
    // account from customerEmail and emails a claim link. We only enforce
    // the basics: a real-looking email, a name, items, and the terms tick.
    if (!form.customerName?.trim()) {
      setError(t("validation.nameRequired"))
      return false
    }
    if (!form.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      setError(t("validation.emailInvalid"))
      return false
    }
    if (cartItems.length === 0) { setError(t("validation.cartEmpty")); return false }
    if (!agreedTerms) { setError(t("validation.termsRequired")); return false }
    return true
  }

  async function ensureOrder() {
    if (orderCreated?.id) return orderCreated
    // Forward optional fields — backend safely ignores unknown keys
    // Hardening · forward the coupon code to the backend so the discount
    // is re-validated server-side and persisted on the order. Previously
    // the discount was purely cosmetic — applied in the cart UI but never
    // carried into the actual Order row, so the gateway charged the
    // un-discounted total. The backend re-runs validateCoupon and rejects
    // expired/exhausted/invalid codes with a 400.
    const couponCode = appliedCoupon?.code || appliedCoupon?.coupon?.code || undefined

    const order = await createOrder({
      customerName: form.customerName,
      customerEmail: form.customerEmail,
      country: form.country || undefined,
      company: form.company || undefined,
      taxId: form.taxId || undefined,
      ...(wantsFactura ? {
        legalName:        form.legalName || undefined,
        regimenFiscal:    form.regimenFiscal || undefined,
        usoCfdi:          form.usoCfdi || undefined,
        fiscalPostalCode: form.fiscalPostalCode || undefined,
      } : {}),
      items: cartItems.map((i) => ({ productId: i.id, quantity: i.quantity })),
      couponCode,
    })
    setOrderCreated(order)
    return order
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(""); setInfo("")
    if (!validate()) return
    if (submittingRef.current) return
    submittingRef.current = true

    setLoading(true)
    try {
      const order = await ensureOrder()

      // ── PRESERVED · Mercado Pago redirect (DO NOT TOUCH) ──
      if (paymentMethod === "mercadopago") {
        const mp = await createMercadoPagoPreference(order.id)
        if (!mp?.initPoint) throw new Error("Failed to create Mercado Pago preference.")
        const redirectUrl = IS_DEV && mp.sandboxPoint ? mp.sandboxPoint : mp.initPoint
        window.location.href = redirectUrl
        return
      }

      // ── PRESERVED · PayPal flow ──
      if (paymentMethod === "paypal") {
        if (!PAYPAL_CLIENT_ID) throw new Error("PayPal is not configured.")
        paypalRendered.current = false
        setInfo("Order ready. Use the PayPal button below to complete payment.")
        return
      }
    } catch (err) {
      // The email belongs to a claimed account — the buyer must sign in so
      // the order lands in THEIR dashboard, not a stranger's. Send them to
      // login and bring them straight back here afterwards.
      if (err?.code === "ACCOUNT_EXISTS" || err?.status === 401) {
        setError(err.message || "Please sign in to complete your purchase.")
        navigate("/login", { state: { from: "/checkout", email: form.customerEmail } })
        return
      }
      setError(err.message || "Failed to start checkout. Please try again.")
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }

  // F08.B · sidebar coupon handlers (wired to cart context)
  async function handleApplySidebarCoupon(e) {
    e?.preventDefault?.()
    setCouponError("")
    const code = (couponCode || "").trim().toUpperCase()
    if (!code) { setCouponError(tCart("summary.couponEnter")); return }
    setCouponBusy(true)
    try {
      await applyCoupon(code)
      setCouponCode("")
    } catch (err) {
      setCouponError(err?.message || tCart("summary.couponInvalid"))
    } finally {
      setCouponBusy(false)
    }
  }

  async function handleRemoveSidebarCoupon() {
    setCouponError("")
    try { await removeCoupon() } catch { /* context surfaces error */ }
  }

  if (authLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-violet" aria-hidden="true" />
    </div>
  )

  const orderTotal = total ?? subtotal

  return (
    <div className="bg-mist">
      {/* Header */}
      <div className="border-b border-charcoal-80/10 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link to="/cart" className="flex items-center gap-2 text-meta font-medium text-charcoal-80/65 hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">{t("actions.backToCart")}</span><span className="sm:hidden">{t("header.breadcrumb.cart")}</span>
          </Link>
          <div className="order-last w-full sm:order-none sm:w-auto"><CheckoutProgress step={2} /></div>
          <div className="flex items-center gap-1.5 text-micro text-charcoal-80/65">
            <Lock className="h-3.5 w-3.5 text-mint" aria-hidden="true" /> <span className="hidden sm:inline">{t("trust.secure")}</span><span className="sm:hidden">{t("trust.secure")}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">

          {/* ── LEFT ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Contact info, name + email */}
            <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <h2 className="mb-5 text-card font-bold text-violet">{t("sections.billing")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key: "customerName",  labelKey: "form.fullName",  placeholderKey: "form.fullNamePlaceholder", icon: User, type: "text" },
                  { key: "customerEmail", labelKey: "form.email",     placeholderKey: "form.emailPlaceholder",    icon: Mail, type: "email" },
                ].map(({ key, labelKey, placeholderKey, icon: Icon, type }) => (
                  <div key={key}>
                    <label htmlFor={key} className="mb-1.5 block text-micro font-semibold text-violet">{t(labelKey)}</label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" aria-hidden="true" />
                      <input
                        id={key}
                        type={type}
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={t(placeholderKey)}
                        required={key === "customerName" || key === "customerEmail"}
                        className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-10 pr-4 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* F08.B · Optional fields (country / company / tax ID) */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="country" className="mb-1.5 block text-micro font-semibold text-violet">
                    {t("form.country")} <span className="font-normal text-charcoal-80/40">({t("misc.optional")})</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" aria-hidden="true" />
                    <select
                      id="country"
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                      className="w-full appearance-none rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-10 pr-9 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
                    >
                      <option value="">{t("misc.selectCountry")}</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-charcoal-80/40" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <label htmlFor="company" className="mb-1.5 block text-micro font-semibold text-violet">
                    {t("form.company")} <span className="font-normal text-charcoal-80/40">({t("misc.optional")})</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" aria-hidden="true" />
                    <input
                      id="company"
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder={t("form.companyPlaceholder")}
                      className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-10 pr-4 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="taxId" className="mb-1.5 block text-micro font-semibold text-violet">
                    {t("form.taxId")} <span className="font-normal text-charcoal-80/40">({t("misc.optionalForInvoices")})</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35" aria-hidden="true" />
                    <input
                      id="taxId"
                      type="text"
                      value={form.taxId}
                      onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                      placeholder={t("form.taxIdPlaceholder")}
                      autoComplete="off"
                      className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-3.5 pl-10 pr-4 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
                    />
                  </div>
                </div>

                {/* CFDI 4.0 receiver data — only when a Mexican RFC is given. */}
                {wantsFactura && (
                  <FiscalFields
                    form={form}
                    onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
                    t={t}
                  />
                )}
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <h2 className="mb-4 text-card font-bold text-violet">{t("delivery.label")}</h2>
              <div className="flex items-center gap-3 rounded-xl border border-mint/30 bg-mint/8 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-white">
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-meta font-bold text-violet">{t("delivery.label")}</div>
                  <div className="text-micro text-charcoal-80/65">{t("delivery.subtitle")}</div>
                </div>
                <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
              </div>
            </div>

            {/* B08 · Billing address (preserved) */}
            <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-card font-bold text-violet">{t("misc.billingAddress")}</h2>
                  <p className="mt-0.5 text-micro text-charcoal-80/65">
                    {t("misc.addressOptional")}
                  </p>
                </div>
                <Link
                  to="/dashboard/addresses"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet/15 px-3 py-2 text-micro font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("misc.manage")}
                </Link>
              </div>

              {addressesLoading ? (
                <div className="h-14 animate-pulse rounded-xl bg-violet-pale" />
              ) : addresses.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-charcoal-80/10 bg-mist p-4 text-micro text-charcoal-80/70">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-80/65" aria-hidden="true" />
                  <div>
                    {t("misc.noSavedAddresses")}{" "}
                    <Link to="/dashboard/addresses" className="font-semibold text-violet hover:underline">
                      {t("misc.addOne")}
                    </Link>{" "}
                    {t("misc.addOneTail")}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id
                    const countryName = COUNTRY_OPTIONS.find((c) => c.code === addr.country)?.name || addr.country
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => setSelectedAddressId(isSelected ? "" : addr.id)}
                        className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all sm:gap-4 sm:p-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                          isSelected
                            ? "border-2 border-violet bg-violet-ghost shadow-[var(--shadow-e4)]"
                            : "border-2 border-charcoal-80/10 hover:border-violet/30"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isSelected ? "bg-violet text-white" : "bg-violet-pale text-violet"
                        }`}>
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-meta font-semibold text-violet">
                              {addr.label || "Address"}
                            </div>
                            {addr.isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet/10 px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-violet">
                                <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> {t("misc.default")}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-micro text-charcoal-80/80">
                            <span className="font-medium text-charcoal">{addr.fullName}</span>
                            {" · "}
                            {formatAddressLine(addr)} {countryName}
                          </div>
                        </div>
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-violet bg-violet" : "border-charcoal-80/25"
                        }`}>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-white" aria-hidden="true" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Payment method · F08.B · 3px violet border on selected */}
            <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <h2 className="mb-4 text-card font-bold text-violet">{t("sections.payment")}</h2>
              <div role="radiogroup" aria-label={t("payment.ariaLabel")} className="flex flex-col gap-3">
                <PaymentOption
                  id="mercadopago"
                  active={paymentMethod === "mercadopago"}
                  onClick={() => setMethod("mercadopago")}
                  title={t("misc.mercadoPagoTitle")}
                  subtitle="LATAM payment methods · Cards · OXXO · bank transfer"
                  badge="Recommended"
                  logo={<MPLogo active={paymentMethod === "mercadopago"} />}
                />
                <PaymentOption
                  id="paypal"
                  active={paymentMethod === "paypal"}
                  onClick={() => setMethod("paypal")}
                  title="PayPal"
                  subtitle="Global · Cards · PayPal balance"
                  logo={<PayPalLogo active={paymentMethod === "paypal"} />}
                />
              </div>

              {paymentMethod === "mercadopago" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#ffe600]/40 bg-[#fffce6] p-4 text-micro text-[#7a6200]">
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {t("misc.mpRedirect")}</span>
                </div>
              )}
              {paymentMethod === "paypal" && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#003087]/15 bg-[#f0f4ff] p-4 text-micro text-[#1e3a8a]">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t("payment.paypalDesc")}</span>
                </div>
              )}
            </div>

            {/* Error / info */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose/20 bg-rose/10 px-4 py-3 text-meta text-rose-700" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
              </div>
            )}
            {info && (
              <div className="flex items-start gap-3 rounded-xl border border-azure/20 bg-azure-pale px-4 py-3 text-meta text-azure-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />{info}
              </div>
            )}

            {/* Terms */}
            <label className="flex cursor-pointer items-start gap-3 text-meta text-charcoal-80/70">
              <button
                type="button"
                onClick={() => setAgreedTerms(!agreedTerms)}
                aria-pressed={agreedTerms}
                aria-label={t("termsAria")}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                  agreedTerms ? "border-violet bg-violet" : "border-charcoal-80/25 bg-white"
                }`}
              >
                {agreedTerms && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span>{t("misc.iAgree")}{" "}
                <Link to="/terms" target="_blank" className="font-semibold text-violet hover:underline">{t("misc.termsLink")}</Link>
                {" "}{t("misc.and")}{" "}
                <Link to="/privacy" target="_blank" className="font-semibold text-violet hover:underline">{t("misc.privacyLink")}</Link>
              </span>
            </label>

            {/* F08.B · Place order · Sacred Innovation Gradient.
                Brand v3 §06 — the canonical 2-stop violet→azure gradient
                lives in the bg-grad-innovation utility class. Previously
                this used an inline 3-stop gradient with off-palette
                Tailwind violet-600; switched to the utility for token alignment and
                visual parity with the CartPage primary action. */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || paypalLoading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-grad-innovation py-4 text-body font-semibold text-white shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.32)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgb(var(--color-violet-rgb)/0.42)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {(loading || paypalLoading) ? (
                <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {t("payment.processing")}</>
              ) : paymentMethod === "mercadopago" ? (
                <><ExternalLink className="h-5 w-5" aria-hidden="true" /> {t("actions.placeOrder")}</>
              ) : (
                <><CreditCard className="h-5 w-5" aria-hidden="true" /> {t("actions.placeOrder")}</>
              )}
            </button>

            {/* F08.B · Trust row below place-order CTA */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-micro text-charcoal-80/65">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                {t("misc.sslSecured")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
                {t("misc.thirtyDayRefund")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-azure" aria-hidden="true" />
                {t("misc.paymentOptionsLabel")}
              </span>
            </div>

            {/* PayPal buttons render target */}
            {paymentMethod === "paypal" && orderCreated?.id && (
              <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e3)]">
                <div className="mb-3 text-meta font-semibold text-violet">{t("misc.completePayPal")}</div>
                <div ref={paypalRef} className="min-h-[50px]" />
              </div>
            )}

            {/* Payment provider badges · v2 · equal-weight, contained logos */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-10 w-24 items-center justify-center overflow-hidden rounded-lg border border-[#FFE600] bg-[#FFE600] shadow-sm">
                <img
                  src="/images/brand/MP_CMYK_HANDSHAKE_color_horizontal.png"
                  alt={t("misc.mercadoPagoAlt")}
                  className="h-5 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="flex h-10 w-24 items-center justify-center overflow-hidden rounded-lg border border-charcoal-80/10 bg-white shadow-sm">
                <img
                  src="/images/brand/pp-logo-150px.png"
                  alt="PayPal"
                  className="h-5 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          {/* ── RIGHT · Order summary sidebar ────────────────────────────── */}
          <div>
            <div className="sticky top-24 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e4)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-card font-bold text-violet">{t("sections.summary")}</h2>
                <span className="rounded-xl bg-violet-pale px-3 py-1 font-mono text-micro font-semibold tabular-nums text-violet">
                  {cartItems.length} {t("summary.items")}
                </span>
              </div>

              <div className="space-y-3">
                {cartItems.map((item) => <OrderItem key={item.id} item={item} />)}
              </div>

              {/* F08.B · Discount code wired to cart context */}
              <div className="mt-5">
                <label htmlFor="checkout-coupon" className="mb-1.5 block text-micro font-semibold text-violet">{t("summary.discountCode")}</label>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-mint/30 bg-mint/8 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-white">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                      <code className="truncate font-mono text-micro font-semibold text-mint-700">
                        {appliedCoupon.code}
                      </code>
                      <span className="font-mono text-micro tabular-nums text-mint-700">
                        −{formatPrice(discount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveSidebarCoupon}
                      disabled={cartLoading}
                      className="shrink-0 rounded-lg p-1 text-mint transition hover:bg-mint/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-mint/40 focus-visible:ring-offset-2"
                      aria-label={t("summary.removeCoupon")}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplySidebarCoupon} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/35" aria-hidden="true" />
                      <input
                        id="checkout-coupon"
                        type="text"
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError("") }}
                        placeholder={t("summary.discountPlaceholder")}
                        autoComplete="off"
                        className="w-full rounded-xl border border-charcoal-80/15 bg-mist py-2.5 pl-9 pr-3 text-meta text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={couponBusy}
                      className="rounded-xl border border-violet/20 px-4 py-2.5 text-micro font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                    >
                      {couponBusy ? "…" : t("summary.applyDiscount")}
                    </button>
                  </form>
                )}
                {couponError && (
                  <p className="mt-1.5 text-micro text-rose-700" role="alert">{couponError}</p>
                )}
              </div>

              {/* Totals · F08.B · JetBrains Mono throughout */}
              <div className="mt-5 space-y-3 border-t border-charcoal-80/10 pt-5">
                <div className="flex justify-between text-meta text-charcoal-80/70">
                  <span>{tCart("summary.subtotal")}</span>
                  <span className="font-mono font-semibold tabular-nums text-violet">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-meta text-mint-700">
                    <span>{tCart("summary.discount")}</span>
                    <span className="font-mono font-semibold tabular-nums">−{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-meta text-charcoal-80/70">
                  <span>{tCart("summary.taxIncluded", { rate: TAX_RATE_PCT })}</span>
                  <span className="font-mono tabular-nums">{formatPrice(includedTax(orderTotal))}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-charcoal-80/10 pt-3">
                  <span className="text-body font-bold text-violet">{tCart("summary.total")}</span>
                  <span className="font-mono text-section font-extrabold tabular-nums text-violet">
                    {formatPrice(orderTotal)}
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 border-t border-charcoal-80/10 pt-5">
                {[
                  { icon: Shield,       key: "secure" },
                  { icon: Zap,          key: "instant" },
                  { icon: CheckCircle2, key: "dashboard" },
                ].map(({ icon: Icon, key }) => (
                  <div key={key} className="flex items-center gap-2.5 text-micro text-charcoal-80/65">
                    <Icon className="h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
                    <span>{t(`trust.${key}`)}</span>
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
