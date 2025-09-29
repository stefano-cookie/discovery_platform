import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';
import storageManager from '../services/storageManager';
import path from 'path';

const prisma = new PrismaClient();

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
      const downloadResult = await storageManager.getDownloadUrl(storageKey);
      const storageType = storageManager.getStorageType();

      // Set headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename || downloadResult.fileName}"`);
      res.setHeader('Content-Type', mimeType || downloadResult.mimeType || 'application/octet-stream');

      if (storageType === 'local') {
        // Local: Use res.sendFile with absolute path
        res.sendFile(path.resolve(downloadResult.signedUrl));
      } else {
        // R2: Redirect to signed URL
        res.redirect(downloadResult.signedUrl);
      }

    } catch (error) {
      console.error(`Unified download error (${storageManager.getStorageType()}):`, error);
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
      const downloadResult = await storageManager.getDownloadUrl(storageKey);
      const storageType = storageManager.getStorageType();

      // Set headers for inline display
      res.setHeader('Content-Disposition', `inline; filename="${filename || downloadResult.fileName}"`);
      res.setHeader('Content-Type', mimeType || downloadResult.mimeType || 'application/pdf');

      if (storageType === 'local') {
        // Local: Use res.sendFile
        res.sendFile(path.resolve(downloadResult.signedUrl));
      } else {
        // R2: Redirect to signed URL
        res.redirect(downloadResult.signedUrl);
      }

    } catch (error) {
      console.error(`Unified stream error (${storageManager.getStorageType()}):`, error);
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