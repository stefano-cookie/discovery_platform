/**
 * R2 Cleanup Service
 *
 * Centralized service for cleaning up orphaned files from R2 buckets
 * when database records are deleted.
 *
 * CRITICAL: This service must be called BEFORE deleting database records
 * to prevent orphaned files in R2 storage.
 */

import { DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2ClientFactory, R2Account } from './r2ClientFactory';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Extract R2 file keys from URLs
 * Handles both full URLs and relative paths
 */
function extractFileKey(url: string): string | null {
  if (!url) return null;

  // If it's a full URL, extract the path after the domain
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch (e) {
      console.error('[R2Cleanup] Invalid URL:', url);
      return null;
    }
  }

  // If it's already a key (no domain), return as-is
  return url;
}

/**
 * Delete a single file from R2
 */
async function deleteFile(account: R2Account, fileKey: string): Promise<boolean> {
  try {
    if (!r2ClientFactory.isConfigured(account)) {
      console.warn(`[R2Cleanup] Account ${account} not configured - skipping delete`);
      return false;
    }

    const config = r2ClientFactory.getClient(account);
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: fileKey,
    });

    await config.client.send(deleteCommand);
    console.log(`[R2Cleanup] ✅ Deleted file: ${fileKey} from ${account}`);
    return true;
  } catch (error: any) {
    // If file not found, consider it successful (idempotent)
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.log(`[R2Cleanup] ⚠️ File not found (already deleted): ${fileKey}`);
      return true;
    }

    console.error(`[R2Cleanup] ❌ Failed to delete file: ${fileKey}`, error);
    return false;
  }
}

/**
 * Delete multiple files from R2 (batch operation)
 */
async function deleteFiles(account: R2Account, fileKeys: string[]): Promise<number> {
  if (fileKeys.length === 0) return 0;

  try {
    if (!r2ClientFactory.isConfigured(account)) {
      console.warn(`[R2Cleanup] Account ${account} not configured - skipping batch delete`);
      return 0;
    }

    const config = r2ClientFactory.getClient(account);

    // R2 supports batch delete (up to 1000 objects at once)
    const batchSize = 1000;
    let deletedCount = 0;

    for (let i = 0; i < fileKeys.length; i += batchSize) {
      const batch = fileKeys.slice(i, i + batchSize);

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: {
          Objects: batch.map(key => ({ Key: key })),
          Quiet: false, // Get detailed response
        },
      });

      const response = await config.client.send(deleteCommand);
      deletedCount += response.Deleted?.length || 0;

      if (response.Errors && response.Errors.length > 0) {
        console.error(`[R2Cleanup] Batch delete errors:`, response.Errors);
      }
    }

    console.log(`[R2Cleanup] ✅ Batch deleted ${deletedCount}/${fileKeys.length} files from ${account}`);
    return deletedCount;
  } catch (error) {
    console.error(`[R2Cleanup] ❌ Batch delete failed:`, error);
    return 0;
  }
}

/**
 * Clean up Notice attachments when deleting a notice
 */
export async function cleanupNoticeAttachments(noticeId: string): Promise<void> {
  try {
    console.log(`[R2Cleanup] Cleaning up attachments for Notice: ${noticeId}`);

    const notice = await prisma.notice.findUnique({
      where: { id: noticeId },
      select: { attachments: true }
    });

    if (!notice || !notice.attachments) {
      console.log(`[R2Cleanup] No attachments found for Notice: ${noticeId}`);
      return;
    }

    const attachments = notice.attachments as any[];
    if (!Array.isArray(attachments) || attachments.length === 0) {
      console.log(`[R2Cleanup] Empty attachments array for Notice: ${noticeId}`);
      return;
    }

    // Extract file keys from attachment URLs
    const fileKeys: string[] = [];
    for (const attachment of attachments) {
      const url = attachment.url || attachment.key;
      if (url) {
        const key = extractFileKey(url);
        if (key) fileKeys.push(key);
      }
    }

    if (fileKeys.length > 0) {
      await deleteFiles(R2Account.NOTICES, fileKeys);
    }
  } catch (error) {
    console.error('[R2Cleanup] Error cleaning up notice attachments:', error);
    // Don't throw - allow deletion to continue even if R2 cleanup fails
  }
}

/**
 * Clean up UserDocument files when deleting a document
 */
export async function cleanupUserDocument(documentId: string): Promise<void> {
  try {
    console.log(`[R2Cleanup] Cleaning up UserDocument: ${documentId}`);

    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      select: {
        url: true,
        originalName: true,
        uploadSource: true
      }
    });

    if (!document || !document.url) {
      console.log(`[R2Cleanup] No file URL found for UserDocument: ${documentId}`);
      return;
    }

    const fileKey = extractFileKey(document.url);
    if (fileKey) {
      await deleteFile(R2Account.DOCUMENTS, fileKey);
    }
  } catch (error) {
    console.error('[R2Cleanup] Error cleaning up user document:', error);
    // Don't throw - allow deletion to continue
  }
}

