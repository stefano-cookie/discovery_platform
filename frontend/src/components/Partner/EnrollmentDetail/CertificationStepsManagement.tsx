import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getPartnerStatusDisplay } from '../../../utils/statusTranslations';
import { triggerCertificationStepsRefresh, triggerRegistrationsRefresh } from '../../../utils/refreshEvents';
import SuccessModal from '../../UI/SuccessModal';
import ErrorModal from '../../UI/ErrorModal';
import ConfirmModal from '../../UI/ConfirmModal';

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

interface CertificationStepsManagementProps {
  registrationId: string;
  registration?: any;
  onUpdate?: () => void;
}

const CertificationStepsManagement: React.FC<CertificationStepsManagementProps> = ({ 
  registrationId, 
  registration,
  onUpdate
}) => {
  const [certificationData, setCertificationData] = useState<CertificationStepsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showExamDateSuccess, setShowExamDateSuccess] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [forceUpdate, setForceUpdate] = useState(0);

  // Function to handle contract preview with auth
  const handlePreviewContract = async () => {
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/preview-contract/${registrationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );
      
      // Create blob URL and open in new window
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error('Error previewing contract:', error);
      setErrorMessage('Errore nell\'anteprima del contratto');
      setShowErrorModal(true);
    }
  };

  // Function to handle contract download with auth
  const handleDownloadContract = async () => {
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/download-contract/${registrationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contratto-${registrationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract:', error);
      setErrorMessage('Errore nel download del contratto');
      setShowErrorModal(true);
    }
  };

  // Function to handle signed contract download with auth
  const handleDownloadSignedContract = async () => {
    if (!registration.contractSignedUrl) return;
    
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/download-signed-contract/${registrationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contratto-firmato-${registrationId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading signed contract:', error);
      setErrorMessage('Errore nel download del contratto firmato');
      setShowErrorModal(true);
    }
  };

  // Define functions first before using them in effects
  const fetchDocuments = useCallback(async () => {
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/registrations/${registrationId}/documents/unified`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Handle both possible response formats
      const documents = response.data?.documents || response.data;
      if (documents && Array.isArray(documents)) {
        setDocuments(documents);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  }, [registrationId]);
  
  const fetchCertificationSteps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get<CertificationStepsData>(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/registrations/${registrationId}/certification-steps`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setCertificationData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento steps certificazione');
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  // Effects using the functions defined above
  useEffect(() => {
    fetchCertificationSteps();
    fetchDocuments();
  }, [fetchCertificationSteps, fetchDocuments]);
  
  // Force refresh when certification status changes
  useEffect(() => {
  }, [certificationData?.currentStatus, fetchDocuments]);
  
  // Listen for document updates from UnifiedDocumentManager
  useEffect(() => {
    const handleDocumentUpdate = () => {
      fetchDocuments();
    };
    
    const handleRefreshSteps = () => {
      fetchCertificationSteps();
      fetchDocuments();
    };
    
    window.addEventListener('documentsUpdated', handleDocumentUpdate);
    window.addEventListener('refreshCertificationSteps', handleRefreshSteps);
    window.addEventListener('refreshRegistrations', handleRefreshSteps);
    
    return () => {
      window.removeEventListener('documentsUpdated', handleDocumentUpdate);
      window.removeEventListener('refreshCertificationSteps', handleRefreshSteps);
      window.removeEventListener('refreshRegistrations', handleRefreshSteps);
    };
  }, [fetchCertificationSteps, fetchDocuments]);

  const handleApproveDocuments = async () => {
    try {
      setActionLoading('documents');

      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');

      // Approve documents and transition status to DOCUMENTS_APPROVED
      const endpoint = `/partners/registrations/${registrationId}/certification-docs-approved`;

      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}${endpoint}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Aggiorna gli steps locali e documenti
      await fetchCertificationSteps();
      await fetchDocuments();
      
      // Trigger refresh events per aggiornare altri componenti
      triggerCertificationStepsRefresh();
      triggerRegistrationsRefresh();
      
      // Aspetta un attimo per dare tempo al backend di aggiornare i dati
      setTimeout(async () => {
        // Aggiorna i dati dell'utente nel componente padre
        onUpdate?.();
        
        // Force refresh della parent page
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('userStatusUpdated'));
        }
        
        // Refetch per assicurarsi che i dati siano aggiornati
        await fetchCertificationSteps();
        await fetchDocuments();
      }, 1000);
      
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Errore nell\'approvazione documenti');
      setShowErrorModal(true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterExam = async () => {
    try {
      setActionLoading('exam');
      
      // Usa una data di default (oggi) per semplicità
      const today = new Date().toISOString().split('T')[0];
      
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/registrations/${registrationId}/exam-date`,
        { examDate: today },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Mostra popup di successo immediatamente
      setShowExamDateSuccess(true);
      setTimeout(() => setShowExamDateSuccess(false), 3000);
      
      // Trigger refresh events immediately
      triggerCertificationStepsRefresh();
      triggerRegistrationsRefresh();
      
      // Aggiorna i dati dell'utente nel componente padre
      onUpdate?.();
      
      // Force refresh della parent page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('userStatusUpdated'));
      }
      
      // Aggiorna gli steps locali e documenti
      await fetchCertificationSteps();
      await fetchDocuments();
      
      // Aspetta un attimo per dare tempo al backend di aggiornare i dati
      setTimeout(async () => {
        await fetchCertificationSteps();
        await fetchDocuments();
        
        // Force component re-render
        setForceUpdate(prev => prev + 1);
        
        // Additional refresh triggers
        triggerCertificationStepsRefresh();
        triggerRegistrationsRefresh();
      }, 1500);
      
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Errore nel passaggio a Iscritto all\'esame');
      setShowErrorModal(true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteExam = () => {
    setShowConfirmModal(true);
  };
  
  const confirmCompleteExam = async () => {
    try {
      setActionLoading('complete');
      setShowConfirmModal(false); // Close the confirmation modal first
      
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/partners/registrations/${registrationId}/complete-exam`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Show success modal immediately
      setModalMessage('Esame completato con successo! L\'utente ha ricevuto un\'email di congratulazioni.');
      setShowSuccessModal(true);
      
      // Trigger refresh events immediately
      triggerCertificationStepsRefresh();
      triggerRegistrationsRefresh();
      
      // Aggiorna i dati dell'utente nel componente padre
      onUpdate?.();
      
      // Force refresh della parent page
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('userStatusUpdated'));
      }
      
      // Multiple refreshes to ensure UI updates
      await fetchCertificationSteps();
      await fetchDocuments();
      
      // Additional refresh after a delay to ensure backend has processed
      setTimeout(async () => {
        await fetchCertificationSteps();
        await fetchDocuments();
        
        // Final refresh triggers
        triggerCertificationStepsRefresh();
        triggerRegistrationsRefresh();
        
        // Force component re-render by triggering a state update
        if (onUpdate) {
          onUpdate();
        }
        
        // Force re-render of this component
        setForceUpdate(prev => prev + 1);
      }, 1500); // Increased delay to give more time for backend processing
      
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Errore nel completamento esame');
      setShowErrorModal(true);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });


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
  const canManageSteps = registration?.offerType === 'CERTIFICATION';
  const isCompleted = certificationData.currentStatus === 'COMPLETED';
  const isExamRegistered = certificationData.currentStatus === 'EXAM_REGISTERED';
  const isExamCompleted = certificationData.currentStatus === 'EXAM_COMPLETED';
  
  
  // Check documents status for conditional approval - Fix: Use only document types, not required flag
  const requiredDocuments = documents.filter(doc => ['IDENTITY_CARD', 'TESSERA_SANITARIA'].includes(doc.type));
  const approvedDocuments = requiredDocuments.filter(doc => doc.status === 'APPROVED');
  const hasAllRequiredDocuments = requiredDocuments.length >= 2; // Identity Card and Health Card
  const allDocumentsApproved = requiredDocuments.length > 0 && approvedDocuments.length === requiredDocuments.length;
  

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Steps Certificazione</h3>
        <span 
            key={`status-${certificationData.currentStatus}-${forceUpdate}`}
            className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
          >
            Stato Attuale: {getPartnerStatusDisplay(certificationData.currentStatus)}
          </span>
      </div>
      
      {!isCompleted && (
        <p className="text-sm text-gray-600 mb-6">
          Gestisci il workflow in 5 step per il corso di certificazione:
        </p>
      )}

      {/* Completion celebration message */}
      {(isCompleted || isExamRegistered || isExamCompleted) && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              {isCompleted ? (
                <>
                  <h4 className="text-lg font-semibold text-green-900">🎉 Certificazione Completata!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Tutti gli step sono stati completati con successo. L'utente ha ricevuto la conferma finale.
                  </p>
                </>
              ) : isExamCompleted ? (
                <>
                  <h4 className="text-lg font-semibold text-green-900">🎊 Esame Sostenuto con Successo!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    L'utente ha completato l'esame. Il processo di certificazione è quasi terminato.
                  </p>
                </>
              ) : isExamRegistered ? (
                <>
                  <h4 className="text-lg font-semibold text-green-900">✅ Iscritto all'Esame!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    L'utente è stato iscritto all'esame. Usa il pulsante qui sotto per completare l'esame quando sostenuto.
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Step 1 & 2: Auto-managed - Hide if completed */}
        {!isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">1-2. Iscrizione e Pagamento</h4>
            <p className="text-sm text-green-700 mb-2">
              Gestiti automaticamente dal sistema
            </p>
            <div className="flex items-center text-sm text-green-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {certificationData.steps.payment.completed ? 
                'Iscrizione e pagamento completati' : 
                'In attesa del completamento pagamento'
              }
            </div>
          </div>
        )}

        {/* Step 3: Documents Checked (Nuovo Workflow) */}
        {certificationData.steps.payment.completed && !certificationData.steps.documentsApproved.completed && canManageSteps && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-blue-900">3. Verifica Documenti</h4>
                <p className="text-sm text-blue-700">
                  Usa il pulsante "CHECK DOCUMENTI" nella sezione documenti sopra
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL', 'DISCOVERY_APPROVED'].includes(certificationData.currentStatus) ? (
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-700 font-medium">
                      {certificationData.currentStatus === 'DOCUMENTS_PARTNER_CHECKED' && '✓ Documenti checkati - In attesa approvazione Discovery'}
                      {certificationData.currentStatus === 'AWAITING_DISCOVERY_APPROVAL' && '✓ In attesa approvazione finale Discovery'}
                      {certificationData.currentStatus === 'DISCOVERY_APPROVED' && '✓ Approvato da Discovery'}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-orange-700 italic">
                    {hasAllRequiredDocuments ? (
                      'Documenti caricati - clicca "CHECK DOCUMENTI" sopra'
                    ) : (
                      `In attesa caricamento documenti (${requiredDocuments.length}/2 caricati)`
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Exam Registration */}
        {certificationData.steps.documentsApproved.completed && !certificationData.steps.examRegistered.completed && canManageSteps && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-orange-900">4. Iscrizione all'Esame</h4>
                <p className="text-sm text-orange-700">Conferma che l'utente è stato iscritto all'esame</p>
              </div>
              <button
                onClick={handleRegisterExam}
                disabled={actionLoading === 'exam'}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm flex items-center"
              >
                {actionLoading === 'exam' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registrando...
                  </>
                ) : (
                  'Conferma Iscrizione Esame'
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Step 4.5: Exam Registered Confirmation - Show when exam is registered but not completed */}
        {isExamRegistered && !isExamCompleted && !isCompleted && canManageSteps && (
          <div className="bg-blue-50 border-l-4 border-blue-500 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <h4 className="font-medium text-blue-900">5. Esame Sostenuto</h4>
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">STEP ATTUALE</span>
                </div>
                <p className="text-sm text-blue-700">L'utente è iscritto all'esame. Clicca "Esame Sostenuto" quando l'utente ha completato l'esame per avanzare al prossimo step.</p>
              </div>
              <button
                onClick={handleCompleteExam}
                disabled={actionLoading === 'complete'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'complete' ? 'Registrando...' : 'Esame Sostenuto'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Exam Completed - Show when exam is completed */}
        {isExamCompleted && !isCompleted && canManageSteps && (
          <div className="bg-green-50 border-l-4 border-green-500 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <h4 className="font-medium text-green-900">✅ Esame Sostenuto</h4>
                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">COMPLETATO</span>
                </div>
                <p className="text-sm text-green-700">L'utente ha sostenuto l'esame con successo! Il processo di certificazione è quasi terminato.</p>
              </div>
              <div className="text-green-700">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Completed steps summary */}
        <div className="space-y-2">
          {steps.map((step) => step.completed && (
            <div key={step.step} className="flex items-center space-x-3 text-sm text-green-700 bg-green-50 p-2 rounded">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>{step.title}</strong> - {step.completedAt ? `Completato il ${formatDate(step.completedAt)}` : 'Completato'}</span>
            </div>
          ))}
        </div>

        {/* Sezione Contratti - Sempre visibile quando disponibili */}
        {registration && (registration.contractTemplateUrl || registration.contractSignedUrl) && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Documenti Contratto</h4>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Contratto Template */}
                {registration.contractTemplateUrl && (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-sm text-gray-900">Contratto Precompilato</h5>
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    {registration.contractGeneratedAt && (
                      <p className="text-xs text-gray-500 mb-2">
                        Generato: {formatDate(registration.contractGeneratedAt)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handlePreviewContract}
                        className="inline-flex items-center justify-center flex-1 bg-blue-50 text-blue-700 px-2 py-2 rounded text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Anteprima
                      </button>
                      <button
                        onClick={handleDownloadContract}
                        className="inline-flex items-center justify-center flex-1 bg-blue-600 text-white px-2 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Scarica
                      </button>
                    </div>
                  </div>
                )}

                {/* Contratto Firmato */}
                {registration.contractSignedUrl && (
                  <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-sm text-green-900">Contratto Firmato</h5>
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    {registration.contractUploadedAt && (
                      <p className="text-xs text-green-700 mb-2">
                        Firmato: {formatDate(registration.contractUploadedAt)}
                      </p>
                    )}
                    <button
                      onClick={handleDownloadSignedContract}
                      className="inline-flex items-center justify-center w-full bg-green-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Scarica Firmato
                    </button>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              {registration.contractSignedUrl && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Contratto firmato e archiviato correttamente</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!canManageSteps && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-gray-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Steps disponibili solo per corsi di Certificazione</p>
              <p>
                Questi step sono gestibili solo per iscrizioni di certificazione.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Popup di successo registrazione data esame */}
      {showExamDateSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-pulse">
          <div className="bg-white rounded-lg shadow-xl border-l-4 border-green-500 p-4 max-w-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    ✅ Passaggio completato!
                  </h3>
                  <button
                    onClick={() => setShowExamDateSuccess(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mt-2 text-sm text-gray-700">
                  <p className="font-medium text-green-800">
                    L'utente è ora "Iscritto all'esame".
                  </p>
                  <p className="text-gray-600 mt-1">
                    Ora puoi procedere a "Esame Sostenuto".
                  </p>
                </div>
              </div>
            </div>
            
            {/* Progress bar per auto-dismiss */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-1">
              <div className="bg-green-500 h-1 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Modal for Exam Completion */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmCompleteExam}
        title="Conferma Completamento Esame"
        message="Sei sicuro di voler segnare l'esame come completato? Questa azione invierà un'email di congratulazioni all'utente e non potrà essere annullata."
        confirmText="Completa Esame"
        cancelText="Annulla"
        variant="warning"
      />
      
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Operazione Completata!"
        message={modalMessage}
        autoClose={true}
        autoCloseDelay={3000}
      />
      
      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Errore"
        message={errorMessage}
        autoClose={false}
      />
    </div>
  );
};

export default CertificationStepsManagement;