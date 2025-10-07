import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../auth.middleware';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Setup registration-related WebSocket events
 */
export const setupRegistrationEvents = (io: Server, socket: AuthenticatedSocket): void => {
  // No client-initiated events yet, just server broadcasts
  console.log(`[Registration Events] Handler registered for ${socket.data.email}`);
};

/**
 * Broadcast registration status change
 * Call this from registration update endpoints
 */
export const broadcastRegistrationStatusChange = async (
  io: Server,
  registrationId: string,
  newStatus: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      console.error(`[Registration Events] Registration not found: ${registrationId}`);
      return;
    }

    const [user, course, partnerCompany] = await Promise.all([
      prisma.user.findUnique({
        where: { id: registration.userId },
        select: { id: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: registration.courseId },
        select: { name: true },
      }),
      prisma.partnerCompany.findUnique({
        where: { id: registration.partnerCompanyId! },
        select: { id: true, parentId: true },
      }),
    ]);

    if (!user || !course) {
      console.error(`[Registration Events] Missing related data for registration: ${registrationId}`);
      return;
    }

    const payload = {
      registrationId,
      userId: user.id,
      userEmail: user.email,
      courseName: course.name,
      previousStatus: metadata?.previousStatus,
      newStatus,
      finalAmount: registration.finalAmount,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Emit to user's personal room
    io.to(SOCKET_ROOMS.USER(user.id)).emit(SOCKET_EVENTS.REGISTRATION_STATUS_CHANGED, payload);

    // Emit to registration-specific room
    io.to(SOCKET_ROOMS.REGISTRATION(registrationId)).emit(
      SOCKET_EVENTS.REGISTRATION_STATUS_CHANGED,
      payload
    );

    // Emit to partner room
    if (partnerCompany) {
      io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit(
        SOCKET_EVENTS.REGISTRATION_STATUS_CHANGED,
        payload
      );

      // If sub-partner, also emit to parent partner
      if (partnerCompany.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit(
          SOCKET_EVENTS.REGISTRATION_STATUS_CHANGED,
          payload
        );
      }
    }

    // Emit to admin room
    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.ADMIN_NEW_REGISTRATION, {
      ...payload,
      action: 'status_changed',
    });

    console.log(
      `[Registration Events] Status change broadcast for ${registrationId}: ${newStatus}`
    );
  } catch (error) {
    console.error('[Registration Events] Error broadcasting status change:', error);
  }
};

/**
 * Broadcast payment update
 */
