import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import SecureTokenService from '../services/secureTokenService';
import { ContractServicePDFKit } from '../services/contractServicePDFKit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import unifiedDownload from '../middleware/unifiedDownload';
import storageManager from '../services/storageManager';

const contractService = new ContractServicePDFKit();
const router = Router();
const prisma = new PrismaClient();

// Helper function to find project root directory
function getProjectRoot(): string {
  // In development: __dirname is like /path/to/project/backend/src/routes
  // In production: __dirname is like /path/to/project/backend/dist/routes

  let currentDir = __dirname;

  // Walk up the directory tree to find the project root
  // Look for package.json or backend directory to identify project root
  while (currentDir !== path.dirname(currentDir)) { // Not at filesystem root
    const parentDir = path.dirname(currentDir);

    // Check if parent contains backend directory (indicating project root)
    if (fs.existsSync(path.join(parentDir, 'backend')) &&
        (fs.existsSync(path.join(parentDir, 'package.json')) ||
         fs.existsSync(path.join(parentDir, 'frontend')))) {
      console.log(`[USER_ROUTES] Found project root: ${parentDir}`);
      return parentDir;
    }

    currentDir = parentDir;
  }

  // Fallback: use process.cwd() if we can't find the root
  console.log(`[USER_ROUTES] Could not find project root, using process.cwd(): ${process.cwd()}`);
  return process.cwd();
}

// Multer configuration for user document uploads - using memory storage for R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato'));
    }
  }
});

