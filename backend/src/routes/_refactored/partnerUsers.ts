import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../middleware/auth';
import { DocumentService, upload as documentUpload } from '../services/documentService';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Get partner users
router.get('/users', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const filter = req.query.filter as string || 'all';
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    let whereClause: any = {};
    
    if (filter === 'direct') {
      whereClause = { 
        partnerCompanyId,
        isDirectRegistration: true 
      };
    } else if (filter === 'children') {
      const childCompanies = await prisma.partnerCompany.findMany({
        where: { parentId: partnerCompanyId },
        select: { id: true }
      });
      whereClause = { 
        sourcePartnerCompanyId: { in: childCompanies.map((c: { id: string }) => c.id) },
        isDirectRegistration: false
      };
    } else {
      // All users (direct + children)
      const childCompanies = await prisma.partnerCompany.findMany({
        where: { parentId: partnerCompanyId },
        select: { id: true }
      });
      whereClause = { 
        OR: [
          { partnerCompanyId, isDirectRegistration: true },
          { 
            sourcePartnerCompanyId: { in: childCompanies.map((c: { id: string }) => c.id) },
            isDirectRegistration: false
          }
        ]
      };
    }

    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        user: {
          include: { profile: true }
        },
        partnerCompany: {
          select: { name: true, referralCode: true }
        },
        sourcePartnerCompany: {
          select: { name: true, referralCode: true }
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
      courseName: reg.offer?.course?.name || 'Corso non specificato',
      courseId: reg.offer?.courseId || '',
      offerType: reg.offer?.offerType || 'TFA_ROMANIA',
      isDirectUser: reg.isDirectRegistration,
      partnerName: reg.isDirectRegistration 
        ? reg.partnerCompany?.name || 'Diretta'
        : reg.sourcePartnerCompany?.name || 'Partner figlio',
      canManagePayments: req.partnerEmployee?.role === 'ADMINISTRATIVE',
      // Date importanti
      createdAt: reg.user.createdAt, // Data registrazione utente
      enrollmentDate: reg.createdAt,  // Data iscrizione al corso
      // Dati pagamento (solo per ADMINISTRATIVE)
      originalAmount: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? Number(reg.originalAmount || 0) : 0,
      finalAmount: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? Number(reg.finalAmount || 0) : 0,
      installments: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? (reg.installments || 1) : 1,
      // Dati contratto
      contractTemplateUrl: reg.contractTemplateUrl,
      contractSignedUrl: reg.contractSignedUrl,
      contractGeneratedAt: reg.contractGeneratedAt,
      contractUploadedAt: reg.contractUploadedAt
    }));

    res.json(users);
  } catch (error) {
    console.error('Get partner users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get user offers access - for managing what offers a user can access
router.get('/users/:userId/offers', authenticatePartner, async (req: AuthRequest, res) => {
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
router.post('/users/:userId/offers/:offerId/grant', authenticatePartner, async (req: AuthRequest, res) => {
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
router.post('/users/:userId/offers/:offerId/revoke', authenticatePartner, async (req: AuthRequest, res) => {
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

// Get all documents for a user (partner access)
router.get('/users/:userId/documents', authenticatePartner, async (req: AuthRequest, res) => {
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

// Download user document (partner access)
router.get('/users/:userId/documents/:documentId/download', authenticatePartner, async (req: AuthRequest, res) => {
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
      return res.status(403).json({ error: 'Non autorizzato a scaricare documenti di questo utente' });
    }

    // Get the document
    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Check if file exists on disk
    const filePath = path.join(__dirname, '../../uploads', document.fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File fisico non trovato sul server' });
    }

    // Send file
    res.download(filePath, document.originalName, (err) => {
      if (err) {
        console.error('File download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Errore durante il download del file' });
        }
      }
    });

  } catch (error) {
    console.error('Download user document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get all user documents with enhanced info
router.get('/users/:userId/documents/all', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Get user profile for context
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Get all user documents with audit logs
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      include: {
        auditLogs: {
          orderBy: { timestamp: 'desc' },
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    const documentsWithStatus = documents.map(doc => {
      // Calculate derived status based on audit logs and current status
      let derivedStatus = doc.status;
      const latestLog = doc.auditLogs[0];
      
      if (latestLog && latestLog.action === 'VERIFIED') {
        derivedStatus = 'VERIFIED';
      } else if (latestLog && latestLog.action === 'REJECTED') {
        derivedStatus = 'REJECTED';
      }

      return {
        ...doc,
        derivedStatus,
        latestAction: latestLog ? {
          action: latestLog.action,
          timestamp: latestLog.timestamp,
          userEmail: latestLog.user?.email,
          notes: latestLog.notes
        } : null
      };
    });

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile
      },
      documents: documentsWithStatus
    });
  } catch (error) {
    console.error('Get all user documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Partner uploads document for user
router.post('/users/:userId/documents/upload', authenticatePartner, documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { userId } = req.params;
    const { type, notes } = req.body;
    const file = req.file;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Verify that the user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId,
        partnerId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a caricare documenti per questo utente' });
    }

    // Create document record
    const document = await DocumentService.createDocument(
      userId,
      type as any,
      file.filename,
      file.originalname,
      file.size,
      file.mimetype,
      'PARTNER_UPLOAD',
      userRegistrations[0].id // Associate with first registration
    );

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        documentId: document.id,
        action: 'UPLOADED',
        userId: partnerId, // Partner as uploader
        notes: notes || 'Caricato dal partner'
      }
    });

    res.json({ 
      success: true, 
      message: 'Documento caricato con successo',
      document
    });
  } catch (error) {
    console.error('Partner document upload error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;