import { PrismaClient, DocumentStatus, DocumentType, UploadSource, UserRole } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';
import emailService from './emailService';

const prisma = new PrismaClient();
const unlink = promisify(fs.unlink);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

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

export class DocumentService {
  // Get all document types configuration
  static async getDocumentTypes() {
    return prisma.documentTypeConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  // Get user documents (repository) - DEPRECATED: now documents are tied to registrations
  static async getUserDocuments(userId: string) {
    // Return empty array as documents are now tied to specific registrations
    return [];
  }

  // Get enrollment documents (from registrations) - Use UnifiedDocumentService instead
  static async getEnrollmentDocuments(userId: string) {
    return prisma.userDocument.findMany({
      where: { 
        userId
      },
      include: {
        registration: {
          include: {
            offer: {
              include: {
                course: true
              }
            }
          }
        },
        verifier: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  // Upload document with unified system - registrationId is now required
  static async uploadDocument(
    userId: string, 
    file: Express.Multer.File, 
    type: DocumentType,
    registrationId: string,
    uploadSource: UploadSource = UploadSource.USER_DASHBOARD,
    userRole: UserRole = UserRole.USER
  ) {
    // Generate checksum for integrity
    const checksum = crypto.createHash('sha256')
      .update(fs.readFileSync(file.path))
      .digest('hex');

    const document = await prisma.userDocument.create({
      data: {
        userId,
        registrationId,
        type,
        originalName: file.originalname,
        url: file.path,
        size: file.size,
        mimeType: file.mimetype,
        status: DocumentStatus.PENDING,
        uploadSource,
        uploadedBy: userId,
        uploadedByRole: userRole,
        checksum
      }
    });

    // Auto-log the upload action
    await prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        action: 'UPLOAD',
        performedBy: userId,
        performedRole: userRole,
        details: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadSource
        }
      }
    });

    return document;
  }

  // Download document
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

    if (!fs.existsSync(document.url)) {
      throw new Error('File non trovato sul server');
    }

    return {
      filePath: document.url,
      fileName: document.originalName,
      mimeType: document.mimeType
    };
  }

  // Delete document
  static async deleteDocument(documentId: string, userId: string, performedBy: string) {
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId, userId }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    // Log the deletion
    await prisma.documentAuditLog.create({
      data: {
        documentId: document.id,
        action: 'DELETED',
        performedBy,
        previousStatus: document.status,
        notes: 'Document deleted by user'
      }
    });

    // Delete the file
    if (fs.existsSync(document.url)) {
      await unlink(document.url);
    }

