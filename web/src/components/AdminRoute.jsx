import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function AdminRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-4 border-violet-pale" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-violet" />
          </div>
          <span className="text-micro font-medium text-charcoal-80/65">Loading admin…</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />
  return children
}
