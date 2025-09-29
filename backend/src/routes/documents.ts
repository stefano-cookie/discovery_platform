import { Router, Request, Response } from 'express';
import { PrismaClient, DocumentType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import unifiedDownload from '../middleware/unifiedDownload';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import emailService from '../services/emailService';
import storageManager from '../services/storageManager';

const router = Router();
const prisma = new PrismaClient();

// Ensure upload directories exist
const baseUploadDir = path.join(process.cwd(), 'uploads');
const ensureDirectoryExists = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Create upload directories
ensureDirectoryExists(baseUploadDir);
ensureDirectoryExists(path.join(baseUploadDir, 'documents'));
ensureDirectoryExists(path.join(baseUploadDir, 'documents', 'user-uploads'));

// Multer configuration for memory storage (files go to R2)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'image/jpeg', 
      'image/jpg', 
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Il file è di un formato non supportato. Formati accettati: PDF, JPG, PNG, DOC, DOCX'));
    }
  }
});

// Document type configurations by template
const TFA_DOCUMENT_TYPES = {
  cartaIdentita: {
    name: 'Carta d\'Identità',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  certificatoTriennale: {
    name: 'Certificato Laurea Triennale',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  certificatoMagistrale: {
    name: 'Certificato Laurea Magistrale',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  pianoStudioTriennale: {
    name: 'Piano di Studio Triennale',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  pianoStudioMagistrale: {
    name: 'Piano di Studio Magistrale',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  certificatoMedico: {
    name: 'Certificato Medico di Sana e Robusta Costituzione',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  certificatoNascita: {
    name: 'Certificato di Nascita',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  diplomoLaurea: {
    name: 'Diploma di Laurea',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  pergamenaLaurea: {
    name: 'Pergamena di Laurea',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  }
};

const CERTIFICATION_DOCUMENT_TYPES = {
  cartaIdentita: {
    name: 'Carta d\'Identità',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  },
  certificatoMedico: {
    name: 'Codice Fiscale / Tessera Sanitaria',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024
  }
};

// Combined for backward compatibility
const DOCUMENT_TYPES = { ...TFA_DOCUMENT_TYPES, ...CERTIFICATION_DOCUMENT_TYPES };

// GET /api/documents/types - Get document type configurations
router.get('/types', (req: Request, res: Response) => {
  const { templateType } = req.query;
  
  let documentTypes;
  
  if (templateType === 'CERTIFICATION') {
    documentTypes = Object.entries(CERTIFICATION_DOCUMENT_TYPES).map(([type, config]) => ({
      type,
      ...config
    }));
  } else if (templateType === 'TFA') {
    documentTypes = Object.entries(TFA_DOCUMENT_TYPES).map(([type, config]) => ({
      type,
      ...config
    }));
  } else {
    // Default to all types
    documentTypes = Object.entries(DOCUMENT_TYPES).map(([type, config]) => ({
      type,
      ...config
    }));
  }
  
  res.json({ documentTypes });
});

// GET /api/documents - Get all user documents
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get ALL documents for the user (including enrollment documents)
    const documents = await prisma.userDocument.findMany({
      where: {
        userId: userId
        // Removed filter - show all documents regardless of source
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      }
    });

    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      fileSize: doc.size,
      uploadedAt: doc.uploadedAt.toISOString(),
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      rejectionDetails: doc.rejectionDetails,
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt?.toISOString()
    }));

    res.json({ documents: formattedDocuments });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti' });
  }
});

// GET /api/documents/enrollment/:registrationId - Get enrollment documents
router.get('/enrollment/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { registrationId } = req.params;
    
    const documents = await prisma.userDocument.findMany({
      where: {
        userId: userId,
        registrationId: registrationId,
        uploadSource: 'ENROLLMENT'
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      }
    });

    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      fileSize: doc.size,
      uploadedAt: doc.uploadedAt.toISOString(),
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      rejectionDetails: doc.rejectionDetails,
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt?.toISOString()
    }));

    res.json({ documents: formattedDocuments });
  } catch (error) {
    console.error('Error fetching enrollment documents:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti di iscrizione' });
  }
});

// GET /api/documents/registration/:registrationId - Get all documents for a registration (both enrollment and dashboard uploads)
router.get('/registration/:registrationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { registrationId } = req.params;
    
    // Get all documents for this user related to this registration
    const documents = await prisma.userDocument.findMany({
      where: {
        userId: userId,
        registrationId: registrationId // Only documents specifically for this registration
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      }
    });

    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      fileSize: doc.size,
      uploadedAt: doc.uploadedAt.toISOString(),
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      rejectionDetails: doc.rejectionDetails,
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt?.toISOString(),
      uploadSource: doc.uploadSource
    }));

    res.json({ documents: formattedDocuments });
  } catch (error) {
    console.error('Error fetching registration documents:', error);
    res.status(500).json({ error: 'Errore nel recupero dei documenti per la registrazione' });
  }
});

