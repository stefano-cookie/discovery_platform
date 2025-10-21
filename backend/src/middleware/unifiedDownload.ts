import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import storageManager from '../services/storageManager';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Sanitize filename for Content-Disposition header (RFC 6266)
 * Removes non-ASCII characters and ensures valid header format
 */
function sanitizeFilename(filename: string): string {
  if (!filename) return 'download';

  // Remove or replace problematic characters
  return filename
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
    .replace(/["\\]/g, '') // Remove quotes and backslashes
    .trim() || 'download';
}

/**
 * Unified download middleware that handles both local files and R2 URLs
 */
class UnifiedDownloadMiddleware {
  /**
   * Send file using unified storage (local sendFile or R2 redirect)
   */
  static async sendFile(
    res: Response,
    storageKey: string,
    filename?: string,
    mimeType?: string
  ): Promise<void> {
    try {
      console.log('📦 UnifiedDownload sendFile:', { storageKey, filename, mimeType });

      const downloadResult = await storageManager.getDownloadUrl(storageKey);
      const storageType = storageManager.getStorageType();

      console.log('📦 Download result:', { storageType, hasSignedUrl: !!downloadResult.signedUrl });

      // Set headers with sanitized filename
      const safeFilename = sanitizeFilename(filename || downloadResult.fileName);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Type', mimeType || downloadResult.mimeType || 'application/octet-stream');

      if (storageType === 'local') {
        // Local: Use res.sendFile with absolute path
        console.log('📦 Sending local file');
        res.sendFile(path.resolve(downloadResult.signedUrl));
      } else {
        // R2: Fetch file and stream it (proxy to avoid CORS)
        console.log('📦 Proxying R2 file');
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(downloadResult.signedUrl);

        if (!response.ok) {
          throw new Error(`R2 fetch failed: ${response.status}`);
        }

        // Stream the response body to client
        response.body?.pipe(res);
      }

    } catch (error) {
      console.error(`❌ Unified download error (${storageManager.getStorageType()}):`, error);
      res.status(404).json({
        error: 'File non trovato',
        storageType: storageManager.getStorageType(),
        key: storageKey
      });
    }
  }

  /**
   * Stream file content for preview (useful for PDFs)
   */
  static async streamFile(
    res: Response,
    storageKey: string,
    filename?: string,
    mimeType?: string
  ): Promise<void> {
    try {
      console.log('🎬 UnifiedDownload streamFile:', { storageKey, filename, mimeType });

      const downloadResult = await storageManager.getDownloadUrl(storageKey);
      const storageType = storageManager.getStorageType();

      console.log('🎬 Stream result:', { storageType, hasSignedUrl: !!downloadResult.signedUrl });

      // Set headers for inline display with sanitized filename
      const safeFilename = sanitizeFilename(filename || downloadResult.fileName);
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
      res.setHeader('Content-Type', mimeType || downloadResult.mimeType || 'application/pdf');

      if (storageType === 'local') {
        // Local: Use res.sendFile
        console.log('🎬 Streaming local file');
        res.sendFile(path.resolve(downloadResult.signedUrl));
      } else {
        // R2: Fetch file and stream it (proxy to avoid CORS)
        console.log('🎬 Proxying R2 stream');
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(downloadResult.signedUrl);

        if (!response.ok) {
          throw new Error(`R2 fetch failed: ${response.status}`);
        }

        // Stream the response body to client
        response.body?.pipe(res);
      }

    } catch (error) {
      console.error(`❌ Unified stream error (${storageManager.getStorageType()}):`, error);
      res.status(404).json({
        error: 'File non trovato per preview',
        storageType: storageManager.getStorageType(),
        key: storageKey
      });
    }
  }

  /**
   * Check if file exists in storage
   */
  static async fileExists(storageKey: string): Promise<boolean> {
    try {
      await storageManager.getDownloadUrl(storageKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file info without downloading
   */
  static async getFileInfo(storageKey: string) {
    try {
      const downloadResult = await storageManager.getDownloadUrl(storageKey);
      return {
        exists: true,
        fileName: downloadResult.fileName,
        mimeType: downloadResult.mimeType,
        storageType: storageManager.getStorageType(),
        storageKey
      };
    } catch (error: any) {
      return {
        exists: false,
        error: error?.message || 'Unknown error',
        storageType: storageManager.getStorageType(),
        storageKey
      };
    }
  }
}

/**
 * Express middleware for unified document download
 * Handles document access control and secure download
 */
const unifiedDownload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { documentId } = req.params;

    // Find the document and verify access
    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId: userId // User can only download their own documents
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Use the unified download system
    await UnifiedDownloadMiddleware.sendFile(
      res,
      document.url,
      document.originalName,
      document.mimeType
    );

  } catch (error) {
    console.error('Error in unifiedDownload middleware:', error);
    res.status(500).json({ error: 'Errore nel download del documento' });
  }
};

export default unifiedDownload;
export { UnifiedDownloadMiddleware };