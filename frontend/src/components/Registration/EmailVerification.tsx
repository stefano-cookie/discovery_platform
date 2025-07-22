import React, { useState, useEffect } from 'react';
import { sendEmailVerification, checkEmailVerification } from '../../services/api';

interface EmailVerificationProps {
  email: string;
  referralCode?: string;
  onVerificationChange: (verified: boolean) => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ 
  email, 
  referralCode, 
  onVerificationChange 
}) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkVerificationStatus = async () => {
    try {
      const result = await checkEmailVerification(email);
      setIsVerified(result.verified);
      onVerificationChange(result.verified);
    } catch (err) {
      console.error('Error checking verification status:', err);
    }
  };

  // Check verification status when email changes
  useEffect(() => {
    if (email) {
      checkVerificationStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]); // Only depend on email to avoid infinite loops

  const handleSendVerification = async () => {
    if (!email) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await sendEmailVerification(email, referralCode);
      setIsSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante l\'invio dell\'email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerified) {
    return (
      <div className="flex items-center space-x-2 text-green-600">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-medium">Email verificata</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={handleSendVerification}
          disabled={isLoading || !email}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isLoading ? 'Invio...' : 'Verifica Email'}
        </button>
        
        {isSent && (
          <div className="flex items-center space-x-2 text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <span className="text-sm font-medium">Email di verifica inviata!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {isSent && !isVerified && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-blue-800 text-sm">
              <p className="font-medium mb-1">Controlla la tua email</p>
              <p>Ti abbiamo inviato un link di verifica. Clicca sul link nell'email per verificare il tuo indirizzo.</p>
              <p className="mt-2 text-xs">Il link è valido per 24 ore.</p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={checkVerificationStatus}
        className="text-sm text-blue-600 hover:text-blue-700 underline"
      >
Aggiorna stato verifica
      </button>
    </div>
  );
};

export default EmailVerification;