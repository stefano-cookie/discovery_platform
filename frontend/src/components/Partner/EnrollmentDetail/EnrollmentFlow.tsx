import React, { useState } from 'react';
import ContractUpload from './ContractUpload';
import ContractPreview from './ContractPreview';

interface EnrollmentFlowProps {
  status: string;
  registrationId: string;
}

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
}

const EnrollmentFlow: React.FC<EnrollmentFlowProps> = ({ status, registrationId }) => {
  const [currentStatus, setCurrentStatus] = useState(status);

  const handleContractUploadSuccess = () => {
    setCurrentStatus('CONTRACT_SIGNED');
    // Optionally trigger a page refresh or data refetch
    window.location.reload();
  };

  const handleContractDownload = async () => {
    try {
      const response = await fetch(`/api/partners/download-contract/${registrationId}`, {
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
      link.download = `contratto_${registrationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert('Errore durante il download: ' + error.message);
    }
  };
  // Definisco gli step del workflow
  const getFlowSteps = (): FlowStep[] => {
    const steps: FlowStep[] = [
      {
        id: 'pending',
        title: 'Iscrizione Completata',
        description: 'L\'utente ha completato il form di iscrizione',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        status: 'completed' // Sempre completato se arriviamo qui
      },
      {
        id: 'contract_generated',
        title: 'Contratto Precompilato',
        description: 'Contratto generato automaticamente e pronto per il download',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        status: currentStatus === 'PENDING' ? 'current' : 'completed'
      },
      {
        id: 'contract_signed',
        title: 'Contratto Firmato',
        description: 'Upload del contratto firmato dal partner',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        ),
        status: currentStatus === 'PENDING' ? 'pending' : 
               currentStatus === 'CONTRACT_GENERATED' ? 'current' :
               currentStatus === 'CONTRACT_SIGNED' ? 'completed' : 'completed'
      },
      {
        id: 'payment',
        title: 'Pagamento Completato',
        description: 'Pagamento ricevuto (automatico via fatture)',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        ),
        status: currentStatus === 'ENROLLED' ? 'current' : 
               currentStatus === 'COMPLETED' ? 'completed' : 'pending'
      },
      {
        id: 'completed',
        title: 'Iscrizione Completata',
        description: 'L\'utente è ufficialmente iscritto al corso',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ),
        status: currentStatus === 'COMPLETED' ? 'completed' : 'pending'
      }
    ];

    return steps;
  };

  const steps = getFlowSteps();

  const getStepStyles = (stepStatus: string) => {
    switch (stepStatus) {
      case 'completed':
        return {
          container: 'bg-green-50 border-green-200',
          icon: 'bg-green-100 text-green-600',
          title: 'text-green-900',
          description: 'text-green-700',
          connector: 'bg-green-300'
        };
      case 'current':
        return {
          container: 'bg-blue-50 border-blue-200 ring-2 ring-blue-300',
          icon: 'bg-blue-100 text-blue-600',
          title: 'text-blue-900',
          description: 'text-blue-700',
          connector: 'bg-gray-300'
        };
      case 'pending':
      default:
        return {
          container: 'bg-gray-50 border-gray-200',
          icon: 'bg-gray-100 text-gray-400',
          title: 'text-gray-500',
          description: 'text-gray-400',
          connector: 'bg-gray-300'
        };
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-col md:flex-row md:justify-between space-y-4 md:space-y-0 md:space-x-4">
        {steps.map((step, index) => {
          const styles = getStepStyles(step.status);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="relative flex-1">
              {/* Connector Line - Only on desktop and not for last item */}
              {!isLast && (
                <div className="hidden md:block absolute top-12 left-full w-4 h-0.5 transform translate-x-2">
                  <div className={`h-full ${styles.connector}`}></div>
                </div>
              )}

              {/* Step Content */}
              <div className={`relative p-4 rounded-lg border transition-all duration-200 ${styles.container}`}>
                {/* Step Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${styles.icon}`}>
                  {step.icon}
                </div>

                {/* Step Content */}
                <div>
                  <h4 className={`font-semibold text-sm mb-1 ${styles.title}`}>
                    {step.title}
                  </h4>
                  <p className={`text-xs leading-relaxed ${styles.description}`}>
                    {step.description}
                  </p>
                </div>

                {/* Current Step Indicator */}
                {step.status === 'current' && (
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>

              {/* Mobile Connector - Vertical line for mobile */}
              {!isLast && (
                <div className="md:hidden flex justify-center py-2">
                  <div className="w-0.5 h-6 bg-gray-300"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contract Management Section - Show when status is PENDING or CONTRACT_GENERATED */}
      {(currentStatus === 'PENDING' || currentStatus === 'CONTRACT_GENERATED') && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Gestione Contratto</h4>
            <p className="text-sm text-gray-600">
              {currentStatus === 'PENDING' && 'Il contratto è stato generato automaticamente e può essere scaricato.'}
              {currentStatus === 'CONTRACT_GENERATED' && 'Scarica il contratto precompilato e carica quello firmato.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Download Contract Box with Preview */}
            <ContractPreview 
              registrationId={registrationId}
              onDownload={handleContractDownload}
            />

            {/* Upload Signed Contract Box */}
            <ContractUpload 
              registrationId={registrationId} 
              onUploadSuccess={handleContractUploadSuccess}
            />
          </div>

          {/* Status Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Stato Attuale: {currentStatus === 'PENDING' ? 'Contratto Disponibile' : 'In Attesa Firma'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {currentStatus === 'PENDING' && 'Una volta caricato il contratto firmato, l\'iscrizione passerà automaticamente al passo successivo.'}
                  {currentStatus === 'CONTRACT_GENERATED' && 'Carica il contratto firmato per completare questo passaggio.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Status Actions */}
      {currentStatus !== 'PENDING' && currentStatus !== 'CONTRACT_GENERATED' && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Stato Corrente</h4>
              <p className="text-sm text-gray-600 mt-1">
                {currentStatus === 'CONTRACT_SIGNED' && 'Contratto firmato caricato. In attesa del pagamento.'}
                {currentStatus === 'ENROLLED' && 'Attendi il pagamento dell\'utente'}
                {currentStatus === 'COMPLETED' && 'Iscrizione completata con successo'}
              </p>
            </div>
            
            {currentStatus === 'COMPLETED' && (
              <div className="flex items-center text-green-600">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Completato
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentFlow;