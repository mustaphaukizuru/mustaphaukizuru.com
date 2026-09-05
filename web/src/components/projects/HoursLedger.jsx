import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Clock, Download, ChevronDown, ChevronRight } from "lucide-react"
import { EmptyStateSurface, Spinner } from "../ui"
import { API_BASE_URL } from "../../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  HoursLedger · what a retainer client actually bought (T5-18)
 *
 *  A retainer ("iguala mensual") is a number of hours a month, and the client
 *  had no way to see how many were left. The answer lived in the operator's
 *  head — so the client either over-asks and is surprised by an invoice, or
 *  under-asks and quietly wastes what they already paid for. Both are worse
 *  than a number on a page.
 *
 *  THE CURRENT MONTH IS OPEN, THE REST ARE COLLAPSED
 *
 *  Everyone opening this is asking one question: how much is left THIS month.
 *  Older months are the record and are one click away.
 *
 *  A project with no allowance still gets a ledger. It shows the hours and
 *  says there is no monthly limit, rather than drawing a bar against zero —
 *  which would read as "you have used all of it".
 *  ──────────────────────────────────────────────────────────────── */

const monthLabel = (key, locale) => {
  try {
    // Midday UTC: a midnight instant lands on the previous day in every
    // negative-offset timezone, which renames the month.
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${key}-01T12:00:00Z`))
  } catch { return key }
}

/** The bar. Over-run is drawn past the line rather than clipped at it. */
function AllowanceBar({ used, included, t }) {
  if (included == null) return null
  const pct = Math.min(100, Math.round((used / included) * 100))
  const over = used > included
  return (
    <div className="mt-2">
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-charcoal-80/10"
        role="img"
        aria-label={t("projects.hours.barLabel", { used, included })}
      >
        <div
          className={`h-full rounded-full ${over ? "bg-amber" : "bg-violet"}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
    </div>
  )
}

function MonthBlock({ month, projectId, portal, open, onToggle, locale, t }) {
  const label = monthLabel(month.month, locale)
  const hasEntries = month.entries.length > 0
  const statementHref = `${(API_BASE_URL || "").replace(/\/$/, "")}${portal
    ? `/api/v1/portal/me/time/${month.month}/statement.pdf`
    : `/api/v1/member/projects/${encodeURIComponent(projectId)}/time/${month.month}/statement.pdf`}`

  return (
    <li className="rounded-lg border border-charcoal-80/10 bg-white p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-start"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-meta font-semibold text-charcoal-80">
            {open ? <ChevronDown className="size-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0" aria-hidden="true" />}
            <span className="capitalize">{label}</span>
          </div>
          <p className="mt-1 ps-5 text-micro text-charcoal-80/75">
            {month.includedHours == null
              ? t("projects.hours.usedOnly", { used: month.usedHours })
              : month.overHours > 0
                ? t("projects.hours.usedOver", { used: month.usedHours, included: month.includedHours, over: month.overHours })
                : t("projects.hours.usedOf", { used: month.usedHours, included: month.includedHours, remaining: month.remainingHours })}
            {month.nonBillableHours > 0
              ? ` · ${t("projects.hours.plusFree", { hours: month.nonBillableHours })}`
              : ""}
          </p>
        </div>
      </button>

      <div className="ps-5">
        <AllowanceBar used={month.usedHours} included={month.includedHours} t={t} />
      </div>

      {open ? (
        <div className="mt-3 ps-5">
          {hasEntries ? (
            <ul className="divide-y divide-charcoal-80/10">
              {month.entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="font-mono text-meta text-charcoal-80/65">{entry.date}</span>
                    <span className="ms-2 text-micro text-charcoal-80">
                      {entry.note || t("projects.hours.defaultNote")}
                    </span>
                  </div>
                  <span className={`shrink-0 font-mono text-micro tabular-nums ${entry.billable ? "text-charcoal-80" : "text-charcoal-80/65"}`}>
                    {t("projects.hours.hoursValue", { hours: entry.hours })}
                    {entry.billable ? "" : ` · ${t("projects.hours.noCharge")}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-micro text-charcoal-80/65">{t("projects.hours.emptyMonth")}</p>
          )}

          {hasEntries ? (
            <a
              href={statementHref}
              className="mt-2 inline-flex items-center gap-1.5 py-2 text-meta font-semibold text-violet underline-offset-2 hover:underline"
            >
              <Download className="size-4" aria-hidden="true" />
              {/* Named, because "Statement" ×6 down a page is six identical
                  links to a screen reader and to Lighthouse. */}
              {t("projects.hours.statementNamed", { month: label })}
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export default function HoursLedger({
  ledger = null,
  projectId,
  portal = false,
  loading = false,
  className = "",
}) {
  const { t, i18n } = useTranslation("dashboard")
  const locale = i18n.language?.startsWith("es") ? "es-MX" : "en-US"
  const months = useMemo(() => ledger?.months || [], [ledger])
  // The current month, which is the only one anybody opens this to read.
  const [openMonth, setOpenMonth] = useState(null)
  const current = months[0]?.month || null
  const openKey = openMonth === null ? current : openMonth

  if (loading) {
    return <div className={`flex items-center justify-center py-10 ${className}`}><Spinner /></div>
  }

  const anyHours = months.some((m) => m.entries.length > 0)
  if (!anyHours && !ledger?.allowance) {
    return (
      <EmptyStateSurface
        icon={Clock}
        title={t("projects.hours.empty")}
        description={t("projects.hours.emptyBody")}
        size="sm"
        className={className}
      />
    )
  }

  return (
    <div className={className}>
      <p className="mb-3 max-w-prose text-meta text-charcoal-80/75">
        {ledger?.allowance
          ? t("projects.hours.plan", {
            plan: (locale === "es-MX" && ledger.allowance.packageNameEs) || ledger.allowance.packageName,
            hours: ledger.allowance.includedHours,
          })
          : t("projects.hours.noPlan")}
      </p>
      <ul className="space-y-2" aria-label={t("projects.hours.title")}>
        {months.map((month) => (
          <MonthBlock
            key={month.month}
            month={month}
            projectId={projectId}
            portal={portal}
            locale={locale}
            t={t}
            open={openKey === month.month}
            onToggle={() => setOpenMonth(openKey === month.month ? "" : month.month)}
          />
        ))}
      </ul>
    </div>
  )
}

export { HoursLedger }
