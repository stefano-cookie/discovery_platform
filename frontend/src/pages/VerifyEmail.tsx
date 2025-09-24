import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { apiRequest } from '../services/api';

const VerifyEmail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  
  const generateSecureAccess = async (email: string, referralCode: string) => {
    try {
      // Extract employee ID from referral code if present (format: REFERRALCODE?ref=EMPLOYEEID)
      const url = new URL(window.location.origin + '/dummy');
      url.search = referralCode.includes('?') ? referralCode.split('?')[1] : '';
      const employeeId = url.searchParams.get('ref');
      const cleanReferralCode = referralCode.split('?')[0];

      console.log('🔗 [FRONTEND] Extracted employeeId:', employeeId, 'from referralCode:', referralCode);

      const response = await apiRequest<{accessToken: string}>({
        method: 'POST',
        url: '/auth/generate-access-token',
        data: {
          email,
          referralCode: cleanReferralCode,
          employeeId
        }
      });
      
      // Redirect al form di iscrizione con token sicuro
      navigate(`/registration/${cleanReferralCode}?token=${response.accessToken}`);
    } catch (error: any) {
      console.error('Error generating secure access:', error);
      // Fallback to login if token generation fails
      navigate('/login');
    }
  };

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
        setTimeout(async () => {
          if (referralCode && email) {
            // Attendi un attimo extra per assicurarsi che il database sia aggiornato
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try {
              // Prova a generare token sicuro per accesso al form
              await generateSecureAccess(email, referralCode);
            } catch (error) {
              console.error('Fallback: unable to generate secure token, redirecting to registration directly');
              // Fallback: redirect diretto al form di registrazione senza token sicuro
              const cleanReferralCode = referralCode.split('?')[0];
              navigate(`/registration/${cleanReferralCode}?email=${encodeURIComponent(email)}`);
            }
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-4">
      <div className="max-w-lg w-full bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="relative mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Verifica Account in Corso
            </h1>
            <p className="text-gray-600 mb-4">
              Attendere la conferma dell'attivazione...
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-blue-800 text-sm">
                Stiamo verificando le tue credenziali, questo richiederà solo pochi secondi.
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <div className="relative overflow-hidden">
            {/* Success animation background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/50 to-emerald-200/30 rounded-lg"></div>
            
            <div className="relative z-10">
              {/* Animated success icon */}
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-full"></div>
                  <svg className="w-12 h-12 text-white animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                
                {/* Celebration particles */}
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="flex space-x-1 opacity-80">
                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" style={{animationDelay: '0s'}}></div>
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" style={{animationDelay: '0.3s'}}></div>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" style={{animationDelay: '0.6s'}}></div>
                  </div>
                </div>
              </div>
              
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                🎉 Account Attivato con Successo!
              </h1>
              
              {/* Success message */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
                <p className="text-green-800 font-medium">
                  {message}
                </p>
              </div>
              
              {/* Next steps card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414-1.414L9 7.586 7.707 6.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-semibold text-gray-900 mb-1">Prossimo Passo</h3>
                    <p className="text-gray-700 text-sm mb-3">
                      {new URLSearchParams(location.search).get('referralCode') 
                        ? 'Procediamo con la tua iscrizione al corso!' 
                        : 'Accedi al tuo account per continuare'}
                    </p>
                    
                    {/* Auto redirect indicator */}
                    <div className="flex items-center text-xs text-gray-600 mb-4">
                      <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reindirizzamento automatico in corso...</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action button */}
              <button
                onClick={async () => {
                  const urlParams = new URLSearchParams(location.search);
                  const referralCode = urlParams.get('referralCode');
                  const email = urlParams.get('email');
                  
                  if (referralCode && email) {
                    try {
                      await generateSecureAccess(email, referralCode);
                    } catch (error) {
                      console.error('Fallback: unable to generate secure token, redirecting to registration directly');
                      const cleanReferralCode = referralCode.split('?')[0];
                      navigate(`/registration/${cleanReferralCode}?email=${encodeURIComponent(email)}`);
                    }
                  } else {
                    navigate('/login');
                  }
                }}
                className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {new URLSearchParams(location.search).get('referralCode') ? 'Continua con l\'Iscrizione' : 'Vai al Login'}
                </div>
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="relative overflow-hidden">
            {/* Error background */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-100/50 to-orange-200/30 rounded-lg"></div>
            
            <div className="relative z-10">
              {/* Error icon */}
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-500 rounded-full mx-auto flex items-center justify-center shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full"></div>
                  <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              {/* Error heading */}
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                ⚠️ Errore Verifica Account
              </h1>
              
              {/* Error message */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
                <p className="text-red-800 font-medium">
                  {message}
                </p>
              </div>
              
              {/* Help section */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Cosa puoi fare:</h3>
                <ul className="text-gray-700 text-sm space-y-1 text-left">
                  <li>• Verifica che il link sia corretto</li>
                  <li>• Controlla che il link non sia scaduto</li>
                  <li>• Richiedi un nuovo link di verifica</li>
                  <li>• Contatta il supporto se il problema persiste</li>
                </ul>
              </div>
              
              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Vai al Login
                  </div>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-white/50 backdrop-blur-sm border border-gray-200 text-gray-700 font-medium py-3 px-6 rounded-2xl hover:bg-white/80 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Torna alla Home
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;