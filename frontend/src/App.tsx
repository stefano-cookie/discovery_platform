import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PartnerAuthProvider, usePartnerAuth } from './hooks/usePartnerAuth';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserDashboard from './pages/UserDashboard';
import Registration from './pages/Registration';
import EmailVerification from './pages/EmailVerification';
import VerifyEmail from './pages/VerifyEmail';
import ChangePassword from './pages/ChangePassword';

// Partner System - New Routes
import PartnerLogin from './pages/PartnerLogin';

// Route Components to avoid IIFE issues
const RootRoute: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  console.log('🏠 Root route accessed, isAuthenticated:', isAuthenticated);
  
  if (isAuthenticated) {
    // Check if there's a pending referral after login
    const pendingReferral = localStorage.getItem('pendingReferral');
    const pendingReferralUrl = localStorage.getItem('pendingReferralUrl');
    
    if (pendingReferral) {
      localStorage.removeItem('pendingReferral');
      localStorage.removeItem('pendingReferralUrl');
      console.log('➡️ Redirecting authenticated user to registration:', `/registration/${pendingReferral}`);
      return <Navigate to={`/registration/${pendingReferral}`} replace />;
    }
    
    if (pendingReferralUrl && pendingReferralUrl.includes('/registration/')) {
      localStorage.removeItem('pendingReferralUrl');
      console.log('➡️ Redirecting authenticated user to stored URL:', pendingReferralUrl);
      return <Navigate to={pendingReferralUrl} replace />;
    }
    
    console.log('➡️ Redirecting authenticated user to dashboard');
    return <Navigate to="/dashboard" replace />;
  } else {
    console.log('➡️ Redirecting unauthenticated user to /login');
    return <Navigate to="/login" replace />;
  }
};

const LoginRoute: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  console.log('🔑 Login route accessed, isAuthenticated:', isAuthenticated);
  
  if (isAuthenticated) {
    console.log('➡️ Already authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  } else {
    console.log('📝 Showing login form');
    return <Login />;
  }
};

const PartnerLoginRoute: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  console.log('🤝 Partner login route accessed, isAuthenticated:', isAuthenticated);
  
  if (isAuthenticated) {
    console.log('➡️ Already authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  } else {
    console.log('📝 Showing partner login form');
    return <PartnerLogin />;
  }
};

const DashboardRoute: React.FC<{ userRole: string | null }> = ({ userRole }) => {
  console.log('🏢 Dashboard route - user role check:', userRole);
  
  if (userRole === 'USER') {
    console.log('👤 Loading UserDashboard');
    return <UserDashboard />;
  } else {
    console.log('🏢 Loading Partner/Admin Dashboard');
    return <Dashboard />;
  }
};

const CatchAllRoute: React.FC = () => {
  console.log('❓ Catch-all route accessed for:', window.location.pathname);
  return <Navigate to="/" replace />;
};

const AppContent: React.FC = () => {
  const { user, isLoading: userLoading } = useAuth();
  const { partnerEmployee, isLoading: partnerLoading } = usePartnerAuth();

  const isLoading = userLoading || partnerLoading;
  const isAuthenticated = !!(user || partnerEmployee);
  const userRole = user?.role || (partnerEmployee ? 'PARTNER' : null);
  
  // Debug logging
  console.log('🔍 App Debug:', {
    user: user?.email || null,
    userRole: user?.role || null,
    partnerEmployee: partnerEmployee?.email || null,
    partnerRole: partnerEmployee?.role || null,
    userLoading,
    partnerLoading,
    isLoading,
    isAuthenticated,
    pathname: window.location.pathname
  });

  if (isLoading) {
    console.log('⏳ App is loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <Routes>
        {/* ========================================
            ROOT ROUTE
            ======================================== */}
        <Route 
          path="/" 
          element={<RootRoute isAuthenticated={isAuthenticated} />}
        />

        {/* ========================================
            AUTHENTICATION ROUTES  
            ======================================== */}
        <Route 
          path="/login" 
          element={<LoginRoute isAuthenticated={isAuthenticated} />}
        />
        
        <Route 
          path="/partner/login" 
          element={<PartnerLoginRoute isAuthenticated={isAuthenticated} />}
        />

        {/* ========================================
            PUBLIC ROUTES
            ======================================== */}
        <Route path="/registration/:referralCode?" element={<Registration />} />
        <Route path="/email-verification" element={<EmailVerification />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        
        {/* ========================================
            PROTECTED ROUTES
            ======================================== */}
        <Route 
          path="/change-password" 
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          } 
        />

        {/* ========================================
            DASHBOARD ROUTES - Simplified logic
            ======================================== */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/enrollment/:registrationId" 
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/users" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/users/:registrationId" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/coupons" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/offers" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/chat" 
          element={
            <ProtectedRoute>
              <DashboardRoute userRole={userRole} />
            </ProtectedRoute>
          } 
        />

        {/* ========================================
            CATCH ALL
            ======================================== */}
        <Route 
          path="*" 
          element={<CatchAllRoute />} 
        />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  console.log('🚀 App component mounted');
  return (
    <AuthProvider>
      <PartnerAuthProvider>
        <Router>
          <div className="App">
            <AppContent />
          </div>
        </Router>
      </PartnerAuthProvider>
    </AuthProvider>
  );
};

export default App;