import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../../services/api';

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
  
  // Form states
  const [examDate, setExamDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');

  useEffect(() => {
    fetchCertificationSteps();
  }, [registrationId]);

  const fetchCertificationSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest<CertificationStepsData>({
        method: 'GET',
        url: `/partners/registrations/${registrationId}/certification-steps`
      });
      
      setCertificationData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento steps certificazione');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDocuments = async () => {
    try {
      setActionLoading('documents');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/certification-docs-approved`
      });

      await fetchCertificationSteps();
      onUpdate?.();
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nell\'approvazione documenti');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterExam = async () => {
    try {
      if (!examDate) {
        alert('Inserire la data dell\'esame');
        return;
      }

      setActionLoading('exam');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/certification-exam-registered`,
        data: { examDate }
      });

      await fetchCertificationSteps();
      onUpdate?.();
      setExamDate('');
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nella registrazione esame');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteExam = async () => {
    try {
      setActionLoading('complete');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/certification-exam-completed`,
        data: { completedDate }
      });

      await fetchCertificationSteps();
      onUpdate?.();
      setCompletedDate('');
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nel completamento esame');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'PENDING': return 'In Attesa';
      case 'ENROLLED': return 'Iscritto';
      case 'DOCUMENTS_APPROVED': return 'Documenti Approvati';
      case 'EXAM_REGISTERED': return 'Iscritto all\'Esame';
      case 'COMPLETED': return 'Completato';
      default: return status;
    }
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
  const canManageSteps = registration?.offer?.offerType === 'CERTIFICATION';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Steps Certificazione</h3>
        <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
          Status: {getStatusDisplayText(certificationData.currentStatus)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-6">
        Gestisci il workflow in 5 step per il corso di certificazione:
      </p>

      <div className="space-y-4">
        {/* Step 1 & 2: Auto-managed */}
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

        {/* Step 3: Documents Approval */}
        {certificationData.steps.payment.completed && !certificationData.steps.documentsApproved.completed && canManageSteps && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900">3. Documenti Approvati</h4>
                <p className="text-sm text-blue-700">Approva carta d'identità e tessera sanitaria</p>
              </div>
              <button
                onClick={handleApproveDocuments}
                disabled={actionLoading === 'documents'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'documents' ? 'Approvando...' : 'Approva Documenti'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Exam Registration */}
        {certificationData.steps.documentsApproved.completed && !certificationData.steps.examRegistered.completed && canManageSteps && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-orange-900">4. Iscrizione all'Esame</h4>
                <p className="text-sm text-orange-700">Registra l'iscrizione all'esame</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                placeholder="Data esame"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleRegisterExam}
                disabled={actionLoading === 'exam' || !examDate}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'exam' ? 'Registrando...' : 'Registra Esame'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Exam Completion */}
        {certificationData.steps.examRegistered.completed && !certificationData.steps.examCompleted.completed && canManageSteps && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-green-900">5. Esame Sostenuto</h4>
                <p className="text-sm text-green-700">Segna l'esame come completato</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
                placeholder="Data completamento (opzionale)"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleCompleteExam}
                disabled={actionLoading === 'complete'}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'complete' ? 'Completando...' : 'Completa Esame'}
              </button>
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
    </div>
  );
};

export default CertificationStepsManagement;