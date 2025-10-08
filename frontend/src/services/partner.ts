import { partnerApiRequest } from './partnerApi';
import { PartnerStats, PartnerUser, RegistrationDocuments } from '../types/partner';

export const partnerService = {
  async getStats(): Promise<PartnerStats> {
    return partnerApiRequest<PartnerStats>({
      method: 'GET',
      url: '/partners/stats',
    });
  },

  async getUsers(filter: 'all' | 'direct' | 'children' | 'orphaned' = 'all', subPartner?: string): Promise<{users: PartnerUser[], total: number}> {
    const params = new URLSearchParams({ filter });
    if (subPartner) {
      params.append('subPartner', subPartner);
    }
    return partnerApiRequest<{users: PartnerUser[], total: number}>({
      method: 'GET',
      url: `/partners/users?${params.toString()}`,
    });
  },

  async promoteUser(userId: string): Promise<{ success: boolean }> {
    return partnerApiRequest<{ success: boolean }>({
      method: 'POST',
      url: `/partners/promote/${userId}`,
    });
  },

  async addPayment(userId: string, amount: number): Promise<{ success: boolean }> {
    return partnerApiRequest<{ success: boolean }>({
      method: 'POST',
      url: `/partners/payment`,
      data: { userId, amount },
    });
  },

  // User offer access management
  async getUserOffers(userId: string): Promise<any[]> {
    return partnerApiRequest<any[]>({
      method: 'GET',
      url: `/partners/users/${userId}/offers`,
    });
  },

  async grantUserOfferAccess(userId: string, offerId: string): Promise<{ success: boolean; message: string }> {
    return partnerApiRequest<{ success: boolean; message: string }>({
      method: 'POST',
      url: `/partners/users/${userId}/offers/${offerId}/grant`,
    });
  },

  async revokeUserOfferAccess(userId: string, offerId: string): Promise<{ success: boolean; message: string }> {
    return partnerApiRequest<{ success: boolean; message: string }>({
      method: 'POST',
      url: `/partners/users/${userId}/offers/${offerId}/revoke`,
    });
  },

  async getRegistrationDocuments(registrationId: string): Promise<RegistrationDocuments> {
    return partnerApiRequest<RegistrationDocuments>({
      method: 'GET',
      url: `/partners/registrations/${registrationId}/documents`,
    });
  },

  // Registration details for enrollment detail page
  async getRegistrationDetails(registrationId: string): Promise<any> {
    return partnerApiRequest<any>({
      method: 'GET',
      url: `/partners/registrations/${registrationId}`,
    });
  },

  // Get recent enrollments for dashboard
  async getRecentEnrollments(): Promise<any[]> {
    return partnerApiRequest<any[]>({
      method: 'GET',
      url: '/partners/recent-enrollments',
    });
  },

  // Get analytics data for charts
  async getAnalytics(): Promise<any> {
    return partnerApiRequest<any>({
      method: 'GET',
      url: '/partners/analytics',
    });
  },

  // Delete registration
  async deleteRegistration(registrationId: string): Promise<{
    success: boolean;
    message: string;
    userOrphaned?: boolean;
    userId?: string;
  }> {
    return partnerApiRequest<{
      success: boolean;
      message: string;
      userOrphaned?: boolean;
      userId?: string;
    }>({
      method: 'DELETE',
      url: `/partners/registrations/${registrationId}`,
    });
  },

  // Get available offers for reactivating users
  async getOffers(): Promise<{ offers: any[] }> {
    return partnerApiRequest<{ offers: any[] }>({
      method: 'GET',
      url: '/partners/offers',
    });
  },

  // Toggle offer status (active/inactive)
  async toggleOfferStatus(offerId: string, isActive: boolean): Promise<{ success: boolean; offer: any }> {
    return partnerApiRequest<{ success: boolean; offer: any }>({
      method: 'PUT',
      url: `/offers/${offerId}`,
      data: { isActive },
    });
  },


  // Delete orphaned user
  async deleteOrphanedUser(userId: string): Promise<{ success: boolean; message: string }> {
    return partnerApiRequest<{ success: boolean; message: string }>({
      method: 'DELETE',
      url: `/partners/users/${userId}/orphaned`,
    });
  },

  // Delete all orphaned users (ADMINISTRATIVE only)
  async deleteAllOrphanedUsers(): Promise<{ success: boolean; message: string; deletedCount: number; deletedUsers: any[] }> {
    return partnerApiRequest<{ success: boolean; message: string; deletedCount: number; deletedUsers: any[] }>({
      method: 'DELETE',
      url: `/partners/users/orphaned/all`,
    });
  },

  // ==================================================
  // ACTION TOKEN SYSTEM for tracking partner actions
  // ==================================================

  // Create action token for tracking
  async createActionToken(actionType: 'GRANT_ACCESS' | 'REACTIVATE_USER', targetUserId?: string, targetOfferId?: string): Promise<{
    success: boolean;
    token: string;
    expiresAt: string;
    actionType: string;
  }> {
    return partnerApiRequest<{
      success: boolean;
      token: string;
      expiresAt: string;
      actionType: string;
    }>({
      method: 'POST',
      url: '/partners/actions/create-token',
      data: {
        actionType,
        targetUserId,
        targetOfferId
      }
    });
  },

  // Grant user access with token tracking
  async grantUserOfferAccessWithToken(userId: string, offerId: string, actionToken?: string): Promise<{ success: boolean; message: string }> {
    return partnerApiRequest<{ success: boolean; message: string }>({
      method: 'POST',
      url: `/partners/users/${userId}/offers/${offerId}/grant`,
      data: actionToken ? { actionToken } : undefined
    });
  },

  // Reactivate user with token tracking
  async reactivateUserWithToken(userId: string, offerId: string, finalAmount: number, actionToken?: string): Promise<{
    message: string;
    registration: {
      id: string;
      status: string;
      courseName: string;
      finalAmount: number;
    };
  }> {
    return partnerApiRequest<{
      message: string;
      registration: {
        id: string;
        status: string;
        courseName: string;
        finalAmount: number;
      };
    }>({
      method: 'POST',
      url: `/partners/users/${userId}/reactivate`,
      data: {
        offerId,
        finalAmount,
        ...(actionToken && { actionToken })
      }
    });
  },

  // Update user profile (anagrafica)
  async updateUserProfile(userId: string, profileData: any): Promise<{ success: boolean; message: string; profile: any }> {
    return partnerApiRequest<{ success: boolean; message: string; profile: any }>({
      method: 'PATCH',
      url: `/partners/users/${userId}/profile`,
      data: profileData
    });
  },

};