import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserDashboard from './pages/UserDashboard';
import Registration from './pages/Registration';
import AdditionalEnrollment from './pages/AdditionalEnrollment';
import EmailVerification from './pages/EmailVerification';
import ChangePassword from './pages/ChangePassword';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Helper function to determine where authenticated user should go
  const getAuthenticatedRedirect = () => {
    if (user?.mustChangePassword) {
      return "/change-password";
    }
    return "/dashboard";
  };

  return (
    <div>
      {/* Deploy Test Banner */}
      <div className="bg-green-600 text-white text-center py-1 text-sm">
        ✅ FTP Deploy Test - {new Date().toLocaleString('it-IT')} - Password Updated!
      </div>
      <Routes>
        <Route 
          path="/" 
          element={user ? <Navigate to={getAuthenticatedRedirect()} replace /> : <Navigate to="/login" replace />} 
        />
      <Route 
        path="/login" 
        element={user ? <Navigate to={getAuthenticatedRedirect()} replace /> : <Login />} 
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
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {user?.mustChangePassword ? (
              <Navigate to="/change-password" replace />
            ) : (
              user?.role === 'USER' ? <UserDashboard /> : <Dashboard />
            )}
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/enrollment/:partnerOfferId?" 
        element={
          <ProtectedRoute>
            {user?.mustChangePassword ? (
              <Navigate to="/change-password" replace />
            ) : (
              <AdditionalEnrollment />
            )}
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;