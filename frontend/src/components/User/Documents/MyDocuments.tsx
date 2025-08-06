import React from 'react';
import UnifiedDocumentManager from '../../Documents/UnifiedDocumentManager';

interface Registration {
  id: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  courseName: string;
  status: string;
}

interface MyDocumentsProps {
  userId: string;
  registrations?: Registration[];
}

const MyDocuments: React.FC<MyDocumentsProps> = ({ userId, registrations = [] }) => {
  // Get the primary registration for document requirements
  const primaryRegistration = registrations.find(reg => reg.status !== 'CANCELLED') || registrations[0];
  const templateType = primaryRegistration?.offerType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA';

  const handleDocumentsChange = () => {
    // Document changes are handled internally by UnifiedDocumentManager
    console.log('Documents updated');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="w-full mb-6">
        <h2 className="text-xl font-bold text-gray-900">I Miei Documenti</h2>
        <p className="text-gray-600 text-sm mb-3">
          I documenti per questa iscrizione. Stato di verifica da parte del partner.
        </p>
        
        {primaryRegistration && (
          <div className="flex items-center space-x-3 mb-4">
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200">
              <span className="mr-2">📋</span>
              {primaryRegistration.courseName}
              <span className="ml-2 text-xs bg-blue-200 px-2 py-0.5 rounded">
                {templateType === 'TFA' ? 'TFA Romania' : 'Certificazioni'}
              </span>
            </div>
          </div>
        )}

      </div>


      {/* Document Manager */}
      <UnifiedDocumentManager
        userId={userId}
        registrationId={primaryRegistration?.id}
        mode="user"
        templateType={templateType}
        allowUpload={true}
        allowApproval={false}
        onDocumentChange={handleDocumentsChange}
      />

      {/* Info Panel */}
      <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Stato documenti:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li><strong>Approvati:</strong> Documenti verificati e accettati dal partner</li>
              <li><strong>In Attesa:</strong> Documenti caricati, in attesa di verifica</li>
              <li><strong>Rifiutati:</strong> Documenti non conformi, da ricaricare</li>
              <li>Ricevi notifiche email per ogni cambio di stato</li>
              <li>I documenti approvati non possono essere eliminati</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyDocuments;