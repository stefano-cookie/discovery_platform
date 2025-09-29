import express from 'express';
import { DocumentService, upload } from '../services/documentService';
import { authenticate, AuthRequest } from '../middleware/auth';
import unifiedDownload from '../middleware/unifiedDownload';
import { DocumentType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = express.Router();

// Get document types configuration
router.get('/types', authenticate, async (req: AuthRequest, res) => {
  try {
    const documentTypes = await DocumentService.getDocumentTypes();
    
    const formattedTypes = documentTypes.map(type => ({
      value: type.type,
      label: type.label,
      description: type.description,
      required: type.isRequired,
      acceptedMimeTypes: type.acceptedMimeTypes,
      maxFileSize: type.maxFileSize
    }));

    res.json({ documentTypes: formattedTypes });
  } catch (error: any) {
    console.error('Error fetching document types:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei tipi documento' });
  }
});

// Get user's repository documents - DEPRECATED: now documents are registration-specific
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    console.log(`DEPRECATED: getUserDocuments endpoint called for user ${userId} - returning empty array`);
    
    // Return empty array as documents are now registration-specific
    const formattedDocs: any[] = [];

    res.json({ documents: formattedDocs });
  } catch (error: any) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei documenti' });
  }
});

// Get user's enrollment documents (from registrations)
router.get('/enrollment-documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const enrollmentDocs = await DocumentService.getEnrollmentDocuments(userId);
    
    const formattedDocs = enrollmentDocs.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      status: doc.status,
      isVerified: doc.status === 'APPROVED',
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.uploadedAt,
      registrationId: doc.registrationId,
      courseName: doc.registration?.offer?.course?.name || 'Corso non specificato'
    }));

    res.json({ documents: formattedDocs });
  } catch (error: any) {
    console.error('Error fetching enrollment documents:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei documenti delle iscrizioni' });
  }
});

// Upload document to repository - DEPRECATED: now documents must be associated with a registration
router.post('/', authenticate, upload.single('document'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    console.log(`DEPRECATED: document upload to repository endpoint called for user ${userId}`);
    
    return res.status(400).json({ 
      error: 'Upload documenti generico non più supportato', 
      message: 'I documenti devono ora essere caricati tramite una specifica iscrizione'
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    if (error.message.includes('formato non supportato')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Errore nell\'upload del documento' });
    }
  }
});

// Download document (redirect to R2 signed URL)
router.get('/:documentId/download', authenticate, unifiedDownload, async (req: AuthRequest, res) => {
  // This endpoint now uses UnifiedDownloadMiddleware for better security and performance
});

// Delete document
router.delete('/:documentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user!.id;
    
    await DocumentService.deleteDocument(documentId, userId, userId);
    
    res.json({ message: 'Documento eliminato con successo' });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    res.status(404).json({ error: error.message || 'Documento non trovato' });
  }
});

// Get document audit trail
router.get('/:documentId/audit', authenticate, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const auditLog = await DocumentService.getDocumentAuditTrail(documentId);
    
    res.json({ auditLog });
  } catch (error: any) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Errore nel caricamento del log di audit' });
  }
});

// Migrate enrollment documents to repository
router.post('/migrate-enrollment', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const migrations = await DocumentService.migrateEnrollmentDocuments(userId);
    
    res.json({ 
      message: `${migrations.length} documenti migrati con successo`,
      migrations 
    });
  } catch (error: any) {
    console.error('Error migrating documents:', error);
    res.status(500).json({ error: 'Errore nella migrazione dei documenti' });
  }
});

// Download enrollment document (redirect to R2 signed URL)
router.get('/enrollment-documents/:documentId/download', authenticate, unifiedDownload, async (req: AuthRequest, res) => {
  // This endpoint now uses UnifiedDownloadMiddleware for better security and performance
});

// Sync user documents between enrollment and dashboard
router.post('/sync', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const syncResult = await DocumentService.syncDocumentsForUser(userId);
    
    res.json({ 
      message: 'Sincronizzazione completata con successo',
      result: syncResult
    });
  } catch (error: any) {
    console.error('Error syncing documents:', error);
    res.status(500).json({ error: 'Errore nella sincronizzazione dei documenti' });
  }
});

// Get document status
router.get('/:documentId/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user!.id;
    
    const document = await prisma.userDocument.findFirst({
      where: { 
        id: documentId,
        userId 
      },
      select: {
        id: true,
        status: true,
        verifiedAt: true,
        rejectionReason: true,
        rejectionDetails: true,
        verifier: {
          select: { email: true }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    res.json({ 
      status: document.status,
      verifiedAt: document.verifiedAt,
      rejectionReason: document.rejectionReason,
      rejectionDetails: document.rejectionDetails,
      verifiedBy: document.verifier?.email
    });
  } catch (error: any) {
    console.error('Error getting document status:', error);
    res.status(500).json({ error: 'Errore nel caricamento dello stato del documento' });
  }
});

export default router;