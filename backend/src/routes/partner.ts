import { Router, Response as ExpressResponse } from 'express';
import { PrismaClient, DocumentStatus } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ContractService } from '../services/contractService';
import { DocumentService, upload as documentUpload } from '../services/documentService';
import UnifiedDocumentService from '../services/unifiedDocumentService';
import multer from 'multer';
import emailService from '../services/emailService';
import * as path from 'path';
import ExcelJS from 'exceljs';

const router = Router();
const prisma = new PrismaClient();
const contractService = new ContractService();

// Configure multer for contract uploads
const contractStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    cb(null, path.join(__dirname, '../../uploads/signed-contracts'));
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `signed_contract_temp_${Date.now()}.pdf`);
  }
});

const uploadContract = multer({
  storage: contractStorage,
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo file PDF sono consentiti'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Get partner stats
router.get('/stats', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get direct users count
    const directUsers = await prisma.registration.count({
      where: { partnerId }
    });

    // Get children partners users count
    const childrenPartners = await prisma.partner.findMany({
      where: { parentId: partnerId }
    });

    let childrenUsers = 0;
    for (const child of childrenPartners) {
      const count = await prisma.registration.count({
        where: { partnerId: child.id }
      });
      childrenUsers += count;
    }

    // Calculate monthly revenue (simplified)
    const monthlyRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        registration: { partnerId },
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    res.json({
      totalUsers: directUsers + childrenUsers,
      directUsers,
      childrenUsers,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      pendingCommissions: 0 // To be implemented
    });
  } catch (error) {
    console.error('Get partner stats error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner users
router.get('/users', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const filter = req.query.filter as string || 'all';
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    let whereClause: any = {};
    
    if (filter === 'direct') {
      whereClause = { partnerId };
    } else if (filter === 'children') {
      const childrenPartners = await prisma.partner.findMany({
        where: { parentId: partnerId },
        select: { id: true }
      });
      whereClause = { 
        partnerId: { in: childrenPartners.map((p: { id: string }) => p.id) } 
      };
    } else {
      // All users (direct + children)
      const childrenPartners = await prisma.partner.findMany({
        where: { parentId: partnerId },
        select: { id: true }
      });
      whereClause = { 
        partnerId: { in: [partnerId, ...childrenPartners.map((p: { id: string }) => p.id)] } 
      };
    }

    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        user: {
          include: { profile: true }
        },
        partner: {
          include: { user: true }
        },
        offer: {
          include: { course: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const users = registrations.map((reg: any) => ({
      id: reg.user.id,
      registrationId: reg.id,
      email: reg.user.email,
      profile: reg.user.profile,
      status: reg.status,
      course: reg.offer?.name || 'Offerta non specificata',
      courseId: reg.courseId,
      offerType: reg.offerType,
      isDirectUser: reg.partnerId === partnerId,
      partnerName: reg.partner.user.email,
      canManagePayments: true,
      // Date importanti
      createdAt: reg.user.createdAt, // Data registrazione utente
      enrollmentDate: reg.createdAt,  // Data iscrizione al corso
      // Dati pagamento
      originalAmount: Number(reg.originalAmount),
      finalAmount: Number(reg.finalAmount),
      installments: reg.installments,
      // Lista offerte aggiuntive disponibili (sarà implementata dopo)
    }));

    res.json(users);
  } catch (error) {
    console.error('Get partner users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/partners/registrations/:registrationId/documents/unified - Get unified documents for a registration (partner view)
router.get('/registrations/:registrationId/documents/unified', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id || req.user?.partnerId;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify the registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        partnerId: partnerId
      },
      include: {
        user: true,
        offer: {
          include: {
            course: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Get course template type
    const courseTemplateType = registration.offer?.course?.templateType || 'TFA';

    // Define document types based on course template
    const allDocumentTypes = courseTemplateType === 'CERTIFICATION' ? [
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' }
    ] : [
      // TFA documents (9 types)
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria / Codice Fiscale', description: 'Tessera sanitaria o documento che attesti il codice fiscale' },
      { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', description: 'Certificato di laurea triennale o diploma universitario' },
      { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento' },
      { type: 'TRANSCRIPT', name: 'Piano di Studio', description: 'Piano di studio con lista esami sostenuti' },
      { type: 'MEDICAL_CERT', name: 'Certificato Medico', description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica' },
      { type: 'BIRTH_CERT', name: 'Certificato di Nascita', description: 'Certificato di nascita o estratto di nascita dal Comune' },
      { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' },
      { type: 'OTHER', name: 'Altri Documenti', description: 'Altri documenti rilevanti' }
    ];

    // Get ALL documents for this user - no filter by registrationId
    // Partner can see all user documents to have complete view
    const userDocuments = await prisma.userDocument.findMany({
      where: {
        userId: registration.userId,
        // Filter only by valid document types for this course template
        type: {
          in: allDocumentTypes.map(dt => dt.type) as any
        }
      },
      include: {
        verifier: {
          select: { id: true, email: true }
        },
        uploader: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    // Map to unified structure
    const documents = allDocumentTypes.map(docType => {
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
        verifiedBy: userDoc?.verifier?.email,
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
    console.error('Error getting unified documents for partner:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti' });
  }
});

// Get documents for a specific registration
router.get('/registrations/:registrationId/documents', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify that the registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        userDocuments: true,  // Unified document system
        offer: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Get user documents to match against required documents
    const userDocuments = await prisma.userDocument.findMany({
      where: { userId: registration.userId }
    });

    console.log(`📄 Partner documents check for registration ${registrationId}:`);
    console.log(`- UserDocuments from registration: ${registration.userDocuments.length}`);
    console.log(`- UserDocuments from user: ${userDocuments.length}`);

    // Determine required documents based on offer type - EXACT match with form fields
    let requiredDocuments: any[] = [];
    
    if (registration.offerType === 'TFA_ROMANIA') {
      // Exact mapping from TFA form fields
      requiredDocuments = [
        // Basic documents
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità'
        },
        
        // Certificati di Laurea section
        {
          type: 'CERTIFICATO_TRIENNALE', 
          name: 'Certificato Laurea Triennale',
          required: false,
          description: 'Certificato di laurea triennale o diploma universitario'
        },
        {
          type: 'CERTIFICATO_MAGISTRALE',
          name: 'Certificato Laurea Magistrale', 
          required: false,
          description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento'
        },
        
        // Piani di Studio section
        {
          type: 'PIANO_STUDIO_TRIENNALE',
          name: 'Piano di Studio Triennale',
          required: false,
          description: 'Piano di studio della laurea triennale con lista esami sostenuti'
        },
        {
          type: 'PIANO_STUDIO_MAGISTRALE',
          name: 'Piano di Studio Magistrale',
          required: false,
          description: 'Piano di studio della laurea magistrale, specialistica o vecchio ordinamento'
        },
        
        // Altri Documenti section
        {
          type: 'CERTIFICATO_MEDICO',
          name: 'Certificato Medico di Sana e Robusta Costituzione',
          required: false,
          description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica'
        },
        {
          type: 'CERTIFICATO_NASCITA',
          name: 'Certificato di Nascita',
          required: false,
          description: 'Certificato di nascita o estratto di nascita dal Comune'
        },
        {
          type: 'DIPLOMA_LAUREA',
          name: 'Diploma di Laurea',
          required: false,
          description: 'Diploma di laurea (cartaceo o digitale)'
        },
        {
          type: 'PERGAMENA_LAUREA',
          name: 'Pergamena di Laurea',
          required: false,
          description: 'Pergamena di laurea (documento originale)'
        }
      ];
    } else if (registration.offerType === 'CERTIFICATION') {
      // Certification documents (simplified)
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità'
        },
        {
          type: 'TESSERA_SANITARIA',
          name: 'Tessera Sanitaria / Codice Fiscale',
          required: false,
          description: 'Tessera sanitaria o documento che attesti il codice fiscale'
        }
      ];
    } else {
      // Default fallback
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Documento d\'identità valido'
        }
      ];
    }

    // Combine all documents from different sources
    const allDocuments = [
      // UserDocuments from user query (with enum types)
      ...userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        filePath: doc.url,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.status === 'APPROVED',
        source: 'UserDocument'
      })),
      // UserDocuments from registration (unified document system)
      ...registration.userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        filePath: doc.url,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.status === 'APPROVED',
        source: 'UserDocument-Registration'
      }))
    ];

    console.log(`📄 All documents found: ${allDocuments.map(d => `${d.fileName} (${d.type}, ${d.source})`).join(', ')}`);

    // Map user documents to required ones (checking all document sources)
    const documentsWithStatus = requiredDocuments.map(reqDoc => {
      const uploadedDoc = allDocuments.find(doc => doc.type === reqDoc.type);
      
      return {
        id: reqDoc.type,
        name: reqDoc.name,
        type: reqDoc.type,
        required: reqDoc.required,
        description: reqDoc.description,
        uploaded: !!uploadedDoc,
        fileName: uploadedDoc?.fileName || null,
        filePath: uploadedDoc?.filePath || null,
        uploadedAt: uploadedDoc?.uploadedAt || null,
        documentId: uploadedDoc?.id || null, // Add document ID for download
        isVerified: uploadedDoc?.isVerified || false,
        source: uploadedDoc?.source || null // For debugging
      };
    });

    res.json({
      registrationId,
      offerType: registration.offerType,
      documents: documentsWithStatus,
      uploadedCount: documentsWithStatus.filter(doc => doc.uploaded).length,
      totalCount: documentsWithStatus.length,
      requiredCount: documentsWithStatus.filter(doc => doc.required).length,
      completedRequired: documentsWithStatus.filter(doc => doc.required && doc.uploaded).length
    });

  } catch (error) {
    console.error('Get registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get user offers access - for managing what offers a user can access
router.get('/users/:userId/offers', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get all partner's active offers
    const partnerOffers = await prisma.partnerOffer.findMany({
      where: { 
        partnerId,
        isActive: true 
      },
      include: {
        course: true
      }
    });

    // Get user's current registrations (original offers they signed up for)
    const userRegistrations = await prisma.registration.findMany({
      where: { 
        userId,
        partnerId 
      },
      include: {
        offer: true
      }
    });

    // Get user's additional offer access
    const userOfferAccess = await prisma.userOfferAccess.findMany({
      where: {
        userId,
        partnerId,
        enabled: true
      }
    });

    const accessibleOfferIds = new Set([
      ...userRegistrations.map(reg => reg.partnerOfferId).filter(Boolean),
      ...userOfferAccess.map(access => access.offerId)
    ]);

    const originalOfferIds = new Set(
      userRegistrations.map(reg => reg.partnerOfferId).filter(Boolean)
    );

    const offers = partnerOffers.map(offer => ({
      id: offer.id,
      name: offer.name,
      courseName: offer.course.name,
      offerType: offer.offerType,
      totalAmount: Number(offer.totalAmount),
      installments: offer.installments,
      isActive: offer.isActive,
      hasAccess: accessibleOfferIds.has(offer.id),
      isOriginal: originalOfferIds.has(offer.id)
    }));

    res.json(offers);
  } catch (error) {
    console.error('Get user offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Grant user access to an offer
router.post('/users/:userId/offers/:offerId/grant', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId, offerId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: { 
        id: offerId,
        partnerId,
        isActive: true 
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Check if user already has access
    const existingAccess = await prisma.userOfferAccess.findUnique({
      where: {
        userId_offerId: {
          userId,
          offerId
        }
      }
    });

    if (existingAccess) {
      // Update existing access to enabled
      await prisma.userOfferAccess.update({
        where: { id: existingAccess.id },
        data: { enabled: true }
      });
    } else {
      // Create new access
      await prisma.userOfferAccess.create({
        data: {
          userId,
          offerId,
          partnerId,
          enabled: true
        }
      });
    }

    res.json({ success: true, message: 'Accesso all\'offerta concesso' });
  } catch (error) {
    console.error('Grant user offer access error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Revoke user access to an offer
router.post('/users/:userId/offers/:offerId/revoke', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId, offerId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: { 
        id: offerId,
        partnerId,
        isActive: true 
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Check if this is an original offer (user registered through this offer)
    const originalRegistration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerOfferId: offerId,
        partnerId
      }
    });

    if (originalRegistration) {
      return res.status(400).json({ 
        error: 'Non puoi revocare l\'accesso all\'offerta originale di iscrizione' 
      });
    }

    // Update or delete access record
    const existingAccess = await prisma.userOfferAccess.findUnique({
      where: {
        userId_offerId: {
          userId,
          offerId
        }
      }
    });

    if (existingAccess) {
      await prisma.userOfferAccess.update({
        where: { id: existingAccess.id },
        data: { enabled: false }
      });
    }

    res.json({ success: true, message: 'Accesso all\'offerta revocato' });
  } catch (error) {
    console.error('Revoke user offer access error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner coupons
router.get('/coupons', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const coupons = await prisma.coupon.findMany({
      where: { partnerId },
      include: {
        uses: true
      },
      orderBy: { validFrom: 'desc' }
    });

    res.json(coupons);
  } catch (error) {
    console.error('Get partner coupons error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner coupon
router.post('/coupons', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { code, discountType, discountAmount, discountPercent, maxUses, validFrom, validUntil } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Check if coupon code already exists for this partner
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        partnerId,
        code
      }
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Codice coupon già esistente' });
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        partnerId,
        code,
        discountType,
        discountAmount: discountAmount ? Number(discountAmount) : null,
        discountPercent: discountPercent ? Number(discountPercent) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil)
      }
    });

    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update coupon status
router.put('/coupons/:id/status', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Update coupon - only if it belongs to this partner
    const coupon = await prisma.coupon.updateMany({
      where: {
        id,
        partnerId
      },
      data: { isActive }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update coupon status error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete coupon
router.delete('/coupons/:id', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { id } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Check if coupon has been used
    const couponUse = await prisma.couponUse.findFirst({
      where: { couponId: id }
    });

    if (couponUse) {
      return res.status(400).json({ error: 'Impossibile eliminare un coupon già utilizzato' });
    }

    // Delete coupon - only if it belongs to this partner
    const coupon = await prisma.coupon.deleteMany({
      where: {
        id,
        partnerId
      }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Validate coupon code
router.post('/coupons/validate', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { code } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Find coupon
    const coupon = await prisma.coupon.findFirst({
      where: {
        code,
        partnerId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Codice sconto non valido o scaduto' });
    }

    // Check if max uses reached
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Codice sconto esaurito' });
    }

    // Check if coupon was already used
    const existingUse = await prisma.couponUse.findFirst({
      where: { couponId: coupon.id }
    });

    if (existingUse) {
      return res.status(400).json({ error: 'Codice sconto già utilizzato' });
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get coupon usage logs with user details
router.get('/coupons/:couponId/usage-logs', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { couponId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify coupon belongs to this partner
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        partnerId: partnerId
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    // Get usage logs with user and registration details
    const usageLogs = await prisma.couponUse.findMany({
      where: { couponId: couponId },
      include: {
        registration: {
          include: {
            user: {
              include: {
                profile: {
                  select: {
                    nome: true,
                    cognome: true
                  }
                }
              }
            },
            offer: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { usedAt: 'desc' }
    });

    // Transform data for frontend
    const formattedLogs = usageLogs.map(log => ({
      id: log.id,
      usedAt: log.usedAt,
      discountApplied: log.discountApplied,
      user: {
        email: log.registration.user.email,
        nome: log.registration.user.profile?.nome || 'N/A',
        cognome: log.registration.user.profile?.cognome || 'N/A'
      },
      registration: {
        id: log.registrationId,
        offerName: log.registration.offer?.name || 'Offerta diretta'
      }
    }));

    res.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount
      },
      usageLogs: formattedLogs,
      totalUses: formattedLogs.length
    });
  } catch (error) {
    console.error('Get coupon usage logs error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/partners/offer-visibility/:offerId - Get offer visibility settings for users
router.get('/offer-visibility/:offerId', authenticate, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Verify that the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.offerId,
        partnerId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    // Get all users associated with this partner
    const associatedUsers = await prisma.user.findMany({
      where: { assignedPartnerId: partner.id },
      include: {
        profile: true
      }
    });

    // Get visibility settings for this offer
    const visibilitySettings = await prisma.offerVisibility.findMany({
      where: {
        partnerOfferId: req.params.offerId
      }
    });

    const visibilityMap = new Map(
      visibilitySettings.map(v => [v.userId, v.isVisible])
    );

    // Format response with user info and visibility status
    const userVisibility = associatedUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.profile ? `${user.profile.nome} ${user.profile.cognome}` : 'Nome non disponibile',
      isVisible: visibilityMap.get(user.id) ?? true // Default to visible
    }));

    res.json({ 
      offerId: req.params.offerId,
      users: userVisibility 
    });
  } catch (error) {
    console.error('Error getting offer visibility:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/partners/offer-visibility/:offerId - Update offer visibility for users
router.put('/offer-visibility/:offerId', authenticate, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Verify that the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.offerId,
        partnerId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    const { userVisibility } = req.body;
    
    if (!Array.isArray(userVisibility)) {
      return res.status(400).json({ error: 'userVisibility deve essere un array' });
    }

    // Update visibility settings for each user
    for (const setting of userVisibility) {
      const { userId, isVisible } = setting;
      
      if (typeof userId !== 'string' || typeof isVisible !== 'boolean') {
        continue; // Skip invalid entries
      }

      // Upsert visibility setting
      await prisma.offerVisibility.upsert({
        where: {
          partnerOfferId_userId: {
            partnerOfferId: req.params.offerId,
            userId: userId
          }
        },
        update: {
          isVisible: isVisible
        },
        create: {
          partnerOfferId: req.params.offerId,
          userId: userId,
          isVisible: isVisible
        }
      });
    }

    res.json({ 
      success: true, 
      message: 'Visibilità offerta aggiornata con successo' 
    });
  } catch (error) {
    console.error('Error updating offer visibility:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get registration details for partner
router.get('/registrations/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        },
        payments: true,
        userDocuments: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    res.json({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      contractTemplateUrl: registration.contractTemplateUrl,
      contractSignedUrl: registration.contractSignedUrl,
      contractGeneratedAt: registration.contractGeneratedAt,
      contractUploadedAt: registration.contractUploadedAt,
      user: {
        id: registration.user.id,
        email: registration.user.email,
        profile: registration.user.profile
      },
      offer: {
        id: registration.offer?.id,
        name: registration.offer?.name || 'Offerta diretta',
        course: registration.offer?.course
      },
      payments: registration.payments,
      userDocuments: registration.userDocuments
    });
  } catch (error) {
    console.error('Get registration details error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Download contract template
router.get('/download-contract/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_DOWNLOAD] Starting download for registration: ${registrationId}, partner: ${partnerId}`);
    
    if (!partnerId) {
      console.log('[CONTRACT_DOWNLOAD] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_DOWNLOAD] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_DOWNLOAD] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_DOWNLOAD] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_DOWNLOAD] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
        console.log('[CONTRACT_DOWNLOAD] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_DOWNLOAD] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file
    const contractPath = path.resolve(__dirname, '../..', registration.contractTemplateUrl.substring(1)); // Remove leading slash
    console.log(`[CONTRACT_DOWNLOAD] Attempting to serve existing contract from: ${contractPath}`);
    
    if (!require('fs').existsSync(contractPath)) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Contract file not found at path: ${contractPath}`);
      console.log(`[CONTRACT_DOWNLOAD] Current directory: ${__dirname}`);
      console.log(`[CONTRACT_DOWNLOAD] Resolved path components: dir=${__dirname}, url=${registration.contractTemplateUrl}`);
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    console.log('[CONTRACT_DOWNLOAD] File exists, sending...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[CONTRACT_DOWNLOAD] Full error details:', error);
    console.error('[CONTRACT_DOWNLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Errore durante il download del contratto' });
  }
});

// Preview contract template - inline display
router.get('/preview-contract/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_PREVIEW] Starting preview for registration: ${registrationId}, partner: ${partnerId}`);
    
    if (!partnerId) {
      console.log('[CONTRACT_PREVIEW] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_PREVIEW] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_PREVIEW] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_PREVIEW] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_PREVIEW] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_PREVIEW] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers for inline display and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contratto_${registrationId}.pdf"`);
        console.log('[CONTRACT_PREVIEW] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_PREVIEW] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file for inline display
    const contractPath = path.resolve(__dirname, '../..', registration.contractTemplateUrl.substring(1));
    console.log(`[CONTRACT_PREVIEW] Serving existing contract from: ${contractPath}`);
    
    if (!require('fs').existsSync(contractPath)) {
      console.log(`[CONTRACT_PREVIEW] Error: Contract file not found at path: ${contractPath}`);
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contratto_${registrationId}.pdf"`);
    console.log('[CONTRACT_PREVIEW] Sending existing contract file');
    res.sendFile(contractPath);

  } catch (error) {
    console.error('Preview contract error:', error);
    res.status(500).json({ error: 'Errore durante la preview del contratto' });
  }
});

// Upload signed contract
router.post('/upload-signed-contract', authenticate, requireRole(['PARTNER', 'ADMIN']), uploadContract.single('contract'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File non fornito' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Rename file with proper registrationId
    const oldPath = req.file.path;
    const newFilename = `signed_contract_${registrationId}_${Date.now()}.pdf`;
    const newPath = path.join(path.dirname(oldPath), newFilename);
    require('fs').renameSync(oldPath, newPath);
    
    // Update registration with signed contract info
    const contractSignedUrl = `/uploads/signed-contracts/${newFilename}`;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        contractSignedUrl,
        contractUploadedAt: new Date(),
        status: 'CONTRACT_SIGNED' // Update status to next step
      }
    });

    res.json({
      success: true,
      message: 'Contratto firmato caricato con successo',
      contractSignedUrl
    });

  } catch (error) {
    console.error('Upload signed contract error:', error);
    res.status(500).json({ error: 'Errore durante il caricamento del contratto' });
  }
});

// Reset contract cache endpoint
router.delete('/reset-contract/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        contractTemplateUrl: null,
        contractGeneratedAt: null
      }
    });

    res.json({ success: true, message: 'Contract cache reset' });
  } catch (error) {
    console.error('Reset contract cache error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Test contract data endpoint
router.get('/test-contract-data/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        payments: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    res.json({
      registration: {
        id: registration.id,
        offerType: registration.offerType,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments,
        createdAt: registration.createdAt
      },
      user: registration.user,
      profile: registration.user?.profile,
      offer: registration.offer,
      payments: registration.payments
    });
  } catch (error) {
    console.error('Test contract data error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get recent enrollments for dashboard
router.get('/recent-enrollments', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const recentEnrollments = await prisma.registration.findMany({
      where: { partnerId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        }
      }
    });

    const enrollments = recentEnrollments.map((reg: any) => ({
      id: reg.id,
      user: {
        nome: reg.user.profile?.nome || 'N/A',
        cognome: reg.user.profile?.cognome || 'N/A',
        email: reg.user.email
      },
      course: reg.offer?.course?.name || reg.offer?.name || 'Corso non specificato',
      status: reg.status,
      createdAt: reg.createdAt
    }));

    res.json(enrollments);
  } catch (error) {
    console.error('Get recent enrollments error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get pending documents for verification
router.get('/documents/pending', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const pendingDocuments = await DocumentService.getPendingDocumentsForPartner(partnerId);
    
    const formattedDocs = pendingDocuments.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      uploadSource: doc.uploadSource,
      user: {
        id: doc.user.id,
        email: doc.user.email,
        name: doc.user.profile ? `${doc.user.profile.nome} ${doc.user.profile.cognome}` : 'Nome non disponibile'
      },
      registration: doc.registration ? {
        id: doc.registration.id,
        courseName: doc.registration.offer?.course?.name || 'Corso non specificato'
      } : null
    }));

    res.json({ 
      pendingDocuments: formattedDocs,
      count: formattedDocs.length
    });
  } catch (error: any) {
    console.error('Get pending documents error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei documenti in sospeso' });
  }
});

// Get payment deadlines for a registration
router.get('/registrations/:registrationId/deadlines', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        partnerId
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Get all payment deadlines
    const deadlines = await prisma.paymentDeadline.findMany({
      where: { registrationId },
      orderBy: { dueDate: 'asc' }
    });

    const formattedDeadlines = deadlines.map(d => ({
      id: d.id,
      amount: Number(d.amount),
      dueDate: d.dueDate,
      description: d.description || `Pagamento ${d.paymentNumber}`,
      isPaid: d.isPaid,
      paidAt: d.paidAt,
      notes: d.notes
    }));

    // Calculate remaining amount properly
    const totalPaid = deadlines
      .filter(d => d.isPaid)
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const calculatedRemainingAmount = Number(registration.finalAmount) - totalPaid;

    res.json({
      deadlines: formattedDeadlines,
      remainingAmount: calculatedRemainingAmount
    });
  } catch (error) {
    console.error('Get payment deadlines error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark payment deadline as paid and update remaining amount
router.post('/registrations/:registrationId/payments/:deadlineId/mark-paid', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId, deadlineId } = req.params;
    const { notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        partnerId
      },
      include: {
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Find the specific deadline
    const deadline = await prisma.paymentDeadline.findFirst({
      where: {
        id: deadlineId,
        registrationId
      }
    });

    if (!deadline) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    if (deadline.isPaid) {
      return res.status(400).json({ error: 'Pagamento già marcato come pagato' });
    }

    // Mark deadline as paid
    await prisma.paymentDeadline.update({
      where: { id: deadlineId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        notes
      }
    });

    // Calculate remaining amount
    const paidDeadlines = await prisma.paymentDeadline.findMany({
      where: {
        registrationId,
        isPaid: true
      }
    });

    const totalPaid = paidDeadlines.reduce((sum, d) => sum + Number(d.amount), 0);
    const remainingAmount = Number(registration.finalAmount) - totalPaid;

    // Update registration with remaining amount
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        remainingAmount: remainingAmount
      }
    });

    // Get next unpaid deadline
    const nextDeadline = await prisma.paymentDeadline.findFirst({
      where: {
        registrationId,
        isPaid: false
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({
      success: true,
      remainingAmount,
      totalPaid,
      nextDeadline: nextDeadline ? {
        id: nextDeadline.id,
        amount: Number(nextDeadline.amount),
        dueDate: nextDeadline.dueDate,
        description: nextDeadline.description
      } : null
    });
  } catch (error) {
    console.error('Mark payment as paid error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Notify partner about document upload
router.post('/documents/:documentId/notify', authenticate, requireRole(['USER']), async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    
    // Get user's assigned partner
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { assignedPartnerId: true }
    });

    if (!user || !user.assignedPartnerId) {
      return res.status(400).json({ error: 'Partner non assegnato' });
    }

    const result = await DocumentService.notifyPartnerNewDocument(documentId, user.assignedPartnerId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Notify partner error:', error);
    res.status(500).json({ error: 'Errore nella notifica al partner' });
  }
});

// GET /api/partners/users/:userId/documents - Get all documents for a user (partner access)
router.get('/users/:userId/documents', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify that the user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId,
        partnerId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a visualizzare i documenti di questo utente' });
    }

    // Get all user documents
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' }
    });

    res.json({ documents });
  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/partners/users/:userId/documents/:documentId/download - Download user document (partner access)
router.get('/users/:userId/documents/:documentId/download', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId, documentId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify that the user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId,
        partnerId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a scaricare i documenti di questo utente' });
    }

    // Try to find document in UserDocument table first
    const userDocument = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    let documentSource = 'UserDocument';
    let filePath: string | undefined;
    let fileName: string | undefined;

    if (userDocument) {
      filePath = userDocument.url;
      fileName = userDocument.originalName;
    } else {
      // Document not found - legacy Document table no longer used
    }

    if (!filePath || !fileName) {
      console.log(`❌ Partner download: Document not found ${documentId} for user ${userId}`);
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    console.log(`📄 Partner download: Found document ${fileName} in ${documentSource} table`);

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Partner download: File not found on disk: ${filePath}`);
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
    console.error('Download user document error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
});

// =====================================
// ENTERPRISE DOCUMENT MANAGEMENT SYSTEM
// =====================================

// Get all documents for a registration (new document system)
router.get('/registrations/:registrationId/documents', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    const documents = await UnifiedDocumentService.getRegistrationDocuments(registrationId);
    
    res.json({ documents });
  } catch (error: any) {
    console.error('Get registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get all documents for a user (comprehensive view)
router.get('/users/:userId/documents/all', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: { userId, partnerId }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a visualizzare i documenti di questo utente' });
    }

    const documents = await UnifiedDocumentService.getAllUserDocuments(userId);
    
    const formattedDocs = documents.map((doc: any) => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      status: doc.status,
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.uploadedAt,
      registrationId: doc.registrationId,
      courseName: doc.registration?.offer?.course?.name
    }));

    res.json({ documents: formattedDocs });
  } catch (error: any) {
    console.error('Get all user documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Download document (partner access with full permissions)
router.get('/documents/:documentId/download', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const fileInfo = await DocumentService.downloadDocument(documentId, '', true); // Partner has full access
    
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.fileName}"`);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.sendFile(fileInfo.filePath);
  } catch (error: any) {
    console.error('Partner download document error:', error);
    res.status(404).json({ error: error.message || 'Documento non trovato' });
  }
});

// Approve document
router.post('/documents/:documentId/approve', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const result = await UnifiedDocumentService.approveDocument(documentId, req.user!.id, notes);
    
    res.json({ 
      message: 'Documento approvato con successo',
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Approve document error:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione del documento' });
  }
});

// Reject document with email notification
router.post('/documents/:documentId/reject', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { reason, details } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Motivo del rifiuto obbligatorio' });
    }

    const result = await UnifiedDocumentService.rejectDocument(documentId, req.user!.id, reason, details);
    
    res.json({ 
      message: 'Documento rifiutato con successo',
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt,
        rejectionReason: result.document.rejectionReason,
        rejectionDetails: result.document.rejectionDetails
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Reject document error:', error);
    res.status(500).json({ error: 'Errore nel rifiuto del documento' });
  }
});

// Legacy verify endpoint (for backward compatibility)
router.post('/documents/:documentId/verify', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { status, rejectionReason } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!Object.values(DocumentStatus).includes(status)) {
      return res.status(400).json({ error: 'Status documento non valido' });
    }

    if (status === DocumentStatus.REJECTED && !rejectionReason) {
      return res.status(400).json({ error: 'Motivo del rifiuto obbligatorio' });
    }

    // Use new methods based on status
    const result = status === DocumentStatus.APPROVED 
      ? await UnifiedDocumentService.approveDocument(documentId, req.user!.id)
      : await UnifiedDocumentService.rejectDocument(documentId, req.user!.id, rejectionReason);
    
    res.json({ 
      message: `Documento ${status === DocumentStatus.APPROVED ? 'approvato' : 'rifiutato'} con successo`,
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt,
        rejectionReason: result.document.rejectionReason
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Verify document error:', error);
    res.status(500).json({ error: 'Errore nella verifica del documento' });
  }
});

// Upload CNRed document for registration
router.post('/registrations/:registrationId/cnred', authenticate, requireRole(['PARTNER', 'ADMIN']), documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with CNRed URL
    const cnredUrl = `/uploads/documents/${req.file.filename}`;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        cnredUrl,
        cnredUploadedAt: new Date()
      }
    });

    res.json({
      message: 'Documento CNRed caricato con successo',
      cnredUrl
    });
  } catch (error: any) {
    console.error('Upload CNRed error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento CNRed' });
  }
});

// Upload Adverintia document for registration
router.post('/registrations/:registrationId/adverintia', authenticate, requireRole(['PARTNER', 'ADMIN']), documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with Adverintia URL
    const adverintiaUrl = `/uploads/documents/${req.file.filename}`;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        adverintiaUrl,
        adverintiaUploadedAt: new Date()
      }
    });

    res.json({
      message: 'Documento Adverintia caricato con successo',
      adverintiaUrl
    });
  } catch (error: any) {
    console.error('Upload Adverintia error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento Adverintia' });
  }
});

// Download CNRed document
router.get('/registrations/:registrationId/cnred/download', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration || !registration.cnredUrl) {
      return res.status(404).json({ error: 'Documento CNRed non trovato' });
    }

    const filePath = path.resolve(__dirname, '../..', registration.cnredUrl.substring(1));
    
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="CNRed_${registrationId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Download CNRed error:', error);
    res.status(500).json({ error: 'Errore nel download del documento CNRed' });
  }
});

