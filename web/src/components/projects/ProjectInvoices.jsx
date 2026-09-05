import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { CreditCard, Download, Loader2, Receipt } from "lucide-react"
import { Badge, EmptyStateSurface, Spinner } from "../ui"
import LocalizedLink from "../LocalizedLink"
import { API_BASE_URL } from "../../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProjectInvoices · the bills for this piece of work (T5-5)
 *
 *  Read-only. Nothing here creates, pays or voids anything — it lists what
 *  projectInvoiceService already returned and links to the PDF that service
 *  chose. In particular the download URL comes from the SERVER, because it
 *  differs by surface: a member downloads through the owner-checked
 *  order route, a portal holder through the portal's own gate. Deciding that
 *  here would mean a third opinion on "may this person have this PDF".
 *
 *  Amounts come from the invoice's own snapshot, so a refund on the order
 *  later does not change the total on a bill the client has already been
 *  sent.
 *
 *  T5-9 · it now also carries a way to PAY, and that comes from the server
 *  too (`invoice.pay`), for exactly the same reason: a member goes to the
 *  order page that already holds the pay card, a portal visitor has no
 *  session for that page to read and gets an endpoint instead. Nothing here
 *  decides an amount or a gateway.
 *  ──────────────────────────────────────────────────────────────────── */

const STATUS_TONE = {
  draft: "neutral",
  issued: "info",
  overdue: "danger",
  paid: "success",
  void: "neutral",
}

