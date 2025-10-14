import { S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 Multi-Account Manager
 *
 * ACCOUNT 1 - Documents (stefanojpriolo@gmail.com)
 * Account ID: 96e7e20557789c11d012aca51dc21a27
 * Buckets: discovery-documents-dev, discovery-documents-prod
 * Purpose: User registration documents
 *
 * ACCOUNT 2 - Archive & Notices (noreply.discoveryplatform@gmail.com)
 * Account ID: 11eb49867970f932827c4503411e1816
 * Buckets: legacy-archive-contracts, legacy-archive-docs, notice-board-attachments
 * Purpose: Legacy archives and notice board
 */

export enum R2Account {
  DOCUMENTS = 'documents',
  ARCHIVE = 'archive',
  NOTICES = 'notices',
}

export interface R2ClientConfig {
  client: S3Client;
  bucketName: string;
  publicUrl?: string;
  endpoint: string;
  accountId: string;
}

class R2ClientFactory {
  private clients: Map<R2Account, R2ClientConfig> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // ACCOUNT 1 - Documents
    this.initializeDocumentsAccount();

    // ACCOUNT 2 - Archive
    this.initializeArchiveAccount();

    // ACCOUNT 2 - Notices (same credentials as Archive)
    this.initializeNoticesAccount();

    this.initialized = true;
  }

  /**
   * Initialize ACCOUNT 1 - Documents
   * Email: noreply.discoveryplatform@gmail.com
   */
  private initializeDocumentsAccount(): void {
    // Use CLOUDFLARE_* env vars as configured in production
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = process.env.CLOUDFLARE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
    const endpoint = process.env.CLOUDFLARE_ENDPOINT;

    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      console.error('[R2Factory] ❌ ACCOUNT 1 (Documents) not configured');
      console.error('[R2Factory] Missing env vars: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY, CLOUDFLARE_ENDPOINT');
      throw new Error('Documents R2 account not configured. Check environment variables.');
    }

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Environment-specific bucket - use exact names from .env
    const isProduction = process.env.NODE_ENV === 'production';
    const bucketName = isProduction ? 'discovery-documents-prod' : 'discovery-documents-dev';

    this.clients.set(R2Account.DOCUMENTS, {
      client,
      bucketName,
      endpoint,
      accountId,
    });

    console.log(`[R2Factory] ✅ ACCOUNT 1 (Documents) initialized`);
    console.log(`[R2Factory]    Account ID: ${accountId}`);
    console.log(`[R2Factory]    Bucket: ${bucketName}`);
    console.log(`[R2Factory]    Environment: ${process.env.NODE_ENV}`);
    console.log(`[R2Factory]    Endpoint: ${endpoint}`);
  }

  /**
   * Initialize ACCOUNT 2 - Archive
   * Email: noreply.discoveryplatform@gmail.com
   */
  private initializeArchiveAccount(): void {
    const accountId = process.env.R2_ARCHIVE_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ARCHIVE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_ARCHIVE_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ARCHIVE_ENDPOINT;

    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      console.warn('[R2Factory] ⚠️  ACCOUNT 2 (Archive) not configured - archive features disabled');
      return;
    }

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Archive uses two buckets but we'll manage them separately
    const bucketName = process.env.R2_ARCHIVE_BUCKET_NAME || 'legacy-archive-docs';
    const publicUrl = process.env.R2_ARCHIVE_PUBLIC_URL || '';

    this.clients.set(R2Account.ARCHIVE, {
      client,
      bucketName,
      publicUrl,
      endpoint,
      accountId,
    });

    console.log(`[R2Factory] ✅ ACCOUNT 2 (Archive) initialized`);
    console.log(`[R2Factory]    Account ID: ${accountId}`);
    console.log(`[R2Factory]    Bucket: ${bucketName}`);
  }

  /**
   * Initialize ACCOUNT 2 - Notices (same credentials as Archive)
   * Email: noreply.discoveryplatform@gmail.com
   */
  private initializeNoticesAccount(): void {
    const accountId = process.env.R2_NOTICES_ACCOUNT_ID;
    const accessKeyId = process.env.R2_NOTICES_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_NOTICES_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_NOTICES_ENDPOINT;

    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      console.warn('[R2Factory] ⚠️  ACCOUNT 2 (Notices) not configured - notice attachments disabled');
      return;
    }

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const bucketName = process.env.R2_NOTICES_BUCKET_NAME || 'notice-board-attachments';
    const publicUrl = process.env.R2_NOTICES_PUBLIC_URL || '';

    this.clients.set(R2Account.NOTICES, {
      client,
      bucketName,
      publicUrl,
      endpoint,
      accountId,
    });

    console.log(`[R2Factory] ✅ ACCOUNT 2 (Notices) initialized`);
    console.log(`[R2Factory]    Account ID: ${accountId}`);
    console.log(`[R2Factory]    Bucket: ${bucketName}`);
  }

  /**
   * Get R2 client configuration for specific account
   */
  getClient(account: R2Account): R2ClientConfig {
    const config = this.clients.get(account);

    if (!config) {
      throw new Error(`R2 account "${account}" not configured or initialized`);
    }

    return config;
  }

  /**
   * Check if an account is configured
   */
  isConfigured(account: R2Account): boolean {
    return this.clients.has(account);
  }

  /**
   * Get all configured accounts
   */
  getConfiguredAccounts(): R2Account[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get account info for debugging
   */
  getAccountInfo(): Record<string, any> {
    const info: Record<string, any> = {};

    this.clients.forEach((config, account) => {
      info[account] = {
        accountId: config.accountId,
        bucket: config.bucketName,
        endpoint: config.endpoint,
        hasPublicUrl: !!config.publicUrl,
      };
    });

    return info;
  }
}

// Singleton instance
export const r2ClientFactory = new R2ClientFactory();
export default r2ClientFactory;
