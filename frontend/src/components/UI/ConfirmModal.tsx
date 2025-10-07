import React from 'react';
import Portal from './Portal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info' | 'success';
  details?: Array<string>;
  loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  variant = 'info',
  details,
  loading = false
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          headerBg: 'bg-gradient-to-r from-yellow-500 to-amber-600',
          iconBg: 'bg-white bg-opacity-20 backdrop-blur-sm',
          iconColor: 'text-white',
          messageBg: 'bg-yellow-50 border-yellow-200',
          confirmButton: 'bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800',
          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        };
      case 'danger':
        return {
          headerBg: 'bg-gradient-to-r from-red-500 to-red-600',
          iconBg: 'bg-white bg-opacity-20 backdrop-blur-sm',
          iconColor: 'text-white',
          messageBg: 'bg-red-50 border-red-200',
          confirmButton: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
        };
      case 'success':
        return {
          headerBg: 'bg-gradient-to-r from-green-500 to-green-600',
          iconBg: 'bg-white bg-opacity-20 backdrop-blur-sm',
          iconColor: 'text-white',
          messageBg: 'bg-green-50 border-green-200',
          confirmButton: 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        };
      default:
        return {
          headerBg: 'bg-gradient-to-r from-blue-500 to-indigo-600',
          iconBg: 'bg-white bg-opacity-20 backdrop-blur-sm',
          iconColor: 'text-white',
          messageBg: 'bg-blue-50 border-blue-200',
          confirmButton: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
          icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        };
    }
  };

  const styles = getVariantStyles();

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
    onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-black bg-opacity-50 absolute inset-0" onClick={loading ? undefined : onClose}></div>
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className={`relative p-6 rounded-t-2xl ${styles.headerBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 ${styles.iconBg} rounded-xl`}>
                  <svg className={`w-6 h-6 ${styles.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.icon} />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">
                  {title}
                </h3>
              </div>
              {!loading && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className={`p-4 rounded-xl mb-4 border ${styles.messageBg}`}>
              {typeof message === 'string' ? (
                <p className="text-gray-900 font-medium">{message}</p>
              ) : (
                message
              )}
            </div>

            {details && details.length > 0 && (
              <div className="space-y-2 mb-4">
                {details.map((detail, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className={`font-bold ${variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-yellow-600' : 'text-blue-500'}`}>•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-gray-500 italic">
              Sei sicuro di voler procedere?
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 px-6 py-3 text-white rounded-xl transition-all font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${styles.confirmButton}`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Attendere...</span>
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ConfirmModal;