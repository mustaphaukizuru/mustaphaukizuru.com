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
import ErrorBoundary from "./components/ErrorBoundary"; // V2, top-level safety net
import Toaster from "./components/ui/Toaster"; // V2, sonner-based toasts
import CookieBanner from "./components/cookies/CookieBanner";
import LanguageWrapper from "./components/LanguageWrapper"; // I18N02 · URL→i18n sync + layout for /es routes
import PageTransition from "./components/motion/PageTransition"; // Phase 10 · cross-fade between routes
import { CookieConsentProvider } from "./context/CookieConsentContext";
import FloatingContactButton from "./components/FloatingContactButton";

import PublicShell from "./layout/PublicShell";
import AuthLayout from "./layout/AuthLayout";
// PERF · U1 · the admin and member-dashboard chrome is lazy.
//
// Sourcemap attribution of the app entry (index-*.js, 260 KB minified, 81
// source files) showed ~53 KB of it was AdminLayout, DashboardLayout,
// AdminSidebar, AdminHeader, NotificationDropdown and UpcomingMeetingBanner —
// shipped to every public visitor, who never renders any of it. Lighthouse
// reported the symptom as "28 KB unused JavaScript in index-*.js on /about".
//
// Both layouts are single-use route elements that already sit inside the
// <Suspense> boundary below, so lazy() moves them (and everything only they
// import) into their own chunks with no other change. Signed-in users pay the
// extra request once, on their first authenticated route.
const AdminLayout     = lazy(() => import("./layout/AdminLayout"));
const DashboardLayout = lazy(() => import("./layout/DashboardLayout"));

function PageLoader() {
  return (
    <div className="min-h-screen animate-pulse bg-white" aria-hidden="true">
      {/* Nav bar skeleton */}
      <div className="h-16 border-b border-gray-100 px-4">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <div className="h-8 w-32 rounded-lg bg-gray-200" />
          <div className="hidden gap-6 sm:flex">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-16 rounded-full bg-gray-200" />
            ))}
          </div>
          <div className="h-9 w-24 rounded-full bg-gray-200" />
        </div>
      </div>
      {/* Hero skeleton */}
      <div className="bg-gray-50 px-4 py-20 sm:py-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
          <div className="h-3 w-20 rounded-full bg-gray-300" />
          <div className="h-9 w-3/4 rounded-2xl bg-gray-200" />
          <div className="h-9 w-1/2 rounded-2xl bg-gray-200" />
          <div className="h-4 w-2/3 rounded-full bg-gray-200" />
          <div className="mt-3 flex gap-3">
            <div className="h-11 w-36 rounded-full bg-gray-300" />
            <div className="h-11 w-36 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

// Warm the chunk cache for the two heaviest primary-nav pages immediately.
// Both have a double-chunk waterfall (page chunk → catalogue chunk). Firing
// these at module-eval time means the downloads run during the ~1.6 s
// LoadingScreen animation, so chunks are in the module cache before the
// user can click anything — even on a cold visit with no prior hover.
void import("./pages/ServicesPage")
void import("./data/servicesCatalogue")

