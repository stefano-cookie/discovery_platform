import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import storageManager from '../services/storageManager';

const router = Router();
const prisma = new PrismaClient();

// Simple auth middleware for diagnostics (use with caution in production)
const diagnosticAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.DIAGNOSTIC_TOKEN || 'change-me-in-production';

  if (authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GET /api/diagnostics/r2-status
router.get('/r2-status', diagnosticAuth, async (req, res) => {
  try {
    const storageType = storageManager.getStorageType();

    // Get sample documents from database
    const documents = await prisma.userDocument.findMany({
      take: 10,
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        type: true,
        url: true,
        originalName: true,
        uploadedAt: true,
        userId: true,
      },
    });

    const totalDocuments = await prisma.userDocument.count();

    // Check if files exist on storage
    const fileChecks = await Promise.all(
      documents.map(async (doc) => {
        try {
          const downloadUrl = await storageManager.getDownloadUrl(doc.url);
          return {
            documentId: doc.id,
            url: doc.url,
            exists: true,
            hasSignedUrl: !!downloadUrl.signedUrl,
          };
        } catch (error: any) {
          return {
            documentId: doc.id,
            url: doc.url,
            exists: false,
            error: error.message,
          };
        }
      })
    );

    const existsCount = fileChecks.filter(f => f.exists).length;
    const missingCount = fileChecks.filter(f => !f.exists).length;

    res.json({
      storageType,
      database: {
        totalDocuments,
        sampleSize: documents.length,
      },
      storage: {
        existsCount,
        missingCount,
        checks: fileChecks,
      },
      environment: {
        hasR2Config: !!(process.env.CLOUDFLARE_ACCESS_KEY_ID || process.env.R2_DOCUMENTS_ACCESS_KEY_ID),
        bucketName: process.env.CLOUDFLARE_BUCKET_NAME || process.env.R2_DOCUMENTS_BUCKET_NAME,
        accountId: (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_DOCUMENTS_ACCOUNT_ID)?.substring(0, 8) + '...',
      },
    });
  } catch (error: any) {
    console.error('❌ R2 diagnostics error:', error);
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// GET /api/diagnostics/document/:documentId
router.get('/document/:documentId', diagnosticAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found in database' });
    }

    let fileExists = false;
    let signedUrl = null;
    let errorMessage = null;

    try {
      const downloadResult = await storageManager.getDownloadUrl(document.url);
      fileExists = true;
      signedUrl = downloadResult.signedUrl?.substring(0, 100) + '...'; // Truncate for security
    } catch (error: any) {
      errorMessage = error.message;
    }

    res.json({
      document: {
        id: document.id,
        type: document.type,
        url: document.url,
        originalName: document.originalName,
        size: document.size,
        mimeType: document.mimeType,
        uploadedAt: document.uploadedAt,
        status: document.status,
        userId: document.userId,
        userEmail: document.user.email,
      },
      storage: {
        type: storageManager.getStorageType(),
        fileExists,
        hasSignedUrl: !!signedUrl,
        error: errorMessage,
      },
    });
  } catch (error: any) {
    console.error('❌ Document diagnostic error:', error);
    res.status(500).json({
      error: 'Diagnostic failed',
      message: error.message,
    });
  }
});

// GET /api/diagnostics/health
router.get('/health', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    const documentsCount = await prisma.userDocument.count();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        documentsCount,
      },
      storage: {
        type: storageManager.getStorageType(),
      },
      environment: process.env.NODE_ENV,
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

export default router;