// POST /api/documents/upload - Upload a document
router.post('/upload', authenticate, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const { type, registrationId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Validate document type
    if (!DOCUMENT_TYPES[type as keyof typeof DOCUMENT_TYPES]) {
      return res.status(400).json({ error: 'Tipo documento non valido' });
    }

    const docConfig = DOCUMENT_TYPES[type as keyof typeof DOCUMENT_TYPES];

    // Validate MIME type
    if (!docConfig.acceptedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: `Il file è di un formato non supportato. Formati accettati: ${docConfig.acceptedMimeTypes.join(', ')}`
      });
    }

    // Validate file size
    if (req.file.size > docConfig.maxFileSize) {
      return res.status(400).json({
        error: `File troppo grande. Dimensione massima: ${Math.round(docConfig.maxFileSize / (1024 * 1024))}MB`
      });
    }

    // Check if document of this type already exists for user (replace if exists)
    const existingDoc = await prisma.userDocument.findFirst({
      where: {
        userId: userId,
        type: type as DocumentType,
        registrationId: registrationId || null
      }
    });

    if (existingDoc) {
      // Delete old file from R2
      try {
        await storageManager.deleteFile(existingDoc.url);
      } catch (error) {
        console.error('Error deleting old file from R2:', error);
        // Continue with upload even if old file delete fails
      }

      // Upload new file to R2
      const uploadResult = await storageManager.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        type
      );

      // Update existing document record
      const updatedDocument = await prisma.userDocument.update({
        where: { id: existingDoc.id },
        data: {
          originalName: req.file.originalname,
          url: uploadResult.key, // Store R2 key
          size: req.file.size,
          mimeType: req.file.mimetype,
          status: 'PENDING',
          uploadSource: 'USER_DASHBOARD',
          uploadedBy: userId,
          uploadedByRole: 'USER',
          uploadedAt: new Date(),
          // Reset verification fields
          verifiedBy: null,
          verifiedAt: null,
          rejectionReason: null,
          rejectionDetails: null,
          partnerNotifiedAt: null,
          emailSentAt: null
        }
      });

      // Notify partner if document belongs to a registration
      if (registrationId) {
        await notifyPartnerNewDocument(userId, updatedDocument);
      }

      res.json({
        success: true,
        document: {
          id: updatedDocument.id,
          type: updatedDocument.type,
          fileName: updatedDocument.originalName,
          originalName: updatedDocument.originalName,
          mimeType: updatedDocument.mimeType,
          fileSize: updatedDocument.size,
          uploadedAt: updatedDocument.uploadedAt.toISOString(),
          status: updatedDocument.status
        },
        message: 'Documento aggiornato con successo'
      });
    } else {
      // Upload file to R2
      const uploadResult = await storageManager.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        type
      );

      // Create new document record
      const newDocument = await prisma.userDocument.create({
        data: {
          userId: userId,
          registrationId: registrationId || null,
          type: type as DocumentType,
          originalName: req.file.originalname,
          url: uploadResult.key, // Store R2 key
          size: req.file.size,
          mimeType: req.file.mimetype,
          status: 'PENDING',
          uploadSource: 'USER_DASHBOARD',
          uploadedBy: userId,
          uploadedByRole: 'USER',
          uploadedAt: new Date()
        }
      });

      // Notify partner if document belongs to a registration
      if (registrationId) {
        await notifyPartnerNewDocument(userId, newDocument);
      }

      res.json({
        success: true,
        document: {
          id: newDocument.id,
          type: newDocument.type,
          fileName: newDocument.originalName,
          originalName: newDocument.originalName,
          mimeType: newDocument.mimeType,
          fileSize: newDocument.size,
          uploadedAt: newDocument.uploadedAt.toISOString(),
          status: newDocument.status
        },
        message: 'Documento caricato con successo'
      });
    }

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento' });
  }
});

// GET /api/documents/:documentId/preview - Preview a document (redirect to R2)
router.get('/:documentId/preview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { documentId } = req.params;

    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId: userId
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Get signed URL from storage manager
    const downloadResult = await storageManager.getDownloadUrl(document.url);

    // Redirect to signed URL
    res.redirect(downloadResult.signedUrl);

  } catch (error) {
    console.error('Error previewing document:', error);
    res.status(500).json({ error: 'Errore nella visualizzazione del documento' });
  }
});

// GET /api/documents/:documentId/download - Download a document (redirect to R2)
router.get('/:documentId/download', authenticate, unifiedDownload, async (req: AuthRequest, res: Response) => {
  // This endpoint now uses UnifiedDownloadMiddleware for better security and performance
  // The middleware handles document access control and R2 signed URL generation
});

// DELETE /api/documents/:documentId - Delete a document
router.delete('/:documentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { documentId } = req.params;

    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId: userId,
        status: { not: 'APPROVED' } // Don't allow deleting approved documents
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato o non eliminabile' });
    }

    // Delete file from R2
    try {
      await storageManager.deleteFile(document.url);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      // Continue with database deletion even if R2 delete fails
    }

    // Delete database record
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    res.json({ success: true, message: 'Documento eliminato con successo' });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Errore nell\'eliminazione del documento' });
  }
});

// Utility function to notify partner of new document
async function notifyPartnerNewDocument(userId: string, document: any) {
  try {
    // Update partner notification timestamp
    await prisma.userDocument.update({
      where: { id: document.id },
      data: { partnerNotifiedAt: new Date() }
    });

    // TODO: Send real-time notification to partner
    console.log(`Partner notified of new document from user ${userId} for registration ${document.registrationId}`);
  } catch (error) {
    console.error('Error notifying partner:', error);
  }
}

export default router;