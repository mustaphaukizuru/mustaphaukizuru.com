import { Navigate, Route, Routes } from "react-router-dom"

import PublicShell from "./layout/PublicShell"
import AuthLayout from "./layout/AuthLayout"
import AdminLayout from "./layout/AdminLayout"
import DashboardLayout from "./layout/DashboardLayout"
import ProjectDetailPage from "./pages/ProjectDetailPage"

import Home from "./pages/Home"
import AboutPage from "./pages/AboutPage"
import SolutionsPage from "./pages/SolutionsPage"
import ServicesPage from "./pages/ServicesPage"
import ContactPage from "./pages/ContactPage"

import Store from "./pages/Store"
import ProductDetail from "./pages/ProductDetail"
import CartPage from "./pages/CartPage"
import CheckoutPage from "./pages/CheckoutPage"
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage"

import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import ForgotPasswordPage from "./pages/ForgotPasswordPage"
import ResetPasswordPage from "./pages/ResetPasswordPage"

import DashboardPage from "./pages/DashboardPage"
import DashboardProductsPage from "./pages/DashboardProductsPage"
import DashboardOrdersPage from "./pages/DashboardOrdersPage"
import DashboardProfilePage from "./pages/DashboardProfilePage"
import ProtectedRoute from "./components/ProtectedRoute"

import AdminRoute from "./components/AdminRoute"
import AdminDashboardPage from "./pages/AdminDashboardPage"
import AdminProductsPage from "./pages/AdminProductsPage"
import AdminProductFormPage from "./pages/AdminProductFormPage"
import AdminOrdersPage from "./pages/AdminOrdersPage"
import AdminOrderDetailPage from "./pages/AdminOrderDetailPage"
import AdminDownloadsPage from "./pages/AdminDownloadsPage"
import AdminPaymentsPage from "./pages/AdminPaymentsPage"
import AdminCategoriesPage from "./pages/AdminCategoriesPage"
import AdminUsersPage from "./pages/AdminUsersPage"

import TermsPage from "./pages/TermsPage"
import PrivacyPage from "./pages/PrivacyPage"
import RefundPage from "./pages/RefundPage"
import NotFoundPage from "./pages/NotFoundPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicShell><Home /></PublicShell>} />
      <Route path="/home" element={<Navigate to="/" replace />} />

      <Route path="/about" element={<PublicShell><AboutPage /></PublicShell>} />
      <Route path="/solutions" element={<PublicShell><SolutionsPage /></PublicShell>} />
      <Route path="/services" element={<PublicShell><ServicesPage /></PublicShell>} />
      <Route path="/contact" element={<PublicShell><ContactPage /></PublicShell>} />
      <Route path="/projects/:slug" element={<ProjectDetailPage />} />
      <Route path="/store" element={<PublicShell><Store /></PublicShell>} />
      <Route path="/store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
      <Route path="/cart" element={<PublicShell><CartPage /></PublicShell>} />

      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/checkout/success/:orderId"
        element={
          <ProtectedRoute>
            <CheckoutSuccessPage />
          </ProtectedRoute>
        }
      />

      {/* AUTH PAGES - NO WEBSITE HEADER / FOOTER */}
      <Route
        path="/login"
        element={
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthLayout>
            <SignupPage />
          </AuthLayout>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <AuthLayout>
            <ForgotPasswordPage />
          </AuthLayout>
        }
      />
      <Route
        path="/reset-password/:token"
        element={
          <AuthLayout>
            <ResetPasswordPage />
          </AuthLayout>
        }
      />

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
        <Route path="orders" element={<DashboardOrdersPage />} />
        <Route path="profile" element={<DashboardProfilePage />} />
      </Route>

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
        <Route path="users" element={<AdminUsersPage />} />
      </Route>

      <Route path="/terms" element={<PublicShell><TermsPage /></PublicShell>} />
      <Route path="/privacy" element={<PublicShell><PrivacyPage /></PublicShell>} />
      <Route path="/refund" element={<PublicShell><RefundPage /></PublicShell>} />

      <Route path="*" element={<PublicShell><NotFoundPage /></PublicShell>} />
    </Routes>
  )
}