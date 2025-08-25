import React, { useEffect } from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ 
  isOpen, 
  onClose,
  title = "Operazione Completata!",
  message = "L'operazione è stata completata con successo",
  autoClose = true,
  autoCloseDelay = 3000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-black bg-opacity-75 absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl p-6 mx-4 max-w-sm shadow-2xl transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
              className="bg-green-600 h-1 rounded-full"
              style={{
                animation: `successModalShrink ${autoCloseDelay}ms linear forwards`
              }}
            />
          </div>
        )}
        
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes successModalShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default SuccessModal;