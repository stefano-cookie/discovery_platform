export interface PartnerStats {
  totalUsers: number;
  directUsers: number;
  childrenUsers: number;
  monthlyRevenue: number;
  pendingCommissions: number;
}

export interface PartnerUser {
  id: string;
  registrationId: string;
  email: string;
  profile: {
    nome: string;
    cognome: string;
    telefono: string;
    codiceFiscale: string;
  } | null;
  status: string;
  course: string;
  courseName?: string;  // Nome del corso
  courseId: string;
  offerType: string;
  isDirectUser: boolean;
  partnerName: string;
  canManagePayments: boolean;
  // Date
  createdAt: string;        // Data registrazione utente
  enrollmentDate: string;   // Data iscrizione al corso
  examDate?: string;        // Data esame (per certificazioni)
  // Pagamenti
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