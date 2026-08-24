/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// Toast · canonical re-export from components/system/Toast.jsx
//
// Provides ToastProvider + useToast. NOTE: a separate `Toaster` (sonner)
// already exists in ui/Toaster.jsx and is consumed by the root <App />.
// New code should pick ONE strategy per app and stick to it. The system
// ToastProvider is preferred for new screens going forward.
// ════════════════════════════════════════════════════════════════════════════

export { default as ToastProvider, useToast } from "../system/Toast"
