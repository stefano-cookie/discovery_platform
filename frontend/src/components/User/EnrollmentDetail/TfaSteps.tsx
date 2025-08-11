import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';

interface TfaStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  passed?: boolean;
  documentUrl?: string;
  status: 'pending' | 'current' | 'completed';
}

interface TfaStepsData {
  registrationId: string;
  currentStatus: string;
  steps: {
    cnredRelease: TfaStep;
    finalExam: TfaStep;
    recognitionRequest: TfaStep;
    finalCompletion: TfaStep;
  };
}

interface TfaStepsProps {
  registrationId: string;
}

const TfaSteps: React.FC<TfaStepsProps> = ({ registrationId }) => {
  const [tfaData, setTfaData] = useState<TfaStepsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTfaSteps();
  }, [registrationId]);

  const fetchTfaSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest<TfaStepsData>({
        method: 'GET',
        url: `/user/tfa-steps/${registrationId}`
      });
      
      setTfaData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento steps TFA');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });

  const getStepIcon = (step: TfaStep) => {
    if (step.completed) {
      return (
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    } else if (step.status === 'current') {
      return (
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-gray-500 font-medium">{step.step}</span>
        </div>
      );
    }
  };

  const getConnector = (step: TfaStep, isLast: boolean) => {
    if (isLast) return null;
    
    return (
      <div className={`w-px h-12 ml-5 ${step.completed ? 'bg-green-400' : 'bg-gray-300'}`} />
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-6">
          {[1,2,3,4].map((i) => (
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

  if (error || !tfaData) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-600">{error || 'Impossibile caricare i steps TFA'}</p>
      </div>
    );
  }

  const steps = Object.values(tfaData.steps);

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'In Attesa';
      case 'CONTRACT_GENERATED': return 'Contratto Generato';
      case 'CONTRACT_SIGNED': return 'Contratto Firmato';
      case 'ENROLLED': return 'Attivo';
      case 'CNRED_RELEASED': return 'CNRED Rilasciato';
      case 'FINAL_EXAM': return 'Esame Finale';
      case 'RECOGNITION_REQUEST': return 'Richiesta Riconoscimento';
      case 'COMPLETED': return 'Completato';
      default: return status;
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Percorso TFA</h3>
      <p className="text-sm text-gray-600 mb-6">
        Il tuo partner gestirà i seguenti step del percorso TFA. Riceverai notifiche email ad ogni completamento.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg">
        {steps.map((step, index) => (
          <div key={step.step} className={`p-4 flex items-center ${index < steps.length - 1 ? 'border-b border-gray-200' : ''}`}>
            <div className="flex-shrink-0 mr-4">
              {getStepIcon(step)}
            </div>
            
            <div className="flex-1">
              <h4 className={`font-medium ${step.completed ? 'text-green-900' : step.status === 'current' ? 'text-blue-900' : 'text-gray-900'}`}>
                {step.title}
              </h4>
              <p className="text-sm text-gray-600">
                {step.description}
              </p>
              
              {step.completed && step.completedAt && (
                <p className="text-xs text-green-600 mt-1">
                  Completato il {formatDate(step.completedAt)}
                </p>
              )}
              
              {step.status === 'current' && !step.completed && (
                <p className="text-xs text-blue-600 mt-1">
                  In corso - il partner sta lavorando su questo step
                </p>
              )}
              
              {step.step === 2 && step.completed && step.passed !== undefined && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                  step.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {step.passed ? '✓ Esame superato' : '○ Esame registrato'}
                </span>
              )}
            </div>

            <div className="flex-shrink-0">
              {step.completed && (
                <span className="text-green-600 font-medium text-sm">
                  Completato
                </span>
              )}
              {step.status === 'current' && !step.completed && (
                <span className="text-blue-600 font-medium text-sm">
                  In corso
                </span>
              )}
              {step.status === 'pending' && (
                <span className="text-gray-400 font-medium text-sm">
                  In attesa
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex">
          <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p>
              <strong>Stato attuale:</strong> {getStatusDisplayText(tfaData.currentStatus)} - 
              Tutti gli step sono gestiti automaticamente dal tuo partner di riferimento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TfaSteps;