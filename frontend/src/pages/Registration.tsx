import React from 'react';
import { useParams } from 'react-router-dom';
import MultiStepForm from '../components/Registration/MultiStepForm';
import ReferralGatekeeper from '../components/Auth/ReferralGatekeeper';

const Registration: React.FC = () => {
  const { referralCode } = useParams<{ referralCode?: string }>();

  // Se non c'è referral code, vai direttamente al form (utenti già autenticati)
  if (!referralCode) {
    return <MultiStepForm />;
  }

  // Se c'è referral code, usa il gatekeeper per gestire l'accesso
  return (
    <ReferralGatekeeper referralCode={referralCode}>
      <MultiStepForm referralCode={referralCode} />
    </ReferralGatekeeper>
  );
};

export default Registration;