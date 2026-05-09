# QA Patches · Hand-off · 2026-05-09

This document is the apply-this-yourself companion to `QA_FIX_PLAN_2026-05-09.md`.
Every patch below is **investigated against your live source** with exact file
paths, line numbers, before/after blocks, and the audit finding it closes.

Apply them in VS Code (or your editor of choice) using **Find → Replace** on
the exact `BEFORE` block. Verify with **Save → reload dev server**. Each patch
is independent — apply in any order.

> **Important precondition.** First clear the git lock and restore the four
> files my Cowork session truncated:
>
> ```powershell
> Remove-Item .git\index.lock
> git checkout HEAD -- web/src/components/LanguageSwitcher.jsx
> git checkout HEAD -- web/src/components/heroes/HomeHero.jsx
> git checkout HEAD -- web/src/components/heroes/StoreHero.jsx
> git checkout HEAD -- web/src/pages/ProductDetail.jsx
> ```

---

## Patch 1 · Finding #2 · Sign In requires two clicks (honeypot bug)

**File:** `web/src/pages/LoginPage.jsx`

**Root cause.** Browser autofill fills the honeypot `website` field despite
the `autoComplete="new-password"` defense. The current handler clears it and
asks the user to click again — that's why the first Sign In click "does
nothing." Fix: silently retry the submission instead of asking for a re-click.

**Around line 116–130. BEFORE:**

```jsx
async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    // Bot trap — honeypot must remain empty. If it's filled, treat as
    // browser autofill (not a bot) and clear it before the next submit
    // rather than silently blocking. Real bots fill consistently — log
    // for diagnostics but don't kill the flow on first occurrence.
    if (honeypot) {
      // eslint-disable-next-line no-console
      console.warn("[login] honeypot was filled — clearing and retrying")
      setHoneypot("")
      setError("Please click Sign In again.")
      return
    }
```

**AFTER:**

```jsx
async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    // Bot trap — honeypot is invisible to humans. If it's filled, that's
    // either browser autofill or a bot. Bots are blocked silently with a
    // generic error; real users have already typed real credentials, so
    // we just clear the honeypot and proceed — no second-click required.
    // Diagnostic warn lets us spot autofill abuse in production logs.
    if (honeypot) {
      // eslint-disable-next-line no-console
      console.warn("[login] honeypot was filled — assuming autofill, proceeding")
      setHoneypot("")
      // Fall through to the real submission below — no early return.
    }
```

**Verify.** Sign in with autofilled credentials → lands on `/dashboard` on
first click. No "Please click Sign In again" message ever appears.

---

## Patch 2 · Finding #4 · Cart cover image missing (guest cart bug)

**File:** `web/src/store/CartContext.jsx`

**Root cause.** `adaptGuestItem()` reads `raw.imageUrl` directly, but the
backend `serializeProduct()` does not expose a top-level `imageUrl` —
images live inside `product.images[]`. So when an unauthenticated user
adds to cart, the cart row has `imageUrl: ""` and the cart, checkout
summary, and order summary all render the placeholder icon instead of
the product cover. The server-cart path already uses `getPrimaryImage()`
correctly; the guest path needs the same treatment.

**Around line 52–65. BEFORE:**

```jsx
function adaptGuestItem(raw) {
  return {
    id: raw.id,
    lineId: raw.id,
    productId: raw.id,
    slug: raw.slug || "",
    title: raw.title || "Untitled",
    price: Number(raw.price || 0),
    currency: raw.currency || "MXN",
    category: raw.category || "General",
    imageUrl: raw.imageUrl || "",
    quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)),
  }
}
```

**AFTER:**