// Download Adverintia document
router.get('/registrations/:registrationId/adverintia/download', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration || !registration.adverintiaUrl) {
      return res.status(404).json({ error: 'Documento Adverintia non trovato' });
    }

    const filePath = path.resolve(__dirname, '../..', registration.adverintiaUrl.substring(1));
    
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="Adverintia_${registrationId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Download Adverintia error:', error);
    res.status(500).json({ error: 'Errore nel download del documento Adverintia' });
  }
});

// Set exam date for certification workflow
router.post('/registrations/:registrationId/exam-date', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    const { examDate } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!examDate) {
      return res.status(400).json({ error: 'Data esame obbligatoria' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // For certification workflows, add exam date field to registration
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        // Add examDate and examRegisteredBy fields to the Registration model in the future
        // For now, we'll use a generic approach
        dataVerifiedAt: new Date(examDate), // Temporary field usage
        status: 'ENROLLED' // Update status for certification workflow
      }
    });

    res.json({
      message: 'Data esame registrata con successo',
      examDate: new Date(examDate)
    });
  } catch (error: any) {
    console.error('Set exam date error:', error);
    res.status(500).json({ error: 'Errore nella registrazione della data esame' });
  }
});

// Get document audit trail for a specific document
router.get('/documents/:documentId/audit', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const auditLog = await DocumentService.getDocumentAuditTrail(documentId);
    
    const formattedLog = auditLog.map(log => ({
      id: log.id,
      action: log.action,
      performedBy: log.performer.email,
      performedAt: log.createdAt,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      notes: log.notes
    }));

    res.json({ auditLog: formattedLog });
  } catch (error: any) {
    console.error('Get document audit trail error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del log di audit' });
  }
});

