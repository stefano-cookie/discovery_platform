import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import DocumentUploadCard, { DocumentTypeConfig } from './DocumentUploadCard';
import DocumentPreview from './DocumentPreview';

import { UserDocument } from './DocumentPreview';

type UploadedDocument = UserDocument;

interface DocumentUploadManagerProps {
  userId: string;
  registrationId?: string;
  source: 'enrollment' | 'dashboard' | 'partner';
  onDocumentChange?: (documents: UploadedDocument[]) => void;
  allowUpload?: boolean;
  allowDelete?: boolean;
  showOnlyRequired?: boolean;
  templateType?: 'TFA' | 'CERTIFICATION';
  offerType?: string;
  className?: string;
}

// Document configurations by template type
const TFA_DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    type: 'cartaIdentita',
    name: 'Carta d\'Identità',
    description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'certificatoTriennale',
    name: 'Certificato Laurea Triennale',
    description: 'Certificato di laurea triennale o diploma universitario',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'certificatoMagistrale',
    name: 'Certificato Laurea Magistrale',
    description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'pianoStudioTriennale',
    name: 'Piano di Studio Triennale',
    description: 'Piano di studio della laurea triennale con lista esami sostenuti',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'pianoStudioMagistrale',
    name: 'Piano di Studio Magistrale',
    description: 'Piano di studio della laurea magistrale, specialistica o vecchio ordinamento',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'certificatoMedico',
    name: 'Certificato Medico di Sana e Robusta Costituzione',
    description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'certificatoNascita',
    name: 'Certificato di Nascita',
    description: 'Certificato di nascita o estratto di nascita dal Comune',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'diplomoLaurea',
    name: 'Diploma di Laurea',
    description: 'Diploma di laurea (cartaceo o digitale)',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'pergamenaLaurea',
    name: 'Pergamena di Laurea',
    description: 'Pergamena di laurea (documento originale)',
    required: false,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  }
];

const CERTIFICATION_DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    type: 'cartaIdentita',
    name: 'Carta d\'Identità',
    description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  },
  {
    type: 'certificatoMedico',
    name: 'Codice Fiscale / Tessera Sanitaria',
    description: 'Tessera sanitaria o documento che attesti il codice fiscale',
    required: true,
    acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    maxFileSize: 10 * 1024 * 1024,
    icon: 'document'
  }
];

const DocumentUploadManager: React.FC<DocumentUploadManagerProps> = ({
  userId,
  registrationId,
  source,
  onDocumentChange,
  allowUpload = true,
  allowDelete = true,
  showOnlyRequired = false,
  templateType = 'TFA',
  offerType,
  className = ''
}) => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, number>>({});
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get document types based on template type
  const getDocumentTypes = (): DocumentTypeConfig[] => {
    let documentTypes: DocumentTypeConfig[];
    
    if (templateType === 'CERTIFICATION') {
      documentTypes = CERTIFICATION_DOCUMENT_TYPES;
    } else {
      documentTypes = TFA_DOCUMENT_TYPES;
    }
    
    return showOnlyRequired 
      ? documentTypes.filter(dt => dt.required)
      : documentTypes;
  };

  const [displayDocumentTypes, setDisplayDocumentTypes] = useState<DocumentTypeConfig[]>([]);

  // Fetch document types from server
  const fetchDocumentTypes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (templateType) {
        params.append('templateType', templateType);
      }
      
      const response = await fetch(`/api/documents/types?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const types = data.documentTypes as DocumentTypeConfig[];
        
        // Apply filtering based on showOnlyRequired
        const filteredTypes = showOnlyRequired 
          ? types.filter(dt => dt.required)
          : types;
          
        setDisplayDocumentTypes(filteredTypes);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
      // Fallback to local configuration
      setDisplayDocumentTypes(getDocumentTypes());
    }
  }, [templateType, showOnlyRequired]);

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let url = '/api/documents';
      if (source === 'enrollment' && registrationId) {
        url = `/api/documents/enrollment/${registrationId}`;
      } else if (source === 'partner' && registrationId) {
        url = `/api/partners/registrations/${registrationId}/documents`;
      } else if (source === 'dashboard' && registrationId) {
        // For dashboard, get all documents for this user's registration (both enrollment and user-uploaded)
        url = `/api/documents/registration/${registrationId}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const docs = data.documents || [];
        // Map API response to UserDocument interface
        const mappedDocs = docs.map((doc: any) => ({
          id: doc.id,
          type: doc.type,
          fileName: doc.fileName || doc.originalName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          rejectionReason: doc.rejectionReason,
          rejectionDetails: doc.rejectionDetails
        }));
        setDocuments(mappedDocs);
        onDocumentChange?.(mappedDocs);
      } else {
        throw new Error('Errore nel caricamento documenti');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType, registrationId]);

  // Handle file upload
  const handleFileUpload = async (file: File, type: string) => {
    const fileId = `${type}_${Date.now()}`;
    setUploadingFiles(prev => ({ ...prev, [fileId]: 0 }));

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);
      
      if (registrationId) {
        formData.append('registrationId', registrationId);
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadingFiles(prev => ({ ...prev, [fileId]: percentComplete }));
        }
      };

      const uploadPromise = new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.responseText, { status: xhr.status }));
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload error'));
      });

      xhr.open('POST', '/api/documents/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.send(formData);

      const response = await uploadPromise;
      
      if (response.ok) {
        await fetchDocuments(); // Refresh document list
        
        // Remove upload progress after brief delay
        setTimeout(() => {
          setUploadingFiles(prev => {
            const updated = { ...prev };
            delete updated[fileId];
            return updated;
          });
        }, 1000);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert('Errore durante il caricamento del documento');
      
      setUploadingFiles(prev => {
        const updated = { ...prev };
        delete updated[fileId];
        return updated;
      });
    }
  };

  // Handle document preview
  const handlePreview = (document: UploadedDocument) => {
    setSelectedDocument(document);
    setShowPreview(true);
  };

  // Handle document download
  const handleDownload = async (doc: UploadedDocument) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) throw new Error('Errore nel download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Errore nel download del documento');
    }
  };

  // Handle document delete
  const handleDelete = async (documentId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo documento?')) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        await fetchDocuments();
      } else {
        throw new Error('Errore nell\'eliminazione');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Errore nell\'eliminazione del documento');
    }
  };

  const getExistingDocument = (type: string): UploadedDocument | null => {
    return documents.find(doc => doc.type === type) || null;
  };

  const getUploadProgress = (type: string): number => {
    const fileId = Object.keys(uploadingFiles).find(id => id.startsWith(type));
    return fileId ? uploadingFiles[fileId] : 0;
  };

  const isUploading = (type: string): boolean => {
    return Object.keys(uploadingFiles).some(id => id.startsWith(type));
  };

  const requiredCount = displayDocumentTypes.filter(dt => dt.required).length;
  const uploadedRequiredCount = displayDocumentTypes
    .filter(dt => dt.required)
    .filter(dt => getExistingDocument(dt.type))
    .length;
  const approvedCount = documents.filter(doc => doc.status === 'APPROVED').length;
  const pendingCount = documents.filter(doc => doc.status === 'PENDING').length;
  const rejectedCount = documents.filter(doc => doc.status === 'REJECTED').length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">I miei Documenti</h3>
              <p className="text-sm text-gray-600">
                Carica e gestisci i tuoi documenti in modo sicuro
              </p>
            </div>
          </div>
          <button
            onClick={fetchDocuments}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Aggiornamento...' : 'Aggiorna'}
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{documents.length}</div>
            <div className="text-sm text-gray-600">Totale</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <div className="text-sm text-gray-600">Approvati</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-600">In Verifica</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
            <div className="text-sm text-gray-600">Rifiutati</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Documenti richiesti completati</span>
            <span className="text-sm font-medium text-gray-900">
              {uploadedRequiredCount}/{requiredCount}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${requiredCount > 0 ? (uploadedRequiredCount / requiredCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchDocuments}
            className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
          >
            Riprova
          </button>
        </div>
      )}

      {/* Document Upload Cards */}
      <div className="space-y-6">
        {/* Required Documents */}
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            Documenti Obbligatori
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            {displayDocumentTypes.filter(dt => dt.required).map((docType) => (
              <DocumentUploadCard
                key={docType.type}
                documentType={docType}
                existingDocument={getExistingDocument(docType.type)}
                isUploading={isUploading(docType.type)}
                uploadProgress={getUploadProgress(docType.type)}
                onFileSelect={handleFileUpload}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onDelete={allowDelete ? handleDelete : undefined}
                allowDelete={allowDelete}
                showActions={true}
              />
            ))}
          </div>
        </div>

        {/* Optional Documents */}
        {!showOnlyRequired && (
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
              Documenti Opzionali
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              {displayDocumentTypes.filter(dt => !dt.required).map((docType) => (
                <DocumentUploadCard
                  key={docType.type}
                  documentType={docType}
                  existingDocument={getExistingDocument(docType.type)}
                  isUploading={isUploading(docType.type)}
                  uploadProgress={getUploadProgress(docType.type)}
                  onFileSelect={handleFileUpload}
                  onPreview={handlePreview}
                  onDownload={handleDownload}
                  onDelete={allowDelete ? handleDelete : undefined}
                  allowDelete={allowDelete}
                  showActions={true}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {showPreview && selectedDocument && (
        <DocumentPreview
          document={selectedDocument}
          mode="modal"
          allowDownload={true}
          allowApproval={false}
          onClose={() => {
            setShowPreview(false);
            setSelectedDocument(null);
          }}
          onDownload={(documentId: string) => {
            const doc = documents.find(d => d.id === documentId);
            if (doc) handleDownload(doc);
          }}
        />
      )}
    </div>
  );
};

export default DocumentUploadManager;