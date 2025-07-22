import React from 'react';

interface CopiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

const CopiedModal: React.FC<CopiedModalProps> = ({ 
  isOpen, 
  onClose,
  title = "Link Copiato!",
  message = "Il link è stato copiato negli appunti"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-black bg-opacity-50 absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg p-6 mx-4 max-w-sm shadow-xl">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 text-center">
          {message}
        </p>
      </div>
    </div>
  );
};

export default CopiedModal;