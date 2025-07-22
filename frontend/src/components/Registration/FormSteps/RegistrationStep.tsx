import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, RegistrationForm } from '../../../utils/validation';
import { submitRegistration, RegistrationData } from '../../../services/api';
import { OfferInfo } from '../../../types/offers';

interface RegistrationStepProps {
  data: Partial<RegistrationForm>;
  formData: any; // Tutti i dati del form per il riepilogo
  onNext: (data: RegistrationForm) => void;
  onChange?: (data: Partial<RegistrationForm>) => void;
  offerInfo?: OfferInfo | null;
}

const RegistrationStep: React.FC<RegistrationStepProps> = ({ 
  data, 
  formData, 
  onNext, 
  onChange,
  offerInfo
}) => {
  const {
    register,
    handleSubmit,
    watch,
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [couponValidation, setCouponValidation] = useState<{
    isValid: boolean;
    message: string;
    discount?: { type: 'FIXED' | 'PERCENTAGE'; amount: number };
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState('');

  const onSubmit = useCallback(async (finalData: RegistrationForm) => {
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    // Check privacy acceptance
    if (!acceptedPrivacy) {
      setPrivacyError('Devi accettare l\'informativa sulla privacy per procedere');
      return;
    }
    
    setIsSubmitting(true);
    setPrivacyError(''); // Reset privacy error
    setSubmitStatus('submitting');
    setErrorMessage(''); // Reset error message
    
    try {
      // Prepara i dati per l'invio
      const registrationPayload: RegistrationData = {
        // Dati generali
        email: formData.email,
        cognome: formData.cognome,
        nome: formData.nome,
        dataNascita: formData.dataNascita,
        luogoNascita: formData.luogoNascita,
        codiceFiscale: formData.codiceFiscale,
        telefono: formData.telefono,
        // Parent names only for TFA Romania
        nomePadre: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.nomePadre,
        nomeMadre: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.nomeMadre,
        
        // Residenza
        residenzaVia: formData.residenzaVia,
        residenzaCitta: formData.residenzaCitta,
        residenzaProvincia: formData.residenzaProvincia,
        residenzaCap: formData.residenzaCap,
        hasDifferentDomicilio: formData.hasDifferentDomicilio || false,
        domicilioVia: formData.domicilioVia,
        domicilioCitta: formData.domicilioCitta,
        domicilioProvincia: formData.domicilioProvincia,
        domicilioCap: formData.domicilioCap,
        
        // Istruzione - only for TFA Romania
        tipoLaurea: offerInfo?.offerType === 'CERTIFICATION' ? 'Non specificato' : (formData.tipoLaurea || 'Non specificato'),
        laureaConseguita: offerInfo?.offerType === 'CERTIFICATION' ? 'Non specificato' : (formData.laureaConseguita || 'Non specificato'),
        laureaConseguitaCustom: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.laureaConseguitaCustom,
        laureaUniversita: offerInfo?.offerType === 'CERTIFICATION' ? 'Non specificato' : (formData.laureaUniversita || 'Non specificato'),
        laureaData: offerInfo?.offerType === 'CERTIFICATION' ? '2020-01-01' : (formData.laureaData || '2020-01-01'),
        
        // Professione - only for TFA Romania
        tipoProfessione: offerInfo?.offerType === 'CERTIFICATION' ? 'Non specificato' : (formData.tipoProfessione || 'Non specificato'),
        scuolaDenominazione: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.scuolaDenominazione,
        scuolaCitta: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.scuolaCitta,
        scuolaProvincia: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.scuolaProvincia,
        
        // Iscrizione
        referralCode: formData.referralCode,
        courseId: formData.courseId,
        couponCode: finalData.couponCode || formData.couponCode,
        paymentPlan: formData.paymentPlan,
        customInstallments: formData.customInstallments,
        partnerOfferId: offerInfo?.id || formData.partnerOfferId,
        
        // File
        cartaIdentita: formData.cartaIdentita,
        certificatoTriennale: formData.certificatoTriennale,
        certificatoMagistrale: formData.certificatoMagistrale,
        pianoStudioTriennale: formData.pianoStudioTriennale,
        pianoStudioMagistrale: formData.pianoStudioMagistrale,
        certificatoMedico: formData.certificatoMedico,
        certificatoNascita: formData.certificatoNascita,
        diplomoLaurea: formData.diplomoLaurea,
        pergamenaLaurea: formData.pergamenaLaurea,
      };
      
      // Invia i dati al server
      
      const response = await submitRegistration(registrationPayload);
      
      if (response.success) {
        setSubmitStatus('success');
        
        localStorage.removeItem('registrationForm');
        localStorage.removeItem('registrationFormFiles');
        localStorage.removeItem('registrationFormStep');
        
        onNext(finalData);
      } else {
        throw new Error(response.message || 'Errore durante la registrazione');
      }
    } catch (error) {
      console.error('Errore durante l\'invio:', error);
      
      // Handle specific error types
      let userFriendlyMessage = 'Si è verificato un errore durante la registrazione. Riprova tra qualche minuto.';
      
      if ((error as any).response?.data?.error?.includes('email è già registrato') || 
          (error as any).response?.data?.code === 'EMAIL_ALREADY_EXISTS') {
        userFriendlyMessage = 'Un utente con questa email è già registrato. Se hai già un account, effettua il login invece di registrarti nuovamente.';
      } else if ((error as any).response?.data?.details) {
        // Show more specific error in development
        userFriendlyMessage = (error as any).response.data.details;
      }
      
      setErrorMessage(userFriendlyMessage);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onNext, offerInfo, isSubmitting, acceptedPrivacy]);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      if (onChange) {
        onChange(value as Partial<RegistrationForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  // Expose submit function globally for external form submission
  useEffect(() => {
    (window as any).submitRegistrationForm = () => {
      handleSubmit(onSubmit)();
    };
    
    return () => {
      delete (window as any).submitRegistrationForm;
    };
  }, [handleSubmit, onSubmit]);

  const formatFileInfo = (file: File | null) => {
    if (!file) return 'Non caricato';
    return `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  };

  const validateCoupon = useCallback(async (couponCode: string) => {
    if (!couponCode.trim()) {
      setCouponValidation(null);
      return;
    }

    // Need partnerId to validate coupon
    if (!offerInfo?.partnerId && !formData.referralCode) {
      setCouponValidation({
        isValid: false,
        message: 'Partner non identificato per la validazione del coupon'
      });
      return;
    }

    setValidatingCoupon(true);
    
    try {
      const response = await fetch('/api/registration/validate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          couponCode: couponCode.trim(),
          partnerId: offerInfo?.partnerId || formData.partnerId
        })
      });

      const result = await response.json();
      
      if (result.isValid) {
        setCouponValidation({
          isValid: true,
          message: result.message,
          discount: {
            type: result.coupon.discountType,
            amount: result.coupon.discountType === 'PERCENTAGE' 
              ? result.coupon.discountPercent 
              : result.coupon.discountAmount
          }
        });
      } else {
        setCouponValidation({
          isValid: false,
          message: result.message
        });
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      setCouponValidation({
        isValid: false,
        message: 'Errore nella validazione del coupon'
      });
    } finally {
      setValidatingCoupon(false);
    }
  }, [offerInfo?.partnerId, formData.partnerId, formData.referralCode]);

  // Watch coupon code changes
  const couponCode = watch('couponCode');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (couponCode) {
        validateCoupon(couponCode);
      } else {
        setCouponValidation(null);
      }
    }, 500); // Debounce di 500ms

    return () => clearTimeout(timer);
  }, [couponCode, validateCoupon]);

  if (submitStatus === 'success') {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto mb-6 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Iscrizione Completata!</h3>
        <p className="text-gray-600 text-lg mb-8">
          La tua iscrizione è stata inviata con successo. Riceverai una conferma via email a breve.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mx-auto max-w-md">
          <p className="text-green-800 text-sm">
            Benvenuto nella piattaforma Diamante! Il nostro team ti contatterà presto per i prossimi passi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Riepilogo Iscrizione</h3>
        
        {/* Dynamic intro based on offer type */}
        {offerInfo?.offerType === 'CERTIFICATION' ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Riepilogo Certificazione</h4>
                <p className="text-blue-800 text-sm">
                  Stai completando l'iscrizione alla certificazione "{offerInfo.name}". 
                  Verifica i dati inseriti prima di procedere.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 mb-6">
            Verifica i tuoi dati prima di completare l'iscrizione al TFA Sostegno. Potrai tornare indietro per modificare qualsiasi informazione.
          </p>
        )}

        {/* Riepilogo Dati Generali */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Dati Generali
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Nome Completo:</span>
              <p className="text-gray-900">{formData.nome} {formData.cognome}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Email:</span>
              <p className="text-gray-900">{formData.email}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Data di Nascita:</span>
              <p className="text-gray-900">{formData.dataNascita}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Codice Fiscale:</span>
              <p className="text-gray-900">{formData.codiceFiscale}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Telefono:</span>
              <p className="text-gray-900">{formData.telefono}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Luogo di Nascita:</span>
              <p className="text-gray-900">{formData.luogoNascita}</p>
            </div>
            
            {/* Show parent names only for TFA Romania */}
            {offerInfo?.offerType !== 'CERTIFICATION' && (formData.nomePadre || formData.nomeMadre) && (
              <>
                {formData.nomePadre && (
                  <div>
                    <span className="font-medium text-gray-500">Nome Padre:</span>
                    <p className="text-gray-900">{formData.nomePadre}</p>
                  </div>
                )}
                {formData.nomeMadre && (
                  <div>
                    <span className="font-medium text-gray-500">Nome Madre:</span>
                    <p className="text-gray-900">{formData.nomeMadre}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Riepilogo Residenza */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Residenza
          </h4>
          <div className="text-sm">
            <div className="mb-2">
              <span className="font-medium text-gray-500">Indirizzo:</span>
              <p className="text-gray-900">
                {formData.residenzaVia}, {formData.residenzaCitta} ({formData.residenzaProvincia}) {formData.residenzaCap}
              </p>
            </div>
            {formData.hasDifferentDomicilio && (
              <div>
                <span className="font-medium text-gray-500">Domicilio:</span>
                <p className="text-gray-900">
                  {formData.domicilioVia}, {formData.domicilioCitta} ({formData.domicilioProvincia}) {formData.domicilioCap}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Riepilogo Istruzione - only for TFA Romania */}
        {offerInfo?.offerType !== 'CERTIFICATION' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              Istruzione
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Tipo di Laurea:</span>
                <p className="text-gray-900">{formData.tipoLaurea}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Corso di Laurea:</span>
                <p className="text-gray-900">
                  {formData.laureaConseguita === 'ALTRO' 
                    ? formData.laureaConseguitaCustom 
                    : formData.laureaConseguita
                  }
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Università:</span>
                <p className="text-gray-900">{formData.laureaUniversita}</p>
              </div>
              <div>
                <span className="font-medium text-gray-500">Data Conseguimento:</span>
                <p className="text-gray-900">{formData.laureaData}</p>
              </div>
            </div>
          </div>
        )}

        {/* Riepilogo Professione - only for TFA Romania */}
        {offerInfo?.offerType !== 'CERTIFICATION' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Professione
            </h4>
            <div className="text-sm">
              <div className="mb-2">
                <span className="font-medium text-gray-500">Situazione Professionale:</span>
                <p className="text-gray-900">{formData.tipoProfessione}</p>
              </div>
              {formData.tipoProfessione === 'Insegnante' && formData.scuolaDenominazione && (
                <div>
                  <span className="font-medium text-gray-500">Scuola:</span>
                  <p className="text-gray-900">
                    {formData.scuolaDenominazione}, {formData.scuolaCitta} ({formData.scuolaProvincia})
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Riepilogo Documenti - dynamic based on offer type */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            Documenti Caricati
            {offerInfo?.offerType === 'CERTIFICATION' && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Solo documenti essenziali
              </span>
            )}
          </h4>
          <div className="space-y-3 text-sm">
            {/* Documento principale - always shown */}
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Carta d'Identità:</span>
              <span className={`${formData.cartaIdentita ? 'text-green-600' : 'text-gray-400'}`}>
                {formatFileInfo(formData.cartaIdentita)}
              </span>
            </div>
            
            {/* TFA Romania: Full document list */}
            {offerInfo?.offerType !== 'CERTIFICATION' && (
              <>
                {/* Certificati di Laurea */}
                <div className="border-t pt-2">
                  <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Certificati di Laurea</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Triennale:</span>
                      <span className={`${formData.certificatoTriennale ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoTriennale)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Magistrale:</span>
                      <span className={`${formData.certificatoMagistrale ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoMagistrale)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Piani di Studio */}
                <div className="border-t pt-2">
                  <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Piani di Studio</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Triennale:</span>
                      <span className={`${formData.pianoStudioTriennale ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pianoStudioTriennale)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Magistrale/V.O.:</span>
                      <span className={`${formData.pianoStudioMagistrale ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pianoStudioMagistrale)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Altri Documenti */}
                <div className="border-t pt-2">
                  <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Altri Documenti</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Certificato Medico:</span>
                      <span className={`${formData.certificatoMedico ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoMedico)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Certificato di Nascita:</span>
                      <span className={`${formData.certificatoNascita ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoNascita)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Diploma:</span>
                      <span className={`${formData.diplomoLaurea ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.diplomoLaurea)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Pergamena:</span>
                      <span className={`${formData.pergamenaLaurea ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pergamenaLaurea)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {/* Certification: Only essential documents */}
            {offerInfo?.offerType === 'CERTIFICATION' && (
              <div className="border-t pt-2">
                <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Documenti Essenziali</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Diploma di Laurea:</span>
                    <span className={`${formData.diplomoLaurea ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatFileInfo(formData.diplomoLaurea)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Pergamena di Laurea:</span>
                    <span className={`${formData.pergamenaLaurea ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatFileInfo(formData.pergamenaLaurea)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  ℹ️ Per le certificazioni sono richiesti solo i documenti essenziali. Altri documenti possono essere caricati successivamente se necessario.
                </div>
              </div>
            )}
            
            {/* Note about optional documents */}
            <div className="border-t pt-2 mt-4">
              <p className="text-xs text-gray-500 italic">
                {offerInfo?.offerType === 'CERTIFICATION' 
                  ? '* I documenti non caricati non impediranno il completamento dell\'iscrizione'
                  : '* Tutti i documenti sono opzionali e possono essere caricati successivamente'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Riepilogo Iscrizione - enhanced for different offer types */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Dettagli Iscrizione
          </h4>
          
          {/* Offer specific information */}
          {offerInfo && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {offerInfo.offerType === 'CERTIFICATION' ? (
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h5 className="text-sm font-semibold text-blue-900">{offerInfo.name}</h5>
                  <p className="text-xs text-blue-700 mt-1">{offerInfo.course.description || 'Corso selezionato'}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs">
                    <span className="text-blue-600">
                      <strong>Totale: €{offerInfo.totalAmount}</strong>
                    </span>
                    <span className="text-blue-600">
                      {offerInfo.installments} rate da €{(Number(offerInfo.totalAmount) / offerInfo.installments).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">
                {offerInfo?.offerType === 'CERTIFICATION' ? 'Certificazione:' : 'Corso Selezionato:'}
              </span>
              <p className="text-gray-900">
                {offerInfo ? offerInfo.course.name : (formData.courseId || 'Non selezionato')}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Piano di Pagamento:</span>
              <p className="text-gray-900">
                {formData.paymentPlan === 'custom' 
                  ? `Piano Personalizzato (${formData.customInstallments} rate)`
                  : formData.paymentPlan || 'Piano predefinito partner'
                }
              </p>
            </div>
            
            {/* Show partner info if available */}
            {formData.referralCode && (
              <div className="md:col-span-2">
                <span className="font-medium text-gray-500">Codice Referral Partner:</span>
                <p className="text-green-600 font-medium">{formData.referralCode}</p>
              </div>
            )}
          </div>
        </div>

        {/* Opzioni finali */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Codici e Offerte</h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Codice Coupon (opzionale)
              </label>
              <div className="relative">
                <input
                  type="text"
                  {...register('couponCode')}
                  className={`
                    mt-1 block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none
                    ${couponValidation?.isValid 
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500' 
                      : couponValidation?.isValid === false 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }
                  `}
                  placeholder="Inserisci codice coupon"
                />
                
                {/* Loading spinner */}
                {validatingCoupon && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                
                {/* Validation icon */}
                {!validatingCoupon && couponValidation && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {couponValidation.isValid ? (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              
              {/* Validation message */}
              {couponValidation && (
                <div className={`mt-2 text-sm ${couponValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {couponValidation.message}
                </div>
              )}
              
              {/* Info message instead of hardcoded suggestions */}
              {!couponCode && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    💡 Hai un codice coupon? Inseriscilo qui sopra per applicare lo sconto.
                  </p>
                </div>
              )}
            </div>
            
            {formData.referralCode && (
              <div>
                <span className="font-medium text-gray-500">Codice Referral:</span>
                <p className="text-green-600 font-medium">{formData.referralCode}</p>
              </div>
            )}
          </div>
        </div>

      </div>


      {submitStatus === 'error' && (
        <div className="mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-red-800 font-semibold mb-1">Errore durante la registrazione</h4>
                <p className="text-red-700 text-sm">
                  {errorMessage}
                </p>
                {errorMessage.includes('email è già registrato') && (
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
        </div>
      )}
      
      {/* Privacy Policy Acceptance */}
      <div className="mt-8">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="privacy-policy"
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => {
                setAcceptedPrivacy(e.target.checked);
                if (e.target.checked) setPrivacyError('');
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="privacy-policy" className="text-gray-700">
              Accetto l'{' '}
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Informativa sulla Privacy
              </a>
              {' '}e autorizzo il trattamento dei dati personali *
            </label>
          </div>
        </div>
        
        {privacyError && (
          <div className="mt-2 text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {privacyError}
          </div>
        )}
      </div>
    </form>
  );
};

export default RegistrationStep;