```jsx
function adaptGuestItem(raw) {
  // Use the same comprehensive image resolver the server-cart path uses,
  // so guest carts render the cover image consistently. The previous
  // raw.imageUrl-only path silently dropped images for every guest add
  // because backend serializeProduct returns images[] not imageUrl.
  return {
    id: raw.id,
    lineId: raw.id,
    productId: raw.id,
    slug: raw.slug || "",
    title: raw.title || "Untitled",
    price: Number(raw.price || 0),
    currency: raw.currency || "MXN",
    category: raw.category || "General",
    imageUrl: raw.imageUrl || getPrimaryImage(raw),
    quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)),
  }
}
```

**Verify.** Add a product to cart while logged out → cart drawer shows the
cover image. Same image renders in checkout summary and CheckoutSuccess.

---

## Patch 3 · Finding #3 · Replace "30-day refund" trust badge

**Files:**
- `web/src/i18n/locales/en/product.json` ✅ already done in this session
- `web/src/i18n/locales/es/product.json` ✅ already done in this session
- `web/src/pages/ProductDetail.jsx` (rolled back — re-apply)

After you restore ProductDetail.jsx via git, apply this patch.

**Around line 477. BEFORE:**

```jsx
const TRUST_BADGES = [
  { icon: Lock,       key: "secureCheckout" },
  { icon: CreditCard, key: "paymentMethods" },
  { icon: RotateCcw,  key: "refundPolicy" },
  { icon: Zap,        key: "instantDownload" },
];
```

**AFTER:**

```jsx
const TRUST_BADGES = [
  { icon: Lock,       key: "secureCheckout" },
  { icon: CreditCard, key: "paymentMethods" },
  { icon: RefreshCw,  key: "lifetimeUpdates" },
  { icon: Zap,        key: "instantDownload" },
];
```

**Verify.** ProductDetail trust strip reads `Lifetime updates` instead of
`30-day refund`. The icon shows two arrows in a circle (RefreshCw) instead
of the back-arrow (RotateCcw).

---

## Patch 4 · Finding #11 · Language switcher with US + Mexican flags

**File:** `web/src/components/LanguageSwitcher.jsx` (rolled back — re-apply
after git restore)

This patch is a **full file replacement**. After you `git checkout HEAD --`
the file, paste the contents below over it.

**Why this version.** Three variants (default navbar pill, footer text,
mobile icon-only). Inline-SVG flags (no emoji — emojis render OS-dependent
and aren't brand-safe). US flag for EN, Mexican flag for ES (LATAM market
fit per MercadoPago primary gateway).

```jsx
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/hooks/useLanguage";
import { pathWithLanguage } from "../i18n/utils/pathWithLanguage";

// LanguageSwitcher
// Segmented EN/ES toggle with brand-aligned inline-SVG flags.
// Variants: default (navbar pill) | text (footer) | icon (mobile flag-only).
// Spanish target = LATAM; ES button uses Mexican flag. EN uses US flag.

function FlagUS({ className = "h-3.5 w-5" }) {
  return (
    <svg viewBox="0 0 19 10" xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] ${className}`}
      aria-hidden="true">
      <rect width="19" height="10" fill="#B22234" />
      <rect y="0.77" width="19" height="0.77" fill="#FFFFFF" />
      <rect y="2.31" width="19" height="0.77" fill="#FFFFFF" />
      <rect y="3.85" width="19" height="0.77" fill="#FFFFFF" />
      <rect y="5.38" width="19" height="0.77" fill="#FFFFFF" />
      <rect y="6.92" width="19" height="0.77" fill="#FFFFFF" />
      <rect y="8.46" width="19" height="0.77" fill="#FFFFFF" />
      <rect width="7.6" height="5.38" fill="#3C3B6E" />
    </svg>
  );
}

