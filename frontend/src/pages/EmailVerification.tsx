import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../services/api';

const EmailVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  
  console.log('📧 EMAIL VERIFICATION PAGE LOADED:', {
    url: window.location.href,
    searchParams: Object.fromEntries(searchParams.entries())
  });

  useEffect(() => {
    const verifyEmailToken = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      if (!token || !email) {
        setStatus('error');
        setMessage('Link di verifica non valido. Token o email mancanti.');
        return;
      }

      try {
        const response = await verifyEmail(token, decodeURIComponent(email));
        setStatus('success');
        
        // Store verification code if provided
        if (response.verificationCode) {
          setVerificationCode(response.verificationCode);
          
          // Get referral code from URL if present
          const referralCode = searchParams.get('referralCode');
          
          // Prepare redirect URL but don't auto-redirect
          const baseUrl = referralCode ? `/registration/${referralCode}` : '/registration';
          const redirectUrl = `${baseUrl}?code=${response.verificationCode}`;
          
          console.log('🔗 CONSTRUCTING REDIRECT URL:', {
            referralCode,
            verificationCode: response.verificationCode,
            baseUrl,
            redirectUrl
          });
          
          // Store redirect URL for manual button click
          (window as any).enrollmentRedirectUrl = redirectUrl;
        }
        
        if (response.alreadyVerified) {
          setMessage('Email già verificata in precedenza. Puoi procedere con la registrazione.');
        } else {
          setMessage('Email verificata con successo!');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(
          error.response?.data?.error || 
          'Errore durante la verifica dell\'email. Il link potrebbe essere scaduto o non valido.'
        );
      }
    };

    verifyEmailToken();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <svg className="mx-auto h-12 w-12 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">Verifica in corso...</h2>
                <p className="mt-2 text-sm text-gray-600">Stiamo verificando la tua email.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">Email Verificata!</h2>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-green-700">
                      <p className="font-medium">Successo!</p>
                      {verificationCode ? (
                        <div className="mt-2">
                          <p className="font-medium">Il tuo codice di accesso:</p>
                          <div className="bg-white border border-green-300 rounded px-3 py-2 mt-1 font-mono text-lg text-green-800">
                            {verificationCode}
                          </div>
                          <p className="mt-2">Usa questo codice per accedere al form di iscrizione. Valido per 30 minuti.</p>
                          <div className="mt-4">
                            <button
                              onClick={() => {
                                const url = (window as any).enrollmentRedirectUrl;
                                console.log('🎯 BUTTON CLICKED - Redirect URL:', url);
                                if (url) {
                                  console.log('🚀 Redirecting to:', url);
                                  window.location.href = url;
                                } else {
                                  console.log('⚠️ No URL found, using fallback');
                                  window.location.href = '/registration';
                                }
                              }}
                              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 font-medium"
                            >
                              Continua con l'Iscrizione
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1">Puoi ora chiudere questa pagina e tornare alla registrazione per continuare.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">Errore di Verifica</h2>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
                <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm text-red-700">
                    <p className="font-medium">Cosa puoi fare:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Controlla se il link è completo</li>
                      <li>• Richiedi una nuova email di verifica</li>
                      <li>• Contatta il supporto se il problema persiste</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            <div className="mt-8">
              <button
                type="button"
                onClick={() => window.close()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Chiudi Finestra
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;