export const broadcastPaymentUpdate = async (
  io: Server,
  registrationId: string,
  deadlineId: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      console.error(`[Registration Events] Registration not found: ${registrationId}`);
      return;
    }

    const [user, course, deadline, partnerCompany] = await Promise.all([
      prisma.user.findUnique({
        where: { id: registration.userId },
        select: { id: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: registration.courseId },
        select: { name: true },
      }),
      prisma.paymentDeadline.findUnique({
        where: { id: deadlineId },
      }),
      registration.partnerCompanyId
        ? prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { id: true, parentId: true },
          })
        : null,
    ]);

    if (!user || !course || !deadline) {
      console.error(`[Registration Events] Missing related data for payment: ${deadlineId}`);
      return;
    }

    const payload = {
      registrationId,
      userId: user.id,
      deadlineId,
      deadlineNumber: deadline.paymentNumber, // Using paymentNumber field
      amount: Number(deadline.amount), // Convert Decimal to number
      isPaid: deadline.isPaid,
      paidAt: deadline.paidAt,
      courseName: course.name,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Emit to user
    io.to(SOCKET_ROOMS.USER(user.id)).emit(SOCKET_EVENTS.REGISTRATION_PAYMENT_UPDATED, payload);

    // Emit to registration room
    io.to(SOCKET_ROOMS.REGISTRATION(registrationId)).emit(
      SOCKET_EVENTS.REGISTRATION_PAYMENT_UPDATED,
      payload
    );

    // Emit to partner
    if (partnerCompany) {
      io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit(
        SOCKET_EVENTS.REGISTRATION_PAYMENT_UPDATED,
        payload
      );

      // Parent partner if exists
      if (partnerCompany.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit(
          SOCKET_EVENTS.REGISTRATION_PAYMENT_UPDATED,
          payload
        );
      }
    }

    console.log(`[Registration Events] Payment update broadcast for ${deadlineId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting payment update:', error);
  }
};

/**
 * Broadcast document upload
 */
export const broadcastDocumentUpload = async (
  io: Server,
  documentId: string
): Promise<void> => {
  try {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      console.error(`[Registration Events] Document not found: ${documentId}`);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: document.userId },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error(`[Registration Events] User not found for document: ${documentId}`);
      return;
    }

    let courseName: string | undefined;
    let partnerCompany: { id: string; parentId: string | null } | null = null;

    if (document.registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: document.registrationId },
      });

      if (registration) {
        const course = await prisma.course.findUnique({
          where: { id: registration.courseId },
          select: { name: true },
        });
        courseName = course?.name;

        if (registration.partnerCompanyId) {
          partnerCompany = await prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { id: true, parentId: true },
          });
        }
      }
    }

    const payload = {
      documentId,
      userId: user.id,
      registrationId: document.registrationId,
      type: document.type,
      status: document.status,
      uploadSource: document.uploadSource,
      courseName,
      timestamp: new Date().toISOString(),
    };

    // Emit to user
    io.to(SOCKET_ROOMS.USER(user.id)).emit(SOCKET_EVENTS.REGISTRATION_DOCUMENT_UPLOADED, payload);

    // Emit to registration room if exists
    if (document.registrationId) {
      io.to(SOCKET_ROOMS.REGISTRATION(document.registrationId)).emit(
        SOCKET_EVENTS.REGISTRATION_DOCUMENT_UPLOADED,
        payload
      );

      // Emit to partner
      if (partnerCompany) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit(
          SOCKET_EVENTS.REGISTRATION_DOCUMENT_UPLOADED,
          payload
        );

        // Parent partner
        if (partnerCompany.parentId) {
          io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit(
            SOCKET_EVENTS.REGISTRATION_DOCUMENT_UPLOADED,
            payload
          );
        }
      }
    }

    // Emit to admin for pending approval
    if (document.status === 'PENDING') {
      io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.ADMIN_DOCUMENT_PENDING, {
        ...payload,
        action: 'new_document',
      });
    }

    console.log(`[Registration Events] Document upload broadcast for ${documentId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting document upload:', error);
  }
};

/**
 * Broadcast document approval
 */
export const broadcastDocumentApproval = async (
  io: Server,
  documentId: string,
  approvedBy: string
): Promise<void> => {
  try {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      console.error(`[Registration Events] Document not found: ${documentId}`);
      return;
    }

    const [user, admin] = await Promise.all([
      prisma.user.findUnique({
        where: { id: document.userId },
        select: { id: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: approvedBy },
        select: { email: true },
      }),
    ]);

    if (!user) {
      console.error(`[Registration Events] User not found for document: ${documentId}`);
      return;
    }

    let courseName: string | undefined;
    let partnerCompany: { id: string; parentId: string | null } | null = null;

    if (document.registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: document.registrationId },
      });

      if (registration) {
        const course = await prisma.course.findUnique({
          where: { id: registration.courseId },
          select: { name: true },
        });
        courseName = course?.name;

        if (registration.partnerCompanyId) {
          partnerCompany = await prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { id: true, parentId: true },
          });
        }
      }
    }

    const payload = {
      documentId,
      userId: user.id,
      userEmail: user.email,
      registrationId: document.registrationId,
      type: document.type,
      status: 'APPROVED',
      approvedBy: admin?.email,
      courseName,
      timestamp: new Date().toISOString(),
    };

    // Emit to user
    io.to(SOCKET_ROOMS.USER(user.id)).emit('document:approved', payload);

    // Emit to registration room if exists
    if (document.registrationId) {
      io.to(SOCKET_ROOMS.REGISTRATION(document.registrationId)).emit('document:approved', payload);

      // Emit to partner
      if (partnerCompany) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit('document:approved', payload);

        // Parent partner
        if (partnerCompany.parentId) {
          io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit('document:approved', payload);
        }
      }
    }

    console.log(`[Registration Events] Document approval broadcast for ${documentId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting document approval:', error);
  }
};

/**
 * Broadcast document rejection
 */
export const broadcastDocumentRejection = async (
  io: Server,
  documentId: string,
  rejectedBy: string,
  rejectionReason?: string
): Promise<void> => {
  try {
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      console.error(`[Registration Events] Document not found: ${documentId}`);
      return;
    }

    const [user, admin] = await Promise.all([
      prisma.user.findUnique({
        where: { id: document.userId },
        select: { id: true, email: true },
      }),
      prisma.user.findUnique({
        where: { id: rejectedBy },
        select: { email: true },
      }),
    ]);

    if (!user) {
      console.error(`[Registration Events] User not found for document: ${documentId}`);
      return;
    }

    let courseName: string | undefined;
    let partnerCompany: { id: string; parentId: string | null } | null = null;

    if (document.registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: document.registrationId },
      });

      if (registration) {
        const course = await prisma.course.findUnique({
          where: { id: registration.courseId },
          select: { name: true },
        });
        courseName = course?.name;

        if (registration.partnerCompanyId) {
          partnerCompany = await prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { id: true, parentId: true },
          });
        }
      }
    }

    const payload = {
      documentId,
      userId: user.id,
      userEmail: user.email,
      registrationId: document.registrationId,
      type: document.type,
      status: 'REJECTED',
      rejectedBy: admin?.email,
      rejectionReason,
      courseName,
      timestamp: new Date().toISOString(),
    };

    // Emit to user (most important - they need to re-upload)
    io.to(SOCKET_ROOMS.USER(user.id)).emit('document:rejected', payload);

    // Emit to registration room if exists
    if (document.registrationId) {
      io.to(SOCKET_ROOMS.REGISTRATION(document.registrationId)).emit('document:rejected', payload);

      // Emit to partner
      if (partnerCompany) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit('document:rejected', payload);

        // Parent partner
        if (partnerCompany.parentId) {
          io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit('document:rejected', payload);
        }
      }
    }

    console.log(`[Registration Events] Document rejection broadcast for ${documentId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting document rejection:', error);
  }
};

