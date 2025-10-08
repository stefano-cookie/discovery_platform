import { useEffect, useState, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

interface RegistrationStatusPayload {
  registrationId: string;
  userId: string;
  userEmail: string;
  courseName: string;
  previousStatus?: string;
  newStatus: string;
  finalAmount: number;
  timestamp: string;
}

interface PaymentUpdatePayload {
  registrationId: string;
  userId: string;
  deadlineId: string;
  deadlineNumber: number;
  amount: number;
  isPaid: boolean;
  paidAt?: string;
  courseName: string;
  timestamp: string;
}

interface DocumentUploadPayload {
  documentId: string;
  userId: string;
  registrationId?: string;
  type: string;
  status: string;
  uploadSource: string;
  courseName?: string;
  timestamp: string;
}

interface DocumentApprovalPayload {
  documentId: string;
  userId: string;
  userEmail: string;
  registrationId?: string;
  type: string;
  status: 'APPROVED';
  approvedBy?: string;
  courseName?: string;
  timestamp: string;
}

interface DocumentRejectionPayload {
  documentId: string;
  userId: string;
  userEmail: string;
  registrationId?: string;
  type: string;
  status: 'REJECTED';
  rejectedBy?: string;
  rejectionReason?: string;
  courseName?: string;
  timestamp: string;
}

interface ContractSignedPayload {
  registrationId: string;
  userId: string;
  userEmail: string;
  courseName: string;
  contractSignedUrl?: string;
  timestamp: string;
}

interface UseRealtimeRegistrationResult {
  lastStatusChange: RegistrationStatusPayload | null;
  lastPaymentUpdate: PaymentUpdatePayload | null;
  lastDocumentUpload: DocumentUploadPayload | null;
  lastDocumentApproval: DocumentApprovalPayload | null;
  lastDocumentRejection: DocumentRejectionPayload | null;
  lastContractSigned: ContractSignedPayload | null;
  refreshTrigger: number; // Increment to trigger refresh in parent component
}

/**
 * Hook for real-time registration updates
 * Listens to WebSocket events and provides callbacks
 */
export const useRealtimeRegistration = (
  onStatusChange?: (payload: RegistrationStatusPayload) => void,
  onPaymentUpdate?: (payload: PaymentUpdatePayload) => void,
  onDocumentUpload?: (payload: DocumentUploadPayload) => void,
  onDocumentApproval?: (payload: DocumentApprovalPayload) => void,
  onDocumentRejection?: (payload: DocumentRejectionPayload) => void,
  onContractSigned?: (payload: ContractSignedPayload) => void
): UseRealtimeRegistrationResult => {
  const { socket } = useSocketContext();

  const [lastStatusChange, setLastStatusChange] = useState<RegistrationStatusPayload | null>(null);
  const [lastPaymentUpdate, setLastPaymentUpdate] = useState<PaymentUpdatePayload | null>(null);
  const [lastDocumentUpload, setLastDocumentUpload] = useState<DocumentUploadPayload | null>(null);
  const [lastDocumentApproval, setLastDocumentApproval] = useState<DocumentApprovalPayload | null>(null);
  const [lastDocumentRejection, setLastDocumentRejection] = useState<DocumentRejectionPayload | null>(null);
  const [lastContractSigned, setLastContractSigned] = useState<ContractSignedPayload | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Registration status changed
  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (payload: RegistrationStatusPayload) => {
      console.log('[useRealtimeRegistration] Status changed:', payload);
      setLastStatusChange(payload);
      setRefreshTrigger((prev) => prev + 1);
      onStatusChange?.(payload);
    };

    socket.on('registration:status_changed', handleStatusChange);

    return () => {
      socket.off('registration:status_changed', handleStatusChange);
    };
  }, [socket, onStatusChange]);

  // Payment update
  useEffect(() => {
    if (!socket) return;

    const handlePaymentUpdate = (payload: PaymentUpdatePayload) => {
      console.log('[useRealtimeRegistration] Payment updated:', payload);
      setLastPaymentUpdate(payload);
      setRefreshTrigger((prev) => prev + 1);
      onPaymentUpdate?.(payload);
    };

    socket.on('registration:payment_updated', handlePaymentUpdate);

    return () => {
      socket.off('registration:payment_updated', handlePaymentUpdate);
    };
  }, [socket, onPaymentUpdate]);

  // Document upload
  useEffect(() => {
    if (!socket) return;

    const handleDocumentUpload = (payload: DocumentUploadPayload) => {
      console.log('[useRealtimeRegistration] Document uploaded:', payload);
      setLastDocumentUpload(payload);
      setRefreshTrigger((prev) => prev + 1);
      onDocumentUpload?.(payload);
    };

    socket.on('registration:document_uploaded', handleDocumentUpload);

    return () => {
      socket.off('registration:document_uploaded', handleDocumentUpload);
    };
  }, [socket, onDocumentUpload]);

  // Document approval
  useEffect(() => {
    if (!socket) return;

    const handleDocumentApproval = (payload: DocumentApprovalPayload) => {
      console.log('[useRealtimeRegistration] Document approved:', payload);
      setLastDocumentApproval(payload);
      setRefreshTrigger((prev) => prev + 1);
      onDocumentApproval?.(payload);
    };

    socket.on('document:approved', handleDocumentApproval);

    return () => {
      socket.off('document:approved', handleDocumentApproval);
    };
  }, [socket, onDocumentApproval]);

  // Document rejection
  useEffect(() => {
    if (!socket) return;

    const handleDocumentRejection = (payload: DocumentRejectionPayload) => {
      console.log('[useRealtimeRegistration] Document rejected:', payload);
      setLastDocumentRejection(payload);
      setRefreshTrigger((prev) => prev + 1);
      onDocumentRejection?.(payload);
    };

    socket.on('document:rejected', handleDocumentRejection);

    return () => {
      socket.off('document:rejected', handleDocumentRejection);
    };
  }, [socket, onDocumentRejection]);

  // Contract signed
  useEffect(() => {
    if (!socket) return;

    const handleContractSigned = (payload: ContractSignedPayload) => {
      console.log('[useRealtimeRegistration] Contract signed:', payload);
      setLastContractSigned(payload);
      setRefreshTrigger((prev) => prev + 1);
      onContractSigned?.(payload);
    };

    socket.on('registration:contract_signed', handleContractSigned);

    return () => {
      socket.off('registration:contract_signed', handleContractSigned);
    };
  }, [socket, onContractSigned]);

  return {
    lastStatusChange,
    lastPaymentUpdate,
    lastDocumentUpload,
    lastDocumentApproval,
    lastDocumentRejection,
    lastContractSigned,
    refreshTrigger,
  };
};

