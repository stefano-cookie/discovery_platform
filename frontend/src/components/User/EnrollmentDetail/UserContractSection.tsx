import React, { useState } from 'react';

interface UserContractSectionProps {
  registration: {
    id: string;
    status: string;
    contractTemplateUrl?: string;
    contractSignedUrl?: string;
    contractGeneratedAt?: string;
    contractUploadedAt?: string;
  };
}

const UserContractSection: React.FC<UserContractSectionProps> = ({ registration }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get the backend URL from environment or use default
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${BACKEND_URL}/api/user/download-contract-template/${registration.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Errore durante il download del contratto');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contratto_precompilato_${registration.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError('Errore durante il download: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSigned = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${BACKEND_URL}/api/user/download-contract-signed/${registration.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Errore durante il download del contratto firmato');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contratto_firmato_${registration.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError('Errore durante il download: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');

  // Non mostrare la sezione contratti se non siamo almeno allo stato CONTRACT_SIGNED
  if (!['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status)) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contratti</h2>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Contratti in preparazione</h3>
          <p className="text-gray-600">
            I contratti saranno disponibili per il download una volta che il partner avrà completato la preparazione e firma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">I Tuoi Contratti</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contratto Precompilato */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Contratto Precompilato</h3>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Contratto generato automaticamente con i tuoi dati di iscrizione
          </p>
          
          {registration.contractGeneratedAt && (
            <p className="text-xs text-gray-500 mb-3">
              Generato il: {formatDate(registration.contractGeneratedAt)}
            </p>
          )}
          
          <button
            onClick={handleDownloadTemplate}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Scaricando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scarica Contratto
              </>
            )}
          </button>
        </div>

        {/* Contratto Firmato */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Contratto Firmato</h3>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Contratto ufficiale firmato dal partner
          </p>
          
          {registration.contractUploadedAt && (
            <p className="text-xs text-gray-500 mb-3">
              Firmato il: {formatDate(registration.contractUploadedAt)}
            </p>
          )}
          
          <button
            onClick={handleDownloadSigned}
            disabled={loading}
            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Scaricando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scarica Firmato
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">Informazioni sui Contratti</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• <strong>Contratto Precompilato:</strong> Generato automaticamente con i tuoi dati</p>
              <p>• <strong>Contratto Firmato:</strong> Versione ufficiale firmata dal partner</p>
              <p>• Entrambi i documenti hanno lo stesso valore legale</p>
              <p>• Conserva sempre una copia dei contratti per i tuoi archivi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserContractSection;