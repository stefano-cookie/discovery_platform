import { useState, useCallback } from 'react';
import { RegistrationData, FormStep } from '../types/registration';

export const useMultiStepForm = (initialData?: Partial<RegistrationData>) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Partial<RegistrationData>>(() => {
    // Carica dati salvati dal localStorage se disponibili
    const saved = localStorage.getItem('registrationForm');
    if (saved) {
      try {
        return { ...JSON.parse(saved), ...initialData };
      } catch {
        return initialData || {};
      }
    }
    return initialData || {};
  });

  const steps: FormStep[] = [
    { id: 'generale', title: 'Dati Generali', isValid: false, isCompleted: false },
    { id: 'residenza', title: 'Residenza', isValid: false, isCompleted: false },
    { id: 'istruzione', title: 'Istruzione', isValid: false, isCompleted: false },
    { id: 'professione', title: 'Professione', isValid: false, isCompleted: false },
    { id: 'documenti', title: 'Documenti', isValid: false, isCompleted: false },
    { id: 'iscrizione', title: 'Iscrizione', isValid: false, isCompleted: false },
  ];

  const updateFormData = useCallback((stepData: Partial<RegistrationData>) => {
    setFormData(prev => {
      const updated = { ...prev, ...stepData };
      // Salva nel localStorage
      localStorage.setItem('registrationForm', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const clearFormData = useCallback(() => {
    setFormData({});
    localStorage.removeItem('registrationForm');
    setCurrentStep(0);
  }, []);

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
    isFirstStep,
    isLastStep,
  };
};