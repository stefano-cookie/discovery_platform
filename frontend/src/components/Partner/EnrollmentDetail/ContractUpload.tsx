import React, { useState, useRef } from 'react';

interface ContractUploadProps {
  registrationId: string;
  onUploadSuccess: () => void;
}

const ContractUpload: React.FC<ContractUploadProps> = ({ registrationId, onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadError('Solo file PDF sono supportati');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Il file deve essere massimo 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('contract', file);
      formData.append('registrationId', registrationId);

      const response = await fetch('/api/partners/upload-signed-contract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'upload');
      }

      onUploadSuccess();
    } catch (error: any) {
      setUploadError(error.message || 'Errore durante l\'upload del contratto');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`bg-green-50 border-2 border-dashed rounded-lg p-6 transition-colors ${
        isDragging 
          ? 'border-green-400 bg-green-100' 
          : 'border-green-200 hover:border-green-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          )}
        </div>
        
        <h5 className="font-medium text-gray-900 mb-2">
          {isUploading ? 'Caricamento in corso...' : 'Carica Contratto Firmato'}
        </h5>
        
        <p className="text-sm text-gray-600 mb-4">
          {isDragging 
            ? 'Rilascia il file qui' 
            : 'Trascina qui il contratto firmato o clicca per selezionare il file'
          }
        </p>
        
        {!isUploading && (
          <div className="space-y-2">
            <button 
              onClick={handleFileSelect}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
              disabled={isUploading}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Seleziona File
            </button>
            <p className="text-xs text-gray-500">
              Formati supportati: PDF (max 10MB)
            </p>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {uploadError}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
};

export default ContractUpload;