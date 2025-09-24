// ========================================
// PARTNER TYPES - Sistema Rinnovato Frontend
// ========================================

export interface PartnerCompany {
  id: string;
  name: string;
  referralCode: string;
  
  // Sistema Gerarchico
  parentId?: string;
  canCreateChildren: boolean;
  isActive: boolean;
  isPremium: boolean;
  
  // Business Data
  commissionPerUser: number;
  totalEarnings: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Relazioni (opzionali per includes)
  parent?: PartnerCompany;
  children?: PartnerCompany[];
  employees?: PartnerEmployee[];
}

export interface PartnerEmployee {
  id: string;
  partnerCompanyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PartnerEmployeeRole;
  isActive: boolean;
  isOwner: boolean;
  
  // Sistema inviti sicuri
  inviteToken?: string;
  inviteExpiresAt?: string;
  invitedBy?: string;
  acceptedAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  
  // Relazioni (opzionali per includes)
  partnerCompany?: PartnerCompany;
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
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PartnerActivityLog {
  id: string;
  partnerEmployeeId: string;
  action: string; // "LOGIN", "CREATE_EMPLOYEE", "CREATE_CHILD_COMPANY", "VIEW_REGISTRATIONS"
  details?: any;  // JSON dati aggiuntivi
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ========================================
// AUTH & API INTERFACES
// ========================================

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
    isPremium: boolean;
  };
}

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

export interface AcceptInviteRequest {
  password: string;
  confirmPassword: string;
}

// ========================================
// DASHBOARD & STATS
// ========================================

export interface PartnerStats {
  // Registrazioni
  totalRegistrations: number;
  directRegistrations: number;
  indirectRegistrations: number;
  
  // Revenue (solo ADMINISTRATIVE)
  totalRevenue?: number;
  monthlyRevenue?: number;
  pendingCommissions?: number;
  
  // Performance
  conversionRate: number;
  averageTicketSize?: number;
  
  // Team (solo ADMINISTRATIVE)
  totalEmployees?: number;
  activeEmployees?: number;
  childCompanies?: number;
}

export interface RegistrationWithSource {
  id: string;
  userId: string;
  userEmail: string;
  courseId: string;
  courseName: string;
  status: string;
  isDirectRegistration: boolean;
  sourceCompanyName?: string;
  finalAmount?: number; // Nascosto per COMMERCIAL
  originalAmount?: number; // Nascosto per COMMERCIAL
  createdAt: string;
  
  // Dati utente
  user: {
    email: string;
    profile?: {
      nome: string;
      cognome: string;
      telefono: string;
      codiceFiscale: string;
    };
  };
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
    // Sia ADMINISTRATIVE che COMMERCIAL possono gestire le offerte
    return role === PartnerEmployeeRole.ADMINISTRATIVE || role === PartnerEmployeeRole.COMMERCIAL;
  },
  
  canViewAllRegistrations: (role: PartnerEmployeeRole): boolean => {
    return true; // Entrambi i ruoli possono vedere registrazioni
  },
  
  canAccessDashboard: (role: PartnerEmployeeRole): boolean => {
    return true; // Entrambi i ruoli accedono alla dashboard
  }
};

// ========================================
// LEGACY COMPATIBILITY (da rimuovere gradualmente)
// ========================================

export interface PartnerUser {
  id: string;
  registrationId: string | null;
  email: string;
  profile: {
    nome: string;
    cognome: string;
    telefono: string;
    codiceFiscale: string;
  } | null;
  status: string;
  course: string;
  courseName?: string;
  courseId: string | null;
  offerType: string | null;
  isDirectUser: boolean;
  partnerName: string;
  requestedByEmployee?: string; // NEW: Who made the registration request
  canManagePayments: boolean;
  canDelete?: boolean; // New field: can this partner delete this registration
  isOrphaned?: boolean;
  createdAt: string;
  enrollmentDate: string | null;
  examDate?: string;
  originalAmount: number;
  finalAmount: number;
  installments: number;
}

export interface Partner {
  id: string;
  userId: string;
  referralCode: string;
  canCreateChildren: boolean;
  commissionPerUser: number;
  commissionToAdmin: number;
  promotedFromChild: boolean;
  createdAt: string;
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
  uploaded: boolean;
  fileName: string | null;
  filePath: string | null;
  uploadedAt: string | null;
  documentId: string | null;
  isVerified?: boolean;
}

export interface RegistrationDocuments {
  registrationId: string;
  offerType: string;
  documents: DocumentInfo[];
  uploadedCount: number;
  totalCount: number;
  requiredCount: number;
  completedRequired: number;
}

// ========================================
// UI COMPONENT PROPS
// ========================================

export interface PartnerSidebarProps {
  partnerEmployee: PartnerEmployee;
  partnerCompany: PartnerCompany;
  currentPath: string;
}

export interface RegistrationTableProps {
  registrations: RegistrationWithSource[];
  showFinancialData: boolean;
  onRegistrationClick?: (registration: RegistrationWithSource) => void;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
}