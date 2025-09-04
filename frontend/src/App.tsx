import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PartnerAuthProvider } from './hooks/usePartnerAuth';
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
import PartnerDashboard from './pages/PartnerDashboard';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Helper function to determine where authenticated user should go
  const getAuthenticatedRedirect = () => {
    // Check if there's a pending referral after login
    const pendingReferral = localStorage.getItem('pendingReferral');
    const pendingReferralUrl = localStorage.getItem('pendingReferralUrl');
    
    console.log('Checking authenticated redirect:', { 
      pendingReferral, 
      pendingReferralUrl, 
      user: user?.email 
    });
    
    if (pendingReferral) {
      // Clear both pending items
      localStorage.removeItem('pendingReferral');
      localStorage.removeItem('pendingReferralUrl');
      
      console.log('Redirecting to pending referral:', `/registration/${pendingReferral}`);
      return `/registration/${pendingReferral}`;
    }
    
    // Fallback: check if URL contains referral pattern but no pending storage
    if (pendingReferralUrl && pendingReferralUrl.includes('/registration/')) {
      localStorage.removeItem('pendingReferralUrl');
      console.log('Redirecting to stored URL:', pendingReferralUrl);
      return pendingReferralUrl;
    }
    
    console.log('No pending referral, redirecting to dashboard');
    return user?.role === 'USER' ? '/dashboard' : '/dashboard';
  };

  return (
    <div>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to={getAuthenticatedRedirect()} replace /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/login" 
          element={user ? (
            // Se l'utente è già autenticato e sta tentando di accedere al login,
            // mantieni la pagina corrente se è valida, altrimenti vai alla dashboard
            location.pathname !== '/login' && location.pathname !== '/' ? 
              <Navigate to={location.pathname} replace /> : 
              <Navigate to={getAuthenticatedRedirect()} replace />
          ) : <Login />} 
        />
      <Route 
        path="/change-password" 
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/registration/:referralCode?" 
        element={<Registration />} 
      />
      <Route 
        path="/email-verification" 
        element={<EmailVerification />} 
      />
      <Route 
        path="/verify-email" 
        element={<VerifyEmail />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
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
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/users/:registrationId" 
        element={
          <ProtectedRoute>
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/coupons" 
        element={
          <ProtectedRoute>
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/offers" 
        element={
          <ProtectedRoute>
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard/chat" 
        element={
          <ProtectedRoute>
            {user?.role === 'USER' ? <UserDashboard /> : <Dashboard />}
          </ProtectedRoute>
        } 
      />
      
      {/* ========================================
          PARTNER ROUTES - New System
          ======================================== */}
      <Route path="/partner/login" element={<PartnerLogin />} />
      <Route path="/partner/dashboard" element={<PartnerDashboard />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
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