import React, { useState, useEffect } from 'react';
import Button from '../../UI/Button';
import Input from '../../UI/Input';
import LoadingSpinner from '../../UI/LoadingSpinner';
import ErrorMessage from '../../UI/ErrorMessage';
import api from '../../../services/api';

interface TwoFactorSetupData {
  qrCode: string;
  secret: string;
  recoveryCodes: string[];
}

interface TwoFactorSetupProps {
  onComplete: (setupResponse?: any) => void;
  onCancel?: () => void;
  embedded?: boolean; // When true, removes full-screen layout (used in login flow)
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete, onCancel, embedded = false }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesDownloaded, setCodesDownloaded] = useState(false);

  const steps = ['Scansiona QR Code', 'Verifica Codice', 'Salva Recovery Codes'];

  useEffect(() => {
    if (activeStep === 0 && !setupData) {
      initializeSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, setupData]);

  const initializeSetup = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/user/2fa/setup');
      setSetupData({
        qrCode: response.data.data.qrCode,
        secret: response.data.data.secret,
        recoveryCodes: response.data.data.recoveryCodes,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante inizializzazione 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Il codice deve essere di 6 cifre');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.post('/user/2fa/verify-setup', {
        secret: setupData!.secret,
        code: verificationCode,
        recoveryCodes: setupData!.recoveryCodes,
      });

      // Save response for completion handler
      setSetupData({
        ...setupData!,
        verifyResponse: response.data,
      } as any);

      setActiveStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Codice non valido. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(setupData!.secret);
    setShowSecret(true);
  };

  const handleCopyRecoveryCodes = () => {
    const codesText = setupData!.recoveryCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCodesCopied(true);
  };

  const handleDownloadRecoveryCodes = () => {
    const codesText = setupData!.recoveryCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'discovery-2fa-recovery-codes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCodesDownloaded(true);
  };

  if (!setupData && loading) {
    return (
      <div className={embedded ? "flex items-center justify-center py-8" : "min-h-screen bg-gray-50 flex items-center justify-center"}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Wrapper classes based on embedded mode
  const wrapperClasses = embedded
    ? "py-4 overflow-y-auto"
    : "min-h-screen max-h-screen overflow-y-auto bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8 px-4 sm:py-12 sm:px-6 lg:px-8";

  const containerClasses = embedded
    ? "w-full"
    : "max-w-3xl mx-auto";

  return (
    <div className={wrapperClasses}>
      <div className={containerClasses}>
        <div className="bg-white rounded-xl shadow-xl p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-4 shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Autenticazione a Due Fattori</h1>
              <p className="text-sm text-gray-600">Configurazione obbligatoria per proteggere il tuo account</p>
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">
                  Per la tua sicurezza, l'autenticazione a due fattori (2FA) è ora obbligatoria per tutti gli utenti.
                </p>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      index <= activeStep
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-xs mt-2 text-center hidden sm:block">{step}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 rounded transition-colors ${
                      index < activeStep
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                        : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-6">
              <ErrorMessage message={error} onClose={() => setError(null)} />
            </div>
          )}

          {/* Step 1: QR Code */}
          {activeStep === 0 && setupData && (
            <div>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Scansiona con App</h3>
                  <p className="text-sm text-gray-600 mb-4 text-center">
                    Usa Google Authenticator, Authy o Microsoft Authenticator
                  </p>
                  <div className="flex justify-center bg-white p-4 rounded-lg shadow-inner">
                    <img src={setupData.qrCode} alt="QR Code 2FA" className="max-w-full h-auto" />
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">Inserimento Manuale</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Se non riesci a scansionare il QR code, inserisci questo codice nella tua app:
                  </p>
                  <div className="bg-white p-3 rounded border border-gray-300 font-mono text-sm break-all relative shadow-inner">
                    {showSecret ? setupData.secret : '••••••••••••••••'}
                    <button
                      onClick={handleCopySecret}
                      className="absolute top-2 right-2 text-blue-600 hover:text-blue-700 transition-colors"
                      title="Copia Secret"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Account: Discovery Platform</p>
                </div>
              </div>

              <div className="flex justify-between">
                {onCancel && (
                  <Button onClick={onCancel} variant="secondary" disabled={loading}>
                    Annulla
                  </Button>
                )}
                <Button onClick={() => setActiveStep(1)} disabled={loading} className="ml-auto">
                  Continua →
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Verify Code */}
          {activeStep === 1 && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Inserisci il codice a 6 cifre mostrato dalla tua app di autenticazione per verificare la configurazione.
                </p>
              </div>

              <div className="mb-6 max-w-md mx-auto">
                <Input
                  label="Codice di Verifica (6 cifre)"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-semibold"
                  autoFocus
                />
              </div>

              <div className="flex justify-between">
                <Button onClick={() => setActiveStep(0)} variant="secondary" disabled={loading}>
                  ← Indietro
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                >
                  {loading ? 'Verifica in corso...' : 'Verifica e Attiva 2FA →'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Recovery Codes */}
          {activeStep === 2 && setupData && (
            <div>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4 mb-6">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold text-yellow-900 mb-1">Salva questi codici di recupero!</p>
                    <p className="text-sm text-yellow-800">
                      Ogni codice può essere usato una sola volta per accedere se perdi l'accesso alla tua app.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 mb-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Codici di Recupero</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyRecoveryCodes}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-100 rounded shadow-sm transition-colors"
                      title="Copia Codici"
                    >
                      📋 Copia
                    </button>
                    <button
                      onClick={handleDownloadRecoveryCodes}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-100 rounded shadow-sm transition-colors"
                      title="Scarica Codici"
                    >
                      💾 Scarica
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {setupData.recoveryCodes.map((code, index) => (
                    <div key={index} className="bg-white border border-gray-300 p-3 rounded font-mono text-center text-lg shadow-sm">
                      {code}
                    </div>
                  ))}
                </div>

                {(codesCopied || codesDownloaded) && (
                  <div className="mt-4 bg-green-50 border-l-4 border-green-400 rounded-r-lg p-3 text-sm text-green-800">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {codesCopied && 'Codici copiati negli appunti! '}
                      {codesDownloaded && 'Codici scaricati!'}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Questi codici non saranno più visibili dopo questa schermata</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Ogni codice può essere usato una sola volta</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Conservali in un posto sicuro (password manager, cassetta di sicurezza, ecc.)</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => onComplete((setupData as any)?.verifyResponse)}
                  disabled={!codesCopied && !codesDownloaded}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  ✓ Completa Configurazione
                </Button>
              </div>

              {!codesCopied && !codesDownloaded && (
                <p className="text-xs text-gray-500 text-right mt-2">
                  Devi copiare o scaricare i codici prima di continuare
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;
