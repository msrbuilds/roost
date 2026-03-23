import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Loading component for suspense fallback
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
    </div>
);

// Lazy-loaded Pages
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Classrooms = lazy(() => import('./pages/Groups'));
const ClassroomDetail = lazy(() => import('./pages/GroupDetail'));
const ClassroomSettings = lazy(() => import('./pages/GroupSettings'));
const Messages = lazy(() => import('./pages/Messages'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Members = lazy(() => import('./pages/Members'));
const Guide = lazy(() => import('./pages/Guide'));
const Showcase = lazy(() => import('./pages/Showcase'));
const ShowcaseDetail = lazy(() => import('./pages/ShowcaseDetail'));
const ShowcaseSubmit = lazy(() => import('./pages/ShowcaseSubmit'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const FeatureRequests = lazy(() => import('./pages/FeatureRequests'));
const FeatureRequestList = lazy(() => import('./pages/FeatureRequestList'));
const FeatureRequestDetail = lazy(() => import('./pages/FeatureRequestDetail'));
const Activations = lazy(() => import('./pages/Activations'));
const LiveRoom = lazy(() => import('./pages/LiveRoom'));
const Upgrade = lazy(() => import('./pages/Upgrade'));

// Lazy-loaded Auth Pages
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const ConfirmEmail = lazy(() => import('./pages/auth/ConfirmEmail'));
const Banned = lazy(() => import('./pages/auth/Banned'));
const SubscriptionRequired = lazy(() => import('./pages/auth/SubscriptionRequired'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminContent = lazy(() => import('./pages/admin/Content'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const AdminShowcases = lazy(() => import('./pages/admin/Showcases'));
const AdminBackups = lazy(() => import('./pages/admin/Backups'));
const AdminActivations = lazy(() => import('./pages/admin/Activations'));
const AdminLiveRoom = lazy(() => import('./pages/admin/LiveRoom'));
const AdminSiteSettings = lazy(() => import('./pages/admin/SiteSettings'));

// Layouts - not lazy loaded for better UX
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';

function App() {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Auth routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                {/* Email confirmation pending route */}
                <Route path="/confirm-email" element={<ConfirmEmail />} />

                {/* Banned user route - accessible when authenticated but banned */}
                <Route path="/banned" element={<Banned />} />

                {/* Subscription required route - accessible when authenticated but no subscription */}
                <Route path="/subscription-required" element={<SubscriptionRequired />} />

                {/* Upgrade page - accessible when authenticated but not premium */}
                <Route path="/upgrade" element={<Upgrade />} />

                {/* Admin routes */}
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminLayout />
                        </AdminRoute>
                    }
                >
                    <Route index element={<AdminDashboard />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="content" element={<AdminContent />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="announcements" element={<AdminAnnouncements />} />
                    <Route path="subscriptions" element={<AdminSubscriptions />} />
                    <Route path="showcases" element={<AdminShowcases />} />
                    <Route path="backups" element={<AdminBackups />} />
                    <Route path="activations" element={<AdminActivations />} />
                    <Route path="live-room" element={<AdminLiveRoom />} />
                    <Route path="site-settings" element={<AdminSiteSettings />} />
                </Route>

                {/* Protected routes - available to all authenticated users */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<MainLayout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/explore" element={<Explore />} />
                        <Route path="/classrooms" element={<Classrooms />} />
                        <Route path="/classrooms/:slug" element={<ClassroomDetail />} />
                        <Route path="/classrooms/:slug/settings" element={<ClassroomSettings />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/classrooms/:slug/leaderboard" element={<Leaderboard />} />
                        <Route path="/members" element={<Members />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/profile/:username" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/guide" element={<Guide />} />
                        <Route path="/showcase" element={<Showcase />} />
                        <Route path="/showcase/submit" element={<ShowcaseSubmit />} />
                        <Route path="/showcase/:id" element={<ShowcaseDetail />} />
                        <Route path="/post/:postId" element={<PostDetail />} />
                        <Route path="/roadmap" element={<FeatureRequests />} />
                        <Route path="/roadmap/all" element={<FeatureRequestList />} />
                        <Route path="/roadmap/:id" element={<FeatureRequestDetail />} />
                    </Route>
                </Route>

                {/* Premium-only routes - requires premium membership */}
                <Route element={<ProtectedRoute requirePremium />}>
                    <Route element={<MainLayout />}>
                        <Route path="/messages" element={<Messages />} />
                        <Route path="/messages/:userId" element={<Messages />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/activations" element={<Activations />} />
                        <Route path="/live" element={<LiveRoom />} />
                    </Route>
                </Route>
            </Routes>
        </Suspense>
    );
}

export default App;
