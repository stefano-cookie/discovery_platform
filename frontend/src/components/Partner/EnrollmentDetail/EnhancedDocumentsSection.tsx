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

  // Determine template type based on offer type
  const templateType = user.offerType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA';

  return (
    <UnifiedDocumentManager
      userId={user.id}
      registrationId={user.registrationId || undefined}
      mode="partner"
      templateType={templateType}
      allowUpload={true}
      allowApproval={true}
      onDocumentChange={handleDocumentChange}
      registrationStatus={user.status}
    />
  );
};

export default EnhancedDocumentsSection;