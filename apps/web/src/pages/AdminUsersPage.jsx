import { useEffect, useState } from "react"
import { Users, Shield, User, UserCheck, RefreshCw } from "lucide-react"
import { MetricCard, StatusBadge, SectionCard, SkeletonCard, AlertBanner, TableWrapper, TableHead, EmptyState } from "../components/ui/index"
import { fetchAdminUsers } from "../services/adminUserService"

export default function AdminUsersPage() {
  const [data,    setData]    = useState({ users: [], metrics: {} })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminUsers()
      setData(result)
    } catch (err) {
      setError(err.message || "Failed to load users.")
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

  const { users = [], metrics = {} } = data

  return (
    <section className="space-y-5">
      <AlertBanner type="error" message={error} onDismiss={() => setError("")} />

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Total Users"  value={metrics.total   ?? 0} icon={Users}     tone="purple" />
        <MetricCard title="Admins"       value={metrics.admins  ?? 0} icon={Shield}     tone="blue"   />
        <MetricCard title="Members"      value={metrics.members ?? 0} icon={User}       tone="amber"  />
        <MetricCard title="Active"       value={metrics.active  ?? 0} icon={UserCheck}  tone="green"  />
      </div>

      {/* User table */}
      <SectionCard
        title={`All Users (${users.length})`}
        subtitle="Registered accounts, roles, and account status."
        action={
          <button type="button" onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-[#634F40]/10 bg-[#f7f4f8] px-3 py-2 text-[12px] font-medium text-[#420060] transition hover:bg-[#ede4ef]">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      >
        {users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" description="Registered users will appear here." />
        ) : (
          <TableWrapper>
            <TableHead columns={["Name", "Email", "Role", "Status", "Orders", "Joined"]} />
            <tbody className="divide-y divide-[#634F40]/6">
              {users.map((user) => (
                <tr key={user.id} className="transition hover:bg-[#faf8fb]">
                  <td className="px-4 py-3.5 font-medium text-[#420060]">{user.fullName || "—"}</td>
                  <td className="px-4 py-3.5 text-[#634F40]/70">{user.email}</td>
                  <td className="px-4 py-3.5"><StatusBadge status={user.role} /></td>
                  <td className="px-4 py-3.5"><StatusBadge status={user.status || "active"} /></td>
                  <td className="px-4 py-3.5 text-[#634F40]/70">{user._count?.orders ?? 0}</td>
                  <td className="px-4 py-3.5 text-[#634F40]/55 text-[12px]">
                    {new Date(user.createdAt).toLocaleDateString()}
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
