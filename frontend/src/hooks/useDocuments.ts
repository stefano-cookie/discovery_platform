import { useState, useEffect, useCallback } from 'react';
import { UserDocument } from '../components/Documents';
import { triggerCertificationStepsRefresh, triggerRegistrationsRefresh } from '../utils/refreshEvents';

interface DocumentType {
  value: string;
  label: string;
  description: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxFileSize: number;
}

interface UseDocumentsOptions {
  source: 'enrollment' | 'dashboard' | 'partner';
  registrationId?: string;
  userId?: string;
  autoRefresh?: boolean;
}

export const useDocuments = ({
  source,
  registrationId,
  userId,
  autoRefresh = false
}: UseDocumentsOptions) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/documents/types', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocumentTypes(data.documentTypes);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let url = '/api/documents';
      
      if (source === 'enrollment') {
        url = '/api/documents/enrollment-documents';
      } else if (source === 'partner' && registrationId) {
        url = `/api/partners/registrations/${registrationId}/documents`;
      } else if (source === 'partner' && userId) {
        url = `/api/partners/users/${userId}/documents/all`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status}`);
      }

      const data = await response.json();
      const docs = data.documents || [];
      setDocuments(docs);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error fetching documents');
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [source, registrationId, userId]);

  const syncDocuments = useCallback(async () => {
    if (source !== 'dashboard') return;

    try {
      const response = await fetch('/api/documents/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        await fetchDocuments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error syncing documents:', error);
      return false;
    }
  }, [source, fetchDocuments]);

  const uploadDocument = useCallback(async (
    file: File, 
    type: string, 
    registrationId?: string
  ): Promise<UserDocument | null> => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);
      
      if (registrationId) {
        formData.append('registrationId', registrationId);
      }

      const endpoint = source === 'enrollment' 
        ? '/api/enrollment/documents/upload'
        : '/api/documents';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      await fetchDocuments(); // Refresh list
      return result.document;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  }, [source, fetchDocuments]);

  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        await fetchDocuments();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }, [fetchDocuments]);

  const approveDocument = useCallback(async (
    documentId: string, 
    notes?: string
  ): Promise<boolean> => {
    if (source !== 'partner') return false;

    try {
      const response = await fetch(`/api/partners/documents/${documentId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes })
      });

      if (response.ok) {
        await fetchDocuments();
        
        // Trigger refresh events for certification steps and registrations
        console.log('Document approved, triggering refresh');
        setTimeout(() => {
          triggerCertificationStepsRefresh();
          triggerRegistrationsRefresh();
        }, 500); // Small delay to ensure API state is consistent
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error approving document:', error);
      return false;
    }
  }, [source, fetchDocuments]);

  const rejectDocument = useCallback(async (
    documentId: string, 
    reason: string, 
    details?: string
  ): Promise<boolean> => {
    if (source !== 'partner') return false;

    try {
      const response = await fetch(`/api/partners/documents/${documentId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason, details })
      });

      if (response.ok) {
        await fetchDocuments();
        
        // Trigger refresh events for certification steps and registrations
        console.log('Document rejected, triggering refresh');
        setTimeout(() => {
          triggerCertificationStepsRefresh();
          triggerRegistrationsRefresh();
        }, 500); // Small delay to ensure API state is consistent
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error rejecting document:', error);
      return false;
    }
  }, [source, fetchDocuments]);

  const getDocumentStats = useCallback(() => {
    return {
      total: documents.length,
      approved: documents.filter(doc => doc.status === 'APPROVED').length,
      rejected: documents.filter(doc => doc.status === 'REJECTED').length,
      pending: documents.filter(doc => doc.status === 'PENDING').length
    };
  }, [documents]);

  useEffect(() => {
    fetchDocumentTypes();
    fetchDocuments();
  }, [fetchDocumentTypes, fetchDocuments]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchDocuments, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchDocuments]);

  return {
    documents,
    documentTypes,
    isLoading,
    error,
    stats: getDocumentStats(),
    actions: {
      refresh: fetchDocuments,
      sync: syncDocuments,
      upload: uploadDocument,
      delete: deleteDocument,
      approve: approveDocument,
      reject: rejectDocument
    }
  };
};

export default useDocuments;