export default function ProjectInvoices({
  invoices = [],
  billing = null,
  loading = false,
  onPay = null,
  className = "",
}) {
  const { t, i18n } = useTranslation("dashboard")
  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"

  const fmtDate = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }),
    [locale],
  )
  // D0-2 · a SECOND formatter, pinned to UTC, for the fields that are a
  // calendar day rather than an instant. `dueDate` / `dueAt` are stored as
  // midnight UTC (an <input type="date"> value), so the local-time formatter
  // rendered the previous day for every reader west of Greenwich — the whole
  // home market saw "Due Sep 30" for the 1st of October.
  const fmtDay = useMemo(
    () => new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
    [locale],
  )
  const money = useMemo(() => (amount, currency) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "MXN",
  }).format(Number(amount) || 0), [locale])

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <Spinner />
      </div>
    )
  }

  if (!invoices.length) {
    return (
      <EmptyStateSurface
        icon={Receipt}
        title={t("invoices.emptyTitle")}
        description={t("invoices.emptyBody")}
        className={className}
      />
    )
  }

  const currency = invoices[0]?.currency || "MXN"

  return (
    <div className={className}>
      {/* The outstanding line first, because it is the only part most clients
          open this panel to read. Rendered only when billing was actually
          resolved: the server leaves it absent rather than sending zeros, and
          "0 due" for "not looked up" would be a lie about money. */}
      {billing && billing.unpaidCount > 0 ? (
        <p className="mb-4 rounded-xl bg-amber/10 px-4 py-3 text-body text-amber-700">
          {billing.nextDueAt
            ? t("invoices.outstandingDue", {
              count: billing.unpaidCount,
              amount: money(billing.unpaidTotal, currency),
              date: fmtDay.format(new Date(billing.nextDueAt)),
            })
            : t("invoices.outstanding", {
              count: billing.unpaidCount,
              amount: money(billing.unpaidTotal, currency),
            })}
        </p>
      ) : null}

      {/* Wide content scrolls inside its own box rather than pushing the page
          sideways on a phone. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-start">
          <caption className="sr-only">{t("invoices.caption")}</caption>
          <thead>
            <tr className="border-b border-charcoal-80/10 text-meta uppercase tracking-wide text-charcoal-80/65">
              <th scope="col" className="py-2 pe-3 text-start font-semibold">{t("invoices.number")}</th>
              <th scope="col" className="py-2 pe-3 text-start font-semibold">{t("invoices.issued")}</th>
              <th scope="col" className="py-2 pe-3 text-start font-semibold">{t("invoices.dueDate")}</th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold">{t("invoices.total")}</th>
              <th scope="col" className="py-2 pe-3 text-start font-semibold">{t("invoices.statusLabel")}</th>
              <th scope="col" className="py-2 text-end font-semibold">
                <span className="sr-only">{t("invoices.payLabel")}</span>
              </th>
              <th scope="col" className="py-2 text-end font-semibold">
                <span className="sr-only">{t("invoices.download")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-charcoal-80/5 last:border-0">
                <td className="py-3 pe-3 text-body font-medium text-charcoal-80">
                  {invoice.invoiceNumber}
                </td>
                <td className="py-3 pe-3 text-meta text-charcoal-80/70">
                  {invoice.issuedAt ? fmtDate.format(new Date(invoice.issuedAt)) : "—"}
                </td>
                <td className="py-3 pe-3 text-meta text-charcoal-80/70">
                  {invoice.dueDate ? fmtDay.format(new Date(invoice.dueDate)) : "—"}
                </td>
                <td className="py-3 pe-3 text-end text-body tabular-nums text-charcoal-80">
                  {money(invoice.totalAmount, invoice.currency)}
                </td>
                <td className="py-3 pe-3">
                  <Badge tone={STATUS_TONE[invoice.status] || "neutral"}>
                    {t(`invoices.status.${invoice.status}`, { defaultValue: invoice.status })}
                  </Badge>
                </td>
                <td className="py-3 text-end">
                  <PayAction invoice={invoice} onPay={onPay} t={t} />
                </td>
                <td className="py-3 text-end">
                  {invoice.downloadUrl ? (
                    <a
                      href={`${API_BASE_URL}${invoice.downloadUrl}`}
                      className="inline-flex items-center gap-1.5 text-meta font-medium text-violet underline-offset-2 hover:underline"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      {/* The visible text names the invoice: "Download PDF" ×6
                          in a row is six identical links to a screen reader
                          and to Lighthouse. */}
                      {t("invoices.downloadNamed", { number: invoice.invoiceNumber })}
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── T5-9 · pay ──────────────────────────────────────────────────────────
 *
 * Two shapes because the two surfaces genuinely differ, and the server said
 * which is which. The link needs no handler at all — that is the point of
 * routing a member to the page that already pays invoices.
 *
 * The visible text names the invoice. "Pay" ×6 down a column is six
 * identical links to a screen reader, and an aria-label does not satisfy
 * Lighthouse's link-text rule either.
 */
function PayAction({ invoice, onPay, t }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const pay = invoice.pay
  if (!pay) return null

  if (pay.mode === "link") {
    return (
      <LocalizedLink
        to={pay.url}
        className="inline-flex items-center gap-1.5 text-meta font-semibold text-violet underline-offset-2 hover:underline"
      >
        <CreditCard className="size-4" aria-hidden="true" />
        {t("invoices.payNamed", { number: invoice.invoiceNumber })}
      </LocalizedLink>
    )
  }

  const start = async () => {
    if (busy || !onPay) return
    setBusy(true); setError("")
    try {
      const url = await onPay(invoice.id)
      if (!url) throw new Error(t("invoices.payError"))
      // Leaving the app for the gateway, so `busy` is never cleared on the
      // success path — the button must not flicker back to "Pay" while the
      // browser is already navigating.
      window.location.href = url
    } catch (e) {
      setError(e?.message || t("invoices.payError"))
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-meta font-semibold text-white transition hover:bg-violet/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        {busy
          ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          : <CreditCard className="size-4" aria-hidden="true" />}
        {t("invoices.payNamed", { number: invoice.invoiceNumber })}
      </button>
      {error ? <span role="alert" className="text-micro text-[var(--color-feedback-danger-text)]">{error}</span> : null}
    </div>
  )
}
