import { PrismaClient, DocumentType, UploadSource, UserRole, DocumentStatus } from '@prisma/client';
import multer from 'multer';
import crypto from 'crypto';
import storageManager from './storageManager';
import emailService from './emailService';

const prisma = new PrismaClient();

// Configure multer for memory storage (universal for both local and R2)
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Il file è di un formato non supportato. Usa PDF, JPG, JPEG o PNG.'));
    }
  }
});

export class UnifiedDocumentManager {
  // Upload document with unified storage
  static async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    type: DocumentType,
    registrationId?: string,
    uploadSource: UploadSource = UploadSource.USER_DASHBOARD,
    userRole: UserRole = UserRole.USER
  ) {
    // Generate checksum for integrity
    const checksum = crypto.createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Upload using unified storage manager
    const uploadResult = await storageManager.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
      type
    );

    // Store in database with unified schema
    const document = await prisma.userDocument.create({
      data: {
        userId,
        registrationId,
        type,
        originalName: file.originalname,
        url: uploadResult.key, // Always store the key (relative path or R2 key)
        size: file.size,
        mimeType: file.mimetype,
        status: DocumentStatus.PENDING,
        uploadSource,
        uploadedBy: userId,
        uploadedByRole: userRole,
        checksum
        // Note: storageType can be determined from storageManager.getStorageType()
        // Note: storageUrl (uploadResult.url) stored in url field
      }
    });

    console.log(`📁 Document uploaded via ${storageManager.getStorageType().toUpperCase()}: ${file.originalname} -> ${uploadResult.key}`);

    return document;
  }

  // Download document with unified storage
  static async downloadDocument(documentId: string, userId: string, isPartner: boolean = false) {
    const document = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        ...(isPartner ? {} : { userId }) // Partners can access any document
      }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    // Get download URL using unified storage manager
    const downloadResult = await storageManager.getDownloadUrl(document.url);

    return {
      ...downloadResult,
      document,
      // storageType tracked via storageManager.getStorageType()
    };
  }

  // Delete document with unified storage
  static async deleteDocument(documentId: string, userId: string, performedBy: string) {
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId, userId }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    try {
      // Delete from storage
      await storageManager.deleteFile(document.url);
    } catch (error) {
      console.error(`Error deleting from ${storageManager.getStorageType()}:`, error);
      // Continue with database deletion even if storage delete fails
    }

    // Delete from database
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    console.log(`🗑️ Document deleted from ${storageManager.getStorageType().toUpperCase()}: ${document.originalName}`);

    return { success: true };
  }

  // Temporary upload for enrollment (unified)
  static async uploadTemporary(
    file: Express.Multer.File,
    type: string,
    tempUserId: string
  ) {
    // Upload with temp prefix
    const uploadResult = await storageManager.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      tempUserId,
      `temp-${type}`
    );

    const tempDocument = {
      id: crypto.randomUUID(),
      type,
      fileName: file.originalname,
      originalFileName: file.originalname,
      storageKey: uploadResult.key, // Unified key field
      fileSize: file.size,
      mimeType: file.mimetype,
      tempUserId,
      uploadedAt: new Date().toISOString(),
      // storageType tracked via storageManager.getStorageType()
    };

    console.log(`📁 Temp document uploaded via ${storageManager.getStorageType().toUpperCase()}: ${file.originalname}`);

    return tempDocument;
  }

  // Finalize temporary documents (unified)
  static async finalizeDocuments(
    registrationId: string,
    userId: string,
    tempDocuments: any[]
  ) {
    const finalizedDocuments = [];

    for (const tempDoc of tempDocuments) {
      try {
        if (!tempDoc.storageKey) {
          console.warn(`Storage key not found for document: ${tempDoc.originalFileName}`);
          continue;
        }

        // Convert document type to enum format
        const documentType = this.convertToDocumentType(tempDoc.type);

        // Create UserDocument record with storage key
        const userDocument = await prisma.userDocument.create({
          data: {
            userId,
            registrationId,
            type: documentType,
            originalName: tempDoc.originalFileName,
            url: tempDoc.storageKey, // Use unified storage key
            size: tempDoc.fileSize,
            mimeType: tempDoc.mimeType,
            status: DocumentStatus.PENDING,
            uploadSource: UploadSource.ENROLLMENT,
            uploadedBy: userId,
            uploadedByRole: UserRole.USER
          }
        });

        finalizedDocuments.push(userDocument);

        console.log(`✅ Finalized document via ${storageManager.getStorageType().toUpperCase()}: ${tempDoc.originalFileName}`);

      } catch (docError) {
        console.error(`Error finalizing document ${tempDoc.originalFileName}:`, docError);
      }
    }

    return finalizedDocuments;
  }

  // Get storage info for debugging
  static getStorageInfo() {
    return {
      type: storageManager.getStorageType(),
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }

  // Helper function to convert camelCase to DocumentType enum
  private static convertToDocumentType(type: string): DocumentType {
    const typeMap: Record<string, DocumentType> = {
      'cartaIdentita': DocumentType.IDENTITY_CARD,
      'certificatoTriennale': DocumentType.BACHELOR_DEGREE,
      'certificatoMagistrale': DocumentType.MASTER_DEGREE,
      'pianoStudioTriennale': DocumentType.TRANSCRIPT,
      'pianoStudioMagistrale': DocumentType.TRANSCRIPT,
      'certificatoMedico': DocumentType.CV,
      'certificatoNascita': DocumentType.BIRTH_CERT,
      'diplomoLaurea': DocumentType.BACHELOR_DEGREE,
      'pergamenaLaurea': DocumentType.MASTER_DEGREE,
      'diplomaMaturita': DocumentType.DIPLOMA
    };

    return typeMap[type] || DocumentType.OTHER;
  }
}

export default UnifiedDocumentManager;