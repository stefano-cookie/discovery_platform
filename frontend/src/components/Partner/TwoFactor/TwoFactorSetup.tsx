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
  partnerEmployeeId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ partnerEmployeeId, onComplete, onCancel }) => {
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
      const response = await api.post('/auth/2fa/setup', {
        partnerEmployeeId
      });
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
      await api.post('/auth/2fa/verify-setup', {
        partnerEmployeeId,
        secret: setupData!.secret,
        code: verificationCode,
        recoveryCodes: setupData!.recoveryCodes,
      });
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-h-screen overflow-y-auto bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Configurazione Autenticazione a Due Fattori</h1>
              <p className="text-sm text-gray-600">Proteggi il tuo account con 2FA</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index <= activeStep ? 'bg-emerald-600 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-xs mt-2 text-center">{step}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-2 ${
                      index < activeStep ? 'bg-emerald-600' : 'bg-gray-300'
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, Microsoft Authenticator)
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 text-center">Scansiona con App</h3>
                  <div className="flex justify-center">
                    <img src={setupData.qrCode} alt="QR Code 2FA" className="max-w-full h-auto" />
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Oppure Inserisci Manualmente</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Se non riesci a scansionare il QR code, inserisci questo codice nella tua app:
                  </p>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all relative">
                    {showSecret ? setupData.secret : '••••••••••••••••'}
                    <button
                      onClick={handleCopySecret}
                      className="absolute top-2 right-2 text-emerald-600 hover:text-emerald-700"
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
                <Button onClick={() => setActiveStep(1)} disabled={loading}>
                  Continua
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

              <div className="mb-6">
                <Input
                  label="Codice di Verifica (6 cifre)"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>

              <div className="flex justify-between">
                <Button onClick={() => setActiveStep(0)} variant="secondary" disabled={loading}>
                  Indietro
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                >
                  {loading ? 'Verifica in corso...' : 'Verifica e Attiva 2FA'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Recovery Codes */}
          {activeStep === 2 && setupData && (
            <div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="font-semibold text-yellow-900 mb-2">Salva questi codici di recupero in un posto sicuro!</p>
                <p className="text-sm text-yellow-800">
                  Ogni codice può essere usato una sola volta per accedere se perdi l'accesso alla tua app di autenticazione.
                </p>
              </div>

              <div className="border rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Codici di Recupero</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyRecoveryCodes}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                      title="Copia Codici"
                    >
                      Copia
                    </button>
                    <button
                      onClick={handleDownloadRecoveryCodes}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                      title="Scarica Codici"
                    >
                      Scarica
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {setupData.recoveryCodes.map((code, index) => (
                    <div key={index} className="bg-gray-100 p-3 rounded font-mono text-center text-lg">
                      {code}
                    </div>
                  ))}
                </div>

                {(codesCopied || codesDownloaded) && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                    {codesCopied && 'Codici copiati negli appunti! '}
                    {codesDownloaded && 'Codici scaricati!'}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>Questi codici non saranno più visibili dopo questa schermata</li>
                  <li>Ogni codice può essere usato una sola volta</li>
                  <li>Conservali in un posto sicuro (password manager, cassetta di sicurezza, ecc.)</li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={onComplete}
                  disabled={!codesCopied && !codesDownloaded}
                >
                  Completa Configurazione
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
