import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

interface ArchiveUploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Storage Service dedicato per l'archivio iscrizioni storiche
 * Gestisce 2 bucket separati:
 * - legacy-archive-docs: ZIP documenti iscrizione
 * - legacy-archive-contracts: PDF contratti
 */
class ArchiveStorageService {
  private s3Client: S3Client;
  private docsBucketName: string;
  private contractsBucketName: string;
  private docsPublicUrl: string;
  private contractsPublicUrl: string;

  constructor() {
    // Cloudflare R2 Archive configuration (shared credentials)
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ARCHIVE_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ARCHIVE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_ARCHIVE_SECRET_ACCESS_KEY!,
      },
    });

    // Bucket per ZIP documenti
    this.docsBucketName = process.env.R2_ARCHIVE_BUCKET_NAME || 'legacy-archive-docs';
    this.docsPublicUrl = process.env.R2_ARCHIVE_PUBLIC_URL || '';

    // Bucket per PDF contratti
    this.contractsBucketName = process.env.R2_ARCHIVE_CONTRACTS_BUCKET_NAME || 'legacy-archive-contracts';
    this.contractsPublicUrl = process.env.R2_ARCHIVE_CONTRACTS_PUBLIC_URL || '';

    console.log(`[ArchiveStorageService] Initialized`);
    console.log(`[ArchiveStorageService] Docs Bucket: ${this.docsBucketName}`);
    console.log(`[ArchiveStorageService] Contracts Bucket: ${this.contractsBucketName}`);
    console.log(`[ArchiveStorageService] Endpoint: ${process.env.R2_ARCHIVE_ENDPOINT}`);
    console.log(`[ArchiveStorageService] Has credentials: ${!!process.env.R2_ARCHIVE_ACCESS_KEY_ID}`);
  }

  /**
   * Upload ZIP archivio iscrizione
   */
  async uploadArchiveZip(
    buffer: Buffer,
    originalName: string,
    metadata: {
      registrationId: string;
      companyName: string;
      userName: string;
      originalYear: number;
    }
  ): Promise<ArchiveUploadResult> {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Struttura: archive-registrations/{year}/{companyName}/{timestamp}-{randomId}-{fileName}
    const key = `archive-registrations/${metadata.originalYear}/${this.sanitizePath(metadata.companyName)}/${timestamp}-${randomId}-${sanitizedFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.docsBucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/zip',
        Metadata: {
          originalName,
          registrationId: metadata.registrationId,
          companyName: metadata.companyName,
          userName: metadata.userName,
          originalYear: metadata.originalYear.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Genera URL pubblico se configurato, altrimenti usa endpoint
      const url = this.docsPublicUrl
        ? `${this.docsPublicUrl}/${key}`
        : `${process.env.R2_ARCHIVE_ENDPOINT}/${this.docsBucketName}/${key}`;

      return {
        key,
        url,
        size: buffer.length,
        mimeType: 'application/zip',
      };
    } catch (error) {
      console.error('[ArchiveStorageService] Error uploading ZIP to R2:', error);
      throw new Error(`Failed to upload archive ZIP: ${error}`);
    }
  }

  /**
   * Upload PDF contratto iscrizione archiviata
   */
  async uploadContractPdf(
    buffer: Buffer,
    originalName: string,
    metadata: {
      registrationId: string;
      companyName: string;
      userName: string;
      originalYear: number;
    }
  ): Promise<ArchiveUploadResult> {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Struttura: contracts/{year}/{companyName}/{timestamp}-{randomId}-{fileName}
    const key = `contracts/${metadata.originalYear}/${this.sanitizePath(metadata.companyName)}/${timestamp}-${randomId}-${sanitizedFileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.contractsBucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline', // Permette preview nel browser
        Metadata: {
          originalName,
          registrationId: metadata.registrationId,
          companyName: metadata.companyName,
          userName: metadata.userName,
          originalYear: metadata.originalYear.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Genera URL pubblico (necessario per preview PDF)
      const url = this.contractsPublicUrl
        ? `${this.contractsPublicUrl}/${key}`
        : `${process.env.R2_ARCHIVE_ENDPOINT}/${this.contractsBucketName}/${key}`;

      return {
        key,
        url,
        size: buffer.length,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      console.error('[ArchiveStorageService] Error uploading contract PDF to R2:', error);
      throw new Error(`Failed to upload contract PDF: ${error}`);
    }
  }

  /**
   * Get signed URL for secure download (valid for 1 hour)
   * @param key - File key
   * @param bucketType - 'docs' per ZIP documenti, 'contracts' per PDF contratti
   */
  async getSignedDownloadUrl(key: string, bucketType: 'docs' | 'contracts' = 'docs'): Promise<string> {
    try {
      const bucketName = bucketType === 'contracts' ? this.contractsBucketName : this.docsBucketName;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      return signedUrl;
    } catch (error) {
      console.error('[ArchiveStorageService] Error generating signed URL:', error);
      throw new Error(`Failed to generate download URL: ${error}`);
    }
  }

  /**
   * Get public URL for PDF preview (no expiration)
   * Usa il public URL del bucket contratti per visualizzare PDF nel browser
   */
  getContractPublicUrl(key: string): string {
    if (this.contractsPublicUrl) {
      return `${this.contractsPublicUrl}/${key}`;
    }
    // Fallback: usa signed URL
    return `${process.env.R2_ARCHIVE_ENDPOINT}/${this.contractsBucketName}/${key}`;
  }

  /**
   * Delete archive file from R2
   * @param key - File key
   * @param bucketType - 'docs' per ZIP documenti, 'contracts' per PDF contratti
   */
  async deleteFile(key: string, bucketType: 'docs' | 'contracts' = 'docs'): Promise<void> {
    try {
      const bucketName = bucketType === 'contracts' ? this.contractsBucketName : this.docsBucketName;

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`[ArchiveStorageService] Deleted file from ${bucketType}: ${key}`);
    } catch (error) {
      console.error('[ArchiveStorageService] Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Sanitize path component (rimuove caratteri non sicuri)
   */
  private sanitizePath(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Rimuovi accenti
      .replace(/[^a-zA-Z0-9-_]/g, '_')  // Solo alfanumerici, -, _
      .replace(/_+/g, '_')               // Unifica underscore multipli
      .toLowerCase();
  }

  /**
   * Extract key from full URL
   * @param url - URL completo del file
   * @param bucketType - Tipo di bucket per determinare quale public URL usare
   */
  extractKeyFromUrl(url: string, bucketType: 'docs' | 'contracts' = 'docs'): string | null {
    try {
      // Se è già una key (non contiene http), restituisci così com'è
      if (!url.startsWith('http')) {
        return url;
      }

      const publicUrl = bucketType === 'contracts' ? this.contractsPublicUrl : this.docsPublicUrl;
      const bucketName = bucketType === 'contracts' ? this.contractsBucketName : this.docsBucketName;

      // Estrai key da URL pubblico
      if (publicUrl && url.startsWith(publicUrl)) {
        return url.replace(`${publicUrl}/`, '');
      }

      // Estrai key da URL endpoint
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // Se path inizia con bucket name, rimuovilo
      if (pathParts[0] === bucketName) {
        pathParts.shift();
      }

      return pathParts.join('/');
    } catch (error) {
      console.error('[ArchiveStorageService] Error extracting key from URL:', error);
      return null;
    }
  }
}

// Export singleton instance
export const archiveStorageService = new ArchiveStorageService();
export default archiveStorageService;
