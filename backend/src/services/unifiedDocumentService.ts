import { PrismaClient, DocumentType, DocumentStatus, UploadSource, UserRole } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import emailService from './emailService';

const prisma = new PrismaClient();

export class UnifiedDocumentService {
  // Get all documents for a registration (from all sources)
  static async getRegistrationDocuments(registrationId: string) {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { user: true }
    });

    if (!registration) {
      throw new Error('Registrazione non trovata');
    }

    // Get all documents related to this specific registration only
    const documents = await prisma.userDocument.findMany({
      where: {
        registrationId: registrationId
      },
      include: {
        verifier: {
          select: { id: true, email: true }
        },
        uploader: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return documents;
  }

  // Get all documents for a user (across all registrations)
  static async getAllUserDocuments(userId: string) {
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      include: {
        registration: {
          select: { id: true, status: true, offerType: true }
        },
        verifier: {
          select: { id: true, email: true }
        },
        uploader: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return documents;
  }

  // Upload document (handles all sources) - registrationId is now required
  static async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    type: DocumentType,
    uploadSource: UploadSource,
    uploadedBy: string,
    uploadedByRole: UserRole,
    registrationId: string
  ) {
    try {
      // Check for existing document of same type for this specific registration
      const existingDoc = await prisma.userDocument.findFirst({
        where: {
          userId,
          type,
          registrationId: registrationId!
        }
      });

      // If exists, delete old file
      if (existingDoc && fs.existsSync(existingDoc.url)) {
        fs.unlinkSync(existingDoc.url);
      }

      // Calculate file checksum
      const fileBuffer = fs.readFileSync(file.path);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const documentData = {
        userId,
        type,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: file.path,
        checksum,
        status: 'PENDING' as DocumentStatus,
        uploadSource,
        uploadedBy,
        uploadedByRole,
        registrationId: registrationId!,
        uploadedAt: new Date()
      };

      let document;
      if (existingDoc) {
        // Update existing document
        document = await prisma.userDocument.update({
          where: { id: existingDoc.id },
          data: {
            ...documentData,
            // Reset verification fields
            verifiedBy: null,
            verifiedAt: null,
            rejectionReason: null,
            rejectionDetails: null,
            partnerNotifiedAt: null,
            emailSentAt: null
          }
        });
      } else {
        // Create new document
        document = await prisma.userDocument.create({
          data: documentData
        });
      }

      // Log action
      await prisma.documentActionLog.create({
        data: {
          documentId: document.id,
          action: existingDoc ? 'REPLACE' : 'UPLOAD',
          performedBy: uploadedBy,
          performedRole: uploadedByRole,
          details: { source: uploadSource, registrationId }
        }
      });

      // Notify partner if applicable
      if (registrationId && uploadedByRole === 'USER') {
        await this.notifyPartnerNewDocument(document.id);
      }

      return document;
    } catch (error) {
      // Clean up file on error
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  // Approve document
  static async approveDocument(documentId: string, verifierId: string, notes?: string) {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: { user: true }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    if (document.status === 'APPROVED') {
      return { document, emailSent: false };
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        rejectionReason: null,
        rejectionDetails: null,
        userNotifiedAt: new Date()
      }
    });

    // Log action
    await prisma.documentActionLog.create({
      data: {
        documentId,
        action: 'APPROVE',
        performedBy: verifierId,
        performedRole: 'PARTNER',
        details: { notes }
      }
    });

    // Send approval email
    let emailSent = false;
    try {
      await emailService.sendDocumentApprovedEmail(
        document.user.email,
        'Utente',
        this.getDocumentTypeName(document.type)
      );
      
      await prisma.userDocument.update({
        where: { id: documentId },
        data: { emailSentAt: new Date() }
      });
      
      emailSent = true;
    } catch (error) {
      console.error('Error sending approval email:', error);
    }

    return { document: updatedDocument, emailSent };
  }

  // Reject document
  static async rejectDocument(
    documentId: string, 
    verifierId: string, 
    reason: string, 
    details?: string
  ) {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
      include: { user: true }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        rejectionReason: reason,
        rejectionDetails: details,
        userNotifiedAt: new Date()
      }
    });

    // Log action
    await prisma.documentActionLog.create({
      data: {
        documentId,
        action: 'REJECT',
        performedBy: verifierId,
        performedRole: 'PARTNER',
        details: { reason, details }
      }
    });

    // Delete the rejected file
    if (fs.existsSync(document.url)) {
      fs.unlinkSync(document.url);
    }

    // Send rejection email
    let emailSent = false;
    try {
      await emailService.sendDocumentRejectedEmail(
        document.user.email,
        'Utente',
        this.getDocumentTypeName(document.type),
        reason,
        details
      );
      
      await prisma.userDocument.update({
        where: { id: documentId },
        data: { emailSentAt: new Date() }
      });
      
      emailSent = true;
    } catch (error) {
      console.error('Error sending rejection email:', error);
    }

    return { document: updatedDocument, emailSent };
  }

  // Delete document (removes file and database record)
  static async deleteDocument(documentId: string, performedBy: string, performedRole: UserRole) {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      throw new Error('Documento non trovato');
    }

    // Don't allow deletion of approved documents
    if (document.status === 'APPROVED') {
      throw new Error('Non è possibile eliminare documenti approvati');
    }

    // Delete file from filesystem
    if (fs.existsSync(document.url)) {
      fs.unlinkSync(document.url);
    }

    // Log action before deletion
    await prisma.documentActionLog.create({
      data: {
        documentId,
        action: 'DELETE',
        performedBy,
        performedRole,
        details: { status: document.status }
      }
    });

    // Delete database record
    await prisma.userDocument.delete({
      where: { id: documentId }
    });

    return { success: true };
  }

  // Notify partner about new document
  static async notifyPartnerNewDocument(documentId: string) {
    try {
      const document = await prisma.userDocument.findUnique({
        where: { id: documentId },
        include: {
          registration: {
            include: { partner: true }
          }
        }
      });

      if (!document || !document.registration) {
        return;
      }

      // Update notification timestamp
      await prisma.userDocument.update({
        where: { id: documentId },
        data: { partnerNotifiedAt: new Date() }
      });

      // TODO: Send real-time notification via WebSocket
      console.log(`Partner notified of new document ${documentId}`);

      // Optional: Send email notification to partner
      // if (document.registration?.partner?.email) {
      //   await emailService.sendPartnerDocumentNotification(...)
      // }
    } catch (error) {
      console.error('Error notifying partner:', error);
    }
  }

  // Get document type display name
  static getDocumentTypeName(type: DocumentType): string {
    const typeNames: Record<DocumentType, string> = {
      IDENTITY_CARD: "Carta d'Identità",
      PASSPORT: "Passaporto",
      DIPLOMA: "Diploma",
      BACHELOR_DEGREE: "Laurea Triennale",
      MASTER_DEGREE: "Laurea Magistrale",
      TRANSCRIPT: "Transcript",
      CV: "Curriculum Vitae",
      PHOTO: "Foto Tessera",
      RESIDENCE_CERT: "Certificato di Residenza",
      BIRTH_CERT: "Certificato di Nascita",
      CONTRACT_SIGNED: "Contratto Firmato",
      MEDICAL_CERT: "Certificato Medico",
      TESSERA_SANITARIA: "Tessera Sanitaria",
      OTHER: "Altro Documento"
    };
    return typeNames[type] || type;
  }

  // Get required documents for offer type
  static getRequiredDocuments(offerType: string) {
    if (offerType === 'TFA') {
      return [
        { type: 'IDENTITY_CARD', name: "Carta d'Identità", required: true },
        { type: 'DIPLOMA', name: 'Diploma', required: false },
        { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', required: false },
        { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', required: false },
        { type: 'TRANSCRIPT', name: 'Piano di Studio', required: false },
        { type: 'BIRTH_CERT', name: 'Certificato di Nascita', required: false }
      ];
    } else if (offerType === 'CERTIFICATION') {
      return [
        { type: 'IDENTITY_CARD', name: "Carta d'Identità", required: true },
        { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria / Codice Fiscale', required: true }
      ];
    }
    return [];
  }

  // Sync documents from enrollment to user dashboard
  static async syncEnrollmentDocuments(registrationId: string) {
    // Update all enrollment documents to be visible in dashboard
    const result = await prisma.userDocument.updateMany({
      where: {
        registrationId,
        uploadSource: 'ENROLLMENT'
      },
      data: {
        // Make them available in user dashboard by not filtering by source
        partnerNotifiedAt: new Date()
      }
    });

    return result;
  }
}

export default UnifiedDocumentService;