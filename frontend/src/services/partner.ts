import { apiRequest } from './api';
import { PartnerStats, PartnerUser } from '../types/partner';

export const partnerService = {
  async getStats(): Promise<PartnerStats> {
    return apiRequest<PartnerStats>({
      method: 'GET',
      url: '/partners/stats',
    });
  },

  async getUsers(filter: 'all' | 'direct' | 'children' = 'all'): Promise<PartnerUser[]> {
    return apiRequest<PartnerUser[]>({
      method: 'GET',
      url: `/partners/users?filter=${filter}`,
    });
  },

  async promoteUser(userId: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>({
      method: 'POST',
      url: `/partners/promote/${userId}`,
    });
  },

  async addPayment(userId: string, amount: number): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>({
      method: 'POST',
      url: `/partners/payment`,
      data: { userId, amount },
    });
  },
};