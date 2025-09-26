import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // Cloudflare R2 configuration
    this.s3Client = new S3Client({
      region: 'auto', // Cloudflare R2 uses 'auto'
      endpoint: process.env.CLOUDFLARE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      },
    });

    // Environment-specific bucket names
    const env = process.env.NODE_ENV || 'development';
    const defaultBucket = env === 'production'
      ? 'discovery-documents-prod'
      : 'discovery-documents-dev';

    this.bucketName = process.env.CLOUDFLARE_BUCKET_NAME || defaultBucket;
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
    // Generate unique key with folder structure
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileExtension = this.getFileExtension(originalName);

    const key = `documents/${userId}/${documentType}/${timestamp}-${randomId}${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
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

      await this.s3Client.send(command);

      return {
        key,
        url: `https://${this.bucketName}.r2.cloudflarestorage.com/${key}`,
        size: buffer.length,
        mimeType,
      };
    } catch (error) {
      console.error('Error uploading to R2:', error);
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Get signed URL for secure download (valid for 1 hour)
   */
  async getSignedDownloadUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }

  /**
   * Delete file from R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting from R2:', error);
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