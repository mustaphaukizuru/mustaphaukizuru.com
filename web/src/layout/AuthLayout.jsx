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
        background:
          "linear-gradient(145deg, var(--color-mist) 0%, #f0e9f3 50%, #EFF1F5 100%)",
      }}
    >
      {children}
    </div>
  )
}
