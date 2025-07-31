import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';

interface UserDocument {
  id: string;
  type: string;
  fileName: string;
  isVerified: boolean;
  uploadedAt: string;
}

interface DocumentType {
  value: string;
  label: string;
  required: boolean;
}

interface DocumentsSectionProps {
  onDocumentChange?: () => void;
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({ onDocumentChange }) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
    loadDocumentTypes();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await apiRequest<{ documents: UserDocument[] }>({
        method: 'GET',
        url: '/user/documents'
      });
      setDocuments(response.documents || []);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError('Errore nel caricamento dei documenti');
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await apiRequest<{ documentTypes: DocumentType[] }>({
        method: 'GET',
        url: '/user/documents/types'
      });
      setDocumentTypes(response.documentTypes || []);
    } catch (err: any) {
      console.error('Error loading document types:', err);
    }
  };

  const handleFileUpload = async (type: string, file: File) => {
    if (!file) return;

    setUploading(type);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', type);

      const response = await fetch('/api/user/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'upload');
      }

      await loadDocuments();
      onDocumentChange?.();
    } catch (err: any) {
      setError(err.message || 'Errore nell\'upload del documento');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) return;

    try {
      await apiRequest({
        method: 'DELETE',
        url: `/user/documents/${documentId}`
      });

      await loadDocuments();
      onDocumentChange?.();
    } catch (err: any) {
      setError(err.message || 'Errore nell\'eliminazione del documento');
    }
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/user/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Errore nel download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Errore nel download del documento');
    }
  };

  const getDocumentByType = (type: string) => {
    return documents.find(doc => doc.type === type);
  };

  const getDocumentTypeLabel = (type: string) => {
    const docType = documentTypes.find(dt => dt.value === type);
    return docType?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Caricamento documenti...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">I Miei Documenti</h3>
        <div className="text-sm text-gray-500">
          {documents.length} documento{documents.length !== 1 ? 'i' : ''} caricato{documents.length !== 1 ? 'i' : ''}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-xs ml-2"
          >
            Chiudi
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documentTypes.map((docType) => {
          const existingDoc = getDocumentByType(docType.value);
          const isUploading = uploading === docType.value;

          return (
            <div key={docType.value} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900 flex items-center">
                    {docType.label}
                    {docType.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </h4>
                  {existingDoc && (
                    <p className="text-sm text-gray-600 mt-1">
                      Caricato il {new Date(existingDoc.uploadedAt).toLocaleDateString('it-IT')}
                    </p>
                  )}
                </div>
                
                {existingDoc && (
                  <div className="flex items-center space-x-2">
                    {existingDoc.isVerified ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Verificato
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ In attesa
                      </span>
                    )}
                  </div>
                )}
              </div>

              {existingDoc ? (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {existingDoc.fileName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownloadDocument(existingDoc.id, existingDoc.fileName)}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Scarica
                    </button>
                    <label className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center cursor-pointer">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Sostituisci
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(docType.value, file);
                        }}
                        disabled={isUploading}
                      />
                    </label>
                    <button
                      onClick={() => handleDeleteDocument(existingDoc.id)}
                      className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {isUploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Caricamento...</span>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="space-y-2">
                        <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium text-blue-600 hover:text-blue-500">
                            Clicca per caricare
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            PDF, JPG, PNG (max 10MB)
                          </p>
                        </div>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(docType.value, file);
                        }}
                        disabled={isUploading}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Informazioni sui documenti:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>I documenti caricati sono riutilizzabili per tutte le tue iscrizioni</li>
              <li>Puoi sostituire o eliminare i documenti in qualsiasi momento</li>
              <li>Il partner può visualizzare e scaricare i tuoi documenti</li>
              <li>I documenti contrassegnati con * sono obbligatori</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsSection;