import React from 'react';
import UnifiedDocumentManager from '../../Documents/UnifiedDocumentManager';
import { useAuth } from '../../../hooks/useAuth';

interface DocumentsSectionProps {
  onDocumentChange?: () => void;
}

const DocumentsSection: React.FC<DocumentsSectionProps> = ({ onDocumentChange }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Caricamento...</span>
      </div>
    );
  }

  return (
    <div>
      <UnifiedDocumentManager
        userId={user.id}
        mode="user"
        templateType="TFA"
        allowUpload={true}
        allowApproval={false}
        onDocumentChange={onDocumentChange}
      />
    </div>
  );
};

export default DocumentsSection;