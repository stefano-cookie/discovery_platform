import React, { useState } from 'react';
import RejectDocumentModal from './RejectDocumentModal';

const RejectModalDemo: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  const handleReject = (reason: string, details?: string) => {
    console.log('Document rejected:', { reason, details });
    alert(`Documento rifiutato!\nMotivo: ${reason}${details ? `\nDettagli: ${details}` : ''}`);
  };

  return (
    <div className="p-8">
      <button
        onClick={() => setShowModal(true)}
        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        Testa Modal Rifiuto Documento
      </button>

      <RejectDocumentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleReject}
        documentName="Tessera Sanitaria / Codice Fiscale"
      />
    </div>
  );
};

export default RejectModalDemo;