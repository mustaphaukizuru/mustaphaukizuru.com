/* ════════════════════════════════════════════════════════════════════════
   MenuContext · v1.0 · lifts mobile menu state out of <Header>
   ────────────────────────────────────────────────────────────────────────
   Why this exists:
     · Other components beyond <Header> need to programmatically open the
       mobile menu — e.g., a "Need help?" inline button on a 404 page that
       should open the menu rather than route to /contact. Without a
       shared context, those components would have to drill props through
       multiple layers or fire DOM events.
     · The menu's open/close state is global UI state, not a Header detail.
       Co-locating it with the Header tied the menu's lifecycle to where
       it was rendered, not where it conceptually belongs.

   API:
     useMenu() returns:
       { mobileOpen, openMobileMenu, closeMobileMenu, toggleMobileMenu }

   Single source of truth — mounted once near the top of the app tree
   (see web/src/main.jsx). The provider also forwards the dismiss method
   ("x_button" | "backdrop" | "esc" | "scroll" | "route_change" | "toggle")
   so telemetry can attribute close events to the right gesture without
   passing the method through every closer.
   ════════════════════════════════════════════════════════════════════════ */

import { createContext, useCallback, useContext, useMemo, useState } from "react"

const MenuContext = createContext(null)

export function MenuProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  // Last-dismiss method, for telemetry. Read once after close, then reset.
  const [lastDismissMethod, setLastDismissMethod] = useState(null)

  const openMobileMenu = useCallback(() => {
    setMobileOpen(true)
    setLastDismissMethod(null)
  }, [])

  // `method` is one of: "x_button" | "backdrop" | "esc" | "scroll" |
  // "route_change" | "toggle" | "sign_out" | "nav_click"
  const closeMobileMenu = useCallback((method = "unknown") => {
    setLastDismissMethod(method)
    setMobileOpen(false)
  }, [])

  const toggleMobileMenu = useCallback(() => {
    setMobileOpen((o) => {
      if (o) setLastDismissMethod("toggle")
      return !o
    })
  }, [])

  const value = useMemo(
    () => ({
      mobileOpen,
      openMobileMenu,
      closeMobileMenu,
      toggleMobileMenu,
      lastDismissMethod,
    }),
    [mobileOpen, openMobileMenu, closeMobileMenu, toggleMobileMenu, lastDismissMethod]
  )

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

export function useMenu() {
  const ctx = useContext(MenuContext)
  if (!ctx) {
    // Soft-fail in case a component mounts before the provider (early
    // boot). Returns a no-op shape so callers don't need null-checks.
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[MenuContext] useMenu called without MenuProvider. Returning no-op.")
    }
    return {
      mobileOpen: false,
      openMobileMenu: () => {},
      closeMobileMenu: () => {},
      toggleMobileMenu: () => {},
      lastDismissMethod: null,
    }
  }
  return ctx
}