// Bulk verify documents for a registration
router.post('/registrations/:registrationId/bulk-verify', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    const { documentStatuses } = req.body; // Array of { documentId, status, rejectionReason }
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (!Array.isArray(documentStatuses)) {
      return res.status(400).json({ error: 'documentStatuses deve essere un array' });
    }

    const results = [];

    for (const { documentId, status, rejectionReason } of documentStatuses) {
      try {
        // Use new methods based on status
        const result = status === DocumentStatus.APPROVED 
          ? await UnifiedDocumentService.approveDocument(documentId, req.user!.id)
          : await UnifiedDocumentService.rejectDocument(documentId, req.user!.id, rejectionReason || 'Motivo non specificato');
        
        results.push({
          documentId,
          success: true,
          status: result.document.status
        });
      } catch (error: any) {
        results.push({
          documentId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      message: 'Verifica documenti completata',
      results
    });
  } catch (error: any) {
    console.error('Bulk verify documents error:', error);
    res.status(500).json({ error: 'Errore nella verifica dei documenti' });
  }
});

// Get unified documents for a specific registration (partner view)
router.get('/registrations/:registrationId/documents/unified', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
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

    // Document types that exist in the database enum
    const documentTypes = [
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' },
      { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', description: 'Certificato di laurea triennale o diploma universitario' },
      { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento' },
      { type: 'TRANSCRIPT', name: 'Piano di Studio', description: 'Piano di studio con lista esami sostenuti' },
      { type: 'MEDICAL_CERT', name: 'Certificato Medico', description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica' },
      { type: 'BIRTH_CERT', name: 'Certificato di Nascita', description: 'Certificato di nascita o estratto di nascita dal Comune' },
      { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' },
      { type: 'OTHER', name: 'Altri Documenti', description: 'Altri documenti rilevanti' }
    ];

    // Get all documents for this user (from all sources)
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        AND: [
          { userId: registration.userId },
          {
            OR: [
              { registrationId: registrationId },
              { registrationId: null } // Include general documents
            ]
          }
        ]
      },
      include: {
        verifier: {
          select: { id: true, email: true }
        },
        uploader: {
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
      totalCount,
      registration: {
        id: registration.id,
        courseName: registration.offer?.course?.name || 'Corso non specificato'
      }
    });
  } catch (error) {
    console.error('Error getting unified registration documents:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Approve document
router.post('/documents/:documentId/approve', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const { notes } = req.body;
    const partnerId = req.partner?.id;
    const userId = req.user!.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Find the document and verify user belongs to this partner
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerId }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Check if user has registrations with this partner
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato ad approvare questo documento' });
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        verifiedBy: userId,
        verifiedAt: new Date()
      }
    });

    // Log the approval
    await prisma.documentActionLog.create({
      data: {
        documentId: documentId,
        action: 'APPROVE',
        performedBy: userId,
        performedRole: 'PARTNER',
        details: { notes: notes || 'Documento approvato' }
      }
    });

    res.json({
      message: 'Documento approvato con successo',
      document: {
        id: updatedDocument.id,
        status: updatedDocument.status,
        verifiedAt: updatedDocument.verifiedAt
      }
    });
  } catch (error) {
    console.error('Error approving document:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione del documento' });
  }
});

