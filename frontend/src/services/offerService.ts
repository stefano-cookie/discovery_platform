import apiClient from './api';
import { PartnerOffer, CreateOfferData, UpdateOfferData, OfferInfo } from '../types/offers';

export class OfferService {
  
  // Get all offers for authenticated partner
  static async getOffers(): Promise<PartnerOffer[]> {
    const response = await apiClient.get('/offers');
    return response.data;
  }

  // Get specific offer by ID
  static async getOffer(id: string): Promise<PartnerOffer> {
    const response = await apiClient.get(`/offers/${id}`);
    return response.data;
  }

  // Create new offer
  static async createOffer(data: CreateOfferData): Promise<PartnerOffer> {
    const response = await apiClient.post('/offers', data);
    return response.data;
  }

  // Update existing offer
  static async updateOffer(id: string, data: UpdateOfferData): Promise<PartnerOffer> {
    const response = await apiClient.put(`/offers/${id}`, data);
    return response.data;
  }

  // Delete offer
  static async deleteOffer(id: string): Promise<void> {
    await apiClient.delete(`/offers/${id}`);
  }

  // Get offer information by referral link (public endpoint)
  static async getOfferByLink(referralLink: string): Promise<OfferInfo> {
    const response = await apiClient.get(`/offers/by-link/${referralLink}`);
    return response.data;
  }

  // Generate payment plan preview
  static generatePaymentPlan(
    totalAmount: number, 
    installments: number, 
    startDate: Date = new Date()
  ): Array<{ amount: number; dueDate: string }> {
    const payments = [];
    const amountPerInstallment = Math.round((totalAmount / installments) * 100) / 100;
    
    for (let i = 0; i < installments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + i);
      
      // Set due date to 30th of the month
      dueDate.setDate(30);
      
      // If the month doesn't have a 30th day (February), use the last day
      if (dueDate.getMonth() !== (startDate.getMonth() + i) % 12) {
        dueDate.setDate(0); // Sets to last day of previous month
      }
      
      payments.push({
        amount: i === installments - 1 
          ? totalAmount - (amountPerInstallment * (installments - 1)) // Adjust last payment for rounding
          : amountPerInstallment,
        dueDate: dueDate.toISOString().split('T')[0]
      });
    }
    
    return payments;
  }

  // Format payment plan for display
  static formatPaymentPlan(customPaymentPlan?: any): Array<{ amount: number; dueDate: string; formattedDate: string }> {
    if (!customPaymentPlan?.payments) {
      return [];
    }
    
    return customPaymentPlan.payments.map((payment: any) => ({
      amount: payment.amount,
      dueDate: payment.dueDate,
      formattedDate: new Date(payment.dueDate).toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }));
  }
}