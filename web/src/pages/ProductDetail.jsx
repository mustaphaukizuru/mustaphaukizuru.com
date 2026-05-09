import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next"
import { Link, useParams, useNavigate, useSearchParams} from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Minus,
  Plus,
  ShoppingCart,
  CheckCircle2,
  Star,
  ChevronRight,
  Package,
  Zap,
  Lock,
  Check,
  Share2,
  Heart,
  Files,
  User,
  BadgeCheck,
  Download,
  RefreshCw,
  CreditCard,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

import Seo from "../components/seo/Seo";
import ProductReviews from "../components/ProductReviews";
import { fetchProductBySlug } from "../services/productService";
import { useCart } from "../store/CartContext";
import { useAuth } from "../context/AuthContext";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../services/wishlistService";
import { API_BASE_URL } from "../lib/api";
import { getFileTypeStyles, formatFileSize } from "../lib/fileTypeIcons";
import RecentlyViewed, { useTrackProductView } from "../components/RecentlyViewed" // #4


function resolveUrl(url = "") {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, "").trim();
}

function normalizeImages(product) {
  const raw = Array.isArray(product?.images) ? product.images : [];

  const normalized = raw
    .filter((img) => img?.url)
    .slice(0, 6)
    .map((img, i) => ({
      id: img.id || `img-${i}`,
      url: resolveUrl(img.url),
      alt: img.altText || product?.title || `Preview ${i + 1}`,
      role: img.imageRole || "preview",
      isPrimary: Boolean(img.isPrimary),
    }));

  if (normalized.length > 0) return normalized;

  if (product?.image) {
    return [
      {
        id: "fallback-image",
        url: resolveUrl(product.image),
        alt: product?.title || "Product image",
        role: "preview",
        isPrimary: true,
      },
    ];
  }

  return [];
}

/**
 * Normalize a product's features array for display.
 *
 * Returns ONLY real features from the database. If a product has no features
 * defined, returns an empty array — the UI will then render a graceful empty
 * state rather than misleading platform-level platitudes (those belong to
 * the TrustBadges row, not to product-specific feature claims).
 */
