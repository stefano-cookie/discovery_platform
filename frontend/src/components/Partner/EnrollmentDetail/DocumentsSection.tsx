import React, { useState } from 'react';
import DocumentManager from '../../Documents/DocumentManager';
import { UserDocument } from '../../Documents/DocumentPreview';
import { PartnerUser } from '../../../types/partner';

interface DocumentsSectionProps {
  user: PartnerUser;
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({ user }) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);

  const handleDocumentChange = (updatedDocuments: UserDocument[]) => {
    setDocuments(updatedDocuments);
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border">
      {/* Header */}
      <div className="w-full px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Documenti ({documents.length})</h3>
              <p className="text-gray-600">Gestione e approvazione documenti utente</p>
            </div>
          </div>
        </div>
      </div>

      {/* Document Manager */}
      <div className="w-full p-6">
        <DocumentManager
          userId={user.id}
          registrationId={user.registrationId || undefined}
          source="partner"
          onDocumentChange={handleDocumentChange}
          allowUpload={true}
          allowDelete={false}
          allowApproval={true}
        />
      </div>

      {/* Partner Info Panel */}
      <div className="w-full px-6 pb-6">
        <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Nuovo workflow documenti:</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li><strong>Checka</strong> i documenti per verificare conformità (senza inviare email)</li>
                <li>Se i documenti non vanno bene, contatta direttamente l'utente</li>
                <li>Se i documenti sono corretti, clicca "Check" per proseguire</li>
                <li>L'approvazione finale sarà effettuata da Discovery</li>
                <li>L'utente riceverà email solo dopo approvazione Discovery</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="w-full px-6 pb-6">
        <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Azioni Rapide</h4>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Contatta Utente
            </button>
            
            <button className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
              Approva Tutti
            </button>
            
            <button className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Report Documenti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentsSection;