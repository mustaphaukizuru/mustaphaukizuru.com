/* ──────────────────────────────────────────────────────────────────────────
 *  StatusPill · Batch 6B-2
 *
 *  Single source of truth for status badges across the admin surface.
 *  Replaces multiple duplicated `AdminStatusBadge` / `StatusBadge`
 *  implementations that previously lived inside individual page files.
 *
 *  Taxonomy aligned with DashboardOrdersPage (Batch 6A) so member and
 *  admin views render the same statuses identically.
 *
 *  Variants:
 *    - status   · order/payment/transaction states (paid/pending/...)
 *    - role     · user roles (admin/member/guest)
 *    - active   · boolean active/inactive flags (products, services)
 *    - gateway  · payment gateway badges (mercadopago, paypal)
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_MAP = {
  // Order / payment status taxonomy
  paid: { bg: "bg-mint/15", text: "text-mint", label: "Paid" },
  completed: { bg: "bg-mint/15", text: "text-mint", label: "Completed" },
  active: { bg: "bg-mint/15", text: "text-mint", label: "Active" },
  delivered: { bg: "bg-mint/15", text: "text-mint", label: "Delivered" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" },
  processing:{ bg: "bg-amber-50", text: "text-amber-700", label: "Processing" },
  draft: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Draft" },
  inactive: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Inactive" },
  cancelled: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Cancelled" },
  failed: { bg: "bg-rose-50", text: "text-rose-600", label: "Failed" },
  refunded: { bg: "bg-rose-50", text: "text-rose-600", label: "Refunded" },
  rejected: { bg: "bg-rose-50", text: "text-rose-600", label: "Rejected" },
  suspended: { bg: "bg-rose-50", text: "text-rose-600", label: "Suspended" },
  open: { bg: "bg-azure/10", text: "text-azure", label: "Open" },
  closed: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Closed" },

  // Role taxonomy
  admin: { bg: "bg-violet-pale", text: "text-violet", label: "Admin" },
  member: { bg: "bg-azure/10", text: "text-azure", label: "Member" },
  guest: { bg: "bg-charcoal-80/10", text: "text-charcoal-80", label: "Guest" },

  // Gateway taxonomy
  mercadopago: { bg: "bg-azure/10", text: "text-azure", label: "MercadoPago" },
  paypal: { bg: "bg-violet-pale", text: "text-violet", label: "PayPal" },
}

/* ──────────────────────────────────────────────────────────────────────────
 *  StatusPill · primary export
 *
 *  Props:
 *    - status (string, required) · key looked up in STATUS_MAP
 *    - label  (string, optional) · override the auto-derived label text
 *    - size   ("sm" | "md") · controls padding + font-size
 *    - className (optional)  · merge extra classes (use sparingly)
 *  ──────────────────────────────────────────────────────────────────── */
export default function StatusPill({ status, label, size = "sm", className = "" }) {
  const key = String(status || "").toLowerCase().trim()
  const cfg = STATUS_MAP[key] || {
    bg: "bg-charcoal-80/10",
    text: "text-charcoal-80",
    label: status || "-",
  }
  const finalLabel = label ?? cfg.label

  const sizeClasses = size === "md"
    ? "px-3 py-1 text-micro"
    : "px-2 py-0.5 text-[10px]"

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-bold uppercase tracking-wider ring-1 ring-inset ring-current/15 ${cfg.bg} ${cfg.text} ${sizeClasses} ${className}`}
      aria-label={`Status: ${finalLabel}`}
    >
      {finalLabel}
    </span>
  )
}

// Named export for convenience
export { StatusPill }
