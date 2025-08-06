import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { documentsSchema, DocumentsForm } from '../../../utils/validation';

interface DocumentsStepProps {
  data: Partial<DocumentsForm>;
  onNext: (data: DocumentsForm) => void;
  onChange?: (data: Partial<DocumentsForm>) => void;
  templateType?: 'TFA' | 'CERTIFICATION';
  requiredFields?: string[];
  userId?: string; // Add userId for document uploads
}

interface FileUploadProps {
  label: string;
  description: string;
  accept: string;
  required?: boolean;
  error?: string;
  onChange: (file: File | null) => void;
  value?: File | null;
  documentType: string; // Add document type for backend uploads
  userId?: string; // Add userId for backend uploads
  templateType?: 'TFA' | 'CERTIFICATION';
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  description, 
  accept, 
  required = false, 
  error, 
  onChange, 
  value,
  documentType,
  userId,
  templateType
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Function to upload file to backend during enrollment
  const uploadFileToBackend = async (file: File): Promise<void> => {
    if (!userId) {
      console.warn('No userId provided for document upload');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);
    formData.append('userId', userId);
    formData.append('documentType', documentType);
    if (templateType) {
      formData.append('templateType', templateType);
    }

    const response = await fetch('/api/registration/upload-document', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('Document uploaded successfully:', result);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validazione tipo file
    const validTypes = accept.split(',').map(type => type.trim());
    const fileType = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const mimeType = file.type;
    
    const isValidType = validTypes.some(type => 
      type === fileType || type === mimeType || type === '*'
    );

    if (!isValidType) {
      setUploadStatus('error');
      return;
    }

    // Validazione dimensione (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    // Simula upload
    setTimeout(() => {
      setUploadStatus('success');
      onChange(file);
    }, 1000);
  };

  const removeFile = () => {
    onChange(null);
    setUploadStatus('idle');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
          ${dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : error 
              ? 'border-red-300 bg-red-50'
              : uploadStatus === 'success' && value
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
        />

        {uploadStatus === 'uploading' ? (
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-blue-500 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-blue-600">Caricamento in corso...</p>
          </div>
        ) : uploadStatus === 'success' && value ? (
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-green-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-600 font-medium">{value.name}</p>
            <p className="text-gray-500 text-sm">{(value.size / 1024 / 1024).toFixed(2)} MB</p>
            <button
              type="button"
              onClick={removeFile}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline relative z-10"
            >
              Rimuovi file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-600">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                Clicca per selezionare
              </span> o trascina il file qui
            </p>
            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max 10MB)</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

const DocumentsStep: React.FC<DocumentsStepProps> = ({ 
  data, 
  onNext, 
  onChange,
  templateType = 'TFA',
  requiredFields = [],
  userId
}) => {
  // Check if this is additional enrollment and load existing documents
  const isAdditionalEnrollment = localStorage.getItem('registrationFormData') !== null;
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  
  useEffect(() => {
    if (isAdditionalEnrollment) {
      const storedDocs = localStorage.getItem('userDocuments');
      if (storedDocs) {
        try {
          setExistingDocuments(JSON.parse(storedDocs));
        } catch (error) {
          console.error('Error loading existing documents:', error);
        }
      }
    }
  }, [isAdditionalEnrollment]);
  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DocumentsForm>({
    resolver: zodResolver(documentsSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  // Local state for files - initialize with existing data
  const [files, setFiles] = useState<{[key: string]: File | null}>({
    cartaIdentita: data.cartaIdentita || null,
    certificatoTriennale: data.certificatoTriennale || null,
    certificatoMagistrale: data.certificatoMagistrale || null,
    pianoStudioTriennale: data.pianoStudioTriennale || null,
    pianoStudioMagistrale: data.pianoStudioMagistrale || null,
    certificatoMedico: data.certificatoMedico || null,
    certificatoNascita: data.certificatoNascita || null,
    diplomoLaurea: data.diplomoLaurea || null,
    pergamenaLaurea: data.pergamenaLaurea || null,
  });

  // State for previously saved file info
  const [previousFileInfo, setPreviousFileInfo] = useState<{[key: string]: any} | null>(null);
  
  // Use ref to track previous files to avoid infinite loops
  const previousFilesRef = useRef<{[key: string]: File | null}>(files);

  // Update local state when data changes - only if actually different
  useEffect(() => {
    const newFiles = {
      cartaIdentita: data.cartaIdentita || null,
      certificatoTriennale: data.certificatoTriennale || null,
      certificatoMagistrale: data.certificatoMagistrale || null,
      pianoStudioTriennale: data.pianoStudioTriennale || null,
      pianoStudioMagistrale: data.pianoStudioMagistrale || null,
      certificatoMedico: data.certificatoMedico || null,
      certificatoNascita: data.certificatoNascita || null,
      diplomoLaurea: data.diplomoLaurea || null,
      pergamenaLaurea: data.pergamenaLaurea || null,
    };
    
    // Only update if there are actual changes compared to ref
    const hasChanges = Object.keys(newFiles).some(key => {
      return newFiles[key as keyof typeof newFiles] !== previousFilesRef.current[key as keyof typeof newFiles];
    });
    
    if (hasChanges) {
      setFiles(newFiles);
      previousFilesRef.current = newFiles;
    }
  }, [data.cartaIdentita, data.certificatoTriennale, data.certificatoMagistrale, data.pianoStudioTriennale, data.pianoStudioMagistrale, data.certificatoMedico, data.certificatoNascita, data.diplomoLaurea, data.pergamenaLaurea]);

  // Load file info from localStorage on mount
  useEffect(() => {
    const savedFileInfo = localStorage.getItem('registrationFormFiles');
    if (savedFileInfo) {
      try {
        const fileInfo = JSON.parse(savedFileInfo);
        setPreviousFileInfo(fileInfo);
      } catch (error) {
        console.error('Error loading file info:', error);
      }
    }
  }, []);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      // Only call onChange if we have actual values to report
      if (onChange && value) {
        onChange(value as Partial<DocumentsForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Auto-save when files change - removed to prevent infinite loop
  // The onChange is now handled directly in handleFileChange

  const handleFileChange = useCallback(async (fieldName: string, file: File | null) => {
    if (file) {
      try {
        // Upload temporaneo per l'iscrizione
        const formData = new FormData();
        formData.append('document', file);
        formData.append('type', fieldName);
        
        const tempUserId = localStorage.getItem('tempUserId') || `temp_${Date.now()}`;
        formData.append('tempUserId', tempUserId);
        localStorage.setItem('tempUserId', tempUserId);

        const response = await fetch('/api/document-upload/temp', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Errore nel caricamento del documento');
        }

        const result = await response.json();
        
        // Salva informazioni del documento temporaneo
        const tempDocuments = JSON.parse(localStorage.getItem('tempDocuments') || '[]');
        // Remove any existing document of the same type
        const filteredDocs = tempDocuments.filter((doc: any) => doc.type !== fieldName);
        filteredDocs.push(result.document);
        localStorage.setItem('tempDocuments', JSON.stringify(filteredDocs));
        
        console.log(`✅ Document ${file.name} uploaded temporarily for field ${fieldName}`);
        
      } catch (error) {
        console.error('Document upload error:', error);
        // Still proceed with local file handling even if upload fails
      }
    }
    
    const updatedFiles = { ...files, [fieldName]: file };
    setFiles(updatedFiles);
    previousFilesRef.current = updatedFiles; // Update ref to prevent loops
    setValue(fieldName as keyof DocumentsForm, file as any);
    
    // Immediately save to parent component
    if (onChange) {
      onChange(updatedFiles as Partial<DocumentsForm>);
    }
  }, [files, setValue, onChange]);

  const onSubmit = (formData: DocumentsForm) => {
    onNext(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Documenti (Opzionali)</h3>
        <p className="text-gray-600 mb-6">
          Puoi caricare i documenti ora oppure in un secondo momento. Tutti i file devono essere in formato PDF, JPG o PNG e non superare i 10MB.
        </p>

        {/* Existing documents section for additional enrollment */}
        {isAdditionalEnrollment && existingDocuments.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-800">
                  📄 Documenti già caricati in precedenza
                </h4>
                <p className="mt-1 text-sm text-green-700 mb-3">
                  Questi documenti sono disponibili dal tuo account e possono essere riutilizzati per questa iscrizione:
                </p>
                <div className="space-y-2">
                  {existingDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-white border border-green-200 rounded-md p-2">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${doc.isVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                        <span className="text-sm font-medium text-green-800">{doc.fileName}</span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          {doc.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-green-600">
                        {doc.isVerified ? '✓ Verificato' : '⏳ In verifica'}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-green-600">
                  💡 Suggerimento: Puoi riutilizzare questi documenti dove applicabile o caricare nuovi file se necessario.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messaggio file precedentemente caricati */}
        {previousFileInfo && Object.values(previousFileInfo).some(info => info !== null) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-blue-800 text-sm font-medium mb-1">File precedentemente caricati</p>
                <p className="text-blue-700 text-sm mb-2">
                  Sono stati trovati file caricati in precedenza. Per motivi di sicurezza dovrai ricaricarli per completare l'iscrizione.
                </p>
                <ul className="text-blue-600 text-sm space-y-1">
                  {previousFileInfo.cartaIdentita && <li>• Carta d'identità: {previousFileInfo.cartaIdentita.name}</li>}
                  {previousFileInfo.certificatoTriennale && <li>• Certificato Triennale: {previousFileInfo.certificatoTriennale.name}</li>}
                  {previousFileInfo.certificatoMagistrale && <li>• Certificato Magistrale: {previousFileInfo.certificatoMagistrale.name}</li>}
                  {previousFileInfo.pianoStudioTriennale && <li>• Piano Studio Triennale: {previousFileInfo.pianoStudioTriennale.name}</li>}
                  {previousFileInfo.pianoStudioMagistrale && <li>• Piano Studio Magistrale: {previousFileInfo.pianoStudioMagistrale.name}</li>}
                  {previousFileInfo.certificatoMedico && <li>• Certificato Medico: {previousFileInfo.certificatoMedico.name}</li>}
                  {previousFileInfo.certificatoNascita && <li>• Certificato Nascita: {previousFileInfo.certificatoNascita.name}</li>}
                  {previousFileInfo.diplomoLaurea && <li>• Diploma di Laurea: {previousFileInfo.diplomoLaurea.name}</li>}
                  {previousFileInfo.pergamenaLaurea && <li>• Pergamena di Laurea: {previousFileInfo.pergamenaLaurea.name}</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Carta d'identità - Per tutti i tipi */}
          <FileUpload
            label="Carta d'Identità"
            description="Fronte e retro della carta d'identità o passaporto in corso di validità"
            accept=".pdf,.jpg,.jpeg,.png"
            value={files.cartaIdentita}
            onChange={(file) => handleFileChange('cartaIdentita', file)}
            error={errors.cartaIdentita?.message as string}
            documentType="cartaIdentita"
            userId={userId}
            templateType={templateType}
          />

          {/* Sezione specifica per Certificazioni */}
          {templateType === 'CERTIFICATION' && (
            <div className="border-l-4 border-green-500 pl-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                </svg>
                Documenti Certificazione
              </h4>
              <div className="space-y-4">
                <FileUpload
                  label="Codice Fiscale / Tessera Sanitaria"
                  description="Tessera sanitaria o documento che attesti il codice fiscale"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={files.certificatoMedico}
                  onChange={(file) => handleFileChange('certificatoMedico', file)}
                  error={errors.certificatoMedico?.message as string}
                  documentType="certificatoMedico"
                  userId={userId}
                  templateType={templateType}
                />
              </div>
            </div>
          )}

          {/* Sezione Certificati di Laurea - only for TFA template */}
          {templateType === 'TFA' && (
            <>
              <div className="border-l-4 border-blue-500 pl-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                  </svg>
                  Certificati di Laurea
                </h4>
                <div className="space-y-4">
                  <FileUpload
                    label="Triennale"
                    description="Certificato di laurea triennale o diploma universitario"
                    accept=".pdf,.jpg,.jpeg,.png"
                    value={files.certificatoTriennale}
                    onChange={(file) => handleFileChange('certificatoTriennale', file)}
                    error={errors.certificatoTriennale?.message as string}
                    documentType="certificatoTriennale"
                    userId={userId}
                    templateType={templateType}
                  />
                  
                  <FileUpload
                    label="Magistrale"
                    description="Certificato di laurea magistrale, specialistica o vecchio ordinamento"
                    accept=".pdf,.jpg,.jpeg,.png"
                    value={files.certificatoMagistrale}
                    onChange={(file) => handleFileChange('certificatoMagistrale', file)}
                    error={errors.certificatoMagistrale?.message as string}
                    documentType="certificatoMagistrale"
                    userId={userId}
                    templateType={templateType}
                  />
                </div>
              </div>

              {/* Sezione Piani di Studio */}
              <div className="border-l-4 border-green-500 pl-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  Piani di Studio
                </h4>
                <div className="space-y-4">
                  <FileUpload
                    label="Triennale"
                    description="Piano di studio della laurea triennale con lista esami sostenuti"
                    accept=".pdf,.jpg,.jpeg,.png"
                    value={files.pianoStudioTriennale}
                    onChange={(file) => handleFileChange('pianoStudioTriennale', file)}
                    error={errors.pianoStudioTriennale?.message as string}
                    documentType="pianoStudioTriennale"
                    userId={userId}
                    templateType={templateType}
                  />
                  
                  <FileUpload
                    label="Magistrale o Vecchio Ordinamento"
                    description="Piano di studio della laurea magistrale, specialistica o vecchio ordinamento"
                    accept=".pdf,.jpg,.jpeg,.png"
                    value={files.pianoStudioMagistrale}
                    onChange={(file) => handleFileChange('pianoStudioMagistrale', file)}
                    error={errors.pianoStudioMagistrale?.message as string}
                    documentType="pianoStudioMagistrale"
                    userId={userId}
                    templateType={templateType}
                  />
                </div>
              </div>
            </>
          )}

          {/* Altri Documenti - only for TFA template */}
          {templateType === 'TFA' && (
            <div className="border-l-4 border-gray-500 pl-6">
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-gray-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Altri Documenti
              </h4>
              <div className="space-y-4">
                <FileUpload
                  label="Certificato Medico di Sana e Robusta Costituzione"
                  description="Certificato medico attestante la sana e robusta costituzione fisica e psichica"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={files.certificatoMedico}
                  onChange={(file) => handleFileChange('certificatoMedico', file)}
                  error={errors.certificatoMedico?.message as string}
                  documentType="certificatoMedico"
                  userId={userId}
                  templateType={templateType}
                />
                
                <FileUpload
                  label="Certificato di Nascita"
                  description="Certificato di nascita o estratto di nascita dal Comune"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={files.certificatoNascita}
                  onChange={(file) => handleFileChange('certificatoNascita', file)}
                  error={errors.certificatoNascita?.message as string}
                  documentType="certificatoNascita"
                  userId={userId}
                  templateType={templateType}
                />
                          
                <FileUpload
                  label="Diploma di Laurea"
                  description="Diploma di laurea (cartaceo o digitale)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={files.diplomoLaurea}
                  onChange={(file) => handleFileChange('diplomoLaurea', file)}
                  error={errors.diplomoLaurea?.message as string}
                  documentType="diplomoLaurea"
                  userId={userId}
                  templateType={templateType}
                />
                
                <FileUpload
                  label="Pergamena di Laurea"
                  description="Pergamena di laurea (documento originale)"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={files.pergamenaLaurea}
                  onChange={(file) => handleFileChange('pergamenaLaurea', file)}
                  error={errors.pergamenaLaurea?.message as string}
                  documentType="pergamenaLaurea"
                  userId={userId}
                  templateType={templateType}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-blue-800 text-sm font-medium mb-1">Informazione</p>
              <ul className="text-blue-700 text-sm space-y-1">
                <li>• Tutti i documenti sono opzionali e possono essere caricati in un secondo momento</li>
                {templateType === 'CERTIFICATION' && (
                  <li>• <strong>Iscrizione Certificazione:</strong> Richiesti solo i documenti essenziali (documento d'identità e codice fiscale)</li>
                )}
                <li>• I documenti devono essere leggibili e in buona qualità</li>
                <li>• Formati accettati: PDF, JPG, PNG</li>
                <li>• Dimensione massima per file: 10MB</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default DocumentsStep;