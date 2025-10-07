import React, { useState, useEffect } from 'react';
import Button from '../../UI/Button';
import Input from '../../UI/Input';
import ErrorMessage from '../../UI/ErrorMessage';
import api from '../../../services/api';

interface TwoFactorVerifyProps {
  sessionToken: string;
  onSuccess: (token: string, employee: any, partnerCompany: any) => void;
  onCancel?: () => void;
}

const TwoFactorVerify: React.FC<TwoFactorVerifyProps> = ({
  sessionToken,
  onSuccess,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setSessionExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (timeLeft / 300) * 100;

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError('Il codice deve essere di 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/2fa/verify', {
        sessionToken,
        code,
      });

      onSuccess(
        response.data.token,
        response.data.employee,
        response.data.employee.partnerCompany
      );
    } catch (err: any) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Codice non valido. Riprova.');

      if (errorData?.remainingAttempts !== undefined) {
        setRemainingAttempts(errorData.remainingAttempts);
      }

      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    if (!recoveryCode.trim()) {
      setError('Inserisci un codice di recupero');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/auth/2fa/recovery', {
        sessionToken,
        recoveryCode: recoveryCode.replace(/\s+/g, ''),
      });

      onSuccess(
        response.data.token,
        response.data.employee,
        response.data.employee.partnerCompany
      );

      if (response.data.warning) {
        console.warn(response.data.warning);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Codice di recupero non valido');
      setRecoveryCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (useRecoveryCode) {
        handleVerifyRecoveryCode();
      } else if (code.length === 6) {
        handleVerifyCode();
      }
    }
  };

  if (sessionExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-3">Sessione Scaduta</h2>
            <p className="text-sm text-red-800 mb-4">
              La sessione di verifica è scaduta dopo 5 minuti. Riprova ad effettuare il login.
            </p>
            {onCancel && (
              <Button onClick={onCancel} variant="primary" className="w-full">
                Torna al Login
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Verifica in Due Passaggi
            </h2>
            <p className="text-sm text-gray-600 text-center">
              Inserisci il codice dalla tua app di autenticazione
            </p>
          </div>

          {/* Session Timeout */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">⏱️ Tempo rimanente</span>
              <span className={`text-xs font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  timeLeft < 60 ? 'bg-red-600' : 'bg-emerald-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} onClose={() => setError(null)} />
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="text-xs text-red-600 mt-2">
                  Tentativi rimanenti: {remainingAttempts}
                </p>
              )}
            </div>
          )}

          {!useRecoveryCode ? (
            <div>
              <div className="flex items-center justify-center mb-4 text-sm text-gray-600">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Apri la tua app di autenticazione
              </div>

              <div className="mb-6">
                <Input
                  label="Codice a 6 cifre"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyPress={handleKeyPress}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-3xl tracking-[1rem] font-bold"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                variant="primary"
                className="w-full mb-4"
              >
                {loading ? 'Verifica in corso...' : 'Verifica'}
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center mb-4 text-sm text-gray-600">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Inserisci un codice di recupero
              </div>

              <div className="mb-6">
                <Input
                  label="Codice di Recupero"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="XXXX-YYYY"
                  className="text-center text-xl font-mono tracking-wider"
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">Formato: XXXX-YYYY (8 caratteri)</p>
              </div>

              <Button
                onClick={handleVerifyRecoveryCode}
                disabled={loading || !recoveryCode.trim()}
                variant="primary"
                className="w-full mb-4"
              >
                {loading ? 'Verifica in corso...' : 'Verifica Codice di Recupero'}
              </Button>
            </div>
          )}

          <div className="border-t pt-4">
            {!useRecoveryCode ? (
              <button
                onClick={() => {
                  setUseRecoveryCode(true);
                  setCode('');
                  setError(null);
                }}
                disabled={loading}
                className="text-sm text-emerald-600 hover:text-emerald-700 w-full text-center"
              >
                Non hai accesso all'app? Usa un codice di recupero
              </button>
            ) : (
              <button
                onClick={() => {
                  setUseRecoveryCode(false);
                  setRecoveryCode('');
                  setError(null);
                }}
                disabled={loading}
                className="text-sm text-emerald-600 hover:text-emerald-700 w-full text-center"
              >
                ← Torna al codice dall'app
              </button>
            )}
          </div>

          {onCancel && (
            <div className="mt-4 text-center">
              <button
                onClick={onCancel}
                disabled={loading}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
