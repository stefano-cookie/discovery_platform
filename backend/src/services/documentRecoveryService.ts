import { PrismaClient, DocumentType, DocumentStatus, UploadSource, UserRole } from '@prisma/client';
import storageManager from './storageManager';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * DocumentRecoveryService - Recupera documenti "orfani" da R2 quando mancano nel database
 *
 * Scenario: Database resettato ma documenti esistenti su R2
 * Soluzione: Ricostruisce i record UserDocument dai file R2
 */
export class DocumentRecoveryService {

  /**
   * Cerca documenti per un utente che potrebbero esistere su R2 ma non nel DB
   */
  static async discoverMissingDocuments(userId: string): Promise<{
    found: number;
    recovered: number;
    errors: string[];
  }> {
    console.log(`🔍 [DocumentRecovery] Searching R2 for missing documents for user: ${userId}`);

    const results = {
      found: 0,
      recovered: 0,
      errors: [] as string[]
    };

    try {
      // Se siamo in modalità Local Storage, non possiamo fare discovery
      if (storageManager.getStorageType() === 'local') {
        console.log(`⚠️ [DocumentRecovery] Local storage mode - cannot discover R2 documents`);
        return results;
      }

      // Per ora, questo è un placeholder per la logica di discovery R2
      // In futuro potremmo implementare:
      // 1. Lista tutti i file con prefix "documents/{userId}/"
      // 2. Estrae metadata dal path del file
      // 3. Ricostruisce i record UserDocument

      console.log(`ℹ️ [DocumentRecovery] R2 discovery not yet implemented`);

    } catch (error) {
      console.error(`❌ [DocumentRecovery] Error during discovery:`, error);
      results.errors.push(`Discovery failed: ${error}`);
    }

    return results;
  }

  /**
   * Verifica se un documento esiste sia nel database che su R2
   */
  static async verifyDocumentConsistency(documentId: string): Promise<{
    inDatabase: boolean;
    inStorage: boolean;
    consistent: boolean;
    document?: any;
  }> {
    console.log(`🔍 [DocumentRecovery] Verifying consistency for document: ${documentId}`);

    const result = {
      inDatabase: false,
      inStorage: false,
      consistent: false,
      document: undefined as any
    };

    try {
      // Verifica database
      const dbDocument = await prisma.userDocument.findFirst({
        where: { id: documentId }
      });

      result.inDatabase = !!dbDocument;
      result.document = dbDocument;

      // Verifica storage (se abbiamo il documento)
      if (dbDocument) {
        try {
          const storageResult = await storageManager.getDownloadUrl(dbDocument.url);
          result.inStorage = !!storageResult;
        } catch (error) {
          console.log(`❌ [DocumentRecovery] Document ${documentId} not found in storage:`, error);
          result.inStorage = false;
        }
      }

      result.consistent = result.inDatabase && result.inStorage;

    } catch (error) {
      console.error(`❌ [DocumentRecovery] Error verifying consistency:`, error);
    }

    return result;
  }

  /**
   * Ricostruisce un record UserDocument da informazioni base
   */
  static async reconstructUserDocument(
    userId: string,
    documentId: string,
    documentType: DocumentType,
    originalName: string,
    storageKey: string,
    fileSize: number,
    mimeType: string,
    registrationId?: string
  ): Promise<any> {
    console.log(`🔧 [DocumentRecovery] Reconstructing document record: ${documentId}`);

    try {
      // Genera checksum dummy per consistenza
      const checksum = crypto.createHash('sha256')
        .update(`${documentId}-${userId}-${storageKey}`)
        .digest('hex');

      const document = await prisma.userDocument.create({
        data: {
          id: documentId,
          userId,
          registrationId: registrationId || null,
          type: documentType,
          originalName,
          url: storageKey,
          size: fileSize,
          mimeType,
          status: DocumentStatus.PENDING,
          uploadSource: UploadSource.USER_DASHBOARD, // Default assumption
          uploadedBy: userId,
          uploadedByRole: UserRole.USER,
          checksum,
          uploadedAt: new Date() // Best guess timestamp
        }
      });

      console.log(`✅ [DocumentRecovery] Document reconstructed: ${document.id}`);
      return document;

    } catch (error) {
      console.error(`❌ [DocumentRecovery] Failed to reconstruct document:`, error);
      throw error;
    }
  }

  /**
   * Health check per verificare la consistenza generale del sistema
   */
  static async systemHealthCheck(): Promise<{
    totalDocuments: number;
    inconsistentDocuments: number;
    storageType: string;
    issues: string[];
  }> {
    console.log(`🏥 [DocumentRecovery] Running system health check...`);

    const health = {
      totalDocuments: 0,
      inconsistentDocuments: 0,
      storageType: storageManager.getStorageType(),
      issues: [] as string[]
    };

    try {
      // Conta documenti totali
      health.totalDocuments = await prisma.userDocument.count();

      // Per ora, assume che tutti i documenti siano consistenti se esistono nel DB
      // In futuro potremmo aggiungere verifiche più approfondite

      console.log(`✅ [DocumentRecovery] Health check completed: ${health.totalDocuments} documents`);

    } catch (error) {
      console.error(`❌ [DocumentRecovery] Health check failed:`, error);
      health.issues.push(`Health check failed: ${error}`);
    }

    return health;
  }
}

export default DocumentRecoveryService;