/**
 * Broadcast contract signed
 */
export const broadcastContractSigned = async (
  io: Server,
  registrationId: string
): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      console.error(`[Registration Events] Registration not found: ${registrationId}`);
      return;
    }

    const [user, course, partnerCompany] = await Promise.all([
      prisma.user.findUnique({
        where: { id: registration.userId },
        select: { id: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: registration.courseId },
        select: { name: true },
      }),
      registration.partnerCompanyId
        ? prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { id: true, parentId: true },
          })
        : null,
    ]);

    if (!user || !course) {
      console.error(`[Registration Events] Missing related data for registration: ${registrationId}`);
      return;
    }

    const payload = {
      registrationId,
      userId: user.id,
      userEmail: user.email,
      courseName: course.name,
      contractSignedUrl: registration.contractSignedUrl,
      timestamp: new Date().toISOString(),
    };

    // Emit to user
    io.to(SOCKET_ROOMS.USER(user.id)).emit(SOCKET_EVENTS.REGISTRATION_CONTRACT_SIGNED, payload);

    // Emit to registration room
    io.to(SOCKET_ROOMS.REGISTRATION(registrationId)).emit(
      SOCKET_EVENTS.REGISTRATION_CONTRACT_SIGNED,
      payload
    );

    // Emit to partner
    if (partnerCompany) {
      io.to(SOCKET_ROOMS.PARTNER(partnerCompany.id)).emit(
        SOCKET_EVENTS.REGISTRATION_CONTRACT_SIGNED,
        payload
      );

      // Parent partner
      if (partnerCompany.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(partnerCompany.parentId)).emit(
          SOCKET_EVENTS.REGISTRATION_CONTRACT_SIGNED,
          payload
        );
      }
    }

    // Emit to admin
    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.ADMIN_NEW_REGISTRATION, {
      ...payload,
      action: 'contract_signed',
    });

    console.log(`[Registration Events] Contract signed broadcast for ${registrationId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting contract signed:', error);
  }
};

/**
 * Broadcast new registration to admin
 */
export const broadcastNewRegistration = async (
  io: Server,
  registrationId: string
): Promise<void> => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      console.error(`[Registration Events] Registration not found: ${registrationId}`);
      return;
    }

    const [user, course, partnerCompany] = await Promise.all([
      prisma.user.findUnique({
        where: { id: registration.userId },
        select: { id: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: registration.courseId },
        select: { name: true },
      }),
      registration.partnerCompanyId
        ? prisma.partnerCompany.findUnique({
            where: { id: registration.partnerCompanyId },
            select: { name: true },
          })
        : null,
    ]);

    if (!user || !course) {
      console.error(`[Registration Events] Missing related data for registration: ${registrationId}`);
      return;
    }

    const payload = {
      registrationId,
      userId: user.id,
      userEmail: user.email,
      courseName: course.name,
      partnerName: partnerCompany?.name || 'Unknown',
      status: registration.status,
      finalAmount: registration.finalAmount,
      timestamp: new Date().toISOString(),
    };

    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.ADMIN_NEW_REGISTRATION, {
      ...payload,
      action: 'new_registration',
    });

    console.log(`[Registration Events] New registration broadcast: ${registrationId}`);
  } catch (error) {
    console.error('[Registration Events] Error broadcasting new registration:', error);
  }
};
