import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, Image, File } from 'lucide-react';

export interface UserDocument {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  rejectionDetails?: string;
}

interface DocumentPreviewProps {
  document: UserDocument;
  mode: 'inline' | 'modal' | 'fullscreen';
  allowDownload?: boolean;
  allowApproval?: boolean;
  onApprove?: (documentId: string, notes?: string) => Promise<void>;
  onReject?: (documentId: string, reason: string, details?: string) => Promise<void>;
  onClose?: () => void;
  onDownload?: (documentId: string) => void;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  mode = 'modal',
  allowDownload = true,
  allowApproval = false,
  onApprove,
  onReject,
  onClose,
  onDownload
}) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionDetails, setRejectionDetails] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isPDF = document.mimeType === 'application/pdf';
  const isImage = document.mimeType.startsWith('image/');
  
  // Create blob URL for preview with authorization
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  
  React.useEffect(() => {
    let mounted = true;
    
    const loadDocument = async () => {
      try {
        // Use preview endpoint for better compatibility
        const response = await fetch(`/api/documents/${document.id}/preview`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
          // Fallback to download endpoint if preview fails
          const downloadResponse = await fetch(`/api/documents/${document.id}/download`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          
          if (!downloadResponse.ok) {
            throw new Error('Failed to load document');
          }
          
          const blob = await downloadResponse.blob();
          const url = URL.createObjectURL(blob);
          
          if (mounted) {
            setDocumentUrl(url);
          } else {
            URL.revokeObjectURL(url);
          }
        } else {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          if (mounted) {
            setDocumentUrl(url);
          } else {
            URL.revokeObjectURL(url);
          }
        }
      } catch (error) {
        console.error('Error loading document:', error);
      }
    };
    
    loadDocument();
    
    return () => {
      mounted = false;
      if (documentUrl) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [document.id]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleApprove = async () => {
    if (!onApprove) return;
    setIsLoading(true);
    try {
      await onApprove(document.id, approvalNotes);
      setShowApprovalForm(false);
      setApprovalNotes('');
    } catch (error) {
      console.error('Error approving document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectionReason.trim()) return;
    setIsLoading(true);
    try {
      await onReject(document.id, rejectionReason, rejectionDetails);
      setShowRejectionForm(false);
      setRejectionReason('');
      setRejectionDetails('');
    } catch (error) {
      console.error('Error rejecting document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'text-green-600 bg-green-100';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Approvato';
      case 'REJECTED': return 'Rifiutato';
      default: return 'In attesa';
    }
  };

  const rejectionReasons = [
    'Documento illeggibile',
    'Documento scaduto',
    'Documento non valido',
    'Documento incompleto',
    'Formato non corretto',
    'Qualità immagine insufficiente',
    'Altro'
  ];

  const containerClass = mode === 'modal' 
    ? 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50'
    : mode === 'fullscreen'
    ? 'fixed inset-0 bg-white z-50'
    : 'relative';

  const contentClass = mode === 'modal'
    ? 'bg-white rounded-lg max-w-4xl max-h-[90vh] w-full mx-4'
    : mode === 'fullscreen'
    ? 'h-full w-full'
    : 'w-full h-96';

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {isPDF && <FileText className="w-5 h-5 text-red-500" />}
              {isImage && <Image className="w-5 h-5 text-blue-500" />}
              {!isPDF && !isImage && <File className="w-5 h-5 text-gray-500" />}
              <div>
                <h3 className="font-semibold text-gray-900">{document.fileName}</h3>
                <p className="text-sm text-gray-500">
                  {formatFileSize(document.fileSize)} • {document.type}
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
              {getStatusText(document.status)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom Controls (for images) */}
            {isImage && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                  title="Riduci zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 min-w-[3rem]">{zoom}%</span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                  title="Aumenta zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 hover:bg-gray-200 rounded-lg"
                  title="Ruota"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Download */}
            {allowDownload && (
              <button
                onClick={() => onDownload?.(document.id)}
                className="p-2 hover:bg-gray-200 rounded-lg"
                title="Scarica"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Close */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-96 overflow-auto bg-gray-100 flex items-center justify-center">
            {!documentUrl ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Caricamento documento...</p>
              </div>
            ) : isPDF ? (
              <iframe
                src={documentUrl}
                className="w-full h-full"
                title={document.fileName}
              />
            ) : isImage ? (
              <img
                src={documentUrl}
                alt={document.fileName}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out'
                }}
              />
            ) : (
              <div className="text-center p-8">
                <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Anteprima non disponibile per questo tipo di file</p>
                <p className="text-sm text-gray-500">{document.mimeType}</p>
                {allowDownload && (
                  <button
                    onClick={() => onDownload?.(document.id)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 inline mr-2" />
                    Scarica per visualizzare
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Document Status Info */}
        {document.status === 'REJECTED' && document.rejectionReason && (
          <div className="p-4 bg-red-50 border-t">
            <div className="text-red-800">
              <h4 className="font-semibold">Motivo del rifiuto:</h4>
              <p>{document.rejectionReason}</p>
              {document.rejectionDetails && (
                <div className="mt-2">
                  <h5 className="font-medium">Dettagli:</h5>
                  <p className="text-sm">{document.rejectionDetails}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Approval Actions */}
        {allowApproval && document.status === 'PENDING' && (
          <div className="p-4 border-t bg-gray-50">
            {!showApprovalForm && !showRejectionForm && (
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowApprovalForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex-1"
                >
                  Approva Documento
                </button>
                <button
                  onClick={() => setShowRejectionForm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex-1"
                >
                  Rifiuta Documento
                </button>
              </div>
            )}

            {/* Approval Form */}
            {showApprovalForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (opzionale)
                  </label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="Aggiungi note sull'approvazione..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleApprove}
                    disabled={isLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex-1"
                  >
                    {isLoading ? 'Approvazione...' : 'Conferma Approvazione'}
                  </button>
                  <button
                    onClick={() => setShowApprovalForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex-1"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            {/* Rejection Form */}
            {showRejectionForm && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo del rifiuto *
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">Seleziona un motivo</option>
                    {rejectionReasons.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dettagli aggiuntivi
                  </label>
                  <textarea
                    value={rejectionDetails}
                    onChange={(e) => setRejectionDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Fornisci dettagli specifici sul problema riscontrato..."
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleReject}
                    disabled={isLoading || !rejectionReason.trim()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex-1"
                  >
                    {isLoading ? 'Rifiutando...' : 'Conferma Rifiuto'}
                  </button>
                  <button
                    onClick={() => setShowRejectionForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 flex-1"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;