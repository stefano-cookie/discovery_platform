import React, { useState } from 'react';
import ContractUpload from './ContractUpload';
import ContractPreview from './ContractPreview';
import { getPartnerStatusMessage } from '../../../utils/statusMessages';

interface EnrollmentFlowProps {
  status: string;
  registrationId: string;
  offerType?: string;
  examDate?: string;
}

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'pending';
}

const EnrollmentFlow: React.FC<EnrollmentFlowProps> = ({ status, registrationId, offerType, examDate }) => {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentExamDate, setCurrentExamDate] = useState(examDate);
  const [isSettingExamDate, setIsSettingExamDate] = useState(false);
  const [examDateInput, setExamDateInput] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  // Update currentStatus when status prop changes
  React.useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  // Update currentExamDate when examDate prop changes
  React.useEffect(() => {
    setCurrentExamDate(examDate);
  }, [examDate]);

  const handleContractUploadSuccess = () => {
    setCurrentStatus('CONTRACT_SIGNED');
    // Optionally trigger a page refresh or data refetch
    window.location.reload();
  };

  const handleContractDownload = async () => {
    try {
      // Use correct backend URL
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/partners/download-contract/${registrationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('partnerToken') || localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // Parse error message from backend
        let errorMessage = 'Errore durante il download del contratto';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response is not JSON, use default message
        }
        throw new Error(errorMessage);
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
      console.error('Contract download error:', error);
      alert('Errore durante il download: ' + error.message);
    }
  };

  const handleExamDateSubmit = async () => {
    if (!examDateInput) return;

    try {
      setIsSettingExamDate(true);
      
      // Call API to update exam date
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/partners/registrations/${registrationId}/exam-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ examDate: examDateInput })
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'aggiornamento della data esame');
      }

      setCurrentExamDate(examDateInput);
      setCurrentStatus('EXAM_REGISTERED');
      setExamDateInput('');
      alert('Data esame aggiornata con successo!');
      
    } catch (error: any) {
      console.error('Exam date update error:', error);
      alert('Errore durante l\'aggiornamento: ' + error.message);
    } finally {
      setIsSettingExamDate(false);
    }
  };

  const handleCompleteExam = async () => {
    try {
      setIsSettingExamDate(true);
      
      // Call API to complete exam
      const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
      const response = await fetch(`${API_BASE_URL}/partners/registrations/${registrationId}/complete-exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (!response.ok) {
        throw new Error('Errore durante il completamento dell\'esame');
      }

      setCurrentStatus('COMPLETED');
      setShowCompleteConfirm(false);
      alert('Esame completato con successo! L\'utente ha ricevuto un\'email di congratulazioni.');
      
      // Optionally trigger a page refresh to reflect the changes
      window.location.reload();
      
    } catch (error: any) {
      console.error('Complete exam error:', error);
      alert('Errore durante il completamento: ' + error.message);
    } finally {
      setIsSettingExamDate(false);
    }
  };
  // Definisco gli step del workflow
  const getFlowSteps = (): FlowStep[] => {
    // Workflow specifico per certificazioni
    if (offerType === 'CERTIFICATION') {
      return getCertificationFlowSteps();
    }
    
    // Workflow standard per TFA
    return getTFAFlowSteps();
  };

  const getCertificationFlowSteps = (): FlowStep[] => {
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
        status: 'completed'
      },
      {
        id: 'payment',
        title: 'Pagamento',
        description: 'In attesa del pagamento tramite bonifico',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        ),
        status: currentStatus === 'PENDING' ? 'current' :
               ['ENROLLED', 'DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL', 'DISCOVERY_APPROVED', 'DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(currentStatus) ? 'completed' : 'pending'
      },
      {
        id: 'documents_approved',
        title: 'Documenti Approvati',
        description: 'Carta d\'identità e tessera sanitaria verificate',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        // NUOVO WORKFLOW: DOCUMENTS_PARTNER_CHECKED, AWAITING_DISCOVERY_APPROVAL, DISCOVERY_APPROVED sono "completed" (verde)
        // perché i documenti sono stati già verificati dal partner
        status: currentStatus === 'ENROLLED' ? 'current' :
               ['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL', 'DISCOVERY_APPROVED', 'DOCUMENTS_APPROVED', 'EXAM_REGISTERED', 'COMPLETED'].includes(currentStatus) ? 'completed' : 'pending'
      },
      {
        id: 'exam_registered',
        title: 'Iscritto all\'esame',
        description: currentExamDate ? `Data esame: ${new Date(currentExamDate as string).toLocaleDateString('it-IT')}` : 'Registra iscrizione all\'esame',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        // NUOVO WORKFLOW: Dopo che Discovery ha approvato (DOCUMENTS_PARTNER_CHECKED, AWAITING_DISCOVERY_APPROVAL, DISCOVERY_APPROVED)
        // questo step diventa "current" (è il prossimo passo)
        status: ['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL', 'DISCOVERY_APPROVED', 'DOCUMENTS_APPROVED'].includes(currentStatus) ? 'current' :
               ['EXAM_REGISTERED', 'COMPLETED'].includes(currentStatus) ? 'completed' : 'pending'
      },
      {
        id: 'exam_completed',
        title: 'Esame Sostenuto',
        description: 'Esame completato con successo',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ),
        status: currentStatus === 'EXAM_REGISTERED' ? 'current' :
               currentStatus === 'EXAM_COMPLETED' ? 'current' :
               currentStatus === 'COMPLETED' ? 'completed' : 'pending'
      }
    ];

    return steps;
  };

  const getTFAFlowSteps = (): FlowStep[] => {
    const steps: FlowStep[] = [
      {
        id: 'pending',
        title: 'Iscrizione Eseguita',
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

      {/* Contract Management Section - Show only for TFA when status is PENDING or CONTRACT_GENERATED */}
      {offerType === 'TFA_ROMANIA' && (currentStatus === 'PENDING' || currentStatus === 'CONTRACT_GENERATED') && (
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
                {getPartnerStatusMessage(currentStatus, offerType as 'TFA' | 'CERTIFICATION')}
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

      {/* Exam Date Management for Certifications - DISABLED, handled by CertificationStepsManagement */}
      {false && offerType === 'CERTIFICATION' && currentStatus === 'DOCUMENTS_APPROVED' && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Gestione Data Esame</h4>
            <p className="text-sm text-gray-600">
              Il pagamento è stato completato. Inserisci la data dell'esame per completare l'iscrizione.
            </p>
          </div>

          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Esame
              </label>
              <input
                type="date"
                value={examDateInput}
                onChange={(e) => setExamDateInput(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleExamDateSubmit}
              disabled={!examDateInput || isSettingExamDate}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSettingExamDate ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Aggiornando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Conferma Data
                </>
              )}
            </button>
          </div>

          {currentExamDate && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-green-800 font-medium">
                  Data esame confermata: {currentExamDate ? new Date(currentExamDate as string).toLocaleDateString('it-IT') : 'N/A'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mark Exam as Completed for Certifications - DISABLED, handled by CertificationStepsManagement */}
      {false && offerType === 'CERTIFICATION' && currentStatus === 'EXAM_REGISTERED' && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Completamento Esame</h4>
            <p className="text-sm text-gray-600">
              L'esame è stato registrato per il {currentExamDate ? new Date(currentExamDate as string).toLocaleDateString('it-IT') : 'data non specificata'}. 
              Segna l'esame come completato per finalizzare la certificazione.
            </p>
          </div>

          <button
            onClick={() => setShowCompleteConfirm(true)}
            disabled={isSettingExamDate}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Segna Esame Come Completato
          </button>

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.884-.833-2.664 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  Attenzione
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Questa azione segnerà la certificazione come completata e invierà un'email di congratulazioni all'utente. L'azione non è reversibile.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale di conferma completamento esame */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowCompleteConfirm(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Conferma Completamento Esame
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Sei sicuro di voler segnare l'esame come completato?
                      </p>
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800 font-medium mb-2">
                          ✅ Questa azione:
                        </p>
                        <ul className="text-xs text-blue-700 space-y-1">
                          <li>• Segnerà la certificazione come completata</li>
                          <li>• Invierà un'email di congratulazioni all'utente</li>
                          <li>• Finalizzerà definitivamente il percorso</li>
                        </ul>
                      </div>
                      <p className="text-sm text-orange-600 mt-3 font-medium">
                        ⚠️ Questa azione non potrà essere annullata.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleCompleteExam}
                  disabled={isSettingExamDate}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {isSettingExamDate ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Completando...
                    </>
                  ) : (
                    'Conferma Completamento'
                  )}
                </button>
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  disabled={isSettingExamDate}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentFlow;