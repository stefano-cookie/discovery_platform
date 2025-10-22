import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { r2ClientFactory, R2Account } from './r2ClientFactory';

/**
 * Utility function to retry async operations with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        console.log(`[ArchiveStorage] ✅ ${operationName} succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries - 1;

      // Check if error is retryable
      const isRetryable =
        error.name === 'NetworkingError' ||
        error.name === 'TimeoutError' ||
        error.$metadata?.httpStatusCode === 503 ||
        error.$metadata?.httpStatusCode === 429 ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT';

      if (!isRetryable || isLastAttempt) {
        console.error(`[ArchiveStorage] ❌ ${operationName} failed:`, {
          attempt: attempt + 1,
          error: error.message,
          name: error.name,
          code: error.code,
          statusCode: error.$metadata?.httpStatusCode,
        });
        throw error;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`[ArchiveStorage] ⚠️  ${operationName} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, {
        error: error.message,
        name: error.name,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

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
 *
 * Usa il centralized R2ClientFactory per accedere all'account ARCHIVE
 */
class ArchiveStorageService {
  private docsBucketName: string;
  private contractsBucketName: string;
  private docsPublicUrl: string;
  private contractsPublicUrl: string;
  private isConfigured: boolean = false;

  constructor() {
    // Check if Archive account is configured
    if (!r2ClientFactory.isConfigured(R2Account.ARCHIVE)) {
      console.warn(`[ArchiveStorageService] ⚠️ Archive account not configured`);
      console.warn(`[ArchiveStorageService] Archive features will be disabled`);

      this.docsBucketName = 'legacy-archive-docs';
      this.contractsBucketName = 'legacy-archive-contracts';
      this.docsPublicUrl = '';
      this.contractsPublicUrl = '';
      this.isConfigured = false;
      return;
    }

    // Get configuration from centralized factory
    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);

    // Bucket per ZIP documenti
    this.docsBucketName = process.env.R2_ARCHIVE_BUCKET_NAME || 'legacy-archive-docs';
    this.docsPublicUrl = process.env.R2_ARCHIVE_PUBLIC_URL || '';

    // Bucket per PDF contratti
    this.contractsBucketName = process.env.R2_ARCHIVE_CONTRACTS_BUCKET_NAME || 'legacy-archive-contracts';
    this.contractsPublicUrl = process.env.R2_ARCHIVE_CONTRACTS_PUBLIC_URL || '';

    this.isConfigured = true;

    console.log(`[ArchiveStorageService] ✅ Initialized using centralized R2 factory`);
    console.log(`[ArchiveStorageService] Docs Bucket: ${this.docsBucketName}`);
    console.log(`[ArchiveStorageService] Contracts Bucket: ${this.contractsBucketName}`);
  }

  /**
   * Verifica se il service è configurato correttamente
   */
  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error(
        'Archive storage not configured. Please set R2_ARCHIVE_* environment variables.'
      );
    }
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
    this.ensureConfigured();

    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Struttura: archive-registrations/{year}/{companyName}/{timestamp}-{randomId}-{fileName}
    const key = `archive-registrations/${metadata.originalYear}/${this.sanitizePath(metadata.companyName)}/${timestamp}-${randomId}-${sanitizedFileName}`;

    console.log(`[ArchiveStorage] 📤 Starting ZIP upload:`, {
      originalName,
      key,
      size: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
      registrationId: metadata.registrationId,
      company: metadata.companyName,
    });

    const uploadOperation = async () => {
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

      return await config.client.send(command);
    };

    try {
      await retryWithBackoff(
        uploadOperation,
        `ZIP upload (${sanitizedFileName})`,
        3,
        1000
      );

      // Genera URL pubblico se configurato, altrimenti usa endpoint
      const url = this.docsPublicUrl
        ? `${this.docsPublicUrl}/${key}`
        : `${config.endpoint}/${this.docsBucketName}/${key}`;

      console.log(`[ArchiveStorage] ✅ ZIP upload successful:`, {
        key,
        url,
        size: buffer.length,
      });

      return {
        key,
        url,
        size: buffer.length,
        mimeType: 'application/zip',
      };
    } catch (error: any) {
      console.error('[ArchiveStorage] ❌ ZIP upload failed after all retries:', {
        message: error.message,
        bucket: this.docsBucketName,
        key,
        registrationId: metadata.registrationId,
      });
      throw new Error(`Failed to upload archive ZIP: ${error.message || error}`);
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
    this.ensureConfigured();

    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Struttura: contracts/{year}/{companyName}/{timestamp}-{randomId}-{fileName}
    const key = `contracts/${metadata.originalYear}/${this.sanitizePath(metadata.companyName)}/${timestamp}-${randomId}-${sanitizedFileName}`;

    console.log(`[ArchiveStorage] 📤 Starting PDF contract upload:`, {
      originalName,
      key,
      size: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
      registrationId: metadata.registrationId,
      company: metadata.companyName,
    });

    const uploadOperation = async () => {
      const command = new PutObjectCommand({
        Bucket: this.contractsBucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
        Metadata: {
          originalName,
          registrationId: metadata.registrationId,
          companyName: metadata.companyName,
          userName: metadata.userName,
          originalYear: metadata.originalYear.toString(),
          uploadedAt: new Date().toISOString(),
        },
      });

      return await config.client.send(command);
    };

    try {
      await retryWithBackoff(
        uploadOperation,
        `PDF contract upload (${sanitizedFileName})`,
        3,
        1000
      );

      // Genera URL pubblico (necessario per preview PDF)
      const url = this.contractsPublicUrl
        ? `${this.contractsPublicUrl}/${key}`
        : `${config.endpoint}/${this.contractsBucketName}/${key}`;

      console.log(`[ArchiveStorage] ✅ PDF contract upload successful:`, {
        key,
        url,
        size: buffer.length,
      });

      return {
        key,
        url,
        size: buffer.length,
        mimeType: 'application/pdf',
      };
    } catch (error: any) {
      console.error('[ArchiveStorage] ❌ PDF contract upload failed after all retries:', {
        message: error.message,
        bucket: this.contractsBucketName,
        key,
        registrationId: metadata.registrationId,
      });
      throw new Error(`Failed to upload contract PDF: ${error.message || error}`);
    }
  }

  /**
   * Get signed URL for secure download (valid for 1 hour)
   * @param key - File key
   * @param bucketType - 'docs' per ZIP documenti, 'contracts' per PDF contratti
   */
  async getSignedDownloadUrl(key: string, bucketType: 'docs' | 'contracts' = 'docs'): Promise<string> {
    this.ensureConfigured();

    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);
    const bucketName = bucketType === 'contracts' ? this.contractsBucketName : this.docsBucketName;

    console.log(`[ArchiveStorage] 🔗 Generating signed URL:`, {
      key,
      bucketType,
      bucket: bucketName,
    });

    const generateUrlOperation = async () => {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      return await getSignedUrl(config.client, command, {
        expiresIn: 3600,
      });
    };

    try {
      const signedUrl = await retryWithBackoff(
        generateUrlOperation,
        `Signed URL generation (${key})`,
        3,
        500
      );

      console.log(`[ArchiveStorage] ✅ Signed URL generated successfully for key: ${key}`);
      return signedUrl;
    } catch (error: any) {
      console.error('[ArchiveStorage] ❌ Signed URL generation failed:', {
        key,
        bucketType,
        error: error.message,
      });
      throw new Error(`Failed to generate download URL: ${error.message || error}`);
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
    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);
    return `${config.endpoint}/${this.contractsBucketName}/${key}`;
  }

  /**
   * Delete archive file from R2
   * @param key - File key
   * @param bucketType - 'docs' per ZIP documenti, 'contracts' per PDF contratti
   */
  async deleteFile(key: string, bucketType: 'docs' | 'contracts' = 'docs'): Promise<void> {
    this.ensureConfigured();

    const config = r2ClientFactory.getClient(R2Account.ARCHIVE);

    try {
      const bucketName = bucketType === 'contracts' ? this.contractsBucketName : this.docsBucketName;

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await config.client.send(command);
    } catch (error) {
      console.error('[ArchiveStorageService] Delete error:', error);
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
