import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

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
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
      },
    });

    // Use different buckets for dev and production
    const isProduction = process.env.NODE_ENV === 'production';
    this.bucketName = isProduction ? 'discovery-documents-prod' : 'discovery-documents-dev';
    console.log(`[R2Storage] Initialized - Bucket: ${this.bucketName}`);
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
      console.error('R2 upload error:', error);
      throw new Error(`R2 upload failed: ${error}`);
    }
  }

  async getDownloadUrl(key: string): Promise<SignedUrlResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      // Extract filename from key
      const fileName = path.basename(key);

      return {
        signedUrl,
        fileName,
        mimeType: 'application/octet-stream', // Could be enhanced with metadata lookup
      };
    } catch (error) {
      console.error('R2 signed URL error:', error);
      throw new Error(`R2 signed URL failed: ${error}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('R2 delete error:', error);
      throw new Error(`R2 delete failed: ${error}`);
    }
  }

  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey,
      });

      await this.s3Client.send(command);
      console.log(`✅ R2 copy successful: ${sourceKey} -> ${destinationKey}`);
    } catch (error) {
      console.error('R2 copy error:', error);
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
    const hasR2Config = process.env.CLOUDFLARE_ACCESS_KEY_ID &&
                       process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

    // Always use R2 - no more LocalStorage
    if (hasR2Config) {
      console.log(`[StorageFactory] Using R2Storage - Env: ${process.env.NODE_ENV}`);
      return new R2StorageManager();
    } else {
      throw new Error('[StorageFactory] R2 configuration is required. Please set CLOUDFLARE_ACCESS_KEY_ID and CLOUDFLARE_SECRET_ACCESS_KEY in .env');
    }
  }
}

// Singleton instance
export const storageManager = StorageFactory.createStorage();
export default storageManager;