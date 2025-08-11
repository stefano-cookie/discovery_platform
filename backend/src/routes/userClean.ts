import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import SecureTokenService from '../services/secureTokenService';
import { ContractService } from '../services/contractService';
import path from 'path';
import fs from 'fs';

const contractService = new ContractService();
const router = Router();
const prisma = new PrismaClient();

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
          isPaid: deadline.isPaid
        }))
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
      const totalPaid = reg.payments
        .filter(p => p.isConfirmed)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      
      const nextDeadline = reg.deadlines
        .filter(d => !d.isPaid && new Date(d.dueDate) >= new Date())
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
      
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
          isPaid: deadline.isPaid
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

// GET /api/user/documents/unified - Get unified documents - shows documents from all sources
router.get('/documents/unified', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { registrationId } = req.query;

    // Document types based on template
    const documentTypes = [
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

    // Get all user documents - NOT filtered by registrationId
    // We want to show ALL user documents regardless of where they were uploaded
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        userId,
        // Filter only by valid document types
        type: {
          in: documentTypes.map(dt => dt.type) as any
        }
      },
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
    
    if (!userId) {
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
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }
    
    // Only allow download if contract is signed (partner has uploaded signed contract)
    if (!['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status)) {
      return res.status(403).json({ error: 'Contratto non ancora disponibile per il download' });
    }
    
    // If contract doesn't exist, generate it
    if (!registration.contractTemplateUrl) {
      console.log('[USER_CONTRACT_DOWNLOAD] Generating contract for user...');
      
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        
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
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[USER_CONTRACT_DOWNLOAD] Error generating contract:', generateError);
        return res.status(500).json({ error: 'Errore nella generazione del contratto' });
      }
    }
    
    // Try different path resolutions
    let filePath = path.resolve(__dirname, '../..', registration.contractTemplateUrl.substring(1));
    
    if (!fs.existsSync(filePath)) {
      // Try with process.cwd()
      filePath = path.join(process.cwd(), registration.contractTemplateUrl);
      
      if (!fs.existsSync(filePath)) {
        // Try without leading slash
        filePath = path.join(process.cwd(), registration.contractTemplateUrl.substring(1));
        
        if (!fs.existsSync(filePath)) {
          console.error(`[USER_CONTRACT_DOWNLOAD] File not found at: ${filePath}`);
          return res.status(404).json({ error: 'File contratto non trovato nel sistema' });
        }
      }
    }
    
    console.log(`[USER_CONTRACT_DOWNLOAD] Serving contract from: ${filePath}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_precompilato_${registrationId}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[USER_CONTRACT_DOWNLOAD] Error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
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

export default router;