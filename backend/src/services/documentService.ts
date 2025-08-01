import { PrismaClient, DocumentStatus, DocumentType } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

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

  // Upload document to user repository
  static async uploadDocument(
    userId: string, 
    file: Express.Multer.File, 
    type: DocumentType,
    registrationId?: string
  ) {
    const document = await prisma.userDocument.create({
      data: {
        userId,
        registrationId,
        type,
        fileName: file.filename,
        originalFileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: DocumentStatus.PENDING
      }
    });

    // Auto-log the upload action
    await prisma.documentAuditLog.create({
      data: {
        documentId: document.id,
        action: 'UPLOADED',
        performedBy: userId,
        newStatus: DocumentStatus.PENDING,
        notes: `Document uploaded: ${file.originalname}`
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

    if (!fs.existsSync(document.filePath)) {
      throw new Error('File non trovato sul server');
    }

    return {
      filePath: document.filePath,
      fileName: document.originalFileName,
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
    if (fs.existsSync(document.filePath)) {
      await unlink(document.filePath);
    }

    // Delete from database
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    return { success: true };
  }

  // Partner: Verify/Reject document
  static async verifyDocument(
    documentId: string, 
    status: DocumentStatus, 
    partnerId: string,
    rejectionReason?: string
  ) {
    const document = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status,
        verifiedBy: partnerId,
        verifiedAt: new Date(),
        rejectionReason: status === DocumentStatus.REJECTED ? rejectionReason : null
      }
    });

    // Auto-log the verification action (handled by trigger)
    return document;
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
            fileName: doc.fileName,
            originalFileName: doc.originalFileName,
            filePath: doc.filePath,
            fileSize: doc.fileSize,
            mimeType: doc.mimeType,
            status: doc.status,
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
}