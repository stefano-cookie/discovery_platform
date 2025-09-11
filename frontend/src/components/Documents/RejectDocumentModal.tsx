import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../UI/Modal';

interface RejectDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, details?: string) => void;
  documentName: string;
}

const RejectDocumentModal: React.FC<RejectDocumentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  documentName
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [details, setDetails] = useState('');

  const predefinedReasons = [
    'Documento non leggibile o di scarsa qualità',
    'Formato file non supportato o corrotto',
    'Documento scaduto o non valido',
    'Informazioni incomplete o illeggibili',
    'Documento non corrispondente al tipo richiesto',
    'Presenza di dati sensibili non oscurati',
    'Dimensione file eccessiva',
    'Altro (specificare nel campo dettagli)'
  ];

  const handleConfirm = () => {
    const finalReason = selectedReason === 'Altro (specificare nel campo dettagli)' 
      ? customReason.trim() 
      : selectedReason;

    if (!finalReason) {
      alert('Seleziona o inserisci un motivo per il rifiuto');
      return;
    }

    onConfirm(finalReason, details.trim() || undefined);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setSelectedReason('');
    setCustomReason('');
    setDetails('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Rifiuta Documento"
      size="md"
      closeOnOverlayClick={false}
      closeOnEscape={true}
    >
      {/* Header Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Specificare il motivo del rifiuto</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Document Info */}
        <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-red-400">
          <p className="text-sm text-gray-700">
            <strong>Documento:</strong> {documentName}
          </p>
        </div>

        {/* Reason Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Motivo del rifiuto *
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {predefinedReasons.map((reason, index) => (
              <label key={index} className="flex items-start">
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-3 text-sm text-gray-700">{reason}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom Reason Input */}
        {selectedReason === 'Altro (specificare nel campo dettagli)' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo personalizzato *
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Inserisci il motivo specifico..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
            />
          </div>
        )}

        {/* Additional Details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dettagli aggiuntivi (opzionale)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Aggiungi eventuali note o istruzioni per l'utente..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
          />
        </div>

        {/* Warning Message */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800">
                <strong>Nota:</strong> L'utente riceverà una notifica email automatica 
                con il motivo del rifiuto e dovrà ricaricare il documento.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleClose}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Annulla
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Rifiuta Documento
        </button>
      </div>
    </Modal>
  );
};

export default RejectDocumentModal;