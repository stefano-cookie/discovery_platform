import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { r2ClientFactory, R2Account } from './r2ClientFactory';

// Unified storage interface
export interface StorageResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface SignedUrlResult {
  signedUrl: string;
  fileName: string;
  mimeType: string;
}

export interface IStorageManager {
  uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    documentType: string
  ): Promise<StorageResult>;

  getDownloadUrl(key: string): Promise<SignedUrlResult>;
  deleteFile(key: string): Promise<void>;
  copyFile(sourceKey: string, destinationKey: string): Promise<void>;
  getStorageType(): 'local' | 'r2';
}

// R2 Storage Implementation (Production)
class R2StorageManager implements IStorageManager {
  constructor() {
    // Verify Documents account is configured
    if (!r2ClientFactory.isConfigured(R2Account.DOCUMENTS)) {
      throw new Error('[R2StorageManager] Documents account not configured');
    }

    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);
    console.log(`[R2StorageManager] Initialized using centralized R2 factory`);
    console.log(`[R2StorageManager] Bucket: ${config.bucketName}`);
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    documentType: string
  ): Promise<StorageResult> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);
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
      console.error('[R2StorageManager] Upload error:', error);
      throw new Error(`R2 upload failed: ${error}`);
    }
  }

  async getDownloadUrl(key: string): Promise<SignedUrlResult> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(config.client, command, {
        expiresIn: 3600, // 1 hour
      });

      // Extract filename from key
      const fileName = path.basename(key);

      return {
        signedUrl,
        fileName,
        mimeType: 'application/octet-stream',
      };
    } catch (error) {
      console.error('[R2StorageManager] Signed URL error:', error);
      throw new Error(`R2 signed URL failed: ${error}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    try {
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      await config.client.send(command);
    } catch (error) {
      console.error('[R2StorageManager] Delete error:', error);
      throw new Error(`R2 delete failed: ${error}`);
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const config = r2ClientFactory.getClient(R2Account.DOCUMENTS);

    try {
      const command = new CopyObjectCommand({
        Bucket: config.bucketName,
        CopySource: `${config.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await config.client.send(command);
    } catch (error) {
      console.error('[R2StorageManager] Copy error:', error);
      throw new Error(`R2 copy failed: ${error}`);
    }
  }

  getStorageType(): 'r2' {
    return 'r2';
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot) : '';
  }
}

// Local File System Implementation (Development)
class LocalStorageManager implements IStorageManager {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), 'uploads');
    this.ensureDirectoryExists(this.baseDir);
    console.log(`[LocalStorage] Initialized - Base: ${this.baseDir}`);
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    documentType: string
  ): Promise<StorageResult> {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileExtension = this.getFileExtension(originalName);

    // Create folder structure similar to R2
    const relativePath = `documents/${userId}/${documentType}`;
    const fullDir = path.join(this.baseDir, relativePath);
    this.ensureDirectoryExists(fullDir);

    const fileName = `${timestamp}-${randomId}${fileExtension}`;
    const filePath = path.join(fullDir, fileName);
    const key = `${relativePath}/${fileName}`;

    try {
      // Write file to disk
      fs.writeFileSync(filePath, buffer);

      return {
        key, // Relative path as key
        url: filePath, // Full local path for res.sendFile()
        size: buffer.length,
        mimeType,
      };
    } catch (error) {
      console.error('Local upload error:', error);
      throw new Error(`Local upload failed: ${error}`);
    }
  }

  async getDownloadUrl(key: string): Promise<SignedUrlResult> {
    const filePath = path.join(this.baseDir, key);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    const fileName = path.basename(key);

    return {
      signedUrl: filePath, // For local, "signed URL" is just the file path
      fileName,
      mimeType: 'application/octet-stream',
    };
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Local delete error:', error);
      throw new Error(`Local delete failed: ${error}`);
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const sourcePath = path.join(this.baseDir, sourceKey);
    const destPath = path.join(this.baseDir, destinationKey);

    try {
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      this.ensureDirectoryExists(destDir);

      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Local copy successful: ${sourceKey} -> ${destinationKey}`);
    } catch (error) {
      console.error('Local copy error:', error);
      throw new Error(`Local copy failed: ${error}`);
    }
  }

  getStorageType(): 'local' {
    return 'local';
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot) : '';
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// Factory for creating appropriate storage manager
export class StorageFactory {
  static createStorage(): IStorageManager {
    // Check for CLOUDFLARE_* env vars (used for documents account)
    const hasR2Config = process.env.CLOUDFLARE_ACCESS_KEY_ID &&
                       process.env.CLOUDFLARE_SECRET_ACCESS_KEY &&
                       process.env.CLOUDFLARE_ACCOUNT_ID &&
                       process.env.CLOUDFLARE_ENDPOINT;

    // Always use R2 - no more LocalStorage
    if (hasR2Config) {
      console.log(`[StorageFactory] Using R2Storage - Env: ${process.env.NODE_ENV}`);
      return new R2StorageManager();
    } else {
      throw new Error('[StorageFactory] R2 configuration is required. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, and CLOUDFLARE_ENDPOINT in .env');
    }
  }
}

// Singleton instance
export const storageManager = StorageFactory.createStorage();
export default storageManager;