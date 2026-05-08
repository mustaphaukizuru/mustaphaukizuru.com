import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"
import { CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react"

import { friendlyMessage } from "../../lib/sanitize"

/**
 * Toaster · brand-styled wrapper around sonner
 *
 * Mount ONCE at the root of the app (App.jsx) so toasts can be triggered
 * from anywhere via the `toast` helpers below.
 *
 * Rules of engagement:
 *   • toast.success("Saved.")
 *   • toast.error(err)            ← accepts AppError, Error, or string
 *   • toast.info("FYI…")
 *   • toast.loading("Uploading…", { id: "upload" }) → toast.success("Done.", { id: "upload" })
 *   • Always sanitise — error messages from the server pass through
 *     friendlyMessage() so ANSI/Prisma spew never reaches users.
 *
 * Visual: rounded-2xl, soft shadow, brand colours, 4 accent strips
 * (success mint, error rose, info azure, default violet).
 */

/* ─────────────────────────── public Toaster JSX ────────────────────────── */

export default function Toaster() {
  return (
    <SonnerToaster
      richColors={false}
      closeButton
      position="top-right"
      offset={20}
      duration={4200}
      visibleToasts={4}
      gap={10}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group !pointer-events-auto !rounded-2xl !border !border-charcoal-80/10 " +
            "!bg-white/95 !shadow-[0_18px_50px_-12px_rgba(93,63,211,0.18),0_2px_8px_rgba(0,0,0,0.04)] " +
            "!backdrop-blur-md !text-charcoal-80 !p-4 !text-[13.5px] !font-medium",
          title: "!font-semibold !text-charcoal !leading-snug",
          description: "!mt-1 !text-[12.5px] !text-charcoal-80/70",
          actionButton:
            "!rounded-full !bg-violet !px-3 !py-1 !text-[12px] !font-semibold !text-white hover:!bg-violet-deep",
          cancelButton:
            "!rounded-full !bg-charcoal-80/5 !px-3 !py-1 !text-[12px] !font-medium !text-charcoal-80",
          closeButton:
            "!h-6 !w-6 !rounded-full !bg-charcoal-80/5 !text-charcoal-80/55 hover:!text-charcoal-80",
          success: "before:!absolute before:!inset-y-0 before:!left-0 before:!w-1 before:!rounded-l-2xl before:!bg-mint",
          error: "before:!absolute before:!inset-y-0 before:!left-0 before:!w-1 before:!rounded-l-2xl before:!bg-rose",
          info: "before:!absolute before:!inset-y-0 before:!left-0 before:!w-1 before:!rounded-l-2xl before:!bg-azure",
          loading: "before:!absolute before:!inset-y-0 before:!left-0 before:!w-1 before:!rounded-l-2xl before:!bg-violet",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-4.5 w-4.5 text-mint" strokeWidth={2.2} />,
        error: <AlertCircle className="h-4.5 w-4.5 text-rose" strokeWidth={2.2} />,
        info: <Info className="h-4.5 w-4.5 text-azure" strokeWidth={2.2} />,
        loading: <Loader2 className="h-4.5 w-4.5 animate-spin text-violet" strokeWidth={2.2} />,
      }}
    />
  )
}

/* ───────────────────────── safe toast helpers ──────────────────────────── */

/**
 * Coerce any throwable into a clean, length-capped, user-safe string.
 * Accepts AppError (uses .toUserMessage), Error, plain string, or unknown.
 */
function safeMessage(input, fallback = "Something went wrong.") {
  if (!input) return fallback
  if (typeof input === "string") return friendlyMessage(input, fallback)
  if (typeof input === "object") {
    if (typeof input.toUserMessage === "function") return input.toUserMessage()
    if (typeof input.message === "string") return friendlyMessage(input.message, fallback)
  }
  return fallback
}

/**
 * `toast` is a thin proxy over sonner that always sanitises error messages.
 * Use these instead of importing sonner directly anywhere in the app.
 */
export const toast = {
  success: (message, opts) => sonnerToast.success(safeMessage(message, "Done."), opts),
  error: (message, opts) => sonnerToast.error(safeMessage(message, "Something went wrong."), opts),
  info: (message, opts) => sonnerToast.info(safeMessage(message, ""), opts),
  warning: (message, opts) => sonnerToast.warning(safeMessage(message, ""), opts),
  loading: (message, opts) => sonnerToast.loading(safeMessage(message, "Working…"), opts),
  message: (message, opts) => sonnerToast(safeMessage(message, ""), opts),
  dismiss: (id) => sonnerToast.dismiss(id),
  promise: (promise, msgs = {}) =>
    sonnerToast.promise(promise, {
      loading: safeMessage(msgs.loading, "Working…"),
      success: (data) =>
        typeof msgs.success === "function" ? safeMessage(msgs.success(data), "Done.") : safeMessage(msgs.success, "Done."),
      error: (err) =>
        typeof msgs.error === "function" ? safeMessage(msgs.error(err), "Something went wrong.") : safeMessage(err, "Something went wrong."),
    }),
}
