import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { 
  PartnerEmployee, 
  PartnerCompany, 
  PartnerEmployeeRole 
} from '../types/partner';
import { LoginRequest } from '../types/auth';

// Define inline PartnerLoginResponse to avoid type conflicts
interface PartnerLoginResponse {
  token: string;
  type: 'partner';
  user: PartnerEmployee;
  partnerCompany: PartnerCompany;
}

// ========================================
// PARTNER AUTH CONTEXT
// ========================================

interface PartnerAuthContextType {
  // Auth State
  partnerEmployee: PartnerEmployee | null;
  partnerCompany: PartnerCompany | null;
  token: string | null;
  isLoading: boolean;
  
  // Auth Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  
  // Helper Methods
  isAuthenticated: () => boolean;
  canCreateEmployees: () => boolean;
  canCreateChildCompanies: () => boolean;
  canViewFinancialData: () => boolean;
  canManageOffers: () => boolean;
}

const PartnerAuthContext = createContext<PartnerAuthContextType | undefined>(undefined);

// ========================================
// PARTNER AUTH PROVIDER
// ========================================

interface PartnerAuthProviderProps {
  children: ReactNode;
}

export const PartnerAuthProvider: React.FC<PartnerAuthProviderProps> = ({ children }) => {
  const [partnerEmployee, setPartnerEmployee] = useState<PartnerEmployee | null>(null);
  const [partnerCompany, setPartnerCompany] = useState<PartnerCompany | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ========================================
  // INITIALIZATION
  // ========================================
  
  useEffect(() => {
    const initAuth = () => {
      try {
        const savedToken = localStorage.getItem('partnerToken');
        const savedEmployee = localStorage.getItem('partnerEmployee');
        const savedCompany = localStorage.getItem('partnerCompany');

        if (savedToken && savedEmployee && savedCompany) {
          setToken(savedToken);
          setPartnerEmployee(JSON.parse(savedEmployee));
          setPartnerCompany(JSON.parse(savedCompany));
          
          // Setup axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        }
      } catch (error) {
        console.error('Error loading partner auth from storage:', error);
        logout();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // ========================================
  // AUTH ACTIONS
  // ========================================

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await axios.post<PartnerLoginResponse>('/api/auth/login', credentials);
      const { token: newToken, type, user: employee, partnerCompany: company } = response.data;
      
      // Verify this is a partner login
      if (type !== 'partner') {
        throw new Error('Invalid login type. Expected partner login.');
      }

      // Store in localStorage
      localStorage.setItem('partnerToken', newToken);
      localStorage.setItem('partnerEmployee', JSON.stringify(employee));
      localStorage.setItem('partnerCompany', JSON.stringify(company));
      
      // Update state
      setToken(newToken);
      setPartnerEmployee(employee);
      setPartnerCompany(company);
      
      // Setup axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      console.log('✅ Partner login successful:', {
        employee: employee.email,
        company: company.name,
        role: employee.role
      });
      
    } catch (error) {
      console.error('Partner login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('partnerToken');
    localStorage.removeItem('partnerEmployee');  
    localStorage.removeItem('partnerCompany');
    
    // Clear state
    setToken(null);
    setPartnerEmployee(null);
    setPartnerCompany(null);
    
    // Clear axios header
    delete axios.defaults.headers.common['Authorization'];
    
    console.log('✅ Partner logout completed');
  };

  // ========================================
  // HELPER METHODS
  // ========================================

  const isAuthenticated = (): boolean => {
    return !!(token && partnerEmployee && partnerCompany);
  };

  const canCreateEmployees = (): boolean => {
    return partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE;
  };

  const canCreateChildCompanies = (): boolean => {
    return (
      partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE && 
      (partnerCompany?.canCreateChildren || false)
    );
  };

  const canViewFinancialData = (): boolean => {
    return partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE;
  };

  const canManageOffers = (): boolean => {
    return partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE;
  };

  // ========================================
  // CONTEXT VALUE
  // ========================================

  const contextValue: PartnerAuthContextType = {
    // State
    partnerEmployee,
    partnerCompany,
    token,
    isLoading,
    
    // Actions
    login,
    logout,
    
    // Helpers
    isAuthenticated,
    canCreateEmployees,
    canCreateChildCompanies,
    canViewFinancialData,
    canManageOffers
  };

  return (
    <PartnerAuthContext.Provider value={contextValue}>
      {children}
    </PartnerAuthContext.Provider>
  );
};

// ========================================
// HOOK
// ========================================

export const usePartnerAuth = (): PartnerAuthContextType => {
  const context = useContext(PartnerAuthContext);
  if (!context) {
    throw new Error('usePartnerAuth must be used within PartnerAuthProvider');
  }
  return context;
};

// ========================================
// ROUTE GUARD COMPONENT
// ========================================

interface PartnerRouteGuardProps {
  children: ReactNode;
  requiredRole?: PartnerEmployeeRole;
  fallback?: ReactNode;
}

export const PartnerRouteGuard: React.FC<PartnerRouteGuardProps> = ({ 
  children, 
  requiredRole,
  fallback = <div>Access denied</div>
}) => {
  const { isAuthenticated, partnerEmployee, isLoading } = usePartnerAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated()) {
    return <div>Please login as partner</div>;
  }

  if (requiredRole && partnerEmployee?.role !== requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// ========================================
// AXIOS INTERCEPTOR SETUP
// ========================================

// Setup response interceptor for partner auth
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      const savedToken = localStorage.getItem('partnerToken');
      if (savedToken) {
        console.warn('Partner token expired, logging out');
        // Clear partner auth data
        localStorage.removeItem('partnerToken');
        localStorage.removeItem('partnerEmployee');
        localStorage.removeItem('partnerCompany');
        window.location.href = '/partner/login';
      }
    }
    return Promise.reject(error);
  }
);