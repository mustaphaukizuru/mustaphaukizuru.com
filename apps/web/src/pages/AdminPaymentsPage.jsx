import { useEffect, useState } from "react"
import { CreditCard, CheckCircle2, Clock3, XCircle, RefreshCw } from "lucide-react"
import { MetricCard, StatusBadge, SectionCard, SkeletonCard, AlertBanner, TableWrapper, TableHead, EmptyState } from "../components/ui/index"
import { fetchAdminPayments } from "../services/adminPaymentService"

// Gateway display helpers
const GATEWAY_LABELS = { mercadopago: "Mercado Pago", paypal: "PayPal" }
const GATEWAY_COLORS = { mercadopago: "bg-[#e0f5ff] text-[#0369a1]", paypal: "bg-[#eef2ff] text-[#3730a3]" }

function GatewayBadge({ gw }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${GATEWAY_COLORS[gw] || "bg-[#f2f2f2] text-[#555]"}`}>
      {GATEWAY_LABELS[gw] || gw || "—"}
    </span>
  )
}

export default function AdminPaymentsPage() {
  const [data,    setData]    = useState({ payments: [], metrics: {} })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminPayments()
      setData(result)
    } catch (err) {
      setError(err.message || "Failed to load payments.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
      <SkeletonCard height="h-80" />
    </section>
  )

  const { payments = [], metrics = {} } = data

  return (
    <section className="space-y-5">
      <AlertBanner type="error" message={error} onDismiss={() => setError("")} />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Total"   value={metrics.total   ?? 0} icon={CreditCard}   tone="purple" />
        <MetricCard title="Paid"    value={metrics.paid    ?? 0} icon={CheckCircle2} tone="green"  />
        <MetricCard title="Pending" value={metrics.pending ?? 0} icon={Clock3}       tone="amber"  />
        <MetricCard title="Failed"  value={metrics.failed  ?? 0} icon={XCircle}      tone="red"    />
      </div>

      <SectionCard
        title={`Payment Records (${payments.length})`}
        subtitle="Gateway transactions, statuses, and order references."
        action={
          <button type="button" onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/10 bg-[#f7f4f8] px-3 py-2 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef]">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      >
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments yet" description="Payment records will appear here after transactions." />
        ) : (
          <TableWrapper>
            <TableHead columns={["Order", "Customer", "Gateway", "Amount", "Status", "Date"]} />
            <tbody className="divide-y divide-[#634F40]/6">
              {payments.map((p) => (
                <tr key={p.id} className="transition hover:bg-[#faf8fb]">
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-[#420060] text-[12px]">
                      {p.order?.orderNumber || p.orderId?.slice(0, 8) || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[#634F40]/70">
                    {p.user?.fullName || p.user?.email || "—"}
                  </td>
                  <td className="px-4 py-3.5"><GatewayBadge gw={p.paymentGateway} /></td>
                  <td className="px-4 py-3.5 font-semibold text-[#420060]">
                    ${Number(p.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={p.paymentStatus} /></td>
                  <td className="px-4 py-3.5 text-[#634F40]/55 text-[12px]">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </SectionCard>
    </section>
  )
}
