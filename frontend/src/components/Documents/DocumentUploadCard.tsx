import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, File, CheckCircle, XCircle, Clock, AlertCircle, Eye, Download } from 'lucide-react';
import { UserDocument } from './DocumentPreview';

export interface DocumentTypeConfig {
  type: string;
  name: string;
  description: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxFileSize: number;
  icon?: 'document' | 'image' | 'file';
}

type UploadedDocument = UserDocument;

interface DocumentUploadCardProps {
  documentType: DocumentTypeConfig;
  existingDocument?: UploadedDocument | null;
  isUploading?: boolean;
  uploadProgress?: number;
  onFileSelect: (file: File, type: string) => void;
  onPreview?: (document: UploadedDocument) => void;
  onDownload?: (document: UploadedDocument) => void;
  onDelete?: (documentId: string) => void;
  allowDelete?: boolean;
  showActions?: boolean;
}

const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  documentType,
  existingDocument,
  isUploading = false,
  uploadProgress = 0,
  onFileSelect,
  onPreview,
  onDownload,
  onDelete,
  allowDelete = true,
  showActions = true
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = (file: File) => {
    // Validate file type
    if (!documentType.acceptedMimeTypes.includes(file.type)) {
      alert(`Formato file non supportato. Formati accettati: ${documentType.acceptedMimeTypes.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > documentType.maxFileSize) {
      alert(`File troppo grande. Dimensione massima: ${formatFileSize(documentType.maxFileSize)}`);
      return;
    }

    onFileSelect(file, documentType.type);
  };

  const getDocumentIcon = (type?: string) => {
    const iconClass = existingDocument ? 'text-green-600' : 'text-gray-400';
    
    if (documentType.icon === 'image' || type?.startsWith('image/')) {
      return <Image className={`w-5 h-5 ${iconClass}`} />;
    } else if (type === 'application/pdf' || documentType.icon === 'document') {
      return <FileText className={`w-5 h-5 ${iconClass}`} />;
    }
    return <File className={`w-5 h-5 ${iconClass}`} />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'REJECTED': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approvato
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rifiutato
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            In Verifica
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Card styling based on document status
  const getCardStyles = () => {
    if (existingDocument) {
      switch (existingDocument.status) {
        case 'APPROVED':
          return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300';
        case 'REJECTED':
          return 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 hover:border-red-300';
        default:
          return 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 hover:border-yellow-300';
      }
    }
    
    if (isUploading) {
      return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200';
    }
    
    return dragActive 
      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 border-dashed'
      : 'bg-gray-50 border-gray-200 hover:border-gray-300 border-dashed';
  };

  return (
    <div 
      className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md ${getCardStyles()}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          {/* Document Info */}
          <div className="flex items-start">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 ${
              existingDocument 
                ? existingDocument.status === 'APPROVED' ? 'bg-green-100' 
                  : existingDocument.status === 'REJECTED' ? 'bg-red-100' 
                  : 'bg-yellow-100'
                : isUploading ? 'bg-blue-100' 
                : 'bg-gray-100'
            }`}>
              {getDocumentIcon(existingDocument?.mimeType)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-gray-900 mb-1">{documentType.name}</h4>
              {documentType.description && (
                <p className="text-sm text-gray-600 mb-2 leading-relaxed">{documentType.description}</p>
              )}
              
              {existingDocument ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 font-medium">{existingDocument.fileName}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    Caricato il {formatDate(existingDocument.uploadedAt)}
                    <span className="mx-2">•</span>
                    {formatFileSize(existingDocument.fileSize)}
                  </div>
                </div>
              ) : isUploading ? (
                <div className="space-y-2">
                  <p className="text-sm text-blue-700 font-medium">Caricamento in corso...</p>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-600">{uploadProgress}%</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Non caricato</p>
                  <p className="text-xs text-gray-400">
                    Formati: {documentType.acceptedMimeTypes.join(', ')} | Max {formatFileSize(documentType.maxFileSize)}
                  </p>
                </div>
              )}

              {/* Rejection Details */}
              {existingDocument?.status === 'REJECTED' && existingDocument.rejectionReason && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-red-800 font-medium">
                        {existingDocument.rejectionReason}
                      </p>
                      {existingDocument.rejectionDetails && (
                        <p className="text-xs text-red-700 mt-1">
                          {existingDocument.rejectionDetails}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
      
          {/* Status and Actions */}
          <div className="flex flex-col items-end space-y-3">
            {/* Status Badge */}
            <div className="flex items-center space-x-2">
              {existingDocument ? (
                getStatusBadge(existingDocument.status)
              ) : isUploading ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Caricamento
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Non caricato
                </span>
              )}
            </div>

            {/* Action Buttons */}
            {showActions && (
              <div className="flex items-center space-x-2">
                {existingDocument ? (
                  <>
                    {onPreview && (
                      <button
                        onClick={() => onPreview(existingDocument)}
                        className="inline-flex items-center px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors duration-200"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Anteprima
                      </button>
                    )}
                    {onDownload && (
                      <button
                        onClick={() => onDownload(existingDocument)}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Scarica
                      </button>
                    )}
                    {/* Replace/Upload New Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors duration-200"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Sostituisci
                    </button>
                  </>
                ) : !isUploading ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Carica File
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={documentType.acceptedMimeTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Drop Zone Overlay */}
        {dragActive && !existingDocument && !isUploading && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-400 border-dashed rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-blue-700 font-medium">Rilascia il file qui</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentUploadCard;