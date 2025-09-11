import React, { useState, useEffect } from 'react';
import { authService, RegisterRequest } from '../../services/auth';
import { generateCodiceFiscale, decodeFiscalCode } from '../../utils/codiceFiscale';
import { getProvinceOptions, getCityOptions, GENDER_OPTIONS } from '../../services/geoService';
import Modal from '../UI/Modal';

// Custom animations styles
const modalStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes slideInRight {
    from { 
      opacity: 0;
      transform: translateX(20px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes slideInLeft {
    from { 
      opacity: 0;
      transform: translateX(-20px);
    }
    to { 
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  
  .animate-slideUp {
    animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .animate-slideInRight {
    animation: slideInRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  
  .animate-slideInLeft {
    animation: slideInLeft 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  
  .animate-pulse {
    animation: pulse 2s infinite;
  }
  
  .animate-bounce {
    animation: bounce 1s infinite;
  }
  
  .gradient-text {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .glass-effect {
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.95);
  }
  
  .hover-lift {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-lift:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  }
  
  .input-focus {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .input-focus:focus {
    transform: translateY(-1px);
  }
  
  .progress-glow {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  }
`;

// Inject styles into head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = modalStyles;
  if (!document.head.querySelector('style[data-registration-modal]')) {
    styleSheet.setAttribute('data-registration-modal', 'true');
    document.head.appendChild(styleSheet);
  }
}

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  referralCode?: string;
  onSuccess: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  referralCode,
  onSuccess
}) => {
  const [formData, setFormData] = useState<Partial<RegisterRequest>>({
    referralCode: referralCode || '',
    privacyPolicy: false,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isCodiceFiscaleManual, setIsCodiceFiscaleManual] = useState(false);
  const [provinceOptions] = useState(getProvinceOptions());
  const [cityOptions, setCityOptions] = useState<Array<{ value: string; label: string }>>([]);

  // Auto-generate codice fiscale when data changes
  useEffect(() => {
    const generateCF = async () => {
      if (!isCodiceFiscaleManual && formData.cognome && formData.nome && formData.dataNascita && formData.luogoNascita && formData.sesso) {
        try {
          const codiceFiscaleGenerato = await generateCodiceFiscale({
            lastName: formData.cognome!,
            firstName: formData.nome!,
            birthDate: formData.dataNascita!,
            birthPlace: formData.luogoNascita!,
            gender: formData.sesso! as 'M' | 'F'
          });
          
          if (codiceFiscaleGenerato && codiceFiscaleGenerato !== formData.codiceFiscale) {
            setFormData(prev => ({ ...prev, codiceFiscale: codiceFiscaleGenerato }));
          }
        } catch (error) {
          console.error('Error generating fiscal code:', error);
        }
      }
    };
    
    generateCF();
  }, [formData.cognome, formData.nome, formData.dataNascita, formData.luogoNascita, formData.sesso, isCodiceFiscaleManual, formData.codiceFiscale]);

  // Update city options when province changes
  useEffect(() => {
    if (formData.provinciaNascita) {
      const citiesForProvince = getCityOptions(formData.provinciaNascita);
      setCityOptions(citiesForProvince);
      
      // Reset city selection if current city is not in the new province
      if (formData.luogoNascita && !citiesForProvince.some(city => city.value === formData.luogoNascita)) {
        setFormData(prev => ({ ...prev, luogoNascita: '' }));
      }
    } else {
      setCityOptions([]);
      setFormData(prev => ({ ...prev, luogoNascita: '' }));
    }
  }, [formData.provinciaNascita, formData.luogoNascita]);

  // Auto-decode fiscal code when user types it manually
  useEffect(() => {
    const decodeFiscalCodeData = async () => {
      if (isCodiceFiscaleManual && formData.codiceFiscale && formData.codiceFiscale.length === 16) {
        try {
          const decodedData = await decodeFiscalCode(formData.codiceFiscale);
          
          if (decodedData.isValid) {
            setFormData(prev => ({
              ...prev,
              dataNascita: decodedData.birthDate || prev.dataNascita,
              sesso: decodedData.gender || prev.sesso
            }));
          }
        } catch (error) {
          console.error('Error decoding fiscal code:', error);
        }
      }
    };
    
    decodeFiscalCodeData();
  }, [formData.codiceFiscale, isCodiceFiscaleManual]);

  if (!isOpen) return null;

  const updateFormData = (field: keyof RegisterRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePassword = (password: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };

  const validateStep1 = () => {
    return !!(
      formData.email &&
      formData.password &&
      validatePassword(formData.password) &&
      formData.cognome &&
      formData.nome &&
      formData.dataNascita &&
      formData.provinciaNascita &&
      formData.luogoNascita &&
      formData.sesso &&
      formData.codiceFiscale &&
      formData.telefono
    );
  };

  const validateStep2 = () => {
    // Valida sempre i campi residenza
    const residenzaValid = !!(
      formData.residenzaVia &&
      formData.residenzaCitta &&
      formData.residenzaProvincia &&
      formData.residenzaCap
    );

    // Valida accettazione privacy policy
    const privacyValid = formData.privacyPolicy === true;

    // Se ha domicilio diverso, valida anche quelli
    if (formData.hasDifferentDomicilio) {
      const domicilioValid = !!(
        formData.domicilioVia &&
        formData.domicilioCitta &&
        formData.domicilioProvincia &&
        formData.domicilioCap
      );
      return residenzaValid && domicilioValid && privacyValid;
    }

    return residenzaValid && privacyValid;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.register(formData as RegisterRequest);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={!isLoading}
      closeOnEscape={!isLoading}
      className="glass-effect"
    >
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/80 to-purple-600/80"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
        <div className="relative">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              Unisciti a Diamante
            </h2>
          </div>
          <p className="text-blue-100 text-sm">
            Crea il tuo account in pochi passi
          </p>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg animate-shake">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Progress indicator migliorato */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 hover-lift ${
                  currentStep >= 1 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 progress-glow' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > 1 ? (
                    <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '1'}
                </div>
                <span className={`text-sm font-semibold transition-all duration-300 ${
                  currentStep >= 1 ? 'text-blue-600 gradient-text' : 'text-gray-400'
                }`}>
                  Dati Generali
                </span>
              </div>
              
              <div className="flex-1 mx-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full transition-all duration-700 ease-out ${
                      currentStep >= 2 ? 'progress-glow' : ''
                    }`}
                    style={{ 
                      width: `${(currentStep / 2) * 100}%`,
                      background: currentStep >= 2 
                        ? 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)' 
                        : 'linear-gradient(90deg, #3b82f6, #6366f1)'
                    }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 hover-lift ${
                  currentStep >= 2 
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 progress-glow' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {currentStep > 2 ? (
                    <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : '2'}
                </div>
                <span className={`text-sm font-semibold transition-all duration-300 ${
                  currentStep >= 2 ? 'text-purple-600 gradient-text' : 'text-gray-400'
                }`}>
                  Residenza
                </span>
              </div>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="animate-slideInRight">
              {/* Header step */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold gradient-text hover-lift">I tuoi dati personali</h3>
                </div>
                <p className="text-sm text-gray-600">Inserisci le informazioni di base per creare il tuo account</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    value={formData.cognome || ''}
                    onChange={(e) => updateFormData('cognome', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="Inserisci il cognome"
                    required
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.nome || ''}
                    onChange={(e) => updateFormData('nome', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="Inserisci il nome"
                    required
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="nome@email.com"
                    required
                  />
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password sicura *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password || ''}
                    onChange={(e) => updateFormData('password', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="Crea una password sicura"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-100"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Indicatore forza password */}
                {formData.password && (
                  <div className="mt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="flex space-x-1 flex-1">
                        {[1, 2, 3, 4].map((level) => {
                          const isActive = (formData.password?.length || 0) >= level * 2;
                          return (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                isActive 
                                  ? level <= 2 ? 'bg-red-400' : level === 3 ? 'bg-yellow-400' : 'bg-green-400'
                                  : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-xs font-medium text-gray-600">
                        {!formData.password ? '' : 
                         formData.password.length < 4 ? 'Debole' :
                         formData.password.length < 6 ? 'Media' : 'Forte'}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="mt-2 bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700 font-medium mb-1">La password deve contenere:</p>
                  <ul className="text-xs text-blue-600 space-y-1">
                    <li className="flex items-center space-x-2">
                      <span className={formData.password && formData.password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                        {formData.password && formData.password.length >= 8 ? '✓' : '○'}
                      </span>
                      <span>Almeno 8 caratteri</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className={formData.password && /[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {formData.password && /[A-Z]/.test(formData.password) ? '✓' : '○'}
                      </span>
                      <span>Una lettera maiuscola</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className={formData.password && /[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {formData.password && /[a-z]/.test(formData.password) ? '✓' : '○'}
                      </span>
                      <span>Una lettera minuscola</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className={formData.password && /\d/.test(formData.password) ? 'text-green-600' : 'text-gray-400'}>
                        {formData.password && /\d/.test(formData.password) ? '✓' : '○'}
                      </span>
                      <span>Un numero</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data di Nascita *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="date"
                      value={formData.dataNascita || ''}
                      onChange={(e) => updateFormData('dataNascita', e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                      required
                    />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sesso *
                  </label>
                  <div className="relative">
                    <select
                      value={formData.sesso || ''}
                      onChange={(e) => updateFormData('sesso', e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none bg-white"
                      required
                    >
                      <option value="">Seleziona</option>
                      {GENDER_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Provincia di Nascita *
                </label>
                <div className="relative">
                  <select
                    value={formData.provinciaNascita || ''}
                    onChange={(e) => updateFormData('provinciaNascita', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 appearance-none bg-white"
                    required
                  >
                    <option value="">Seleziona provincia</option>
                    {provinceOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {formData.provinciaNascita === 'EE' ? "Stato di Nascita *" : "Luogo di Nascita *"}
                </label>
                <div className="relative">
                  <select
                    value={formData.luogoNascita || ''}
                    onChange={(e) => updateFormData('luogoNascita', e.target.value)}
                    className={`w-full border-2 rounded-xl px-4 py-3 focus:outline-none transition-all duration-200 appearance-none bg-white ${
                      !formData.provinciaNascita 
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed' 
                        : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                    }`}
                    disabled={!formData.provinciaNascita}
                    required
                  >
                    <option value="">
                      {!formData.provinciaNascita ? "Prima seleziona una provincia" :
                      formData.provinciaNascita === 'EE' ? "Seleziona stato di nascita" : "Seleziona città"}
                    </option>
                    {cityOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg className={`h-5 w-5 ${!formData.provinciaNascita ? 'text-gray-300' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Codice Fiscale *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.codiceFiscale || ''}
                    onChange={(e) => {
                      setIsCodiceFiscaleManual(true);
                      updateFormData('codiceFiscale', e.target.value.toUpperCase());
                    }}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 pr-20 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 uppercase placeholder-gray-400 font-mono text-sm"
                    placeholder="RSSMRA90A01H501X"
                    maxLength={16}
                    required
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    {!isCodiceFiscaleManual && formData.codiceFiscale && (
                      <div className="flex items-center space-x-1 bg-green-50 px-2 py-1 rounded-lg">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-green-600 font-medium">Auto</span>
                      </div>
                    )}
                    {isCodiceFiscaleManual && (
                      <div className="flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-lg">
                        <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        <span className="text-xs text-blue-600 font-medium">Manuale</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  {!isCodiceFiscaleManual && (
                    <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                      Generato automaticamente dai tuoi dati
                    </p>
                  )}
                  {isCodiceFiscaleManual && formData.cognome && formData.nome && formData.dataNascita && formData.luogoNascita && formData.sesso && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsCodiceFiscaleManual(false);
                        if (formData.cognome && formData.nome && formData.dataNascita && formData.luogoNascita && formData.sesso) {
                          try {
                            const codiceFiscaleGenerato = await generateCodiceFiscale({
                              lastName: formData.cognome,
                              firstName: formData.nome,
                              birthDate: formData.dataNascita,
                              birthPlace: formData.luogoNascita,
                              gender: formData.sesso as 'M' | 'F'
                            });
                            updateFormData('codiceFiscale', codiceFiscaleGenerato);
                          } catch (error) {
                            console.error('Error regenerating fiscal code:', error);
                          }
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors duration-200 font-medium"
                    >
                      Rigenera automaticamente
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Telefono *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    value={formData.telefono || ''}
                    onChange={(e) => updateFormData('telefono', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200 placeholder-gray-400"
                    placeholder="+39 123 456 7890"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <button
                  onClick={handleNext}
                  disabled={!validateStep1()}
                  className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-105 hover-lift ${
                    validateStep1()
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25 progress-glow'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {validateStep1() ? (
                    <span className="flex items-center space-x-2">
                      <span>Continua</span>
                      <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  ) : (
                    'Compila i campi obbligatori'
                  )}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="animate-slideInLeft">
              {/* Header step */}
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold gradient-text hover-lift">La tua residenza</h3>
                </div>
                <p className="text-sm text-gray-600">Inserisci l'indirizzo dove risiedi attualmente</p>
              </div>
              
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Via/Indirizzo completo *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={formData.residenzaVia || ''}
                    onChange={(e) => updateFormData('residenzaVia', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="Via Roma 123, interno 4B"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Città *
                  </label>
                  <input
                    type="text"
                    value={formData.residenzaCitta || ''}
                    onChange={(e) => updateFormData('residenzaCitta', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                    placeholder="Milano"
                    required
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Provincia *
                  </label>
                  <input
                    type="text"
                    value={formData.residenzaProvincia || ''}
                    onChange={(e) => updateFormData('residenzaProvincia', e.target.value.toUpperCase())}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400 uppercase text-center font-mono"
                    placeholder="MI"
                    maxLength={2}
                    required
                  />
                </div>
              </div>

              <div className="w-1/2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CAP *
                </label>
                <input
                  type="text"
                  value={formData.residenzaCap || ''}
                  onChange={(e) => updateFormData('residenzaCap', e.target.value.replace(/\D/g, ''))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400 text-center font-mono"
                  placeholder="20121"
                  maxLength={5}
                  pattern="[0-9]{5}"
                  required
                />
              </div>

              {/* Domicilio diverso dalla residenza */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.hasDifferentDomicilio || false}
                    onChange={(e) => updateFormData('hasDifferentDomicilio', e.target.checked)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Il domicilio è diverso dalla residenza
                  </span>
                </label>
              </div>

              {/* Campi domicilio - mostrati solo se checkbox è selezionata */}
              {formData.hasDifferentDomicilio && (
                <div className="mt-4">
                  <div className="text-center">
                    <h4 className="text-lg font-semibold text-gray-800">Indirizzo di Domicilio</h4>
                    <div className="w-16 h-1 bg-blue-500 mx-auto mt-2 rounded-full"></div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Via/Piazza
                    </label>
                    <input
                      type="text"
                      value={formData.domicilioVia || ''}
                      onChange={(e) => updateFormData('domicilioVia', e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                      placeholder="Via Roma 123"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Città
                      </label>
                      <input
                        type="text"
                        value={formData.domicilioCitta || ''}
                        onChange={(e) => updateFormData('domicilioCitta', e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400"
                        placeholder="Milano"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Provincia
                      </label>
                      <input
                        type="text"
                        value={formData.domicilioProvincia || ''}
                        onChange={(e) => updateFormData('domicilioProvincia', e.target.value.toUpperCase())}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400 text-center font-mono"
                        placeholder="MI"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      CAP
                    </label>
                    <input
                      type="text"
                      value={formData.domicilioCap || ''}
                      onChange={(e) => updateFormData('domicilioCap', e.target.value.replace(/\D/g, ''))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 input-focus hover-lift placeholder-gray-400 text-center font-mono"
                      placeholder="20121"
                      maxLength={5}
                      pattern="[0-9]{5}"
                    />
                  </div>
                </div>
              )}

              {/* Privacy Policy Checkbox */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-6">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="privacyPolicy"
                    checked={formData.privacyPolicy || false}
                    onChange={(e) => updateFormData('privacyPolicy', e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    required
                  />
                  <label htmlFor="privacyPolicy" className="text-sm text-gray-700 cursor-pointer">
                    <span className="font-medium">Accetto i termini e condizioni</span> e confermo di aver letto la{' '}
                    <a 
                      href="/privacy-policy" 
                      target="_blank" 
                      className="text-blue-600 hover:text-blue-700 underline font-medium"
                    >
                      Privacy Policy
                    </a>
                    {' '}dell'azienda. *
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-7">
                  Il consenso è obbligatorio per procedere con la registrazione.
                </p>
              </div>

              <div className="flex justify-between items-center pt-6">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-semibold flex items-center space-x-2 hover-lift"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  <span>Indietro</span>
                </button>
                
                <button
                  onClick={handleSubmit}
                  disabled={!validateStep2() || isLoading}
                  className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-105 hover-lift ${
                    validateStep2() && !isLoading
                      ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white hover:from-green-600 hover:to-blue-700 shadow-lg shadow-green-500/25 progress-glow'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Creazione account...</span>
                    </span>
                  ) : validateStep2() ? (
                    <span className="flex items-center space-x-2">
                      <span>Crea Account</span>
                      <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : (
                    'Compila tutti i campi'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
};

export default RegistrationModal;