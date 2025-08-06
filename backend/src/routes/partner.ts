import { Router, Response as ExpressResponse } from 'express';
import { PrismaClient, DocumentStatus } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { ContractService } from '../services/contractService';
import { DocumentService, upload as documentUpload } from '../services/documentService';
import UnifiedDocumentService from '../services/unifiedDocumentService';
import multer from 'multer';
import * as path from 'path';

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
      originalAmount: reg.originalAmount,
      finalAmount: reg.finalAmount,
      installments: reg.installments,
      // Lista offerte aggiuntive disponibili (sarà implementata dopo)
    }));

    res.json(users);
  } catch (error) {
    console.error('Get partner users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
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
        documents: true,      // Legacy documents (dove sono i nostri)
        userDocuments: true,  // New document system
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
    console.log(`- Legacy documents: ${registration.documents.length}`);
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
      // UserDocuments from registration (with enum types)  
      ...registration.userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        filePath: doc.url,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.status === 'APPROVED',
        source: 'UserDocument-Registration'
      })),
      // Legacy documents from registration (with string types - need mapping)
      ...registration.documents.map(doc => {
        // Map string types to enum types
        const typeMapping: { [key: string]: string } = {
          'cartaIdentita': 'CARTA_IDENTITA',
          'certificatoTriennale': 'CERTIFICATO_TRIENNALE',
          'certificatoMagistrale': 'CERTIFICATO_MAGISTRALE',
          'pianoStudioTriennale': 'PIANO_STUDIO_TRIENNALE',
          'pianoStudioMagistrale': 'PIANO_STUDIO_MAGISTRALE',
          'certificatoMedico': 'CERTIFICATO_MEDICO',
          'certificatoNascita': 'CERTIFICATO_NASCITA',
          'diplomoLaurea': 'DIPLOMA_LAUREA',
          'pergamenaLaurea': 'PERGAMENA_LAUREA'
        };
        
        return {
          id: doc.id,
          type: typeMapping[doc.type] || doc.type.toUpperCase(),
          fileName: doc.fileName,
          filePath: doc.filePath,
          uploadedAt: doc.uploadedAt,
          isVerified: false, // Legacy documents don't have verification status
          source: 'Document-Legacy'
        };
      })
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
        documents: true
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
      documents: registration.documents
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
    
    if (!partnerId) {
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
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
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

      // Set response headers and send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
      return res.send(pdfBuffer);
    }

    // If contract already exists, serve the file
    const contractPath = path.resolve(__dirname, '../..', registration.contractTemplateUrl.substring(1)); // Remove leading slash
    if (!require('fs').existsSync(contractPath)) {
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('Download contract error:', error);
    res.status(500).json({ error: 'Errore durante il download del contratto' });
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
      // If not found in UserDocument, try Document table (legacy documents from registrations)
      const legacyDoc = await prisma.document.findFirst({
        where: {
          id: documentId,
          registration: {
            userId,
            partnerId // Ensure document belongs to user's registration with this partner
          }
        }
      });
      
      if (legacyDoc) {
        documentSource = 'Document';
        filePath = legacyDoc.filePath;
        fileName = legacyDoc.fileName;
      }
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

    // Document types based on template
    const documentTypes = [
      { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
      { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' },
      { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', description: 'Certificato di laurea triennale o diploma universitario' },
      { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento' },
      { type: 'TRANSCRIPT', name: 'Piano di Studio Triennale', description: 'Piano di studio della laurea triennale con lista esami sostenuti' },
      { type: 'TRANSCRIPT_MASTER', name: 'Piano di Studio Magistrale', description: 'Piano di studio della laurea magistrale, specialistica o vecchio ordinamento' },
      { type: 'MEDICAL_CERT', name: 'Certificato Medico', description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica' },
      { type: 'BIRTH_CERT', name: 'Certificato di Nascita', description: 'Certificato di nascita o estratto di nascita dal Comune' },
      { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' },
      { type: 'OTHER', name: 'Pergamena di Laurea', description: 'Pergamena di laurea (documento originale)' }
    ];

    // Get all documents for this user (from all sources)
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        userId: registration.userId,
        OR: [
          { registrationId: registrationId },
          { registrationId: null } // Include general documents
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

export default router;