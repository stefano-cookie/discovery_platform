import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';
import { getUserStatusDisplay } from '../../../utils/statusTranslations';

interface CertificationStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  status: 'pending' | 'current' | 'completed';
}

interface CertificationStepsData {
  registrationId: string;
  currentStatus: string;
  steps: {
    enrollment: CertificationStep;
    payment: CertificationStep;
    documentsApproved: CertificationStep;
    examRegistered: CertificationStep;
    examCompleted: CertificationStep;
  };
}

interface CertificationStepsProps {
  registrationId: string;
}

const CertificationSteps: React.FC<CertificationStepsProps> = ({ registrationId }) => {
  const [certificationData, setCertificationData] = useState<CertificationStepsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  useEffect(() => {
    fetchCertificationSteps();
  }, [registrationId]);

  // Listen per refresh event da altre parti dell'app
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Refreshing certification steps due to external trigger');
      fetchCertificationSteps();
    };

    window.addEventListener('refreshCertificationSteps', handleRefresh);
    return () => window.removeEventListener('refreshCertificationSteps', handleRefresh);
  }, [registrationId]);

  const fetchCertificationSteps = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      
      const response = await apiRequest<CertificationStepsData>({
        method: 'GET',
        url: `/user/certification-steps/${registrationId}`
      });
      
      // Aggiorna solo se i dati sono cambiati
      const dataChanged = !certificationData || 
        JSON.stringify(response) !== JSON.stringify(certificationData);
      
      if (dataChanged) {
        console.log('Certification steps data changed, updating state:', response);
        setCertificationData(response);
        setLastUpdate(Date.now());
      } else if (silent) {
        console.log('No changes detected in certification steps');
      }
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento steps certificazione');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });


  const getStepIcon = (step: CertificationStep) => {
    if (step.status === 'completed') {
      return (
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    if (step.status === 'current') {
      return (
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-white font-bold">{step.step}</span>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
        <span className="text-gray-600 font-bold">{step.step}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-6">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !certificationData) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600">{error || 'Impossibile caricare gli step certificazione'}</p>
      </div>
    );
  }

  const steps = Object.values(certificationData.steps);
  const currentStepIndex = steps.findIndex(s => s.status === 'current');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Steps Certificazione - Workflow Completo</h3>
        <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
          Stato Attuale: {getUserStatusDisplay(certificationData.currentStatus)}
        </span>
      </div>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-300"></div>
        {currentStepIndex > -1 && (
          <div 
            className="absolute left-5 top-5 w-0.5 bg-green-500 transition-all duration-500"
            style={{ height: `${currentStepIndex * 120}px` }}
          ></div>
        )}

        {/* Steps */}
        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={step.step} className="flex items-start space-x-4">
              <div className="relative z-10">
                {getStepIcon(step)}
              </div>
              <div className="flex-1">
                <h4 className={`font-semibold mb-1 ${
                  step.status === 'completed' ? 'text-green-700' :
                  step.status === 'current' ? 'text-blue-700' :
                  'text-gray-500'
                }`}>
                  {step.title}
                </h4>
                <p className={`text-sm mb-1 ${
                  step.status === 'completed' ? 'text-green-600' :
                  step.status === 'current' ? 'text-blue-600' :
                  'text-gray-400'
                }`}>
                  {step.description}
                </p>
                {step.completed && step.completedAt && (
                  <p className="text-xs text-gray-500">
                    Completato il {formatDate(step.completedAt)}
                  </p>
                )}
                {step.status === 'current' && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      {step.step === 2 && 'In attesa del completamento del pagamento tramite bonifico bancario'}
                      {step.step === 3 && 'Il partner sta verificando i tuoi documenti (carta d\'identità e tessera sanitaria)'}
                      {step.step === 4 && 'Il partner sta registrando la tua iscrizione all\'esame'}
                      {step.step === 5 && 'In attesa che tu sostenga l\'esame di certificazione'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Info */}
      {certificationData.currentStatus === 'COMPLETED' && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-green-900">Certificazione Completata!</h4>
              <p className="text-sm text-green-700 mt-1">
                Hai completato con successo tutti gli step del processo di certificazione.
              </p>
            </div>
          </div>
        </div>
      )}

      {certificationData.currentStatus === 'PENDING' && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-1">Prossimo Step: Pagamento</h4>
              <p className="text-xs text-yellow-700">
                Per procedere con la certificazione, effettua il pagamento tramite bonifico bancario seguendo le istruzioni fornite dal partner.
              </p>
            </div>
          </div>
        </div>
      )}

      {certificationData.currentStatus === 'ENROLLED' && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-900 mb-1">Documenti da caricare</h4>
              <p className="text-xs text-yellow-700">
                Assicurati di aver caricato i seguenti documenti nella sezione dedicata:
              </p>
              <ul className="mt-2 text-xs text-yellow-700 space-y-1">
                <li>• Carta d'Identità (fronte e retro)</li>
                <li>• Tessera Sanitaria (fronte e retro)</li>
              </ul>
              <p className="text-xs text-yellow-700 mt-2">
                Una volta caricati, il partner procederà con la verifica.
              </p>
            </div>
          </div>
        </div>
      )}

      {certificationData.currentStatus === 'DOCUMENTS_APPROVED' && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">Documenti Approvati</h4>
              <p className="text-xs text-blue-700">
                I tuoi documenti sono stati verificati con successo. Il partner procederà ora con la registrazione all'esame di certificazione.
              </p>
            </div>
          </div>
        </div>
      )}

      {certificationData.currentStatus === 'EXAM_REGISTERED' && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">Iscrizione all'Esame Confermata</h4>
              <p className="text-xs text-blue-700">
                Sei ufficialmente iscritto all'esame di certificazione. Riceverai ulteriori informazioni dal partner riguardo data, ora e luogo dell'esame.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificationSteps;