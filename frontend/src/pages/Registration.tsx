import React, { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MultiStepForm from '../components/Registration/MultiStepForm';
import { verifyEmail } from '../services/api';

const Registration: React.FC = () => {
  const { referralCode } = useParams<{ referralCode?: string }>();
  const location = useLocation();

  useEffect(() => {
    const handleEmailVerification = async () => {
      const urlParams = new URLSearchParams(location.search);
      const token = urlParams.get('token');
      const email = urlParams.get('email');

      if (token && email) {
        try {
          await verifyEmail(token, email);
          // Clear the URL params after successful verification
          const newUrl = location.pathname + (location.hash || '');
          window.history.replaceState({}, '', newUrl);
        } catch (error) {
          console.error('Email verification failed:', error);
        }
      }
    };

    handleEmailVerification();
  }, [location]);

  return (
    <MultiStepForm referralCode={referralCode} />
  );
};

export default Registration;