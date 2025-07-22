import { useState, useCallback, useMemo, useEffect } from 'react';
import { RegistrationData, FormStep } from '../types/registration';

interface StepConfig {
  steps: string[];
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  requiredFields: Record<string, string[]>;
}

interface UseMultiStepFormOptions {
  referralCode?: string;
  initialData?: Partial<RegistrationData>;
  stepConfig?: StepConfig;
}

export const useMultiStepForm = (options: UseMultiStepFormOptions = {}) => {
  const { referralCode, initialData, stepConfig } = options;
  const [currentStep, setCurrentStep] = useState(() => {
    // Carica step salvato dal localStorage
    const savedStep = localStorage.getItem('registrationFormStep');
    return savedStep ? parseInt(savedStep, 10) : 0;
  });
  
  const [formData, setFormData] = useState<Partial<RegistrationData>>(() => {
    // Carica dati salvati dal localStorage se disponibili
    const saved = localStorage.getItem('registrationForm');
    const baseData = { ...initialData, referralCode };
    
    if (saved) {
      try {
        return { ...JSON.parse(saved), ...baseData };
      } catch {
        return baseData || {};
      }
    }
    return baseData || {};
  });

  // Dynamic steps based on offer type (for now we use default configuration)
  // This will be enhanced when we have offer info loaded
  const steps: FormStep[] = [
    { id: 'generale', title: 'Dati Generali', isValid: false, isCompleted: false },
    { id: 'residenza', title: 'Residenza', isValid: false, isCompleted: false },
    { id: 'istruzione', title: 'Istruzione', isValid: false, isCompleted: false },
    { id: 'professione', title: 'Professione', isValid: false, isCompleted: false },
    { id: 'documenti', title: 'Documenti', isValid: false, isCompleted: false },
    { id: 'opzioni', title: 'Opzioni Iscrizione', isValid: false, isCompleted: false },
    { id: 'riepilogo', title: 'Riepilogo', isValid: false, isCompleted: false },
  ];

  const updateFormData = useCallback((stepData: Partial<RegistrationData>) => {
    setFormData(prev => {
      const updated = { ...prev, ...stepData };
      
      // Separa i file dagli altri dati per il salvataggio
      const { 
        cartaIdentita, 
        certificatoTriennale, 
        certificatoMagistrale, 
        pianoStudioTriennale, 
        pianoStudioMagistrale, 
        certificatoMedico, 
        certificatoNascita, 
        diplomoLaurea, 
        pergamenaLaurea, 
        ...otherData 
      } = updated;
      
      // Salva i dati non-file
      localStorage.setItem('registrationForm', JSON.stringify(otherData));
      
      // Salva informazioni sui file
      const fileInfo = {
        cartaIdentita: cartaIdentita instanceof File ? { name: cartaIdentita.name, size: cartaIdentita.size, type: cartaIdentita.type } : null,
        certificatoTriennale: certificatoTriennale instanceof File ? { name: certificatoTriennale.name, size: certificatoTriennale.size, type: certificatoTriennale.type } : null,
        certificatoMagistrale: certificatoMagistrale instanceof File ? { name: certificatoMagistrale.name, size: certificatoMagistrale.size, type: certificatoMagistrale.type } : null,
        pianoStudioTriennale: pianoStudioTriennale instanceof File ? { name: pianoStudioTriennale.name, size: pianoStudioTriennale.size, type: pianoStudioTriennale.type } : null,
        pianoStudioMagistrale: pianoStudioMagistrale instanceof File ? { name: pianoStudioMagistrale.name, size: pianoStudioMagistrale.size, type: pianoStudioMagistrale.type } : null,
        certificatoMedico: certificatoMedico instanceof File ? { name: certificatoMedico.name, size: certificatoMedico.size, type: certificatoMedico.type } : null,
        certificatoNascita: certificatoNascita instanceof File ? { name: certificatoNascita.name, size: certificatoNascita.size, type: certificatoNascita.type } : null,
        diplomoLaurea: diplomoLaurea instanceof File ? { name: diplomoLaurea.name, size: diplomoLaurea.size, type: diplomoLaurea.type } : null,
        pergamenaLaurea: pergamenaLaurea instanceof File ? { name: pergamenaLaurea.name, size: pergamenaLaurea.size, type: pergamenaLaurea.type } : null,
      };
      localStorage.setItem('registrationFormFiles', JSON.stringify(fileInfo));
      
      return updated;
    });
  }, []);

  // Update referralCode in formData when it changes
  useEffect(() => {
    if (referralCode) {
      setFormData(prev => ({ ...prev, referralCode }));
    }
  }, [referralCode]);

  // Calcola progress per step specifico
  const getStepProgress = useCallback((stepIndex: number) => {
    const stepFields = {
      0: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre'],
      1: ['residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap', 'hasDifferentDomicilio', 'domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'],
      2: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData'],
      3: ['tipoProfessione', 'scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia'],
      4: [], // Documenti sono tutti opzionali, non contribuiscono al progress
      5: ['courseId', 'paymentPlan', 'customInstallments'],
      6: ['partnerOfferId', 'couponCode']
    }[stepIndex] || [];

    // Filtra i campi rilevanti per questo step
    const relevantFieldsInStep = stepFields.filter(field => {
      // Campi domicilio sono rilevanti solo se hasDifferentDomicilio === true
      if (['domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'].includes(field)) {
        return formData.hasDifferentDomicilio === true;
      }
      
      // Campi scuola sono rilevanti solo se tipoProfessione === 'Insegnante'
      if (['scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia'].includes(field)) {
        return formData.tipoProfessione === 'Insegnante';
      }
      
      // customInstallments è rilevante solo se paymentPlan === 'custom'
      if (field === 'customInstallments') {
        return formData.paymentPlan === 'custom';
      }
      
      // nomePadre e nomeMadre sono opzionali per certificazioni
      // Per ora manteniamo il comportamento esistente (sempre opzionali)
      if (['nomePadre', 'nomeMadre'].includes(field)) {
        return false;
      }
      
      // partnerOfferId e couponCode sono opzionali
      if (['partnerOfferId', 'couponCode'].includes(field)) {
        return false;
      }
      
      return true;
    });

    const completedInStep = relevantFieldsInStep.filter(field => {
      const value = formData[field as keyof RegistrationData];
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') return value.trim().length > 0;
      if (value instanceof File) return true;
      return Boolean(value);
    });

    return {
      completed: completedInStep.length,
      total: relevantFieldsInStep.length,
      percentage: relevantFieldsInStep.length > 0 ? Math.round((completedInStep.length / relevantFieldsInStep.length) * 100) : 0
    };
  }, [formData]);

  // Valida se uno step è completo e può essere superato
  const isStepValid = useCallback((stepIndex: number) => {
    // Use dynamic step configuration if available
    if (stepConfig && stepConfig.steps[stepIndex]) {
      const currentStepName = stepConfig.steps[stepIndex];
      const stepFields = stepConfig.requiredFields[currentStepName] || [];
      
      // Filter relevant fields based on dynamic conditions
      const relevantFields = stepFields.filter(field => {
        // Campi domicilio sono rilevanti solo se hasDifferentDomicilio === true
        if (['domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'].includes(field)) {
          return formData.hasDifferentDomicilio === true;
        }
        
        // For certification, parent names are not required
        if (stepConfig.offerType === 'CERTIFICATION' && ['nomePadre', 'nomeMadre'].includes(field)) {
          return false;
        }
        
        return true;
      });

      // Check that all relevant fields are completed
      const completedFields = relevantFields.filter(field => {
        const value = formData[field as keyof RegistrationData];
        if (value === null || value === undefined || value === '') return false;
        if (typeof value === 'boolean') return true;
        if (typeof value === 'string') return value.trim().length > 0;
        if (value instanceof File) return true;
        return Boolean(value);
      });

      return completedFields.length === relevantFields.length;
    }

    // Fallback to legacy validation
    const stepFields = {
      0: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'],
      1: ['residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap', 'hasDifferentDomicilio'],
      2: ['tipoLaurea', 'laureaConseguita', 'laureaUniversita', 'laureaData'],
      3: ['tipoProfessione'],
      4: [], // Documenti sono tutti opzionali
      5: ['courseId', 'paymentPlan'],
      6: [] // Riepilogo non ha campi obbligatori
    }[stepIndex] || [];

    // Filtra i campi rilevanti per questo step
    const relevantFields = stepFields.filter(field => {
      // Campi domicilio sono rilevanti solo se hasDifferentDomicilio === true
      if (['domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'].includes(field)) {
        return formData.hasDifferentDomicilio === true;
      }
      
      // Campi scuola sono rilevanti solo se tipoProfessione === 'Insegnante'
      if (['scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia'].includes(field)) {
        return formData.tipoProfessione === 'Insegnante';
      }
      
      // customInstallments è rilevante solo se paymentPlan === 'custom'
      if (field === 'customInstallments') {
        return formData.paymentPlan === 'custom';
      }
      
      return true;
    });

    // Controlla che tutti i campi rilevanti siano compilati
    const completedFields = relevantFields.filter(field => {
      const value = formData[field as keyof RegistrationData];
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') return value.trim().length > 0;
      if (value instanceof File) return true;
      return Boolean(value);
    });

    return completedFields.length === relevantFields.length;
  }, [formData, stepConfig]);

  // Controlla se si può navigare a un determinato step
  const canNavigateToStep = useCallback((targetStep: number) => {
    // Si può sempre andare al primo step
    if (targetStep === 0) return true;
    
    // Si può navigare solo agli step precedenti completati
    for (let i = 0; i < targetStep; i++) {
      if (!isStepValid(i)) {
        return false;
      }
    }
    
    return true;
  }, [isStepValid]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      // Controlla se lo step corrente è valido prima di procedere
      if (isStepValid(currentStep)) {
        const newStep = currentStep + 1;
        setCurrentStep(newStep);
        localStorage.setItem('registrationFormStep', newStep.toString());
        return true; // Avanzamento riuscito
      } else {
        return false;
      }
    }
    return false;
  }, [currentStep, steps.length, isStepValid]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      localStorage.setItem('registrationFormStep', newStep.toString());
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      // Controlla se è possibile navigare a questo step
      if (canNavigateToStep(step)) {
        setCurrentStep(step);
        localStorage.setItem('registrationFormStep', step.toString());
        return true; // Navigazione riuscita
      } else {
        return false;
      }
    }
    return false;
  }, [steps.length, canNavigateToStep]);

  const saveCurrentData = useCallback(() => {
    // Separa i file dagli altri dati
    const { 
      cartaIdentita, 
      certificatoTriennale, 
      certificatoMagistrale, 
      pianoStudioTriennale, 
      pianoStudioMagistrale, 
      certificatoMedico, 
      certificatoNascita, 
      diplomoLaurea, 
      pergamenaLaurea, 
      ...otherData 
    } = formData;
    
    // Salva i dati non-file
    localStorage.setItem('registrationForm', JSON.stringify(otherData));
    localStorage.setItem('registrationFormStep', currentStep.toString());
    
    // Salva informazioni sui file (senza il contenuto binario)
    const fileInfo = {
      cartaIdentita: cartaIdentita instanceof File ? { name: cartaIdentita.name, size: cartaIdentita.size, type: cartaIdentita.type } : null,
      certificatoTriennale: certificatoTriennale instanceof File ? { name: certificatoTriennale.name, size: certificatoTriennale.size, type: certificatoTriennale.type } : null,
      certificatoMagistrale: certificatoMagistrale instanceof File ? { name: certificatoMagistrale.name, size: certificatoMagistrale.size, type: certificatoMagistrale.type } : null,
      pianoStudioTriennale: pianoStudioTriennale instanceof File ? { name: pianoStudioTriennale.name, size: pianoStudioTriennale.size, type: pianoStudioTriennale.type } : null,
      pianoStudioMagistrale: pianoStudioMagistrale instanceof File ? { name: pianoStudioMagistrale.name, size: pianoStudioMagistrale.size, type: pianoStudioMagistrale.type } : null,
      certificatoMedico: certificatoMedico instanceof File ? { name: certificatoMedico.name, size: certificatoMedico.size, type: certificatoMedico.type } : null,
      certificatoNascita: certificatoNascita instanceof File ? { name: certificatoNascita.name, size: certificatoNascita.size, type: certificatoNascita.type } : null,
      diplomoLaurea: diplomoLaurea instanceof File ? { name: diplomoLaurea.name, size: diplomoLaurea.size, type: diplomoLaurea.type } : null,
      pergamenaLaurea: pergamenaLaurea instanceof File ? { name: pergamenaLaurea.name, size: pergamenaLaurea.size, type: pergamenaLaurea.type } : null,
    };
    localStorage.setItem('registrationFormFiles', JSON.stringify(fileInfo));
    
    return true;
  }, [formData, currentStep]);

  const clearFormData = useCallback(() => {
    setFormData({});
    localStorage.removeItem('registrationForm');
    localStorage.removeItem('registrationFormFiles');
    localStorage.removeItem('registrationFormStep');
    setCurrentStep(0);
  }, []);

  // Definisci tutti i campi possibili del form
  const allFormFields = useMemo(() => [
    // Step 1 - Dati Generali (8 campi obbligatori + 2 opzionali)
    'email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono',
    'nomePadre', 'nomeMadre',
    
    // Step 2 - Residenza (4 obbligatori + 4 condizionali)
    'residenzaVia', 'residenzaCitta', 'residenzaProvincia', 'residenzaCap',
    'hasDifferentDomicilio', 'domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap',
    
    // Step 3 - Istruzione (5 campi - laureaConseguitaCustom è opzionale)
    'tipoLaurea', 'laureaConseguita', 'laureaConseguitaCustom', 'laureaUniversita', 'laureaData',
    
    // Step 4 - Professione (4 campi)
    'tipoProfessione', 'scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia',
    
    // Step 5 - Documenti (tutti opzionali, non contano nel progress)
    // 'cartaIdentita', 'certificatoTriennale', 'certificatoMagistrale', 'pianoStudioTriennale', 'pianoStudioMagistrale', 'certificatoMedico', 'certificatoNascita', 'diplomoLaurea', 'pergamenaLaurea',
    
    // Step 6 - Opzioni Iscrizione (3 campi)
    'courseId', 'paymentPlan', 'customInstallments',
    
    // Step 7 - Riepilogo (2 campi)
    'partnerOfferId', 'couponCode'
  ], []);

  // Calcola il progress percentage basato sui campi compilati usando la configurazione dinamica
  const progressPercentage = useMemo(() => {
    // Use dynamic step configuration if available
    if (stepConfig) {
      const allRelevantFields: string[] = [];
      
      // Collect all required fields from all steps in the current configuration
      stepConfig.steps.forEach(stepName => {
        const stepFields = stepConfig.requiredFields[stepName] || [];
        stepFields.forEach(field => {
          // Apply dynamic filtering logic
          let isRelevant = true;
          
          // Campi domicilio sono rilevanti solo se hasDifferentDomicilio === true
          if (['domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'].includes(field)) {
            isRelevant = formData.hasDifferentDomicilio === true;
          }
          
          // Campi scuola sono rilevanti solo se tipoProfessione === 'Insegnante'
          if (['scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia'].includes(field)) {
            isRelevant = formData.tipoProfessione === 'Insegnante';
          }
          
          // customInstallments è rilevante solo se paymentPlan === 'custom'
          if (field === 'customInstallments') {
            isRelevant = formData.paymentPlan === 'custom';
          }
          
          // For certifications, parent names are not required
          if (stepConfig.offerType === 'CERTIFICATION' && ['nomePadre', 'nomeMadre'].includes(field)) {
            isRelevant = false;
          }
          
          // Optional fields are excluded from progress calculation
          if (['partnerOfferId', 'couponCode'].includes(field)) {
            isRelevant = false;
          }
          
          if (isRelevant && !allRelevantFields.includes(field)) {
            allRelevantFields.push(field);
          }
        });
      });

      const completedFields = allRelevantFields.filter(field => {
        const value = formData[field as keyof RegistrationData];
        if (value === null || value === undefined || value === '') return false;
        
        // Per i booleani, consideriamo sempre valido (true o false)
        if (typeof value === 'boolean') return true;
        
        // Per le stringhe, deve essere non vuota
        if (typeof value === 'string') return value.trim().length > 0;
        
        // Per i file, deve esistere
        if (value instanceof File) return true;
        
        return Boolean(value);
      });

      if (allRelevantFields.length === 0) return 100; // Avoid division by zero
      const percentage = (completedFields.length / allRelevantFields.length) * 100;
      return Math.round(percentage);
    }
    
    // Fallback to original logic if no step configuration is provided
    const relevantFields = allFormFields.filter(field => {
      // laureaConseguitaCustom è rilevante solo se laureaConseguita === 'ALTRO'
      if (field === 'laureaConseguitaCustom') {
        return formData.laureaConseguita === 'ALTRO';
      }
      
      // Campi domicilio sono rilevanti solo se hasDifferentDomicilio === true
      if (['domicilioVia', 'domicilioCitta', 'domicilioProvincia', 'domicilioCap'].includes(field)) {
        return formData.hasDifferentDomicilio === true;
      }
      
      // Campi scuola sono rilevanti solo se tipoProfessione === 'Insegnante'
      if (['scuolaDenominazione', 'scuolaCitta', 'scuolaProvincia'].includes(field)) {
        return formData.tipoProfessione === 'Insegnante';
      }
      
      // customInstallments è rilevante solo se paymentPlan === 'custom'
      if (field === 'customInstallments') {
        return formData.paymentPlan === 'custom';
      }
      
      // nomePadre e nomeMadre sono sempre opzionali nel fallback
      if (['nomePadre', 'nomeMadre'].includes(field)) {
        return false;
      }
      
      // partnerOfferId e couponCode sono opzionali
      if (['partnerOfferId', 'couponCode'].includes(field)) {
        return false;
      }
      
      return true;
    });

    const completedFields = relevantFields.filter(field => {
      const value = formData[field as keyof RegistrationData];
      if (value === null || value === undefined || value === '') return false;
      
      // Per i booleani, consideriamo sempre valido (true o false)
      if (typeof value === 'boolean') return true;
      
      // Per le stringhe, deve essere non vuota
      if (typeof value === 'string') return value.trim().length > 0;
      
      // Per i file, deve esistere
      if (value instanceof File) return true;
      
      return Boolean(value);
    });

    if (relevantFields.length === 0) return 100;
    const percentage = (completedFields.length / relevantFields.length) * 100;
    return Math.round(percentage);
  }, [formData, allFormFields, stepConfig]);


  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return {
    currentStep,
    steps,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    clearFormData,
    saveCurrentData,
    isFirstStep,
    isLastStep,
    progressPercentage,
    getStepProgress,
    isStepValid,
    canNavigateToStep,
  };
};