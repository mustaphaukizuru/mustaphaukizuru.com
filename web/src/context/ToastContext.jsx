import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { CheckCircle2, AlertCircle, Info, TriangleAlert, X } from "lucide-react"

import { useTranslation } from "react-i18next"
const ToastContext = createContext(null)

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: TriangleAlert,
}

// Brand v3 §05 semantic feedback tokens. Each toast type maps to its
// canonical tier — Mint (success) · Rose (error) · Azure (info) · Amber
// (warning) — using brand opacity utilities rather than Tailwind's default
// green/blue/red scales. Matches the chip pattern established across
// dashboard + admin pages so toast surfaces feel native to the system.
const TOAST_STYLES = {
  success: {
    container: "border-mint/20 bg-mint/10 text-emerald-800",
    icon: "text-emerald-700",
    progress: "bg-mint",
  },
  error: {
    container: "border-rose/20 bg-rose/10 text-rose-800",
    icon: "text-rose-700",
    progress: "bg-rose",
  },
  info: {
    container: "border-azure/20 bg-azure-pale text-azure-800",
    icon: "text-azure",
    progress: "bg-azure",
  },
  warning: {
    container: "border-amber/20 bg-amber/10 text-amber-700",
    icon: "text-amber-700",
    progress: "bg-amber",
  },
}

function ToastItem({ toast, onClose }) {
  const Icon = TOAST_ICONS[toast.type] || Info
  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border px-4 py-3 shadow-[0_10px_28px_rgba(93,63,211,0.10)] backdrop-blur-sm ${style.container}`}
    >
      <div className="flex items-start gap-3 pr-8">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />

        <div className="min-w-0 flex-1">
          {toast.title ? (
            <div className="text-meta font-semibold">{toast.title}</div>
          ) : null}
          <div className="text-micro leading-5">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={() => onClose(toast.id)}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-xl text-current/70 transition hover:bg-black/5 hover:text-current"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className={`h-full ${style.progress}`}
          style={{
            width: "100%",
            animation: `toast-shrink ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    ({ type = "info", title = "", message = "", duration = 3500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const toast = { id, type, title, message, duration }

      setToasts((current) => [...current, toast])

      window.setTimeout(() => {
        removeToast(id)
      }, duration)

      return id
    },
    [removeToast]
  )

  const api = useMemo(
    () => ({
      showToast,
      showSuccess: (message, title = "Success") =>
        showToast({ type: "success", title, message }),
      showError: (message, title = "Error") =>
        showToast({ type: "error", title, message, duration: 4500 }),
      showInfo: (message, title = "Info") =>
        showToast({ type: "info", title, message }),
      showWarning: (message, title = "Warning") =>
        showToast({ type: "warning", title, message }),
      removeToast,
    }),
    [showToast, removeToast]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-[380px] flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider")
  }

  return context
}