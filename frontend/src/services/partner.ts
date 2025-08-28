import { apiRequest } from './api';
import { PartnerStats, PartnerUser, RegistrationDocuments } from '../types/partner';

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

  // User offer access management
  async getUserOffers(userId: string): Promise<any[]> {
    return apiRequest<any[]>({
      method: 'GET',
      url: `/partners/users/${userId}/offers`,
    });
  },

  async grantUserOfferAccess(userId: string, offerId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      method: 'POST',
      url: `/partners/users/${userId}/offers/${offerId}/grant`,
    });
  },

  async revokeUserOfferAccess(userId: string, offerId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      method: 'POST',
      url: `/partners/users/${userId}/offers/${offerId}/revoke`,
    });
  },

  async getRegistrationDocuments(registrationId: string): Promise<RegistrationDocuments> {
    return apiRequest<RegistrationDocuments>({
      method: 'GET',
      url: `/partners/registrations/${registrationId}/documents`,
    });
  },

  // Registration details for enrollment detail page
  async getRegistrationDetails(registrationId: string): Promise<any> {
    return apiRequest<any>({
      method: 'GET',
      url: `/partners/registrations/${registrationId}`,
    });
  },

  // Get recent enrollments for dashboard
  async getRecentEnrollments(): Promise<any[]> {
    return apiRequest<any[]>({
      method: 'GET',
      url: '/partners/recent-enrollments',
    });
  },

  // Get analytics data for charts
  async getAnalytics(): Promise<any> {
    return apiRequest<any>({
      method: 'GET',
      url: '/partners/analytics',
    });
  },

  // Delete registration
  async deleteRegistration(registrationId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      method: 'DELETE',
      url: `/partners/registrations/${registrationId}`,
    });
  },
};