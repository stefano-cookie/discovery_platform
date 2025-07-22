import React, { useState, useRef } from 'react';

interface DocumentType {
  value: string;
  label: string;
  required: boolean;
}

interface DocumentUploadProps {
  onUploadComplete: () => void;
  documentTypes: DocumentType[];
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUploadComplete, documentTypes }) => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      setError('Seleziona un tipo di documento');
      return;
    }
    
    if (!fileInputRef.current?.files?.[0]) {
      setError('Seleziona un file da caricare');
      return;
    }
    
    const file = fileInputRef.current.files[0];
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo file non supportato. Usa PDF, JPG o PNG.');
      return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Il file è troppo grande. Dimensione massima: 10MB.');
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('type', selectedType);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setSuccess(result.message || 'Documento caricato con successo!');
        setSelectedType('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onUploadComplete();
      } else {
        const error = await response.json();
        setError(error.error || 'Errore durante il caricamento');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Errore di connessione');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h4 className="text-lg font-medium text-gray-900 mb-4">
        📄 Carica Nuovo Documento
      </h4>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-2">
            Tipo Documento *
          </label>
          <select
            id="documentType"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Seleziona tipo documento...</option>
            {documentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label} {type.required && '*'}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="documentFile" className="block text-sm font-medium text-gray-700 mb-2">
            File *
          </label>
          <input
            ref={fileInputRef}
            id="documentFile"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Formati supportati: PDF, JPG, PNG. Dimensione massima: 10MB
          </p>
        </div>
        
        <button
          type="submit"
          disabled={uploading}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Caricamento...
            </>
          ) : (
            <>
              ⬆️ Carica Documento
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default DocumentUpload;