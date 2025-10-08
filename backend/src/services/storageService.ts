import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { r2ClientFactory, R2Account } from './r2ClientFactory';

interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

class StorageService {
  constructor() {
    // Verify Documents account is configured
    if (!r2ClientFactory.isConfigured(R2Account.DOCUMENTS)) {
      throw new Error('[StorageService] Documents account not configured');
    }

    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);
    console.log(`[StorageService] Initialized using centralized R2 factory`);
    console.log(`[StorageService] Bucket: ${config.bucketName}`);
  }

  /**
   * Upload file buffer to R2
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    documentType: string
  ): Promise<UploadResult> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    // Generate unique key with folder structure
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileExtension = this.getFileExtension(originalName);

    const key = `documents/${userId}/${documentType}/${timestamp}-${randomId}${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName,
          userId,
          documentType,
          uploadedAt: new Date().toISOString(),
        },
      });

      await config.client.send(command);

      return {
        key,
        url: `https://${config.bucketName}.r2.cloudflarestorage.com/${key}`,
        size: buffer.length,
        mimeType,
      };
    } catch (error) {
      console.error('[StorageService] Upload error:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Get signed URL for secure download (valid for 1 hour)
   */
  async getSignedDownloadUrl(key: string): Promise<string> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(config.client, command, {
        expiresIn: 3600, // 1 hour
      });

      return signedUrl;
    } catch (error) {
      console.error('[StorageService] Signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    try {
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      await config.client.send(command);
    } catch (error) {
      console.error('[StorageService] Delete error:', error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot) : '';
  }

  /**
   * Extract R2 key from full URL
   */
  static extractKeyFromUrl(url: string): string {
    // Extract key from URLs like: https://bucket.r2.cloudflarestorage.com/documents/user/type/file.pdf
    const match = url.match(/\/([^\/]+\/[^\/]+\/[^\/]+\/[^\/]+)$/);
    return match ? match[1] : url;
  }
}

export const storageService = new StorageService();
export default storageService;