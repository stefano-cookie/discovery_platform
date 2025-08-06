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

  // Get user documents (repository)
  static async getUserDocuments(userId: string) {
    return prisma.userDocument.findMany({
      where: { 
        userId,
        registrationId: null // Only repository documents
      },
      include: {
        verifier: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  // Get enrollment documents (from registrations)
  static async getEnrollmentDocuments(userId: string) {
    return prisma.userDocument.findMany({
      where: { 
        userId,
        registrationId: { not: null } // Only enrollment documents
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

  // Upload document with unified system
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

  // Associate all user documents to a registration
  static async linkUserDocumentsToRegistration(userId: string, registrationId: string) {
    try {
      console.log(`🔗 Linking user documents to registration: ${userId} -> ${registrationId}`);
      
      // Find all documents for this user that don't have a registrationId
      const unlinkedDocs = await prisma.userDocument.findMany({
        where: {
          userId: userId,
          registrationId: null // Only unlinked documents
        }
      });

      if (unlinkedDocs.length === 0) {
        console.log('No unlinked documents found for user');
        return { linkedCount: 0 };
      }

      // Link all unlinked documents to the registration
      const updateResult = await prisma.userDocument.updateMany({
        where: {
          userId: userId,
          registrationId: null
        },
        data: {
          registrationId: registrationId
        }
      });

      console.log(`✅ Linked ${updateResult.count} documents to registration ${registrationId}`);
      
      // Log the linking action for audit
      for (const doc of unlinkedDocs) {
        await prisma.documentActionLog.create({
          data: {
            documentId: doc.id,
            action: 'LINK_TO_REGISTRATION',
            performedBy: userId,
            performedRole: UserRole.USER,
            details: {
              registrationId,
              previousRegistrationId: null
            }
          }
        });
      }

      return { linkedCount: updateResult.count, documents: unlinkedDocs };
    } catch (error) {
      console.error('Error linking documents to registration:', error);
      throw error;
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

  // Migrate enrollment documents to repository
  static async migrateEnrollmentDocuments(userId: string) {
    const enrollmentDocs = await prisma.userDocument.findMany({
      where: { 
        userId,
        registrationId: { not: null }
      }
    });

    const migrations = [];
    
    for (const doc of enrollmentDocs) {
      // Check if equivalent document already exists in repository
      const existingRepo = await prisma.userDocument.findFirst({
        where: { 
          userId,
          type: doc.type,
          registrationId: null
        }
      });

      if (!existingRepo) {
        // Copy to repository
        const repoDoc = await prisma.userDocument.create({
          data: {
            userId: doc.userId,
            type: doc.type,
            originalName: doc.originalName,
            url: doc.url,
            size: doc.size,
            mimeType: doc.mimeType,
            status: doc.status,
            uploadSource: doc.uploadSource || 'ENROLLMENT',
            uploadedBy: doc.uploadedBy || doc.userId,
            uploadedByRole: doc.uploadedByRole || 'USER',
            verifiedBy: doc.verifiedBy,
            verifiedAt: doc.verifiedAt,
            rejectionReason: doc.rejectionReason
          }
        });

        migrations.push({
          source: doc.id,
          target: repoDoc.id,
          type: doc.type
        });
      }
    }

    return migrations;
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

  // Sync documents between enrollment and user dashboard
  static async syncDocumentsForUser(userId: string) {
    const enrollmentDocs = await this.getEnrollmentDocuments(userId);
    const repositoryDocs = await this.getUserDocuments(userId);

    const syncResult = {
      enrollmentToRepository: 0,
      repositoryToEnrollment: 0,
      conflicts: []
    };

    // For each enrollment document, check if similar exists in repository
    for (const enrollDoc of enrollmentDocs) {
      const repoDoc = repositoryDocs.find(doc => doc.type === enrollDoc.type);
      
      if (!repoDoc) {
        // Copy enrollment document to repository
        await prisma.userDocument.create({
          data: {
            userId: enrollDoc.userId,
            type: enrollDoc.type,
            originalName: enrollDoc.originalName,
            url: enrollDoc.url,
            size: enrollDoc.size,
            mimeType: enrollDoc.mimeType,
            status: enrollDoc.status,
            uploadSource: UploadSource.ENROLLMENT,
            uploadedBy: enrollDoc.uploadedBy,
            uploadedByRole: enrollDoc.uploadedByRole,
            checksum: enrollDoc.checksum
          }
        });
        syncResult.enrollmentToRepository++;
      }
    }

    return syncResult;
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