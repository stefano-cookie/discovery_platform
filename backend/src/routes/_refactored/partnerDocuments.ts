import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../../middleware/auth';
import { DocumentService } from '../../services/documentService';
import UnifiedDocumentService from '../../services/unifiedDocumentService';
import emailService from '../../services/emailService';
import { activityLogger } from '../../services/activityLogger.service';
import * as fs from 'fs';
import { DocumentPathResolver } from '../../config/storage';
import storageService from '../../services/storageService';

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper: Get human-readable label for document type
 */
function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'IDENTITY_CARD': 'Carta d\'Identità',
    'PASSPORT': 'Passaporto',
    'DIPLOMA': 'Diploma Superiori',
    'BACHELOR_DEGREE': 'Laurea Triennale',
    'MASTER_DEGREE': 'Laurea Magistrale',
    'TRANSCRIPT': 'Transcript Voti',
    'CV': 'Curriculum Vitae',
    'PHOTO': 'Foto Tessera',
    'RESIDENCE_CERT': 'Certificato di Residenza',
    'BIRTH_CERT': 'Certificato di Nascita',
    'CONTRACT_SIGNED': 'Contratto Firmato',
    'MEDICAL_CERT': 'Certificato Medico',
    'TESSERA_SANITARIA': 'Tessera Sanitaria',
    'OTHER': 'Altro Documento'
  };
  return labels[type] || type;
}

/**
 * Helper: Check if all required documents are reviewed
 * If yes, auto-advance registration to next step
 */
async function checkAndAdvanceRegistration(registrationId: string): Promise<void> {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        userDocuments: {
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!registration) {
      console.log(`[checkAndAdvanceRegistration] Registration ${registrationId} not found`);
      return;
    }

    // Get required documents for this registration type
    const requiredDocTypes = getRequiredDocumentTypes(registration.offerType);

    // Get LATEST document per type (in case of re-uploads, ignore old versions)
    // Documents are already sorted by createdAt DESC from the query
    const latestDocsByType = new Map<string, any>();
    registration.userDocuments
      .filter(doc => requiredDocTypes.includes(doc.type))
      .forEach(doc => {
        if (!latestDocsByType.has(doc.type)) {
          latestDocsByType.set(doc.type, doc);
        }
      });

    const requiredDocs = Array.from(latestDocsByType.values());

    const allRequiredDocsPresent = requiredDocs.length === requiredDocTypes.length;
    const allReviewed = requiredDocs.every(doc => doc.reviewedByPartner);
    const allApproved = requiredDocs.every(doc =>
      doc.status === 'APPROVED_BY_PARTNER' || doc.status === 'APPROVED'
    );

    console.log(`[checkAndAdvanceRegistration] Registration ${registrationId}:`);
    console.log(`  - Offer type: ${registration.offerType}`);
    console.log(`  - Current status: ${registration.status}`);
    console.log(`  - Required doc types (${requiredDocTypes.length}): ${requiredDocTypes.join(', ')}`);
    console.log(`  - Latest docs found: ${requiredDocs.length}`);
    console.log(`  - Document types found: ${requiredDocs.map(d => d.type).join(', ')}`);
    console.log(`  - All required docs present: ${allRequiredDocsPresent}`);
    console.log(`  - All reviewed: ${allReviewed}`);
    console.log(`  - All approved: ${allApproved}`);

    // Check if all required documents are present and reviewed
    if (allRequiredDocsPresent && allReviewed) {
      // All required documents uploaded and reviewed → advance to next step
      let newStatus = registration.status;

      if (allApproved) {
        // All approved by partner → check offer type for different workflows
        if (registration.offerType === 'CERTIFICATION' && registration.status === 'ENROLLED') {
          // CERTIFICATION workflow: ENROLLED → DOCUMENTS_APPROVED (if payment is complete)
          const deadlines = await prisma.paymentDeadline.findMany({
            where: { registrationId }
          });
          const allDeadlinesPaid = deadlines.length > 0 && deadlines.every(d => d.paymentStatus === 'PAID');

          if (allDeadlinesPaid) {
            newStatus = 'DOCUMENTS_APPROVED';
            console.log(`[checkAndAdvanceRegistration] ✅ CERTIFICATION: All documents approved + payment complete - advancing to DOCUMENTS_APPROVED`);
          } else {
            console.log(`[checkAndAdvanceRegistration] ⚠️ CERTIFICATION: All documents approved but payment not complete - staying in ENROLLED`);
          }
        } else if (registration.status === 'DOCUMENTS_UPLOADED') {
          // TFA workflow: DOCUMENTS_UPLOADED → AWAITING_DISCOVERY_APPROVAL
          newStatus = 'AWAITING_DISCOVERY_APPROVAL';
          console.log(`[checkAndAdvanceRegistration] ✅ All documents approved - advancing to AWAITING_DISCOVERY_APPROVAL`);
        }
      } else {
        // Some documents rejected - keep status for user to re-upload
        console.log(`[checkAndAdvanceRegistration] ⚠️ Some documents rejected - staying in ${registration.status}`);
      }

      if (newStatus !== registration.status) {
        await prisma.registration.update({
          where: { id: registrationId },
          data: { status: newStatus }
        });
        console.log(`[checkAndAdvanceRegistration] ✅ Registration ${registrationId} advanced from ${registration.status} to ${newStatus}`);
      }
    } else {
      if (!allRequiredDocsPresent) {
        const missingTypes = requiredDocTypes.filter(type => !requiredDocs.some(doc => doc.type === type));
        console.log(`[checkAndAdvanceRegistration] ⚠️ Missing required documents: ${missingTypes.join(', ')}`);
      }
      if (!allReviewed) {
        const unreviewed = requiredDocs.filter(doc => !doc.reviewedByPartner);
        console.log(`[checkAndAdvanceRegistration] ⚠️ Unreviewed documents: ${unreviewed.map(d => d.type).join(', ')}`);
      }
    }
  } catch (error) {
    console.error('[checkAndAdvanceRegistration] Error:', error);
    // Don't throw - this is a non-blocking operation
  }
}

