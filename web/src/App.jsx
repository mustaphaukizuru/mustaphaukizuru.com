import { lazy, Suspense, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LoadingScreen from "./components/LoadingScreen";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import SeoRouteManager from "./components/SeoRouteManager";
import ScrollToTopOnNavigate from "./components/ScrollToTopOnNavigate";
import AnalyticsTracker from "./components/AnalyticsTracker";
import SearchPalette from "./components/SearchPalette"; // #6
import CartDrawer from "./components/CartDrawer"; // #2
import CompareBar from "./components/CompareBar"; // #3
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary"; // V2, top-level safety net
import Toaster from "./components/ui/Toaster"; // V2, sonner-based toasts
import CookieBanner from "./components/cookies/CookieBanner";
import LanguageWrapper from "./components/LanguageWrapper"; // I18N02 · URL→i18n sync + layout for /es routes
import { CookieConsentProvider } from "./context/CookieConsentContext";

import PublicShell from "./layout/PublicShell";
import AuthLayout from "./layout/AuthLayout";
import AdminLayout from "./layout/AdminLayout";
import DashboardLayout from "./layout/DashboardLayout";

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-xl border-4 border-violet-pale border-t-violet" />
    </div>
  );
}

// Public pages
const Home = lazy(() => import("./pages/Home"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SolutionsPage = lazy(() => import("./pages/SolutionsPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));

const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const AdminPortfolioPage = lazy(() => import("./pages/AdminPortfolioPage"));
const AdminPortfolioFormPage = lazy(() => import("./pages/AdminPortfolioFormPage"));
const AdminBioPage = lazy(() => import("./pages/AdminBioPage")); // M12
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage")); // M14

const ContactPage = lazy(() => import("./pages/ContactPage"));
const ProjectDetailPage = lazy(() => import("./pages/ProjectDetailPage"));
const Store = lazy(() => import("./pages/Store"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("./pages/CheckoutSuccessPage"));
const ServicesCheckoutPage = lazy(() => import("./pages/ServicesCheckoutPage")); // Choose Plan flow
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RefundPage = lazy(() => import("./pages/RefundPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const RecommendationsPage = lazy(() => import("./pages/RecommendationsPage"));
const RecommendationDetailPage = lazy(() => import("./pages/RecommendationDetailPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const UnsubscribedPage = lazy(() => import("./pages/UnsubscribedPage"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
const BookConsultationPage = lazy(() => import("./pages/BookConsultationPage"));

// Internal · design-system preview catalogue (always registered, gated
// inside the page itself — see SystemPreviewPage.jsx).
const SystemPreviewPage = lazy(() => import("./pages/SystemPreviewPage"));

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
const DashboardServiceOrdersPage = lazy(() => import("./pages/DashboardServiceOrdersPage")); // #5
const ComparePage = lazy(() => import("./pages/ComparePage")); // #3
const DashboardProfilePage = lazy(() => import("./pages/DashboardProfilePage"));
const DashboardConsultationsPage = lazy(() => import("./pages/DashboardConsultationsPage"));
const DashboardWishlistPage = lazy(() => import("./pages/DashboardWishlistPage"));
const DashboardAddressesPage = lazy(() => import("./pages/DashboardAddressesPage"));
const Dashboard2FAPage = lazy(() => import("./pages/Dashboard2FAPage"));
const DashboardProjectsPage = lazy(() => import("./pages/DashboardProjectsPage")); // #8
const DashboardProjectDetailPage = lazy(() => import("./pages/DashboardProjectDetailPage")); // #8

// Admin pages
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage"));
const AdminProductFormPage = lazy(() => import("./pages/AdminProductFormPage"));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage"));
const AdminOrderDetailPage = lazy(() => import("./pages/AdminOrderDetailPage"));
const AdminDownloadsPage = lazy(() => import("./pages/AdminDownloadsPage"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPaymentsPage"));
const AdminCategoriesPage = lazy(() => import("./pages/AdminCategoriesPage"));
const AdminCouponsPage = lazy(() => import("./pages/AdminCouponsPage"));
const AdminContactsPage = lazy(() => import("./pages/AdminContactsPage"));
const AdminNewsletterPage = lazy(() => import("./pages/AdminNewsletterPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminServicesPage = lazy(() => import("./pages/AdminServicesPage"));
const AdminServicePlansPage = lazy(() => import("./pages/AdminServicePlansPage"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const AdminPagesPage = lazy(() => import("./pages/AdminPagesPage"));
const AdminMediaPage = lazy(() => import("./pages/AdminMediaPage"));
const AdminEmailTemplatesPage = lazy(() => import("./pages/AdminEmailTemplatesPage"));
const AdminEmailLogsPage = lazy(() => import("./pages/AdminEmailLogsPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminAvailabilityPage = lazy(() => import("./pages/AdminAvailabilityPage"));

// Phase A · Booking + service-order management (full backend)
const AdminConsultationsPage = lazy(() => import("./pages/AdminConsultationsPage"));
const AdminServiceOrdersPage = lazy(() => import("./pages/AdminServiceOrdersPage"));
const AdminClientProjectsPage = lazy(() => import("./pages/AdminClientProjectsPage")); // #8
const AdminClientProjectDetailPage = lazy(() => import("./pages/AdminClientProjectDetailPage")); // #8

// Phase B · Placeholders (backend pending — see each page for the API plan)
const AdminReviewsPage = lazy(() => import("./pages/AdminReviewsPage"));
const AdminRecommendationsPage = lazy(() => import("./pages/AdminRecommendationsPage"));
const AdminRefundsPage = lazy(() => import("./pages/AdminRefundsPage"));
const AdminRolesPage = lazy(() => import("./pages/AdminRolesPage"));
const AdminSessionsPage = lazy(() => import("./pages/AdminSessionsPage"));

// M16 · Blog admin
const AdminBlogPage = lazy(() => import("./pages/AdminBlogPage"));
const AdminBlogFormPage = lazy(() => import("./pages/AdminBlogFormPage"));

// M19 · Marketing campaigns
const AdminCampaignsPage = lazy(() => import("./pages/AdminCampaignsPage"));
const AdminCampaignFormPage = lazy(() => import("./pages/AdminCampaignFormPage"));

export default function App() {
  const [appReady, setAppReady] = useState(false);

  return (
    <ErrorBoundary>
      <CookieConsentProvider>
      {!appReady && <LoadingScreen onFinish={() => setAppReady(true)} />}

      <div style={{ opacity: appReady ? 1 : 0, pointerEvents: appReady ? "auto" : "none", transition: "opacity 0.3s ease" }}>
        <Toaster />
        <CookieBanner />
        <Suspense fallback={<PageLoader />}>
          <LanguageWrapper>
          <SeoRouteManager />
          <ScrollToTopOnNavigate />
      <AnalyticsTracker />
      <SearchPalette />
      <CartDrawer />
      <CompareBar />
          <ScrollToTop />

          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<PublicShell><AboutPage /></PublicShell>} />
            <Route path="/solutions" element={<PublicShell><SolutionsPage /></PublicShell>} />
            <Route path="/services" element={<PublicShell><ServicesPage /></PublicShell>} />
            <Route path="/services/:slug" element={<PublicShell><ServiceDetailPage /></PublicShell>} />
            <Route path="/contact" element={<PublicShell><ContactPage /></PublicShell>} />
            <Route path="/portfolio" element={<PublicShell><PortfolioPage /></PublicShell>} />
            <Route path="/projects/:slug" element={<PublicShell><ProjectDetailPage /></PublicShell>} />
            <Route path="/store" element={<PublicShell><Store /></PublicShell>} />
            <Route path="/store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
            <Route path="/cart" element={<PublicShell><CartPage /></PublicShell>} />
            <Route path="/compare" element={<PublicShell><ComparePage /></PublicShell>} />
            <Route path="/unsubscribed" element={<PublicShell><UnsubscribedPage /></PublicShell>} />

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
            {/* Services "Choose Plan" checkout, guest-friendly, no auth wrapper */}
            <Route
              path="/checkout/service"
              element={<PublicShell><ServicesCheckoutPage /></PublicShell>}
            />

            <Route path="/terms" element={<PublicShell><TermsPage /></PublicShell>} />
            <Route path="/privacy" element={<PublicShell><PrivacyPage /></PublicShell>} />
            <Route path="/refund" element={<PublicShell><RefundPage /></PublicShell>} />
            <Route path="/cookies" element={<PublicShell><CookiePolicyPage /></PublicShell>} />
            <Route path="/recommendations" element={<PublicShell><RecommendationsPage /></PublicShell>} />
            <Route path="/recommendations/:slug" element={<PublicShell><RecommendationDetailPage /></PublicShell>} />

            {/* Blog · public list + article detail (frontend reads from
                web/src/data/blogPostsData.js until /api/blog ships). */}
            <Route path="/blog" element={<PublicShell><BlogPage /></PublicShell>} />
            <Route path="/blog/:slug" element={<PublicShell><BlogPostPage /></PublicShell>} />

            {/* Booking */}
            <Route path="/book" element={<PublicShell><BookConsultationPage /></PublicShell>} />
            <Route path="/book/:serviceSlug" element={<PublicShell><BookConsultationPage /></PublicShell>} />

            {/* Internal · design-system preview catalogue */}
            <Route path="/_system" element={<SystemPreviewPage />} />

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
              <Route path="consultations" element={<DashboardConsultationsPage />} />
              <Route path="wishlist" element={<DashboardWishlistPage />} />
              <Route path="addresses" element={<DashboardAddressesPage />} />
              <Route path="2fa" element={<Dashboard2FAPage />} />
              <Route path="support" element={<DashboardSupportPage />} />
              <Route path="service-orders" element={<DashboardServiceOrdersPage />} />
              <Route path="projects" element={<DashboardProjectsPage />} />
              <Route path="projects/:id" element={<DashboardProjectDetailPage />} />
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
              <Route path="coupons" element={<AdminCouponsPage />} />
              <Route path="contact-messages" element={<AdminContactsPage />} />
              <Route path="newsletter" element={<AdminNewsletterPage />} />
              {/* /admin/services manages the catalogue (Service + Pricing Plan + Feature CRUD).
                  /admin/service-orders (mounted below) handles paid service orders. */}
              <Route path="services" element={<AdminServicePlansPage />} />
              <Route path="services/legacy" element={<AdminServicesPage />} />
              <Route path="portfolio" element={<AdminPortfolioPage />} />
              <Route path="portfolio/new" element={<AdminPortfolioFormPage />} />
              <Route path="portfolio/:id/edit" element={<AdminPortfolioFormPage />} />
              <Route path="bio" element={<AdminBioPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="pages" element={<AdminPagesPage />} />
              <Route path="media" element={<AdminMediaPage />} />
              <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
              <Route path="email-logs" element={<AdminEmailLogsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
              <Route path="availability" element={<AdminAvailabilityPage />} />

              {/* Phase A, full backend */}
              <Route path="consultations" element={<AdminConsultationsPage />} />
              <Route path="service-orders" element={<AdminServiceOrdersPage />} />
              <Route path="client-projects" element={<AdminClientProjectsPage />} />
              <Route path="client-projects/new" element={<AdminClientProjectDetailPage />} />
              <Route path="client-projects/:id" element={<AdminClientProjectDetailPage />} />

              {/* Phase B, placeholders (backend pending) */}
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="recommendations" element={<AdminRecommendationsPage />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="roles" element={<AdminRolesPage />} />
              <Route path="sessions" element={<AdminSessionsPage />} />

              {/* M16 · Blog admin */}
              <Route path="blog" element={<AdminBlogPage />} />
              <Route path="blog/new" element={<AdminBlogFormPage />} />
              <Route path="blog/:id/edit" element={<AdminBlogFormPage />} />

              {/* M19 · Marketing campaigns */}
              <Route path="campaigns" element={<AdminCampaignsPage />} />
              <Route path="campaigns/new" element={<AdminCampaignFormPage />} />
              <Route path="campaigns/:id/edit" element={<AdminCampaignFormPage />} />
            </Route>

            {/* ────────────────────────────────────────────────────────
                I18N02 · Spanish parallel route tree at /es/*
                Mirrors every public English route so users at, e.g.,
                /es/about see the AboutPage component with i18n.language
                set to "es" by the LanguageWrapper layout route below.
                Admin and dashboard routes are intentionally NOT mirrored
                — operator surfaces remain English-only per the locked
                I18N03 Step 4 decision.
                ──────────────────────────────────────────────────────── */}
            <Route path="/es" element={<LanguageWrapper />}>
              {/* Public */}
              <Route index element={<PublicShell><Home /></PublicShell>} />
              <Route path="about" element={<PublicShell><AboutPage /></PublicShell>} />
              <Route path="solutions" element={<PublicShell><SolutionsPage /></PublicShell>} />
              <Route path="services" element={<PublicShell><ServicesPage /></PublicShell>} />
              <Route path="services/:slug" element={<PublicShell><ServiceDetailPage /></PublicShell>} />
              <Route path="contact" element={<PublicShell><ContactPage /></PublicShell>} />
              <Route path="portfolio" element={<PublicShell><PortfolioPage /></PublicShell>} />
              <Route path="projects/:slug" element={<PublicShell><ProjectDetailPage /></PublicShell>} />
              <Route path="store" element={<PublicShell><Store /></PublicShell>} />
              <Route path="store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
              <Route path="cart" element={<PublicShell><CartPage /></PublicShell>} />
              <Route path="compare" element={<PublicShell><ComparePage /></PublicShell>} />
              <Route path="unsubscribed" element={<PublicShell><UnsubscribedPage /></PublicShell>} />

              <Route
                path="checkout"
                element={
                  <ProtectedRoute>
                    <PublicShell>
                      <CheckoutPage />
                    </PublicShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="checkout/success/:orderId"
                element={
                  <ProtectedRoute>
                    <PublicShell>
                      <CheckoutSuccessPage />
                    </PublicShell>
                  </ProtectedRoute>
                }
              />
              <Route path="checkout/service" element={<PublicShell><ServicesCheckoutPage /></PublicShell>} />

              <Route path="terms" element={<PublicShell><TermsPage /></PublicShell>} />
              <Route path="privacy" element={<PublicShell><PrivacyPage /></PublicShell>} />
              <Route path="refund" element={<PublicShell><RefundPage /></PublicShell>} />
              <Route path="cookies" element={<PublicShell><CookiePolicyPage /></PublicShell>} />
              <Route path="recommendations" element={<PublicShell><RecommendationsPage /></PublicShell>} />
              <Route path="recommendations/:slug" element={<PublicShell><RecommendationDetailPage /></PublicShell>} />

              <Route path="blog" element={<PublicShell><BlogPage /></PublicShell>} />
              <Route path="blog/:slug" element={<PublicShell><BlogPostPage /></PublicShell>} />

              <Route path="book" element={<PublicShell><BookConsultationPage /></PublicShell>} />
              <Route path="book/:serviceSlug" element={<PublicShell><BookConsultationPage /></PublicShell>} />

              {/* Auth — mirrored under /es/ */}
              <Route path="login" element={<AuthLayout><LoginPage /></AuthLayout>} />
              <Route path="signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
              <Route path="forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
              <Route path="reset-password/:token" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />

              {/* Admin and Dashboard intentionally NOT mirrored — operator UIs stay English. */}
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<PublicShell><ErrorPage type="404" /></PublicShell>} />
          </Routes>
          </LanguageWrapper>
        </Suspense>
      </div>
      </CookieConsentProvider>
    </ErrorBoundary>
  );
}
