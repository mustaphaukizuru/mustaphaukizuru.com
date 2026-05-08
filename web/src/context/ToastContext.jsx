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

const TOAST_STYLES = {
  success: {
    container: "border-green-200 bg-green-50 text-green-800",
    icon: "text-green-600",
    progress: "bg-green-500",
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-800",
    icon: "text-red-600",
    progress: "bg-red-500",
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-800",
    icon: "text-blue-600",
    progress: "bg-blue-500",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-800",
    icon: "text-amber-600",
    progress: "bg-amber-500",
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