/**
 * Hook for admin real-time notifications
 */
interface AdminNotificationPayload {
  registrationId: string;
  userId: string;
  userEmail: string;
  courseName: string;
  action: string;
  timestamp: string;
}

interface RegistrationDeletedPayload {
  registrationId: string;
  timestamp: string;
  action: string;
}

interface UseRealtimeAdminResult {
  lastNewRegistration: AdminNotificationPayload | null;
  lastDocumentPending: AdminNotificationPayload | null;
  lastRegistrationDeleted: RegistrationDeletedPayload | null;
  refreshTrigger: number;
}

export const useRealtimeAdmin = (
  onNewRegistration?: (payload: AdminNotificationPayload) => void,
  onDocumentPending?: (payload: AdminNotificationPayload) => void,
  onRegistrationDeleted?: (payload: RegistrationDeletedPayload) => void
): UseRealtimeAdminResult => {
  const { socket } = useSocketContext();

  const [lastNewRegistration, setLastNewRegistration] = useState<AdminNotificationPayload | null>(
    null
  );
  const [lastDocumentPending, setLastDocumentPending] = useState<AdminNotificationPayload | null>(
    null
  );
  const [lastRegistrationDeleted, setLastRegistrationDeleted] = useState<RegistrationDeletedPayload | null>(
    null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // New registration
  useEffect(() => {
    if (!socket) return;

    const handleNewRegistration = (payload: AdminNotificationPayload) => {
      console.log('[useRealtimeAdmin] New registration:', payload);
      setLastNewRegistration(payload);
      setRefreshTrigger((prev) => prev + 1);
      onNewRegistration?.(payload);
    };

    socket.on('admin:new_registration', handleNewRegistration);

    return () => {
      socket.off('admin:new_registration', handleNewRegistration);
    };
  }, [socket, onNewRegistration]);

  // Document pending approval
  useEffect(() => {
    if (!socket) return;

    const handleDocumentPending = (payload: AdminNotificationPayload) => {
      console.log('[useRealtimeAdmin] Document pending:', payload);
      setLastDocumentPending(payload);
      setRefreshTrigger((prev) => prev + 1);
      onDocumentPending?.(payload);
    };

    socket.on('admin:document_pending', handleDocumentPending);

    return () => {
      socket.off('admin:document_pending', handleDocumentPending);
    };
  }, [socket, onDocumentPending]);

  // Registration deleted
  useEffect(() => {
    if (!socket) return;

    const handleRegistrationDeleted = (payload: RegistrationDeletedPayload) => {
      console.log('[useRealtimeAdmin] Registration deleted:', payload);
      setLastRegistrationDeleted(payload);
      setRefreshTrigger((prev) => prev + 1);
      onRegistrationDeleted?.(payload);
    };

    socket.on('admin:registration_deleted', handleRegistrationDeleted);

    return () => {
      socket.off('admin:registration_deleted', handleRegistrationDeleted);
    };
  }, [socket, onRegistrationDeleted]);

  return {
    lastNewRegistration,
    lastDocumentPending,
    lastRegistrationDeleted,
    refreshTrigger,
  };
};
