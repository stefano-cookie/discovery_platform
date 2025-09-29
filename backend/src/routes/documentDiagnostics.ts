import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../middleware/auth';
import DocumentRecoveryService from '../services/documentRecoveryService';
import storageManager from '../services/storageManager';

const router = Router();
const prisma = new PrismaClient();

// GET /api/document-diagnostics/status - Basic system status (public for monitoring)
router.get('/status', async (req, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    const registrationCount = await prisma.registration.count();
    const documentCount = await prisma.userDocument.count();

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      storage: {
        type: storageManager.getStorageType(),
        bucket: process.env.CLOUDFLARE_BUCKET_NAME || 'local'
      },
      counts: {
        users: userCount,
        registrations: registrationCount,
        documents: documentCount
      }
    });

  } catch (error) {
    console.error('Document diagnostics status error:', error);
    res.status(500).json({ error: 'Service unavailable' });
  }
});

// GET /api/document-diagnostics/health - System health check (admin only)
router.get('/health', authenticateUnified, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
    }

    const healthCheck = await DocumentRecoveryService.systemHealthCheck();

    // Additional checks
    const userCount = await prisma.user.count();
    const registrationCount = await prisma.registration.count();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      storage: {
        type: healthCheck.storageType,
        environment: process.env.NODE_ENV,
        bucket: process.env.CLOUDFLARE_BUCKET_NAME || 'local'
      },
      database: {
        users: userCount,
        registrations: registrationCount,
        documents: healthCheck.totalDocuments,
        inconsistent: healthCheck.inconsistentDocuments
      },
      issues: healthCheck.issues
    });

  } catch (error) {
    console.error('Document diagnostics health check error:', error);
    res.status(500).json({ error: 'Errore nel controllo di sistema' });
  }
});

// GET /api/document-diagnostics/user/:userId - User-specific document analysis
router.get('/user/:userId', authenticateUnified, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user?.role === 'ADMIN';
    const isOwnUser = req.user?.id === userId;

    if (!isAdmin && !isOwnUser) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Get user documents from database
    const userDocuments = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        registration: {
          include: {
            offer: {
              include: {
                course: true
              }
            }
          }
        }
      }
    });

    // Check consistency for each document
    const documentAnalysis = await Promise.all(
      userDocuments.map(async (doc) => {
        const consistency = await DocumentRecoveryService.verifyDocumentConsistency(doc.id);
        return {
          ...doc,
          consistency: {
            inDatabase: consistency.inDatabase,
            inStorage: consistency.inStorage,
            consistent: consistency.consistent
          }
        };
      })
    );

    // Try to discover missing documents (if supported)
    const discovery = await DocumentRecoveryService.discoverMissingDocuments(userId);

    res.json({
      userId,
      analysis: {
        documentsInDatabase: userDocuments.length,
        documentsAnalyzed: documentAnalysis.length,
        consistentDocuments: documentAnalysis.filter(d => d.consistency.consistent).length,
        inconsistentDocuments: documentAnalysis.filter(d => !d.consistency.consistent).length
      },
      discovery: {
        foundOnR2: discovery.found,
        recovered: discovery.recovered,
        errors: discovery.errors
      },
      documents: documentAnalysis,
      storageInfo: {
        type: storageManager.getStorageType(),
        environment: process.env.NODE_ENV
      }
    });

  } catch (error) {
    console.error('Document diagnostics user analysis error:', error);
    res.status(500).json({ error: 'Errore nell\'analisi dei documenti utente' });
  }
});

// POST /api/document-diagnostics/user/:userId/recover - Try to recover missing documents
router.post('/user/:userId/recover', authenticateUnified, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Solo gli amministratori possono eseguire il recupero documenti' });
    }

    const recovery = await DocumentRecoveryService.discoverMissingDocuments(userId);

    res.json({
      userId,
      recovery: {
        attempted: true,
        found: recovery.found,
        recovered: recovery.recovered,
        errors: recovery.errors
      },
      message: recovery.found > 0
        ? `Trovati ${recovery.found} documenti, recuperati ${recovery.recovered}`
        : 'Nessun documento da recuperare trovato'
    });

  } catch (error) {
    console.error('Document recovery error:', error);
    res.status(500).json({ error: 'Errore nel recupero documenti' });
  }
});

// GET /api/document-diagnostics/document/:documentId/verify - Verify single document
router.get('/document/:documentId/verify', authenticateUnified, async (req: AuthRequest, res: Response) => {
  try {
    const { documentId } = req.params;

    const consistency = await DocumentRecoveryService.verifyDocumentConsistency(documentId);

    if (!consistency.document) {
      return res.status(404).json({ error: 'Documento non trovato nel database' });
    }

    // Check user permissions
    const isAdmin = req.user?.role === 'ADMIN';
    const isOwner = req.user?.id === consistency.document.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    res.json({
      documentId,
      consistency,
      document: consistency.document,
      recommendations: consistency.consistent
        ? ['Document is consistent']
        : consistency.inDatabase && !consistency.inStorage
          ? ['Document exists in database but file is missing from storage']
          : !consistency.inDatabase && consistency.inStorage
            ? ['Document file exists but database record is missing']
            : ['Document not found in database or storage']
    });

  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({ error: 'Errore nella verifica documento' });
  }
});

export default router;