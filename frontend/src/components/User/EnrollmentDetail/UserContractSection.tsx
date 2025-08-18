import React, { useState } from 'react';
import api from '../../../services/api';

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

  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/user/download-contract-template/${registration.id}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contratto_precompilato_${registration.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Errore durante il download');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSigned = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/user/download-contract-signed/${registration.id}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contratto_firmato_${registration.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Errore durante il download');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTemplate = async () => {
    try {
      setError(null);
      
      const response = await api.get(`/user/download-contract-template/${registration.id}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Apri in una nuova scheda per l'anteprima
      window.open(url, '_blank');
      
      // Pulisci l'URL dopo un po' (il browser avrà già caricato il PDF)
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Errore durante l\'anteprima');
    }
  };

  const handlePreviewSigned = async () => {
    try {
      setError(null);
      
      const response = await api.get(`/user/download-contract-signed/${registration.id}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Apri in una nuova scheda per l'anteprima
      window.open(url, '_blank');
      
      // Pulisci l'URL dopo un po'
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || 'Errore durante l\'anteprima');
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');

  // Determinare cosa mostrare in base allo status E alla presenza del contratto
  // Il contratto precompilato è disponibile se:
  // 1. Status è avanzato (DATA_VERIFIED+) oppure
  // 2. Il contratto è già stato generato (contractTemplateUrl esiste)
  const canDownloadTemplate = 
    ['DATA_VERIFIED', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status) ||
    !!registration.contractTemplateUrl;
  const canDownloadSigned = ['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status);
  
  // Se non possiamo scaricare nulla, mostra lo stato di preparazione
  if (!canDownloadTemplate && !canDownloadSigned) {
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
        {/* Contratto Precompilato - Sempre visibile se disponibile */}
        {canDownloadTemplate && (
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
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePreviewTemplate}
                disabled={loading}
                className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Anteprima
              </button>
              <button
                onClick={handleDownloadTemplate}
                disabled={loading}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    <span className="text-xs">Scaricando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Scarica
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
              {['DATA_VERIFIED', 'CONTRACT_GENERATED'].includes(registration.status) ? (
                <>
                  ⚠️ <strong>Verifica i tuoi dati:</strong> Controlla attentamente il contratto e contatta il partner se trovi errori o informazioni da correggere
                </>
              ) : (
                <>
                  💡 <strong>Sempre disponibile:</strong> Questo contratto rimane scaricabile dalla tua area riservata
                </>
              )}
            </div>
          </div>
        )}

        {/* Contratto Firmato - Solo quando firmato */}
        {canDownloadSigned && (
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
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handlePreviewSigned}
                disabled={loading}
                className="bg-green-100 text-green-700 px-3 py-2 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Anteprima
              </button>
              <button
                onClick={handleDownloadSigned}
                disabled={loading}
                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    <span className="text-xs">Scaricando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Scarica
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Se abbiamo solo il precompilato, mostra info per il firmato */}
        {canDownloadTemplate && !canDownloadSigned && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-600">Contratto Firmato</h3>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Il contratto firmato sarà disponibile quando il partner avrà completato la firma
            </p>
            
            <div className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg flex items-center justify-center cursor-not-allowed">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              In attesa di firma
            </div>
          </div>
        )}
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
              {['DATA_VERIFIED', 'CONTRACT_GENERATED'].includes(registration.status) && (
                <p>• <strong>⚠️ Importante:</strong> Verifica attentamente tutti i dati prima che il partner proceda con la firma</p>
              )}
              <p>• <strong>Contratto Firmato:</strong> Versione ufficiale firmata dal partner</p>
              <p>• Entrambi i documenti hanno lo stesso valore legale</p>
              <p>• Conserva sempre una copia dei contratti per i tuoi archivi</p>
              {['DATA_VERIFIED', 'CONTRACT_GENERATED'].includes(registration.status) && (
                <p>• <strong>Hai trovato errori?</strong> Contatta immediatamente il tuo partner per le correzioni necessarie</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserContractSection;