import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../services/api';
import RejectDocumentModal from './RejectDocumentModal';

interface UnifiedDocument {
  id: string;
  type: string;
  name: string;
  description: string;
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  uploaded: boolean;
  uploadedAt?: string;
  documentId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  uploadSource?: 'ENROLLMENT' | 'USER_DASHBOARD' | 'PARTNER_PANEL';
  isVerified?: boolean;
  registrationId?: string;
}

interface UnifiedDocumentManagerProps {
  userId: string;
  registrationId?: string;
  mode: 'user' | 'partner';
  templateType?: 'TFA' | 'CERTIFICATION';
  allowUpload?: boolean;
  allowApproval?: boolean;
  onDocumentChange?: () => void;
}

const UnifiedDocumentManager: React.FC<UnifiedDocumentManagerProps> = ({
  userId,
  registrationId,
  mode,
  templateType = 'TFA',
  allowUpload = true,
  allowApproval = false,
  onDocumentChange
}) => {
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [documentToReject, setDocumentToReject] = useState<UnifiedDocument | null>(null);

  // Fetch all documents unified from various sources
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let endpoint = '';
      if (mode === 'partner' && registrationId) {
        endpoint = `/partners/registrations/${registrationId}/documents/unified`;
      } else if (mode === 'user') {
        endpoint = `/user/documents/unified${registrationId ? `?registrationId=${registrationId}` : ''}`;
      }

      const response = await apiRequest<{ documents: UnifiedDocument[], uploadedCount: number, totalCount: number }>({
        method: 'GET',
        url: endpoint
      });
      
      // Handle both possible response formats
      const documents = response.documents || response as any || [];
      
      setDocuments(documents);
    } catch (err: any) {
      console.error('📋 Error fetching documents:', err);
      setError(err.response?.data?.error || 'Errore nel caricamento documenti');
    } finally {
      setLoading(false);
    }
  }, [mode, registrationId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'IDENTITY_CARD': 'Carta d\'Identità',
      'PASSPORT': 'Passaporto', 
      'TESSERA_SANITARIA': 'Tessera Sanitaria / Codice Fiscale',
      'BACHELOR_DEGREE': 'Certificato Laurea Triennale',
      'MASTER_DEGREE': 'Certificato Laurea Magistrale',
      'TRANSCRIPT': 'Piano di Studio',
      'MEDICAL_CERT': 'Certificato Medico',
      'BIRTH_CERT': 'Certificato di Nascita',
      'DIPLOMA': 'Diploma di Laurea',
      'OTHER': 'Altri Documenti'
    };
    return labels[type] || type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const getDocumentDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      'IDENTITY_CARD': 'Fronte e retro della carta d\'identità o passaporto in corso di validità',
      'TESSERA_SANITARIA': 'Tessera sanitaria o documento che attesti il codice fiscale',
      'BACHELOR_DEGREE': 'Certificato di laurea triennale o diploma universitario',
      'MASTER_DEGREE': 'Certificato di laurea magistrale, specialistica o vecchio ordinamento',
      'TRANSCRIPT': 'Piano di studio con lista esami sostenuti',
      'MEDICAL_CERT': 'Certificato medico attestante la sana e robusta costituzione fisica e psichica',
      'BIRTH_CERT': 'Certificato di nascita o estratto di nascita dal Comune',
      'DIPLOMA': 'Diploma di laurea (cartaceo o digitale)',
      'OTHER': 'Altri documenti rilevanti'
    };
    return descriptions[type] || '';
  };

  const handleFileUpload = async (documentType: string, file: File) => {
    setUploadingFiles(prev => new Set(prev).add(documentType));
    
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', documentType);
      
      // Only append userId for partner mode
      if (mode === 'partner') {
        formData.append('userId', userId);
      }
      
      if (registrationId) {
        formData.append('registrationId', registrationId);
      }

      let endpoint = '';
      if (mode === 'user') {
        endpoint = '/user/documents';
      } else if (mode === 'partner') {
        endpoint = `/partners/users/${userId}/documents/upload`;
      }

      await apiRequest({
        method: 'POST',
        url: endpoint,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      await fetchDocuments();
      if (onDocumentChange) {
        onDocumentChange();
      }
      
      // Trigger global event for document updates
      window.dispatchEvent(new Event('documentsUpdated'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento del documento');
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentType);
        return newSet;
      });
    }
  };

  const handlePreview = async (doc: UnifiedDocument) => {
    try {
      // Check if document is actually uploaded
      if (!doc.uploaded || !doc.documentId || doc.id.startsWith('empty-')) {
        setError('Documento non ancora caricato');
        return;
      }

      let endpoint = '';
      if (mode === 'partner') {
        endpoint = `/partners/users/${userId}/documents/${doc.documentId}/download`;
      } else {
        endpoint = `/user/documents/${doc.documentId}/download`;
      }

      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Errore nel caricamento');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      setError('Errore nella preview del documento');
    }
  };

  const handleDownload = async (doc: UnifiedDocument) => {
    try {
      // Check if document is actually uploaded
      if (!doc.uploaded || !doc.documentId || doc.id.startsWith('empty-')) {
        setError('Documento non ancora caricato');
        return;
      }

      let endpoint = '';
      if (mode === 'partner') {
        endpoint = `/partners/users/${userId}/documents/${doc.documentId}/download`;
      } else {
        endpoint = `/user/documents/${doc.documentId}/download`;
      }

      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Errore nel download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || doc.originalName || `document.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Errore nel download del documento');
    }
  };

  const handleApprove = async (doc: UnifiedDocument) => {
    try {
      await apiRequest({
        method: 'POST',
        url: `/partners/documents/${doc.id}/approve`,
        data: { notes: 'Documento approvato' }
      });
      
      await fetchDocuments();
      if (onDocumentChange) {
        onDocumentChange();
      }
      
      // Trigger global event for document approval
      window.dispatchEvent(new Event('documentsUpdated'));
    } catch (err: any) {
      setError('Errore nell\'approvazione del documento');
    }
  };

  const handleReject = async (reason: string, details?: string) => {
    if (!documentToReject) return;

    try {
      await apiRequest({
        method: 'POST',
        url: `/partners/documents/${documentToReject.id}/reject`,
        data: { reason, details }
      });
      
      await fetchDocuments();
      if (onDocumentChange) {
        onDocumentChange();
      }
      
      // Trigger global event for document approval
      window.dispatchEvent(new Event('documentsUpdated'));
    } catch (err: any) {
      setError('Errore nel rifiuto del documento');
    }
  };

  const openRejectModal = (doc: UnifiedDocument) => {
    setDocumentToReject(doc);
    setShowRejectModal(true);
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setDocumentToReject(null);
  };

  const FileUploadButton: React.FC<{ documentType: string; accept: string }> = ({ documentType, accept }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileUpload(documentType, file);
      }
      event.target.value = '';
    };

    return (
      <label className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors duration-200 cursor-pointer">
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={uploadingFiles.has(documentType)}
        />
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {uploadingFiles.has(documentType) ? 'Caricamento...' : 'Carica'}
      </label>
    );
  };

  const getDocumentIcon = (type: string, uploaded: boolean) => {
    const iconClass = uploaded ? 'text-green-600' : 'text-gray-400';
    return (
      <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const getStatusBadge = (document: UnifiedDocument) => {
    if (!document.uploaded) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          Non caricato
        </span>
      );
    }

    const badges = [];

    // Upload status badge
    badges.push(
      <span key="uploaded" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Caricato
      </span>
    );

    // Approval status badges
    if (document.status === 'APPROVED' || document.isVerified) {
      badges.push(
        <span key="approved" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          {allowApproval ? 'Approvato' : 'Verificato'}
        </span>
      );
    } else if (document.status === 'REJECTED') {
      badges.push(
        <span key="rejected" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          Rifiutato
        </span>
      );
    } else if (document.status === 'PENDING') {
      badges.push(
        <span key="pending" className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          In verifica
        </span>
      );
    }

    return <div className="flex items-center space-x-2">{badges}</div>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  // Filter documents by template type
  const getFilteredDocuments = () => {
    if (templateType === 'CERTIFICATION') {
      return documents.filter(doc => 
        ['IDENTITY_CARD', 'TESSERA_SANITARIA'].includes(doc.type) ||
        ['cartaIdentita', 'certificatoMedico'].includes(doc.type)
      );
    }
    return documents; // TFA shows all documents
  };

  const filteredDocuments = getFilteredDocuments();
  const uploadedCount = filteredDocuments.filter(doc => doc.uploaded).length;
  const totalCount = filteredDocuments.length;
  const completionPercentage = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Caricamento documenti...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Errore</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDocuments}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2V9a2 2 0 00-2-2H8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Gestione Documenti</h2>
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium text-blue-600">{uploadedCount}</span> di <span className="font-medium">{totalCount}</span> documenti caricati
              </p>
            </div>
          </div>
        
          {/* Progress Badge */}
          <div className="flex items-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              completionPercentage === 100 
                ? 'bg-green-100 text-green-700' 
                : completionPercentage >= 50 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-orange-100 text-orange-700'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                completionPercentage === 100 
                  ? 'bg-green-500' 
                  : completionPercentage >= 50 
                    ? 'bg-blue-500' 
                    : 'bg-orange-500'
              }`}></div>
              {completionPercentage}% completato
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l3 3m-3-3h12" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {templateType === 'CERTIFICATION' ? 'Documenti Richiesti per Certificazione' : 'Documenti Richiesti per TFA'}
              </h3>
              <p className="text-sm text-gray-500">
                {templateType === 'CERTIFICATION' 
                  ? 'Documenti base richiesti per il corso di certificazione' 
                  : 'Documenti specifici per questa tipologia di corso TFA'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchDocuments}
            className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
            disabled={loading}
          >
            <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {filteredDocuments.map((doc, index) => (
            <div key={index} className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md ${
              doc.uploaded 
                ? doc.status === 'REJECTED'
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 hover:border-red-300'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
                      doc.uploaded ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {getDocumentIcon(doc.type, doc.uploaded)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-gray-900 mb-1">
                        {getDocumentTypeLabel(doc.type)}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2 leading-relaxed">
                        {getDocumentDescription(doc.type)}
                      </p>
                      {doc.uploaded && doc.uploadedAt && (
                        <div className="flex items-center text-xs text-gray-500 mb-2">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Caricato il {formatDate(doc.uploadedAt)}
                        </div>
                      )}
                      {doc.status === 'REJECTED' && doc.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded-md">
                          <p className="text-xs text-red-700">
                            <strong>Motivo rifiuto:</strong> {doc.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
            
                  <div className="flex flex-col items-end space-y-2">
                    {/* Status Badges - prioritized at top */}
                    <div className="flex items-center space-x-1">
                      {getStatusBadge(doc)}
                    </div>

                    {/* Action Buttons - grouped by function */}
                    <div className="flex items-center space-x-1 flex-wrap justify-end">
                      {doc.uploaded && doc.documentId && (
                        <>
                          <button
                            onClick={() => handlePreview(doc)}
                            className="inline-flex items-center px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Anteprima
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Scarica
                          </button>
                        </>
                      )}
                      
                      {allowUpload && (
                        <FileUploadButton 
                          documentType={doc.type} 
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                      )}

                      {/* Partner approval buttons */}
                      {allowApproval && doc.uploaded && doc.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(doc)}
                            className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approva
                          </button>
                          <button
                            onClick={() => openRejectModal(doc)}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Rifiuta
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reject Document Modal */}
      <RejectDocumentModal
        isOpen={showRejectModal}
        onClose={closeRejectModal}
        onConfirm={handleReject}
        documentName={documentToReject ? getDocumentTypeLabel(documentToReject.type) : ''}
      />
    </div>
  );
};

export default UnifiedDocumentManager;