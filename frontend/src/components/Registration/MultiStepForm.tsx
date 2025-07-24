import React, { useState, useEffect, useMemo } from 'react';
import { useMultiStepForm } from '../../hooks/useMultiStepForm';
import { OfferService } from '../../services/offerService';
import { OfferInfo } from '../../types/offers';
import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../services/api';
import StepIndicator from './StepIndicator';
import GeneralDataStep from './FormSteps/GeneralDataStep';
import ResidenceStep from './FormSteps/ResidenceStep';
import EducationStep from './FormSteps/EducationStep';
import ProfessionStep from './FormSteps/ProfessionStep';
import DocumentsStep from './FormSteps/DocumentsStep';
import EnrollmentStep from './FormSteps/EnrollmentStep';
import RegistrationStep from './FormSteps/RegistrationStep';

interface MultiStepFormProps {
  referralCode?: string;
}

const MultiStepForm: React.FC<MultiStepFormProps> = ({ referralCode }) => {
  const { user: currentUser } = useAuth();
  const [registrationCompleted, setRegistrationCompleted] = useState(false);
  const [offerInfo, setOfferInfo] = useState<OfferInfo | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  const stepConfig = useMemo(() => {
    if (offerInfo?.offerType === 'CERTIFICATION') {
      return {
        steps: ['generale', 'residenza', 'documenti', 'opzioni', 'riepilogo'],
        offerType: 'CERTIFICATION' as const,
        requiredFields: {
          generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'],
          residenza: ['residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap', 'hasDifferentDomicilio'],
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    }
    
    if (referralCode?.includes('-') && loadingOffer) {
      return {
        steps: ['generale', 'residenza', 'documenti', 'opzioni', 'riepilogo'],
        offerType: 'CERTIFICATION' as const,
        requiredFields: {
          generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'],
          residenza: ['residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap', 'hasDifferentDomicilio'],
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    }
    
    return {
      steps: ['generale', 'residenza', 'istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo'],
      offerType: 'TFA_ROMANIA' as const,
      requiredFields: {
        generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre'],
        residenza: ['residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap', 'hasDifferentDomicilio'],
        istruzione: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData'],
        professione: ['tipoProfessione'],
        documenti: [],
        opzioni: ['courseId', 'paymentPlan'],
        riepilogo: []
      }
    };
  }, [offerInfo, loadingOffer, referralCode]);

  // Convert user profile to form data
  const initialFormData = useMemo(() => {
    if (!userProfile) return undefined;
    
    // Convert profile data to form format
    return {
      // Email comes from user object, not profile
      email: currentUser?.email || '',
      // General data
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
      // Note: sesso and provinciaNascita are not in UserProfile schema - will be empty and editable
      sesso: '',
      provinciaNascita: '',
      // Residence data
      residenzaVia: userProfile.residenzaVia || '',
      residenzaCitta: userProfile.residenzaCitta || '',
      residenzaProvincia: userProfile.residenzaProvincia || '',
      residenzaCap: userProfile.residenzaCap || '',
      hasDifferentDomicilio: userProfile.hasDifferentDomicilio || false,
      domicilioVia: userProfile.domicilioVia || '',
      domicilioCitta: userProfile.domicilioCitta || '',
      domicilioProvincia: userProfile.domicilioProvincia || '',
      domicilioCap: userProfile.domicilioCap || '',
      // Education data
      tipoLaurea: userProfile.tipoLaurea || '',
      laureaConseguita: userProfile.laureaConseguita || '',
      laureaUniversita: userProfile.laureaUniversita || '',
      laureaData: userProfile.laureaData ? (() => {
        try {
          return new Date(userProfile.laureaData).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      // Profession data
      tipoProfessione: userProfile.tipoProfessione || '',
      scuolaDenominazione: userProfile.scuolaDenominazione || '',
      scuolaCitta: userProfile.scuolaCitta || '',
      scuolaProvincia: userProfile.scuolaProvincia || '',
      // Add referral code if present
      referralCode: referralCode || ''
    };
  }, [userProfile, currentUser, referralCode]);

  const {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    saveCurrentData,
    isFirstStep,
    progressPercentage,
    getStepProgress,
    isStepValid,
    canNavigateToStep,
  } = useMultiStepForm({ 
    referralCode, 
    stepConfig: stepConfig as any,
    initialData: initialFormData
  });

  const handleStepComplete = (stepData: any) => {
    updateFormData(stepData);
    nextStep();
  };


  const handleNextStep = () => {
    const success = nextStep();
    if (!success) {
      // Alert user that all required fields must be completed
    }
  };

  const handleFinalSubmit = () => {
    if ((window as any).submitRegistrationForm) {
      (window as any).submitRegistrationForm();
    } else {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };
  
  const handleRegistrationSuccess = (data: any) => {
    setRegistrationCompleted(true);
  };

  // Load offer information when referralCode changes
  useEffect(() => {
    const loadOfferInfo = async () => {
      if (!referralCode) {
        setOfferInfo(null);
        return;
      }

      if (referralCode.includes('-')) {
        try {
          setLoadingOffer(true);
          setOfferError(null);
          const info = await OfferService.getOfferByLink(referralCode);
          setOfferInfo(info);
          // Save partnerOfferId in formData when offer is loaded
          if (info && info.id) {
            updateFormData({ partnerOfferId: info.id });
          }
        } catch (error) {
          console.error('Error loading offer info:', error);
          const errorMessage = (error as any).response?.data?.message || 
                              (error as any).message || 
                              'Offerta non trovata o non valida';
          setOfferError(errorMessage);
        } finally {
          setLoadingOffer(false);
        }
      } else {
        setOfferInfo(null);
      }
    };

    loadOfferInfo();
  }, [referralCode, updateFormData]);

  // Load user profile when user is authenticated
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!currentUser) {
        setUserProfile(null);
        return;
      }

      try {
        setLoadingProfile(true);
        const response = await apiRequest<{profile: any}>({
          url: '/user/profile',
          method: 'GET'
        });
        setUserProfile(response.profile);
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserProfile(null);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [currentUser]);



  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (Object.keys(formData).length > 0) {
        saveCurrentData();
      }
    }, 30000); // 30 secondi

    return () => clearInterval(autoSaveInterval);
  }, [formData, saveCurrentData]);

  const shouldShowStep = (stepName: string) => stepConfig.steps.includes(stepName);
  
  // Create dynamic steps with titles for the UI
  const dynamicSteps = stepConfig.steps.map((stepId, index) => {
    const stepTitles = {
      'generale': 'Dati Generali',
      'residenza': 'Residenza',
      'istruzione': 'Istruzione',
      'professione': 'Professione',
      'documenti': 'Documenti',
      'opzioni': 'Opzioni Iscrizione',
      'riepilogo': 'Riepilogo'
    };
    
    return {
      id: stepId,
      title: stepTitles[stepId as keyof typeof stepTitles] || stepId,
      isValid: false,
      isCompleted: false
    };
  });
  
  // Calculate dynamic isLastStep
  const dynamicIsLastStep = currentStep === dynamicSteps.length - 1;
  

  const renderCurrentStep = () => {
    const currentStepName = stepConfig.steps[currentStep];
    
    switch (currentStepName) {
      case 'generale':
        return (
          <GeneralDataStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
            referralCode={referralCode}
            offerType={stepConfig.offerType}
            requiredFields={stepConfig.requiredFields.generale || []}
            offerInfo={offerInfo}
          />
        );
      case 'residenza':
        return (
          <ResidenceStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
          />
        );
      case 'istruzione':
        return shouldShowStep('istruzione') ? (
          <EducationStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
          />
        ) : null;
      case 'professione':
        return shouldShowStep('professione') ? (
          <ProfessionStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
          />
        ) : null;
      case 'documenti':
        return (
          <DocumentsStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
            offerType={stepConfig.offerType}
            requiredFields={stepConfig.requiredFields.documenti || []}
          />
        );
      case 'opzioni':
        return (
          <EnrollmentStep
            data={formData}
            formData={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
            offerInfo={offerInfo}
          />
        );
      case 'riepilogo':
        return (
          <RegistrationStep
            data={formData}
            formData={formData}
            onNext={handleRegistrationSuccess}
            onChange={updateFormData}
            offerInfo={offerInfo}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Registrazione <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Diamante</span>
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Completa la tua iscrizione in pochi semplici passaggi</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Loading Profile for Authenticated Users */}
        {currentUser && loadingProfile && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-4 sm:mb-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600">Caricamento dati profilo...</span>
            </div>
          </div>
        )}
        
        {/* Offer Error Display */}
        {offerError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl shadow-xl p-6 mb-4 sm:mb-8">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-600 mt-0.5 mr-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Link non valido</h3>
                <p className="text-red-700 text-sm mb-4">
                  {offerError}
                </p>
                <p className="text-red-600 text-sm mb-4">
                  Il link che hai utilizzato potrebbe essere scaduto, non valido o rimosso dal partner.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.location.href = '/login'}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Accedi al tuo Account
                  </button>
                  <button
                    onClick={() => {
                      setOfferError(null);
                      window.location.href = '/registration';
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Registrazione Standard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {!offerError && !registrationCompleted && !(currentUser && loadingProfile) && (
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-8">
          <StepIndicator 
            steps={dynamicSteps} 
            currentStep={currentStep}
            progressPercentage={progressPercentage}
            getStepProgress={getStepProgress}
            onStepClick={goToStep}
            canNavigateToStep={canNavigateToStep}
          />
          
          {/* Help message when current step is not complete */}
          {!isStepValid(currentStep) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-amber-800 text-sm">
                  Completa tutti i campi obbligatori in questo step per procedere al successivo.
                </p>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Form content */}
        {!offerError && !(currentUser && loadingProfile) && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-8 md:p-12">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {dynamicSteps[currentStep]?.title}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Step {currentStep + 1} di {dynamicSteps.length} - Inserisci le informazioni richieste
              </p>
            </div>

            {/* Form step content with animation */}
            <div className="min-h-[300px] sm:min-h-[400px] transition-all duration-300 ease-in-out">
              {renderCurrentStep()}
            </div>
          </div>
          
          {/* Bottom navigation */}
          {!registrationCompleted && (
          <div className="bg-gray-50 px-4 sm:px-8 md:px-12 py-4 sm:py-6 border-t">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
              <button
                onClick={prevStep}
                disabled={isFirstStep}
                className={`
                  w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base
                  ${isFirstStep 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:shadow-md'
                  }
                `}
              >
                ← Indietro
              </button>
              
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                
                <div className="text-xs sm:text-sm text-gray-500 font-medium text-center sm:text-left">
                  Step {currentStep + 1} di {dynamicSteps.length}
                </div>
              </div>
              
              <button
                onClick={dynamicIsLastStep ? handleFinalSubmit : handleNextStep}
                disabled={!isStepValid(currentStep)}
                className={`
                  w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base
                  ${!isStepValid(currentStep)
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : dynamicIsLastStep 
                      ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg' 
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-lg'
                  }
                `}
              >
                {dynamicIsLastStep ? 'Completa Iscrizione' : 'Continua →'}
              </button>
            </div>
          </div>
          )}
        </div>
        )}

        {!offerError && (
        <div className="text-center mt-6">
          <div className="inline-flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            I tuoi dati vengono salvati automaticamente
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Hai completato {progressPercentage}% del form di registrazione
          </div>
        </div>
        )}
      </div>

    </div>
  );
};

export default MultiStepForm;