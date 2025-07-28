import React from 'react';
import { FormStep } from '../../types/registration';

interface StepIndicatorProps {
  steps: FormStep[];
  currentStep: number;
  progressPercentage: number;
  getStepProgress: (stepIndex: number) => { completed: number; total: number; percentage: number };
  onStepClick?: (step: number) => void;
  canNavigateToStep?: (step: number) => boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ 
  steps, 
  currentStep,
  progressPercentage,
  getStepProgress,
  onStepClick,
  canNavigateToStep 
}) => {
  // Calculate step-based progress for visual alignment
  const stepProgressPercentage = steps.length > 1 
    ? Math.min(((currentStep) / (steps.length - 1)) * 100, 100)
    : currentStep > 0 ? 100 : 0;

  return (
    <div className="mb-6 sm:mb-8">
      {/* Step indicator with aligned progress bar */}
      <div className="relative mb-6 sm:mb-8">
        {/* Background line */}
        <div className="absolute top-6 left-6 right-6 h-1 bg-gray-200 rounded-full"></div>
        
        {/* Progress line - aligned to step positions */}
        <div 
          className="absolute top-6 left-6 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
          style={{ 
            width: steps.length > 1 
              ? `calc(${stepProgressPercentage}% - ${stepProgressPercentage * 0.12}px)`
              : `${stepProgressPercentage}%`
          }}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-50 blur-sm animate-pulse"></div>
        </div>
        
        {/* Steps container */}
        <div className="relative z-10 flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const canNavigate = canNavigateToStep ? canNavigateToStep(index) : true;
            const isDisabled = !canNavigate && !isCurrent;
            
            return (
              <div
                key={step.id}
                className={`
                  flex flex-col items-center group transition-all duration-200
                  ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105'}
                `}
                onClick={() => {
                  if (!isDisabled && onStepClick) {
                    onStepClick(index);
                  }
                }}
              >
                {/* Circle */}
                <div 
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg relative
                    ${isCompleted 
                      ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-110' 
                      : isCurrent 
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white scale-125 shadow-xl' 
                        : isDisabled
                          ? 'bg-gray-200 border-2 border-gray-300 text-gray-400'
                          : 'bg-white border-2 border-gray-300 text-gray-500 hover:border-blue-300'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span className="font-semibold text-lg">{index + 1}</span>
                  )}
                  
                  {/* Current step pulse animation */}
                  {isCurrent && (
                    <div className="absolute inset-0 w-12 h-12 rounded-full bg-blue-400 animate-ping opacity-20"></div>
                  )}
                </div>
                
                {/* Step title */}
                <div className={`
                  mt-3 text-center transition-all duration-300 px-2 max-w-24
                  ${isCurrent ? 'text-blue-600 font-semibold' : isCompleted ? 'text-green-600 font-medium' : isDisabled ? 'text-gray-400' : 'text-gray-500'}
                `}>
                  <div className="text-xs sm:text-sm font-medium leading-tight">
                    {step.title}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Progress information */}
      <div className="space-y-2">
        {/* Overall progress */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Progresso completamento form</span>
          <span className="font-semibold text-blue-600 transition-all duration-500">
            {progressPercentage}%
          </span>
        </div>
        
      </div>
    </div>
  );
};

export default StepIndicator;