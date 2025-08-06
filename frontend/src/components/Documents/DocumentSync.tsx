import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface DocumentSyncProps {
  onSyncComplete?: (results: any) => void;
  className?: string;
}

const DocumentSync: React.FC<DocumentSyncProps> = ({ 
  onSyncComplete,
  className = '' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const performSync = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/documents/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const data = await response.json();
      setSyncResults(data.result);
      setLastSync(new Date());
      onSyncComplete?.(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la sincronizzazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <RefreshCw className={`w-5 h-5 text-blue-600 mt-0.5 ${isLoading ? 'animate-spin' : ''}`} />
          <div>
            <h4 className="font-medium text-blue-900">
              Sincronizza Documenti
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              Sincronizza i documenti caricati durante l'iscrizione con la tua area personale
            </p>

            {/* Sync Results */}
            {syncResults && (
              <div className="space-y-2 mb-3">
                {syncResults.enrollmentToRepository > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {syncResults.enrollmentToRepository} documenti sincronizzati dall'iscrizione
                    </span>
                  </div>
                )}
                
                {syncResults.conflicts && syncResults.conflicts.length > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      {syncResults.conflicts.length} conflitti rilevati
                    </span>
                  </div>
                )}

                {syncResults.enrollmentToRepository === 0 && 
                 syncResults.repositoryToEnrollment === 0 && (
                  <div className="flex items-center space-x-2 text-sm text-blue-800">
                    <CheckCircle className="w-4 h-4" />
                    <span>Tutti i documenti sono già sincronizzati</span>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center space-x-2 text-sm text-red-800 mb-3">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Last Sync Info */}
            {lastSync && (
              <p className="text-xs text-blue-600">
                Ultima sincronizzazione: {lastSync.toLocaleString('it-IT')}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={performSync}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isLoading ? 'Sincronizzando...' : 'Sincronizza Ora'}
        </button>
      </div>

      {/* Detailed Results */}
      {syncResults && syncResults.conflicts && syncResults.conflicts.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <h5 className="font-medium text-yellow-900 mb-2">Conflitti Rilevati</h5>
          <ul className="text-sm text-yellow-800 space-y-1">
            {syncResults.conflicts.map((conflict: any, index: number) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-yellow-600">•</span>
                <span>{conflict.message || 'Conflitto non specificato'}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-yellow-700 mt-2">
            I conflitti devono essere risolti manualmente. Contatta il supporto se necessario.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded">
        <h5 className="font-medium text-blue-900 mb-1">Come funziona la sincronizzazione</h5>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• I documenti caricati durante l'iscrizione vengono copiati nella tua area personale</li>
          <li>• Puoi gestire tutti i tuoi documenti da un unico posto</li>
          <li>• I documenti duplicati vengono rilevati automaticamente</li>
          <li>• La sincronizzazione è sicura e non elimina documenti esistenti</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentSync;