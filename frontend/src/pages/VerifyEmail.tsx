import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

const VerifyEmail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmailToken = async () => {
      const urlParams = new URLSearchParams(location.search);
      const token = urlParams.get('token');
      const email = urlParams.get('email');

      if (!token || !email) {
        setStatus('error');
        setMessage('Link di verifica non valido.');
        return;
      }

      try {
        const response = await authService.verifyEmail({ token, email });
        setStatus('success');
        setMessage(response.message);
        
        // Controlla se c'è un referral code per redirect al form iscrizione
        const referralCode = urlParams.get('referralCode');
        
        // Dopo 3 secondi redirect
        setTimeout(() => {
          if (referralCode) {
            // Redirect al form di iscrizione con auto-login
            navigate(`/registration/${referralCode}?emailVerified=true&email=${encodeURIComponent(email)}`);
          } else {
            // Redirect normale al login
            navigate('/login');
          }
        }, 3000);
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'Errore durante la verifica dell\'email.');
      }
    };

    verifyEmailToken();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Verifica Account in Corso
            </h1>
            <p className="text-gray-600">
              Attendere la conferma dell'attivazione...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Account Attivato con Successo!
            </h1>
            <p className="text-gray-600 mb-4">
              {message}
            </p>
            <p className="text-sm text-gray-500">
              {new URLSearchParams(location.search).get('referralCode') 
                ? 'Verrai reindirizzato al form di iscrizione tra pochi secondi...' 
                : 'Verrai reindirizzato al login tra pochi secondi...'}
            </p>
            <button
              onClick={() => {
                const urlParams = new URLSearchParams(location.search);
                const referralCode = urlParams.get('referralCode');
                const email = urlParams.get('email');
                
                if (referralCode && email) {
                  navigate(`/registration/${referralCode}?emailVerified=true&email=${encodeURIComponent(email)}`);
                } else {
                  navigate('/login');
                }
              }}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              {new URLSearchParams(location.search).get('referralCode') ? 'Continua con l\'Iscrizione' : 'Vai al Login'}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">
              Errore Verifica Account
            </h1>
            <p className="text-gray-600 mb-6">
              {message}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Vai al Login
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full border border-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-50"
              >
                Torna alla Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;