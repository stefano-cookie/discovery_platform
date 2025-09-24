import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import RegistrationModal from './RegistrationModal';
import { useLocation } from 'react-router-dom';

interface ReferralGatekeeperProps {
  referralCode: string;
  children: React.ReactNode;
}

const ReferralGatekeeper: React.FC<ReferralGatekeeperProps> = ({
  referralCode,
  children
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{ valid: boolean; partnerEmail?: string } | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [hasSpecialParams, setHasSpecialParams] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined); // 🎯 Employee tracking state

  useEffect(() => {
    validateReferralAndCheckAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCode]); // Rimuoviamo user dalle dipendenze per evitare loop

  const validateReferralAndCheckAccess = useCallback(async () => {
    try {
      // Verifica validità del referral code con timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Referral validation timeout')), 10000)
      );
      
      const referralPromise = authService.checkReferralCode(referralCode);
      const referralData = await Promise.race([referralPromise, timeoutPromise]) as any;
      
      setReferralInfo(referralData);

      // Controlla se arriva da verifica email o token sicuro
      const urlParams = new URLSearchParams(location.search);
      const emailVerified = urlParams.get('emailVerified');
      const verificationCode = urlParams.get('code');
      const secureToken = urlParams.get('token');
      const email = urlParams.get('email'); // Aggiunto per gestire redirect da verifica email
      const refParam = urlParams.get('ref'); // 🎯 Extract employee ID parameter

      // Store employee ID for registration
      if (refParam) {
        setEmployeeId(refParam);
        console.log(`🔗 [ReferralGatekeeper] Employee ID extracted: ${refParam}`);
      }

      // Determina se ci sono parametri speciali nell'URL
      const hasParams = !!(secureToken || verificationCode || emailVerified === 'true' || email);
      setHasSpecialParams(hasParams);
    } catch (error) {
      console.error('Errore validazione referral:', error);
      setReferralInfo({ valid: false });
    } finally {
      setIsValidating(false);
    }
  }, [referralCode, location.search]); // Dipendenze del useCallback

  const handleRegisterClick = () => {
    setShowRegistrationModal(true);
  };

  const handleRegistrationSuccess = () => {
    setShowRegistrationModal(false);
    setShowSuccessModal(true);
  };

  const handleLoginRedirect = () => {
    // Salva il referral code per il redirect post-login
    localStorage.setItem('pendingReferral', referralCode);
    localStorage.setItem('pendingReferralUrl', window.location.pathname + window.location.search);
    window.location.href = '/login';
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifica accesso in corso...</p>
        </div>
      </div>
    );
  }

  // Referral code non valido (solo se è stato verificato ed è non valido)
  if (referralInfo !== null && !referralInfo.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Link Non Valido</h1>
          <p className="text-gray-600 mb-6">
            Il link che hai seguito non è valido o è scaduto.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  // Se referralInfo non è ancora stato caricato, mostra loader
  if (referralInfo === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento in corso...</p>
        </div>
      </div>
    );
  }

  // Controlli prioritari dopo che referralInfo è stato caricato
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const urlParams = new URLSearchParams(location.search);
  
  // Se arriva con parametri di verifica, consenti accesso immediato
  if (hasSpecialParams) {
    return <>{children}</>;
  }

  // Utente autenticato - accesso consentito
  if (user) {
    return <>{children}</>;
  }

  // Se mostra il modal di successo, mostra solo quello
  if (showSuccessModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-lg w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Main Content */}
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Registrazione Completata! 🎉
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Controlla la tua casella email per completare la verifica
            </p>
            
            {/* Email Instructions Card */}
            <div className="bg-blue-50 rounded-xl p-6 mb-6 text-left">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-blue-900 font-medium mb-2">
                    Abbiamo inviato un'email di verifica al tuo indirizzo
                  </p>
                  <p className="text-blue-700 text-sm">
                    Clicca sul link nell'email per attivare il tuo account
                  </p>
                </div>
              </div>
            </div>
            
            {/* Warning Card */}
            <div className="bg-amber-50 rounded-xl p-4 mb-8 text-left">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-amber-800 text-sm">
                  Se non trovi l'email, controlla la cartella <strong>spam</strong> o <strong>posta indesiderata</strong>
                </p>
              </div>
            </div>
            {/* Footer Note */}
            <p className="text-sm text-gray-500 mt-8">
              Dopo aver verificato la tua email, torna al link del corso per procedere con l'iscrizione
            </p>
          </div>
        </div>
      </div>
    );
  }

  // A questo punto: referralInfo è caricato, nessun parametro speciale, utente non autenticato
  // Mostra prompt di accesso
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-blue-500 text-6xl mb-4">🎓</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Accesso al Corso
            </h1>
            <p className="text-gray-600 mb-2">
              Per accedere al form di iscrizione devi prima registrarti alla piattaforma.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Partner: {referralInfo.partnerEmail}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleRegisterClick}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
              >
                Registrati alla Piattaforma
              </button>
              
              <button
                onClick={handleLoginRedirect}
                className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-50"
              >
                Ho già un account - Login
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              La registrazione è gratuita e ti permetterà di accedere a tutti i corsi del tuo partner di riferimento.
            </p>
        </div>
      </div>

      <RegistrationModal
        isOpen={showRegistrationModal}
        onClose={() => {
          setShowRegistrationModal(false);
        }}
        referralCode={referralCode}
        employeeId={employeeId} // 🎯 Pass employee ID to registration modal
        onSuccess={handleRegistrationSuccess}
      />
    </>
  );
};

export default ReferralGatekeeper;