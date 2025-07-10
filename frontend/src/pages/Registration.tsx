import React from 'react';
import { useParams } from 'react-router-dom';
import MultiStepForm from '../components/Registration/MultiStepForm';

const Registration: React.FC = () => {
  const { referralCode } = useParams<{ referralCode?: string }>();

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <MultiStepForm referralCode={referralCode} />
    </div>
  );
};

export default Registration;