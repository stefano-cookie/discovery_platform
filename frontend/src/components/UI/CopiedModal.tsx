import React from 'react';
import Modal from './Modal';

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
    </Modal>
  );
};

export default CopiedModal;