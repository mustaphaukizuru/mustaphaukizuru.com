import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LoadingScreen from "./components/LoadingScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import SeoRouteManager from "./components/SeoRouteManager";

import PublicShell from "./layout/PublicShell";
import AuthLayout from "./layout/AuthLayout";
import AdminLayout from "./layout/AdminLayout";
import DashboardLayout from "./layout/DashboardLayout";

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-xl border-4 border-[#ede4ef] border-t-[#420060]" />
    </div>
  );
}

// Public pages
const Home = lazy(() => import("./pages/Home"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SolutionsPage = lazy(() => import("./pages/SolutionsPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const Store = lazy(() => import("./pages/Store"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("./pages/CheckoutSuccessPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RefundPage = lazy(() => import("./pages/RefundPage"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));

// Auth pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

// Member dashboard pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DashboardProductsPage = lazy(() => import("./pages/DashboardProductsPage"));
const DashboardDownloadsPage = lazy(() => import("./pages/DashboardDownloadsPage"));
const DashboardOrdersPage = lazy(() => import("./pages/DashboardOrdersPage"));
const DashboardSupportPage = lazy(() => import("./pages/DashboardSupportPage"));
const DashboardProfilePage = lazy(() => import("./pages/DashboardProfilePage"));

// Admin pages
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage"));
const AdminProductFormPage = lazy(() => import("./pages/AdminProductFormPage"));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage"));
const AdminOrderDetailPage = lazy(() => import("./pages/AdminOrderDetailPage"));
const AdminDownloadsPage = lazy(() => import("./pages/AdminDownloadsPage"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPaymentsPage"));
const AdminCategoriesPage = lazy(() => import("./pages/AdminCategoriesPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminServicesPage = lazy(() => import("./pages/AdminServicesPage"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const AdminPagesPage = lazy(() => import("./pages/AdminPagesPage"));
const AdminMediaPage = lazy(() => import("./pages/AdminMediaPage"));
const AdminEmailTemplatesPage = lazy(() => import("./pages/AdminEmailTemplatesPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));

export default function App() {
  const [appReady, setAppReady] = useState(false);

  return (
    <>
      {!appReady && <LoadingScreen onFinish={() => setAppReady(true)} />}

      <div style={{ opacity: appReady ? 1 : 0, transition: "opacity 0.3s ease" }}>
        <Suspense fallback={<PageLoader />}>
          <SeoRouteManager />

          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<PublicShell><AboutPage /></PublicShell>} />
            <Route path="/solutions" element={<PublicShell><SolutionsPage /></PublicShell>} />
            <Route path="/services" element={<PublicShell><ServicesPage /></PublicShell>} />
            <Route path="/contact" element={<PublicShell><ContactPage /></PublicShell>} />
            <Route path="/projects/:slug" element={<PublicShell><ProjectDetailPage /></PublicShell>} />
            <Route path="/store" element={<PublicShell><Store /></PublicShell>} />
            <Route path="/store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
            <Route path="/cart" element={<PublicShell><CartPage /></PublicShell>} />

            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <PublicShell>
                    <CheckoutPage />
                  </PublicShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout/success/:orderId"
              element={
                <ProtectedRoute>
                  <PublicShell>
                    <CheckoutSuccessPage />
                  </PublicShell>
                </ProtectedRoute>
              }
            />

            <Route path="/terms" element={<PublicShell><TermsPage /></PublicShell>} />
            <Route path="/privacy" element={<PublicShell><PrivacyPage /></PublicShell>} />
            <Route path="/refund" element={<PublicShell><RefundPage /></PublicShell>} />

            {/* Auth */}
            <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
            <Route path="/signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
            <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
            <Route path="/reset-password/:token" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />

            {/* Member dashboard */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<DashboardProductsPage />} />
              <Route path="downloads" element={<DashboardDownloadsPage />} />
              <Route path="orders" element={<DashboardOrdersPage />} />
              <Route path="support" element={<DashboardSupportPage />} />
              <Route path="profile" element={<DashboardProfilePage />} />
            </Route>

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:id" element={<AdminOrderDetailPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="products/new" element={<AdminProductFormPage />} />
              <Route path="products/:id/edit" element={<AdminProductFormPage />} />
              <Route path="downloads" element={<AdminDownloadsPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="services" element={<AdminServicesPage />} />
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="pages" element={<AdminPagesPage />} />
              <Route path="media" element={<AdminMediaPage />} />
              <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<PublicShell><ErrorPage type="404" /></PublicShell>} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}