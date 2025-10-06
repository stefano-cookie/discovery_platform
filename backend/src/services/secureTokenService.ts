import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { OfferInheritanceService } from './offerInheritanceService';

const prisma = new PrismaClient();

export class SecureTokenService {
  // Genera un token sicuro per l'accesso al form di iscrizione
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Crea o aggiorna token per un utente verificato
  static async createAccessToken(userId: string, referralCode: string, employeeId?: string | null): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token valido 24 ore


    // Use provided employee ID directly
    let potentialEmployeeId = employeeId;
    if (employeeId) {
      // Using provided employee ID
    }

    // Find the offer from referral code to get basic info
    const offer = await prisma.partnerOffer.findUnique({
      where: { referralLink: referralCode },
      include: { course: true, partner: true }
    });

    if (!offer) {
      throw new Error('Offerta non trovata');
    }

    // Check if user exists and assign partner if needed
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('Utente non trovato');
    }

    // If user doesn't have an assigned partner, assign from offer
    if (!user.assignedPartnerId) {
      await prisma.user.update({
        where: { id: userId },
        data: { assignedPartnerId: offer.partnerId }
      });
    }

    // Validate employee ID if present
    let validatedEmployeeId = null;
    if (potentialEmployeeId) {
      try {
        const employee = await prisma.partnerEmployee.findUnique({
          where: { id: potentialEmployeeId },
          include: { partnerCompany: true }
        });

        // For secureTokenService, we accept any active employee since the referral link
        // already determines the correct company context
        if (employee && employee.isActive) {
          validatedEmployeeId = employee.id;
          // Valid employee found
        } else if (employee) {
          // Employee found but inactive
        } else {
          // Employee ID not found
        }
      } catch (error) {
        // Error validating employee ID
      }
    }

    // Check if there's already a PENDING registration for this user and offer
    // If yes, just update the token. If no, create a placeholder registration
    let registration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerOfferId: offer.id,
        status: 'PENDING'
      }
    });

    if (!registration) {
      // Calculate partner company tracking fields using OfferInheritanceService
      let partnerCompanyId = null;
      let sourcePartnerCompanyId = null;
      let isDirectRegistration = true;
      
      try {
        const { parentCompany, childCompany, isSubPartnerRegistration } = 
          await OfferInheritanceService.findCompaniesByReferralLink(referralCode);
        
        if (isSubPartnerRegistration && childCompany) {
          // Sub-partner registration: parent manages, child is source
          partnerCompanyId = parentCompany.id;
          sourcePartnerCompanyId = childCompany.id;
          isDirectRegistration = false;
          // Sub-partner registration
        } else {
          // Direct parent registration
          partnerCompanyId = parentCompany.id;
          sourcePartnerCompanyId = parentCompany.id;
          isDirectRegistration = true;
          // Direct registration
        }
      } catch (error) {
        // Error calculating partner tracking fields
        // Fallback to offer's company
        partnerCompanyId = offer.partnerCompanyId;
        sourcePartnerCompanyId = offer.partnerCompanyId;
      }

      // Create a minimal registration that will be completed when user submits the form
      registration = await prisma.registration.create({
        data: {
          userId,
          partnerId: offer.partnerId || '',
          partnerCompanyId: partnerCompanyId,
          sourcePartnerCompanyId: sourcePartnerCompanyId,
          requestedByEmployeeId: validatedEmployeeId || undefined, // 🎯 Track referring employee
          isDirectRegistration: isDirectRegistration,
          courseId: offer.courseId,
          partnerOfferId: offer.id,
          offerType: offer.offerType,
          originalAmount: offer.totalAmount,
          finalAmount: offer.totalAmount,
          remainingAmount: offer.totalAmount,
          installments: offer.installments,
          status: 'PENDING',
          accessToken: token,
          tokenExpiresAt: expiresAt
        }
      });
      // Created placeholder registration with token
    } else {
      // Update existing registration with new token and employee info
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: {
          accessToken: token,
          tokenExpiresAt: expiresAt,
          requestedByEmployeeId: validatedEmployeeId // 🎯 Update employee tracking
        }
      });
      // Updated existing registration with new token
    }

    return token;
  }

  // Verifica e recupera i dati associati a un token
  static async verifyToken(token: string): Promise<{
    user: any;
    profile: any;
    registration: any;
    assignedPartner: any;
  } | null> {
    if (!token) return null;

    const registration = await prisma.registration.findUnique({
      where: { accessToken: token },
      include: {
        user: {
          include: {
            profile: true,
            assignedPartner: {
              include: { user: true }
            }
          }
        },
        offer: {
          include: { course: true }
        }
      }
    });

    if (!registration || !registration.tokenExpiresAt) {
      return null;
    }

    // Verifica se il token è scaduto
    if (registration.tokenExpiresAt < new Date()) {
      // Token scaduto, rimuovilo
      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          accessToken: null,
          tokenExpiresAt: null
        }
      });
      return null;
    }

    return {
      user: {
        id: registration.user.id,
        email: registration.user.email,
        role: registration.user.role,
        emailVerified: registration.user.emailVerified
      },
      profile: registration.user.profile,
      registration: {
        id: registration.id,
        status: registration.status,
        offerType: registration.offerType,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments,
        offer: registration.offer
      },
      assignedPartner: registration.user.assignedPartner ? {
        id: registration.user.assignedPartner.id,
        referralCode: registration.user.assignedPartner.referralCode,
        user: {
          email: registration.user.assignedPartner.user.email
        }
      } : null
    };
  }

  // Invalidate token after successful registration completion
  static async invalidateToken(token: string): Promise<void> {
    await prisma.registration.updateMany({
      where: { accessToken: token },
      data: {
        accessToken: null,
        tokenExpiresAt: null
      }
    });
  }
}

export default SecureTokenService;