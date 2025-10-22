import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registrationSchema, RegistrationForm } from '../../../utils/validation';
import { submitEnrollment, submitVerifiedUserEnrollment, submitTokenEnrollment, getUserProfileByToken, apiRequest } from '../../../services/api';
import { OfferInfo } from '../../../types/offers';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from 'react-router-dom';

interface RegistrationStepProps {
  data: Partial<RegistrationForm>;
  formData: any; // Tutti i dati del form per il riepilogo
  onNext: (data: RegistrationForm) => void;
  onChange?: (data: Partial<RegistrationForm>) => void;
  offerInfo?: OfferInfo | null;
  userProfile?: any; // Profile data from MultiStepForm
  requestedByEmployeeId?: string | null; // Track referring partner employee
}

const RegistrationStep: React.FC<RegistrationStepProps> = ({
  data,
  formData,
  onNext,
  onChange,
  offerInfo,
  userProfile: passedUserProfile,
  requestedByEmployeeId
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<any>(passedUserProfile || null);
  
  // Gestisce utenti verificati via token o email (legacy)
  const urlParams = new URLSearchParams(location.search);
  const accessToken = urlParams.get('token');
  const emailVerified = urlParams.get('emailVerified');
  const verifiedEmail = urlParams.get('email');
  const {
    register,
    handleSubmit,
    watch
  } = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: data,
    mode: 'onChange',
  });
  

  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);
  const [couponValidation, setCouponValidation] = useState<{
    isValid: boolean;
    message: string;
    discount?: { type: 'FIXED' | 'PERCENTAGE'; amount: number };
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState('');

  // Load user profile data for complete display in summary
  useEffect(() => {
    if (passedUserProfile) {
      return; // Skip loading if profile is already provided
    }
    
    const loadUserProfile = async () => {
      // Se l'utente è autenticato, usa l'API normale
      if (user) {
        try {
          const response = await apiRequest<{user: any; profile: any; assignedPartner: any}>({
            url: '/user/profile',
            method: 'GET'
          });
          setUserProfile(response.profile);
        } catch (error) {
          console.error('Error loading user profile:', error);
          setUserProfile(null);
        }
        return;
      }

      // Se l'utente arriva con un token di accesso, carica il profilo con il token
      if (accessToken) {
        try {
          const response = await getUserProfileByToken(accessToken);
          setUserProfile(response);
        } catch (error) {
          console.error('Error loading user profile by token:', error);
          setUserProfile(null);
        }
        return;
      }

      // LEGACY: Se l'utente arriva da verifica email, carica il profilo con l'email
      if (emailVerified === 'true' && verifiedEmail) {
        try {
          const response = await apiRequest<{user: any; profile: any; assignedPartner: any}>({
            method: 'POST',
            url: '/user/profile-by-email',
            data: { email: verifiedEmail }
          });
          setUserProfile(response.profile);
        } catch (error) {
          console.error('Errore recupero profilo utente verificato:', error);
          setUserProfile(null);
        }
        return;
      }

      // Nessun utente autenticato o verificato
      setUserProfile(null);
    };

    loadUserProfile();
  }, [user, accessToken, emailVerified, verifiedEmail, passedUserProfile]);

  // Helper function to get complete data (from formData or userProfile)
  const getCompleteData = useCallback((field: string) => {
    // First try formData (user input), then fallback to userProfile (saved data)
    const formValue = formData[field];
    
    // Handle nested userProfile structure (from token) vs flat structure (from direct API)
    const profile = userProfile?.profile || userProfile;
    const profileValue = profile?.[field];
    
    // Handle date formatting for display
    if (field === 'dataNascita' && (formValue || profileValue)) {
      const dateValue = formValue || profileValue;
      if (dateValue) {
        try {
          // If it's already formatted for display, return as is
          if (typeof dateValue === 'string' && dateValue.includes('/')) {
            return dateValue;
          }
          // Otherwise format it
          const date = new Date(dateValue);
          return date.toLocaleDateString('it-IT');
        } catch {
          return dateValue;
        }
      }
    }
    
    // For email, if user is verified via token or email, use the appropriate email
    if (field === 'email' && !formValue && !profileValue) {
      if (accessToken && userProfile?.user?.email) {
        return userProfile.user.email;
      }
      if (emailVerified === 'true' && verifiedEmail) {
        return verifiedEmail;
      }
      // Fallback to authenticated user's email for any course type
      if (user?.email) {
        return user.email;
      }
    }
    
    const result = formValue || profileValue || '';
    
    // Tutti i campi delle generalità sono obbligatori - se manca un valore significa che c'è un problema
    if (!result && ['nome', 'cognome', 'email', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'].includes(field)) {
      console.warn(`⚠️ CAMPO OBBLIGATORIO MANCANTE: ${field}`, {
        formValue,
        profileValue,
        userProfile: userProfile ? 'presente' : 'assente',
        formDataKeys: formData ? Object.keys(formData) : 'nessuno'
      });
    }
    
    return result;
  }, [formData, userProfile, accessToken, emailVerified, verifiedEmail]);

  const onSubmit = useCallback(async (finalData: RegistrationForm) => {
    
    // Prevent double submission - immediately return if already submitting
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress, ignoring duplicate request');
      return;
    }
    
    // Set submitting state IMMEDIATELY to prevent race conditions
    setIsSubmitting(true);
    
    // Check privacy acceptance
    if (!acceptedPrivacy) {
      setPrivacyError('Devi accettare l\'informativa sulla privacy per procedere');
      setIsSubmitting(false); // Reset on error
      return;
    }
    setPrivacyError(''); // Reset privacy error
    setSubmitStatus('submitting');
    setErrorMessage(''); // Reset error message
    
    try {
      // Prepara i dati per l'invio
      // Calculate payment information based on selected plan
      const calculatePaymentInfo = () => {
        if (!offerInfo) {
          // Use course template type to determine default amount
          // Since we don't have offerInfo, use a generic amount (will be overridden by actual values)
          const defaultAmount = 1500; // Safe default for certifications
          return {
            originalAmount: defaultAmount,
            finalAmount: defaultAmount,
            installments: 1,
            downPayment: 0,
            installmentAmount: defaultAmount
          };
        }

        const baseAmount = Number(offerInfo.totalAmount);
        let finalAmount = baseAmount;
        let installments = 1;
        let downPayment = 0;
        let installmentAmount = baseAmount;

        // Per TFA Romania: acconto fisso di 1500€ - usa il templateType del corso
        const isTfaRomania = offerInfo.course?.templateType === 'TFA';
        
        if (isTfaRomania) {
          downPayment = 1500;
        }

        // Apply coupon discount if available
        if (couponValidation?.isValid && couponValidation.discount) {
          const discount = couponValidation.discount;
          if (discount.type === 'PERCENTAGE') {
            finalAmount = baseAmount * (1 - discount.amount / 100);
          } else if (discount.type === 'FIXED') {
            finalAmount = Math.max(0, baseAmount - discount.amount);
          }
        }

        // Handle different payment plans
        if (formData.paymentPlan === 'single') {
          installments = 1;
        } else if (formData.paymentPlan === 'biannual') {
          installments = 2;
        } else if (formData.paymentPlan === 'quarterly') {
          installments = 4;
        } else if (formData.paymentPlan === 'monthly') {
          installments = 12;
        } else if (formData.paymentPlan === 'certification-plan') {
          installments = offerInfo.installments;
        } else {
          // Default to offer installments if no specific plan is selected
          installments = offerInfo.installments;
        }

        // Calcola l'importo delle rate usando finalAmount (con sconto applicato)
        if (installments > 1 && downPayment > 0) {
          // Per TFA: (totale scontato - acconto fisso) / numero rate
          // L'acconto rimane sempre 1500€ fisso, lo sconto si applica solo alle rate
          const remainingAmount = finalAmount - downPayment;
          installmentAmount = remainingAmount / installments;
        } else if (installments > 1) {
          // Per altri corsi: totale scontato / numero rate
          installmentAmount = finalAmount / installments;
        } else {
          // Pagamento unico
          installmentAmount = finalAmount;
        }

        return {
          originalAmount: baseAmount,
          finalAmount: finalAmount,
          installments: installments,
          downPayment: downPayment,
          installmentAmount: Math.round(installmentAmount * 100) / 100 // Arrotonda a 2 decimali
        };
      };

      const paymentInfo = calculatePaymentInfo();

      const registrationPayload = {
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
        
        // Dati triennale - only for TFA Romania
        tipoLaureaTriennale: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.tipoLaureaTriennale,
        laureaConseguitaTriennale: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.laureaConseguitaTriennale,
        laureaUniversitaTriennale: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.laureaUniversitaTriennale,
        laureaDataTriennale: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.laureaDataTriennale,
        
        // Diploma Superiori - required for TFA Romania
        diplomaData: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.diplomaData,
        diplomaCitta: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.diplomaCitta,
        diplomaProvincia: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.diplomaProvincia,
        diplomaIstituto: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.diplomaIstituto,
        diplomaVoto: offerInfo?.offerType === 'CERTIFICATION' ? undefined : formData.diplomaVoto,
        
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
        partnerOfferId: offerInfo?.id || formData.partnerOfferId,
        
        // Per utenti verificati via email
        verifiedEmail: emailVerified === 'true' ? verifiedEmail || undefined : undefined,
        
        // Payment information (calculated from selected plan)
        originalAmount: paymentInfo.originalAmount,
        finalAmount: paymentInfo.finalAmount,
        installments: paymentInfo.installments,
        downPayment: paymentInfo.downPayment,
        installmentAmount: paymentInfo.installmentAmount,
        
        // File - Include temporary documents from localStorage
        cartaIdentita: formData.cartaIdentita,
        certificatoTriennale: formData.certificatoTriennale,
        certificatoMagistrale: formData.certificatoMagistrale,
        pianoStudioTriennale: formData.pianoStudioTriennale,
        pianoStudioMagistrale: formData.pianoStudioMagistrale,
        certificatoMedico: formData.certificatoMedico,
        certificatoNascita: formData.certificatoNascita,
        diplomoLaurea: formData.diplomoLaurea,
        pergamenaLaurea: formData.pergamenaLaurea,
        
        // Add temporary documents for server processing (mapped to backend format)
        tempDocuments: (() => {
          try {
            const tempDocuments = localStorage.getItem('tempDocuments');
            const docs = tempDocuments ? JSON.parse(tempDocuments) : [];
            console.log('📁 Temp documents loaded:', docs.length, 'documents');
            
            // Map temporary documents to format expected by backend
            const mappedDocs = docs.map((doc: any) => ({
              fileName: doc.fileName, // Use actual fileName not originalFileName for temp file
              originalFileName: doc.originalFileName,
              r2Key: doc.r2Key, // Add R2 key for backend processing
              url: doc.r2Key || doc.url || doc.filePath, // Prioritize r2Key
              filePath: doc.filePath, // Include filePath as well for backward compatibility
              type: doc.type,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType
            }));
            
            console.log('📄 Documents mapped for backend:', mappedDocs.map((d: any) => ({ fileName: d.fileName, type: d.type })));
            return mappedDocs;
          } catch (error) {
            console.error('❌ Error loading temp documents:', error);
            return [];
          }
        })(),

        // Partner referral tracking
        requestedByEmployeeId: requestedByEmployeeId
      };

      console.log('🔗 PARTNER TRACKING DEBUG:', {
        requestedByEmployeeId,
        hasRequestedBy: !!requestedByEmployeeId,
        payloadIncludesRef: !!registrationPayload.requestedByEmployeeId
      });

      // DEBUG: Document upload analysis
      console.log('📁 Document upload analysis:', {
        cartaIdentita: !!registrationPayload.cartaIdentita,
        certificatoTriennale: !!registrationPayload.certificatoTriennale,
        certificatoMagistrale: !!registrationPayload.certificatoMagistrale,
        pianoStudioTriennale: !!registrationPayload.pianoStudioTriennale,
        pianoStudioMagistrale: !!registrationPayload.pianoStudioMagistrale,
        certificatoMedico: !!registrationPayload.certificatoMedico,
        certificatoNascita: !!registrationPayload.certificatoNascita,
        diplomoLaurea: !!registrationPayload.diplomoLaurea,
        pergamenaLaurea: !!registrationPayload.pergamenaLaurea
      });
      console.log('📄 Temp documents count:', registrationPayload.tempDocuments.length);
      
      // Invia i dati al server - scegli l'endpoint corretto
      let response;
      
      if (accessToken) {
        // Utente verificato via token - usa endpoint token-based
        response = await submitTokenEnrollment({
          ...registrationPayload,
          accessToken: accessToken
        });
      } else if (emailVerified === 'true' && verifiedEmail) {
        // LEGACY: Utente verificato via email - usa endpoint senza autenticazione
        response = await submitVerifiedUserEnrollment({
          ...registrationPayload,
          verifiedEmail: verifiedEmail
        });
      } else if (user) {
        // Utente autenticato - usa endpoint con autenticazione
        response = await submitEnrollment(registrationPayload);
      } else {
        throw new Error('Utente non autenticato. Effettua il login per procedere.');
      }
      
      if (response.success) {
        // Finalize documents if we have a registrationId and temp documents
        if (response.registrationId) {
          const tempDocs = localStorage.getItem('tempDocuments');
          const userId = user?.id || userProfile?.user?.id;

          if (tempDocs && userId) {
            try {
              const documents = JSON.parse(tempDocs);
              if (documents.length > 0) {
                console.log('📁 Finalizing documents for registration:', response.registrationId);

                // Call finalize endpoint to move temp documents to permanent storage
                const finalizeResponse = await fetch('/api/document-upload/finalize', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    registrationId: response.registrationId,
                    userId: userId,
                    documents: documents
                  })
                });

                if (finalizeResponse.ok) {
                  const result = await finalizeResponse.json();
                  console.log('✅ Documents finalized:', result);
                } else {
                  console.error('❌ Failed to finalize documents');
                }
              }
            } catch (error) {
              console.error('❌ Error finalizing documents:', error);
            }
          }
        }

        setSubmitStatus('success');
        setIsSubmitting(false); // Reset submitting state on success

        // Clear all registration-related localStorage items
        localStorage.removeItem('registrationForm');
        localStorage.removeItem('registrationFormFiles');
        localStorage.removeItem('registrationFormStep');
        localStorage.removeItem('registrationReferralCode');
        localStorage.removeItem('registrationFormData');
        localStorage.removeItem('isAdditionalEnrollment');
        localStorage.removeItem('tempDocuments');
        localStorage.removeItem('tempUserId');

        onNext(finalData);
      } else {
        throw new Error(response.message || 'Errore durante la registrazione');
      }
    } catch (error) {
      console.error('❌ Errore durante submission:', error);
      setIsSubmitting(false); // Reset submitting state on error
      
      // Handle specific error types
      let userFriendlyMessage = 'Si è verificato un errore durante la registrazione. Riprova tra qualche minuto.';
      
      if ((error as any).response?.data?.error?.includes('email è già registrato') || 
          (error as any).response?.data?.code === 'EMAIL_ALREADY_EXISTS' ||
          (error as any).response?.data?.code === 'USER_ALREADY_EXISTS') {
        
        const errorData = (error as any).response?.data;
        userFriendlyMessage = errorData?.error || 'Un utente con questa email è già registrato. Se hai già un account, effettua il login per iscriverti a nuovi corsi.';
        
        // Show login prompt for existing users
        if (errorData?.code === 'USER_ALREADY_EXISTS' || errorData?.suggestion === 'LOGIN_REQUIRED') {
          setShowLoginPrompt(true);
        }
      } else if ((error as any).response?.data?.details) {
        // Show more specific error in development
        userFriendlyMessage = (error as any).response.data.details;
      }
      
      setErrorMessage(userFriendlyMessage);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onNext, offerInfo, isSubmitting, acceptedPrivacy, accessToken, emailVerified, verifiedEmail, user, couponValidation?.discount, couponValidation?.isValid]);

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
    (window as any).submitEnrollmentForm = () => {
      handleSubmit(onSubmit)();
    };
    
    return () => {
      delete (window as any).submitEnrollmentForm;
    };
  }, [handleSubmit, onSubmit]);

  // Helper function to check if a document exists in tempDocuments
  const hasDocument = (documentType: string): boolean => {
    try {
      const tempDocs = localStorage.getItem('tempDocuments');
      if (tempDocs) {
        const docs = JSON.parse(tempDocs);
        return docs.some((d: any) => d.type === documentType);
      }
    } catch (e) {
      console.error('Error checking temp documents:', e);
    }
    return false;
  };

  const formatFileInfo = (file: File | null, documentType?: string) => {
    if (file) {
      return `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    }
    
    // Check if document exists in tempDocuments
    if (documentType) {
      try {
        const tempDocs = localStorage.getItem('tempDocuments');
        if (tempDocs) {
          const docs = JSON.parse(tempDocs);
          const doc = docs.find((d: any) => d.type === documentType);
          if (doc) {
            const size = doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(2) : '0.00';
            return `${doc.originalFileName} (${size} MB) ✅`;
          }
        }
      } catch (e) {
        console.error('Error checking temp documents:', e);
      }
    }
    
    return 'Non caricato';
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
        const discountData = {
          type: result.coupon.discountType,
          amount: result.coupon.discountType === 'PERCENTAGE' 
            ? result.coupon.discountPercent 
            : result.coupon.discountAmount
        };
        
        setCouponValidation({
          isValid: true,
          message: result.message,
          discount: discountData
        });
        
        // Also update form data with coupon validation for use in other components
        if (onChange) {
          onChange({
            couponValidation: {
              isValid: true,
              discount: discountData
            }
          });
        }
        
      } else {
        setCouponValidation({
          isValid: false,
          message: result.message
        });
        
        // Clear coupon validation from form data
        if (onChange) {
          onChange({
            couponValidation: null
          });
        }
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
  }, [offerInfo?.partnerId, formData.partnerId, formData.referralCode, onChange]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl w-full">
          {/* Success Animation */}
          <div className="text-center mb-8">
            <div className="relative">
              {/* Animated background circle */}
              <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mx-auto mb-6 flex items-center justify-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full"></div>
                <svg className="w-16 h-16 text-white animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              
              {/* Floating particles */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4">
                <div className="flex space-x-1 opacity-70">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
            
            {/* Main heading with celebration */}
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              🎉 Iscrizione Completata!
            </h1>
            <p className="text-xl text-gray-700 mb-8 font-medium">
              La tua iscrizione è stata inviata con successo
            </p>
          </div>
          
          {/* Main success card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-6 border border-white/20">
            {/* Welcome message */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Benvenuto in Diamante!</h2>
              <p className="text-gray-600">
                Il tuo percorso formativo sta per iniziare
              </p>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              {(user || accessToken || (emailVerified === 'true' && verifiedEmail)) && (
                <a
                  href={user ? "/dashboard" : "/login"}
                  className="flex-1 group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    {user ? 'Vai alla tua Area Riservata' : 'Accedi alla tua Area Riservata'}
                  </div>
                </a>
              )}
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-white/50 backdrop-blur-sm border border-gray-200 text-gray-700 font-medium py-4 px-6 rounded-2xl hover:bg-white/80 hover:shadow-md transition-all duration-300 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Torna alla Home
              </button>
            </div>
            
            {/* Info message for verified users */}
            {!user && emailVerified === 'true' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-blue-800 text-sm font-medium">
                      💡 Effettua il login per accedere alla tua area personale e monitorare lo stato dell'iscrizione
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Next steps card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-white/20">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Prossimi Passi</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    <span>Riceverai una email di conferma con tutti i dettagli</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    <span>Il tuo partner di riferimento ti contatterà a breve</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    <span>Controlla la tua casella email (anche lo spam)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></div>
                    <span>{user ? 'Monitora il tuo progresso nell\'area riservata' : 'Effettua il login per accedere alla tua area riservata'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer note */}
          <div className="text-center mt-6">
            <p className="text-gray-500 text-sm">
              Conserva l'email di conferma per i tuoi archivi
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 relative">
      {/* Loading overlay durante il submit */}
      {submitStatus === 'submitting' && (
        <div className="absolute inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-semibold text-gray-700">Invio iscrizione in corso...</p>
            <p className="text-sm text-gray-500 mt-2">Attendi qualche istante</p>
          </div>
        </div>
      )}
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Riepilogo Iscrizione</h3>
        
        {/* DEBUG: Log completo dati riepilogo */}
        {(() => {
          const debugData = {
            // Dati form correnti
            formData: {
              email: formData.email,
              nome: formData.nome,
              cognome: formData.cognome,
              paymentPlan: formData.paymentPlan,
              courseId: formData.courseId,
              referralCode: formData.referralCode
            },
            // Documenti dal formData
            documentsInForm: {
              cartaIdentita: !!formData.cartaIdentita ? `${formData.cartaIdentita.name} (${(formData.cartaIdentita.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              certificatoTriennale: !!formData.certificatoTriennale ? `${formData.certificatoTriennale.name} (${(formData.certificatoTriennale.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              certificatoMagistrale: !!formData.certificatoMagistrale ? `${formData.certificatoMagistrale.name} (${(formData.certificatoMagistrale.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              pianoStudioTriennale: !!formData.pianoStudioTriennale ? `${formData.pianoStudioTriennale.name} (${(formData.pianoStudioTriennale.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              pianoStudioMagistrale: !!formData.pianoStudioMagistrale ? `${formData.pianoStudioMagistrale.name} (${(formData.pianoStudioMagistrale.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              certificatoMedico: !!formData.certificatoMedico ? `${formData.certificatoMedico.name} (${(formData.certificatoMedico.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              certificatoNascita: !!formData.certificatoNascita ? `${formData.certificatoNascita.name} (${(formData.certificatoNascita.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              diplomoLaurea: !!formData.diplomoLaurea ? `${formData.diplomoLaurea.name} (${(formData.diplomoLaurea.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato',
              pergamenaLaurea: !!formData.pergamenaLaurea ? `${formData.pergamenaLaurea.name} (${(formData.pergamenaLaurea.size / 1024 / 1024).toFixed(2)} MB)` : 'Non caricato'
            },
            // Documenti temporanei
            tempDocuments: (() => {
              try {
                const tempDocs = localStorage.getItem('tempDocuments');
                const docs = tempDocs ? JSON.parse(tempDocs) : [];
                console.log('📄 Riepilogo documenti temporanei:', docs.map((d: any) => ({ type: d.type, filename: d.originalFileName })));
                return docs;
              } catch (e) { 
                console.error('❌ Error loading temp documents for summary:', e);
                return []; 
              }
            })(),
            // User profile caricato
            userProfile: userProfile ? {
              hasProfile: !!userProfile,
              email: userProfile?.email || 'Non disponibile'
            } : 'Nessun profilo caricato',
            // Offer info
            offerInfo: offerInfo ? {
              name: offerInfo.name,
              id: offerInfo.id,
              offerType: offerInfo.offerType,
              totalAmount: offerInfo.totalAmount
            } : 'Nessuna offerta caricata'
          };

          console.log('🔍 Riepilogo completo:', debugData);
          return null;
        })()}
        
        {/* Dynamic intro based on course template */}
        {offerInfo?.course?.templateType === 'CERTIFICATION' ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Riepilogo Iscrizione</h4>
                <p className="text-blue-800 text-sm">
                  Stai completando l'iscrizione a "{offerInfo.name}". 
                  Verifica i dati inseriti prima di procedere.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Riepilogo Iscrizione</h4>
                <p className="text-blue-800 text-sm">
                  Stai completando l'iscrizione a "{offerInfo?.name || 'TFA Romania'}". 
                  Verifica i tuoi dati prima di procedere.
                </p>
              </div>
            </div>  
          </div>
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
              <p className="text-gray-900">{getCompleteData('nome')} {getCompleteData('cognome')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Email:</span>
              <p className="text-gray-900">{getCompleteData('email')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Data di Nascita:</span>
              <p className="text-gray-900">{getCompleteData('dataNascita')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Codice Fiscale:</span>
              <p className="text-gray-900">{getCompleteData('codiceFiscale')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Telefono:</span>
              <p className="text-gray-900">{getCompleteData('telefono')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Luogo di Nascita:</span>
              <p className="text-gray-900">{getCompleteData('luogoNascita') || 'Non specificato'}</p>
            </div>
            
            {/* Show parent names only for TFA template */}
            {offerInfo?.course?.templateType !== 'CERTIFICATION' && (getCompleteData('nomePadre') || getCompleteData('nomeMadre')) && (
              <>
                {getCompleteData('nomePadre') && (
                  <div>
                    <span className="font-medium text-gray-500">Nome Padre:</span>
                    <p className="text-gray-900">{getCompleteData('nomePadre')}</p>
                  </div>
                )}
                {getCompleteData('nomeMadre') && (
                  <div>
                    <span className="font-medium text-gray-500">Nome Madre:</span>
                    <p className="text-gray-900">{getCompleteData('nomeMadre')}</p>
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
                {getCompleteData('residenzaVia')}, {getCompleteData('residenzaCitta')} ({getCompleteData('residenzaProvincia')}) {getCompleteData('residenzaCap')}
              </p>
            </div>
            {(getCompleteData('hasDifferentDomicilio') || formData.hasDifferentDomicilio) && (
              <div>
                <span className="font-medium text-gray-500">Domicilio:</span>
                <p className="text-gray-900">
                  {getCompleteData('domicilioVia')}, {getCompleteData('domicilioCitta')} ({getCompleteData('domicilioProvincia')}) {getCompleteData('domicilioCap')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Riepilogo Istruzione - only for TFA template */}
        {offerInfo?.course?.templateType !== 'CERTIFICATION' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              Istruzione
            </h4>
            <div className="space-y-4">
              {/* Laurea Magistrale */}
              <div>
                <h5 className="text-sm font-semibold text-gray-800 mb-2">Laurea Magistrale/V.O.</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Tipo di Laurea:</span>
                    <p className="text-gray-900">{getCompleteData('tipoLaurea')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Corso di Laurea:</span>
                    <p className="text-gray-900">
                      {getCompleteData('laureaConseguita') === 'ALTRO' 
                        ? getCompleteData('laureaConseguitaCustom') 
                        : getCompleteData('laureaConseguita')
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Università:</span>
                    <p className="text-gray-900">{getCompleteData('laureaUniversita')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Data Conseguimento:</span>
                    <p className="text-gray-900">{getCompleteData('laureaData')}</p>
                  </div>
                </div>
              </div>

              {/* Laurea Triennale - mostrata solo se presente */}
              {getCompleteData('tipoLaurea') === 'Magistrale' && getCompleteData('laureaConseguitaTriennale') && (
                <div className="border-t pt-4">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">Laurea Triennale Precedente</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Corso di Laurea:</span>
                      <p className="text-gray-900">{getCompleteData('laureaConseguitaTriennale')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Università:</span>
                      <p className="text-gray-900">{getCompleteData('laureaUniversitaTriennale')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Data Conseguimento:</span>
                      <p className="text-gray-900">{getCompleteData('laureaDataTriennale')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Diploma Superiori - mostra se ci sono dati diploma */}
              {(getCompleteData('diplomaData') || getCompleteData('diplomaCitta') || getCompleteData('diplomaIstituto')) && (
                <div className="border-t pt-4">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">Diploma di Scuola Superiore</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {getCompleteData('diplomaData') && (
                      <div>
                        <span className="font-medium text-gray-500">Data Conseguimento:</span>
                        <p className="text-gray-900">{getCompleteData('diplomaData')}</p>
                      </div>
                    )}
                    {getCompleteData('diplomaIstituto') && (
                      <div>
                        <span className="font-medium text-gray-500">Istituto:</span>
                        <p className="text-gray-900">{getCompleteData('diplomaIstituto')}</p>
                      </div>
                    )}
                    {getCompleteData('diplomaCitta') && (
                      <div>
                        <span className="font-medium text-gray-500">Città:</span>
                        <p className="text-gray-900">{getCompleteData('diplomaCitta')}</p>
                      </div>
                    )}
                    {getCompleteData('diplomaProvincia') && (
                      <div>
                        <span className="font-medium text-gray-500">Provincia:</span>
                        <p className="text-gray-900">{getCompleteData('diplomaProvincia')}</p>
                      </div>
                    )}
                    {getCompleteData('diplomaVoto') && (
                      <div>
                        <span className="font-medium text-gray-500">Voto:</span>
                        <p className="text-gray-900">{getCompleteData('diplomaVoto')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                <p className="text-gray-900">{getCompleteData('tipoProfessione')}</p>
              </div>
              {getCompleteData('tipoProfessione') === 'Insegnante' && getCompleteData('scuolaDenominazione') && (
                <div>
                  <span className="font-medium text-gray-500">Scuola:</span>
                  <p className="text-gray-900">
                    {getCompleteData('scuolaDenominazione')}, {getCompleteData('scuolaCitta')} ({getCompleteData('scuolaProvincia')})
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
              <span className={`${formData.cartaIdentita || hasDocument('cartaIdentita') ? 'text-green-600' : 'text-gray-400'}`}>
                {formatFileInfo(formData.cartaIdentita, 'cartaIdentita')}
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
                      <span className={`${formData.certificatoTriennale || hasDocument('certificatoTriennale') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoTriennale, 'certificatoTriennale')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Magistrale:</span>
                      <span className={`${formData.certificatoMagistrale || hasDocument('certificatoMagistrale') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoMagistrale, 'certificatoMagistrale')}
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
                      <span className={`${formData.pianoStudioTriennale || hasDocument('pianoStudioTriennale') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pianoStudioTriennale, 'pianoStudioTriennale')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Magistrale/V.O.:</span>
                      <span className={`${formData.pianoStudioMagistrale || hasDocument('pianoStudioMagistrale') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pianoStudioMagistrale, 'pianoStudioMagistrale')}
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
                      <span className={`${formData.certificatoMedico || hasDocument('certificatoMedico') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoMedico, 'certificatoMedico')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Certificato di Nascita:</span>
                      <span className={`${formData.certificatoNascita || hasDocument('certificatoNascita') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.certificatoNascita, 'certificatoNascita')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Diploma:</span>
                      <span className={`${formData.diplomoLaurea || hasDocument('diplomoLaurea') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.diplomoLaurea, 'diplomoLaurea')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-500">Pergamena:</span>
                      <span className={`${formData.pergamenaLaurea || hasDocument('pergamenaLaurea') ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatFileInfo(formData.pergamenaLaurea, 'pergamenaLaurea')}
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
                    <span className="font-medium text-gray-500">Tessera Sanitaria:</span>
                    <span className={`${formData.certificatoMedico || hasDocument('certificatoMedico') ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatFileInfo(formData.certificatoMedico, 'certificatoMedico')}
                    </span>
                  </div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  ℹ️ Per le certificazioni sono richiesti solo carta d'identità e tessera sanitaria. Altri documenti possono essere caricati successivamente se necessario.
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
          {offerInfo && (() => {
            // Calculate payment info to get the discounted amounts
            const calculatePaymentInfo = () => {
              const baseAmount = Number(offerInfo.totalAmount);
              let finalAmount = baseAmount;
              let installments = 1;
              let downPayment = 0;
              let installmentAmount = baseAmount;

              // Per TFA Romania: acconto fisso di 1500€
              const isTfaRomania = offerInfo.course?.templateType === 'TFA';
              
              if (isTfaRomania) {
                downPayment = 1500;
              }

              // Apply coupon discount if available
              if (couponValidation?.isValid && couponValidation.discount) {
                const discount = couponValidation.discount;
                if (discount.type === 'PERCENTAGE') {
                  finalAmount = baseAmount * (1 - discount.amount / 100);
                } else if (discount.type === 'FIXED') {
                  finalAmount = Math.max(0, baseAmount - discount.amount);
                }
              }

              // Handle different payment plans
              if (formData.paymentPlan === 'single') {
                installments = 1;
              } else if (formData.paymentPlan === 'biannual') {
                installments = 2;
              } else if (formData.paymentPlan === 'quarterly') {
                installments = 4;
              } else if (formData.paymentPlan === 'monthly') {
                installments = 12;
              } else if (formData.paymentPlan === 'certification-plan') {
                installments = offerInfo.installments;
              } else {
                // Default to offer installments if no specific plan is selected
                installments = offerInfo.installments;
              }

              // Calcola l'importo delle rate usando finalAmount (con sconto applicato)
              if (installments > 1 && downPayment > 0) {
                // Per TFA: (totale scontato - acconto fisso) / numero rate
                const remainingAmount = finalAmount - downPayment;
                installmentAmount = remainingAmount / installments;
              } else if (installments > 1) {
                // Per altri corsi: totale scontato / numero rate
                installmentAmount = finalAmount / installments;
              } else {
                // Pagamento unico
                installmentAmount = finalAmount;
              }

              return {
                originalAmount: baseAmount,
                finalAmount: finalAmount,
                installments: installments,
                downPayment: downPayment,
                installmentAmount: Math.round(installmentAmount * 100) / 100
              };
            };
            
            const paymentInfo = calculatePaymentInfo();
            
            return (
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
                    <h5 className="text-sm font-semibold text-blue-900">{offerInfo.course.name}</h5>
                    <p className="text-xs text-blue-700 mt-1">{offerInfo.name}</p>
                    
                    {/* Show discount notice if applicable */}
                    {paymentInfo.originalAmount !== paymentInfo.finalAmount && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                        <span className="text-green-700 font-medium">
                          🎉 Sconto applicato: €{(paymentInfo.originalAmount - paymentInfo.finalAmount).toFixed(2)}
                        </span>
                        <div className="text-green-600 mt-1">
                          Da €{paymentInfo.originalAmount.toFixed(2)} a €{paymentInfo.finalAmount.toFixed(2)}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-2 text-xs">
                      <span className="text-blue-600">
                        <strong>Totale: €{paymentInfo.finalAmount.toFixed(2)}</strong>
                        {paymentInfo.originalAmount !== paymentInfo.finalAmount && (
                          <span className="line-through text-gray-400 ml-2">€{paymentInfo.originalAmount.toFixed(2)}</span>
                        )}
                      </span>
                      <span className="text-blue-600">
                        {offerInfo.offerType === 'TFA_ROMANIA' && paymentInfo.finalAmount > 1500 && paymentInfo.installments > 1 ? (
                          <>Acconto: €1.500 + {paymentInfo.installments} rate da €{paymentInfo.installmentAmount.toFixed(2)}</>
                        ) : (
                          <>{paymentInfo.installments} rate da €{paymentInfo.installmentAmount.toFixed(2)}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">
                {offerInfo?.offerType === 'CERTIFICATION' ? 'Certificazione:' : 'Corso:'}
              </span>
              <p className="text-gray-900 font-semibold">
                {offerInfo ? offerInfo.course.name : (formData.courseId || 'Non selezionato')}
              </p>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Nome Offerta:</span>
              <p className="text-gray-900">
                {offerInfo ? offerInfo.name : 'Non selezionato'}
              </p>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Piano di Pagamento:</span>
              <p className="text-gray-900">
                {formData.paymentPlan || 'Piano predefinito partner'}
              </p>
            </div>
          </div>

          {/* Show partner info if available */}
          {formData.referralCode && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Codice Referral Partner:</span>
                <p className="text-green-600 font-medium">{formData.referralCode}</p>
              </div>
            </div>
          )}
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
                {showLoginPrompt && (
                  <div className="mt-3 space-y-2">
                    <p className="text-red-700 text-xs font-medium">
                      Hai già un account? Effettua il login per iscriverti a nuovi corsi.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        // Save the current referral code to use after login
                        const currentUrl = window.location.pathname;
                        const referralCode = formData.referralCode;
                        if (referralCode) {
                          sessionStorage.setItem('pendingEnrollment', JSON.stringify({
                            referralCode: referralCode,
                            courseId: formData.courseId,
                            returnUrl: currentUrl
                          }));
                        }
                        window.location.href = '/login';
                      }}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
                    >
                      Vai al Login per Iscriverti
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