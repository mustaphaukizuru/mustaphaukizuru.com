import { Outlet, useLocation } from "react-router-dom"
import AdminSidebar from "../components/admin/AdminSidebar"
import AdminHeader from "../components/admin/AdminHeader"

// ─────────────────────────────────────────────────────────────────────────────
// Page metadata — title + subtitle for every admin route
// ─────────────────────────────────────────────────────────────────────────────
const pageMeta = {
  "/admin": {
    title: "Dashboard",
    subtitle: "Track revenue, orders, products, downloads, and customer activity.",
  },
  "/admin/orders": {
    title: "Orders",
    subtitle: "Review purchases, customer records, and order state updates.",
  },
  "/admin/products": {
    title: "Products",
    subtitle: "Manage catalog items, media, files, and publication settings.",
  },
  "/admin/downloads": {
    title: "Downloads",
    subtitle: "Monitor digital delivery and member download activity.",
  },
  "/admin/payments": {
    title: "Payments",
    subtitle: "Track gateway activity, transaction references, and payment states.",
  },
  "/admin/categories": {
    title: "Categories",
    subtitle: "Review category usage and organize your product catalog.",
  },
  "/admin/services": {
    title: "Services",
    subtitle: "Manage consulting services, packages, and service order delivery.",
  },
  "/admin/support": {
    title: "Support Tickets",
    subtitle: "Handle member requests, reply to tickets, and track resolution.",
  },
  "/admin/pages": {
    title: "Pages",
    subtitle: "Manage CMS content, legal pages, and published site content.",
  },
  "/admin/media": {
    title: "Media Library",
    subtitle: "Upload and manage images, documents, and digital assets.",
  },
  "/admin/email-templates": {
    title: "Email Templates",
    subtitle: "Configure transactional email templates for platform events.",
  },
  "/admin/users": {
    title: "Users",
    subtitle: "Review members, admins, roles, and account activity.",
  },
  "/admin/audit": {
    title: "Audit Log",
    subtitle: "View append-only records of admin actions and platform events.",
  },
}

function resolveMeta(pathname) {
  if (pageMeta[pathname]) return pageMeta[pathname]
  if (pathname.startsWith("/admin/products/")) {
    return {
      title: "Product Editor",
      subtitle: "Create or update product content, media, and downloadable files.",
    }
  }
  if (pathname.startsWith("/admin/orders/")) {
    return {
      title: "Order Detail",
      subtitle: "Inspect customer information, items, and order history.",
    }
  }
  if (pathname.startsWith("/admin/support/")) {
    return {
      title: "Support Thread",
      subtitle: "Review and reply to this support ticket.",
    }
  }
  return {
    title: "Admin",
    subtitle: "Manage your platform operations.",
  }
}

export default function AdminLayout() {
  const location = useLocation()
  const currentMeta = resolveMeta(location.pathname)

  return (
    <section className="min-h-screen bg-[#f7f9f4]">
      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-5 lg:px-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[300px_1fr]">

          {/* Sidebar */}
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <AdminSidebar />
          </div>

          {/* Main content */}
          <div className="min-w-0">
            <div className="sticky top-4 z-20">
              <AdminHeader
                title={currentMeta.title}
                subtitle={currentMeta.subtitle}
                pathname={location.pathname}
              />
            </div>

            <main className="mt-4 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </section>
  )
}
