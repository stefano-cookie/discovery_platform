import api from './api';

export interface SubPartner {
  id: string;
  name: string;
  referralCode: string;
  isActive: boolean;
  hierarchyLevel: number;
  createdAt: string;
  employees: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isOwner: boolean;
    createdAt: string;
  }[];
  stats: {
    totalRegistrations: number;
    indirectRegistrations: number;
    employeeCount: number;
  };
}

export interface CompanyInvite {
  id: string;
  email: string;
  companyName: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
}

export interface SubPartnerAnalytics {
  summary: {
    totalSubPartners: number;
    directRegistrations: number;
    indirectRegistrations: number;
    totalRegistrations: number;
    totalRevenue: number;
  };
  monthlyStats: {
    month: string;
    registrations: number;
    revenue: number;
  }[];
}

class SubPartnerApiService {
  // Get list of sub-partners
  async getSubPartners(): Promise<SubPartner[]> {
    const response = await api.get('/sub-partners');
    return response.data.data;
  }

  // Send company invitation
  async sendCompanyInvite(data: {
    email: string;
    companyName: string;
  }): Promise<void> {
    await api.post('/sub-partners/invite', data);
  }

  // Get company invitations
  async getCompanyInvites(): Promise<CompanyInvite[]> {
    const response = await api.get('/sub-partners/invites');
    return response.data.data;
  }

  // Revoke company invitation
  async revokeCompanyInvite(inviteId: string): Promise<void> {
    await api.delete(`/sub-partners/invites/${inviteId}`);
  }

  // Accept company invitation (public endpoint)
  async acceptCompanyInvite(
    token: string,
    data: {
      firstName: string;
      lastName: string;
      password: string;
      referralCode: string;
    }
  ): Promise<void> {
    await api.post(`/sub-partners/accept-invite/${token}`, data);
  }

  // Get aggregated analytics
  async getAnalytics(): Promise<SubPartnerAnalytics> {
    const response = await api.get('/sub-partners/analytics');
    return response.data.data;
  }

  // Update sub-partner status
  async updateSubPartnerStatus(
    companyId: string,
    isActive: boolean
  ): Promise<void> {
    await api.put(`/sub-partners/${companyId}/status`, { isActive });
  }
}

const subPartnerApiInstance = new SubPartnerApiService();
export default subPartnerApiInstance;