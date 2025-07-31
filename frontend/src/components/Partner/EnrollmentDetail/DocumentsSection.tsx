import React from 'react';
import { PartnerUser } from '../../../types/partner';

interface DocumentsSectionProps {
  user: PartnerUser;
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({ user }) => {
  // Mock data per i documenti - in futuro verrà dall'API
  const documents = [
    {
      id: '1',
      name: 'Documento d\'Identità',
      type: 'identity',
      uploaded: true,
      url: '#',
      uploadDate: '2024-01-15'
    },
    {
      id: '2',
      name: 'Codice Fiscale',
      type: 'tax_code',
      uploaded: true,
      url: '#',
      uploadDate: '2024-01-15'
    },
    {
      id: '3',
      name: 'Diploma di Laurea',
      type: 'degree',
      uploaded: user.offerType === 'TFA',
      url: user.offerType === 'TFA' ? '#' : null,
      uploadDate: user.offerType === 'TFA' ? '2024-01-15' : null
    },
    {
      id: '4',
      name: 'Certificato di Servizio',
      type: 'service',
      uploaded: user.offerType === 'TFA',
      url: user.offerType === 'TFA' ? '#' : null,
      uploadDate: user.offerType === 'TFA' ? '2024-01-15' : null
    }
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getDocumentIcon = (type: string, uploaded: boolean) => {
    const iconClass = uploaded ? 'text-green-600' : 'text-gray-400';
    
    switch (type) {
      case 'identity':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
          </svg>
        );
      case 'tax_code':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'degree':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case 'service':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      default:
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  // Filtra documenti in base al tipo di offerta
  const relevantDocuments = documents.filter(doc => {
    if (user.offerType === 'CERTIFICAZIONI') {
      return ['identity', 'tax_code'].includes(doc.type);
    }
    return true; // Per TFA mostra tutti i documenti
  });

  const uploadedCount = relevantDocuments.filter(doc => doc.uploaded).length;
  const totalCount = relevantDocuments.length;

  return (
    <div className="space-y-6">
      {/* Documenti Caricati */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Documenti</h3>
              <p className="text-sm text-gray-600">
                {uploadedCount} di {totalCount} caricati
              </p>
            </div>
          </div>

          {/* Progress Circle */}
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke={uploadedCount === totalCount ? "#10b981" : "#f59e0b"}
                strokeWidth="4"
                strokeDasharray={`${(uploadedCount / totalCount) * 125.6} 125.6`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-700">
                {Math.round((uploadedCount / totalCount) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Lista Documenti */}
        <div className="space-y-3">
          {relevantDocuments.map((document) => (
            <div
              key={document.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                document.uploaded
                  ? 'bg-green-50 border-green-200 hover:bg-green-100'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center">
                <div className="mr-3">
                  {getDocumentIcon(document.type, document.uploaded)}
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    document.uploaded ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {document.name}
                  </p>
                  {document.uploaded && document.uploadDate && (
                    <p className="text-xs text-gray-500">
                      Caricato il {formatDate(document.uploadDate)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {document.uploaded ? (
                  <>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Visualizza
                    </button>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                      Elimina
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">
                    Non caricato
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {uploadedCount < totalCount && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Documenti mancanti
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Contatta l'utente per completare il caricamento dei documenti richiesti.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Azioni Rapide</h3>
        
        <div className="space-y-3">
          <button className="w-full flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Invia Messaggio
          </button>
          
          <button className="w-full flex items-center justify-center px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Chiama Utente
          </button>
          
          <button className="w-full flex items-center justify-center px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Genera Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentsSection;