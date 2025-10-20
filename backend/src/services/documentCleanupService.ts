import { PrismaClient } from '@prisma/client';
import storageManager from './storageManager';

const prisma = new PrismaClient();

/**
 * Service for cleaning up documents from both database and R2 storage
 * Ensures files are deleted from R2 when database records are removed
 */
export class DocumentCleanupService {
  /**
   * Extract R2 key from URL or return key as-is
   * Handles both formats:
   * - Full URL: https://bucket-name.r2.cloudflarestorage.com/documents/...
   * - Key only: documents/...
   */
  private static extractR2Key(urlOrKey: string): string {
    if (!urlOrKey) return '';

    // If it's a full URL, extract the key part
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
      try {
        const url = new URL(urlOrKey);
        // Remove leading slash if present
        return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      } catch (error) {
        console.warn(`⚠️  Invalid URL format: ${urlOrKey}, using as-is`);
        return urlOrKey;
      }
    }

    // Already a key
    return urlOrKey;
  }

  /**
   * Delete a single document (database + R2)
   */
  static async deleteDocument(documentId: string): Promise<void> {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      select: { id: true, url: true, originalName: true }
    });

    if (!document) {
      console.warn(`⚠️  Document ${documentId} not found in database`);
      return;
    }

    // Delete from R2 first
    try {
      if (document.url) {
        const key = this.extractR2Key(document.url);
        await storageManager.deleteFile(key);
        console.log(`🗑️  Deleted from R2: ${key} (from: ${document.url})`);
      }
    } catch (error: any) {
      console.error(`❌ Error deleting from R2 (continuing with DB delete):`, error.message);
      // Continue with database deletion even if R2 delete fails
    }

    // Delete from database
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    console.log(`✅ Document deleted: ${document.originalName}`);
  }

  /**
   * Delete multiple documents by IDs (database + R2)
   */
  static async deleteDocuments(documentIds: string[]): Promise<number> {
    let deletedCount = 0;

    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId);
        deletedCount++;
      } catch (error: any) {
        console.error(`❌ Error deleting document ${documentId}:`, error.message);
      }
    }

    console.log(`🗑️  Batch delete complete: ${deletedCount}/${documentIds.length} documents deleted`);
    return deletedCount;
  }

  /**
   * Delete all documents for a specific user (database + R2)
   */
  static async deleteUserDocuments(userId: string): Promise<number> {
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      select: { id: true }
    });

    if (documents.length === 0) {
      console.log(`📭 No documents found for user ${userId}`);
      return 0;
    }

    console.log(`🗑️  Deleting ${documents.length} documents for user ${userId}...`);
    const documentIds = documents.map(doc => doc.id);
    return await this.deleteDocuments(documentIds);
  }

  /**
   * Delete all documents for a specific registration (database + R2)
   */
  static async deleteRegistrationDocuments(registrationId: string): Promise<number> {
    const documents = await prisma.userDocument.findMany({
      where: { registrationId },
      select: { id: true }
    });

    if (documents.length === 0) {
      console.log(`📭 No documents found for registration ${registrationId}`);
      return 0;
    }

    console.log(`🗑️  Deleting ${documents.length} documents for registration ${registrationId}...`);
    const documentIds = documents.map(doc => doc.id);
    return await this.deleteDocuments(documentIds);
  }

  /**
   * Delete all documents for multiple registrations (database + R2)
   */
  static async deleteRegistrationsDocuments(registrationIds: string[]): Promise<number> {
    const documents = await prisma.userDocument.findMany({
      where: { registrationId: { in: registrationIds } },
      select: { id: true }
    });

    if (documents.length === 0) {
      console.log(`📭 No documents found for ${registrationIds.length} registrations`);
      return 0;
    }

    console.log(`🗑️  Deleting ${documents.length} documents for ${registrationIds.length} registrations...`);
    const documentIds = documents.map(doc => doc.id);
    return await this.deleteDocuments(documentIds);
  }

  /**
   * Find and delete orphaned files on R2 (files without database record)
   */
  static async cleanupOrphanedFiles(dryRun: boolean = true): Promise<{
    checked: number;
    orphaned: string[];
    deleted: number;
  }> {
    console.log(`🔍 Starting orphaned files cleanup (dry-run: ${dryRun})...`);

    // This would require listing all R2 files and checking against database
    // For now, we return a placeholder - implement when needed
    console.warn('⚠️  cleanupOrphanedFiles not yet implemented - use manual cleanup script');

    return {
      checked: 0,
      orphaned: [],
      deleted: 0
    };
  }
}

export default DocumentCleanupService;
