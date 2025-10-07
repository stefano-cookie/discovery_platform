/**
 * WebSocket Event Types
 * Centralizes all Socket.IO event names
 */

export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Notice Board events
  NOTICE_NEW: 'notice:new',
  NOTICE_UPDATED: 'notice:updated',
  NOTICE_DELETED: 'notice:deleted',
  NOTICE_ACKNOWLEDGED: 'notice:acknowledged',
  NOTICE_ACKNOWLEDGE: 'notice:acknowledge', // Client → Server

  // Registration events
  REGISTRATION_STATUS_CHANGED: 'registration:status_changed',
  REGISTRATION_PAYMENT_UPDATED: 'registration:payment_updated',
  REGISTRATION_DOCUMENT_UPLOADED: 'registration:document_uploaded',
  REGISTRATION_CONTRACT_SIGNED: 'registration:contract_signed',

  // Document events
  DOCUMENT_APPROVED: 'document:approved',
  DOCUMENT_REJECTED: 'document:rejected',

  // Admin notifications
  ADMIN_NEW_REGISTRATION: 'admin:new_registration',
  ADMIN_DOCUMENT_PENDING: 'admin:document_pending',

  // System notifications (Phase 4)
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_DELETE: 'notification:delete',
} as const;

/**
 * Room naming conventions
 */
export const SOCKET_ROOMS = {
  // Role-based rooms
  ADMIN_GLOBAL: 'admin:global',
  PARTNER: (partnerId: string) => `partner:${partnerId}`,
  USER: (userId: string) => `user:${userId}`,

  // Entity-based rooms
  REGISTRATION: (registrationId: string) => `registration:${registrationId}`,
  NOTICES_GLOBAL: 'notices:global',
} as const;

/**
 * Socket data attached to each connection
 */
export interface SocketData {
  userId: string;
  role: 'USER' | 'ADMIN' | 'PARTNER';
  partnerId?: string; // If role is PARTNER
  email: string;
}

/**
 * Event payloads
 */
export interface NoticeNewPayload {
  id: string;
  title: string;
  content: string;
  contentHtml?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isPinned: boolean;
  publishedAt: string;
  createdBy: string;
  attachments?: any[];
}

export interface NoticeUpdatedPayload {
  id: string;
  changes: Partial<NoticeNewPayload>;
}

export interface NoticeDeletedPayload {
  id: string;
}

export interface NoticeAcknowledgedPayload {
  noticeId: string;
  userId?: string;
  partnerEmployeeId?: string;
  readAt: string;
  totalReads: number; // Total number of acknowledgements for this notice
}

export interface RegistrationStatusChangedPayload {
  registrationId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: string;
}

export interface RegistrationPaymentUpdatedPayload {
  registrationId: string;
  userId: string;
  deadlineId: string;
  amountPaid: number;
  remainingAmount: number;
  timestamp: string;
}

export interface RegistrationDocumentUploadedPayload {
  registrationId: string;
  userId: string;
  documentType: string;
  documentId: string;
  timestamp: string;
}

export interface AdminNewRegistrationPayload {
  registrationId: string;
  userId: string;
  userEmail: string;
  courseId: string;
  courseName: string;
  timestamp: string;
}