/**
 * Helper: Get required document types for offer type
 */
function getRequiredDocumentTypes(offerType: 'TFA_ROMANIA' | 'CERTIFICATION'): string[] {
  if (offerType === 'TFA_ROMANIA') {
    return [
      'IDENTITY_CARD',
      'TESSERA_SANITARIA',
      'DIPLOMA',
      'BACHELOR_DEGREE',
      'MASTER_DEGREE',
      'TRANSCRIPT',
      'MEDICAL_CERT',
      'BIRTH_CERT'
    ];
  } else if (offerType === 'CERTIFICATION') {
    return ['IDENTITY_CARD', 'TESSERA_SANITARIA'];
  }
  // Default
  return ['IDENTITY_CARD', 'TESSERA_SANITARIA'];
}

// Get pending documents for verification
router.get('/documents/pending', authenticateUnified, async (req: AuthRequest, res) => {
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

// Get documents for a specific registration
router.get('/registrations/:registrationId/documents', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: { 
          include: { course: true } 
        },
        user: { 
          include: { profile: true } 
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Get user documents to match against required documents
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        userId: registration.userId,
        registrationId: registrationId
      },
      orderBy: { uploadedAt: 'desc' }
    });

    console.log(`📄 Partner documents check for registration ${registrationId}:`);
    console.log(`📄 User documents count: ${userDocuments.length}`);

    // Determine required documents based on offer type
    let requiredDocuments: any[] = [];
    
    if (registration.offer?.offerType === 'TFA_ROMANIA') {
      // Basic documents
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: true,
          description: 'Documento di identità valido'
        },
        {
          type: 'TESSERA_SANITARIA',
          name: 'Tessera Sanitaria/Codice Fiscale',
          required: true,
          description: 'Tessera sanitaria o documento con codice fiscale'
        },
        {
          type: 'DIPLOMA_LAUREA',
          name: 'Diploma di Laurea',
          required: true,
          description: 'Diploma di laurea conseguito'
        },
        {
          type: 'CERTIFICATO_LAUREA',
          name: 'Certificato di Laurea con Esami',
          required: true,
          description: 'Certificato di laurea con elenco esami e voti'
        },
        {
          type: 'DICHIARAZIONE_SOSTITUTIVA',
          name: 'Dichiarazione Sostitutiva',
          required: false,
          description: 'Dichiarazione sostitutiva per titoli non italiani'
        },
        {
          type: 'CERTIFICAZIONE_LINGUISTICA',
          name: 'Certificazione Linguistica B2',
          required: false,
          description: 'Certificazione di competenza linguistica livello B2'
        },
        {
          type: 'CV_EUROPASS',
          name: 'CV in formato Europass',
          required: false,
          description: 'Curriculum Vitae in formato europeo Europass'
        },
        {
          type: 'RICEVUTA_PAGAMENTO',
          name: 'Ricevuta di Pagamento',
          required: false,
          description: 'Ricevuta di pagamento della prima rata'
        }
      ];
    } else if (registration.offer?.offerType === 'CERTIFICATION') {
      // Certification documents (simplified)
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: true,
          description: 'Documento di identità valido'
        },
        {
          type: 'TESSERA_SANITARIA',
          name: 'Tessera Sanitaria/Codice Fiscale',
          required: true,
          description: 'Tessera sanitaria o documento con codice fiscale'
        }
      ];
    } else {
      // Default minimal documents
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: true,
          description: 'Documento di identità valido'
        },
        {
          type: 'TESSERA_SANITARIA',
          name: 'Tessera Sanitaria/Codice Fiscale',
          required: true,
          description: 'Tessera sanitaria o documento con codice fiscale'
        }
      ];
    }

    // Combine all documents from different sources
    const allDocuments = userDocuments.map(doc => ({
      ...doc,
      source: 'USER_UPLOAD'
    }));

    console.log(`📄 All documents found: ${allDocuments.map(d => `${d.originalName} (${d.type}, ${d.source})`).join(', ')}`);

    // Map user documents to required ones (checking all document sources)
    const documentsWithStatus = requiredDocuments.map(reqDoc => {
      const matchingDoc = allDocuments.find(doc => doc.type === reqDoc.type);
      
      return {
        ...reqDoc,
        uploaded: !!matchingDoc,
        document: matchingDoc ? {
          id: matchingDoc.id,
          fileName: matchingDoc.originalName,
          originalName: matchingDoc.originalName,
          uploadedAt: matchingDoc.uploadedAt,
          status: matchingDoc.status,
          size: matchingDoc.size,
          mimeType: matchingDoc.mimeType,
          source: matchingDoc.source
        } : null
      };
    });

    res.json({
      registration: {
        id: registration.id,
        status: registration.status,
        user: registration.user,
        offer: registration.offer
      },
      documents: documentsWithStatus,
      uploadedCount: documentsWithStatus.filter(doc => doc.uploaded).length,
      totalCount: documentsWithStatus.length,
      requiredCount: documentsWithStatus.filter(doc => doc.required).length,
      pendingCount: documentsWithStatus.filter(doc => doc.uploaded && doc.document?.status === 'PENDING').length
    });
  } catch (error) {
    console.error('Get registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get unified documents for a registration
router.get('/registrations/:registrationId/documents/unified', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    const documents = await UnifiedDocumentService.getRegistrationDocuments(registrationId);
    res.json(documents);
  } catch (error) {
    console.error('Get unified registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Download document (redirect to R2 signed URL)
router.get('/documents/:documentId/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const document = await prisma.userDocument.findUnique({
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

    // Verify partner has access to this document through registration
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a scaricare questo documento' });
    }

    // Get signed URL from R2
    const signedUrl = await storageService.getSignedDownloadUrl(document.url);

    // Redirect to signed URL
    res.redirect(signedUrl);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get document audit logs
router.get('/documents/:documentId/audit', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerId }
            }
          }
        },
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Verify partner has access to this document
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a visualizzare i log di questo documento' });
    }

    res.json({
      document: {
        id: document.id,
        type: document.type,
        originalName: document.originalName,
        status: document.status
      },
      auditLogs: []
    });
  } catch (error) {
    console.error('Get document audit error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Approve document
router.post('/documents/:documentId/approve', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    // Support both legacy partner system and new PartnerCompany system
    const partnerId = req.partner?.id;
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployeeId = req.partnerEmployee?.id;
    const { documentId } = req.params;
    const { notes } = req.body;

    if (!partnerId && !partnerCompanyId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: partnerCompanyId ? { partnerCompanyId } : { partnerId },
              include: { offer: true }
            },
            profile: true
          }
        },
        registration: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato ad approvare questo documento' });
    }

    // Update document status to APPROVED_BY_PARTNER
    // Note: partnerCheckedBy field references User table, so only set if partnerId exists
    const updateData: any = {
      status: 'APPROVED_BY_PARTNER',
      reviewedByPartner: true,
      partnerCheckedAt: new Date()
    };

    if (partnerId) {
      updateData.partnerCheckedBy = partnerId;
    }

    await prisma.userDocument.update({
      where: { id: documentId },
      data: updateData
    });

    // Create audit log (non-blocking)
    // Note: performedBy field references User table
    // For legacy partners: use req.user.id (partner has User account)
    // For PartnerEmployee: skip audit log (they don't have User accounts)
    if (partnerId && req.user?.id) {
      try {
        // Verify the user ID exists in User table before creating audit log
        const userExists = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true }
        });

        if (userExists) {
          await prisma.documentAuditLog.create({
            data: {
              documentId,
              action: 'APPROVED',
              performedBy: req.user.id,
              previousStatus: document.status,
              newStatus: 'APPROVED_BY_PARTNER',
              notes: notes || 'Documento approvato dal partner'
            }
          });
        } else {
          console.log('[AUDIT] Skipping DocumentAuditLog - User ID not found in User table');
        }
      } catch (auditError) {
        console.error('Error creating DocumentAuditLog (non-critical):', auditError);
        // Continue - don't fail the approval if audit log creation fails
      }
    } else {
      // PartnerEmployee doesn't have User account - skip audit log
      console.log('[AUDIT] Skipping DocumentAuditLog - PartnerEmployee has no User ID');
    }

    // Check if all documents are reviewed → auto-advance registration (non-blocking)
    if (document.registrationId) {
      try {
        await checkAndAdvanceRegistration(document.registrationId);
      } catch (advanceError) {
        console.error('Error auto-advancing registration (non-critical):', advanceError);
        // Continue - don't fail the approval if state advancement fails
      }
    }

    // Log partner activity (non-blocking)
    if (partnerCompanyId && partnerEmployeeId) {
      try {
        await activityLogger.log({
            partnerEmployeeId,
            partnerCompanyId,
            action: 'APPROVE_DOCUMENT',
            category: 'CRITICAL',
            method: 'POST',
            endpoint: `/api/partner/documents/${documentId}/approve`,
            resourceType: 'USER_DOCUMENT',
            resourceId: documentId,
            details: {
              documentType: document.type,
              userId: document.userId,
              userEmail: document.user.email,
              registrationId: document.registrationId,
              previousStatus: document.status,
              notes: notes || 'Documento approvato'
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
      } catch (logError) {
        console.error('Error logging activity (non-critical):', logError);
        // Continue - don't fail the approval if logging fails
      }
    }

    res.json({ success: true, message: 'Documento approvato' });
  } catch (error) {
    console.error('Approve document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Reject document
router.post('/documents/:documentId/reject', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    // Support both legacy partner system and new PartnerCompany system
    const partnerId = req.partner?.id;
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployeeId = req.partnerEmployee?.id;
    const { documentId } = req.params;
    const { reason, details } = req.body;

    if (!partnerId && !partnerCompanyId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'La motivazione del rifiuto è obbligatoria' });
    }

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: partnerCompanyId ? { partnerCompanyId } : { partnerId },
              include: {
                offer: {
                  include: { course: true }
                }
              }
            },
            profile: true
          }
        },
        registration: {
          include: {
            offer: {
              include: { course: true }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a rifiutare questo documento' });
    }

    // Update document status to REJECTED_BY_PARTNER
    // Note: partnerCheckedBy field references User table, so only set if partnerId exists
    const updateData: any = {
      status: 'REJECTED_BY_PARTNER',
      reviewedByPartner: true,
      rejectionReason: reason,
      rejectionDetails: details || null,
      partnerCheckedAt: new Date(),
      userNotifiedAt: new Date()
    };

    if (partnerId) {
      updateData.partnerCheckedBy = partnerId;
    }

    await prisma.userDocument.update({
      where: { id: documentId },
      data: updateData
    });

    // Create audit log (non-blocking)
    // Note: performedBy field references User table
    // For legacy partners: use req.user.id (partner has User account)
    // For PartnerEmployee: skip audit log (they don't have User accounts)
    if (partnerId && req.user?.id) {
      try {
        // Verify the user ID exists in User table before creating audit log
        const userExists = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { id: true }
        });

        if (userExists) {
          await prisma.documentAuditLog.create({
            data: {
              documentId,
              action: 'REJECTED',
              performedBy: req.user.id,
              previousStatus: document.status,
              newStatus: 'REJECTED_BY_PARTNER',
              notes: `Motivo: ${reason}${details ? ` - Dettagli: ${details}` : ''}`
            }
          });
        } else {
          console.log('[AUDIT] Skipping DocumentAuditLog - User ID not found in User table');
        }
      } catch (auditError) {
        console.error('Error creating DocumentAuditLog (non-critical):', auditError);
        // Continue - don't fail the rejection if audit log creation fails
      }
    } else {
      // PartnerEmployee doesn't have User account - skip audit log
      console.log('[AUDIT] Skipping DocumentAuditLog - PartnerEmployee has no User ID');
    }

    // Send rejection email to user (non-blocking)
    let emailSent = false;
    try {
      // Validate email and user data before sending
      if (!document.user.email) {
        console.error('[EMAIL] Cannot send rejection email - user email is missing');
      } else {
        const userName = document.user.profile?.nome || document.user.profile?.cognome || 'Utente';
        emailSent = await emailService.sendDocumentRejectionEmail(
          document.user.email,
          userName,
          document.type,
          reason,
          details,
          document.registrationId || undefined
        );
        if (!emailSent) {
          console.warn('[EMAIL] Document rejection email could not be sent (non-critical)');
        } else {
          console.log('[EMAIL] Document rejection email sent successfully to:', document.user.email);
        }
      }
    } catch (emailError) {
      console.error('[EMAIL] Error sending rejection email (non-critical):', emailError);
      // Continue - don't fail the rejection if email fails
    }

    // Check if all documents are reviewed → auto-advance registration (non-blocking)
    if (document.registrationId) {
      try {
        await checkAndAdvanceRegistration(document.registrationId);
      } catch (advanceError) {
        console.error('Error auto-advancing registration (non-critical):', advanceError);
        // Continue - don't fail the rejection if state advancement fails
      }
    }

    // Log partner activity (non-blocking)
    if (partnerCompanyId && partnerEmployeeId) {
      try {
        await activityLogger.log({
            partnerEmployeeId,
            partnerCompanyId,
            action: 'REJECT_DOCUMENT',
            category: 'CRITICAL',
            method: 'POST',
            endpoint: `/api/partner/documents/${documentId}/reject`,
            resourceType: 'USER_DOCUMENT',
            resourceId: documentId,
            details: {
              documentType: document.type,
              userId: document.userId,
              userEmail: document.user.email,
              registrationId: document.registrationId,
              previousStatus: document.status,
              rejectionReason: reason,
              rejectionDetails: details
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
      } catch (logError) {
        console.error('Error logging activity (non-critical):', logError);
        // Continue - don't fail the rejection if logging fails
      }
    }

    res.json({
      success: true,
      message: emailSent
        ? 'Documento rifiutato e utente notificato via email'
        : 'Documento rifiutato (email non inviata)'
    });
  } catch (error) {
    console.error('Reject document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Verify document (generic status update)
router.post('/documents/:documentId/verify', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { status, rejectionReason } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const document = await prisma.userDocument.findUnique({
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

    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a verificare questo documento' });
    }

    // Update document
    const updateData: any = { status };
    if (status === 'REJECTED' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    await prisma.userDocument.update({
      where: { id: documentId },
      data: updateData
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        documentId,
        action: status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        performedBy: partnerId,
        notes: rejectionReason || `Documento ${status.toLowerCase()}`
      }
    });

    res.json({ success: true, message: `Documento ${status.toLowerCase()}` });
  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Notify user about document status
router.post('/documents/:documentId/notify', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          include: { profile: true }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Send notification email based on document status
    if (document.status === 'APPROVED') {
      await emailService.sendDocumentApprovedEmail(
        document.user.email,
        document.user.profile?.nome || 'Utente',
        document.type
      );
    } else if (document.status === 'REJECTED') {
      await emailService.sendDocumentRejectedEmail(
        document.user.email,
        document.user.profile?.nome || 'Utente',
        document.type,
        document.rejectionReason || 'Non specificato',
        'Ti preghiamo di caricare un nuovo documento.'
      );
    }

    res.json({ success: true, message: 'Notifica inviata' });
  } catch (error) {
    console.error('Notify document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;