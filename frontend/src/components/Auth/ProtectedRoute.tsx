import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePartnerAuth } from '../../hooks/usePartnerAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, isLoading: userLoading } = useAuth();
  const { partnerEmployee, isLoading: partnerLoading } = usePartnerAuth();

  const isLoading = userLoading || partnerLoading;
  const currentUser = user || partnerEmployee;
  const userRole = user?.role || (partnerEmployee ? 'PARTNER' : null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    // Redirect to appropriate login page
    // For now, default to general login - the login page will handle partner redirects
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && userRole && !requiredRole.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;