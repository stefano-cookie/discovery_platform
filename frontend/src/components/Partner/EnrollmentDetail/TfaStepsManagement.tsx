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
    admissionTest: TfaStep;
    cnredRelease: TfaStep;
    finalExam: TfaStep;
    recognitionRequest: TfaStep;
    finalCompletion: TfaStep;
  };
}

interface TfaStepsManagementProps {
  registrationId: string;
  registration?: any;
  onUpdate?: () => void;
}

const TfaStepsManagement: React.FC<TfaStepsManagementProps> = ({ 
  registrationId, 
  registration,
  onUpdate 
}) => {
  const [tfaData, setTfaData] = useState<TfaStepsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Form states for different steps
  const [admissionTestDate, setAdmissionTestDate] = useState('');
  const [admissionTestPassed, setAdmissionTestPassed] = useState<boolean>(true);
  const [examDate, setExamDate] = useState('');
  const [examPassed, setExamPassed] = useState<boolean>(true);
  const [recognitionFile, setRecognitionFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTfaSteps();
  }, [registrationId]);

  const fetchTfaSteps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest<TfaStepsData>({
        method: 'GET',
        url: `/partners/registrations/${registrationId}/tfa-steps`
      });
      
      setTfaData(response);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento steps TFA');
    } finally {
      setLoading(false);
    }
  };

  const handleAdmissionTest = async () => {
    try {
      if (!admissionTestDate) {
        alert('Inserire la data del test');
        return;
      }

      setActionLoading('admission');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/admission-test`,
        data: {
          testDate: admissionTestDate,
          passed: admissionTestPassed
        }
      });

      await fetchTfaSteps();
      onUpdate?.();
      setAdmissionTestDate('');
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nella registrazione test d\'ingresso');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCnredRelease = async () => {
    try {
      setActionLoading('cnred');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/cnred-release`
      });

      await fetchTfaSteps();
      onUpdate?.();
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nella registrazione rilascio CNRED');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalExam = async () => {
    try {
      if (!examDate) {
        alert('Inserire la data dell\'esame');
        return;
      }

      setActionLoading('exam');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/final-exam`,
        data: {
          examDate,
          passed: examPassed
        }
      });

      await fetchTfaSteps();
      onUpdate?.();
      setExamDate('');
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nella registrazione esame finale');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecognitionRequest = async () => {
    try {
      setActionLoading('recognition');
      
      const formData = new FormData();
      if (recognitionFile) {
        formData.append('document', recognitionFile);
      }

      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/recognition-request`,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await fetchTfaSteps();
      onUpdate?.();
      setRecognitionFile(null);
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nell\'invio richiesta riconoscimento');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveRecognition = async () => {
    try {
      setActionLoading('approval');
      
      await apiRequest({
        method: 'POST',
        url: `/partners/registrations/${registrationId}/recognition-approval`
      });

      await fetchTfaSteps();
      onUpdate?.();
      
    } catch (err: any) {
      alert(err.response?.data?.error || 'Errore nell\'approvazione riconoscimento');
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
  const canManageSteps = registration?.offerType === 'TFA_ROMANIA';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Documenti Steps TFA</h3>
        <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
          Status: {getStatusDisplayText(tfaData.currentStatus)}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-6">
        Carica i documenti per avanzare nel percorso TFA dello studente:
      </p>

      {/* Simple document upload actions */}
      <div className="space-y-4">
        {/* Step 0: Admission Test */}
        {!tfaData.steps.admissionTest.completed && canManageSteps && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-purple-900">0. Test d'Ingresso</h4>
                <p className="text-sm text-purple-700">Registra il test d'ingresso per l'ammissione al corso</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={admissionTestDate}
                onChange={(e) => setAdmissionTestDate(e.target.value)}
                placeholder="Data test"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleAdmissionTest}
                disabled={actionLoading === 'admission' || !admissionTestDate}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'admission' ? 'Caricando...' : 'Registra Test'}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: CNRED Release */}
        {tfaData.steps.admissionTest.completed && !tfaData.steps.cnredRelease.completed && canManageSteps && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-blue-900">2. Rilascio CNRED</h4>
                <p className="text-sm text-blue-700">Registra quando il CNRED è stato rilasciato</p>
              </div>
              <button
                onClick={handleCnredRelease}
                disabled={actionLoading === 'cnred'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'cnred' ? 'Caricando...' : 'Segna come Completato'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Final Exam */}
        {tfaData.steps.cnredRelease.completed && !tfaData.steps.finalExam.completed && canManageSteps && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-orange-900">3. Esame Finale</h4>
                <p className="text-sm text-orange-700">Registra l'esame finale</p>
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
                onClick={handleFinalExam}
                disabled={actionLoading === 'exam' || !examDate}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'exam' ? 'Caricando...' : 'Registra Esame'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Recognition Request */}
        {tfaData.steps.finalExam.completed && !tfaData.steps.recognitionRequest.completed && canManageSteps && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium text-pink-900">4. Richiesta Riconoscimento</h4>
                <p className="text-sm text-pink-700">Carica documento per richiesta riconoscimento</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="file"
                onChange={(e) => setRecognitionFile(e.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                onClick={handleRecognitionRequest}
                disabled={actionLoading === 'recognition'}
                className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'recognition' ? 'Caricando...' : 'Carica Documento'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Final Approval */}
        {tfaData.steps.recognitionRequest.completed && !tfaData.steps.finalCompletion.completed && canManageSteps && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-green-900">5. Approvazione Finale</h4>
                <p className="text-sm text-green-700">Completa il percorso TFA</p>
              </div>
              <button
                onClick={handleApproveRecognition}
                disabled={actionLoading === 'approval'}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === 'approval' ? 'Completando...' : 'Completa Corso'}
              </button>
            </div>
          </div>
        )}

        {/* Complete steps overview - similar to user view */}
        <div className="mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Panoramica Completa Steps</h4>
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
                      In corso - pronto per l'azione del partner
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
        </div>
      </div>

      {!canManageSteps && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex">
            <svg className="w-5 h-5 text-gray-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Steps disponibili solo per corsi TFA</p>
              <p>
                Questi step sono gestibili solo per iscrizioni TFA.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TfaStepsManagement;