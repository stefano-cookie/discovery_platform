import React from 'react';
import OfferManagement from './OfferManagement';
import DocumentManagement from './DocumentManagement';

interface CombinedManagementProps {
  partnerId: string;
}

const CombinedManagement: React.FC<CombinedManagementProps> = ({ partnerId }) => {
  return (
    <div className="w-full space-y-8">
      {/* Gestione Offerte - Altezza fit-content */}
      <div className="w-full">
        <OfferManagement />
      </div>
      
      {/* Gestione Documenti - Occupa tutta la larghezza rimanente */}
      <div className="w-full">
        <DocumentManagement partnerId={partnerId} />
      </div>
    </div>
  );
};

export default CombinedManagement;