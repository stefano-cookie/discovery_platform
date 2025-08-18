import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class SecureTokenService {
  // Genera un token sicuro per l'accesso al form di iscrizione
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Crea o aggiorna token per un utente verificato
  static async createAccessToken(userId: string, referralCode: string): Promise<string> {
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token valido 24 ore

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
      // Create a minimal registration that will be completed when user submits the form
      registration = await prisma.registration.create({
        data: {
          userId,
          partnerId: offer.partnerId,
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
      console.log(`Created placeholder registration ${registration.id} with token for user ${userId}`);
    } else {
      // Update existing registration with new token
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: {
          accessToken: token,
          tokenExpiresAt: expiresAt
        }
      });
      console.log(`Updated existing registration ${registration.id} with new token for user ${userId}`);
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