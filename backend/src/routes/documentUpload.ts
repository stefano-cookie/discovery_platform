import { Router, Request, Response } from 'express';
import { PrismaClient, DocumentType, UploadSource, UserRole } from '@prisma/client';
import multer from 'multer';
import { randomUUID } from 'crypto';
import storageManager from '../services/storageManager';

const router = Router();
const prisma = new PrismaClient();

// Multer configuration for memory storage (files go directly to R2)
const tempStorage = multer.memoryStorage();

const tempUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo di file non supportato. Usa PDF, JPG, JPEG o PNG.'));
    }
  }
});

// POST /api/document-upload/temp - Upload document temporarily during enrollment (now directly to R2)
router.post('/temp', tempUpload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const { type, tempUserId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Upload directly to R2 with temporary prefix
    const uploadResult = await storageManager.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      tempUserId || 'temp-enrollment',
      `temp-${type}`
    );

    // Return temp document info with R2 key
    const tempDocument = {
      id: randomUUID(),
      type,
      fileName: req.file.originalname,
      originalFileName: req.file.originalname,
      r2Key: uploadResult.key, // Store R2 key instead of file path
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      tempUserId: tempUserId || 'anonymous',
      uploadedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      document: tempDocument,
      message: 'Documento caricato temporaneamente su R2. Sarà finalizzato al completamento dell\'iscrizione.'
    });

  } catch (error) {
    console.error('Temp document upload error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento' });
  }
});

// POST /api/document-upload/finalize - Finalize documents after enrollment completion (R2 version)
router.post('/finalize', async (req: Request, res: Response) => {
  try {
    const { registrationId, userId, documents } = req.body;

    if (!registrationId || !userId || !documents || documents.length === 0) {
      return res.status(400).json({ error: 'Dati insufficienti per finalizzare i documenti' });
    }

    // Verify registration exists and belongs to user
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        userId: userId
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
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    const finalizedDocuments = [];

    for (const tempDoc of documents) {
      try {
        // Check if R2 key exists
        if (!tempDoc.r2Key) {
          console.warn(`R2 key not found for document: ${tempDoc.originalFileName}`);
          continue;
        }

        // Convert document type to enum format
        const documentType = convertToDocumentType(tempDoc.type);

        // Create UserDocument record with R2 key
        const userDocument = await prisma.userDocument.create({
          data: {
            userId: userId,
            registrationId: registrationId,
            type: documentType,
            originalName: tempDoc.originalFileName,
            url: tempDoc.r2Key, // Store R2 key
            size: tempDoc.fileSize,
            mimeType: tempDoc.mimeType,
            status: 'PENDING',
            uploadSource: UploadSource.ENROLLMENT,
            uploadedBy: userId,
            uploadedByRole: UserRole.USER,
            uploadedAt: new Date()
          }
        });

        finalizedDocuments.push(userDocument);

        console.log(`Finalized document: ${tempDoc.originalFileName} -> R2: ${tempDoc.r2Key}`);

      } catch (docError) {
        console.error(`Error finalizing document ${tempDoc.originalFileName}:`, docError);
        // Continue processing other documents
      }
    }

    res.json({
      success: true,
      documents: finalizedDocuments,
      message: `${finalizedDocuments.length} documenti salvati con successo su R2`
    });

  } catch (error) {
    console.error('Document finalization error:', error);
    res.status(500).json({ error: 'Errore nella finalizzazione dei documenti' });
  }
});


// Helper function to convert camelCase to DocumentType enum
function convertToDocumentType(type: string): DocumentType {
  const typeMap: Record<string, DocumentType> = {
    'cartaIdentita': DocumentType.IDENTITY_CARD,
    'certificatoTriennale': DocumentType.BACHELOR_DEGREE,
    'certificatoMagistrale': DocumentType.MASTER_DEGREE,
    'pianoStudioTriennale': DocumentType.TRANSCRIPT,
    'pianoStudioMagistrale': DocumentType.TRANSCRIPT,
    'certificatoMedico': DocumentType.CV,
    'certificatoNascita': DocumentType.BIRTH_CERT,
    'diplomoLaurea': DocumentType.BACHELOR_DEGREE,
    'pergamenaLaurea': DocumentType.MASTER_DEGREE,
    'diplomaMaturita': DocumentType.DIPLOMA
  };
  
  return typeMap[type] || DocumentType.OTHER;
}

export default router;