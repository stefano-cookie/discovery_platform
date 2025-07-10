export interface PartnerStats {
  totalUsers: number;
  directUsers: number;
  childrenUsers: number;
  monthlyRevenue: number;
  pendingCommissions: number;
}

export interface PartnerUser {
  id: string;
  email: string;
  profile: {
    nome: string;
    cognome: string;
    telefono: string;
    codiceFiscale: string;
  } | null;
  status: string;
  course: string;
  isDirectUser: boolean;
  partnerName: string;
  canManagePayments: boolean;
  createdAt: string;
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