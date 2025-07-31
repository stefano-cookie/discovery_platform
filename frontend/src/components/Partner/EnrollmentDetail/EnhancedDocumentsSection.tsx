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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'CARTA_IDENTITA': 'Carta d\'Identità',
      'TESSERA_SANITARIA': 'Tessera Sanitaria', 
      'DIPLOMA_LAUREA': 'Diploma di Laurea',
      'PERGAMENA_LAUREA': 'Pergamena di Laurea',
      'CERTIFICATO_MEDICO': 'Certificato Medico',
      'CONTRATTO': 'Contratto',
      'ALTRO': 'Altro'
    };
    return labels[type] || type;
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
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Documenti</h2>
            <p className="text-sm text-gray-600">
              {uploadedCount} di {totalCount} documenti necessari caricati
            </p>
          </div>
        </div>
        
        {/* Progress Circle */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-gray-200"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              className={completionPercentage === 100 ? "text-green-500" : "text-orange-500"}
              strokeDasharray={`${completionPercentage}, 100`}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-900">{completionPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Registration Documents */}
      <div className="mb-8">
        <h3 className="text-md font-medium text-gray-900 mb-4">Documenti per questa iscrizione</h3>
        <div className="space-y-3">
          {documents.map((doc, index) => (
            <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
              doc.uploaded ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center">
                {getDocumentIcon(doc.type, doc.uploaded)}
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                  {doc.uploaded && doc.uploadedAt && (
                    <p className="text-xs text-gray-500">
                      Caricato il {formatDate(doc.uploadedAt)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {doc.uploaded ? (
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Caricato
                    </span>
                    {doc.uploaded && doc.fileName && (
                      <button
                        onClick={() => {
                          // TODO: Implementare download tramite API endpoint
                          console.log('Download documento:', doc.id);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Scarica
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Non caricato
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All User Documents */}
      {userDocuments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-medium text-gray-900">Tutti i documenti dell'utente</h3>
            <span className="text-sm text-gray-500">{userDocuments.length} documento{userDocuments.length !== 1 ? 'i' : ''}</span>
          </div>
          <div className="space-y-3">
            {userDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-blue-50 border-blue-200">
                <div className="flex items-center">
                  {getDocumentIcon(doc.type, true)}
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{getDocumentTypeLabel(doc.type)}</p>
                    <p className="text-xs text-gray-500">
                      {doc.fileName} • Caricato il {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {doc.isVerified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ Verificato
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ⏳ In attesa
                    </span>
                  )}
                  <button
                    onClick={() => handlePreviewUserDocument(doc.id, doc.fileName)}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium mr-2"
                  >
                    Anteprima
                  </button>
                  <button
                    onClick={() => handleDownloadUserDocument(doc.id, doc.fileName)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Scarica
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {userDocuments.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm border-t border-gray-200 mt-4 pt-4">
          L'utente non ha ancora caricato documenti nel repository personale
        </div>
      )}
    </div>
  );
};

export default EnhancedDocumentsSection;