// Reject document
router.post('/documents/:documentId/reject', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const { reason, details } = req.body;
    const partnerId = req.partner?.id;
    const userId = req.user!.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Motivo del rifiuto è richiesto' });
    }

    // Find the document and verify user belongs to this partner
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerId }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Check if user has registrations with this partner
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a rifiutare questo documento' });
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectionDetails: details,
        verifiedBy: userId,
        verifiedAt: new Date(),
        userNotifiedAt: new Date()
      }
    });

    // Log the rejection
    await prisma.documentActionLog.create({
      data: {
        documentId: documentId,
        action: 'REJECT',
        performedBy: userId,
        performedRole: 'PARTNER',
        details: { reason, details }
      }
    });

    // TODO: Send email notification to user about document rejection
    // This should be implemented with the email service

    res.json({
      message: 'Documento rifiutato',
      document: {
        id: updatedDocument.id,
        status: updatedDocument.status,
        rejectionReason: updatedDocument.rejectionReason,
        verifiedAt: updatedDocument.verifiedAt
      }
    });
  } catch (error) {
    console.error('Error rejecting document:', error);
    res.status(500).json({ error: 'Errore nel rifiuto del documento' });
  }
});

// POST /api/partners/users/:userId/documents/upload - Partner uploads document for user
router.post('/users/:userId/documents/upload', authenticate, requireRole(['PARTNER', 'ADMIN']), documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId } = req.params;
    const { type, registrationId } = req.body;

    if (!partnerId) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Verify partner has access to this user
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId: userId,
        partnerId: partnerId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a caricare documenti per questo utente' });
    }

    // Use the UnifiedDocumentService to upload
    const document = await UnifiedDocumentService.uploadDocument(
      req.file,
      userId, // Document belongs to the user
      type,
      'PARTNER_PANEL', // Upload source
      req.user!.id, // Uploaded by partner
      'PARTNER', // Uploaded by role
      registrationId
    );

    res.json({
      success: true,
      document: {
        id: document.id,
        type: document.type,
        fileName: document.originalName,
        mimeType: document.mimeType,
        fileSize: document.size,
        uploadedAt: document.uploadedAt.toISOString(),
        status: document.status,
        uploadSource: document.uploadSource
      },
      message: 'Documento caricato con successo dal partner'
    });

  } catch (error: any) {
    console.error('Partner upload error:', error);
    // Clean up file on error
    if (req.file && require('fs').existsSync(req.file.path)) {
      require('fs').unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Errore nel caricamento del documento' });
  }
});

