import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Image, File, Eye, Download, Trash2, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import DocumentPreview, { UserDocument } from './DocumentPreview';
import RejectDocumentModal from './RejectDocumentModal';

export interface DocumentType {
  value: string;
  label: string;
  description: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxFileSize: number;
}

interface DocumentManagerProps {
  userId: string;
  registrationId?: string;
  source: 'enrollment' | 'dashboard' | 'partner';
  onDocumentChange?: (documents: UserDocument[]) => void;
  allowUpload?: boolean;
  allowDelete?: boolean;
  allowApproval?: boolean; // For partner view
}

const DocumentManager: React.FC<DocumentManagerProps> = ({
  userId,
  registrationId,
  source,
  onDocumentChange,
  allowUpload = true,
  allowDelete = true,
  allowApproval = false
}) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<UserDocument | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragActive, setDragActive] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [documentToReject, setDocumentToReject] = useState<UserDocument | null>(null);

  // Fetch document types
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

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      let url = '/api/documents';
      
      if (source === 'enrollment') {
        url = '/api/documents/enrollment-documents';
      } else if (source === 'partner' && registrationId) {
        url = `/api/partners/registrations/${registrationId}/documents/unified`;
      } else if (source === 'dashboard' && registrationId) {
        // For user dashboard, get documents for specific registration
        url = `/api/documents/registration/${registrationId}`;
      } else if (source === 'dashboard' && !registrationId) {
        // Show all user documents
        url = '/api/documents';
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const docs = data.documents || [];
        setDocuments(docs);
        // Only call onDocumentChange if documents actually changed
        if (JSON.stringify(docs) !== JSON.stringify(documents)) {
          onDocumentChange?.(docs);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [source, registrationId]);

  useEffect(() => {
    fetchDocumentTypes();
    fetchDocuments();
  }, [fetchDocumentTypes, fetchDocuments]);

  // Handle file upload
  const handleFileUpload = async (files: FileList | null, type?: string) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('document', file);
    
    if (type) {
      formData.append('type', type);
    }
    if (registrationId) {
      formData.append('registrationId', registrationId);
    }

    const fileId = Date.now().toString();
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(prev => ({ ...prev, [fileId]: percentComplete }));
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

      // Choose the correct upload endpoint based on source
      const uploadUrl = source === 'partner' && userId
        ? `/api/partners/users/${userId}/documents/upload`
        : '/api/documents/upload';
      
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.send(formData);

      const response = await uploadPromise;
      
      if (response.ok) {
        const result = await response.json();
        await fetchDocuments(); // Refresh document list
        
        // Remove progress indicator
        setTimeout(() => {
          setUploadProgress(prev => {
            const updated = { ...prev };
            delete updated[fileId];
            return updated;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated[fileId];
        return updated;
      });
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  // Handle document preview
  const handlePreview = (document: UserDocument) => {
    setSelectedDocument(document);
    setShowPreview(true);
  };

  // Handle document download
  const handleDownload = async (documentId: string) => {
    try {
      const url = source === 'partner' 
        ? `/api/partners/documents/${documentId}/download`
        : `/api/documents/${documentId}/download`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `document-${documentId}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Download error:', error);
      alert('Errore nel download del documento');
    }
  };

  // Handle document approval (partner only)
  const handleApprove = async (documentId: string, notes?: string) => {
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
        setShowPreview(false);
      }
    } catch (error) {
      console.error('Error approving document:', error);
    }
  };

  // Handle document rejection (partner only)
  const handleReject = async (reason: string, details?: string) => {
    if (!documentToReject) return;

    try {
      const response = await fetch(`/api/partners/documents/${documentToReject.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason, details })
      });

      if (response.ok) {
        await fetchDocuments();
        setShowPreview(false);
        closeRejectModal();
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setDocumentToReject(null);
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
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (mimeType.startsWith('image/')) return <Image className="w-6 h-6 text-blue-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'REJECTED': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* Upload Area */}
      {allowUpload && (
        <div
          className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Carica documenti
          </p>
          <p className="text-gray-600 mb-4">
            Trascina i file qui o clicca per selezionare
          </p>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            <Upload className="w-4 h-4 mr-2" />
            Seleziona File
          </label>
          <p className="text-xs text-gray-500 mt-2">
            Formati supportati: PDF, JPG, PNG (max 10MB)
          </p>
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="w-full space-y-2">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-700">Caricamento in corso...</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents List */}
      <div className="w-full space-y-4">
        <div className="w-full flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Documenti ({documents.length})
          </h3>
          {source === 'dashboard' && (
            <button
              onClick={fetchDocuments}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Sincronizza
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Caricamento documenti...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nessun documento caricato</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`w-full border-2 rounded-lg p-4 hover:shadow-md transition-all ${
                  doc.status === 'APPROVED' ? 'border-green-200 bg-green-50' :
                  doc.status === 'REJECTED' ? 'border-red-200 bg-red-50' :
                  doc.status === 'PENDING' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="w-full flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getFileIcon(doc.mimeType)}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {doc.fileName}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(doc.fileSize)} • {doc.type}
                      </p>
                      <p className="text-xs text-gray-400">
                        Caricato il {new Date(doc.uploadedAt).toLocaleDateString('it-IT')}
                      </p>
                      
                      {/* Status Badge */}
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          doc.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          doc.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {getStatusIcon(doc.status)}
                          <span className="ml-1">
                            {doc.status === 'APPROVED' && 'Approvato dal Partner'}
                            {doc.status === 'REJECTED' && 'Rifiutato dal Partner'}
                            {doc.status === 'PENDING' && 'In attesa di verifica'}
                          </span>
                        </span>
                        {doc.status === 'APPROVED' && doc.verifiedAt && (
                          <p className="text-xs text-green-600 mt-1">
                            Verificato il {new Date(doc.verifiedAt).toLocaleDateString('it-IT')}
                          </p>
                        )}
                      </div>
                      
                      {doc.status === 'REJECTED' && doc.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-red-800 font-medium">
                                {doc.rejectionReason}
                              </p>
                              {doc.rejectionDetails && (
                                <p className="text-xs text-red-700 mt-1">
                                  {doc.rejectionDetails}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handlePreview(doc)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Anteprima"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="Scarica"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {allowDelete && doc.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {allowApproval && doc.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleApprove(doc.id)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Approva"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDocumentToReject(doc);
                            setShowRejectModal(true);
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Rifiuta"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {showPreview && selectedDocument && (
        <DocumentPreview
          document={selectedDocument}
          mode="modal"
          allowDownload={true}
          allowApproval={allowApproval}
          onApprove={allowApproval ? handleApprove : undefined}
          onReject={allowApproval ? handleReject : undefined}
          onClose={() => {
            setShowPreview(false);
            setSelectedDocument(null);
          }}
          onDownload={handleDownload}
        />
      )}

      {/* Reject Document Modal */}
      <RejectDocumentModal
        isOpen={showRejectModal}
        onClose={closeRejectModal}
        onConfirm={handleReject}
        documentName={documentToReject ? documentToReject.fileName : ''}
      />
    </div>
  );
};

export default DocumentManager;