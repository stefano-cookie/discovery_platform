import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../../middleware/auth';
import { DocumentService } from '../../services/documentService';
import UnifiedDocumentService from '../../services/unifiedDocumentService';
import emailService from '../../services/emailService';
import * as fs from 'fs';
import { DocumentPathResolver } from '../../config/storage';

const router = Router();
const prisma = new PrismaClient();

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

// Download document
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

    // 🔥 FIX CRITICO: Usa DocumentPathResolver per path standardizzato
    const filePath = DocumentPathResolver.resolvePath(document.url);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    res.download(filePath, document.originalName);
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
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerId },
              include: { offer: true }
            },
            profile: true
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato ad approvare questo documento' });
    }

    // Update document status
    await prisma.userDocument.update({
      where: { id: documentId },
      data: { status: 'APPROVED' }
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        documentId,
        action: 'APPROVED',
        performedBy: partnerId,
        notes: notes || 'Documento approvato dal partner'
      }
    });

    res.json({ success: true, message: 'Documento approvato' });
  } catch (error) {
    console.error('Approve document error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Reject document
router.post('/documents/:documentId/reject', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { documentId } = req.params;
    const { reason, details } = req.body;
    
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
      return res.status(403).json({ error: 'Non autorizzato a rifiutare questo documento' });
    }

    // Update document status
    await prisma.userDocument.update({
      where: { id: documentId },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason
      }
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        documentId,
        action: 'REJECTED',
        performedBy: partnerId,
        notes: `Motivo: ${reason}${details ? ` - Dettagli: ${details}` : ''}`
      }
    });

    res.json({ success: true, message: 'Documento rifiutato' });
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