// GET /api/partner/export/registrations - Export partner's registrations to Excel
router.get('/export/registrations', authenticate, requireRole(['PARTNER']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get partner info for filename
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { referralCode: true }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Fetch partner's registrations with comprehensive data
    const registrations = await prisma.registration.findMany({
      where: { partnerId },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        deadlines: {
          orderBy: {
            dueDate: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${registrations.length} registrations for partner ${partner.referralCode}`);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Le Mie Registrazioni');

    // Define columns (same as admin but tailored for partners)
    worksheet.columns = [
      { header: 'ID Registrazione', key: 'registrationId', width: 15 },
      { header: 'Data Iscrizione', key: 'createdAt', width: 12 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Nome', key: 'nome', width: 15 },
      { header: 'Cognome', key: 'cognome', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Codice Fiscale', key: 'codiceFiscale', width: 16 },
      { header: 'Telefono', key: 'telefono', width: 12 },
      { header: 'Data Nascita', key: 'dataNascita', width: 12 },
      { header: 'Luogo Nascita', key: 'luogoNascita', width: 15 },
      { header: 'Residenza Via', key: 'residenzaVia', width: 25 },
      { header: 'Residenza Città', key: 'residenzaCitta', width: 15 },
      { header: 'Residenza Provincia', key: 'residenzaProvincia', width: 8 },
      { header: 'Residenza CAP', key: 'residenzaCap', width: 8 },
      { header: 'Corso', key: 'courseName', width: 30 },
      { header: 'Tipo Corso', key: 'courseType', width: 12 },
      { header: 'Offerta', key: 'offerName', width: 25 },
      { header: 'Tipo Offerta', key: 'offerType', width: 15 },
      { header: 'Costo Totale', key: 'totalAmount', width: 12 },
      { header: 'Importo Finale', key: 'finalAmount', width: 12 },
      { header: 'Rate Pagate', key: 'paidInstallments', width: 12 },
      { header: 'Rate Totali', key: 'totalInstallments', width: 12 },
      { header: 'Residuo da Pagare', key: 'remainingAmount', width: 15 },
      { header: 'Prossima Scadenza', key: 'nextDueDate', width: 15 },
      { header: 'Importo Prossima Rata', key: 'nextAmount', width: 15 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E2E2' }
    };

    // Add data rows
    for (const registration of registrations) {
      const profile = registration.user.profile;
      const paidDeadlines = registration.deadlines.filter((pd: any) => pd.isPaid);
      const unpaidDeadlines = registration.deadlines.filter((pd: any) => !pd.isPaid);
      const nextDeadline = unpaidDeadlines[0];
      
      // Calculate remaining amount
      const totalPaid = paidDeadlines.reduce((sum: number, pd: any) => sum + pd.amount, 0);
      const remainingAmount = Number(registration.finalAmount) - totalPaid;

      worksheet.addRow({
        registrationId: registration.id.substring(0, 8) + '...',
        createdAt: registration.createdAt.toLocaleDateString('it-IT'),
        status: registration.status,
        nome: profile?.nome || '',
        cognome: profile?.cognome || '',
        email: registration.user.email,
        codiceFiscale: profile?.codiceFiscale || '',
        telefono: profile?.telefono || '',
        dataNascita: profile?.dataNascita ? new Date(profile.dataNascita).toLocaleDateString('it-IT') : '',
        luogoNascita: profile?.luogoNascita || '',
        residenzaVia: profile?.residenzaVia || '',
        residenzaCitta: profile?.residenzaCitta || '',
        residenzaProvincia: profile?.residenzaProvincia || '',
        residenzaCap: profile?.residenzaCap || '',
        courseName: registration.offer?.course?.name || 'N/A',
        courseType: registration.offer?.course?.templateType || 'N/A',
        offerName: registration.offer?.name || 'N/A',
        offerType: registration.offer?.offerType || 'N/A',
        totalAmount: `€ ${Number(registration.offer?.totalAmount || 0).toFixed(2)}`,
        finalAmount: `€ ${Number(registration.finalAmount).toFixed(2)}`,
        paidInstallments: paidDeadlines.length,
        totalInstallments: registration.deadlines.length,
        remainingAmount: `€ ${remainingAmount.toFixed(2)}`,
        nextDueDate: nextDeadline ? nextDeadline.dueDate.toLocaleDateString('it-IT') : '',
        nextAmount: nextDeadline ? `€ ${nextDeadline.amount.toFixed(2)}` : ''
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.width && column.width < 8) {
        column.width = 8;
      }
    });

    // Generate filename with current date and partner code
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const filename = `registrazioni_${partner.referralCode}_${dateString}.xlsx`;

    console.log(`Generated Excel file: ${filename}`);

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Partner Excel export:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TFA POST-ENROLLMENT STEPS ====================

// Step 1: Register CNRED release
router.post('/registrations/:registrationId/cnred-release', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    // Update registration with CNRED release
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'CNRED_RELEASED',
        cnredReleasedAt: new Date(),
        cnredReleasedBy: partnerId
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaCnredReleasedNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending CNRED released email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Rilascio CNRED registrato con successo',
      status: 'CNRED_RELEASED'
    });

  } catch (error) {
    console.error('CNRED release registration error:', error);
    res.status(500).json({ error: 'Errore nella registrazione rilascio CNRED' });
  }
});

// Step 2: Register final exam
router.post('/registrations/:registrationId/final-exam', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const { examDate, passed } = req.body;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!examDate || passed === undefined) {
      return res.status(400).json({ error: 'Data esame e esito sono obbligatori' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    // Update registration with final exam info
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'FINAL_EXAM',
        finalExamDate: new Date(examDate),
        finalExamRegisteredBy: partnerId,
        finalExamPassed: Boolean(passed)
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaFinalExamNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA',
        Boolean(passed),
        new Date(examDate).toLocaleDateString('it-IT')
      );
    } catch (emailError) {
      console.error('Error sending final exam email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Esame finale registrato con successo',
      status: 'FINAL_EXAM',
      passed: Boolean(passed)
    });

  } catch (error) {
    console.error('Final exam registration error:', error);
    res.status(500).json({ error: 'Errore nella registrazione esame finale' });
  }
});

// Step 3: Register recognition request
router.post('/registrations/:registrationId/recognition-request', authenticate, requireRole(['PARTNER', 'ADMIN']), documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    let recognitionDocumentUrl = null;
    if (req.file) {
      recognitionDocumentUrl = `/uploads/documents/${req.file.filename}`;
    }

    // Update registration with recognition request
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'RECOGNITION_REQUEST',
        recognitionRequestDate: new Date(),
        recognitionRequestBy: partnerId,
        recognitionDocumentUrl
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaRecognitionRequestNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending recognition request email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Richiesta riconoscimento registrata con successo',
      status: 'RECOGNITION_REQUEST',
      documentUrl: recognitionDocumentUrl
    });

  } catch (error) {
    console.error('Recognition request error:', error);
    res.status(500).json({ error: 'Errore nella registrazione richiesta riconoscimento' });
  }
});

// Approve recognition (final step to COMPLETED)
router.post('/registrations/:registrationId/recognition-approval', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.status !== 'RECOGNITION_REQUEST') {
      return res.status(400).json({ error: 'La richiesta di riconoscimento deve essere già inviata' });
    }

    // Update registration to completed
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'COMPLETED',
        recognitionApprovalDate: new Date()
      }
    });

    // Send completion email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaCompletedNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending TFA completed email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Riconoscimento approvato - corso completato',
      status: 'COMPLETED'
    });

  } catch (error) {
    console.error('Recognition approval error:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione riconoscimento' });
  }
});

// GET /api/partner/registrations/:registrationId/tfa-steps - Get TFA steps for partner's registration
router.get('/registrations/:registrationId/tfa-steps', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId, 
        partnerId 
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
      cnredRelease: {
        step: 1,
        title: 'Rilascio CNRED',
        description: 'Il CNRED (Codice Nazionale di Riconoscimento Europeo dei Diplomi) è stato rilasciato',
        completed: !!registration.cnredReleasedAt,
        completedAt: registration.cnredReleasedAt,
        status: registration.status === 'CNRED_RELEASED' ? 'current' : 
                (!!registration.cnredReleasedAt ? 'completed' : 
                  (['CONTRACT_SIGNED', 'ENROLLED'].includes(registration.status) ? 'current' : 'pending'))
      },
      finalExam: {
        step: 2,
        title: 'Esame Finale',
        description: 'Sostenimento dell\'esame finale del corso TFA',
        completed: !!registration.finalExamDate,
        completedAt: registration.finalExamDate,
        passed: registration.finalExamPassed,
        status: registration.status === 'FINAL_EXAM' ? 'current' : 
                (!!registration.finalExamDate ? 'completed' : 'pending')
      },
      recognitionRequest: {
        step: 3,
        title: 'Richiesta Riconoscimento',
        description: 'Invio richiesta di riconoscimento del titolo conseguito',
        completed: !!registration.recognitionRequestDate,
        completedAt: registration.recognitionRequestDate,
        documentUrl: registration.recognitionDocumentUrl,
        status: registration.status === 'RECOGNITION_REQUEST' ? 'current' : 
                (!!registration.recognitionRequestDate ? 'completed' : 'pending')
      },
      finalCompletion: {
        step: 4,
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
    console.error('Partner TFA steps error:', error);
    res.status(500).json({ error: 'Errore nel recupero steps TFA' });
  }
});

// Get partner analytics data for charts
router.get('/analytics', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get monthly revenue for the last 6 months
    const now = new Date();
    const monthsData = [];
    
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthlyRevenue = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          registration: { partnerId },
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
      monthsData.push({
        month: monthName,
        revenue: Number(monthlyRevenue._sum.amount || 0),
        target: 2800 // Could be made configurable per partner
      });
    }

    // Get registration status distribution
    const statusCounts = await prisma.registration.groupBy({
      by: ['status'],
      where: { partnerId },
      _count: true
    });

    const statusData = statusCounts.map(item => ({
      status: item.status,
      count: item._count
    }));

    // Get user growth over time (registrations per month)
    const growthData = [];
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthlyUsers = await prisma.registration.count({
        where: {
          partnerId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
      growthData.push({
        month: monthName,
        users: monthlyUsers
      });
    }

    // Calculate conversion metrics
    const totalRegistrations = await prisma.registration.count({
      where: { partnerId }
    });

    const completedRegistrations = await prisma.registration.count({
      where: { 
        partnerId,
        status: 'COMPLETED'
      }
    });

    const conversionRate = totalRegistrations > 0 ? 
      Math.round((completedRegistrations / totalRegistrations) * 100) : 0;

    // Get pending actions count (users waiting for document verification)
    const documentsUpload = await prisma.registration.count({
      where: { 
        partnerId,
        status: 'PENDING'
      }
    });

    const contractGenerated = await prisma.registration.count({
      where: { 
        partnerId,
        status: 'CONTRACT_GENERATED'
      }
    });

    const contractSigned = await prisma.registration.count({
      where: { 
        partnerId,
        status: 'CONTRACT_SIGNED'
      }
    });

    res.json({
      revenueChart: monthsData,
      statusDistribution: statusData,
      userGrowth: growthData,
      metrics: {
        conversionRate,
        avgRevenuePerUser: totalRegistrations > 0 ? 
          Math.round((monthsData.reduce((sum, m) => sum + m.revenue, 0) / totalRegistrations)) : 0,
        growthRate: growthData.length > 1 ? 
          Math.round(((growthData[growthData.length - 1].users - growthData[0].users) / Math.max(growthData[0].users, 1)) * 100) : 0
      },
      pendingActions: {
        documentsToApprove: documentsUpload,
        contractsToSign: contractGenerated,
        paymentsInProgress: contractSigned,
        completedEnrollments: completedRegistrations
      }
    });
  } catch (error) {
    console.error('Get partner analytics error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;