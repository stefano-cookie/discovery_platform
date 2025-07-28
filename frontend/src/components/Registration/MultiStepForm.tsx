import React, { useState, useEffect, useMemo } from 'react';
import { useMultiStepForm } from '../../hooks/useMultiStepForm';
import { OfferService } from '../../services/offerService';
import { OfferInfo } from '../../types/offers';
import { useAuth } from '../../hooks/useAuth';
import { apiRequest } from '../../services/api';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const [enrollmentCompleted, setEnrollmentCompleted] = useState(false);
  const [offerInfo, setOfferInfo] = useState<OfferInfo | null>(null);
  const [, setLoadingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  // Gestisce utenti verificati via email
  const urlParams = new URLSearchParams(location.search);
  const emailVerified = urlParams.get('emailVerified');
  const verifiedEmail = urlParams.get('email');
  
  const stepConfig = useMemo(() => {
    // Gli utenti NON autenticati vengono reindirizzati alla registrazione
    // Qui gestiamo solo gli utenti GIA' REGISTRATI che fanno l'iscrizione
    
    // Controlla se l'utente ha già un profilo (autenticato o verificato via email)
    const hasExistingProfile = !!(currentUser || emailVerified === 'true');
    
    // Il DATABASE offerType ha PRECEDENZA sul riconoscimento del nome
    // Determina il tipo corretto basandosi prima su offerType, poi sul nome
    const actualOfferType = offerInfo?.offerType || 'TFA_ROMANIA';
    const isTfaRomania = actualOfferType === 'TFA_ROMANIA' || 
                         (actualOfferType === 'CERTIFICATION' && 
                          (offerInfo?.name?.includes('TFA') || offerInfo?.name?.includes('Corso di Formazione Diamante')));
    
    
    if (actualOfferType === 'CERTIFICATION' && !isTfaRomania) {
      // Form certificazioni: per utenti già registrati salta direttamente a documenti
      return {
        steps: ['documenti', 'opzioni', 'riepilogo'],
        offerType: 'CERTIFICATION' as const,
        requiredFields: {
          // Non include più i dati base perché l'utente è già registrato
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    }
    
    // Form TFA Romania: per utenti già registrati aggiungi step per dati TFA mancanti
    if (hasExistingProfile) {
      // Utente già registrato - aggiungi mini-step per dati TFA specifici (padre/madre)
      return {
        steps: ['datiFamiliari', 'istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo'],
        offerType: actualOfferType as 'TFA_ROMANIA' | 'CERTIFICATION',
        requiredFields: {
          datiFamiliari: ['nomePadre', 'nomeMadre'], // Solo i dati mancanti per TFA
          istruzione: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData', 'tipoLaureaTriennale', 'laureaConseguitaTriennale', 'laureaUniversitaTriennale', 'laureaDataTriennale'],
          professione: ['tipoProfessione'],
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    } else {
      // Utente non registrato - mostra tutti gli step (caso legacy)
      return {
        steps: ['generale', 'istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo'],
        offerType: actualOfferType as 'TFA_ROMANIA' | 'CERTIFICATION',
        requiredFields: {
          generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre', 'residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap'],
          istruzione: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData', 'tipoLaureaTriennale', 'laureaConseguitaTriennale', 'laureaUniversitaTriennale', 'laureaDataTriennale'],
          professione: ['tipoProfessione'],
          documenti: [],
          opzioni: ['courseId', 'paymentPlan'],
          riepilogo: []
        }
      };
    }
  }, [offerInfo, currentUser, emailVerified]);

  // Convert user profile to form data
  const initialFormData = useMemo(() => {
    if (!userProfile) return undefined;
    
    // Handle different userProfile structures
    // For authenticated users: userProfile.profile contains the profile
    // For email-verified users: userProfile.profile contains the profile, userProfile.user contains user data
    const profileData = userProfile.profile || userProfile;
    const userData = userProfile.user || currentUser;
    
    // Convert profile data to form format
    return {
      // Email comes from user object OR from verified email for email-verified users
      email: userData?.email || verifiedEmail || '',
      // General data
      cognome: profileData.cognome || '',
      nome: profileData.nome || '',
      dataNascita: profileData.dataNascita ? (() => {
        try {
          return new Date(profileData.dataNascita).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      luogoNascita: profileData.luogoNascita || '',
      codiceFiscale: profileData.codiceFiscale || '',
      telefono: profileData.telefono || '',
      nomePadre: profileData.nomePadre || '',
      nomeMadre: profileData.nomeMadre || '',
      // Note: sesso and provinciaNascita are not in UserProfile schema - will be empty and editable
      sesso: '',
      provinciaNascita: '',
      // Residence data
      residenzaVia: profileData.residenzaVia || '',
      residenzaCitta: profileData.residenzaCitta || '',
      residenzaProvincia: profileData.residenzaProvincia || '',
      residenzaCap: profileData.residenzaCap || '',
      hasDifferentDomicilio: profileData.hasDifferentDomicilio || false,
      domicilioVia: profileData.domicilioVia || '',
      domicilioCitta: profileData.domicilioCitta || '',
      domicilioProvincia: profileData.domicilioProvincia || '',
      domicilioCap: profileData.domicilioCap || '',
      // Education data
      tipoLaurea: profileData.tipoLaurea || '',
      laureaConseguita: profileData.laureaConseguita || '',
      laureaConseguitaCustom: profileData.laureaConseguitaCustom || '',
      laureaUniversita: profileData.laureaUniversita || '',
      laureaData: profileData.laureaData ? (() => {
        try {
          return new Date(profileData.laureaData).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      // Triennale education data
      tipoLaureaTriennale: profileData.tipoLaureaTriennale || '',
      laureaConseguitaTriennale: profileData.laureaConseguitaTriennale || '',
      laureaUniversitaTriennale: profileData.laureaUniversitaTriennale || '',
      laureaDataTriennale: profileData.laureaDataTriennale ? (() => {
        try {
          return new Date(profileData.laureaDataTriennale).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      // Profession data
      tipoProfessione: profileData.tipoProfessione || '',
      scuolaDenominazione: profileData.scuolaDenominazione || '',
      scuolaCitta: profileData.scuolaCitta || '',
      scuolaProvincia: profileData.scuolaProvincia || '',
      // Add referral code if present
      referralCode: referralCode || ''
    };
  }, [userProfile, currentUser, referralCode, verifiedEmail]);

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
    // For forms with validation, trigger submit instead of direct nextStep
    const currentStepName = stepConfig?.steps[currentStep];
    
    if (currentStepName === 'istruzione') {
      // Trigger the form submit for education step
      const educationForm = document.getElementById('education-form') as HTMLFormElement;
      if (educationForm) {
        educationForm.requestSubmit();
        return;
      }
    }
    
    const success = nextStep();
    if (!success) {
      // Alert user that all required fields must be completed
      console.log('Cannot proceed: required fields not completed');
    }
  };

  const handleFinalSubmit = () => {
    if ((window as any).submitEnrollmentForm) {
      (window as any).submitEnrollmentForm();
    } else {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };
  
  const handleEnrollmentSuccess = () => {
    setEnrollmentCompleted(true);
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

  // Load user profile when user is authenticated OR verified via email
  useEffect(() => {
    const loadUserProfile = async () => {
      // Se l'utente è autenticato, usa l'API normale
      if (currentUser) {
        try {
          setLoadingProfile(true);
          const response = await apiRequest<{user: any; profile: any; assignedPartner: any}>({
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
        return;
      }

      // Se l'utente arriva da verifica email, carica il profilo con l'email
      if (emailVerified === 'true' && verifiedEmail) {
        try {
          setLoadingProfile(true);
          
          const response = await apiRequest<{user: any; profile: any; assignedPartner: any}>({
            method: 'POST',
            url: '/user/profile-by-email',
            data: { email: verifiedEmail }
          });

          setUserProfile(response);
          
          // Pre-popola i dati del form se disponibili
          if (response.profile) {
            updateFormData({
              // Email dall'utente verificato
              email: verifiedEmail || '',
              // Dati anagrafici dal profilo
              cognome: response.profile.cognome || '',
              nome: response.profile.nome || '',
              dataNascita: response.profile.dataNascita ? new Date(response.profile.dataNascita).toISOString().split('T')[0] : '',
              luogoNascita: response.profile.luogoNascita || '',
              codiceFiscale: response.profile.codiceFiscale || '',
              telefono: response.profile.telefono || '',
              nomePadre: response.profile.nomePadre || '',
              nomeMadre: response.profile.nomeMadre || '',
              // Dati residenza
              residenzaVia: response.profile.residenzaVia || '',
              residenzaCitta: response.profile.residenzaCitta || '',
              residenzaProvincia: response.profile.residenzaProvincia || '',
              residenzaCap: response.profile.residenzaCap || '',
              hasDifferentDomicilio: response.profile.hasDifferentDomicilio || false,
              domicilioVia: response.profile.domicilioVia || '',
              domicilioCitta: response.profile.domicilioCitta || '',
              domicilioProvincia: response.profile.domicilioProvincia || '',
              domicilioCap: response.profile.domicilioCap || '',
              // Dati istruzione esistenti dal profilo (se presenti)
              tipoLaurea: response.profile.tipoLaurea || '',
              laureaConseguita: response.profile.laureaConseguita || '',
              laureaConseguitaCustom: response.profile.laureaConseguitaCustom || '',
              laureaUniversita: response.profile.laureaUniversita || '',
              laureaData: response.profile.laureaData ? new Date(response.profile.laureaData).toISOString().split('T')[0] : '',
              // Dati triennale dal profilo (se presenti)
              tipoLaureaTriennale: response.profile.tipoLaureaTriennale || '',
              laureaConseguitaTriennale: response.profile.laureaConseguitaTriennale || '',
              laureaUniversitaTriennale: response.profile.laureaUniversitaTriennale || '',
              laureaDataTriennale: response.profile.laureaDataTriennale ? new Date(response.profile.laureaDataTriennale).toISOString().split('T')[0] : '',
              // Dati professione dal profilo (se presenti)
              tipoProfessione: response.profile.tipoProfessione || '',
              scuolaDenominazione: response.profile.scuolaDenominazione || '',
              scuolaCitta: response.profile.scuolaCitta || '',
              scuolaProvincia: response.profile.scuolaProvincia || ''
            });
          }
        } catch (error) {
          console.error('Errore recupero profilo utente verificato:', error);
          // Non mostrare errore all'utente, semplicemente non pre-popola
          setUserProfile(null);
        } finally {
          setLoadingProfile(false);
        }
        return;
      }

      // Nessun utente autenticato o verificato
      setUserProfile(null);
    };

    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, emailVerified, verifiedEmail]);



  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (Object.keys(formData).length > 0) {
        saveCurrentData();
      }
    }, 30000); // 30 secondi

    return () => clearInterval(autoSaveInterval);
  }, [formData, saveCurrentData]);

  // Clear any stale additional enrollment data on mount if not coming from dashboard
  useEffect(() => {
    const isAdditionalEnrollment = localStorage.getItem('isAdditionalEnrollment') === 'true';
    const referralFromStorage = localStorage.getItem('registrationReferralCode');
    
    // If we have a referral code that doesn't match storage and there's additional enrollment data,
    // it means user navigated to a different registration - clear the additional enrollment data
    if (referralCode && referralFromStorage !== referralCode && isAdditionalEnrollment) {
      localStorage.removeItem('registrationFormData');
      localStorage.removeItem('isAdditionalEnrollment');
      localStorage.removeItem('userDocuments');
    }
  }, [referralCode]);

  const shouldShowStep = (stepName: string) => stepConfig.steps.includes(stepName);
  
  // Create dynamic steps with titles for the UI
  const dynamicSteps = stepConfig.steps.map((stepId) => {
    const stepTitles = {
      'generale': 'Dati Generali',
      'datiFamiliari': 'Dati Familiari',
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
      case 'datiFamiliari':
        return (
          <GeneralDataStep
            data={formData}
            onNext={handleStepComplete}
            onChange={updateFormData}
            referralCode={referralCode}
            offerType={stepConfig.offerType}
            requiredFields={stepConfig.requiredFields.datiFamiliari || []}
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
            onNext={handleEnrollmentSuccess}
            onChange={updateFormData}
            offerInfo={offerInfo}
          />
        );
      default:
        return null;
    }
  };

  // SECURITY: This component is for authenticated users OR users verified via email
  // Non-authenticated users should be handled by ReferralGatekeeper → RegistrationModal
  if (!currentUser && emailVerified !== 'true') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Accesso Negato</h1>
          <p className="text-gray-600 mb-6">
            Devi essere autenticato per accedere alla pagina di iscrizione al corso.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Vai al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Iscrizione <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Diamante</span>
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
              Completa la tua iscrizione al corso in pochi semplici passaggi
            </p>
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

        {/* Enrollment Notice for Authenticated Users */}
        {currentUser && userProfile && !loadingProfile && (
          <div className="bg-green-50 border border-green-200 rounded-2xl shadow-xl p-6 mb-4 sm:mb-8">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-green-600 mt-0.5 mr-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Benvenuto, {userProfile.nome}!</h3>
                <p className="text-green-700 text-sm mb-2">
                  Stai completando una nuova iscrizione al corso. I tuoi dati anagrafici sono già salvati nel sistema.
                </p>
                <p className="text-green-600 text-sm">
                  Dovrai completare solo i passaggi specifici per questo corso.
                </p>
              </div>
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
        {!offerError && !enrollmentCompleted && !(currentUser && loadingProfile) && (
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
                Inserisci le informazioni richieste
              </p>
            </div>

            {/* Form step content with animation */}
            <div className="min-h-[300px] sm:min-h-[400px] transition-all duration-300 ease-in-out">
              {renderCurrentStep()}
            </div>
          </div>
          
          {/* Bottom navigation */}
          {!enrollmentCompleted && (
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
                
              </div>
              
              <button
                onClick={() => {
                  if (dynamicIsLastStep) {
                    handleFinalSubmit();
                  } else {
                    handleNextStep();
                  }
                }}
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
            Hai completato {progressPercentage}% del form di iscrizione
          </div>
        </div>
        )}
      </div>

    </div>
  );
};

export default MultiStepForm;