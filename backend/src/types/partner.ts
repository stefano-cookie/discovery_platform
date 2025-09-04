// ========================================
// PARTNER TYPES - Sistema Rinnovato
// ========================================

export interface PartnerCompany {
  id: string;
  name: string;
  referralCode: string;
  
  // Sistema Gerarchico
  parentId?: string;
  canCreateChildren: boolean;
  hierarchyLevel: number;
  isActive: boolean;
  
  // Business Data
  commissionPerUser: number;
  totalEarnings: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Relazioni (opzionali per includes)
  parent?: PartnerCompany;
  children?: PartnerCompany[];
  employees?: PartnerEmployee[];
}

export interface PartnerEmployee {
  id: string;
  partnerCompanyId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: PartnerEmployeeRole;
  isActive: boolean;
  isOwner: boolean;
  
  // Sistema inviti sicuri
  inviteToken?: string;
  inviteExpiresAt?: Date;
  invitedBy?: string;
  acceptedAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  
  // Relazioni (opzionali per includes)
  partnerCompany?: PartnerCompany;
  sessions?: PartnerSession[];
  activityLogs?: PartnerActivityLog[];
}

export enum PartnerEmployeeRole {
  ADMINISTRATIVE = 'ADMINISTRATIVE', // Accesso completo: crea collaboratori, aziende figlie, vede dati finanziari
  COMMERCIAL = 'COMMERCIAL'          // Accesso limitato: NO dati finanziari, NO creazione utenti
}

export interface PartnerSession {
  id: string;
  partnerEmployeeId: string;
  token: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  
  // Relazioni
  partnerEmployee?: PartnerEmployee;
}

export interface PartnerActivityLog {
  id: string;
  partnerEmployeeId: string;
  action: string; // "LOGIN", "CREATE_EMPLOYEE", "CREATE_CHILD_COMPANY", "VIEW_REGISTRATIONS"
  details?: any;  // JSON dati aggiuntivi
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  
  // Relazioni
  partnerEmployee?: PartnerEmployee;
}

// ========================================
// PERMISSION HELPERS
// ========================================

export const PartnerPermissions = {
  canCreateEmployees: (role: PartnerEmployeeRole): boolean => {
    return role === PartnerEmployeeRole.ADMINISTRATIVE;
  },
  
  canCreateChildCompanies: (role: PartnerEmployeeRole, company?: PartnerCompany): boolean => {
    return role === PartnerEmployeeRole.ADMINISTRATIVE && (company?.canCreateChildren || false);
  },
  
  canViewFinancialData: (role: PartnerEmployeeRole): boolean => {
    return role === PartnerEmployeeRole.ADMINISTRATIVE;
  },
  
  canManageOffers: (role: PartnerEmployeeRole): boolean => {
    return role === PartnerEmployeeRole.ADMINISTRATIVE;
  }
};

// ========================================
// REQUEST INTERFACES
// ========================================

export interface CreatePartnerEmployeeRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: PartnerEmployeeRole;
}

export interface CreateChildCompanyRequest {
  name: string;
  canCreateChildren: boolean;
}

export interface PartnerLoginResponse {
  token: string;
  type: 'partner';
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: PartnerEmployeeRole;
  };
  partnerCompany: {
    id: string;
    name: string;
    referralCode: string;
    canCreateChildren: boolean;
    hierarchyLevel: number;
  };
}

// ========================================
// LEGACY COMPATIBILITY (da rimuovere in futuro)
// ========================================

// Manteniamo temporaneamente i tipi legacy per compatibilità durante migrazione
export interface Partner {
  id: string;
  userId: string;
  parentId?: string;
  referralCode: string;
  canCreateChildren: boolean;
  commissionPerUser: number;
  commissionToAdmin: number;
  promotedFromChild: boolean;
  createdAt: Date;
}

export interface PartnerUser {
  id: string;
  partnerId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}