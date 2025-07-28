import { useState, useCallback } from 'react';

export interface EnrollmentData {
  // Course-specific data
  tipoLaurea?: string;
  laureaConseguita?: string;
  laureaConseguitaCustom?: string;
  laureaUniversita?: string;
  laureaData?: string;
  
  // Profession data
  tipoProfessione?: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
  
  // Course selection
  courseId?: string;
  paymentPlan?: string;
  
  // Documents (files)
  cartaIdentita?: File;
  tesseraperSanitaria?: File;
  laurea?: File;
  pergamenaLaurea?: File;
  diplomaMaturita?: File;
  certificatoMedico?: File;
  
  // User data (read-only, pre-populated)
  email?: string;
  cognome?: string;
  nome?: string;
  dataNascita?: string;
  luogoNascita?: string;
  codiceFiscale?: string;
  telefono?: string;
  nomePadre?: string;
  nomeMadre?: string;
  residenzaVia?: string;
  residenzaCitta?: string;
  residenzaProvincia?: string;
  residenzaCap?: string;
  hasDifferentDomicilio?: boolean;
  domicilioVia?: string;
  domicilioCitta?: string;
  domicilioProvincia?: string;
  domicilioCap?: string;
  referralCode?: string;
  sesso?: string;
  provinciaNascita?: string;
}


interface UseEnrollmentFormOptions {
  steps: string[];
  requiredFields: Record<string, string[]>;
  initialData?: Partial<EnrollmentData>;
}

export const useEnrollmentForm = (options: UseEnrollmentFormOptions) => {
  const { steps, requiredFields, initialData } = options;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Partial<EnrollmentData>>(initialData || {});

  const currentStep = steps[currentStepIndex];

  const updateFormData = useCallback((stepData: Partial<EnrollmentData>) => {
    setFormData(prev => ({ ...prev, ...stepData }));
  }, []);

  const isStepValid = useCallback((stepIndex?: number) => {
    const targetIndex = stepIndex !== undefined ? stepIndex : currentStepIndex;
    const stepName = steps[targetIndex];
    const stepRequiredFields = requiredFields[stepName] || [];
    
    // Check if all required fields for this step are filled
    return stepRequiredFields.every(fieldName => {
      const value = formData[fieldName as keyof EnrollmentData];
      if (value === null || value === undefined || value === '') return false;
      if (typeof value === 'string') return value.trim().length > 0;
      return Boolean(value);
    });
  }, [currentStepIndex, steps, requiredFields, formData]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1 && isStepValid()) {
      setCurrentStepIndex(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentStepIndex, steps.length, isStepValid]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
      return true;
    }
    return false;
  }, [steps.length]);

  const resetForm = useCallback(() => {
    setFormData(initialData || {});
    setCurrentStepIndex(0);
  }, [initialData]);

  return {
    currentStep,
    currentStepIndex,
    formData,
    isStepValid: isStepValid(),
    nextStep,
    prevStep,
    goToStep,
    updateFormData,
    resetForm
  };
};