    // Delete from database
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    return { success: true };
  }

  // Partner: Approve document
  static async approveDocument(
    documentId: string, 
    partnerId: string,
    notes?: string
  ) {
    const document = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.APPROVED,
        verifiedBy: partnerId,
        verifiedAt: new Date(),
        rejectionReason: null,
        rejectionDetails: null
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    // Log approval action
    await prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        action: 'APPROVE',
        performedBy: partnerId,
        performedRole: UserRole.PARTNER,
        details: {
          notes: notes || 'Documento approvato',
          previousStatus: 'PENDING'
        }
      }
    });

    // Send approval email notification
    try {
      const userName = document.user.profile ? 
        `${document.user.profile.nome} ${document.user.profile.cognome}` : 
        document.user.email;
      const emailSent = await emailService.sendDocumentApprovalEmail(
        document.user.email,
        userName,
        document.type
      );

      return { document, emailSent };
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      return { document, emailSent: false };
    }
  }

  // Partner: Reject document with email notification
  static async rejectDocument(
    documentId: string, 
    partnerId: string,
    reason: string,
    details?: string
  ) {
    const document = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.REJECTED,
        verifiedBy: partnerId,
        verifiedAt: new Date(),
        rejectionReason: reason,
        rejectionDetails: details,
        userNotifiedAt: new Date()
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    // Log rejection action
    await prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        action: 'REJECT',
        performedBy: partnerId,
        performedRole: UserRole.PARTNER,
        details: {
          reason,
          details: details || '',
          previousStatus: 'PENDING'
        }
      }
    });

    // Send rejection email notification
    try {
      const userName = document.user.profile ? 
        `${document.user.profile.nome} ${document.user.profile.cognome}` : 
        document.user.email;
      const emailSent = await emailService.sendDocumentRejectionEmail(
        document.user.email,
        userName,
        document.type,
        reason,
        details
      );
      
      await prisma.userDocument.update({
        where: { id: documentId },
        data: { emailSentAt: new Date() }
      });

      return { document, emailSent };
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      return { document, emailSent: false };
    }
  }

  // DEPRECATED: Associate all user documents to a registration (no longer needed)
  static async linkUserDocumentsToRegistration(userId: string, registrationId: string) {
    try {
      console.log(`🔗 DEPRECATED: linkUserDocumentsToRegistration called - no action taken`);
      // Return empty result as all documents are now created with registrationId
      return { linkedCount: 0 };
    } catch (error) {
      console.error('DEPRECATED: Error in linkUserDocumentsToRegistration:', error);
      return { linkedCount: 0 };
    }
  }

  // Partner: Get all documents for a registration
  static async getRegistrationDocuments(registrationId: string) {
    return prisma.userDocument.findMany({
      where: { registrationId },
      include: {
        user: {
          select: { id: true, email: true }
        },
        verifier: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  // Partner: Get user's all documents
  static async getAllUserDocuments(userId: string) {
    return prisma.userDocument.findMany({
      where: { userId },
      include: {
        registration: {
          include: {
            offer: {
              include: {
                course: true
              }
            }
          }
        },
        verifier: {
          select: { id: true, email: true }
        },
        auditLogs: {
          include: {
            performer: {
              select: { id: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  // Get document audit trail
  static async getDocumentAuditTrail(documentId: string) {
    return prisma.documentAuditLog.findMany({
      where: { documentId },
      include: {
        performer: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // DEPRECATED: Migrate enrollment documents to repository (no longer needed)
  static async migrateEnrollmentDocuments(userId: string) {
    console.log(`🔗 DEPRECATED: migrateEnrollmentDocuments called - no action taken`);
    // Return empty result as documents are now registration-specific
    return [];
  }

  // Finalize enrollment documents from temporary uploads
  static async finalizeEnrollmentDocuments(
    registrationId: string, 
    userId: string, 
    tempDocuments: any[], 
    tx: any
  ) {
    const finalizedDocuments = [];
    const baseUploadDir = path.join(process.cwd(), 'uploads');

    for (const tempDoc of tempDocuments) {
      try {
        // Check if temp file still exists
        const tempFileExists = fs.existsSync(tempDoc.filePath);
        
        if (!tempFileExists) {
          console.warn(`Temp file not found: ${tempDoc.filePath}`);
          continue;
        }

        // Create permanent directory structure
        const docTypeFolder = this.getDocumentTypeFolder(tempDoc.type);
        const permanentDir = path.join(baseUploadDir, 'documents', docTypeFolder);
        
        if (!fs.existsSync(permanentDir)) {
          fs.mkdirSync(permanentDir, { recursive: true });
        }

        // Generate permanent filename
        const extension = path.extname(tempDoc.originalFileName);
        const permanentFileName = `${registrationId}_${tempDoc.type}_${Date.now()}${extension}`;
        const permanentPath = path.join(permanentDir, permanentFileName);

        // Move file from temp to permanent location
        fs.renameSync(tempDoc.filePath, permanentPath);

        // Convert document type to enum format
        const documentType = this.convertToDocumentType(tempDoc.type);

        // Create UserDocument record
        const userDocument = await tx.userDocument.create({
          data: {
            userId: userId,
            registrationId: registrationId,
            type: documentType,
            originalName: tempDoc.originalFileName,
            url: permanentPath,
            size: tempDoc.fileSize,
            mimeType: tempDoc.mimeType,
            status: 'PENDING' as any,
            uploadSource: 'ENROLLMENT' as any,
            uploadedBy: userId,
            uploadedByRole: 'USER' as any,
            uploadedAt: new Date()
          }
        });

        finalizedDocuments.push(userDocument);

        console.log(`Finalized document: ${tempDoc.originalFileName} -> ${permanentFileName}`);

      } catch (docError) {
        console.error(`Error finalizing document ${tempDoc.originalFileName}:`, docError);
        // Continue processing other documents
      }
    }

    return finalizedDocuments;
  }

  // Notify partner about new document upload
  static async notifyPartnerNewDocument(documentId: string, partnerId: string) {
    const document = await prisma.userDocument.update({
      where: { id: documentId },
      data: { partnerNotifiedAt: new Date() }
    });

    // Log notification action
    await prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        action: 'NOTIFY_PARTNER',
        performedBy: document.uploadedBy,
        performedRole: UserRole.USER,
        details: {
          partnerId,
          notificationType: 'NEW_UPLOAD'
        }
      }
    });

    return { notified: true, timestamp: document.partnerNotifiedAt };
  }

  // Get pending documents for partner verification
  static async getPendingDocumentsForPartner(partnerId: string) {
    return prisma.userDocument.findMany({
      where: {
        status: DocumentStatus.PENDING,
        user: {
          assignedPartnerId: partnerId
        }
      },
      include: {
        user: {
          select: { id: true, email: true, profile: true }
        },
        registration: {
          include: {
            offer: {
              include: {
                course: true
              }
            }
          }
        }
      },
      orderBy: { uploadedAt: 'asc' } // Oldest first for processing priority
    });
  }

  // DEPRECATED: Sync documents between enrollment and user dashboard (no longer needed)
  static async syncDocumentsForUser(userId: string) {
    console.log(`🔗 DEPRECATED: syncDocumentsForUser called - no action taken`);
    // Return empty result as documents are now registration-specific
    return {
      enrollmentToRepository: 0,
      repositoryToEnrollment: 0,
      conflicts: []
    };
  }

  // Helper function to get document type folder
  private static getDocumentTypeFolder(type: string): string {
    const folders: Record<string, string> = {
      'cartaIdentita': 'carte-identita',
      'tessera_sanitaria': 'certificati-medici',
      'certificatoTriennale': 'lauree',
      'certificatoMagistrale': 'lauree',
      'pianoStudioTriennale': 'piani-studio',
      'pianoStudioMagistrale': 'piani-studio',
      'certificatoMedico': 'certificati-medici',
      'certificatoNascita': 'certificati-nascita',
      'diplomoLaurea': 'diplomi',
      'pergamenaLaurea': 'pergamene',
      'diplomaMaturita': 'diplomi-maturita'
    };
    
    return folders[type] || 'altri';
  }

  // Helper function to convert camelCase to DocumentType enum
  private static convertToDocumentType(type: string): DocumentType {
    const typeMap: Record<string, DocumentType> = {
      'cartaIdentita': DocumentType.IDENTITY_CARD,
      'certificatoTriennale': DocumentType.BACHELOR_DEGREE,
      'certificatoMagistrale': DocumentType.MASTER_DEGREE,
      'pianoStudioTriennale': DocumentType.TRANSCRIPT,
      'pianoStudioMagistrale': DocumentType.TRANSCRIPT,
      'certificatoMedico': DocumentType.MEDICAL_CERT,
      'certificatoNascita': DocumentType.BIRTH_CERT,
      'diplomoLaurea': DocumentType.BACHELOR_DEGREE,
      'pergamenaLaurea': DocumentType.MASTER_DEGREE,
      'diplomaMaturita': DocumentType.DIPLOMA
    };
    
    return typeMap[type] || DocumentType.OTHER;
  }
}