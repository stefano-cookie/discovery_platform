export interface Course {
  id: string;
  name: string;
  description?: string;
  templateType: 'TFA' | 'CERTIFICATION';
  isActive: boolean;
  createdAt: string;
}

export interface Partner {
  referralCode: string;
  user: {
    email: string;
  };
}

export interface CustomPaymentPlan {
  payments: Array<{
    amount: number;
    dueDate: string;
  }>;
}

export interface PartnerOffer {
  id: string;
  partnerId: string;
  courseId: string;
  name: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalAmount: number;
  installments: number;
  installmentFrequency: number;
  customPaymentPlan?: CustomPaymentPlan;
  referralLink: string;
  isActive: boolean;
  createdAt: string;
  course?: Course;
  partner?: Partner;
  _count?: {
    registrations: number;
  };
}

export interface FormConfig {
  templateType: 'TFA' | 'CERTIFICATION';
  steps: string[];
  requiredFields: {
    [stepName: string]: string[];
  };
}

export interface OfferInfo {
  id: string;
  partnerId: string;
  courseId: string;
  name: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalAmount: string | number;
  installments: number;
  installmentFrequency: number;
  customPaymentPlan?: CustomPaymentPlan;
  referralLink: string;
  isActive: boolean;
  createdAt: string;
  course: Course;
  partner: Partner;
}

export interface CreateOfferData {
  courseId: string;
  name: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalAmount: number;
  installments: number;
  installmentFrequency: number;
  customPaymentPlan?: CustomPaymentPlan;
}

export interface UpdateOfferData {
  name?: string;
  totalAmount?: number;
  installments?: number;
  installmentFrequency?: number;
  customPaymentPlan?: CustomPaymentPlan;
  isActive?: boolean;
}