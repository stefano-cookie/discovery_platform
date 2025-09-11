import React, { useEffect } from 'react';
import Modal from './Modal';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ 
  isOpen, 
  onClose,
  title = "Errore",
  message = "Si è verificato un errore durante l'operazione",
  autoClose = false,
  autoCloseDelay = 5000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      closeOnOverlayClick={true}
      closeOnEscape={true}
    >
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          {message}
        </p>
        
        {/* Progress bar for auto-close */}
        {autoClose && (
          <div className="w-full bg-gray-200 rounded-full h-1 mb-2">
            <div 
              className="bg-red-600 h-1 rounded-full"
              style={{
                animation: `errorModalShrink ${autoCloseDelay}ms linear forwards`
              }}
            />
          </div>
        )}
        
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            OK
          </button>
        </div>
        
        <style>{`
          @keyframes errorModalShrink {
            from { width: 100%; }
            to { width: 0%; }
          }
        `}</style>
      </div>
    </Modal>
  );
};

export default ErrorModal;