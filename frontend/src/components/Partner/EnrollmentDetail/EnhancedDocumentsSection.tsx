import React, { useState, useEffect } from 'react';
import { PartnerUser, RegistrationDocuments } from '../../../types/partner';
import { partnerService } from '../../../services/partner';
import { apiRequest } from '../../../services/api';

interface UserDocument {
  id: string;
  type: string;
  fileName: string;
  isVerified: boolean;
  uploadedAt: string;
}

interface EnhancedDocumentsSectionProps {
  user: PartnerUser;
}

const EnhancedDocumentsSection: React.FC<EnhancedDocumentsSectionProps> = ({ user }) => {
  const [documentsData, setDocumentsData] = useState<RegistrationDocuments | null>(null);
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllDocuments();
  }, [user.registrationId, user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAllDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch registration documents and user documents in parallel
      const [registrationDocs, userDocs] = await Promise.all([
        partnerService.getRegistrationDocuments(user.registrationId),
        apiRequest<{ documents: UserDocument[] }>({
          method: 'GET',
          url: `/partners/users/${user.id}/documents`
        }).catch(() => ({ documents: [] })) // Fallback for compatibility
      ]);
      
      setDocumentsData(registrationDocs);
      setUserDocuments(userDocs.documents || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento documenti');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadUserDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/partners/users/${user.id}/documents/${documentId}/download`, {
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
      console.error('Error downloading document:', err);
      alert('Errore nel download del documento');
    }
  };

  const handlePreviewUserDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/partners/users/${user.id}/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Errore nel caricamento');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Apri in una nuova finestra per la preview
      window.open(url, '_blank');
      
      // Cleanup dopo un po' di tempo
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err: any) {
      console.error('Error previewing document:', err);
      alert('Errore nella preview del documento');
    }
  };

  const handlePreviewRegistrationDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/partners/users/${user.id}/documents/${documentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Errore nel caricamento');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Apri in una nuova finestra per la preview
      window.open(url, '_blank');
      
      // Cleanup dopo un po' di tempo
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10000);
    } catch (err: any) {
      console.error('Error previewing registration document:', err);
      alert('Errore nella preview del documento');
    }
  };

  const handleDownloadRegistrationDocument = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/partners/users/${user.id}/documents/${documentId}/download`, {
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
      console.error('Error downloading registration document:', err);
      alert('Errore nel download del documento');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getDocumentTypeLabel = (type: string) => {
    // Consistent labels matching the user dashboard
    const labels: Record<string, string> = {
      // Backend document types (standardized format)
      'CARTA_IDENTITA': 'Carta d\'Identità',
      'TESSERA_SANITARIA': 'Tessera Sanitaria / Codice Fiscale',
      'CERTIFICATO_TRIENNALE': 'Certificato Laurea Triennale',
      'CERTIFICATO_MAGISTRALE': 'Certificato Laurea Magistrale', 
      'PIANO_STUDIO_TRIENNALE': 'Piano di Studio Triennale',
      'PIANO_STUDIO_MAGISTRALE': 'Piano di Studio Magistrale',
      'CERTIFICATO_MEDICO': 'Certificato Medico',
      'CERTIFICATO_NASCITA': 'Certificato di Nascita',
      'DIPLOMA_LAUREA': 'Diploma di Laurea',
      'PERGAMENA_LAUREA': 'Pergamena di Laurea',
      'DIPLOMA_MATURITA': 'Diploma di Maturità',
      'CONTRATTO': 'Contratto',
      'ALTRO': 'Altro',
      
      // Form field names for compatibility
      'cartaIdentita': 'Carta d\'Identità',
      'certificatoTriennale': 'Certificato Laurea Triennale',
      'certificatoMagistrale': 'Certificato Laurea Magistrale',
      'pianoStudioTriennale': 'Piano di Studio Triennale',
      'pianoStudioMagistrale': 'Piano di Studio Magistrale',
      'certificatoMedico': 'Certificato Medico',
      'certificatoNascita': 'Certificato di Nascita',
      'diplomoLaurea': 'Diploma di Laurea',
      'pergamenaLaurea': 'Pergamena di Laurea'
    };
    return labels[type] || type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const getDocumentIcon = (type: string, uploaded: boolean) => {
    const iconClass = uploaded ? 'text-green-600' : 'text-gray-400';
    
    return (
      <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3 animate-pulse">
              <div className="w-5 h-5 bg-orange-300 rounded"></div>
            </div>
            <div>
              <div className="h-5 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !documentsData) {
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
            onClick={fetchAllDocuments}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  const documents = documentsData.documents;
  const uploadedCount = documentsData.uploadedCount;
  const totalCount = documentsData.totalCount;
  const completionPercentage = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;

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

        {/* Registration Documents Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l3 3m-3-3h12" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Documenti Richiesti per TFA</h3>
                <p className="text-sm text-gray-500">Documenti specifici per questa tipologia di corso</p>
              </div>
            </div>
            <button
              onClick={fetchAllDocuments}
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
            {documents.map((doc, index) => (
              <div key={index} className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md ${
                doc.uploaded 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:border-green-300' 
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
                        <h4 className="text-base font-semibold text-gray-900 mb-1">{doc.name}</h4>
                        {doc.description && (
                          <p className="text-sm text-gray-600 mb-2 leading-relaxed">{doc.description}</p>
                        )}
                        {doc.uploaded && doc.uploadedAt && (
                          <div className="flex items-center text-xs text-gray-500">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Caricato il {formatDate(doc.uploadedAt)}
                          </div>
                        )}
                      </div>
                    </div>
              
                    <div className="flex flex-col items-end space-y-3">
                      {/* Status Badges */}
                      <div className="flex items-center space-x-2">
                        {doc.uploaded ? (
                          <>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Caricato
                            </span>
                            {doc.isVerified && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Verificato
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            Non caricato
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {doc.uploaded && doc.documentId && doc.fileName && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handlePreviewRegistrationDocument(doc.documentId!, doc.fileName!)}
                            className="inline-flex items-center px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Anteprima
                          </button>
                          <button
                            onClick={() => handleDownloadRegistrationDocument(doc.documentId!, doc.fileName!)}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Scarica
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All User Documents Section */}
        {userDocuments.length > 0 && (
          <div className="border-t border-gray-200 pt-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 7a2 2 0 002-2h10a2 2 0 002 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Repository Documenti Utente</h3>
                  <p className="text-sm text-gray-500">{userDocuments.length} documento{userDocuments.length !== 1 ? 'i' : ''} disponibili</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              {userDocuments.map((doc) => (
                <div key={doc.id} className="group rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 hover:shadow-sm transition-all duration-200">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                          {getDocumentIcon(doc.type, true)}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">{getDocumentTypeLabel(doc.type)}</h4>
                          <p className="text-xs text-gray-500 flex items-center mt-1">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {doc.fileName}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center mt-0.5">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Caricato
                        </span>
                        {doc.isVerified && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Verificato
                          </span>
                        )}
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handlePreviewUserDocument(doc.id, doc.fileName)}
                            className="inline-flex items-center px-2 py-1 border border-purple-300 rounded-md text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Vista
                          </button>
                          <button
                            onClick={() => handleDownloadUserDocument(doc.id, doc.fileName)}
                            className="inline-flex items-center px-2 py-1 border border-blue-300 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors duration-200"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3" />
                            </svg>
                            Scarica
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </div>
      )}

        {userDocuments.length === 0 && (
          <div className="border-t border-gray-200 pt-8">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun documento aggiuntivo</h4>
              <p className="text-gray-500 max-w-md mx-auto">
                L'utente non ha ancora caricato altri documenti nel repository personale oltre a quelli richiesti per l'iscrizione.
              </p>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6">
          <div className="grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 flex items-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-indigo-900">🔄 Sincronizzazione</h4>
                <p className="text-sm text-indigo-700">Sistema automatico</p>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-indigo-700">Form TFA sincronizzato</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-indigo-700">Repository automatico</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-indigo-700">Preview immediata</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-indigo-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-indigo-700">Refresh manuale</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDocumentsSection;