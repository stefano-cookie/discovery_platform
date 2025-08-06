import React from 'react';
import { PartnerUser } from '../../../types/partner';
import UnifiedDocumentManager from '../../Documents/UnifiedDocumentManager';

interface EnhancedDocumentsSectionProps {
  user: PartnerUser;
}

const EnhancedDocumentsSection: React.FC<EnhancedDocumentsSectionProps> = ({ user }) => {
  const handleDocumentChange = () => {
    // Refresh can be handled by the UnifiedDocumentManager internally
    console.log('Document changed for user:', user.id);
  };

  return (
    <UnifiedDocumentManager
      userId={user.id}
      registrationId={user.registrationId}
      mode="partner"
      templateType="TFA"
      allowUpload={true}
      allowApproval={true}
      onDocumentChange={handleDocumentChange}
    />
  );
};

export default EnhancedDocumentsSection;