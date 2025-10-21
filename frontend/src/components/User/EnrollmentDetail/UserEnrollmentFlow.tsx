import React from 'react';
import { getUserStatusMessage } from '../../../utils/statusMessages';

interface CertificationStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  status: 'completed' | 'current' | 'pending';
}

interface UserEnrollmentFlowProps {
  status: string;
  registration: any;
}

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
}

const UserEnrollmentFlow: React.FC<UserEnrollmentFlowProps> = ({ status, registration }) => {
  // Definisco gli step del workflow per l'utente
  const getFlowSteps = (): FlowStep[] => {
    // Per CERTIFICATION, usa gli step dal backend se disponibili
    if (registration?.offerType === 'CERTIFICATION' && registration?.steps) {
      const backendSteps = registration.steps;
      const steps: FlowStep[] = [
        {
          id: 'enrollment',
          title: backendSteps.enrollment?.title || 'Iscrizione Completata',
          description: backendSteps.enrollment?.description || 'Hai completato con successo il form di iscrizione',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          status: backendSteps.enrollment?.status || 'completed'
        },
        {
          id: 'payment',
          title: backendSteps.payment?.title || 'Pagamento',
          description: backendSteps.payment?.description || 'Pagamento tramite bonifico bancario',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          ),
          status: backendSteps.payment?.status || 'pending'
        },
        {
          id: 'documents_approved',
          title: backendSteps.documentsApproved?.title || 'Documenti Approvati',
          description: backendSteps.documentsApproved?.description || 'Carta d\'identità e tessera sanitaria verificate',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          status: backendSteps.documentsApproved?.status || 'pending'
        },
        {
          id: 'exam_registered',
          title: backendSteps.examRegistered?.title || 'Iscritto all\'Esame',
          description: backendSteps.examRegistered?.description || 'Iscrizione all\'esame di certificazione confermata',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          status: backendSteps.examRegistered?.status || 'pending'
        },
        {
          id: 'exam_completed',
          title: backendSteps.examCompleted?.title || 'Esame Sostenuto',
          description: backendSteps.examCompleted?.description || 'Esame di certificazione completato con successo',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          ),
          status: backendSteps.examCompleted?.status || 'pending'
        }
      ];
      return steps;
    }

    // Per TFA_ROMANIA, mantieni il flusso con contratti
    const steps: FlowStep[] = [
      {
        id: 'pending',
        title: 'Iscrizione Eseguita',
        description: 'Hai completato con successo il form di iscrizione',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        status: 'completed' // Sempre completato se arriviamo qui
      },
      {
        id: 'contract_generated',
        title: 'Contratti Preparati',
        description: 'Il partner sta preparando i documenti contrattuali',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        status: status === 'PENDING' ? 'current' : 'completed'
      },
      {
        id: 'contract_signed',
        title: 'Contratti Firmati',
        description: 'Il partner ha caricato i contratti firmati - ora puoi visualizzarli',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        ),
        status: status === 'PENDING' ? 'pending' : 
               status === 'CONTRACT_GENERATED' ? 'current' :
               ['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(status) ? 'completed' : 'pending'
      },
      {
        id: 'payment',
        title: 'Pagamento',
        description: 'Effettua il pagamento tramite bonifico bancario',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        ),
        status: status === 'CONTRACT_SIGNED' ? 'current' : 
               ['ENROLLED', 'COMPLETED'].includes(status) ? 'completed' : 'pending'
      },
      {
        id: 'completed',
        title: 'Iscrizione Attiva',
        description: 'La tua iscrizione è completata e attiva',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ),
        status: ['ENROLLED', 'COMPLETED'].includes(status) ? 'completed' : 'pending'
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

      {/* Status-specific Information */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Stato Attuale</h4>
            <p className="text-sm text-gray-600">
              {getUserStatusMessage(status, registration?.offerType)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserEnrollmentFlow;