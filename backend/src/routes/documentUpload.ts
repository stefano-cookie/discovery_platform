import { Router, Request, Response } from 'express';
import { PrismaClient, DocumentType } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

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
ensureDirectoryExists(path.join(baseUploadDir, 'temp-enrollment'));

// Multer configuration for temporary enrollment document uploads
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(baseUploadDir, 'temp-enrollment');
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const fileId = randomUUID();
    const extension = path.extname(file.originalname);
    cb(null, `${fileId}${extension}`);
  }
});

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

// POST /api/document-upload/temp - Upload document temporarily during enrollment
router.post('/temp', tempUpload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const { type, tempUserId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Store temporary file info that will be linked to registration later
    const tempDocument = {
      id: randomUUID(),
      type,
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      tempUserId: tempUserId || 'anonymous', // For tracking during enrollment
      uploadedAt: new Date().toISOString()
    };

    // Store in session/temporary storage (in production, use Redis or similar)
    // For now, we'll return the temp document info to be stored client-side
    res.json({
      success: true,
      document: tempDocument,
      message: 'Documento caricato temporaneamente. Sarà salvato al completamento dell\'iscrizione.'
    });

  } catch (error) {
    console.error('Temp document upload error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento' });
  }
});

// POST /api/document-upload/finalize - Finalize documents after enrollment completion
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
        // Check if temp file still exists
        if (!fs.existsSync(tempDoc.filePath)) {
          console.warn(`Temp file not found: ${tempDoc.filePath}`);
          continue;
        }

        // Create permanent directory structure
        const docTypeFolder = getDocumentTypeFolder(tempDoc.type);
        const permanentDir = path.join(baseUploadDir, 'documents', docTypeFolder);
        ensureDirectoryExists(permanentDir);

        // Generate permanent filename
        const extension = path.extname(tempDoc.originalFileName);
        const permanentFileName = `${registration.id}_${tempDoc.type}_${Date.now()}${extension}`;
        const permanentPath = path.join(permanentDir, permanentFileName);

        // Move file from temp to permanent location
        fs.renameSync(tempDoc.filePath, permanentPath);

        // Convert document type to enum format
        const documentType = convertToDocumentType(tempDoc.type);

        // Create UserDocument record
        const userDocument = await prisma.userDocument.create({
          data: {
            userId: userId,
            registrationId: registrationId,
            type: documentType,
            originalName: tempDoc.originalFileName,
            url: permanentPath,
            size: tempDoc.fileSize,
            mimeType: tempDoc.mimeType,
            status: 'PENDING' as any,
            uploadSource: 'ENROLLMENT' as any,
            uploadedBy: userId,
            uploadedByRole: 'USER' as any,
            uploadedAt: new Date()
          }
        });

        finalizedDocuments.push(userDocument);

        console.log(`Finalized document: ${tempDoc.originalFileName} -> ${permanentFileName}`);

      } catch (docError) {
        console.error(`Error finalizing document ${tempDoc.originalFileName}:`, docError);
        // Continue processing other documents
      }
    }

    res.json({
      success: true,
      documents: finalizedDocuments,
      message: `${finalizedDocuments.length} documenti salvati con successo`
    });

  } catch (error) {
    console.error('Document finalization error:', error);
    res.status(500).json({ error: 'Errore nella finalizzazione dei documenti' });
  }
});

// Helper function to get document type folder
function getDocumentTypeFolder(type: string): string {
  const folders: Record<string, string> = {
    // Basic documents
    'cartaIdentita': 'carte-identita',
    'tessera_sanitaria': 'certificati-medici',
    
    // TFA specific documents
    'certificatoTriennale': 'lauree',
    'certificatoMagistrale': 'lauree',
    'pianoStudioTriennale': 'piani-studio',
    'pianoStudioMagistrale': 'piani-studio',
    'certificatoMedico': 'certificati-medici',
    'certificatoNascita': 'certificati-nascita',
    'diplomoLaurea': 'diplomi',
    'pergamenaLaurea': 'pergamene',
    'diplomaMaturita': 'diplomi-maturita'
  };
  
  return folders[type] || 'altri';
}

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