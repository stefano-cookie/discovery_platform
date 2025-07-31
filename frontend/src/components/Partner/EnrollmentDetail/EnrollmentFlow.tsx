import React from 'react';

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
  // Definisco gli step del workflow
  const getFlowSteps = (): FlowStep[] => {
    const steps: FlowStep[] = [
      {
        id: 'pending',
        title: 'Iscrizione Ricevuta',
        description: 'L\'utente ha completato il form di iscrizione',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        status: 'completed' // Sempre completato se arriviamo qui
      },
      {
        id: 'contract',
        title: 'Contratto da Generare',
        description: 'Genera e invia il contratto precompilato all\'utente',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        status: status === 'PENDING' ? 'current' : 'completed'
      },
      {
        id: 'signed',
        title: 'Contratto Firmato',
        description: 'Upload del contratto firmato dall\'utente',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        status: status === 'PENDING' ? 'pending' : 
               status === 'ENROLLED' ? 'current' : 'completed'
      },
      {
        id: 'enrolled',
        title: 'Utente Iscritto',
        description: 'L\'utente è ufficialmente iscritto al corso',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        status: status === 'COMPLETED' ? 'completed' : 
               status === 'ENROLLED' ? 'completed' : 'pending'
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

      {/* Action Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Prossima Azione</h4>
            <p className="text-sm text-gray-600 mt-1">
              {status === 'PENDING' && 'Genera il contratto per procedere con l\'iscrizione'}
              {status === 'ENROLLED' && 'Attendi il pagamento dell\'utente'}
              {status === 'COMPLETED' && 'Iscrizione completata con successo'}
            </p>
          </div>
          
          {status === 'PENDING' && (
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Genera Contratto
            </button>
          )}
          
          {status === 'ENROLLED' && (
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Registra Pagamento
            </button>
          )}
          
          {status === 'COMPLETED' && (
            <div className="flex items-center text-green-600">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Completato
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrollmentFlow;