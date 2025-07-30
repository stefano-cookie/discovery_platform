import React from 'react';

interface ErrorMessageProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  className?: string;
  onClose?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  type = 'error', 
  className = '', 
  onClose 
}) => {
  const baseClasses = "p-4 rounded-lg border flex items-start space-x-3 animate-fade-in";
  
  const typeStyles = {
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800", 
    info: "bg-blue-50 border-blue-200 text-blue-800"
  };

  const iconStyles = {
    error: "text-red-600",
    warning: "text-yellow-600",
    info: "text-blue-600"
  };

  const icons = {
    error: (
      <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className={`${baseClasses} ${typeStyles[type]} ${className}`}>
      <div className={iconStyles[type]}>
        {icons[type]}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={`${iconStyles[type]} hover:opacity-70 transition-opacity`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;