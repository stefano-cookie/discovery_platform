import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEnrollmentForm } from '../../hooks/useEnrollmentForm';
import { OfferService } from '../../services/offerService';
import { OfferInfo, PartnerOffer } from '../../types/offers';
import { apiRequest } from '../../services/api';
import EducationStep from '../Registration/FormSteps/EducationStep';
import ProfessionStep from '../Registration/FormSteps/ProfessionStep';
import DocumentsStep from '../Registration/FormSteps/DocumentsStep';
import EnrollmentStep from '../Registration/FormSteps/EnrollmentStep';
import RegistrationStep from '../Registration/FormSteps/RegistrationStep';

interface EnrollmentFormProps {
  partnerOfferId?: string;
}

const EnrollmentForm: React.FC<EnrollmentFormProps> = ({ partnerOfferId }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [enrollmentCompleted, setEnrollmentCompleted] = useState(false);
  const [offerInfo, setOfferInfo] = useState<PartnerOffer | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Configuration for enrollment steps based on offer type
  const stepConfig = useMemo(() => {
    const baseRequiredFields = {
      istruzione: [] as string[],
      professione: [] as string[],
      documenti: [] as string[],
      opzioni: ['courseId', 'paymentPlan'] as string[],
      riepilogo: [] as string[]
    };

    if (offerInfo?.course?.templateType === 'CERTIFICATION') {
      return {
        steps: ['documenti', 'opzioni', 'riepilogo'],
        templateType: 'CERTIFICATION' as const,
        requiredFields: {
          ...baseRequiredFields,
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    }
    
    // Default to TFA Romania with education and profession steps
    return {
      steps: ['istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo'],
      templateType: 'TFA' as const,
      requiredFields: {
        ...baseRequiredFields,
        istruzione: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData'],
        professione: ['tipoProfessione'],
        documenti: [],
        opzioni: ['courseId', 'paymentPlan'],
        riepilogo: []
      }
    };
  }, [offerInfo]);

  // Pre-populated form data from user profile + course-specific data
  const initialFormData = useMemo(() => {
    if (!userProfile || !currentUser) return undefined;
    
    return {
      // User data (read-only, pre-populated)
      email: currentUser.email,
      cognome: userProfile.cognome || '',
      nome: userProfile.nome || '',
      dataNascita: userProfile.dataNascita ? (() => {
        try {
          return new Date(userProfile.dataNascita).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      luogoNascita: userProfile.luogoNascita || '',
      codiceFiscale: userProfile.codiceFiscale || '',
      telefono: userProfile.telefono || '',
      nomePadre: userProfile.nomePadre || '',
      nomeMadre: userProfile.nomeMadre || '',
      
      // Residence data (read-only, pre-populated)
      residenzaVia: userProfile.residenzaVia || '',
      residenzaCitta: userProfile.residenzaCitta || '',
      residenzaProvincia: userProfile.residenzaProvincia || '',
      residenzaCap: userProfile.residenzaCap || '',
      hasDifferentDomicilio: userProfile.hasDifferentDomicilio || false,
      domicilioVia: userProfile.domicilioVia || '',
      domicilioCitta: userProfile.domicilioCitta || '',
      domicilioProvincia: userProfile.domicilioProvincia || '',
      domicilioCap: userProfile.domicilioCap || '',
      
      // Course-specific data (editable)
      // Education (for TFA Romania)
      tipoLaurea: '',
      laureaConseguita: '',
      laureaUniversita: '',
      laureaData: '',
      
      // Profession (for TFA Romania)
      tipoProfessione: '',
      scuolaDenominazione: '',
      scuolaCitta: '',
      scuolaProvincia: '',
      
      // Course selection
      courseId: '',
      paymentPlan: '',
      
      // Form state
      referralCode: currentUser.assignedPartner?.referralCode || '',
      sesso: '', // Not in profile, editable
      provinciaNascita: '', // Not in profile, editable
    };
  }, [userProfile, currentUser]);

  const {
    currentStep,
    currentStepIndex,
    formData,
    nextStep,
    updateFormData
  } = useEnrollmentForm({
    steps: stepConfig.steps,
    requiredFields: stepConfig.requiredFields,
    initialData: initialFormData
  });

  // Load user profile on component mount
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const loadUserProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await apiRequest({
          method: 'GET',
          url: '/user/profile'
        });
        setUserProfile(response);
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [currentUser, navigate]);

  // Load offer information if partnerOfferId is provided
  useEffect(() => {
    if (partnerOfferId) {
      const loadOfferInfo = async () => {
        setLoadingOffer(true);
        setOfferError(null);
        try {
          const info = await OfferService.getOffer(partnerOfferId);
          setOfferInfo(info);
        } catch (error) {
          console.error('Error loading offer info:', error);
          setOfferError('Offerta non trovata o non valida');
        } finally {
          setLoadingOffer(false);
        }
      };
      loadOfferInfo();
    }
  }, [partnerOfferId]);

  // Handle form submission
  const handleSubmit = async () => {
    try {
      const response = await apiRequest({
        method: 'POST',
        url: '/enrollment/submit',
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          ...formData,
          partnerOfferId,
          offerType: stepConfig.templateType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA_ROMANIA'
        }
      });

      console.log('Enrollment completed:', response);
      setEnrollmentCompleted(true);
      
      // Redirect to user dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting enrollment:', error);
      // Handle error appropriately
    }
  };

  // Loading states
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Accesso richiesto</h2>
          <p className="text-gray-600">È necessario effettuare il login per iscriversi a un corso.</p>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loadingOffer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento informazioni corso...</p>
        </div>
      </div>
    );
  }

  if (offerError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Errore</h2>
          <p className="text-gray-600 mb-4">{offerError}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Torna alla Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (enrollmentCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold mb-2">Iscrizione Completata!</h2>
          <p className="text-gray-600 mb-4">
            La tua iscrizione è stata registrata con successo.
          </p>
          <p className="text-sm text-gray-500">
            Verrai reindirizzato alla dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Render the enrollment form
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Iscrizione al Corso
          </h1>
          <p className="text-gray-600">
            Completa i dati per iscriverti al corso selezionato
          </p>
          {offerInfo && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800">{offerInfo.name}</h3>
              <p className="text-sm text-blue-600">
                Tipo: {offerInfo.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazioni'}
              </p>
            </div>
          )}
        </div>

        {/* User Info Banner */}
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Dati utente caricati automaticamente
              </h3>
              <p className="mt-1 text-sm text-green-700">
                I tuoi dati anagrafici e di residenza sono già stati caricati dal tuo profilo. 
                Dovrai completare solo i dati specifici per questo corso.
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {stepConfig.steps.map((step, index) => {
              const stepLabel = (() => {
                switch (step) {
                  case 'istruzione': return 'Istruzione';
                  case 'professione': return 'Professione';
                  case 'documenti': return 'Documenti';
                  case 'opzioni': return 'Opzioni';
                  case 'riepilogo': return 'Riepilogo';
                  default: return step;
                }
              })();
              
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index === currentStepIndex 
                        ? 'bg-blue-600 text-white' 
                        : index < currentStepIndex 
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                    }`}>
                      {index < currentStepIndex ? '✓' : index + 1}
                    </div>
                    <span className="mt-2 text-xs font-medium text-gray-600">{stepLabel}</span>
                  </div>
                  {index < stepConfig.steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 ${
                      index < currentStepIndex ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Form Steps */}
        <div className="mt-8">
          {currentStep === 'istruzione' && (
            <EducationStep
              data={formData}
              onNext={(data) => {
                updateFormData(data);
                nextStep();
              }}
              onChange={updateFormData}
            />
          )}

          {currentStep === 'professione' && (
            <ProfessionStep
              data={formData}
              onNext={(data) => {
                updateFormData(data);
                nextStep();
              }}
              onChange={updateFormData}
            />
          )}

          {currentStep === 'documenti' && (
            <DocumentsStep
              data={formData}
              onNext={(data) => {
                updateFormData(data);
                nextStep();
              }}
              onChange={updateFormData}
              templateType={stepConfig.templateType}
              requiredFields={stepConfig.requiredFields.documenti || []}
            />
          )}

          {currentStep === 'opzioni' && (
            <EnrollmentStep
              data={formData}
              formData={formData}
              onNext={(data) => {
                updateFormData(data);
                nextStep();
              }}
              onChange={updateFormData}
              offerInfo={offerInfo?.course ? offerInfo as unknown as OfferInfo : undefined}
            />
          )}

          {currentStep === 'riepilogo' && (
            <RegistrationStep
              data={formData}
              formData={formData}
              onNext={(data) => {
                updateFormData(data);
                handleSubmit();
              }}
              onChange={updateFormData}
              offerInfo={offerInfo?.course ? offerInfo as unknown as OfferInfo : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrollmentForm;