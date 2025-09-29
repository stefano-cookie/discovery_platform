import { Router, Request, Response } from 'express';
import { PrismaClient, DocumentType, UploadSource, UserRole } from '@prisma/client';
import UnifiedDocumentManager, { upload } from '../services/unifiedDocumentManager';

const router = Router();
const prisma = new PrismaClient();

// POST /api/document-upload/temp - Upload document temporarily during enrollment (UNIFIED)
router.post('/temp', upload.single('document'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const { type, tempUserId } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Upload using unified storage manager
    const tempDocument = await UnifiedDocumentManager.uploadTemporary(
      req.file,
      type,
      tempUserId || 'anonymous'
    );

    res.json({
      success: true,
      document: tempDocument,
      message: `Documento caricato temporaneamente su ${UnifiedDocumentManager.getStorageInfo().type.toUpperCase()}. Sarà finalizzato al completamento dell'iscrizione.`,
      storageInfo: UnifiedDocumentManager.getStorageInfo()
    });

  } catch (error) {
    console.error('Unified temp document upload error:', error);
    res.status(500).json({
      error: 'Errore nel caricamento del documento',
      storageType: UnifiedDocumentManager.getStorageInfo().type
    });
  }
});

// POST /api/document-upload/finalize - Finalize documents after enrollment completion (UNIFIED)
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

    // Finalize documents using unified manager
    const finalizedDocuments = await UnifiedDocumentManager.finalizeDocuments(
      registrationId,
      userId,
      documents
    );

    res.json({
      success: true,
      documents: finalizedDocuments,
      message: `${finalizedDocuments.length} documenti salvati con successo`,
      storageInfo: UnifiedDocumentManager.getStorageInfo()
    });

  } catch (error) {
    console.error('Unified document finalization error:', error);
    res.status(500).json({
      error: 'Errore nella finalizzazione dei documenti',
      storageType: UnifiedDocumentManager.getStorageInfo().type
    });
  }
});

// GET /api/document-upload/storage-info - Get current storage configuration
router.get('/storage-info', (req: Request, res: Response) => {
  res.json({
    ...UnifiedDocumentManager.getStorageInfo(),
    description: {
      local: 'File salvati su disco locale per sviluppo',
      r2: 'File salvati su Cloudflare R2 per produzione'
    }
  });
});

export default router;