/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// Toast · system surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Ephemeral, non-blocking notification. Use for:
//   · "Saved", "Copied", "Sent" — quick confirmation of an async result
//   · Background errors that the user did not just act on
// Use InlineBanner for persistent, in-context messaging (form errors, page
// state). Use Modal for blocking decisions.
//
// Architecture:
//   <ToastProvider>            ← mount once near the root of <App />
//     <App />                  ← any descendant uses useToast()
//   </ToastProvider>
//
//   const toast = useToast()
//   toast.success("Profile updated")
//   toast.error("Could not save changes", { description: "Try again in a moment." })
//   toast.info("Reminder sent")
//   toast.warning("Session expires in 1 minute")
//
// Behaviours:
//   · Stacks bottom-right on desktop, full-width bottom on mobile.
//   · Auto-dismiss after 4.5s (configurable per-call via { duration: ms }).
//   · `duration: 0` keeps the toast until dismissed manually.
//   · Hover pauses the dismiss timer; mouse-leave resumes.
//   · Framer Motion stagger + slide; respects prefers-reduced-motion.
//   · `aria-live="polite"` (info/success) or `assertive` (warning/danger).
// ════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from "lucide-react"

import { useTranslation } from "react-i18next"
const TONE = {
  success: { icon: CheckCircle2, live: "polite", color: "text-[var(--color-feedback-success)]" },
  error: { icon: AlertOctagon, live: "assertive", color: "text-[var(--color-feedback-danger)]" },
  warning: { icon: AlertTriangle, live: "assertive", color: "text-[var(--color-feedback-warning)]" },
  info: { icon: Info, live: "polite", color: "text-[var(--color-feedback-info)]" },
}

const DEFAULT_DURATION = 4500

// ── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext(null)

/**
 * useToast() — returns a toast api with:
 *   toast.success(title, opts?)
 *   toast.error(title, opts?)
 *   toast.warning(title, opts?)
 *   toast.info(title, opts?)
 *   toast.dismiss(id)
 *   toast.dismissAll()
 *
 * opts:
 *   description? · string — secondary line below title
 *   duration?    · ms  (default 4500; 0 = persistent)
 *   action?      · { label: string, onClick: () => void }
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>")
  }
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children, max = 4 }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const dismissAll = useCallback(() => setToasts([]), [])

  const push = useCallback(
    (tone, title, opts = {}) => {
      idRef.current += 1
      const id = idRef.current
      const next = {
        id,
        tone,
        title,
        description: opts.description,
        duration: opts.duration ?? DEFAULT_DURATION,
        action: opts.action,
      }
      setToasts((prev) => {
        // Cap at `max` — drop the oldest first
        const capped = prev.length >= max ? prev.slice(prev.length - max + 1) : prev
        return [...capped, next]
      })
      return id
    },
    [max],
  )

  const api = useMemo(
    () => ({
      success: (title, opts) => push("success", title, opts),
      error: (title, opts) => push("error", title, opts),
      warning: (title, opts) => push("warning", title, opts),
      info: (title, opts) => push("info", title, opts),
      dismiss,
      dismissAll,
    }),
    [push, dismiss, dismissAll],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  )
}

// ── Viewport ───────────────────────────────────────────────────────────────
function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex flex-col items-stretch gap-2 px-4 pb-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end sm:px-0 sm:pb-0 sm:pr-0"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ── Single Toast ───────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const { t } = useTranslation("common")
  const { id, tone, title, description, duration, action } = toast
  const meta = TONE[tone] || TONE.info
  const Icon = meta.icon
  const reactId = useId()

  const timerRef = useRef(null)
  const startedAtRef = useRef(Date.now())
  const remainingRef = useRef(duration)

  // ── Auto-dismiss with pause-on-hover ────────────────────────────────────
  useEffect(() => {
    if (!duration) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => onDismiss(id), remainingRef.current)
    return () => clearTimeout(timerRef.current)
    // duration changes are extremely rare; safe to omit other deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  const onMouseEnter = () => {
    if (!duration) return
    clearTimeout(timerRef.current)
    remainingRef.current -= Date.now() - startedAtRef.current
  }
  const onMouseLeave = () => {
    if (!duration) return
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => onDismiss(id), Math.max(remainingRef.current, 1200))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live={meta.live}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="pointer-events-auto sm:w-[380px] w-full"
    >
      <div className="flex items-start gap-3 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 py-3 shadow-[var(--shadow-overlay)]">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.color}`} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title && (
            <p
              id={`${reactId}-t`}
              className="text-[14px] font-semibold leading-[1.4] text-[var(--color-text-primary)]"
            >
              {title}
            </p>
          )}
          {description && (
            <p className="mt-1 text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">
              {description}
            </p>
          )}
          {action && (
            <button
              type="button"
              onClick={() => {
                action.onClick?.()
                onDismiss(id)
              }}
              className="mt-2 text-[13px] font-semibold text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] underline-offset-2 hover:underline"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label={t("system.dismissNotif")}
          className="shrink-0 rounded-md p-1 -m-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors duration-[var(--motion-fast)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  )
}

export default ToastProvider
