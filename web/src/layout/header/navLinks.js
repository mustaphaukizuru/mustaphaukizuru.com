// ════════════════════════════════════════════════════════════════════════════
// layout/header/navLinks.js · shared nav data for Header + MobileMenu
// ════════════════════════════════════════════════════════════════════════════
import {
  LayoutDashboard,
  ShoppingBag,
  UserCog,
  Home as HomeIcon,
  User,
  Briefcase,
  Mail,
} from "lucide-react"

/* Primary navbar links — kept short and audience-facing. Editorial
 * surfaces (Blog) live in the Footer instead, so the
 * header stays focused on what visitors hire Mustapha for.
 *
 * Each link carries a Lucide icon — used by the mobile menu cascade
 * so visitors scan by glyph rather than reading every label. Desktop
 * navbar still renders text-only since the row is dense enough that
 * additional icons add noise instead of clarity. */
export const NAV_LINKS = [
  { nameKey: "header.home",      to: "/",          icon: HomeIcon },
  { nameKey: "header.about",     to: "/about",     icon: User,
    prefetch: () => import("../../pages/AboutPage") },
  { nameKey: "header.services",  to: "/services",  icon: Briefcase,
    prefetch: () => import("../../pages/ServicesPage") },
  { nameKey: "header.contact",   to: "/contact",   icon: Mail,
    prefetch: () => import("../../pages/ContactPage") },
]

export const USER_MENU_ITEMS = [
  { nameKey: "header.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { nameKey: "header.myOrders", to: "/dashboard/orders", icon: ShoppingBag },
  { nameKey: "header.downloads", to: "/dashboard/downloads", icon: ShoppingBag },
  { nameKey: "header.profile", to: "/dashboard/profile", icon: UserCog },
]

