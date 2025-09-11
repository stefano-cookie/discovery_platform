import React from 'react';
import Portal from './Portal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  variant = 'info'
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          icon: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case 'danger':
        return {
          icon: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmButton: 'bg-red-600 hover:bg-red-700'
        };
      default:
        return {
          icon: 'bg-blue-100',
          iconColor: 'text-blue-600',
          confirmButton: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-black bg-opacity-75 absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl p-6 mx-4 max-w-md shadow-2xl transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
        <div className={`flex items-center justify-center w-12 h-12 mx-auto ${styles.icon} rounded-full mb-4`}>
          <svg className={`w-6 h-6 ${styles.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          {message}
        </p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white text-sm font-medium rounded-lg ${styles.confirmButton} transition-colors`}
          >
            {confirmText}
          </button>
        </div>
        </div>
      </div>
    </Portal>
  );
};

export default ConfirmModal;