// Get user profile by secure access token (no auth required)
router.post('/profile-by-token', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Token di accesso è richiesto' });
    }

    // Verifica il token e recupera i dati associati
    const tokenData = await SecureTokenService.verifyToken(accessToken);
    
    if (!tokenData) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    res.json(tokenData);
    
  } catch (error) {
    console.error('Profile by token error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get user profile by verified email (no auth required) - DEPRECATED
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
            originalName: true,
            status: true,
            uploadedAt: true
          }
        }
      }
    });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }
    
    // DEBUG LOGS
    console.log('=== DEBUG /user/registrations/:id (userClean.ts) ===');
    console.log('Registration ID:', registrationId);
    console.log('User ID:', userId);
    console.log('Found registration:', {
      id: registration.id,
      offerName: registration.offer?.name,
      courseName: registration.offer?.course?.name,
      offerType: registration.offer?.offerType,
      status: registration.status
    });
    
    // Calculate payment summary
    const totalPaid = registration.deadlines.reduce((sum, deadline) => {
      if (deadline.isPaid) {
        return sum + Number(deadline.amount);
      } else if (deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount) {
        return sum + Number(deadline.partialAmount);
      }
      return sum;
    }, 0);
    
    const remainingAmount = Number(registration.finalAmount) - totalPaid;
    
    const totalDelayedAmount = registration.deadlines.reduce((sum, deadline) => {
      if (deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount) {
        return sum + (Number(deadline.amount) - Number(deadline.partialAmount));
      }
      return sum;
    }, 0);

    // Calculate certification steps if applicable
    let steps = undefined;
    if (registration.offer?.offerType === 'CERTIFICATION') {
      const allDeadlinesPaid = registration.deadlines.every(d => d.paymentStatus === 'PAID');

      steps = {
        enrollment: {
          step: 1,
          title: 'Iscrizione Completata',
          description: 'La tua iscrizione al corso di certificazione è stata completata',
          completed: true,
          completedAt: registration.createdAt.toISOString(),
          status: 'completed' as const
        },
        payment: {
          step: 2,
          title: allDeadlinesPaid ? 'Pagamento Completato' : 'Pagamento',
          description: allDeadlinesPaid ? 'Tutti i pagamenti sono stati completati' : 'In attesa del pagamento tramite bonifico',
          completed: allDeadlinesPaid,
          completedAt: allDeadlinesPaid ? registration.deadlines.find(d => d.paymentStatus === 'PAID')?.paidAt?.toISOString() : null,
          status: allDeadlinesPaid ? 'completed' as const :
                  (['PENDING', 'DATA_VERIFIED', 'DOCUMENTS_UPLOADED', 'DOCUMENTS_PARTNER_CHECKED', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED'].includes(registration.status) ? 'current' as const : 'pending' as const)
        },
        documentsApproved: {
          step: 3,
          title: 'Documenti Approvati',
          description: 'Carta d\'identità e tessera sanitaria verificate',
          completed: ['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status),
          completedAt: ['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) ?
                       (registration.enrolledAt?.toISOString() || new Date().toISOString()) : null,
          status: registration.status === 'ENROLLED' && allDeadlinesPaid ? 'current' as const :
                  (['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) ? 'completed' as const : 'pending' as const)
        },
        examRegistered: {
          step: 4,
          title: 'Iscritto all\'Esame',
          description: 'Iscrizione all\'esame di certificazione confermata',
          completed: ['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) || !!registration.examDate,
          completedAt: registration.examDate?.toISOString() || null,
          status: registration.status === 'DOCUMENTS_APPROVED' ? 'current' as const :
                  (['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) || !!registration.examDate ? 'completed' as const : 'pending' as const)
        },
        examCompleted: {
          step: 5,
          title: 'Esame Sostenuto',
          description: 'Esame di certificazione completato con successo',
          completed: registration.status === 'COMPLETED' || !!registration.examCompletedDate,
          completedAt: registration.examCompletedDate?.toISOString() || null,
          status: registration.status === 'EXAM_REGISTERED' || !!registration.examDate ? 'current' as const :
                  (registration.status === 'COMPLETED' || !!registration.examCompletedDate ? 'completed' as const : 'pending' as const)
        }
      };
    }

    res.json({
      registration: {
        id: registration.id,
        courseId: registration.offer?.course?.id || 'unknown',
        courseName: registration.offer?.name || registration.offer?.course?.name || 'Corso non specificato',
        status: registration.status,
        originalAmount: Number(registration.originalAmount),
        finalAmount: Number(registration.finalAmount),
        installments: registration.installments,
        offerType: registration.offer?.offerType || 'TFA_ROMANIA',
        createdAt: registration.createdAt.toISOString(),
        totalPaid,
        remainingAmount,
        delayedAmount: totalDelayedAmount,
        contractTemplateUrl: registration.contractTemplateUrl,
        contractSignedUrl: registration.contractSignedUrl,
        contractGeneratedAt: registration.contractGeneratedAt?.toISOString(),
        contractUploadedAt: registration.contractUploadedAt?.toISOString(),
        partner: {
          referralCode: registration.partner?.referralCode || '',
          user: {
            email: registration.partner?.user?.email || ''
          }
        },
        deadlines: (registration.deadlines || []).map((deadline: any) => ({
          id: deadline.id,
          amount: Number(deadline.amount),
          dueDate: deadline.dueDate.toISOString(),
          paymentNumber: deadline.paymentNumber,
          isPaid: deadline.isPaid,
          partialAmount: deadline.partialAmount ? Number(deadline.partialAmount) : null,
          paymentStatus: deadline.paymentStatus,
          notes: deadline.notes
        })),
        steps // Add steps for CERTIFICATION enrollments
      }
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
    
    // DEBUG LOGS
    console.log('=== DEBUG /user/registrations (userClean.ts) ===');
    console.log('User ID:', userId);
    console.log('Raw registrations:', registrations.map(r => ({ 
      id: r.id, 
      offerName: r.offer?.name, 
      courseName: r.offer?.course?.name,
      offerType: r.offer?.offerType 
    })));
    
    const formattedRegistrations = registrations.map(reg => {
      // Calculate total paid amount including custom payments
      const totalPaid = reg.deadlines.reduce((sum, deadline) => {
        if (deadline.isPaid) {
          return sum + Number(deadline.amount);
        } else if (deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount) {
          return sum + Number(deadline.partialAmount);
        }
        return sum;
      }, 0);
      
      // Find next payment deadline (first unpaid and non-partial deadline)
      const now = new Date();
      const nextDeadline = reg.deadlines
        .filter(d => !d.isPaid && d.paymentStatus !== 'PARTIAL')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      
      // Calculate total delayed amount from custom payments
      const totalDelayedAmount = reg.deadlines.reduce((sum, deadline) => {
        if (deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount) {
          return sum + (Number(deadline.amount) - Number(deadline.partialAmount));
        }
        return sum;
      }, 0);
      
      // Calculate payment summary for frontend
      const paidInstallments = reg.deadlines.filter(d => d.isPaid).length;
      const customInstallments = reg.deadlines.filter(d => d.paymentStatus === 'PARTIAL').length;
      const totalInstallments = reg.deadlines.length;
      const unpaidInstallments = reg.deadlines.filter(d => !d.isPaid && d.paymentStatus !== 'PARTIAL').length;
      const percentagePaid = Number(reg.finalAmount) > 0 ? Math.round((totalPaid / Number(reg.finalAmount)) * 100) : 0;
      
      const paymentSummary = nextDeadline ? {
        nextDeadline: {
          id: nextDeadline.id,
          amount: Number(nextDeadline.amount),
          dueDate: nextDeadline.dueDate.toISOString(),
          paymentNumber: nextDeadline.paymentNumber,
          daysUntilDue: Math.ceil((new Date(nextDeadline.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          isOverdue: new Date(nextDeadline.dueDate) < now
        },
        paidInstallments,
        customInstallments,
        unpaidInstallments,
        totalInstallments,
        percentagePaid
      } : {
        nextDeadline: null,
        paidInstallments,
        customInstallments,
        unpaidInstallments,
        totalInstallments,
        percentagePaid
      };
      
      return {
        id: reg.id,
        courseId: reg.offer?.course?.id || 'unknown',
        courseName: reg.offer?.name || reg.offer?.course?.name || 'Corso non specificato', // Use partner's template name
        status: reg.status,
        createdAt: reg.createdAt,
        originalAmount: reg.originalAmount,
        finalAmount: reg.finalAmount,
        installments: reg.installments,
        offerType: reg.offer?.offerType || 'TFA_ROMANIA',
        totalPaid,
        remainingAmount: Number(reg.finalAmount) - totalPaid,
        delayedAmount: totalDelayedAmount,
        paymentSummary,
        nextDeadline: nextDeadline ? {
          amount: nextDeadline.amount,
          dueDate: nextDeadline.dueDate,
          paymentNumber: nextDeadline.paymentNumber
        } : null,
        partner: {
          referralCode: reg.partner.referralCode,
          user: {
            email: reg.partner.user.email
          }
        },
        deadlines: reg.deadlines.map(deadline => ({
          id: deadline.id,
          amount: Number(deadline.amount),
          dueDate: deadline.dueDate.toISOString(),
          paymentNumber: deadline.paymentNumber,
          isPaid: deadline.isPaid,
          partialAmount: deadline.partialAmount ? Number(deadline.partialAmount) : null,
          paymentStatus: deadline.paymentStatus,
          notes: deadline.notes
        })),
        payments: reg.payments.map(payment => ({
          id: payment.id,
          amount: Number(payment.amount),
          paymentDate: payment.paymentDate.toISOString(),
          isConfirmed: payment.isConfirmed,
          paymentNumber: payment.paymentNumber || 1
        }))
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
    
    // Get user with partner assignment (legacy or new system)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignedPartner: true,
        assignedPartnerCompany: true
      }
    });

    // Check both legacy partner and new partner company
    const partner = user?.assignedPartner;
    const partnerCompany = user?.assignedPartnerCompany;

    // If user has no partner assigned (orphan user), return empty courses
    if (!user || (!partner && !partnerCompany)) {
      console.log('👤 Orphan user (userClean.ts) - no partner assigned, returning empty courses');
      return res.json({
        courses: [],
        message: 'Nessun partner assegnato. Le tue iscrizioni sono gestite direttamente.'
      });
    }
    
    // Get partner's offers with visibility settings
    const partnerId = partner?.id;
    const partnerCompanyId = partnerCompany?.id;

    const partnerOffers = await prisma.partnerOffer.findMany({
      where: {
        OR: [
          partnerId ? { partnerId } : {},
          partnerCompanyId ? { partnerCompanyId } : {}
        ].filter(obj => Object.keys(obj).length > 0),
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
    
    // Get user's registrations (original offers they signed up for) - needed for filtering
    const userRegistrations = await prisma.registration.findMany({
      where: { userId },
      select: { partnerOfferId: true }
    });
    
    const registeredOfferIds = userRegistrations
      .filter(reg => reg.partnerOfferId)
      .map(reg => reg.partnerOfferId);
    
    // DEBUG LOGS
    console.log('=== DEBUG /user/available-courses (userClean.ts) ===');
    console.log('User ID:', userId);
    console.log('Partner offers count:', partnerOffers?.length);
    console.log('Registered offer IDs:', registeredOfferIds);
    console.log('Partner offers:', partnerOffers.map(o => ({ 
      id: o.id, 
      name: o.name, 
      courseName: o.course.name,
      userAccessCount: o.userAccess.length,
      isRegistered: registeredOfferIds.includes(o.id)
    })));
    
    // Filter offers based on partner enablement - show ONLY specifically enabled courses
    const availableOffers = partnerOffers.filter(offer => {
      // Only show offers that have been specifically enabled by the partner for this user
      // This excludes original enrollment offers (they appear in "My Registrations" section)
      const hasPartnerAccess = offer.userAccess.length > 0;
      
      // Check if this is an original offer (user registered through this offer)
      const isOriginalOffer = registeredOfferIds.includes(offer.id);
      
      // Show ONLY partner-enabled courses that are NOT the original enrollment
      const shouldShow = hasPartnerAccess && !isOriginalOffer;
      
      console.log(`Offer ${offer.name}: hasPartnerAccess=${hasPartnerAccess}, isOriginalOffer=${isOriginalOffer}, shouldShow=${shouldShow}`);
      
      return shouldShow;
    });
    
    // Format response
    const courses = availableOffers.map(offer => ({
      id: offer.course.id,
      name: offer.name, // Use partner's template name instead of course name
      description: offer.course.description,
      templateType: offer.course.templateType,
      courseName: offer.course.name, // Keep original course name for reference
      partnerOfferId: offer.id,
      offerType: offer.offerType.toString(),
      totalAmount: Number(offer.totalAmount),
      finalAmount: Number(offer.totalAmount), // No user registration means no discount
      installments: offer.installments,
      isOriginal: false, // These are additional partner-enabled courses
      isEnrolled: false, // Not enrolled since they're additional offers
      enrollmentStatus: null,
      referralLink: `${process.env.FRONTEND_URL}/registration/${offer.referralLink}`,
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

// GET /api/user/enrollment-documents - Get documents uploaded during enrollment processes
router.get('/enrollment-documents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Get all user's registrations with their documents from both tables
    const registrations = await prisma.registration.findMany({
      where: { userId },
      include: {
        userDocuments: true, // UserDocument table (unified document system)
        offer: {
          include: {
            course: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Flatten all documents from all registrations (unified UserDocument system)
    const enrollmentDocuments = registrations.flatMap(registration => {
      const userDocs = registration.userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        uploadedAt: doc.uploadedAt,
        registrationId: registration.id,
        courseName: registration.offer?.course?.name || 'Corso sconosciuto',
        status: doc.status,
        source: 'UserDocument' // Unified document system
      }));
      
      return userDocs;
    });
    
    console.log(`📄 Found ${enrollmentDocuments.length} enrollment documents for user ${userId}`);
    
    res.json({ documents: enrollmentDocuments });
  } catch (error) {
    console.error('Error getting enrollment documents:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/enrollment-documents/:id/download - Download enrollment document
router.get('/enrollment-documents/:id/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Try to find document in UserDocument table first
    const userDocument = await prisma.userDocument.findFirst({
      where: {
        id,
        registration: {
          userId
        }
      }
    });
    
    let documentSource = 'UserDocument';
    let filePath: string | undefined;
    let fileName: string | undefined;
    
    if (userDocument) {
      filePath = userDocument.url;
      fileName = userDocument.originalName;
    } else {
      // Legacy Document table no longer used - only UserDocument
    }
    
    if (!filePath || !fileName) {
      console.log(`❌ Document not found: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Documento non trovato' });
    }
    
    console.log(`📄 Found document ${fileName} in ${documentSource} table`);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found on disk: ${filePath}`);
      return res.status(404).json({ error: 'File non trovato sul server' });
    }
    
    // Send file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Errore nel download del file' });
        }
      }
    });
    
  } catch (error) {
    console.error('Error downloading enrollment document:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
});

// POST /api/user/documents - Upload document to user repository
router.post('/documents', authenticate, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type, registrationId } = req.body;
    const file = req.file;

    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }

    if (!file) {
      return res.status(400).json({ error: 'File non fornito' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento non specificato' });
    }

    // Validate document type for TFA enrollments (reject OTHER/ALTRI_DOCUMENTI)
    if (registrationId) {
      const registration = await prisma.registration.findFirst({
        where: { id: registrationId, userId },
        include: { offer: true }
      });

      if (registration?.offer?.offerType === 'TFA_ROMANIA' && type === 'OTHER') {
        return res.status(400).json({
          error: 'Il tipo di documento "Altri Documenti" non è consentito per le iscrizioni TFA. Per favore, seleziona un tipo di documento specifico.'
        });
      }
    }

    console.log('📤 Upload request:', { userId, type, registrationId, fileName: file.originalname });

    // Check for existing document of the same type for this user/registration
    const whereClause: any = {
      userId,
      type: type as any
    };

    if (registrationId) {
      whereClause.registrationId = registrationId;
    }

    const existingDoc = await prisma.userDocument.findFirst({
      where: whereClause,
      orderBy: { uploadedAt: 'desc' }
    });

    // If existing document found, delete from R2 and database
    if (existingDoc) {
      console.log('🗑️ Found existing document, deleting old version:', {
        id: existingDoc.id,
        type: existingDoc.type,
        key: existingDoc.url
      });

      try {
        // Delete from R2
        await storageManager.deleteFile(existingDoc.url);
        console.log('✅ Old document deleted from R2:', existingDoc.url);
      } catch (deleteError) {
        console.warn('⚠️ Could not delete old document from R2 (may not exist):', deleteError);
        // Continue anyway - the old DB record will be deleted
      }

      // Delete from database
      await prisma.userDocument.delete({
        where: { id: existingDoc.id }
      });
      console.log('✅ Old document deleted from database');
    }

    // Upload to R2
    const uploadResult = await storageManager.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
      type
    );

    console.log('📤 File uploaded to R2:', uploadResult.key);

    // Create new document with R2 key
    const newDoc = await prisma.userDocument.create({
      data: {
        userId,
        type: type as any,
        originalName: file.originalname,
        url: uploadResult.key, // Store R2 key instead of file path
        size: file.size,
        mimeType: file.mimetype,
        status: 'PENDING' as any,
        uploadSource: 'USER_DASHBOARD' as any,
        uploadedBy: userId,
        uploadedByRole: 'USER' as any,
        ...(registrationId && { registrationId })
      }
    });

    console.log('📤 Document created:', { id: newDoc.id, type: newDoc.type, registrationId: newDoc.registrationId });

    return res.json({
      success: true,
      document: {
        id: newDoc.id,
        type: newDoc.type,
        fileName: newDoc.originalName,
        uploadedAt: newDoc.uploadedAt,
        isVerified: newDoc.status === 'APPROVED'
      },
      message: 'Documento caricato con successo su R2'
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/documents/unified - Get unified documents - shows documents from all sources
router.get('/documents/unified', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { registrationId } = req.query;

    // Get registration info if registrationId is provided to determine document types
    let courseTemplateType = 'TFA'; // Default
    
    if (registrationId && typeof registrationId === 'string') {
      const registration = await prisma.registration.findFirst({
        where: { 
          id: registrationId,
          userId // Ensure registration belongs to this user
        },
        include: {
          offer: {
            include: {
              course: true
            }
          }
        }
      });
      
      if (registration) {
        // Check registration's offerType directly (it's a field on Registration model)
        const registrationOfferType = (registration as any).offerType;
        if (registrationOfferType === 'CERTIFICATION' || registration.offer?.offerType === 'CERTIFICATION') {
          courseTemplateType = 'CERTIFICATION';
        } else {
          courseTemplateType = registration.offer?.course?.templateType || 'TFA';
        }
      }
    }

    // Document types based on course type
    const documentTypes = courseTemplateType === 'CERTIFICATION' ? [
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' }
    ] : [
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' },
      { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', description: 'Certificato di laurea triennale o diploma universitario' },
      { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento' },
      { type: 'TRANSCRIPT', name: 'Piano di Studio Triennale', description: 'Piano di studio della laurea triennale con lista esami sostenuti' },
      { type: 'MEDICAL_CERT', name: 'Certificato Medico', description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica' },
      { type: 'BIRTH_CERT', name: 'Certificato di Nascita', description: 'Certificato di nascita o estratto di nascita dal Comune' },
      { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' },
      { type: 'OTHER', name: 'Pergamena di Laurea', description: 'Pergamena di laurea (documento originale)' }
    ];

    // Get documents filtered by registrationId - documents should be isolated per registration
    const whereClause: any = {
      userId,
      type: {
        in: documentTypes.map(dt => dt.type) as any
      }
    };
    
    // ALWAYS filter by registrationId if provided - each registration should have its own documents
    if (registrationId && typeof registrationId === 'string') {
      whereClause.registrationId = registrationId;
    }
    
    const userDocuments = await prisma.userDocument.findMany({
      where: whereClause,
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    // Create unified document structure
    const documents = documentTypes.map(docType => {
      const userDoc = userDocuments.find(doc => doc.type === docType.type);
      
      return {
        id: userDoc?.id || `empty-${docType.type}`,
        type: docType.type,
        name: docType.name,
        description: docType.description,
        uploaded: !!userDoc,
        fileName: userDoc?.originalName,
        originalName: userDoc?.originalName,
        mimeType: userDoc?.mimeType,
        size: userDoc?.size,
        uploadedAt: userDoc?.uploadedAt?.toISOString(),
        documentId: userDoc?.id,
        status: userDoc?.status,
        rejectionReason: userDoc?.rejectionReason,
        rejectionDetails: userDoc?.rejectionDetails,
        verifiedBy: userDoc?.verifiedBy,
        verifiedAt: userDoc?.verifiedAt?.toISOString(),
        uploadSource: userDoc?.uploadSource,
        isVerified: userDoc?.status === 'APPROVED'
      };
    });

    const uploadedCount = documents.filter(doc => doc.uploaded).length;
    const totalCount = documents.length;

    res.json({ 
      documents,
      uploadedCount,
      totalCount
    });
  } catch (error) {
    console.error('Error getting unified documents:', error);
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

// GET /api/user/download-contract-template/:registrationId - Download precompiled contract
router.get('/download-contract-template/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { registrationId } = req.params;

    console.log(`[USER_CONTRACT_DOWNLOAD] Starting download for registration: ${registrationId}, user: ${userId}`);

    if (!userId) {
      console.log('[USER_CONTRACT_DOWNLOAD] Error: User not authenticated');
      return res.status(401).json({ error: 'Utente non autenticato' });
    }

    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        userId
      },
      include: {
        offer: {
          include: {
            course: true
          }
        }
      }
    });

    if (!registration) {
      console.log(`[USER_CONTRACT_DOWNLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[USER_CONTRACT_DOWNLOAD] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Allow download if registration is verified or contract already exists
    // (contract can be generated on-demand for verification purposes)
    if (registration.status === 'PENDING' && !registration.contractTemplateUrl) {
      console.log('[USER_CONTRACT_DOWNLOAD] Error: Contract not available for pending registration');
      return res.status(403).json({ error: 'Contratto non ancora disponibile. Completa prima l\'iscrizione.' });
    }

    // If contract doesn't exist, generate it
    if (!registration.contractTemplateUrl) {
      console.log('[USER_CONTRACT_DOWNLOAD] Generating new contract...');

      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[USER_CONTRACT_DOWNLOAD] Contract generated, buffer size: ${pdfBuffer.length}`);

        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[USER_CONTRACT_DOWNLOAD] Contract saved to: ${contractUrl}`);

        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Send the generated PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contratto_precompilato_${registrationId}.pdf"`);
        console.log('[USER_CONTRACT_DOWNLOAD] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[USER_CONTRACT_DOWNLOAD] Error generating contract:', generateError);
        return res.status(500).json({ error: 'Errore nella generazione del contratto' });
      }
    }

    // If contract already exists, serve the file - Use project root for consistency
    const projectRoot = getProjectRoot();
    const contractPath = path.join(projectRoot, 'backend', registration.contractTemplateUrl.substring(1)); // Remove leading slash
    console.log(`[USER_CONTRACT_DOWNLOAD] Attempting to serve existing contract from: ${contractPath}`);

    if (!fs.existsSync(contractPath)) {
      console.log(`[USER_CONTRACT_DOWNLOAD] Error: Contract file not found at path: ${contractPath}`);
      console.log(`[USER_CONTRACT_DOWNLOAD] Current directory: ${__dirname}`);
      console.log(`[USER_CONTRACT_DOWNLOAD] Attempting to regenerate contract...`);

      // Regenerate the contract if file doesn't exist
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[USER_CONTRACT_DOWNLOAD] Contract regenerated, buffer size: ${pdfBuffer.length}`);

        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[USER_CONTRACT_DOWNLOAD] Contract saved to: ${contractUrl}`);

        // Update registration with new contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Send the generated PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contratto_precompilato_${registrationId}.pdf"`);
        console.log('[USER_CONTRACT_DOWNLOAD] Sending regenerated PDF buffer');
        return res.send(pdfBuffer);
      } catch (regenError) {
        console.error('[USER_CONTRACT_DOWNLOAD] Error regenerating contract:', regenError);
        console.error('[USER_CONTRACT_DOWNLOAD] Error stack:', regenError instanceof Error ? regenError.stack : 'No stack trace');
        return res.status(500).json({ error: 'Errore nella rigenerazione del contratto' });
      }
    }

    console.log('[USER_CONTRACT_DOWNLOAD] File exists, sending...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_precompilato_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[USER_CONTRACT_DOWNLOAD] Full error details:', error);
    console.error('[USER_CONTRACT_DOWNLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Errore durante il download del contratto' });
  }
});

// GET /api/user/download-contract-signed/:registrationId - Download signed contract
router.get('/download-contract-signed/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { registrationId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        userId 
      }
    });
    
    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }
    
    // Only allow download if contract is signed
    if (!['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status)) {
      return res.status(403).json({ error: 'Contratto firmato non ancora disponibile' });
    }
    
    if (!registration.contractSignedUrl) {
      return res.status(404).json({ error: 'Contratto firmato non ancora caricato dal partner' });
    }
    
    // Build the file path - remove leading slash if present
    const relativePath = registration.contractSignedUrl.startsWith('/') 
      ? registration.contractSignedUrl.substring(1) 
      : registration.contractSignedUrl;
    
    // The file should be relative to the backend directory
    const filePath = path.join(process.cwd(), relativePath);
    
    console.log(`[USER_SIGNED_CONTRACT_DOWNLOAD] Looking for file at: ${filePath}`);
    console.log(`[USER_SIGNED_CONTRACT_DOWNLOAD] Current working directory: ${process.cwd()}`);
    console.log(`[USER_SIGNED_CONTRACT_DOWNLOAD] Contract URL from DB: ${registration.contractSignedUrl}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`[USER_SIGNED_CONTRACT_DOWNLOAD] File not found at: ${filePath}`);
      
      // Try to list what files are actually in the directory
      const contractsDir = path.join(process.cwd(), 'uploads', 'contracts');
      if (fs.existsSync(contractsDir)) {
        const files = fs.readdirSync(contractsDir);
        console.error(`[USER_SIGNED_CONTRACT_DOWNLOAD] Files in contracts directory: ${files.join(', ')}`);
      }
      
      return res.status(404).json({ error: 'File contratto firmato non trovato nel sistema' });
    }
    
    console.log(`[USER_SIGNED_CONTRACT_DOWNLOAD] Serving signed contract from: ${filePath}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_firmato_${registrationId}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[USER_SIGNED_CONTRACT_DOWNLOAD] Error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/tfa-steps/:registrationId - Get TFA post-enrollment steps progress
router.get('/tfa-steps/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { registrationId } = req.params;

    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        userId: userId
      },
      include: {
        offer: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Steps disponibili solo per corsi TFA' });
    }

    // Build steps progress object
    const steps = {
      admissionTest: {
        step: 1,
        title: 'Test d\'Ingresso',
        description: 'Test preliminare per l\'ammissione al corso TFA',
        completed: !!registration.admissionTestDate,
        completedAt: registration.admissionTestDate,
        passed: registration.admissionTestPassed,
        status: !!registration.admissionTestDate ? 'completed' : 
                (['CONTRACT_SIGNED', 'ENROLLED'].includes(registration.status) ? 'current' : 'pending')
      },
      cnredRelease: {
        step: 2,
        title: 'Rilascio CNRED',
        description: 'Il CNRED (Codice Nazionale di Riconoscimento Europeo dei Diplomi) è stato rilasciato',
        completed: !!registration.cnredReleasedAt,
        completedAt: registration.cnredReleasedAt,
        status: registration.status === 'CNRED_RELEASED' ? 'current' : 
                (!!registration.cnredReleasedAt ? 'completed' : 
                  (registration.admissionTestDate ? 'current' : 'pending'))
      },
      finalExam: {
        step: 3,
        title: 'Esame Finale',
        description: 'Sostenimento dell\'esame finale del corso TFA',
        completed: !!registration.finalExamDate,
        completedAt: registration.finalExamDate,
        passed: registration.finalExamPassed,
        status: registration.status === 'FINAL_EXAM' ? 'current' : 
                (!!registration.finalExamDate ? 'completed' : 'pending')
      },
      recognitionRequest: {
        step: 4,
        title: 'Richiesta Riconoscimento',
        description: 'Invio richiesta di riconoscimento del titolo conseguito',
        completed: !!registration.recognitionRequestDate,
        completedAt: registration.recognitionRequestDate,
        documentUrl: registration.recognitionDocumentUrl,
        status: registration.status === 'RECOGNITION_REQUEST' ? 'current' : 
                (!!registration.recognitionRequestDate ? 'completed' : 'pending')
      },
      finalCompletion: {
        step: 5,
        title: 'Corso Completato',
        description: 'Riconoscimento approvato - corso TFA completamente terminato',
        completed: registration.status === 'COMPLETED',
        completedAt: registration.recognitionApprovalDate,
        status: registration.status === 'COMPLETED' ? 'completed' : 'pending'
      }
    };

    res.json({
      registrationId: registration.id,
      currentStatus: registration.status,
      steps
    });

  } catch (error) {
    console.error('Error getting TFA steps:', error);
    res.status(500).json({ error: 'Errore nel recupero steps TFA' });
  }
});

// GET /api/user/certification-steps/:registrationId - Get certification steps progress
router.get('/certification-steps/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { registrationId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId, 
        userId 
      },
      include: { 
        offer: true,
        deadlines: {
          orderBy: { paymentNumber: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Steps disponibili solo per corsi di certificazione' });
    }

    // Check if all payments are completed
    const allDeadlinesPaid = registration.deadlines.every(d => d.paymentStatus === 'PAID');

    // Build certification steps
    console.log('=== CERTIFICATION STEPS DEBUG ===');
    console.log('Registration ID:', registration.id);
    console.log('Registration Status:', registration.status);
    console.log('Registration examDate:', registration.examDate);
    console.log('Registration examCompletedDate:', registration.examCompletedDate);
    
    const steps = {
      enrollment: {
        step: 1,
        title: 'Iscrizione Completata',
        description: 'La tua iscrizione al corso di certificazione è stata completata',
        completed: true,
        completedAt: registration.createdAt,
        status: 'completed' as const
      },
      payment: {
        step: 2,
        title: allDeadlinesPaid ? 'Pagamento Completato' : 'Pagamento',
        description: allDeadlinesPaid ? 'Tutti i pagamenti sono stati completati' : 'In attesa del pagamento tramite bonifico',
        completed: allDeadlinesPaid,
        completedAt: allDeadlinesPaid ? registration.deadlines.find(d => d.paymentStatus === 'PAID')?.paidAt : null,
        // Status current: PENDING -> CONTRACT_SIGNED (user must pay)
        // Status completed: all deadlines paid
        status: allDeadlinesPaid ? 'completed' as const :
                (['PENDING', 'DATA_VERIFIED', 'DOCUMENTS_UPLOADED', 'DOCUMENTS_PARTNER_CHECKED', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED'].includes(registration.status) ? 'current' as const : 'pending' as const)
      },
      documentsApproved: {
        step: 3,
        title: 'Documenti Approvati',
        description: 'Carta d\'identità e tessera sanitaria verificate',
        // Completed only when status is DOCUMENTS_APPROVED or later
        completed: ['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status),
        completedAt: ['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) ?
                     (registration.enrolledAt || new Date()) : null,
        status: registration.status === 'ENROLLED' && allDeadlinesPaid ? 'current' as const :
                (['DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) ? 'completed' as const : 'pending' as const)
      },
      examRegistered: {
        step: 4,
        title: 'Iscritto all\'Esame',
        description: 'Iscrizione all\'esame di certificazione confermata',
        // Completed when exam date is set or status is EXAM_REGISTERED/COMPLETED
        completed: ['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) || !!registration.examDate,
        completedAt: registration.examDate,
        status: registration.status === 'DOCUMENTS_APPROVED' ? 'current' as const :
                (['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) || !!registration.examDate ? 'completed' as const : 'pending' as const)
      },
      examCompleted: {
        step: 5,
        title: 'Esame Sostenuto',
        description: 'Esame di certificazione completato con successo',
        completed: registration.status === 'COMPLETED' || !!registration.examCompletedDate,
        completedAt: registration.examCompletedDate,
        status: registration.status === 'EXAM_REGISTERED' || !!registration.examDate ? 'current' as const :
                (registration.status === 'COMPLETED' || !!registration.examCompletedDate ? 'completed' as const : 'pending' as const)
      }
    };
    
    console.log('=== STEPS CALCULATED ===');
    console.log('Step 4 (examRegistered):', {
      completed: steps.examRegistered.completed,
      status: steps.examRegistered.status
    });
    console.log('Step 5 (examCompleted):', {
      completed: steps.examCompleted.completed,
      status: steps.examCompleted.status
    });
    console.log('=== END DEBUG ===');

    res.json({
      registrationId: registration.id,
      currentStatus: registration.status,
      steps
    });

  } catch (error) {
    console.error('Error getting certification steps:', error);
    res.status(500).json({ error: 'Errore nel recupero degli step di certificazione' });
  }
});

// GET /api/user/documents/:documentId/download - Download user document using unified storage
router.get('/documents/:documentId/download', authenticate, unifiedDownload, async (req: AuthRequest, res) => {
  // This endpoint now uses UnifiedDownload middleware for R2/Local storage compatibility
});

export default router;