// Public pages
const Home = lazy(() => import("./pages/Home"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const ServiceDetailPage = lazy(() => import("./pages/ServiceDetailPage"));
const SelfAuditPage = lazy(() => import("./pages/SelfAuditPage"));
const SchoolsPage = lazy(() => import("./pages/SchoolsPage")); // audience page, not a service category
const HowWeWorkPage = lazy(() => import("./pages/HowWeWorkPage")); // the full engagement process (T2-9)
const TrackPage = lazy(() => import("./pages/TrackPage")); // public project tracking (T5-5)
const StatusPage = lazy(() => import("./pages/StatusPage")); // live service status (T1-9)

const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const AdminPortfolioPage = lazy(() => import("./pages/AdminPortfolioPage"));
const AdminClientsPage = lazy(() => import("./pages/AdminClientsPage"));
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
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const UnsubscribedPage = lazy(() => import("./pages/UnsubscribedPage"));
const ErrorPage = lazy(() => import("./pages/ErrorPage"));
const BookConsultationPage = lazy(() => import("./pages/BookConsultationPage"));
// Tier 4 · no-login client portal (magic link + emailed PIN)
const PortalPage = lazy(() => import("./pages/PortalPage"));

// Internal · design-system preview catalogue (always registered, gated
// inside the page itself — see SystemPreviewPage.jsx).
const SystemPreviewPage = lazy(() => import("./pages/SystemPreviewPage"));

// Auth pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
// OAuth redirect-flow landing page — receives token + user in URL fragment
// from /api/auth/google/callback and hands off to AuthContext.
const GoogleReturnPage    = lazy(() => import("./pages/GoogleReturnPage"));
const MicrosoftReturnPage = lazy(() => import("./pages/MicrosoftReturnPage"));
const FacebookReturnPage  = lazy(() => import("./pages/FacebookReturnPage"));

// Member dashboard pages
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DashboardProductsPage = lazy(() => import("./pages/DashboardProductsPage"));
const DashboardDownloadsPage = lazy(() => import("./pages/DashboardDownloadsPage"));
const DashboardOrdersPage = lazy(() => import("./pages/DashboardOrdersPage"));
const DashboardOrderDetailPage = lazy(() => import("./pages/DashboardOrderDetailPage"));
const DashboardNotificationsPage = lazy(() => import("./pages/DashboardNotificationsPage"));
const DashboardSupportPage = lazy(() => import("./pages/DashboardSupportPage"));
const DashboardServiceOrdersPage = lazy(() => import("./pages/DashboardServiceOrdersPage")); // #5
const DashboardProfilePage = lazy(() => import("./pages/DashboardProfilePage"));
const DashboardConsultationsPage = lazy(() => import("./pages/DashboardConsultationsPage"));
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
const AdminLeadsPage = lazy(() => import("./pages/AdminLeadsPage"));
const AdminNewsletterPage = lazy(() => import("./pages/AdminNewsletterPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminServicesPage = lazy(() => import("./pages/AdminServicesPage"));
const AdminServicePlansPage = lazy(() => import("./pages/AdminServicePlansPage"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const AdminEmailTemplatesPage = lazy(() => import("./pages/AdminEmailTemplatesPage"));
const AdminEmailLogsPage = lazy(() => import("./pages/AdminEmailLogsPage"));
const AdminAuditPage       = lazy(() => import("./pages/AdminAuditPage"))
const AdminDiagnosticPage  = lazy(() => import("./pages/AdminDiagnosticPage"));
const AdminAvailabilityPage = lazy(() => import("./pages/AdminAvailabilityPage"));

// Phase A · Booking + service-order management (full backend)
const AdminConsultationsPage = lazy(() => import("./pages/AdminConsultationsPage"));
const AdminServiceOrdersPage = lazy(() => import("./pages/AdminServiceOrdersPage"));
const AdminServiceOrderDetailPage = lazy(() => import("./pages/AdminServiceOrderDetailPage"));
const AdminClientProjectsPage = lazy(() => import("./pages/AdminClientProjectsPage")); // #8
const AdminQueuePage = lazy(() => import("./pages/AdminQueuePage")); // T5-16, one queue across projects
const AdminClientProjectDetailPage = lazy(() => import("./pages/AdminClientProjectDetailPage")); // #8

// Phase B · Placeholders (backend pending — see each page for the API plan)
const AdminReviewsPage = lazy(() => import("./pages/AdminReviewsPage"));
const AdminRefundsPage = lazy(() => import("./pages/AdminRefundsPage"));
const AdminInvoicesPage = lazy(() => import("./pages/AdminInvoicesPage"));
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
        <FloatingContactButton />
        <Suspense fallback={<PageLoader />}>
          <LanguageWrapper>
          <SeoRouteManager />
          <ScrollToTopOnNavigate />
      <AnalyticsTracker />
      <SearchPalette />
      <CartDrawer />

          <PageTransition>
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicShell><Home /></PublicShell>} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<PublicShell><AboutPage /></PublicShell>} />
            <Route path="/services" element={<PublicShell><ServicesPage /></PublicShell>} />
            <Route path="/services/:slug" element={<PublicShell><ServiceDetailPage /></PublicShell>} />
            {/* The full six-step engagement process, for prospects who arrive from a proposal link. */}
            <Route path="/how-we-work" element={<PublicShell><HowWeWorkPage /></PublicShell>} />
            {/* "Where is my project?", without a login. /track is the form;
                /track/:code is the result, and both are noindex — a crawled
                code would put a client's progress in a search result. */}
            {/* Live service status. Served from public/ by Passenger without
                Node, so it answers during exactly the outage it reports. */}
            <Route path="/status" element={<PublicShell><StatusPage /></PublicShell>} />
            <Route path="/track" element={<PublicShell><TrackPage /></PublicShell>} />
            <Route path="/track/:code" element={<PublicShell><TrackPage /></PublicShell>} />
            <Route path="/schools" element={<PublicShell><SchoolsPage /></PublicShell>} />
            {/* Public lead magnet — the Services hero links here for visitors. */}
            <Route path="/self-audit" element={<PublicShell><SelfAuditPage /></PublicShell>} />
            <Route path="/contact" element={<PublicShell><ContactPage /></PublicShell>} />
            <Route path="/portfolio" element={<PublicShell><PortfolioPage /></PublicShell>} />
            <Route path="/projects/:slug" element={<PublicShell><ProjectDetailPage /></PublicShell>} />
            <Route path="/store" element={<PublicShell><Store /></PublicShell>} />
            <Route path="/store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
            <Route path="/cart" element={<PublicShell><CartPage /></PublicShell>} />
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

            {/* Blog · public list + article detail (frontend reads from
                web/src/data/blogPostsData.js until /api/blog ships). */}
            <Route path="/blog" element={<PublicShell><BlogPage /></PublicShell>} />
            <Route path="/blog/:slug" element={<PublicShell><BlogPostPage /></PublicShell>} />

            {/* Booking */}
            <Route path="/book" element={<PublicShell><BookConsultationPage /></PublicShell>} />
            <Route path="/book/:serviceSlug" element={<PublicShell><BookConsultationPage /></PublicShell>} />

            {/* Client portal · magic link + PIN, no account needed */}
            <Route path="/portal/:token" element={<PublicShell><PortalPage /></PublicShell>} />

            {/* Internal · design-system preview catalogue — admin only */}
            <Route path="/_system" element={<AdminRoute><SystemPreviewPage /></AdminRoute>} />

            {/* Auth */}
            <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
            <Route path="/signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
            <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
            <Route path="/reset-password/:token" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
            {/* OAuth redirect-flow landing — no AuthLayout shell, lifecycle is
                ~200ms then nav-replace to /dashboard. */}
            <Route path="/auth/google/return"    element={<GoogleReturnPage />} />
            <Route path="/auth/microsoft/return" element={<MicrosoftReturnPage />} />
            <Route path="/auth/facebook/return"  element={<FacebookReturnPage />} />

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
              <Route path="orders/:orderId" element={<DashboardOrderDetailPage />} />
              <Route path="notifications" element={<DashboardNotificationsPage />} />
              <Route path="consultations" element={<DashboardConsultationsPage />} />
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
              <Route path="leads" element={<AdminLeadsPage />} />
              <Route path="newsletter" element={<AdminNewsletterPage />} />
              {/* /admin/services manages the catalogue (Service + Pricing Plan + Feature CRUD).
                  /admin/service-orders (mounted below) handles paid service orders. */}
              <Route path="services" element={<AdminServicePlansPage />} />
              <Route path="services/legacy" element={<AdminServicesPage />} />
              <Route path="portfolio" element={<AdminPortfolioPage />} />
              <Route path="clients" element={<AdminClientsPage />} />
              <Route path="portfolio/new" element={<AdminPortfolioFormPage />} />
              <Route path="portfolio/:id/edit" element={<AdminPortfolioFormPage />} />
              <Route path="bio" element={<AdminBioPage />} />
              <Route path="analytics" element={<AdminAnalyticsPage />} />
              <Route path="support" element={<AdminSupportPage />} />
              <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
              <Route path="email-logs" element={<AdminEmailLogsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="audit"       element={<AdminAuditPage />} />
              <Route path="diagnostic"  element={<AdminDiagnosticPage />} />
              <Route path="availability" element={<AdminAvailabilityPage />} />

              {/* Phase A, full backend */}
              <Route path="consultations" element={<AdminConsultationsPage />} />
              <Route path="service-orders" element={<AdminServiceOrdersPage />} />
              <Route path="service-orders/:id" element={<AdminServiceOrderDetailPage />} />
              <Route path="queue" element={<AdminQueuePage />} />
              <Route path="client-projects" element={<AdminClientProjectsPage />} />
              <Route path="client-projects/new" element={<AdminClientProjectDetailPage />} />
              <Route path="client-projects/:id" element={<AdminClientProjectDetailPage />} />

              {/* Phase B, placeholders (backend pending) */}
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="refunds" element={<AdminRefundsPage />} />
              <Route path="invoices" element={<AdminInvoicesPage />} />
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
              <Route path="services" element={<PublicShell><ServicesPage /></PublicShell>} />
              <Route path="services/:slug" element={<PublicShell><ServiceDetailPage /></PublicShell>} />
              <Route path="schools" element={<PublicShell><SchoolsPage /></PublicShell>} />
              <Route path="how-we-work" element={<PublicShell><HowWeWorkPage /></PublicShell>} />
              <Route path="track" element={<PublicShell><TrackPage /></PublicShell>} />
              <Route path="status" element={<PublicShell><StatusPage /></PublicShell>} />
              <Route path="track/:code" element={<PublicShell><TrackPage /></PublicShell>} />
              <Route path="contact" element={<PublicShell><ContactPage /></PublicShell>} />
              <Route path="self-audit" element={<PublicShell><SelfAuditPage /></PublicShell>} />
              <Route path="portfolio" element={<PublicShell><PortfolioPage /></PublicShell>} />
              <Route path="projects/:slug" element={<PublicShell><ProjectDetailPage /></PublicShell>} />
              <Route path="store" element={<PublicShell><Store /></PublicShell>} />
              <Route path="store/:slug" element={<PublicShell><ProductDetail /></PublicShell>} />
              <Route path="cart" element={<PublicShell><CartPage /></PublicShell>} />
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

              <Route path="blog" element={<PublicShell><BlogPage /></PublicShell>} />
              <Route path="blog/:slug" element={<PublicShell><BlogPostPage /></PublicShell>} />

              <Route path="book" element={<PublicShell><BookConsultationPage /></PublicShell>} />
              <Route path="book/:serviceSlug" element={<PublicShell><BookConsultationPage /></PublicShell>} />
              <Route path="portal/:token" element={<PublicShell><PortalPage /></PublicShell>} />

              {/* Auth — mirrored under /es/ */}
              <Route path="login" element={<AuthLayout><LoginPage /></AuthLayout>} />
              <Route path="signup" element={<AuthLayout><SignupPage /></AuthLayout>} />
              <Route path="forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
              <Route path="reset-password/:token" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
              <Route path="auth/google/return"    element={<GoogleReturnPage />} />
              <Route path="auth/microsoft/return" element={<MicrosoftReturnPage />} />
              <Route path="auth/facebook/return"  element={<FacebookReturnPage />} />

              {/* Admin and Dashboard intentionally NOT mirrored — operator UIs stay English. */}
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<PublicShell><ErrorPage type="404" /></PublicShell>} />
          </Routes>
          </PageTransition>
          </LanguageWrapper>
        </Suspense>
      </div>
      </CookieConsentProvider>
    </ErrorBoundary>
  );
}
