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

      // Determina se ci sono parametri speciali nell'URL
      const hasParams = !!(secureToken || verificationCode || emailVerified === 'true');
      setHasSpecialParams(hasParams);
    } catch (error) {
      console.error('Errore validazione referral:', error);
      setReferralInfo({ valid: false });
    } finally {
      setIsValidating(false);
    }
  }, [referralCode, user, location.search]); // Dipendenze del useCallback

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
  const urlParams = new URLSearchParams(location.search);
  const emailVerified = urlParams.get('emailVerified');
  const secureToken = urlParams.get('token');
  const verificationCode = urlParams.get('code');
  
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-green-500 text-6xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Registrazione Completata!
          </h1>
          <p className="text-gray-600 mb-6">
            <strong>Controlla la tua casella email</strong> per completare la verifica del tuo account.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              📨 Abbiamo inviato un'email di verifica al tuo indirizzo. 
              Clicca sul link nell'email per attivare il tuo account.
            </p>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>Importante:</strong> Se non trovi l'email, controlla la cartella spam o posta indesiderata.
            </p>
          </div>
          
          <p className="text-gray-600 mb-6">
            Dopo aver verificato la tua email, potrai accedere a questo corso tramite il link che ti ha fornito il tuo partner.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-medium"
            >
              Vai al Login (dopo aver verificato l'email)
            </button>
            
            <button
              onClick={() => {
                // Salva il referral per dopo la verifica
                localStorage.setItem('pendingReferralAfterVerification', referralCode);
                window.location.href = '/';
              }}
              className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-50"
            >
              Torna alla Home
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-4">
            Puoi chiudere questa pagina. Dopo la verifica email, torna al link del corso per procedere con l'iscrizione.
          </p>
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
        onSuccess={handleRegistrationSuccess}
      />
    </>
  );
};

export default ReferralGatekeeper;