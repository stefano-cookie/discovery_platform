import { Router, Request, Response } from 'express';
import { PrismaClient, DocumentType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import emailService from '../services/emailService';

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

// Multer configuration for user document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userUploadsDir = path.join(baseUploadDir, 'documents', 'user-uploads');
    cb(null, userUploadsDir);
  },
  filename: (req, file, cb) => {
    const fileId = randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${fileId}${extension}`);
  }
});

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
        OR: [
          { registrationId: registrationId }, // Documents specifically for this registration
          { 
            registrationId: null, // User dashboard uploads that can be used for any registration
            uploadSource: 'USER_DASHBOARD'
          }
        ]
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
      // Remove uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: `Il file è di un formato non supportato. Formati accettati: ${docConfig.acceptedMimeTypes.join(', ')}`
      });
    }

    // Validate file size
    if (req.file.size > docConfig.maxFileSize) {
      // Remove uploaded file
      fs.unlinkSync(req.file.path);
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
      // Delete old file if it exists
      if (fs.existsSync(existingDoc.url)) {
        fs.unlinkSync(existingDoc.url);
      }
      
      // Update existing document record
      const updatedDocument = await prisma.userDocument.update({
        where: { id: existingDoc.id },
        data: {
          originalName: req.file.originalname,
          url: req.file.path,
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
      // Create new document record
      const newDocument = await prisma.userDocument.create({
        data: {
          userId: userId,
          registrationId: registrationId || null,
          type: type as DocumentType,
          originalName: req.file.originalname,
          url: req.file.path,
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
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Errore nel caricamento del documento' });
  }
});

// GET /api/documents/:documentId/download - Download a document
router.get('/:documentId/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { documentId } = req.params;

    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId: userId // User can only download their own documents
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    if (!fs.existsSync(document.url)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    const fileName = document.originalName;
    const mimeType = document.mimeType;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(document.url);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Errore nel download del documento' });
  }
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

    // Delete file from filesystem
    if (fs.existsSync(document.url)) {
      fs.unlinkSync(document.url);
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