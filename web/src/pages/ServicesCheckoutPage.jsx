import { formatPriceWhole } from "../lib/format"
import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { m } from "framer-motion"
import {
  ArrowLeft, ShieldCheck, Zap, CheckCircle2, AlertCircle, Loader2,
  CreditCard, Briefcase,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { AUDIENCE_PRICING_PLANS } from "../data/servicesCatalogue"
import { useAuth } from "../context/AuthContext"
import { orderServiceTier } from "../services/serviceCheckoutService"
import { fetchServicePlans, indexServicePlans } from "../services/serviceService"
import useApiQuery from "../hooks/useApiQuery"
import { trackServiceOrder } from "../lib/analytics"
import { createMercadoPagoPreference } from "../services/mercadoPagoService"
import { createPaypalSession, capturePaypalSession } from "../services/paypalService"
import AuthErrorBanner from "../components/auth/AuthErrorBanner"

/* ──────────────────────────────────────────────────────────────────────────
 *  ServicesCheckoutPage · /checkout/service?audience=X&tier=Y
 *
 *  Dedicated checkout for the public Services pricing matrix. Mirrors
 *  the product CheckoutPage UX but for a single service-tier:
 *
 *    1. Plan summary card (audience name, tier name, price, features)
 *    2. Customer info (name + email · guest-friendly · pre-filled if logged in)
 *    3. Optional project requirements
 *    4. Terms tick + payment buttons
 *
 *  On submit:
 *    POST /api/v1/services/order-by-tier   → returns { orderId, ... }
 *    Then either:
 *      MP:     createMercadoPagoPreference(orderId) → window.location.href = initPoint
 *      PayPal: SDK Buttons → createOrder(orderId) → onApprove → success page
 *
 *  After payment + webhook, the autoCreateClientProjectsForOrder hook in
 *  fulfillOrder spins up a ClientProject so the customer immediately sees
 *  the project under /dashboard/projects.
 *  ──────────────────────────────────────────────────────────────────── */

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || ""

// Whole-peso plan prices in the canonical "MX$5,800" shape (lib/format.js).
function formatMoney(amount, currency = "MXN") {
  return formatPriceWhole(amount, currency)
}

export default function ServicesCheckoutPage() {
  const { t } = useTranslation("services")
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const audience = searchParams.get("audience") || ""
  const tierKey = searchParams.get("tier") || ""

  // T1 · the DB (GET /services/plans) is the source of truth for the price
  // and for whether the tier is purchasable at all; the static catalogue only
  // supplies copy (names, description, included features).
  const { data: livePlans, loading: plansLoading, error: plansError } = useApiQuery(
    "service-plans",
    ({ signal }) => fetchServicePlans({ signal }),
    { select: indexServicePlans },
  )

  // Resolve plan: URL picks (audience, tier); the API supplies packageId + price.
  const plan = useMemo(() => {
    const aud = AUDIENCE_PRICING_PLANS[audience]
    if (!aud) return null
    const tier = aud.tiers?.[tierKey]
    if (!tier) return null
    const live = livePlans?.[audience]?.[tierKey] || null
    // The DB answered and does not sell this tier → treat as not found.
    if (livePlans && !plansError && !live) return null
    return {
      audienceCode: audience,
      audienceName: aud.name,
      audienceDescription: aud.description,
      audienceFeatures: aud.features,
      tierKey,
      tierName: live?.name || tier.name,
      // FALLBACK: tier.priceMxn from the static catalogue is display-only,
      // shown while /services/plans loads or if it failed. The server never
      // trusts it — orderByTier charges the DB price for `packageId`.
      price: live ? live.price : tier.priceMxn,
      currency: live?.currency || "MXN",
      period: live?.period || tier.period,
      packageId: live?.packageId || null,
      includedFeatures: aud.features.filter((_, i) => tier.includes[i]),
      popular: live ? live.popular : tier.popular,
    }
  }, [audience, tierKey, livePlans, plansError])

  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    requirements: "",
  })
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [paymentMethod, setMethod] = useState("mercadopago")
  // error: null | string | { kind, title, body, action }
  // Strings still flow through (existing i18n keys); the richer object lets
  // payment failures suggest the alternate gateway in one tap.
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // PayPal SDK
  const [paypalReady, setPaypalReady] = useState(false)
  const paypalRef = useRef(null)
  const paypalRendered = useRef(false)
  const orderIdRef = useRef(null) // shared between createOrder + onApprove

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, customerName: user.fullName || "", customerEmail: user.email || "" }))
  }, [user])

  // PayPal SDK loader · only when user picks PayPal
  useEffect(() => {
    if (paymentMethod !== "paypal") return
    if (!PAYPAL_CLIENT_ID) return
    if (window.paypal) { setPaypalReady(true); return }
    const existing = document.querySelector('script[data-paypal-sdk="true"]')
    if (existing) { existing.addEventListener("load", () => setPaypalReady(true)); return }
    const s = document.createElement("script")
    // PayPal supports MXN as a transaction currency, so we load the SDK
    // pre-bound to MXN. This is required — the SDK refuses to render
    // Buttons if the transaction currency doesn't match the SDK currency.
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=MXN`
    s.async = true
    s.dataset.paypalSdk = "true"
    s.onload = () => setPaypalReady(true)
    s.onerror = () => console.warn("PayPal SDK failed to load")
    document.body.appendChild(s)
  }, [paymentMethod])

  function validate() {
    if (!plan || !plan.packageId) {
      // No packageId means /services/plans has not answered (or failed) —
      // the server would reject the order anyway, so stop here.
      setError({
        kind: "error",
        title: t("checkout.errors.planInvalidTitle", { defaultValue: "Plan not found" }),
        body: t("checkout.errors.planInvalid"),
      })
      return false
    }
    if (!form.customerName.trim()) {
      setError({
        kind: "warning",
        title: t("checkout.errors.nameRequiredTitle", { defaultValue: "Name is required" }),
        body: t("checkout.errors.nameRequired"),
      })
      return false
    }
    if (!form.customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      setError({
        kind: "warning",
        title: t("checkout.errors.emailInvalidTitle", { defaultValue: "Email format looks off" }),
        body: t("checkout.errors.emailInvalid"),
      })
      return false
    }
    if (!agreedTerms) {
      setError({
        kind: "warning",
        title: t("checkout.errors.termsRequiredTitle", { defaultValue: "Please accept the Terms" }),
        body: t("checkout.errors.termsRequired"),
      })
      return false
    }
    setError(null)
    return true
  }

  async function ensureOrder() {
    if (orderIdRef.current) return orderIdRef.current
    let result
    try {
      result = await orderServiceTier({
        // T1 · packageId (from /services/plans) identifies the plan and the
        // server charges the DB price. audience/tier are only a fallback
        // resolver; no price is sent.
        packageId: plan.packageId,
        audience: plan.audienceCode,
        tier: plan.tierKey,
        planName: `${plan.audienceName} · ${plan.tierName}`,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        requirements: form.requirements,
      })
    } catch (err) {
      // Email belongs to a claimed account → sign in, then come back here.
      if (err?.code === "ACCOUNT_EXISTS" || err?.status === 401) {
        navigate("/login", {
          state: { from: window.location.pathname + window.location.search, email: form.customerEmail },
        })
      }
      throw err
    }
    if (!result?.orderId) throw new Error("Order creation failed, no order id returned")
    orderIdRef.current = result.orderId
    // G4 · a service order is placed the moment the internal order exists, whichever gateway pays it
    trackServiceOrder(audience, tierKey)
    return result.orderId
  }

  async function handleMercadoPago() {
    if (!validate()) return
    setBusy(true); setError(null)
    try {
      const orderId = await ensureOrder()
      // BUGFIX: createMercadoPagoPreference expects a string orderId, not
      // an object. Passing { orderId } sent { orderId: { orderId: "..." } }
      // to the backend, which rejected it and surfaced as "Request error".
      const pref = await createMercadoPagoPreference(orderId)
      const url = pref?.initPoint || pref?.sandboxPoint
      if (!url) throw new Error(t("checkout.errors.mpNoUrl"))
      window.location.href = url
    } catch (err) {
      console.error("[ServiceCheckout] MP failed:", err)
      setError({
        kind: "error",
        title: t("checkout.errors.mpFailedTitle", { defaultValue: "MercadoPago checkout failed" }),
        body: err.message || t("checkout.errors.mpFailed"),
        // The page supports both gateways — when one fails, the cheapest
        // recovery path is the other. Inline action saves a re-scroll.
        action: (
          <button
            type="button"
            onClick={() => { setMethod("paypal"); setError(null) }}
            className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            {t("checkout.tryPaypal")}
          </button>
        ),
      })
      setBusy(false)
    }
  }

  // Render PayPal Buttons once SDK is ready + method is PayPal
  useEffect(() => {
    async function renderPaypal() {
      if (paymentMethod !== "paypal" || !paypalReady || !window.paypal) return
      if (!paypalRef.current || paypalRendered.current) return
      paypalRef.current.innerHTML = ""
      try {
        await window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: async () => {
            if (!validate()) throw new Error("Form invalid")
            const orderId = await ensureOrder()
            const id = await createPaypalSession(orderId)
            if (!id) throw new Error("No PayPal order ID returned")
            return id
          },
          onApprove: async (data) => {
            // BUGFIX: capturePaypalSession requires (paypalOrderId, orderId).
            // The previous one-arg call threw "Order ID is required" before
            // the network request, which PayPal forwarded to onError and
            // surfaced as the generic "PayPal checkout failed."
            const internalOrderId = orderIdRef.current
            if (!internalOrderId) throw new Error("Lost reference to internal order id")
            await capturePaypalSession(data.orderID, internalOrderId)
            navigate(`/checkout/success/${internalOrderId}?gateway=paypal`, { replace: true })
          },
          onCancel: () => setError({
            kind: "info",
            title: t("checkout.errors.paypalCancelTitle", { defaultValue: "PayPal payment was cancelled" }),
            body: t("checkout.errors.paypalCancel"),
          }),
          onError: (err) => {
            // Surface the real error so future failures aren't masked.
            console.error("[ServiceCheckout] PayPal error:", err)
            setError({
              kind: "error",
              title: t("checkout.errors.paypalFailedTitle", { defaultValue: "PayPal checkout failed" }),
              body: err?.message || t("checkout.errors.paypalFailed"),
              action: (
                <button
                  type="button"
                  onClick={() => { setMethod("mercadopago"); setError(null) }}
                  className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  {t("checkout.tryMercadoPago")}
                </button>
              ),
            })
          },
        }).render(paypalRef.current)
        paypalRendered.current = true
      } catch (err) {
        console.error("[ServiceCheckout] PayPal Buttons render failed:", err)
      }
    }
    renderPaypal()
  }, [paymentMethod, paypalReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── render: invalid plan ─────────────────────────────────────────────
  if (!plan) {
    return (
      <div className="bg-mist py-16">
        <div className="mx-auto max-w-xl px-4">
          <div className="rounded-2xl border border-rose/20 bg-rose/5 p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-600" />
            <h1 className="text-card font-bold text-rose-700">{t("checkout.errors.notFound")}</h1>
            <p className="mt-2 text-meta text-rose-700">
              {t("checkout.errors.notFoundBody")}
            </p>
            <Link
              to="/services"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white hover:bg-violet-deep"
            >
              <ArrowLeft className="h-4 w-4" /> {t("checkout.errors.backToServices")}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Trust row · keyed so i18n drives the labels and order is stable.
  const trustItems = [
    { icon: ShieldCheck, label: t("checkout.trust.secure") },
    { icon: Zap,         label: t("checkout.trust.instant") },
    { icon: CheckCircle2, label: t("checkout.trust.dashboard") },
  ]

  return (
    <div className="bg-mist py-10">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <Link to="/services" className="mb-4 inline-flex items-center gap-1 text-meta text-violet hover:underline">
          <ArrowLeft className="h-4 w-4" /> {t("checkout.errors.backToPlans")}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* ── LEFT · plan summary + customer form ───────────────────── */}
          <m.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Plan header */}
            <div className="rounded-2xl border border-violet/20 bg-white p-6 shadow-[var(--shadow-e3)]">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-violet">
                  <Briefcase className="h-3 w-3" /> {plan.audienceName}
                </span>
                {plan.popular && (
                  <span className="rounded-full bg-violet px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    {t("checkout.plan.mostPopular")}
                  </span>
                )}
              </div>
              <h1 className="text-display font-bold text-violet">{plan.tierName}</h1>
              <p className="mt-1 text-meta text-charcoal-80/65">{plan.audienceDescription}</p>

              {/* Plan price — no period label. Service engagements are
                  scoped per agreement and may run shorter or longer than a
                  month, so we don't pin the price to a fixed cadence. */}
              <div className="mt-5 flex items-end gap-3 border-t border-charcoal-80/10 pt-5">
                <div className="font-mono text-[40px] font-bold leading-none tabular-nums text-violet">
                  {formatMoney(plan.price, plan.currency)}
                </div>
                <div className="pb-1.5 font-mono text-[13px] uppercase tracking-wider text-charcoal-80/65">
                  {plan.currency || "MXN"}
                </div>
              </div>

              {plan.includedFeatures?.length > 0 && (
                <div className="mt-5 border-t border-charcoal-80/10 pt-5">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-charcoal-80/65">
                    {t("checkout.plan.includedTitle")}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.includedFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-meta text-charcoal-80/85">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Customer info form */}
            <div className="rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <h2 className="text-card font-bold text-violet">{t("checkout.form.title")}</h2>
              <p className="mt-1 text-meta text-charcoal-80/65">
                {isAuthenticated ? t("checkout.form.prefilled") : t("checkout.form.guest")}
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">{t("checkout.form.fullName")} <span className="text-red-500">*</span></label>
                  <input
                    type="text" required value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">{t("checkout.form.email")} <span className="text-red-500">*</span></label>
                  <input
                    type="email" required value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">
                    {t("checkout.form.requirementsLabel")} <span className="font-normal text-charcoal-80/65">{t("checkout.form.requirementsHint")}</span>
                  </label>
                  <textarea
                    rows={4} value={form.requirements}
                    onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                    placeholder={t("checkout.form.requirementsPlaceholder")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30"
                  />
                </div>
              </div>
            </div>
          </m.div>

          {/* ── RIGHT · payment sidebar ──────────────────────────────── */}
          <m.aside
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}
            className="lg:sticky lg:top-6 space-y-4 self-start"
          >
            <div className="rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e3)]">
              <h3 className="text-card font-bold text-violet">{t("checkout.payment.title")}</h3>

              {/* Method picker · brand names left untranslated by design. */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { id: "mercadopago", label: "MercadoPago" },
                  { id: "paypal", label: "PayPal" },
                ].map((m) => (
                  <button
                    key={m.id} type="button" onClick={() => setMethod(m.id)}
                    className={`rounded-lg border px-3 py-2.5 text-micro font-semibold transition ${
                      paymentMethod === m.id
                        ? "border-violet bg-violet-pale text-violet"
                        : "border-charcoal-80/12 bg-white text-charcoal-80/65 hover:border-violet/30"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div className="mt-5 flex items-baseline justify-between border-t border-charcoal-80/10 pt-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-charcoal-80/65">
                  {t("checkout.payment.totalToday")}
                </span>
                <span className="font-mono text-card font-bold tabular-nums text-violet">
                  {formatMoney(plan.price, plan.currency)}
                </span>
              </div>

              {/* Terms */}
              <label className="mt-4 flex items-start gap-2 text-[12px] text-charcoal-80/75 cursor-pointer">
                <input
                  type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-charcoal-80/30 text-violet accent-violet"
                />
                <span>
                  {t("checkout.payment.termsAccept")}{" "}
                  <Link to="/terms" className="text-violet underline">{t("checkout.payment.terms")}</Link>
                  {" "}{t("checkout.payment.and")}{" "}
                  <Link to="/refund" className="text-violet underline">{t("checkout.payment.refundPolicy")}</Link>.
                </span>
              </label>

              {error && (
                <div className="mt-4">
                  <AuthErrorBanner error={error} onDismiss={() => setError(null)} />
                </div>
              )}

              {/* CTA */}
              <div className="mt-5">
                {paymentMethod === "mercadopago" ? (
                  <button
                    type="button" onClick={handleMercadoPago} disabled={busy || plansLoading}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift-1)] transition hover:bg-violet-deep disabled:opacity-60"
                  >
                    {busy
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("checkout.payment.starting")}</>
                      : <><CreditCard className="h-4 w-4" /> {t("checkout.payment.payMP")}</>}
                  </button>
                ) : (
                  <div ref={paypalRef} className="min-h-[55px]">
                    {!paypalReady && (
                      <div className="flex items-center justify-center rounded-lg border border-charcoal-80/10 bg-mist px-4 py-3 text-micro text-charcoal-80/65">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("checkout.payment.loadingPayPal")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trust row · i18n-keyed labels */}
              <div className="mt-5 space-y-2.5 border-t border-charcoal-80/10 pt-5">
                {trustItems.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-micro text-charcoal-80/65">
                    <Icon className="h-4 w-4 shrink-0 text-violet" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </m.aside>
        </div>
      </div>
    </div>
  )
}
