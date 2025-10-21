import { PrismaClient, DocumentStatus, DocumentType, UploadSource, UserRole } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { promisify } from 'util';
import emailService from './emailService';
import storageManager from './storageManager';

const prisma = new PrismaClient();
const unlink = promisify(fs.unlink);

// Configure multer for memory storage (files go directly to R2)
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
    // Check for existing document of the same type for this user/registration
    const existingDoc = await prisma.userDocument.findFirst({
      where: {
        userId,
        type,
        registrationId
      },
      orderBy: { uploadedAt: 'desc' }
    });

    // If existing document found, delete from R2 and database
    if (existingDoc) {
      console.log('🗑️ Found existing document, deleting old version:', {
        id: existingDoc.id,
        type: existingDoc.type,
        key: existingDoc.url
      });

      try {
        // Delete from R2
        await storageManager.deleteFile(existingDoc.url);
        console.log('✅ Old document deleted from R2:', existingDoc.url);
      } catch (deleteError) {
        console.warn('⚠️ Could not delete old document from R2 (may not exist):', deleteError);
        // Continue anyway - the old DB record will be deleted
      }

      // Delete from database
      await prisma.userDocument.delete({
        where: { id: existingDoc.id }
      });
      console.log('✅ Old document deleted from database');
    }

    // Generate checksum for integrity
    const checksum = crypto.createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // Upload to R2
    const uploadResult = await storageManager.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      userId,
      type
    );

    const document = await prisma.userDocument.create({
      data: {
        userId,
        registrationId,
        type,
        originalName: file.originalname,
        url: uploadResult.key, // Store R2 key instead of local path
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

  // Download document - returns signed URL for R2
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

    // Generate signed URL for secure download
    const downloadResult = await storageManager.getDownloadUrl(document.url);

    return {
      signedUrl: downloadResult.signedUrl,
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

    // Delete from R2
    try {
      await storageManager.deleteFile(document.url);
    } catch (error) {
      console.error('Error deleting file from R2:', error);
      // Continue with database deletion even if R2 delete fails
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

  // Partner: Check document (silenzioso, no email) - NUOVO WORKFLOW
  static async checkDocument(
    documentId: string,
    partnerEmployeeId: string
  ) {
    const document = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        partnerCheckedAt: new Date(),
        partnerCheckedBy: partnerEmployeeId,
        // Manteniamo lo status PENDING fino all'approvazione Discovery
        status: DocumentStatus.PENDING
      },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        registration: true
      }
    });

    // Log check action (no email sent)
    await prisma.documentActionLog.create({
      data: {
        documentId: document.id,
        action: 'CHECK',
        performedBy: partnerEmployeeId,
        performedRole: UserRole.PARTNER,
        details: {
          notes: 'Documento checkato da partner (no email)',
          previousStatus: 'PENDING'
        }
      }
    });

    return { document, emailSent: false };
  }

  // Discovery: Approve all documents for a registration (con email finale)
  static async discoveryApproveRegistration(
    registrationId: string,
    adminId: string,
    notes?: string
  ) {
    // Trova tutti i documenti della registrazione
    const documents = await prisma.userDocument.findMany({
      where: { registrationId },
      include: {
        user: {
          include: {
            profile: true
          }
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
      }
    });

    if (documents.length === 0) {
      throw new Error('Nessun documento trovato per questa iscrizione');
    }

    // Approva tutti i documenti
    await prisma.userDocument.updateMany({
      where: { registrationId },
      data: {
        status: DocumentStatus.APPROVED,
        discoveryApprovedAt: new Date(),
        discoveryApprovedBy: adminId
      }
    });

    // Log approvazione Discovery per ogni documento
    for (const doc of documents) {
      await prisma.documentActionLog.create({
        data: {
          documentId: doc.id,
          action: 'APPROVE',
          performedBy: adminId,
          performedRole: UserRole.ADMIN,
          details: {
            notes: notes || 'Iscrizione approvata da Discovery',
            previousStatus: doc.status
          }
        }
      });
    }

    // Aggiorna lo status della registrazione
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'ENROLLED'
      }
    });

    // Log azione admin Discovery
    await prisma.discoveryAdminLog.create({
      data: {
        adminId,
        action: 'DOCUMENT_APPROVAL',
        targetType: 'REGISTRATION',
        targetId: registrationId,
        reason: notes
      }
    });

    // Invia email finale di conferma all'utente
    try {
      const firstDoc = documents[0];
      const userName = firstDoc.user.profile ?
        `${firstDoc.user.profile.nome} ${firstDoc.user.profile.cognome}` :
        firstDoc.user.email;

      const courseName = firstDoc.registration?.offer?.course?.name || 'Corso';

      const emailSent = await emailService.sendRegistrationApprovedEmail(
        firstDoc.user.email,
        userName,
        courseName
      );

      return {
        registration: await prisma.registration.findUnique({ where: { id: registrationId } }),
        documentsApproved: documents.length,
        emailSent
      };
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      return {
        registration: await prisma.registration.findUnique({ where: { id: registrationId } }),
        documentsApproved: documents.length,
        emailSent: false
      };
    }
  }

  // Discovery: Reject registration with reason (con email)
  static async discoveryRejectRegistration(
    registrationId: string,
    adminId: string,
    reason: string
  ) {
    // Trova tutti i documenti della registrazione
    const documents = await prisma.userDocument.findMany({
      where: { registrationId },
      include: {
        user: {
          include: {
            profile: true
          }
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
      }
    });

    if (documents.length === 0) {
      throw new Error('Nessun documento trovato per questa iscrizione');
    }

    // Marca documenti come rifiutati da Discovery
    await prisma.userDocument.updateMany({
      where: { registrationId },
      data: {
        discoveryRejectedAt: new Date(),
        discoveryRejectionReason: reason
      }
    });

    // Log rifiuto Discovery per ogni documento
    for (const doc of documents) {
      await prisma.documentActionLog.create({
        data: {
          documentId: doc.id,
          action: 'REJECT',
          performedBy: adminId,
          performedRole: UserRole.ADMIN,
          details: {
            reason,
            previousStatus: doc.status
          }
        }
      });
    }

    // Torna status indietro a DOCUMENTS_UPLOADED per correzioni
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'DOCUMENTS_UPLOADED'
      }
    });

    // Log azione admin Discovery
    await prisma.discoveryAdminLog.create({
      data: {
        adminId,
        action: 'DOCUMENT_REJECTION',
        targetType: 'REGISTRATION',
        targetId: registrationId,
        reason
      }
    });

    // Invia email rifiuto all'utente
    try {
      const firstDoc = documents[0];
      const userName = firstDoc.user.profile ?
        `${firstDoc.user.profile.nome} ${firstDoc.user.profile.cognome}` :
        firstDoc.user.email;

      const courseName = firstDoc.registration?.offer?.course?.name || 'Corso';

      const emailSent = await emailService.sendRegistrationRejectedEmail(
        firstDoc.user.email,
        userName,
        courseName,
        reason
      );

      return {
        registration: await prisma.registration.findUnique({ where: { id: registrationId } }),
        emailSent
      };
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      return {
        registration: await prisma.registration.findUnique({ where: { id: registrationId } }),
        emailSent: false
      };
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
    console.log('🔄 DocumentService.finalizeEnrollmentDocuments called with:', {
      registrationId,
      userId,
      tempDocumentsCount: tempDocuments.length,
      tempDocuments
    });

    const finalizedDocuments = [];
    const baseUploadDir = path.join(process.cwd(), 'uploads');

    for (const tempDoc of tempDocuments) {
      try {
        console.log(`📁 Processing temp document:`, tempDoc);

        // Check if temp file still exists
        const tempFileExists = tempDoc.filePath ? fs.existsSync(tempDoc.filePath) : false;
        
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