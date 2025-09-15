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
        
        console.log('🔑 Partner Auth Init:', {
          savedToken: savedToken ? 'EXISTS' : 'NULL',
          savedEmployee: savedEmployee ? 'EXISTS' : 'NULL',
          savedCompany: savedCompany ? 'EXISTS' : 'NULL'
        });

        if (savedToken && savedEmployee && savedCompany) {
          const employee = JSON.parse(savedEmployee);
          const company = JSON.parse(savedCompany);
          
          setToken(savedToken);
          setPartnerEmployee(employee);
          setPartnerCompany(company);
          
          console.log('✅ Partner Auth Restored:', {
            email: employee.email,
            role: employee.role,
            company: company.name
          });
          
          // Setup api default header
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } else {
          // Clear any partial/corrupted data
          if (savedToken || savedEmployee || savedCompany) {
            console.log('🧹 Clearing corrupted partner auth data');
            localStorage.removeItem('partnerToken');
            localStorage.removeItem('partnerEmployee');
            localStorage.removeItem('partnerCompany');
          }
          console.log('❌ Partner Auth: No saved data found');
        }
      } catch (error) {
        console.error('❌ Error loading partner auth from storage:', error);
        logout();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Calculated authentication state
  const authenticated = !!(token && partnerEmployee && partnerCompany);

  // Debug: Log when partner state changes
  useEffect(() => {
    console.log('🔄 Partner state changed:', {
      hasToken: !!token,
      hasEmployee: !!partnerEmployee,
      hasCompany: !!partnerCompany,
      isLoading,
      authenticated
    });
  }, [token, partnerEmployee, partnerCompany, isLoading]);

  // ========================================
  // AUTH ACTIONS
  // ========================================

  const login = async (credentials: LoginRequest) => {
    try {
      console.log('🔄 Partner login attempt:', credentials.email);
      const response = await api.post<PartnerLoginResponse>('/auth/login', credentials);
      const { token: newToken, type, user: employee, partnerCompany: company } = response.data;
      
      console.log('📝 Partner login response:', {
        type,
        employee: employee.email,
        company: company.name,
        tokenLength: newToken.length
      });
      
      // Verify this is a partner login
      if (type !== 'partner') {
        throw new Error('Invalid login type. Expected partner login.');
      }

      // Store in localStorage
      localStorage.setItem('partnerToken', newToken);
      localStorage.setItem('partnerEmployee', JSON.stringify(employee));
      localStorage.setItem('partnerCompany', JSON.stringify(company));
      
      console.log('💾 Partner data stored in localStorage:', {
        tokenSaved: !!localStorage.getItem('partnerToken'),
        employeeSaved: !!localStorage.getItem('partnerEmployee'),
        companySaved: !!localStorage.getItem('partnerCompany')
      });
      
      // Update state
      setToken(newToken);
      setPartnerEmployee(employee);
      setPartnerCompany(company);
      
      console.log('🔄 Partner state updated in React:', {
        tokenState: !!newToken,
        employeeState: !!employee,
        companyState: !!company
      });
      
      // Setup api default header
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      console.log('✅ Partner login successful:', {
        employee: employee.email,
        company: company.name,
        role: employee.role
      });
      
    } catch (error) {
      console.error('❌ Partner login failed:', error);
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