function normalizeHighlights(product) {
  if (Array.isArray(product?.features) && product.features.length > 0) {
    return product.features
      .map((f) =>
        typeof f === "string"
          ? f
          : f?.featureText || f?.label || f?.title || ""
      )
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

function buildSeoDescription(product) {
  const raw =
    product?.metaDescription ||
    product?.shortDescription ||
    product?.description ||
    "";

  const cleaned = stripHtml(raw);

  if (!cleaned) {
    return "Professional digital product by Mustapha Ukizuru with practical implementation value, structured delivery, and immediate access after purchase.";
  }

  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FileManifest — "What's inside" file list
 *
 *  Renders product.files[] as a 2-column grid (1-col on mobile) of file rows
 *  showing file-type icon, name (mono), size, version, and primary badge.
 *
 *  Falls back to a graceful empty state when no files are attached. Used in
 *  the "Included files" tab on ProductDetail. The icon, label, color, and
 *  size formatting are sourced from lib/fileTypeIcons.js (refinement B).
 *  ────────────────────────────────────────────────────────────────────────── */
function FileManifest({ files = [] }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(files) || files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
        <Files className="h-8 w-8 text-charcoal-80/30" />
        <p className="text-meta font-semibold text-charcoal-80/60">
          {t("detail.noFiles")}
        </p>
        <p className="text-micro text-charcoal-80/50">
          {t("detail.filesAfterPurchase")}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {files.map((file, i) => (
        <FileRow key={file.id || `file-${i}`} file={file} />
      ))}
    </ul>
  );
}

function FileRow({ file }) {
  const { t: tFile } = useTranslation("product");
  const styles = getFileTypeStyles(file.fileType || file.fileName || "");
  const Icon = styles.icon;
  const label = styles.label;
  const chip = styles.chip;

  // Prefer the backend-supplied formatted size; fall back to client formatter
  const sizeDisplay = file.fileSizeFormatted || formatFileSize(file.fileSize) || "";

  // Friendly file name — strip leading folder prefixes if any
  const displayName = (file.fileName || tFile("files.untitled")).split(/[\\/]/).pop();

  return (
    <li className="group flex items-center gap-3 rounded-xl border border-charcoal-80/8 bg-white p-3 transition hover:border-violet/20 hover:shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
      {/* Icon chip */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${chip}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate font-mono text-meta font-semibold text-charcoal"
            title={displayName}
          >
            {displayName}
          </span>
          {file.isPrimary && (
            <span className="shrink-0 rounded-md bg-violet-pale px-1.5 py-0.5 text-micro font-bold uppercase tracking-wide text-violet">
              {tFile("misc.primary")}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-2 text-micro text-charcoal-80/60">
          {sizeDisplay && (
            <span className="font-mono tabular-nums">{sizeDisplay}</span>
          )}
          {sizeDisplay && file.version && <span aria-hidden="true">·</span>}
          {file.version && (
            <span className="rounded bg-charcoal-80/8 px-1.5 py-0.5 font-mono text-micro font-semibold text-charcoal-80/70">
              v{String(file.version).replace(/^v/i, "").replace(/v$/i, "")}
            </span>
          )}
        </div>
      </div>

      {/* Type label */}
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-micro font-bold ${chip}`}
      >
        {label}
      </span>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FileTypeStrip — F04 · A+B · Compact "Includes" chip strip for the buy box.
 *
 *  Renders a horizontal row of distinct file-type chips with their Lucide
 *  icons, immediately visible above the fold inside the sticky buy box.
 *  This surfaces the file-type iconography from lib/fileTypeIcons.js without
 *  requiring the visitor to click into the "What's Included" tab first.
 *
 *  Behavior:
 *    - Hides entirely when product has zero files (no misleading placeholders)
 *    - Groups files by normalized type · shows up to 5 distinct types
 *    - Shows "×N" multiplier when a single type repeats (e.g. "PDF ×3")
 *    - Shows "+N more" overflow indicator when >5 distinct types exist
 *
 *  Color tokens come straight from getFileTypeStyles() so the chips here
 *  stay perfectly in sync with the larger FileRow icons inside the manifest.
 *  ────────────────────────────────────────────────────────────────────────── */
function FileTypeStrip({ files }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(files) || files.length === 0) return null;

  // Group by file-type label · keep first 5 distinct types
  const grouped = new Map();
  for (const f of files) {
    const styles = getFileTypeStyles(f.fileType || f.fileName || "");
    const existing = grouped.get(styles.label);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(styles.label, { ...styles, count: 1 });
    }
  }

  const visible = Array.from(grouped.values()).slice(0, 5);
  const visibleFileCount = visible.reduce((sum, t) => sum + t.count, 0);
  const overflow = files.length - visibleFileCount;

  return (
    <div className="mt-4 border-t border-charcoal-80/8 pt-4">
      <div className="flex items-center gap-2">
        <Files className="h-3.5 w-3.5 shrink-0 text-charcoal-80/45" aria-hidden="true" />
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-charcoal-80/55">
          {t("misc.includes")}
        </span>
        <span className="font-mono text-micro tabular-nums text-charcoal-80/45">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {visible.map(({ icon: Icon, label, chip, count }) => (
          <span
            key={label}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-micro font-bold ${chip}`}
            title={count > 1 ? `${count} ${label} files` : `1 ${label} file`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono">{label}</span>
            {count > 1 && (
              <span className="font-mono opacity-70">×{count}</span>
            )}
          </span>
        ))}

        {overflow > 0 && (
          <span className="text-micro font-medium text-charcoal-80/50">
            +{overflow} {t("misc.more")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  CreatorStrip — seller attribution row
 *
 *  Single-line attribution pattern (Etsy-style) showing:
 *    "{t("detail.designedBy")} <name> · <location> · Verified seller"
 *
 *  Currently hard-coded to Mustapha Ukizuru since this is a single-creator
 *  storefront. If the platform later adds multi-vendor support, swap for
 *  product.creator.{name, location, isVerified} fields.
 *  ────────────────────────────────────────────────────────────────────────── */
const CREATOR = {
  name: "Mustapha Ukizuru",
  verified: true,
  storefrontUrl: "/about",
};

function CreatorStrip() {
  const { t } = useTranslation("product");
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-charcoal-80/60">
      <span className="inline-flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
        <span>
          {t("creator.designedBy")}{" "}
          <Link
            to={CREATOR.storefrontUrl}
            className="font-semibold text-violet hover:underline"
          >
            {CREATOR.name}
          </Link>
        </span>
      </span>

      {CREATOR.verified && (
        <>
          <span className="text-charcoal-80/30" aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 text-violet">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{t("creator.verifiedSeller")}</span>
          </span>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SocialProofBar — rating · downloads · last updated
 *
 *  Single-line metrics row (Etsy/Amazon-style social proof). Shows:
 *    ★ 4.8 (127 reviews)  ·  📥 1,400+ downloads  ·  🆕 Updated Oct 2025
 *
 *  Each metric hides cleanly when its value is 0/null/missing.
 *  - Rating shows half-star precision (4.8 not 4.80).
 *  - Download count uses k/m abbreviation (1.4k+, 12k+, 1m+).
 *  - "Updated" uses month + year (e.g. "Oct 2025"). For < 30 days, shows
 *    relative ("2 days ago", "yesterday").
 *  - Reviews count is clickable — jumps to the Reviews tab.
 *  ────────────────────────────────────────────────────────────────────────── */
function SocialProofBar({ rating, reviewCount, downloadCount, updatedAt, onReviewClick }) {
  const { t } = useTranslation("product")
  const hasRating = Number(rating) > 0;
  const hasReviews = Number(reviewCount) > 0;
  const hasDownloads = Number(downloadCount) > 0;
  const updatedLabel = formatUpdatedDate(updatedAt);

  // If absolutely nothing to show, render nothing
  if (!hasRating && !hasReviews && !hasDownloads && !updatedLabel) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-meta text-charcoal-80/75">
      {/* Rating + reviews */}
      {(hasRating || hasReviews) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex gap-0.5 text-terracotta" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < Math.round(rating || 0) ? "fill-current" : "text-charcoal-80/15"}`}
              />
            ))}
          </span>
          {hasRating && (
            <span className="font-mono font-semibold tabular-nums text-charcoal">
              {Number(rating).toFixed(1)}
            </span>
          )}
          {hasReviews && (
            <button
              type="button"
              onClick={onReviewClick}
              className="text-charcoal-80/70 underline-offset-2 hover:text-violet hover:underline"
              aria-label={`See ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
            >
              <span className="font-mono tabular-nums">({reviewCount})</span>{" "}
              {reviewCount === 1 ? "review" : "reviews"}
            </button>
          )}
        </span>
      )}

      {/* Separator */}
      {(hasRating || hasReviews) && (hasDownloads || updatedLabel) && (
        <span className="text-charcoal-80/30" aria-hidden="true">·</span>
      )}

      {/* Downloads */}
      {hasDownloads && (
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
          <span>
            <span className="font-mono font-semibold tabular-nums text-charcoal">
              {formatCountAbbrev(downloadCount)}
            </span>{" "}
            <span className="text-charcoal-80/70">{t("misc.downloads")}</span>
          </span>
        </span>
      )}

      {/* Separator */}
      {hasDownloads && updatedLabel && (
        <span className="text-charcoal-80/30" aria-hidden="true">·</span>
      )}

      {/* Last updated */}
      {updatedLabel && (
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-charcoal-80/40" aria-hidden="true" />
          <span>
            {t("misc.updated")} <span className="text-charcoal">{updatedLabel}</span>
          </span>
        </span>
      )}
    </div>
  );
}

/* Format a count with k/m abbreviation: 1234 -> "1.2k", 12345 -> "12k", 1234567 -> "1.2m"
   Adds "+" suffix when abbreviated to imply minimum threshold. */
function formatCountAbbrev(value) {
  const n = Number(value || 0);
  if (n < 1000) return n.toString();
  if (n < 10000) return `${(n / 1000).toFixed(1)}k+`;
  if (n < 1000000) return `${Math.floor(n / 1000)}k+`;
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}m+`;
  return `${Math.floor(n / 1000000)}m+`;
}

/* Format updatedAt as either relative ("2 days ago", "yesterday") for recent
   updates, or "Mon YYYY" (e.g. "Oct 2025") for older ones. Returns "" if invalid. */
function formatUpdatedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return ""; // future date, invalid for "updated"
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }

  // Older — use "Mon YYYY"
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/* ──────────────────────────────────────────────────────────────────────────
 *  TrustBadges — purchase confidence row
 *
 *  Compact 4-icon row directly below the CTA buttons (Add to cart / Buy now).
 *  Reduces purchase hesitation by surfacing key trust signals:
 *
 *    🔒 Secure checkout · 💳 PayPal + MercadoPago · ↩ 30-day refund · ⬇ Instant download
 *
 *  Layout adapts: 4-up on desktop with separators, 2x2 grid on mobile,
 *  always wraps cleanly without overflow.
 *  ────────────────────────────────────────────────────────────────────────── */
const TRUST_BADGES = [
  { icon: Lock,       key: "secureCheckout" },
  { icon: CreditCard, key: "paymentMethods" },
  { icon: RotateCcw,  key: "refundPolicy" },
  { icon: Zap,        key: "instantDownload" },
];

function TrustBadges() {
  const { t } = useTranslation("product");
  return (
    <ul
      className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-micro text-charcoal-80/60 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
      aria-label={t("trust.ariaLabel")}
    >
      {TRUST_BADGES.map(({ icon: Icon, key }) => (
        <li
          key={key}
          className="inline-flex items-center gap-1.5"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-violet/70" aria-hidden="true" />
          <span className="leading-tight">{t(`trust.${key}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  DescriptionWithFade — Etsy-style "Learn more about this item" pattern.
 *
 *  Renders product description with a soft gradient fade-out at the bottom
 *  when content is collapsed, plus a centered toggle button. Auto-detects
 *  whether content actually overflows the collapsed height — if it doesn't,
 *  the button hides itself (no need to "expand" what's already fully visible).
 *
 *  Props:
 *    - description     : main description text
 *    - fullDescription : optional secondary description (rendered after a divider)
 *    - shortDescription: fallback if description is empty
 *    - collapsedHeight : px height when collapsed (default 240)
 *    - fadeColor       : RGB tuple matching the page background, for the gradient
 *                        (default matches `--mist` brand token #F8FAFC)
 *  ────────────────────────────────────────────────────────────────────────── */
function DescriptionWithFade({
  description,
  fullDescription,
  shortDescription,
  collapsedHeight = 240,
  fadeColor = "248, 250, 252", // --mist #F8FAFC
}) {
  const { t: tDesc } = useTranslation("product");
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Callback ref — measures content on mount and on re-renders to detect overflow.
  // Using a callback ref (not useRef) lets us run measurement when React attaches
  // the DOM node, so we don't need a separate useEffect.
  const measureRef = (node) => {
    if (!node) return;
    const overflows = node.scrollHeight > collapsedHeight + 8;
    if (overflows !== isOverflowing) {
      setIsOverflowing(overflows);
    }
  };

  const text =
    description ||
    shortDescription ||
    "This digital product is professionally crafted to deliver immediate implementation value. Built to save time and reduce setup friction.";

  // The fully expanded content (description + optional fullDescription block)
  const content = (
    <div className="max-w-prose space-y-4 text-meta leading-7 text-charcoal-80/80">
      <div>{text}</div>
      {fullDescription && (
        <div className="border-t border-charcoal-80/8 pt-4">{fullDescription}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div
        ref={measureRef}
        className="relative overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: expanded || !isOverflowing ? "none" : `${collapsedHeight}px`,
        }}
      >
        {content}

        {/* Gradient fade, only visible while collapsed AND content overflows */}
        {!expanded && isOverflowing && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background: `linear-gradient(to bottom, rgba(${fadeColor}, 0) 0%, rgba(${fadeColor}, 0.85) 60%, rgba(${fadeColor}, 1) 100%)`,
            }}
          />
        )}
      </div>

      {/* Toggle button, only visible when content actually overflows */}
      {isOverflowing && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-meta font-bold text-charcoal underline-offset-4 transition hover:bg-violet-pale hover:text-violet hover:no-underline"
            aria-expanded={expanded}
          >
            <span className="underline">
              {expanded ? tDesc("description.showLess") : tDesc("description.learnMore")}
            </span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  HighlightsBlock — F04 · I — Etsy-style scannable highlights.
 *
 *  Compact bulleted list of 3-6 quick-scan selling points sitting prominently
 *  near the top of the page. NOT a key/value table (that's the Specs tab) —
 *  this is for fast visual triage:
 *
 *    ✓ Made by Mustapha Ukizuru in Mexico
 *    ✓ Materials: Cotton, polyester
 *    ✓ Includes 24 printable templates
 *    ✓ Editable in Word + Google Docs
 *
 *  Renders each spec row as "Label: Value" in a single readable line. Hides
 *  entirely when no specifications exist.
 *
 *  Data source: `product.specifications` JSON column (admin-edited).
 *  Shape: [{ key: string, value: string }, ...]
 *  ────────────────────────────────────────────────────────────────────────── */
function HighlightsBlock({ specifications }) {
  const { t } = useTranslation("product");
  if (!Array.isArray(specifications) || specifications.length === 0) return null;

  // Filter out malformed/empty rows; cap at 6 for scannability.
  const rows = specifications
    .filter(
      (s) =>
        s &&
        typeof s.key === "string" &&
        typeof s.value === "string" &&
        s.key.trim() &&
        s.value.trim()
    )
    .slice(0, 6);
  if (rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] sm:p-6">
      <h2 className="mb-3 inline-flex items-center gap-2 text-meta font-bold text-violet">
        <Star className="h-4 w-4 fill-current" aria-hidden="true" />
        {t("highlights.title")}
      </h2>

      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={`${row.key}-${i}`}
            className="flex items-start gap-2.5 text-meta leading-6 text-charcoal-80/85"
          >
            <CheckCircle2
              className="mt-1 h-4 w-4 shrink-0 text-[#2FA36B]"
              aria-hidden="true"
            />
            <span>
              <span className="font-semibold text-charcoal">{row.key}:</span>{" "}
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  SpecsTable — F04 · I — Formal 2-column key/value table.
 *
 *  Used INSIDE the "Specs" tab — the formal product details. Pulls from the
 *  same `specifications` data as <HighlightsBlock> but renders as a proper
 *  details table (label / value rows). Returns a graceful empty state when
 *  no specs exist (so the tab is never blank).
 *
 *  Data source: `product.specifications` JSON column (admin-edited).
 *  ────────────────────────────────────────────────────────────────────────── */
function SpecsTable({ specifications, product }) {
  const { t: tSpecs } = useTranslation("product");
  const rows = Array.isArray(specifications)
    ? specifications.filter(
        (s) =>
          s &&
          typeof s.key === "string" &&
          typeof s.value === "string" &&
          s.key.trim() &&
          s.value.trim()
      )
    : [];

  // Synthesize platform-level rows that are always known. These show even
  // when the admin hasn't entered any custom specs, so the tab is informative.
  const synthetic = [];
  if (product?.category) synthetic.push({ key: tSpecs("info.category"), value: product.category });
  if (product?.deliveryType) synthetic.push({ key: tSpecs("info.delivery"), value: product.deliveryType });
  if (product?.files?.length) {
    synthetic.push({
      key: "Files",
      value: `${product.files.length} ${product.files.length === 1 ? "file" : "files"}`,
    });
  }
  if (product?.updatedAt) {
    const d = new Date(product.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      synthetic.push({
        key: tSpecs("info.lastUpdated"),
        value: d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
    }
  }

  const allRows = [...rows, ...synthetic];

  if (allRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
        <Package className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
        <p className="text-meta font-semibold text-charcoal-80/60">
          {t("detail.specsComing")}
        </p>
      </div>
    );
  }

  return (
    <dl className="overflow-hidden rounded-xl border border-charcoal-80/10">
      {allRows.map((row, i) => (
        <div
          key={`${row.key}-${i}`}
          className={`grid grid-cols-1 gap-1 px-4 py-3 text-meta sm:grid-cols-[160px_1fr] sm:gap-4 sm:py-3.5 ${
            i % 2 === 0 ? "bg-white" : "bg-mist/35"
          }`}
        >
          <dt className="font-semibold text-charcoal-80/65">{row.key}</dt>
          <dd className="text-charcoal">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FAQSection — F04 · K — Accordion FAQ section.
 *
 *  Sits below the tabs section. Each FAQ is collapsible; clicking the
 *  question toggles its answer. Only one open at a time (single-expand
 *  pattern, like Etsy/Amazon FAQs).
 *
 *  Hides entirely when no FAQs exist.
 *
 *  Data source: `product.productFaqs` JSON column (admin-edited).
 *  Shape: [{ question: string, answer: string }, ...]
 *
 *  Also exposes its data shape to `<Seo>` via FAQPage JSON-LD (refinement H,
 *  emitted from the parent ProductDetail component).
 *  ────────────────────────────────────────────────────────────────────────── */
function FAQSection({ faqs }) {
  const { t } = useTranslation("product")
  const [openIndex, setOpenIndex] = useState(0);

  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  // Filter malformed/empty
  const rows = faqs.filter(
    (f) => f && typeof f.question === "string" && typeof f.answer === "string" &&
           f.question.trim() && f.answer.trim()
  );
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="faq-heading"
      className="mt-8 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgba(93,63,211,0.04)]"
    >
      <div className="mb-5 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-violet" aria-hidden="true" />
        <h2 id="faq-heading" className="text-section font-bold text-violet">
          {t("detail.faqTitle")}
        </h2>
      </div>

      <ul className="divide-y divide-charcoal-80/8">
        {rows.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <li key={`${faq.question}-${i}`} className="py-1">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 py-3 text-left transition hover:text-violet"
              >
                <span className="flex-1 text-meta font-semibold text-charcoal">
                  {faq.question}
                </span>
                <span
                  className="mt-0.5 shrink-0 rounded-full bg-violet-pale p-1 text-violet transition"
                  aria-hidden="true"
                >
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>
              {isOpen && (
                <div className="max-w-prose pb-4 pr-9 text-meta leading-7 text-charcoal-80/80">
                  {faq.answer}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  MobileBuyBar — F04 · C — Sticky mobile bottom-bar CTA.
 *
 *  Hidden by default (md+). On mobile, stays fixed to the viewport bottom
 *  while scrolling so the user can always see price + {t("detail.addToCart")} without
 *  scrolling back to the buy box.
 *
 *  Activates when the user scrolls past ~600px (past the gallery and
 *  initial buy box). Slides in with Framer Motion.
 *  ────────────────────────────────────────────────────────────────────────── */
function MobileBuyBar({ price, currency, onAddToCart, added, productTitle }) {
  const { t: tBar } = useTranslation("product");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 600);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{
        y: visible ? 0 : 100,
        opacity: visible ? 1 : 0,
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal-80/10 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(93,63,211,0.08)] backdrop-blur-md md:hidden"
      style={{ pointerEvents: visible ? "auto" : "none" }}
      role="region"
      aria-label={tBar("mobileBar.ariaLabel")}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-micro font-semibold text-charcoal-80/60">
            {productTitle}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-meta font-bold text-violet">
              ${Number(price).toFixed(2)}
            </span>
            <span className="text-micro text-charcoal-80/55">{currency}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddToCart}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-meta font-semibold text-white shadow-[0_6px_16px_rgba(93,63,211,0.18)] transition active:scale-95 ${
            added
              ? "bg-[#2FA36B]"
              : "bg-violet hover:bg-violet-deep"
          }`}
        >
          {added ? (
            <>
              <Check className="h-4 w-4" />
              {tBar("misc.added")}
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              {tBar("actions.addToCart")}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 *  RelatedProducts — F04 · G — "{t("detail.youMayLike")}" carousel.
 *
 *  Renders below the FAQ section. Fetches from /api/products/:slug/related
 *  (already exists in productController). Up to 4 products from the same
 *  category, excluding the current product.
 *
 *  - Horizontal scroll on mobile (snap-scroll), 4-up grid on desktop
 *  - Each card has image, title, price, brief teaser
 *  - Hides entirely when no related products exist
 *  ────────────────────────────────────────────────────────────────────────── */
function RelatedProducts({ items = [], currentSlug }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(items) || items.length === 0) return null;

  // Filter out current product (defensive — backend should already exclude it)
  const filtered = items.filter((p) => p && p.slug && p.slug !== currentSlug);
  if (filtered.length === 0) return null;

  return (
    <section
      aria-labelledby="related-heading"
      className="mt-12 border-t border-charcoal-80/10 pt-12"
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="related-heading" className="text-section font-bold text-violet">
          {t("detail.youMayLike")}
        </h2>
        <Link
          to="/store"
          className="inline-flex items-center gap-1 text-meta font-semibold text-violet hover:underline"
        >
          {t("detail.seeAll")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.slice(0, 4).map((p) => (
          <RelatedProductCard key={p.id || p.slug} product={p} />
        ))}
      </div>
    </section>
  );
}

function RelatedProductCard({ product }) {
  const primaryImage =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.find((img) => img.isPrimary) || product.images[0]
      : null;
  const imageUrl = primaryImage?.url ? resolveUrl(primaryImage.url) : null;
  const price = Number(product.price ?? 0);

  return (
    <Link
      to={`/store/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_12px_rgba(93,63,211,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(93,63,211,0.10)]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-mist">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={primaryImage?.altText || product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-violet/25">
            <Package className="h-10 w-10" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-meta font-semibold text-charcoal transition group-hover:text-violet">
          {product.title}
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-micro leading-5 text-charcoal-80/60">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-auto flex items-baseline gap-1.5 pt-2">
          <span className="text-meta font-bold text-violet">
            ${price.toFixed(2)}
          </span>
          <span className="text-micro text-charcoal-80/55">
            {product.currency || "MXN"}
          </span>
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="aspect-[4/3] animate-pulse rounded-xl bg-violet-pale" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 w-16 animate-pulse rounded-xl bg-violet-pale"
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-10 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-24 animate-pulse rounded-xl bg-violet-pale" />
          <div className="h-14 animate-pulse rounded-xl bg-violet-pale" />
        </div>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { t } = useTranslation("product")
  const { slug } = useParams();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // B08 · wishlist state
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // #7 · Tab state synced to URL (?tab=description|features|reviews|specs|faq).
  // This lets users deep-link to a specific tab AND survives reload/back-button.
  const [searchParams, setSearchParams] = useSearchParams()
  // #4 · record this view in localStorage for the recently-viewed strip
  useTrackProductView(product)
  const VALID_TABS = ["description", "included", "specs", "reviews"]
  const urlTab = searchParams.get("tab")
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : "description"
  const setActiveTab = (id) => {
    if (id === "description") {
      // Clean URL — don't pollute it with the default tab.
      const next = new URLSearchParams(searchParams)
      next.delete("tab")
      setSearchParams(next, { replace: true })
    } else {
      const next = new URLSearchParams(searchParams)
      next.set("tab", id)
      setSearchParams(next, { replace: true })
    }
  }
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setQty(1);
      setAdded(false);

      try {
        const data = await fetchProductBySlug(slug);
        if (!data) throw new Error("Product not found.");
        setProduct(data);
      } catch (err) {
        setProduct(null);
        setError(err?.message || "Failed to load product.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  // F04 · G — Fetch related products. Best-effort: a fetch failure should never
  // break the detail page, so errors are silently swallowed and the related
  // section just hides.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${slug}/related`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setRelatedProducts(Array.isArray(json?.data) ? json.data : []);
      } catch {
        /* silent — related is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // B08 · load wishlist state once product + auth are resolved
  useEffect(() => {
    if (!isAuthenticated || !product?.id) {
      setWishlisted(false);
      setWishlistItemId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchWishlist();
        if (cancelled) return;
        const match = items.find((it) => it.productId === product.id || it.product?.id === product.id);
        setWishlisted(Boolean(match));
        setWishlistItemId(match?.id || null);
      } catch {
        /* non-blocking */
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, product?.id]);

  async function handleWishlistToggle() {
    if (!isAuthenticated) {
      const returnTo = slug ? `/store/${slug}` : window.location.pathname;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (wishlistBusy || !product?.id) return;
    setWishlistBusy(true);

    const wasWishlisted = wishlisted;
    const prevItemId = wishlistItemId;

    // Optimistic
    setWishlisted(!wasWishlisted);
    if (wasWishlisted) setWishlistItemId(null);

    try {
      if (wasWishlisted && prevItemId) {
        await removeFromWishlist(prevItemId);
      } else {
        const item = await addToWishlist(product.id);
        setWishlistItemId(item?.id || null);
      }
    } catch {
      setWishlisted(wasWishlisted);
      setWishlistItemId(prevItemId);
    } finally {
      setWishlistBusy(false);
    }
  }

  const images = useMemo(() => normalizeImages(product), [product]);
  const highlights = useMemo(() => normalizeHighlights(product), [product]);
  const price = Number(product?.price || 0);

  useEffect(() => {
    if (!images.length) {
      setActiveImg(0);
      return;
    }
    const primaryIndex = images.findIndex((img) => img.isPrimary);
    setActiveImg(primaryIndex >= 0 ? primaryIndex : 0);
  }, [images]);

  function handleAdd() {
    if (!product) return;
    addToCart({ ...product, quantity: qty }, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  function handleShare() {
    if (!product) return;

    const shareData = {
      title: product.title || "Product",
      text: product.shortDescription || product.description || "",
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
      return;
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  }

  if (loading) return <LoadingSkeleton />;

  if (error || !product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-red-50 text-red-500">
          <Package className="h-8 w-8" />
        </div>

        <h1 className="mt-5 text-section font-bold text-violet">
          {error || t("errors.notFound")}
        </h1>

        <Link
          to="/store"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-6 py-3 text-meta font-semibold text-white transition hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.backToStore")}
        </Link>
      </div>
    );
  }

  const seoTitle = product.metaTitle || product.title;
  const seoDescription = buildSeoDescription(product);
  const seoImage =
    images[activeImg]?.url ||
    images[0]?.url ||
    "https://mustaphaukizuru.com/og-default.jpg";
  const canonicalUrl = `https://mustaphaukizuru.com/store/${product.slug || slug}`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images.map((img) => img.url),
    description: stripHtml(product.description || product.shortDescription || ""),
    category: product.category || t("category.fallback"),
    sku: product.sku || product.slug || slug,
    brand: {
      "@type": "Brand",
      name: "Mustapha Ukizuru",
    },
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: price.toFixed(2),
      priceCurrency: product.currency || "MXN",
      availability:
        product.isActive === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    // F04 · H — only emit aggregateRating when reviews exist (Google requires
    // a non-zero ratingCount; a 0-count entry is grounds for rich-result rejection).
    ...(Number(product.reviewCount) > 0 && Number(product.rating) > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.rating).toFixed(1),
            reviewCount: Number(product.reviewCount),
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Store",
        item: "https://mustaphaukizuru.com/store",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category || "Product",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.title,
        item: canonicalUrl,
      },
    ],
  };

  // F04 · H + K — FAQPage JSON-LD. Emitted only when valid FAQs exist.
  // Google rich-result requires at least one Question/Answer pair.
  const faqRows = Array.isArray(product.productFaqs)
    ? product.productFaqs.filter(
        (f) =>
          f &&
          typeof f.question === "string" &&
          typeof f.answer === "string" &&
          f.question.trim() &&
          f.answer.trim()
      )
    : [];
  const faqJsonLd =
    faqRows.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqRows.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }
      : null;

  // Combine all JSON-LD scripts. Filter out null entries.
  const allJsonLd = [productJsonLd, breadcrumbJsonLd, faqJsonLd].filter(Boolean);

  // F04 · Tab restructure (Etsy-aligned): 4 tabs instead of 5.
  // - "What's Included" combines old "Features" + "Included files" into one
  //   coherent tab. Reduces decision fatigue and eliminates parallel duplication.
  // - "Specs" is the new home for the formal key/value details table.
  // - Old "Details" tab dropped — content was always empty in current data and
  //   "Specs" covers the same intent better.
  const totalIncluded =
    (Array.isArray(product.features) ? product.features.length : 0) +
    (Array.isArray(product.files) ? product.files.length : 0);

  const tabs = [
    { id: "description", label: "Description" },
    { id: "included", label: "What's Included", count: totalIncluded || null },
    { id: "specs", label: "Specs" },
    { id: "reviews", label: "Reviews", count: product.reviewCount || null },
  ];

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        image={seoImage}
        type="product"
        jsonLd={allJsonLd}
      />

      <div className="bg-mist">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-meta text-charcoal-80/60">
            <Link
              to="/store"
              className="inline-flex items-center gap-1 font-medium text-violet hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("misc.storeBreadcrumb")}
            </Link>

            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-charcoal-80/50">
              {product.category || "Product"}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate text-violet">
              {product.title}
            </span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
            <div className="flex flex-col gap-4">
              {/* F04.gallery · thumbnails moved to a LEFT rail (was a row below).
                  On mobile (<sm) they stay as a horizontal scrollable row below. */}
              <div className="flex flex-col gap-3 sm:flex-row">
                {images.length > 1 && (
                  <div
                    className="order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:max-h-[520px] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:pb-0 sm:pr-1"
                    role="tablist"
                    aria-label={t("carousel.thumbnailsAria")}
                  >
                    {images.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        role="tab"
                        aria-selected={activeImg === i}
                        aria-label={`Show image ${i + 1}: ${img.alt || ''}`}
                        onClick={() => setActiveImg(i)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                          activeImg === i
                            ? "border-violet shadow-[0_0_0_3px_rgba(93,63,211,0.15)]"
                            : "border-charcoal-80/12 hover:border-violet/40"
                        }`}
                      >
                        <img
                          src={img.url}
                          alt={img.alt}
                          className="h-full w-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main image · stays as flex-1 so the rail keeps fixed width */}
                <div className="order-1 flex-1 sm:order-2">
                  <motion.div
                    key={activeImg}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="relative aspect-square overflow-hidden rounded-xl bg-violet-pale shadow-[0_8px_32px_rgba(93,63,211,0.08)]"
                  >
                {images[activeImg] ? (
                  <img
                    src={images[activeImg].url}
                    alt={images[activeImg].alt}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-violet/25">
                    <Package className="h-16 w-16" />
                  </div>
                )}

                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {product.isFeatured && (
                    <span className="flex items-center gap-1 rounded-lg bg-violet px-2.5 py-1 text-micro font-bold text-white">
                      <Star className="h-3 w-3 fill-current" />
                      {t("misc.featuredBadge")}
                    </span>
                  )}

                  {product.isNew && (
                    <span className="rounded-lg bg-[#2FA36B] px-2.5 py-1 text-micro font-bold text-white">
                      {t("misc.newBadge")}
                    </span>
                  )}
                </div>
                  </motion.div>
                </div>
              </div>

              {/* F04 · I, Highlights metadata table (Etsy-style) */}
              <HighlightsBlock specifications={product.specifications} />

              <div className="rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
                <div className="flex overflow-x-auto rounded-t-xl border-b border-charcoal-80/10">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-3.5 text-meta font-semibold transition-all ${
                        activeTab === tab.id
                          ? "border-b-2 border-violet text-violet"
                          : "text-charcoal-80/60 hover:text-violet"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count != null && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-micro font-bold tabular-nums ${
                            activeTab === tab.id
                              ? "bg-violet-pale text-violet"
                              : "bg-charcoal-80/8 text-charcoal-80/60"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {activeTab === "description" && (
                    <DescriptionWithFade
                      description={product.description}
                      fullDescription={product.fullDescription}
                      shortDescription={product.shortDescription}
                    />
                  )}

                  {/* F04 · NEW unified "What's Included" tab — combines feature
                      bullets + the full file manifest into one coherent place.
                      Replaces the old Features tab + Included files tab. */}
                  {activeTab === "included" && (
                    <div className="space-y-6">
                      {/* Top half, feature bullets */}
                      {highlights.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-meta font-bold text-charcoal">
                            {t("detail.whatYouGet")}
                          </h3>
                          <ul className="space-y-2.5">
                            {highlights.map((feature, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-3 text-meta leading-6 text-charcoal-80/85"
                              >
                                <CheckCircle2
                                  className="mt-1 h-4 w-4 shrink-0 text-[#2FA36B]"
                                  aria-hidden="true"
                                />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Divider only when both halves render */}
                      {highlights.length > 0 && (product.files?.length > 0) && (
                        <div className="border-t border-charcoal-80/8" />
                      )}

                      {/* Bottom half, file manifest */}
                      {product.files?.length > 0 ? (
                        <div>
                          <div className="mb-3 flex items-baseline justify-between">
                            <h3 className="text-meta font-bold text-charcoal">
                              {t("detail.filesInProduct")}
                            </h3>
                            <span className="font-mono text-micro text-charcoal-80/55 tabular-nums">
                              {product.files.length}{" "}
                              {product.files.length === 1 ? "file" : "files"}
                            </span>
                          </div>
                          <FileManifest files={product.files || []} />
                        </div>
                      ) : (
                        highlights.length === 0 && (
                          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-charcoal-80/15 bg-mist/40 px-6 py-10 text-center">
                            <Package className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
                            <p className="text-meta font-semibold text-charcoal-80/60">
                              {t("detail.contentsComing")}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* F04 · NEW Specs tab — formal key/value details table.
                      Pulls from product.specifications + a few synthesized
                      platform-known values (Category, Delivery, etc.). */}
                  {activeTab === "specs" && (
                    <SpecsTable
                      specifications={product.specifications}
                      product={product}
                    />
                  )}

                  {activeTab === "reviews" && (
                    <ProductReviews slug={slug} productTitle={product.title} />
                  )}
                </div>
              </div>

              {/* F04 · K, Product FAQ accordion (hides if no FAQs) */}
              <FAQSection faqs={product.productFaqs} />
            </div>

            <div>
              <div className="sticky top-24 flex flex-col gap-5">
                <div className="rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.06)]">
                  <h1 className="text-section font-bold leading-tight tracking-tight text-violet">
                    {product.title}
                  </h1>

                  <CreatorStrip />

                  <SocialProofBar
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                    downloadCount={product.downloadCount}
                    updatedAt={product.updatedAt}
                    onReviewClick={() => setActiveTab("reviews")}
                  />

                  {/* F04 · A+B — Compact file-type chip strip with icons.
                      Surfaces fileTypeIcons.js styling above the fold so users
                      see what's inside without expanding the "Included" tab. */}
                  <FileTypeStrip files={product.files} />

                  {product.shortDescription && (
                    <p className="mt-2 text-meta leading-6 text-charcoal-80/65">
                      {product.shortDescription}
                    </p>
                  )}

                  <div className="mt-4 flex items-end gap-3">
                    <span className="text-page font-bold leading-none text-violet">
                      ${price.toFixed(2)}
                    </span>
                    <span className="mb-1 rounded-full bg-[#e8f4ea] px-2.5 py-0.5 text-micro font-bold text-[#2FA36B]">
                      {product.currency || "MXN"}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="shrink-0 text-micro font-semibold text-violet">
                        {t("misc.qty")}
                      </label>

                      <div className="flex items-center overflow-hidden rounded-xl border border-charcoal-80/15 bg-[#fafafa]">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="flex h-10 w-10 items-center justify-center text-violet transition hover:bg-violet-pale"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>

                        <span className="min-w-[36px] text-center text-meta font-bold text-violet">
                          {qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => setQty((q) => q + 1)}
                          className="flex h-10 w-10 items-center justify-center text-violet transition hover:bg-violet-pale"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="text-meta font-bold text-violet">
                        = ${(price * qty).toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAdd}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-body font-semibold text-white shadow-[0_10px_28px_rgba(93,63,211,0.22)] transition-all hover:-translate-y-0.5 ${
                        added
                          ? "bg-[#2FA36B] shadow-[0_10px_28px_rgba(47,163,107,0.25)]"
                          : "bg-violet hover:bg-violet-deep"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="h-5 w-5" />
                          {t("detail.addedToCart")}
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5" />
                          {t("detail.addToCart")}
                        </>
                      )}
                    </button>

                    <Link
                      to="/checkout"
                      onClick={() => {
                        addToCart({ ...product, quantity: qty }, qty);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet/20 py-3.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
                    >
                      {t("detail.buyNow")}
                    </Link>

                    <TrustBadges />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={handleWishlistToggle}
                      disabled={wishlistBusy}
                      aria-pressed={wishlisted}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-micro font-semibold transition ${
                        wishlisted
                          ? "border-red-200 bg-red-50 text-red-600"
                          : "border-charcoal-80/12 text-charcoal-80/60 hover:border-red-200 hover:text-red-500"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Heart
                        className={`h-4 w-4 ${wishlisted ? "fill-current" : ""}`}
                      />
                      {wishlistBusy ? "…" : wishlisted ? "Wishlisted" : "Wishlist"}
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-charcoal-80/12 py-2.5 text-micro font-semibold text-charcoal-80/60 transition hover:border-violet/25 hover:text-violet"
                    >
                      <Share2 className="h-4 w-4" />
                      {t("misc.share")}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* F04 · G, Related products (full-width, below 2-col grid) */}
          <RelatedProducts items={relatedProducts} currentSlug={slug} />
        </div>
      
      <RecentlyViewed excludeSlug={product.slug} />
      </div>

      {/* F04 · C, Mobile sticky buy bar (visible after scroll, mobile only) */}
      <MobileBuyBar
        price={price}
        currency={product.currency || "MXN"}
        productTitl
={product.title}
        added={added}
        onAddToCart={handleAdd}
      />
    </>
  );
}
