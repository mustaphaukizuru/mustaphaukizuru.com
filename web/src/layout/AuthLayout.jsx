/**
 * AuthLayout · F09 · Batch 1
 *
 * Shared shell for the auth routes (/login, /signup, /forgot-password,
 * /reset-password). Provides the soft brand-aligned gradient background.
 *
 * The 50/50 split layout (brand panel · form panel) lives inside each auth
 * page so individual pages can replace the form panel with a 2FA prompt
 * (LoginPage) or a success card (ForgotPasswordPage / ResetPasswordPage)
 * without touching the layout.
 */
export default function AuthLayout({ children }) {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        // Brand v3.1 · violet-tinted dawn wash. All three stops now flow
        // from the canonical palette (mist → violet-ghost → slate-100)
        // so the auth surface stays brand-locked when @theme updates.
        background:
          "linear-gradient(145deg, var(--color-mist) 0%, var(--color-violet-ghost) 50%, var(--color-slate-100) 100%)",
      }}
    >
      {children}
    </div>
  )
}