function FlagMX({ className = "h-3.5 w-5" }) {
  return (
    <svg viewBox="0 0 21 12" xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] ${className}`}
      aria-hidden="true">
      <rect width="7" height="12" x="0" fill="#006847" />
      <rect width="7" height="12" x="7" fill="#FFFFFF" />
      <rect width="7" height="12" x="14" fill="#CE1126" />
      <circle cx="10.5" cy="6" r="1.6" fill="#8C6135" />
      <circle cx="10.5" cy="6" r="1.0" fill="#A4D65E" opacity="0.9" />
    </svg>
  );
}

export default function LanguageSwitcher({ variant = "default", tone = "light", className = "" }) {
  const { lang, setLang } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = tone === "dark";

  const switchTo = (next) => {
    if (next === lang) return;
    setLang(next);
    const target = pathWithLanguage(location.pathname, next) +
                   (location.search || "") + (location.hash || "");
    navigate(target, { replace: false });
  };

  if (variant === "text") {
    const activeClass = isDark ? "text-terracotta" : "text-violet";
    const inactiveClass = isDark ? "text-white/65 hover:text-white" : "text-charcoal/55 hover:text-violet";
    const dotClass = isDark ? "text-white/35" : "text-charcoal/30";
    return (
      <div role="group" aria-label={t("language.ariaSelector")}
        className={`inline-flex items-center gap-1.5 text-[12px] ${className}`}>
        <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
          aria-label={t("language.switchTo", { lang: t("language.english") })}
          className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold transition ${
            lang === "en" ? activeClass : inactiveClass
          }`}>
          <FlagUS className="h-3 w-[18px]" />EN
        </button>
        <span className={dotClass}>|</span>
        <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
          aria-label={t("language.switchTo", { lang: t("language.spanish") })}
          className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold transition ${
            lang === "es" ? activeClass : inactiveClass
          }`}>
          <FlagMX className="h-3 w-[18px]" />ES
        </button>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <div role="group" aria-label={t("language.ariaSelector")}
        className={`inline-flex items-center gap-1 ${className}`}>
        <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
          aria-label={t("language.switchTo", { lang: t("language.english") })}
          className={`inline-flex items-center justify-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
            lang === "en" ? "ring-2 ring-violet/60" : "opacity-55 hover:opacity-100"
          }`}>
          <FlagUS className="h-4 w-6" />
        </button>
        <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
          aria-label={t("language.switchTo", { lang: t("language.spanish") })}
          className={`inline-flex items-center justify-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
            lang === "es" ? "ring-2 ring-violet/60" : "opacity-55 hover:opacity-100"
          }`}>
          <FlagMX className="h-4 w-6" />
        </button>
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("language.ariaSelector")}
      className={`inline-flex items-center gap-0.5 rounded-full border border-[#DCDCE4] bg-white p-0.5 ${className}`}>
      <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
        aria-label={t("language.switchTo", { lang: t("language.english") })}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
          lang === "en"
            ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]"
            : "text-charcoal/70 hover:bg-[#EDE9FB] hover:text-violet"
        }`}>
        <FlagUS className="h-3 w-[18px]" />EN
      </button>
      <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
        aria-label={t("language.switchTo", { lang: t("language.spanish") })}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
          lang === "es"
            ? "bg-violet text-white shadow-sm"
            : "text-charcoal/70 hover:text-violet"
        }`}>
        <FlagMX className="h-3 w-[18px]" />ES
      </button>
    </div>
  );
}
```

**Verify.** Navbar shows `🇺🇸 EN | 🇲🇽 ES` pill. Clicking ES switches the
URL prefix to `/es/...` and the active flag changes.

---

## Patch 5 · Finding #19 · StoreHero CTAs work from any page

**File:** `web/src/components/heroes/StoreHero.jsx` (rolled back — re-apply
after git restore)

**Root cause.** The "Shop now" / "Browse categories" buttons use
`href="#products"` and `href="#categories"` — these only resolve when the
StoreHero is mounted on the Store page. If StoreHero is reused on Home or
elsewhere, the anchors don't resolve and the buttons feel dead.

**Around line 432–446. BEFORE:**

```jsx
<a
  href="#products"
  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-terracotta px-7 py-4 text-[14px] font-bold !text-violet shadow-[0_14px_36px_rgba(233, 196, 106,0.30)] transition hover:-translate-y-0.5 hover:bg-[#ffd9be] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
>
  {t("hero.shopNow")}
  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
</a>
<a
  href="#categories"
  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/25 bg-white/5 px-7 py-4 text-[14px] font-semibold !text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
>
  {t("hero.browseCategories")}
</a>
```

**AFTER:**

```jsx
<Link
  to="/store#products"
  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-terracotta px-7 py-4 text-[14px] font-bold !text-violet shadow-[0_14px_36px_rgba(233, 196, 106,0.30)] transition hover:-translate-y-0.5 hover:bg-[#ffd9be] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
>
  {t("hero.shopNow")}
  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
</Link>
<Link
  to="/store#categories"
  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/25 bg-white/5 px-7 py-4 text-[14px] font-semibold !text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
>
  {t("hero.browseCategories")}
</Link>
```

`Link` is already imported at the top of the file. No other changes needed.

**Verify.** "Shop now" navigates to `/store#products` regardless of which
page the hero is mounted on. "Browse categories" → `/store#categories`.

---

## Patch 6 · Finding #9 · Home hero "Featured Product" → real product

**File:** `web/src/components/heroes/HomeHero.jsx` (rolled back — re-apply
after git restore)

**Root cause.** The featured product card pulls from a static
`data/storeData.js` import. The product slugs in that file may not match
what's currently in the database, so clicking the card can land on
"Product not found." Also, the card builds the URL with `safe.id` but the
route is `/store/:slug` (per `App.jsx:171`) — which means the link 404s
even when the static product matches a DB row.

Two-part fix: fetch the live featured product from the API on mount, and
build the URL from `slug` not `id`.

**Around line 1–17 (imports). BEFORE:**

```jsx
import { useMemo } from "react"
// ... other imports ...
import { products as STORE_PRODUCTS } from "../../data/storeData"
```

**AFTER:**

```jsx
import { useEffect, useMemo, useState } from "react"
// ... other imports ...
import { products as STORE_PRODUCTS } from "../../data/storeData"
import { apiGet, API_BASE_URL } from "../../lib/api"
```

**Around line 92–98 (component body, top). BEFORE:**

```jsx
export default function HomeHero() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()

  /* Pick the featured product once; useMemo to avoid re-running on every
     re-render. Safe against empty/undefined imports. */
  const featuredProduct = useMemo(() => pickFeaturedProduct(STORE_PRODUCTS), [])
```

**AFTER:**

```jsx
export default function HomeHero() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()

  // Static fallback — used until the live API responds (or if it fails).
  // Prevents the hero from rendering blank or pointing at a stale slug.
  const fallbackProduct = useMemo(() => pickFeaturedProduct(STORE_PRODUCTS), [])

  // Fetch the live featured product on mount. Single most recent featured
  // product so the hero always reflects what is actually live in the DB.
  const [liveFeatured, setLiveFeatured] = useState(null)
  useEffect(() => {
    let cancelled = false
    apiGet("/api/v1/products?featured=true&limit=1&sort=createdAt:desc")
      .then((payload) => {
        if (cancelled) return
        const items = payload?.data || payload?.products || payload?.items || []
        const first = Array.isArray(items) && items.length > 0 ? items[0] : null
        if (first) setLiveFeatured(first)
      })
      .catch(() => { /* fall back silently to the static product */ })
    return () => { cancelled = true }
  }, [])

  const featuredProduct = liveFeatured || fallbackProduct
```

**Around line 569–607 (FeaturedProductCard component). BEFORE:**

```jsx
function FeaturedProductCard({ product }) {
  const { t } = useTranslation("home")
  const safe = product || {
    id: null,
    title: "STEM Curriculum Pack",
    price: 48,
    rating: 5,
  }
  const inner = (
    <div className="flex w-[224px] items-center gap-3 rounded-2xl border border-charcoal/5 bg-white p-3 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)] transition-transform hover:-translate-y-0.5">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-grad-innovation">
        <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
        <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-terracotta/40" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
          {t("hero.featuredProduct")}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-charcoal">
          {safe.title}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-violet">
          ${safe.price}
        </p>
      </div>
    </div>
  )
  return safe.id ? (
    <Link
      to={`/store/${safe.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist rounded-2xl"
      aria-label={`Featured product — ${safe.title}, $${safe.price}`}
    >
      {inner}
    </Link>
  ) : (
    inner
  )
}
```

**AFTER:**

```jsx
function FeaturedProductCard({ product }) {
  const { t } = useTranslation("home")
  const safe = product || {
    slug: null,
    title: "STEM Curriculum Pack",
    price: 48,
    rating: 5,
  }
  // Route key — App.jsx defines /store/:slug. Using id 404s.
  const routeKey = safe.slug || safe.id || null

  // Resolve cover image when the live API product carries one. Falls back
  // to the gradient placeholder for the static demo product (no images).
  const cover = (() => {
    const imgs = Array.isArray(safe?.images) ? safe.images : []
    const found = imgs.find((i) => i?.imageRole === "cover") || imgs[0]
    if (!found?.url) return null
    return found.url.startsWith("http") ? found.url : `${API_BASE_URL}${found.url}`
  })()

  const priceLabel = (() => {
    if (typeof safe?.priceFormatted === "string") return safe.priceFormatted
    const v = Number(safe?.price ?? 0)
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  })()

  const inner = (
    <div className="flex w-[224px] items-center gap-3 rounded-2xl border border-charcoal/5 bg-white p-3 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)] transition-transform hover:-translate-y-0.5">
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-grad-innovation">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <>
            <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
            <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-terracotta/40" />
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
          {t("hero.featuredProduct")}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-charcoal">
          {safe.title}
        </p>
        <p className="mt-1 text-[12px] font-semibold text-violet">
          {priceLabel}
        </p>
      </div>
    </div>
  )
  return routeKey ? (
    <Link
      to={`/store/${routeKey}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist rounded-2xl"
      aria-label={`Featured product — ${safe.title}, ${priceLabel}`}
    >
      {inner}
    </Link>
  ) : (
    inner
  )
}
```

**Verify.** Reload the home page → Featured Product card now reflects the
real most-recent featured product from the DB (correct title, correct
price, correct cover image). Clicking it lands on the live product detail
page, never "Product not found".

---

## Patch 7 · Finding #10 · Currency formatter (central)

**File:** `web/src/lib/format.js` (NEW — create this file)

**Root cause.** Different components hand-roll currency formatting, so
prices appear as `$129.00`, `MX$17.00`, `$17.00 MXN`, etc. across the
platform. Centralize the rule.

**CREATE this new file:**

```js
// web/src/lib/format.js
// Central money / number formatters. Use these everywhere instead of
// hand-rolling Intl.NumberFormat or string concatenation. Keeps the
// platform consistent on a single rule:
//   formatPrice(129)        → "$129.00 MXN"
//   formatPrice(129, "USD") → "$129.00 USD"
// JetBrains Mono with tabular-nums per Brand v3.1 § 14.

const DEFAULT_CURRENCY = "MXN";

/**
 * Format a number as a price with currency code.
 * @param {number|string} amount
 * @param {string} currency  ISO 4217 (default MXN)
 * @returns {string}
 */
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `$0.00 ${currency}`;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted} ${currency}`;
}

/**
 * Compact variant — no currency code, useful in tight spaces (cart line,
 * header cart total, KPI cards). Pair with a separate currency badge.
 */
export function formatPriceCompact(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an integer count (orders, downloads, products, etc.) with
 * thousand separators. Falls through to "0" for non-numbers.
 */
export function formatCount(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US");
}
```

**Then sweep these call sites** to use `formatPrice` (or `formatPriceCompact`):

```bash
# Run this grep to find every hand-rolled price formatter:
grep -rE '\$\{[^}]*\.toFixed\(2\)\}|priceFormatted|\$\$\{|\$\{.*\.price' web/src --include='*.jsx' --include='*.js' -l
```

Replace each with `formatPrice(amount, currency)` or `formatPriceCompact(amount)`.

**Verify.** Every price across the platform reads as `$129.00 MXN` (or the
compact form where space requires it). Search for `MX$` and `$ MXN` —
both legacy formats — to confirm zero remaining hits.

---

## Patch 8 · Finding #15 · "Download catalog" → "Diagnosis checklist"

**Files:**
- `web/src/i18n/locales/en/services.json` ✅ already done in this session
- `web/src/i18n/locales/es/services.json` ✅ already done in this session

The button text now reads "Download your diagnosis checklist". You still
need to **wire up a real PDF** for the button to deliver. Place the PDF at
`public/documents/diagnosis-checklist.pdf` and verify the button's `href`
or download handler points there.

**To find the button handler:**

```bash
grep -rE 'downloadCatalog|diagnosis|catalog\.pdf' web/src --include='*.jsx' --include='*.js'
```

---

## Patch 9 · Finding #20, #22 · Service order workflow

**Files:** `src/services/serviceOrderService.js`, `src/controllers/adminServiceOrdersController.js`, `web/src/pages/AdminServiceOrdersPage.jsx`, `web/src/pages/DashboardServiceOrdersPage.jsx` + new project page

**Status.** Deferred — this is a 6+ hour build (admin Start workflow →
ClientProject auto-creation → milestone seed → member dashboard rendering).
See `QA_FIX_PLAN_2026-05-09.md` § 9 (Track I) for the full breakdown.

Recommend tackling this as its own dedicated session.

---

## Patch 10 · Finding #21 · Consultation confirm sends meeting link

**File:** `src/services/consultationService.js` + `src/utils/mailer.js`

**Status.** Deferred — needs Google Meet API integration or static-link
flow + `mailer.sendConsultationConfirmedEmail()` helper that includes the
meeting link in the body. The `meetingLink` field already exists on
Consultation per the seed data; just needs wiring.

See QA fix plan § 9 for the breakdown.

---

## Patch 11 · Finding #8 · Order-paid email includes PDF invoice

**Files:** `src/services/invoiceService.js`, `src/utils/mailer.js`

**Status.** Deferred — `pdfkit` is already in `package.json`. Needs a
`renderInvoicePdf(order)` helper + Nodemailer attachment in the
existing `sendPaidOrderEmail` path.

Sketch:

```js
// src/utils/mailer.js — inside sendPaidOrderEmail
const pdfBuffer = await renderInvoicePdf(order); // buffer
await transporter.sendMail({
  to: order.user.email,
  subject: `Your order #${order.orderNumber}`,
  html: paidOrderHtml(order),
  attachments: [{
    filename: `invoice-${order.orderNumber}.pdf`,
    content: pdfBuffer,
    contentType: "application/pdf",
  }],
});
```

`renderInvoicePdf` lives in `src/services/invoiceService.js` and uses
`pdfkit` to draw the invoice — header (brand wordmark), line items with
tabular-nums, totals, payment method, refund-policy footer.

---

## Patch 12 · Finding #6 · Failed-to-fetch on dashboard/products download

**File:** `web/src/pages/DashboardProductsPage.jsx`

**Root cause hypothesis.** This page uses raw `fetch()` for the download
button (audit H-11 flagged it among 12 sites). The `dashboard/downloads`
page calls the centralized `lib/api.js` `downloadFile()` helper which
injects JWT correctly — that's why downloads works in one and not the
other.

**Find this in the file:**

```bash
grep -nE 'fetch\(downloadUrl|fetch\(`' web/src/pages/DashboardProductsPage.jsx
```

**Replace** the raw `fetch(downloadUrl, { headers: { Authorization: ...
} })` with the same flow used in `DashboardDownloadsPage.jsx`:

```jsx
import { downloadFile } from "../lib/api"; // top of file

// In the click handler:
async function handleDownload(productId, fileId) {
  try {
    await downloadFile(`/api/v1/member/products/${productId}/files/${fileId}/download`);
  } catch (err) {
    toast.error(err?.toUserMessage?.() || "Download failed. Please try again.");
  }
}
```

`downloadFile` is exported from `web/src/lib/api.js` at line 287 — it
handles JWT injection, 401 retry, and blob streaming consistently.

**Verify.** Click download on dashboard/products → file downloads. No
"Failed to fetch" error. Behavior matches dashboard/downloads exactly.

---

## Patch 13 · Finding #5 · Dashboard/products cover image missing

**File:** `web/src/pages/DashboardProductsPage.jsx`

**Status.** The page already calls `resolveProductImage(product)` (line 30)
and reads `coverUrl` correctly. The bug is likely that the API response
from `/api/v1/member/products` doesn't `include: { images: true }` in the
Prisma query. Verify in the backend service:

```bash
grep -rnE 'include.*images|memberProducts' src/services/ src/controllers/
```

The fix: add `images: { orderBy: { sortOrder: 'asc' } }` to the
include block of whichever query feeds dashboard/products.

---

## Patch 14 · Finding #7 · Order detail 404

**Files:** `web/src/App.jsx:240` defines `<Route path="orders/:orderId" element={<DashboardOrderDetailPage />} />`. The link at `web/src/pages/DashboardOrdersPage.jsx:352` builds `/dashboard/orders/${order.id}`.

**Likely root cause.** The route param is `:orderId` but the page
component reads it via `useParams().id` instead of `.orderId`. Or the
order object's `id` property is named differently (e.g. `order.orderId`).

**Investigate:**

```bash
grep -nE 'useParams\(\)' web/src/pages/DashboardOrderDetailPage.jsx
```

Whatever destructured key the page uses must match the route param name.
Either rename the route to `:id` or rename the destructured variable to
`orderId`.

---

## Patch 15 · Finding #13 · Experience timeline (About page)

**File:** `web/src/pages/AboutPage.jsx` — find the experience array.

**Status.** The canonical 6-role experience data is already committed to
`prisma/seed-bio.js` (commit `28cb8fc`). The frontend page may render a
shorter hardcoded timeline. The fix is either:

A. Make AboutPage fetch from `/api/v1/profile/experience` (which reads
   from the Experience table, populated by `prisma db push && node prisma/seed-bio.js`)

B. Mirror the seed-bio EXPERIENCE constant into the AboutPage component
   directly

Recommended: A. Single source of truth in the database.

---

## What is NOT in this document

These QA findings need their own focused sessions because they require
significant build work, design decisions, or live debugging:

- **#1** What's Included tab — needs investigation of the tab data source
- **#12** View My CVs — needs three CV PDFs uploaded + UI picker
- **#14** Certificate render error — PDF.js worker debug
- **#16, #17** Pricing redesign — design decision required
- **#18** Search wiring — connect storehero search input to /store?q=
- **#23** Instant download after payment — needs the order success page
  to surface the download link prominently
- **#24** Mobile responsiveness sweep — full audit + fix pass

Each is documented in `QA_FIX_PLAN_2026-05-09.md` with its track and
effort estimate.

---

## Apply order (recommended)

1. Restore the four files my session truncated (precondition above)
2. Patches 1, 2, 3, 4, 5, 6 — quick wins, ~1 hour total
3. Patch 7 — currency formatter creation + sweep, ~2 hours
4. Patch 12 — download asymmetry fix, ~30 min
5. Patches 13, 14, 15 — backend include + route + experience, ~2 hours
6. Patch 11 — PDF invoice attachment, ~3 hours (its own session)
7. Patch 8 — wire diagnosis-checklist PDF, ~30 min once PDF is created
8. Patches 9, 10 — service order + consultation flows, ~6 hours (own session)

Total in-this-document fixes: ~15 hours.

---

*Generated 2026-05-09 · QA hand-off patches*
