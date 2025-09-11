import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/UI/LoadingSpinner';

interface AcceptInviteData {
  collaborator: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    partnerCompany: {
      id: string;
      name: string;
    };
  };
}

const AcceptPartnerInvite: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [inviteData, setInviteData] = useState<AcceptInviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verifica validità del token all'inizio
  useEffect(() => {
    if (!token) {
      setError('Token di invito non valido');
      setVerifying(false);
      return;
    }
    
    // Per ora impostiamo i dati mock per il test
    // In produzione qui faresti una chiamata API per verificare il token
    setVerifying(false);
  }, [token]);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    
    if (password.length < 6) {
      setError('La password deve essere lunga almeno 6 caratteri');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/partner-employees/accept-invite/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante l\'accettazione dell\'invito');
      }

      const data = await response.json();
      setInviteData(data);
      
      // Reindirizza al login partner dopo 2 secondi
      setTimeout(() => {
        navigate('/partner/login', { 
          state: { 
            message: 'Invito accettato con successo! Ora puoi effettuare il login.',
            email: data.collaborator.email
          }
        });
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accettazione dell\'invito');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-600 mt-4">Verifica invito in corso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.498 0L4.402 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invito Non Valido</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button 
              onClick={() => navigate('/partner/login')}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Vai al Login Partner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mostra conferma successo
  if (inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Invito Accettato!</h2>
            <p className="text-slate-600 mb-4">
              Benvenuto nel team di <strong>{inviteData.collaborator.partnerCompany.name}</strong>
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-700">
                <span className="font-medium">Email:</span> {inviteData.collaborator.email}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Ruolo:</span> {inviteData.collaborator.role}
              </p>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Sarai reindirizzato al login tra pochi secondi...
            </p>
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  // Form di accettazione invito
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Accetta Invito</h2>
          <p className="text-slate-600">
            Sei stato invitato come collaboratore partner. Imposta la tua password per completare la registrazione.
          </p>
        </div>

        <form onSubmit={handleAcceptInvite} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.498 0L4.402 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Nuova Password *
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Minimo 6 caratteri"
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
              Conferma Password *
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ripeti la password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Accettando invito...
              </div>
            ) : (
              'Accetta Invito e Registrati'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="text-center">
            <p className="text-sm text-slate-600">
              Hai problemi con l'invito?{' '}
              <button 
                onClick={() => navigate('/partner/login')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Contatta il supporto
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptPartnerInvite;