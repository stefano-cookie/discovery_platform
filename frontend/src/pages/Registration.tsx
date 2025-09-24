import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MultiStepForm from '../components/Registration/MultiStepForm';
import ReferralGatekeeper from '../components/Auth/ReferralGatekeeper';

const Registration: React.FC = () => {
  const { referralCode } = useParams<{ referralCode?: string }>();
  const location = useLocation();
  const [requestedByEmployeeId, setRequestedByEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    // Capture the 'ref' parameter from URL query string
    const searchParams = new URLSearchParams(location.search);
    const refParam = searchParams.get('ref');

    console.log('🔗 REGISTRATION PAGE DEBUG:', {
      referralCode,
      refParam,
      fullUrl: window.location.href,
      searchParams: location.search
    });

    if (refParam) {
      setRequestedByEmployeeId(refParam);
    }
  }, [location.search, referralCode]);

  // Se non c'è referral code, vai direttamente al form (utenti già autenticati)
  if (!referralCode) {
    return <MultiStepForm requestedByEmployeeId={requestedByEmployeeId} />;
  }

  // Se c'è referral code, usa il gatekeeper per gestire l'accesso
  return (
    <ReferralGatekeeper referralCode={referralCode}>
      <MultiStepForm referralCode={referralCode} requestedByEmployeeId={requestedByEmployeeId} />
    </ReferralGatekeeper>
  );
};

export default Registration;