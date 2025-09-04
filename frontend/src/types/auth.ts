// ========================================
// USER AUTH (Clienti)
// ========================================

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'PARTNER' | 'USER';
  emailVerified: boolean;
  hasProfile: boolean;
  referralCode?: string | null;
  assignedPartner?: {
    id: string;
    referralCode: string;
  } | null;
}

export interface UserLoginResponse {
  token: string;
  type: 'user';
  user: User;
}

// ========================================
// PARTNER AUTH (Collaboratori Aziende)
// ========================================

export interface PartnerEmployee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMINISTRATIVE' | 'COMMERCIAL';
}

export interface PartnerCompany {
  id: string;
  name: string;
  referralCode: string;
  canCreateChildren: boolean;
  hierarchyLevel: number;
}

export interface PartnerLoginResponse {
  token: string;
  type: 'partner';
  user: PartnerEmployee;
  partnerCompany: PartnerCompany;
}

// ========================================
// UNIFIED AUTH
// ========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResponse = UserLoginResponse | PartnerLoginResponse;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ========================================
// AUTH CONTEXT TYPES
// ========================================

export interface UserAuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export interface PartnerAuthContextType {
  partnerEmployee: PartnerEmployee | null;
  partnerCompany: PartnerCompany | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

// Unified auth context (determina automaticamente il tipo)
export interface UnifiedAuthContextType {
  // User data (se type = 'user')
  user: User | null;
  
  // Partner data (se type = 'partner')
  partnerEmployee: PartnerEmployee | null;
  partnerCompany: PartnerCompany | null;
  
  // Common
  token: string | null;
  userType: 'user' | 'partner' | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  
  // Helper methods
  isUser: () => boolean;
  isPartner: () => boolean;
  canAccessUserArea: () => boolean;
  canAccessPartnerArea: () => boolean;
}

// Legacy compatibility
export interface AuthContextType extends UserAuthContextType {}