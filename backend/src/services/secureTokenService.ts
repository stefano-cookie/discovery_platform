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

    // Verifica se esiste già una registrazione in corso per questo utente
    let registration = await prisma.registration.findFirst({
      where: {
        userId,
        status: 'PENDING'
      }
    });

    if (!registration) {
      // Crea una nuova registrazione temporanea per il form
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { assignedPartner: true }
      });

      if (!user || !user.assignedPartner) {
        throw new Error('Utente non trovato o partner non assegnato');
      }

      // Trova l'offerta dal referral code
      const offer = await prisma.partnerOffer.findUnique({
        where: { referralLink: referralCode },
        include: { course: true }
      });

      if (!offer) {
        throw new Error('Offerta non trovata');
      }

      registration = await prisma.registration.create({
        data: {
          userId,
          partnerId: user.assignedPartner.id,
          courseId: offer.courseId,
          partnerOfferId: offer.id,
          offerType: offer.offerType,
          originalAmount: offer.totalAmount,
          finalAmount: offer.totalAmount,
          installments: offer.installments,
          accessToken: token,
          tokenExpiresAt: expiresAt
        }
      });
    } else {
      // Aggiorna token esistente
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: {
          accessToken: token,
          tokenExpiresAt: expiresAt
        }
      });
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