/**
 * Clean up ALL documents for a Registration when deleting
 */
export async function cleanupRegistrationDocuments(registrationId: string): Promise<void> {
  try {
    console.log(`[R2Cleanup] Cleaning up all documents for Registration: ${registrationId}`);

    const documents = await prisma.userDocument.findMany({
      where: { registrationId },
      select: { url: true }
    });

    if (documents.length === 0) {
      console.log(`[R2Cleanup] No documents found for Registration: ${registrationId}`);
      return;
    }

    const fileKeys: string[] = documents
      .map(doc => extractFileKey(doc.url))
      .filter(key => key !== null) as string[];

    if (fileKeys.length > 0) {
      await deleteFiles(R2Account.DOCUMENTS, fileKeys);
    }

    // Also cleanup contract files if present
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: {
        contractTemplateUrl: true,
        contractSignedUrl: true
      }
    });

    if (registration) {
      const contractKeys: string[] = [];
      if (registration.contractTemplateUrl) {
        const key = extractFileKey(registration.contractTemplateUrl);
        if (key) contractKeys.push(key);
      }
      if (registration.contractSignedUrl) {
        const key = extractFileKey(registration.contractSignedUrl);
        if (key) contractKeys.push(key);
      }

      if (contractKeys.length > 0) {
        await deleteFiles(R2Account.DOCUMENTS, contractKeys);
      }
    }
  } catch (error) {
    console.error('[R2Cleanup] Error cleaning up registration documents:', error);
    // Don't throw - allow deletion to continue
  }
}

/**
 * Clean up ALL documents for a User when deleting
 */
export async function cleanupUserDocuments(userId: string): Promise<void> {
  try {
    console.log(`[R2Cleanup] Cleaning up all documents for User: ${userId}`);

    const documents = await prisma.userDocument.findMany({
      where: { userId },
      select: { url: true }
    });

    if (documents.length === 0) {
      console.log(`[R2Cleanup] No documents found for User: ${userId}`);
      return;
    }

    const fileKeys: string[] = documents
      .map(doc => extractFileKey(doc.url))
      .filter(key => key !== null) as string[];

    if (fileKeys.length > 0) {
      await deleteFiles(R2Account.DOCUMENTS, fileKeys);
    }

    // Also cleanup all registration contracts for this user
    const registrations = await prisma.registration.findMany({
      where: { userId },
      select: {
        contractTemplateUrl: true,
        contractSignedUrl: true
      }
    });

    const contractKeys: string[] = [];
    for (const reg of registrations) {
      if (reg.contractTemplateUrl) {
        const key = extractFileKey(reg.contractTemplateUrl);
        if (key) contractKeys.push(key);
      }
      if (reg.contractSignedUrl) {
        const key = extractFileKey(reg.contractSignedUrl);
        if (key) contractKeys.push(key);
      }
    }

    if (contractKeys.length > 0) {
      await deleteFiles(R2Account.DOCUMENTS, contractKeys);
    }
  } catch (error) {
    console.error('[R2Cleanup] Error cleaning up user documents:', error);
    // Don't throw - allow deletion to continue
  }
}

/**
 * Clean up archive files when deleting an archive entry
 */
export async function cleanupArchiveFiles(archiveId: string): Promise<void> {
  try {
    console.log(`[R2Cleanup] Cleaning up archive files: ${archiveId}`);

    // This assumes Archive table has fileUrl or similar field
    const archive = await prisma.$queryRaw<any[]>`
      SELECT * FROM "Archive" WHERE id = ${archiveId}
    `.catch(() => []);

    if (archive.length === 0 || !archive[0]) {
      console.log(`[R2Cleanup] No archive found: ${archiveId}`);
      return;
    }

    const fileUrl = archive[0].fileUrl || archive[0].url;
    if (fileUrl) {
      const fileKey = extractFileKey(fileUrl);
      if (fileKey) {
        await deleteFile(R2Account.ARCHIVE, fileKey);
      }
    }
  } catch (error) {
    console.error('[R2Cleanup] Error cleaning up archive files:', error);
    // Don't throw - allow deletion to continue
  }
}

/**
 * Export all cleanup functions
 */
export const R2CleanupService = {
  cleanupNoticeAttachments,
  cleanupUserDocument,
  cleanupRegistrationDocuments,
  cleanupUserDocuments,
  cleanupArchiveFiles,
  deleteFile,
  deleteFiles,
};
