import React, { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';

export interface DocumentType {
  value: string;
  label: string;
  description: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxFileSize: number;
}

interface UploadedFile {
  id: string;
  file: File;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface DocumentUploadProps {
  documentTypes: DocumentType[];
  registrationId?: string;
  uploadSource: 'enrollment' | 'dashboard' | 'partner';
  onUploadComplete?: (documents: any[]) => void;
  onUploadProgress?: (progress: number) => void;
  maxFiles?: number;
  className?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  documentTypes,
  registrationId,
  uploadSource,
  onUploadComplete,
  onUploadProgress,
  maxFiles = 10,
  className = ''
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File, type: string): string | null => {
    const docType = documentTypes.find(dt => dt.value === type);
    
    if (!docType) {
      return 'Tipo documento non valido';
    }

    if (file.size > docType.maxFileSize) {
      const maxSizeMB = Math.round(docType.maxFileSize / 1024 / 1024);
      return `File troppo grande. Dimensione massima: ${maxSizeMB}MB`;
    }

    if (!docType.acceptedMimeTypes.includes(file.type)) {
      return 'Il file è di un formato non supportato. Usa PDF, JPG, JPEG o PNG.';
    }

    return null;
  };

  const addFilesToUpload = (files: FileList | null, selectedType?: string) => {
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length && uploadedFiles.length + newFiles.length < maxFiles; i++) {
      const file = files[i];
      const fileId = `${Date.now()}-${i}`;
      
      // If type is preselected, use it; otherwise, try to guess or require selection
      const type = selectedType || guessDocumentType(file.name);
      
      const validationError = type ? validateFile(file, type) : null;

      newFiles.push({
        id: fileId,
        file,
        type: type || '',
        status: validationError ? 'error' : 'pending',
        progress: 0,
        error: validationError || undefined
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const guessDocumentType = (fileName: string): string => {
    const name = fileName.toLowerCase();
    
    if (name.includes('carta') || name.includes('identit') || name.includes('ci')) {
      return 'IDENTITY_CARD';
    }
    if (name.includes('passaporto') || name.includes('passport')) {
      return 'PASSPORT';
    }
    if (name.includes('diploma')) {
      return 'DIPLOMA';
    }
    if (name.includes('laurea') || name.includes('degree')) {
      return 'BACHELOR_DEGREE';
    }
    if (name.includes('cv') || name.includes('curriculum')) {
      return 'CV';
    }
    if (name.includes('foto') || name.includes('photo')) {
      return 'PHOTO';
    }
    
    return 'OTHER';
  };

  const updateFileType = (fileId: string, newType: string) => {
    setUploadedFiles(prev =>
      prev.map(file => {
        if (file.id === fileId) {
          const validationError = validateFile(file.file, newType);
          return {
            ...file,
            type: newType,
            status: validationError ? 'error' : 'pending',
            error: validationError || undefined
          };
        }
        return file;
      })
    );
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const uploadFiles = async () => {
    const filesToUpload = uploadedFiles.filter(file => 
      file.status === 'pending' && file.type && !file.error
    );

    if (filesToUpload.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      const uploadPromises = filesToUpload.map(async (uploadFile) => {
        const formData = new FormData();
        formData.append('document', uploadFile.file);
        formData.append('type', uploadFile.type);
        
        if (registrationId) {
          formData.append('registrationId', registrationId);
        }

        // Update status to uploading
        setUploadedFiles(prev =>
          prev.map(file =>
            file.id === uploadFile.id
              ? { ...file, status: 'uploading' as const }
              : file
          )
        );

        try {
          const xhr = new XMLHttpRequest();

          // Track progress
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              setUploadedFiles(prev =>
                prev.map(file =>
                  file.id === uploadFile.id
                    ? { ...file, progress: percentComplete }
                    : file
                )
              );
              
              // Calculate overall progress
              const totalProgress = uploadedFiles.reduce((sum, file) => 
                sum + (file.status === 'uploading' ? file.progress : file.status === 'success' ? 100 : 0), 0
              ) / uploadedFiles.length;
              
              onUploadProgress?.(totalProgress);
            }
          };

          const uploadPromise = new Promise<any>((resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
              }
            };
            xhr.onerror = () => reject(new Error('Upload error'));
          });

          const endpoint = uploadSource === 'enrollment' 
            ? '/api/enrollment/documents/upload'
            : '/api/documents';

          xhr.open('POST', endpoint);
          xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
          xhr.send(formData);

          const result = await uploadPromise;

          // Update status to success
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === uploadFile.id
                ? { ...file, status: 'success' as const, progress: 100 }
                : file
            )
          );

          return result;
        } catch (error) {
          // Update status to error
          setUploadedFiles(prev =>
            prev.map(file =>
              file.id === uploadFile.id
                ? { 
                    ...file, 
                    status: 'error' as const, 
                    error: error instanceof Error ? error.message : 'Errore di caricamento'
                  }
                : file
            )
          );
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successfulUploads = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value);

      if (successfulUploads.length > 0) {
        onUploadComplete?.(successfulUploads);
      }

    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      onUploadProgress?.(100);
    }
  };

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
    addFilesToUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const canUpload = uploadedFiles.some(file => 
    file.status === 'pending' && file.type && !file.error
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          Carica i tuoi documenti
        </p>
        <p className="text-gray-600 mb-4">
          Trascina i file qui o clicca per selezionare
        </p>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => addFilesToUpload(e.target.files)}
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={uploadedFiles.length >= maxFiles}
        >
          <Upload className="w-4 h-4 mr-2" />
          Seleziona File
        </button>
        
        <p className="text-xs text-gray-500 mt-2">
          Formati supportati: PDF, JPG, PNG • Max {maxFiles} file
        </p>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">
            File da caricare ({uploadedFiles.length})
          </h4>
          
          <div className="space-y-3">
            {uploadedFiles.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <File className="w-6 h-6 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </h5>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                      
                      {/* Type Selection */}
                      <div className="mt-2">
                        <select
                          value={uploadFile.type}
                          onChange={(e) => updateFileType(uploadFile.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={uploadFile.status === 'uploading' || uploadFile.status === 'success'}
                        >
                          <option value="">Seleziona tipo documento</option>
                          {documentTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                              {type.required && ' *'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div className="flex items-center space-x-2 mt-2">
                        {uploadFile.status === 'success' && (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600">Caricato con successo</span>
                          </>
                        )}
                        {uploadFile.status === 'error' && (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-600">
                              {uploadFile.error || 'Errore di caricamento'}
                            </span>
                          </>
                        )}
                        {uploadFile.status === 'uploading' && (
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm text-blue-600 mb-1">
                              <span>Caricamento...</span>
                              <span>{uploadFile.progress}%</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadFile.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  {uploadFile.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Rimuovi file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={uploadFiles}
              disabled={!canUpload || isUploading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Caricamento...' : `Carica ${uploadedFiles.filter(f => f.status === 'pending' && f.type && !f.error).length} File`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;