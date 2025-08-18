import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { generalDataSchema, GeneralDataForm } from '../../../utils/validation';
import { OfferInfo } from '../../../types/offers';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import ExistingUserPrompt from '../ExistingUserPrompt';
import { generateCodiceFiscale, decodeFiscalCode } from '../../../utils/codiceFiscale';
import { getProvinceOptions, getCityOptions, GENDER_OPTIONS } from '../../../services/geoService';
import { checkUserExists, ExistingUser } from '../../../services/api';
import { useAuth } from '../../../hooks/useAuth';

interface GeneralDataStepProps {
  data: Partial<GeneralDataForm>;
  onNext: (data: GeneralDataForm) => void;
  onChange?: (data: Partial<GeneralDataForm>) => void;
  referralCode?: string;
  templateType?: 'TFA' | 'CERTIFICATION';
  requiredFields?: string[];
  offerInfo?: OfferInfo | null;
}

const GeneralDataStep: React.FC<GeneralDataStepProps> = ({ 
  data, 
  onNext, 
  onChange, 
  referralCode,
  templateType = 'TFA',
  requiredFields: _requiredFields = [],
  offerInfo: _offerInfo
}) => {
  // Get authentication status to prevent popup when user is already logged in
  const { user: currentUser } = useAuth();
  
  
  const getFieldStatus = (fieldName: keyof GeneralDataForm) => {
    const hasValue = data[fieldName] && data[fieldName] !== '';
    
    // Determine required fields based on context
    let isRequired = false;
    let shouldShowField = false;
    
    // If requiredFields is passed and only contains nomePadre/nomeMadre, we're in enrollment mode
    if (_requiredFields && _requiredFields.length > 0 && _requiredFields.every(f => ['nomePadre', 'nomeMadre'].includes(f))) {
      // Enrollment mode - only show padre/madre fields, NEVER show email for security
      shouldShowField = ['nomePadre', 'nomeMadre'].includes(fieldName);
      isRequired = _requiredFields.includes(fieldName);
    } else {
      // Registration mode - show all fields based on template type
      isRequired = templateType === 'TFA' 
        ? ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre'].includes(fieldName)
        : ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'].includes(fieldName);
      shouldShowField = true;
    }
    
    const isFieldReadonly = false;
    
    return {
      hasValue,
      isRequired,
      shouldShow: shouldShowField,
      isReadonly: isFieldReadonly
    };
  };

  const [isCodiceFiscaleManual, setIsCodiceFiscaleManual] = useState(false);
  const [provinceOptions] = useState(getProvinceOptions());
  const [cityOptions, setCityOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [emailValidation, setEmailValidation] = useState<{
    isChecking: boolean;
    exists: boolean;
    message: string;
  } | null>(null);
  const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);
  const [showExistingUserPrompt, setShowExistingUserPrompt] = useState(false);
  const [formError, setFormError] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<GeneralDataForm>({
    resolver: zodResolver(generalDataSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const watchedEmail = watch('email');
  const watchedCognome = watch('cognome');
  const watchedNome = watch('nome');
  const watchedDataNascita = watch('dataNascita');
  const watchedProvinciaNascita = watch('provinciaNascita');
  const watchedLuogoNascita = watch('luogoNascita');
  const watchedSesso = watch('sesso');
  const watchedCodiceFiscale = watch('codiceFiscale');

  // Special handling for datiFamiliari step (only nomePadre/nomeMadre)
  useEffect(() => {
    const isDataFamiliariStep = _requiredFields && _requiredFields.length === 2 && 
                                _requiredFields.every(f => ['nomePadre', 'nomeMadre'].includes(f));
    
    if (isDataFamiliariStep && data) {
      
      if (data.nomePadre && data.nomePadre !== watch('nomePadre')) {
        setValue('nomePadre', data.nomePadre);
      }
      if (data.nomeMadre && data.nomeMadre !== watch('nomeMadre')) {
        setValue('nomeMadre', data.nomeMadre);
      }
    }
  }, [data, _requiredFields, setValue, watch]);

  // Auto-generate codice fiscale when data changes
  useEffect(() => {
    const generateCF = async () => {
      if (!isCodiceFiscaleManual && watchedCognome && watchedNome && watchedDataNascita && watchedLuogoNascita && watchedSesso) {
        try {
          // For fiscal code calculation, always use the birth place (luogoNascita)
          // For foreign births, luogoNascita contains the foreign country which has the correct catastral code
          const codiceFiscaleGenerato = await generateCodiceFiscale({
            lastName: watchedCognome,
            firstName: watchedNome,
            birthDate: watchedDataNascita,
            birthPlace: watchedLuogoNascita,
            gender: watchedSesso as 'M' | 'F'
          });
          
          if (codiceFiscaleGenerato && codiceFiscaleGenerato !== watchedCodiceFiscale) {
            setValue('codiceFiscale', codiceFiscaleGenerato);
          }
        } catch (error) {
          console.error('Error generating fiscal code:', error);
        }
      }
    };
    
    generateCF();
  }, [watchedCognome, watchedNome, watchedDataNascita, watchedLuogoNascita, watchedSesso, isCodiceFiscaleManual, setValue, watchedCodiceFiscale]);

  // Update city options when province changes
  useEffect(() => {
    if (watchedProvinciaNascita) {
      const citiesForProvince = getCityOptions(watchedProvinciaNascita);
      setCityOptions(citiesForProvince);
      
      // Reset city selection if current city is not in the new province
      const currentCity = watchedLuogoNascita;
      if (currentCity && !citiesForProvince.some(city => city.value === currentCity)) {
        setValue('luogoNascita', '');
        trigger('luogoNascita'); // Trigger validation after clearing
      }
    } else {
      setCityOptions([]);
      setValue('luogoNascita', '');
      trigger('luogoNascita'); // Trigger validation after clearing
    }
    
  }, [watchedProvinciaNascita, setValue, watchedLuogoNascita, trigger]);

  // Notify parent component of form data changes
  useEffect(() => {
    if (onChange) {
      const currentData = {
        email: watchedEmail,
        cognome: watchedCognome,
        nome: watchedNome,
        dataNascita: watchedDataNascita,
        provinciaNascita: watchedProvinciaNascita,
        luogoNascita: watchedLuogoNascita,
        sesso: watch('sesso'),
        codiceFiscale: watchedCodiceFiscale,
        telefono: watch('telefono'),
        nomePadre: watch('nomePadre'),
        nomeMadre: watch('nomeMadre'),
      };
      onChange(currentData);
    }
  }, [watchedEmail, watchedCognome, watchedNome, watchedDataNascita, watchedProvinciaNascita, watchedLuogoNascita, watchedCodiceFiscale, onChange, watch]);

  // Check if email already exists in real-time
  useEffect(() => {
    const checkEmailExists = async () => {
      if (!watchedEmail || watchedEmail.length < 3 || !watchedEmail.includes('@')) {
        setEmailValidation(null);
        return;
      }

      setEmailValidation({ isChecking: true, exists: false, message: '' });

      try {
        const result = await checkUserExists(watchedEmail);
        
        if (result.exists && result.user) {
          setExistingUser(result.user);
          
          // Check if user came from email verification or secure token
          const urlParams = new URLSearchParams(window.location.search);
          const emailVerified = urlParams.get('emailVerified');
          const secureToken = urlParams.get('token');
          
          // Don't show popup if user is logged in OR verified via email OR has secure token
          if (!currentUser && emailVerified !== 'true' && !secureToken) {
            setEmailValidation({
              isChecking: false,
              exists: true,
              message: 'Un utente con questa email è già registrato'
            });
            setShowExistingUserPrompt(true);
          } else {
            // User is logged in or verified via email, allow to proceed
            setEmailValidation({
              isChecking: false,
              exists: false,
              message: emailVerified === 'true' ? 'Email verificata - puoi procedere' : 'Email confermata per nuova iscrizione'
            });
            setShowExistingUserPrompt(false);
          }
        } else {
          setEmailValidation({
            isChecking: false,
            exists: false,
            message: 'Email disponibile'
          });
          setExistingUser(null);
          setShowExistingUserPrompt(false);
        }
      } catch (error) {
        console.error('Error checking email:', error);
        setEmailValidation(null);
        setExistingUser(null);
        setShowExistingUserPrompt(false);
      }
    };

    const timer = setTimeout(() => {
      checkEmailExists();
    }, 1000); // Debounce di 1 secondo

    return () => clearTimeout(timer);
  }, [watchedEmail, currentUser]);

  // Auto-decode fiscal code when user types it manually
  useEffect(() => {
    const decodeFiscalCodeData = async () => {
      if (isCodiceFiscaleManual && watchedCodiceFiscale && watchedCodiceFiscale.length === 16) {
        try {
          const decodedData = await decodeFiscalCode(watchedCodiceFiscale);
          
          if (decodedData.isValid) {
            // Set the decoded data to the form
            if (decodedData.birthDate) {
              setValue('dataNascita', decodedData.birthDate);
            }
            
            if (decodedData.gender) {
              setValue('sesso', decodedData.gender);
            }
            
            if (decodedData.birthPlace) {
              // Determine if it's a foreign country or Italian city
              const foreignCountries = ['FRANCESE', 'TEDESCA', 'SPAGNOLA', 'BRITANNICA', 'STATUNITENSE', 'CANADESE', 'BRASILIANA', 'ARGENTINA', 'AUSTRALIANA', 'GIAPPONESE', 'CINESE', 'INDIANA', 'RUSSA', 'POLACCA', 'RUMENA', 'BULGARA', 'CROATA', 'SLOVENA', 'UNGHERESE', 'CECA', 'SLOVACCA', 'AUSTRIACA', 'SVIZZERA', 'BELGA', 'OLANDESE', 'DANESE', 'SVEDESE', 'NORVEGESE', 'FINLANDESE', 'PORTOGHESE', 'GRECA', 'TURCA', 'EGIZIANA', 'MAROCCHINA', 'TUNISINA', 'ALGERINA', 'SUDAFRICANA'];
              
              if (foreignCountries.includes(decodedData.birthPlace)) {
                setValue('provinciaNascita', 'EE');
                // Wait for province to be set, then set the city
                setTimeout(() => {
                  if (decodedData.birthPlace) {
                    setValue('luogoNascita', decodedData.birthPlace);
                  }
                }, 100);
              } else {
                // For Italian cities, we need to find the province
                // Map common cities to their provinces
                const cityToProvince: { [key: string]: string } = {
                  'ROMA': 'RM',
                  'MILANO': 'MI',
                  'NAPOLI': 'NA',
                  'TORINO': 'TO',
                  'PALERMO': 'PA',
                  'GENOVA': 'GE',
                  'BOLOGNA': 'BO',
                  'FIRENZE': 'FI',
                  'BARI': 'BA',
                  'CATANIA': 'CT',
                  'VENEZIA': 'VE',
                  'VERONA': 'VR',
                  'MESSINA': 'ME',
                  'PADOVA': 'PD',
                  'TRIESTE': 'TS',
                  'TARANTO': 'TA',
                  'BRESCIA': 'BS',
                  'PRATO': 'PO',
                  'PARMA': 'PR',
                  'MODENA': 'MO',
                  'PESCARA': 'PE',
                  'LIVORNO': 'LI',
                  'RAVENNA': 'RA',
                  'CAGLIARI': 'CA',
                  'FOGGIA': 'FG',
                  'RIMINI': 'RN',
                  'SALERNO': 'SA',
                  'FERRARA': 'FE',
                  'SASSARI': 'SS',
                  'LATINA': 'LT',
                  'MONZA': 'MB',
                  'BERGAMO': 'BG',
                  'FORLI': 'FC',
                  'TRENTO': 'TN',
                  'VICENZA': 'VI',
                  'TERNI': 'TR',
                  'NOVARA': 'NO',
                  'BOLZANO': 'BZ',
                  'PIACENZA': 'PC',
                  'ANCONA': 'AN',
                  'ANDRIA': 'BT',
                  'AREZZO': 'AR',
                  'UDINE': 'UD',
                  'CESENA': 'FC',
                  'PESARO': 'PU',
                  'LECCE': 'LE',
                  'COSENZA': 'CS',
                  'CATANZARO': 'CZ'
                };
                
                const province = cityToProvince[decodedData.birthPlace];
                if (province) {
                  setValue('provinciaNascita', province);
                  // Wait for province to be set, then set the city
                  setTimeout(() => {
                    if (decodedData.birthPlace) {
                      setValue('luogoNascita', decodedData.birthPlace);
                    }
                  }, 100);
                } else {
                  // If we can't find the province, just set the city name
                  if (decodedData.birthPlace) {
                    setValue('luogoNascita', decodedData.birthPlace);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error decoding fiscal code:', error);
        }
      }
    };
    
    decodeFiscalCodeData();
  }, [watchedCodiceFiscale, isCodiceFiscaleManual, setValue]);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      if (onChange) {
        onChange(value as Partial<GeneralDataForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const handleLoginRedirect = () => {
    // Salva i dati del referral se presenti
    if (referralCode) {
      localStorage.setItem('pendingReferralCode', referralCode);
    }
    window.location.href = '/login';
  };

  const handleContinueAsNew = () => {
    setShowExistingUserPrompt(false);
    setExistingUser(null);
    setEmailValidation(null);
    // Reset email field to force user to use a different email
    setValue('email', '');
  };

  const onSubmit = (formData: GeneralDataForm) => {
    setFormError('');
    
    // Only prevent submission for existing email if user is NOT logged in
    // If user is logged in, they should be able to use their existing email for new enrollments
    if (emailValidation?.exists && !showExistingUserPrompt && !currentUser) {
      setFormError('Non puoi procedere con un\'email già registrata. Usa un\'email diversa o effettua il login.');
      return;
    }
    
    // Additional validation for place of birth
    if (!formData.luogoNascita || formData.luogoNascita.trim() === '') {
      setFormError('Il campo "Luogo di Nascita" è obbligatorio. Seleziona prima la provincia di nascita, poi scegli la città.');
      return;
    }
    
    onNext(formData);
  };

  // Check if we're in enrollment mode (only famiglia fields)
  const isEnrollmentMode = _requiredFields && _requiredFields.length > 0 && _requiredFields.every(f => ['nomePadre', 'nomeMadre'].includes(f));
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Pre-populated data notice for additional enrollment */}
      
      <div className={isEnrollmentMode 
        ? "flex flex-col md:flex-row gap-6" 
        : "grid grid-cols-1 md:grid-cols-2 gap-6"
      }>
        {/* Only show email field if it's required for this step */}
        {getFieldStatus('email').shouldShow && (
          <div className="space-y-2">
            <div className="relative">
              <Input
                label="Email *"
                type="email"
                {...register('email')}
                error={errors.email?.message}
                className={`pr-10 ${
                  emailValidation?.exists && !currentUser
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : emailValidation && !emailValidation.exists && !emailValidation.isChecking
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : ''
                }`}
              />
            
            {/* Email validation icon */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 top-6">
              {emailValidation?.isChecking && (
                <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {emailValidation && !emailValidation.isChecking && emailValidation.exists && !currentUser && (
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {emailValidation && !emailValidation.isChecking && !emailValidation.exists && (
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
          
          {/* Email validation message */}
          {emailValidation && !emailValidation.isChecking && (
            <div className={`text-sm ${emailValidation.exists ? 'text-red-600' : 'text-green-600'}`}>
              {emailValidation.message}
              {emailValidation.exists && !currentUser && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => window.location.href = '/login'}
                    className="inline-flex items-center text-xs text-red-700 hover:text-red-800 underline"
                  >
                    Effettua il login invece
                  </button>
                </div>
              )}
            </div>
          )}
          
          </div>
        )}

        {(() => {
          const telefonoStatus = getFieldStatus('telefono');
          return telefonoStatus.shouldShow ? (
            <Input
              label="Telefono *"
              type="tel"
              {...register('telefono')}
              error={errors.telefono?.message}
            />
          ) : null;
        })()}

        {(() => {
          const cognomeStatus = getFieldStatus('cognome');
          return cognomeStatus.shouldShow ? (
            <Input
              label="Cognome *"
              {...register('cognome')}
              error={errors.cognome?.message}
            />
          ) : null;
        })()}

        {(() => {
          const nomeStatus = getFieldStatus('nome');
          return nomeStatus.shouldShow ? (
            <Input
              label="Nome *"
              {...register('nome')}
              error={errors.nome?.message}
            />
          ) : null;
        })()}

        {(() => {
          const dataNascitaStatus = getFieldStatus('dataNascita');
          return dataNascitaStatus.shouldShow ? (
            <Input
              label="Data di Nascita *"
              type="date"
              {...register('dataNascita')}
              error={errors.dataNascita?.message}
            />
          ) : null;
        })()}

        {(() => {
          const sessoStatus = getFieldStatus('sesso');
          return sessoStatus.shouldShow ? (
            <Select
              label="Sesso *"
              options={GENDER_OPTIONS}
              {...register('sesso')}
              error={errors.sesso?.message as string}
              placeholder="Seleziona sesso"
              disabled={sessoStatus.isReadonly || undefined}
              className={sessoStatus.isReadonly ? 'bg-gray-50 cursor-not-allowed' : ''}
            />
          ) : null;
        })()}

        {(() => {
          const provinciaNascitaStatus = getFieldStatus('provinciaNascita');
          return provinciaNascitaStatus.shouldShow ? (
            <div className="col-span-1 md:col-span-2">
              <Select
                label="Provincia di Nascita *"
                options={provinceOptions}
                {...register('provinciaNascita')}
                error={errors.provinciaNascita?.message as string}
                placeholder="Seleziona provincia"
                disabled={provinciaNascitaStatus.isReadonly || undefined}
                className={provinciaNascitaStatus.isReadonly ? 'bg-gray-50 cursor-not-allowed' : ''}
              />
            </div>
          ) : null;
        })()}

        {(() => {
          const luogoNascitaStatus = getFieldStatus('luogoNascita');
          return luogoNascitaStatus.shouldShow ? (
            <div className="col-span-1 md:col-span-2">
              <Select
                label={watchedProvinciaNascita === 'EE' ? "Stato di Nascita *" : "Luogo di Nascita *"}
                options={cityOptions}
                {...register('luogoNascita')}
                error={errors.luogoNascita?.message as string}
                placeholder={
                  !watchedProvinciaNascita ? "Prima seleziona una provincia" :
                  watchedProvinciaNascita === 'EE' ? "Seleziona stato di nascita" : "Seleziona città"
                }
                disabled={!watchedProvinciaNascita || Boolean(luogoNascitaStatus.isReadonly)}
                className={luogoNascitaStatus.isReadonly ? 'bg-gray-50 cursor-not-allowed' : ''}
              />
            </div>
          ) : null;
        })()}


        {(() => {
          const codiceFiscaleStatus = getFieldStatus('codiceFiscale');
          return codiceFiscaleStatus.shouldShow ? (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  label="Codice Fiscale *"
                  {...register('codiceFiscale', {
                    onChange: () => setIsCodiceFiscaleManual(true)
                  })}
                  error={errors.codiceFiscale?.message}
                  className="uppercase pr-10"
                />
            <div className="absolute right-3 top-8 flex items-center space-x-1">
              {!isCodiceFiscaleManual && watchedCodiceFiscale && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs text-green-600">Auto</span>
                </div>
              )}
              {isCodiceFiscaleManual && (
                <div className="flex items-center space-x-1">
                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="text-xs text-blue-600">Manuale</span>
                </div>
              )}
            </div>
          </div>
          {!isCodiceFiscaleManual && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Generato automaticamente dai dati inseriti. Ricontrollare e correggere se necessario</span>
            </div>
          )}
          {isCodiceFiscaleManual && (
            <button
              type="button"
              onClick={async () => {
                setIsCodiceFiscaleManual(false);
                if (watchedCognome && watchedNome && watchedDataNascita && watchedLuogoNascita && watchedSesso) {
                  try {
                    // For fiscal code calculation, always use the birth place (luogoNascita)
                    // For foreign births, luogoNascita contains the foreign country which has the correct catastral code
                    const codiceFiscaleGenerato = await generateCodiceFiscale({
                      lastName: watchedCognome,
                      firstName: watchedNome,
                      birthDate: watchedDataNascita,
                      birthPlace: watchedLuogoNascita,
                      gender: watchedSesso as 'M' | 'F'
                    });
                    setValue('codiceFiscale', codiceFiscaleGenerato);
                  } catch (error) {
                    console.error('Error regenerating fiscal code:', error);
                  }
                }
              }}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
Rigenera automaticamente
            </button>
          )}
            </div>
          ) : null;
        })()}

        <div></div>

        {templateType === 'TFA' && (() => {
          const padreStatus = getFieldStatus('nomePadre');
          const madreStatus = getFieldStatus('nomeMadre');
          
          return (
            <>
              {padreStatus.shouldShow && (
                <div className={isEnrollmentMode ? "flex-1" : ""}>
                  <Input
                    label="Nome del Padre * (solo nome senza il cognome)"
                    {...register('nomePadre')}
                    error={errors.nomePadre?.message}
                  />
                </div>
              )}
              
              {madreStatus.shouldShow && (
                <div className={isEnrollmentMode ? "flex-1" : ""}>
                  <Input
                    label="Nome della Madre * (solo nome senza il cognome)"
                    {...register('nomeMadre')}
                    error={errors.nomeMadre?.message}
                  />
                </div>
              )}
            </>
          );
        })()}
      </div>

      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-blue-800 text-sm">
              Tutti i campi contrassegnati con (*) sono obbligatori per proseguire.
            </p>
          </div>
        </div>
      </div>

      {/* Form error display */}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-red-800 font-semibold mb-1">Impossibile continuare</h4>
              <p className="text-red-700 text-sm">
                {formError}
              </p>
              {formError.includes('email già registrata') && !currentUser && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => window.location.href = '/login'}
                    className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                  >
                    Vai al Login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Existing User Prompt Modal */}
      {showExistingUserPrompt && existingUser && (
        <ExistingUserPrompt
          user={existingUser}
          onLoginRedirect={handleLoginRedirect}
          onContinueAsNew={handleContinueAsNew}
        />
      )}
      
    </form>
  );
};

export default GeneralDataStep;