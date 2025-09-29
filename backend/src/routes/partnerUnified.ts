import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../middleware/auth';
import UnifiedDocumentManager from '../services/unifiedDocumentManager';
import unifiedDownload, { UnifiedDownloadMiddleware } from '../middleware/unifiedDownload';

const router = Router();
const prisma = new PrismaClient();

// GET /api/partners/users/:userId/documents/:documentId/download - Unified document download
router.get('/users/:userId/documents/:documentId/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId, documentId } = req.params;

    if (!partnerCompanyId) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    // Verify partner has access to this user
    const userRegistration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerCompanyId,
      }
    });

    if (!userRegistration) {
      return res.status(403).json({ error: 'Partner non autorizzato per questo utente' });
    }

    // Get document
    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Use unified download middleware
    await UnifiedDownloadMiddleware.sendFile(
      res,
      document.url, // This is the storage key (local path or R2 key)
      document.originalName,
      document.mimeType
    );

  } catch (error) {
    console.error('Partner unified document download error:', error);
    res.status(500).json({
      error: 'Errore nel download del documento',
      storageType: UnifiedDocumentManager.getStorageInfo().type
    });
  }
});

// GET /api/partners/users/:userId/documents/:documentId/preview - Unified document preview
router.get('/users/:userId/documents/:documentId/preview', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId, documentId } = req.params;

    if (!partnerCompanyId) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    // Verify partner has access to this user
    const userRegistration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerCompanyId,
      }
    });

    if (!userRegistration) {
      return res.status(403).json({ error: 'Partner non autorizzato per questo utente' });
    }

    // Get document
    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Use unified stream middleware for preview
    await UnifiedDownloadMiddleware.streamFile(
      res,
      document.url,
      document.originalName,
      document.mimeType
    );

  } catch (error) {
    console.error('Partner unified document preview error:', error);
    res.status(500).json({
      error: 'Errore nella visualizzazione del documento',
      storageType: UnifiedDocumentManager.getStorageInfo().type
    });
  }
});

// GET /api/partners/users/:userId/documents - List user documents with storage info
router.get('/users/:userId/documents', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;

    if (!partnerCompanyId) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    // Verify partner has access to this user
    const userRegistration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerCompanyId,
      }
    });

    if (!userRegistration) {
      return res.status(403).json({ error: 'Partner non autorizzato per questo utente' });
    }

    // Get user documents
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      }
    });

    // Add file existence check for each document
    const documentsWithStatus = await Promise.all(
      documents.map(async (doc) => {
        const fileInfo = await UnifiedDownloadMiddleware.getFileInfo(doc.url);
        return {
          ...doc,
          fileExists: fileInfo.exists,
          storageInfo: {
            type: UnifiedDocumentManager.getStorageInfo().type,
            key: doc.url
          }
        };
      })
    );

    res.json({
      documents: documentsWithStatus,
      storageInfo: UnifiedDocumentManager.getStorageInfo(),
      totalCount: documents.length
    });

  } catch (error) {
    console.error('Partner unified documents list error:', error);
    res.status(500).json({
      error: 'Errore nel recupero dei documenti',
      storageType: UnifiedDocumentManager.getStorageInfo().type
    });
  }
});

export default router;