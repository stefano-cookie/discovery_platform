import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

    this.bucketName = process.env.CLOUDFLARE_BUCKET_NAME || 'discovery-documents-prod';
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
    const isProduction = process.env.NODE_ENV === 'production';
    const hasR2Config = process.env.CLOUDFLARE_ACCESS_KEY_ID &&
                       process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const forceLocal = process.env.FORCE_LOCAL_STORAGE === 'true';

    // Force local storage if explicitly requested
    if (forceLocal) {
      console.log(`[StorageFactory] FORCING LocalStorage (FORCE_LOCAL_STORAGE=true)`);
      return new LocalStorageManager();
    }

    if (isProduction && hasR2Config) {
      console.log(`[StorageFactory] Using R2Storage for production`);
      return new R2StorageManager();
    } else {
      console.log(`[StorageFactory] Using LocalStorage - Env: ${process.env.NODE_ENV}, R2 Config: ${!!hasR2Config}`);
      return new LocalStorageManager();
    }
  }
}

// Singleton instance
export const storageManager = StorageFactory.createStorage();
export default storageManager;