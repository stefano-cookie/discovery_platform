import React from 'react';
import { useMultiStepForm } from '../../hooks/useMultiStepForm';
import StepIndicator from './StepIndicator';
import GeneralDataStep from './FormSteps/GeneralDataStep';
import ResidenceStep from './FormSteps/ResidenceStep';

interface MultiStepFormProps {
  referralCode?: string;
}

const MultiStepForm: React.FC<MultiStepFormProps> = ({ referralCode }) => {
  const {
    currentStep,
    steps,
    formData,
    updateFormData,
    nextStep,
    prevStep,
    goToStep,
    isFirstStep,
    isLastStep,
  } = useMultiStepForm({ referralCode });

  const handleStepComplete = (stepData: any) => {
    updateFormData(stepData);
    nextStep();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <GeneralDataStep
            data={formData}
            onNext={handleStepComplete}
          />
        );
      case 1:
        return (
          <ResidenceStep
            data={formData}
            onNext={handleStepComplete}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Step Istruzione</h3>
            <p className="text-gray-600 mt-2">Da implementare</p>
            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="btn btn-outline">Indietro</button>
              <button onClick={nextStep} className="btn btn-primary">Avanti</button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Step Professione</h3>
            <p className="text-gray-600 mt-2">Da implementare</p>
            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="btn btn-outline">Indietro</button>
              <button onClick={nextStep} className="btn btn-primary">Avanti</button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Step Documenti</h3>
            <p className="text-gray-600 mt-2">Da implementare</p>
            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="btn btn-outline">Indietro</button>
              <button onClick={nextStep} className="btn btn-primary">Avanti</button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="text-center py-8">
            <h3 className="text-lg font-medium">Step Iscrizione</h3>
            <p className="text-gray-600 mt-2">Da implementare</p>
            <div className="flex justify-between mt-6">
              <button onClick={prevStep} className="btn btn-outline">Indietro</button>
              <button className="btn btn-primary">Completa Iscrizione</button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Registrazione Piattaforma Diamante
        </h1>

        <StepIndicator 
          steps={steps} 
          currentStep={currentStep}
          onStepClick={goToStep}
        />

        <div className="mt-8">
          {renderCurrentStep()}
        </div>

        {/* Debug info */}
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs">
          <strong>Debug:</strong> Step {currentStep + 1} / {steps.length}
          <br />
          <strong>Data:</strong> {JSON.stringify(formData, null, 2)}
        </div>
      </div>
    </div>
  );
};

export default MultiStepForm;