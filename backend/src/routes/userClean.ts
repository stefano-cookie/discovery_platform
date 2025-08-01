import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// Get user profile by verified email (no auth required)
router.post('/profile-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è richiesta' });
    }

    // Trova l'utente con email verificata
    const user = await prisma.user.findUnique({
      where: { 
        email,
        emailVerified: true // Solo utenti con email verificata
      },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: true
          }
        }
      }
    });

    if (!user || !user.profile) {
      return res.status(404).json({ error: 'Profilo utente non trovato o email non verificata' });
    }

    // Restituisci i dati del profilo (senza password)
    const profileData = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        user: {
          email: user.assignedPartner.user.email
        }
      } : null
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching profile by email:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/profile-by-email/:email - Get user profile by email (for verified users)
router.get('/profile-by-email/:email', async (req, res: Response) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è obbligatoria' });
    }

    const decodedEmail = decodeURIComponent(email);
    
    const user = await prisma.user.findUnique({
      where: { email: decodedEmail },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Verifica che l'utente sia verificato
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Account non ancora verificato' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        email: user.assignedPartner.user.email
      } : null
    });
  } catch (error) {
    console.error('Get user profile by email error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/profile - Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        email: user.assignedPartner.user.email
      } : null
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/registrations/:id - Get specific registration details
router.get('/registrations/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { registrationId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        userId: userId
      },
      include: {
        partner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        payments: {
          orderBy: { paymentDate: 'asc' }
        },
        deadlines: {
          orderBy: { dueDate: 'asc' }
        },
        userDocuments: {
          select: {
            id: true,
            type: true,
            fileName: true,
            originalFileName: true,
            status: true,
            uploadedAt: true
          }
        }
      }
    });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }
    
    res.json({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      originalAmount: registration.originalAmount,
      finalAmount: registration.finalAmount,
      installments: registration.installments,
      contractTemplateUrl: registration.contractTemplateUrl,
      contractSignedUrl: registration.contractSignedUrl,
      partner: {
        email: registration.partner.user.email,
        referralCode: registration.partner.referralCode
      },
      course: registration.offer?.course || null,
      offer: registration.offer ? {
        id: registration.offer.id,
        name: registration.offer.name,
        offerType: registration.offer.offerType
      } : null,
      payments: registration.payments,
      deadlines: registration.deadlines,
      documents: registration.userDocuments
    });
  } catch (error) {
    console.error('Error getting registration details:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/registrations - Get user registrations
router.get('/registrations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const registrations = await prisma.registration.findMany({
      where: { userId },
      include: {
        partner: {
          include: {
            user: {
              select: { email: true }
            }
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        payments: {
          orderBy: { paymentDate: 'asc' }
        },
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedRegistrations = registrations.map(reg => {
      const totalPaid = reg.payments
        .filter(p => p.isConfirmed)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      
      const nextDeadline = reg.deadlines
        .filter(d => !d.isPaid && new Date(d.dueDate) >= new Date())
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      
      return {
        id: reg.id,
        status: reg.status,
        createdAt: reg.createdAt,
        originalAmount: reg.originalAmount,
        finalAmount: reg.finalAmount,
        installments: reg.installments,
        totalPaid,
        remainingAmount: Number(reg.finalAmount) - totalPaid,
        nextDeadline: nextDeadline ? {
          amount: nextDeadline.amount,
          dueDate: nextDeadline.dueDate,
          paymentNumber: nextDeadline.paymentNumber
        } : null,
        partner: {
          email: reg.partner.user.email,
          referralCode: reg.partner.referralCode
        },
        course: reg.offer?.course || null,
        offer: reg.offer ? {
          id: reg.offer.id,
          name: reg.offer.name,
          offerType: reg.offer.offerType
        } : null
      };
    });
    
    res.json({ registrations: formattedRegistrations });
  } catch (error) {
    console.error('Error getting user registrations:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/available-courses - Get available courses for user
router.get('/available-courses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Get user with partner assignment
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignedPartner: true
      }
    });
    
    if (!user || !user.assignedPartner) {
      return res.status(404).json({ error: 'Partner non assegnato' });
    }
    
    // Get partner's offers with visibility settings
    const partnerOffers = await prisma.partnerOffer.findMany({
      where: { 
        partnerId: user.assignedPartner.id,
        isActive: true
      },
      include: {
        course: true,
        visibilities: {
          where: {
            userId: userId
          }
        },
        userAccess: {
          where: {
            userId: userId,
            enabled: true
          }
        }
      }
    });
    
    // Filter offers based on visibility settings and user access
    const availableOffers = partnerOffers.filter(offer => {
      // Check visibility setting (default to visible if no setting exists)
      const visibilityRecord = offer.visibilities[0];
      const isVisible = visibilityRecord ? visibilityRecord.isVisible : true;
      
      if (!isVisible) return false;
      
      // If user has specific access record, they can see it
      if (offer.userAccess.length > 0) return true;
      
      // Check if this is their original offer (they registered through this offer)
      // This will be checked later in the registration query
      return true;
    });
    
    // Get user's registrations (original offers they signed up for)
    const userRegistrations = await prisma.registration.findMany({
      where: { userId },
      select: { partnerOfferId: true }
    });
    
    const registeredOfferIds = userRegistrations
      .filter(reg => reg.partnerOfferId)
      .map(reg => reg.partnerOfferId);
    
    // Format response
    const courses = availableOffers.map(offer => ({
      id: offer.course.id,
      name: offer.course.name,
      description: offer.course.description,
      templateType: offer.course.templateType,
      offer: {
        id: offer.id,
        name: offer.name,
        offerType: offer.offerType,
        totalAmount: offer.totalAmount,
        installments: offer.installments,
        installmentFrequency: offer.installmentFrequency,
        referralLink: offer.referralLink,
        isOriginalOffer: registeredOfferIds.includes(offer.id),
        hasAccess: offer.userAccess.length > 0 || registeredOfferIds.includes(offer.id)
      }
    }));
    
    res.json({ courses });
  } catch (error) {
    console.error('Error getting available courses:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Send verification email
router.post('/send-verification', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email già verificata' });
    }
    
    // Send verification email
    await emailService.sendEmailVerification(user.email, user.emailVerificationToken!);
    
    res.json({ message: 'Email di verifica inviata con successo' });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;