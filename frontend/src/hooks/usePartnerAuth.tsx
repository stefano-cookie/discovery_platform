import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
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

// 2FA flow responses
interface TwoFactorRequiredResponse {
  requires2FA: true;
  sessionToken: string;
  message: string;
}

interface TwoFactorSetupRequiredResponse {
  requires2FASetup: true;
  partnerEmployeeId: string;
  message: string;
}

// Custom error for 2FA required flow
export class TwoFactorRequiredError extends Error {
  sessionToken: string;
  constructor(sessionToken: string, message: string) {
    super(message);
    this.name = 'TwoFactorRequiredError';
    this.sessionToken = sessionToken;
  }
}

export class TwoFactorSetupRequiredError extends Error {
  partnerEmployeeId: string;
  constructor(partnerEmployeeId: string, message: string) {
    super(message);
    this.name = 'TwoFactorSetupRequiredError';
    this.partnerEmployeeId = partnerEmployeeId;
  }
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
  canCreateOffers: () => boolean;
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
          const employee = JSON.parse(savedEmployee);
          const company = JSON.parse(savedCompany);

          setToken(savedToken);
          setPartnerEmployee(employee);
          setPartnerCompany(company);

          // Setup api default header
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } else {
          // Clear any partial/corrupted data
          if (savedToken || savedEmployee || savedCompany) {
            localStorage.removeItem('partnerToken');
            localStorage.removeItem('partnerEmployee');
            localStorage.removeItem('partnerCompany');
          }
        }
      } catch (error) {
        logout();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Calculated authentication state
  const authenticated = !!(token && partnerEmployee && partnerCompany);

  // ========================================
  // AUTH ACTIONS
  // ========================================

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await api.post<any>('/auth/login', credentials);
      const data = response.data;

      // ========== 2FA FLOW HANDLING ==========
      // Check if 2FA setup is required
      if (data.requires2FASetup) {
        throw new TwoFactorSetupRequiredError(
          data.partnerEmployeeId,
          data.message || 'Configurazione 2FA obbligatoria'
        );
      }

      // Check if 2FA verification is required
      if (data.requires2FA) {
        throw new TwoFactorRequiredError(
          data.sessionToken,
          data.message || 'Inserisci il codice a 6 cifre'
        );
      }
      // ========== END 2FA FLOW ==========

      // Normal login flow (legacy or 2FA disabled)
      const { token: newToken, type, user: employee, partnerCompany: company } = data;

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

      // Setup api default header
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

    } catch (error) {
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
    
    // Clear api header
    delete api.defaults.headers.common['Authorization'];
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
    // Sia ADMINISTRATIVE che COMMERCIAL possono gestire le offerte
    return partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE || 
           partnerEmployee?.role === PartnerEmployeeRole.COMMERCIAL;
  };

  const canCreateOffers = (): boolean => {
    // Sia ADMINISTRATIVE che COMMERCIAL possono creare offerte, solo se è una company parent (non figlio)
    return (partnerEmployee?.role === PartnerEmployeeRole.ADMINISTRATIVE ||
            partnerEmployee?.role === PartnerEmployeeRole.COMMERCIAL) &&
           !partnerCompany?.parentId; // Solo se non ha un parent (quindi è root o parent)
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
    canManageOffers,
    canCreateOffers
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

// Note: Removed global interceptor to prevent routing conflicts.
// Error handling is managed by individual components.