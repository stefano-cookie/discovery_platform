import React, { useEffect, useState, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { OfferInfo } from '../../../types/offers';

// Schema per questo step
const enrollmentSchema = z.object({
  courseId: z.string().min(1, 'Corso richiesto'),
  paymentPlan: z.string().min(1, 'Piano di pagamento richiesto'),
});

type EnrollmentForm = z.infer<typeof enrollmentSchema>;

interface EnrollmentStepProps {
  data: Partial<EnrollmentForm>;
  formData?: any; // Per accedere al coupon applicato
  onNext: (data: EnrollmentForm) => void;
  onChange?: (data: Partial<EnrollmentForm>) => void;
  offerInfo?: OfferInfo | null;
}

interface Course {
  id: string;
  name: string;
  description: string;
  totalAmount: number;
  isActive: boolean;
}

interface PaymentPlan {
  id: string;
  name: string;
  description: string;
  installments: number;
  frequency: string;
  totalAmount: number;
  monthlyAmount: number;
  isRecommended?: boolean;
  useCustomSchedule?: boolean;
}

const EnrollmentStep: React.FC<EnrollmentStepProps> = ({ data, formData, onNext, onChange, offerInfo }) => {
  console.log('EnrollmentStep rendered with:', { data, formData, offerInfo });
  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm<EnrollmentForm>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: data,
    mode: 'onChange',
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Watch selected values
  const selectedCourse = useWatch({ control, name: 'courseId' });
  const selectedPaymentPlan = useWatch({ control, name: 'paymentPlan' });

  // Calcola sconto da coupon applicato - CORRETTO per TFA Romania
  const calculateCouponDiscount = useCallback((baseAmount: number, isTfaRomania: boolean = false) => {
    const couponCode = formData?.couponCode;
    const couponValidation = formData?.couponValidation;
    
    if (!couponCode || !couponValidation?.isValid || !couponValidation.discount) {
      return { 
        discountAmount: 0, 
        finalAmount: baseAmount,
        imponibileAmount: isTfaRomania ? baseAmount - 1500 : baseAmount,
        accontoAmount: isTfaRomania ? 1500 : 0
      };
    }

    const discount = couponValidation.discount;
    let discountAmount = 0;
    let imponibileAmount = isTfaRomania ? baseAmount - 1500 : baseAmount; // Calcola imponibile (esclude acconto)
    let finalImponibileAmount = imponibileAmount;
    
    // Applica sconto SOLO sull'imponibile (non sull'acconto)
    if (discount.type === 'PERCENTAGE') {
      discountAmount = imponibileAmount * (discount.amount / 100);
      finalImponibileAmount = imponibileAmount - discountAmount;
    } else if (discount.type === 'FIXED') {
      discountAmount = Math.min(discount.amount, imponibileAmount);
      finalImponibileAmount = Math.max(0, imponibileAmount - discount.amount);
    }
    
    // Il totale finale include l'acconto (non scontato) + imponibile scontato
    const finalAmount = (isTfaRomania ? 1500 : 0) + finalImponibileAmount;
    
    return {
      discountAmount: discountAmount,
      finalAmount: finalAmount,
      imponibileAmount: finalImponibileAmount, // Imponibile dopo sconto (per calcolo rate)
      accontoAmount: isTfaRomania ? 1500 : 0,
      coupon: { 
        code: couponCode, 
        type: discount.type, 
        amount: discount.amount 
      }
    };
  }, [formData?.couponCode, formData?.couponValidation]);

  // Load courses from offer info
  useEffect(() => {
    console.log('Loading courses with offerInfo:', offerInfo);
    
    if (offerInfo) {
      // Use the specific course from the offer
      const courseFromOffer: Course = {
        id: offerInfo.course.id,
        name: offerInfo.name,
        description: offerInfo.course.description || '',
        totalAmount: Number(offerInfo.totalAmount),
        isActive: offerInfo.course.isActive,
      };

      console.log('Setting courses from offer:', [courseFromOffer]);
      setCourses([courseFromOffer]);
      setLoading(false);
    } else {
      // Fallback to mock data for legacy referral codes
      const mockCourses: Course[] = [
        {
          id: 'tfa-2024',
          name: 'TFA',
          description: 'TFA',
          totalAmount: 4500,
          isActive: true,
        },
      ];

      console.log('Setting mock courses:', mockCourses);
      setCourses(mockCourses);
      setLoading(false);
    }
  }, [offerInfo]);

  // Load payment plans based on offer type
  useEffect(() => {
    if (selectedCourse) {
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      if (selectedCourseData) {
        // IMPORTANTE: Ogni offerta DEVE avere un piano di pagamento definito dal partner
        // Non mostrare opzioni multiple - solo quella configurata nell'offerta
        if (offerInfo) {
          console.log('Loading payment plans for offer:', offerInfo);
          const totalAmount = Number(offerInfo.totalAmount);
          
          // Determina se è TFA Romania basandosi sul template del corso
          const isTfaRomaniaOffer = offerInfo?.course?.templateType === 'TFA';
          
          const customPlanWithCoupon = calculateCouponDiscount(totalAmount, isTfaRomaniaOffer);
          
          // Usa il customPaymentPlan se esiste, altrimenti usa installments dall'offerta
          let numberOfPayments: number;
          let useCustomSchedule = false;
          
          if (offerInfo.customPaymentPlan && offerInfo.customPaymentPlan.payments && offerInfo.customPaymentPlan.payments.length > 0) {
            // Usa il piano personalizzato
            numberOfPayments = offerInfo.customPaymentPlan.payments.length;
            useCustomSchedule = true;
          } else if (offerInfo.installments && offerInfo.installments > 0) {
            // Usa il numero di rate dall'offerta
            numberOfPayments = offerInfo.installments;
            useCustomSchedule = false;
          } else {
            // Default a pagamento unico se non specificato
            numberOfPayments = 1;
            useCustomSchedule = false;
          }
          
          // Calculate correct payment amount considering discounts
          let averagePaymentAmount;
          if (isTfaRomaniaOffer) {
            // For TFA Romania: use the discounted imponibile amount divided by number of payments
            averagePaymentAmount = customPlanWithCoupon.imponibileAmount / numberOfPayments;
          } else {
            // For other courses: use the full discounted amount divided by number of payments
            averagePaymentAmount = customPlanWithCoupon.finalAmount / numberOfPayments;
          }
          
          let planName, description;
          if (numberOfPayments === 1) {
            planName = 'Pagamento Unico';
            description = 'Pagamento unico come definito dal partner per questa offerta';
          } else {
            planName = `Pagamento in ${numberOfPayments} Rate`;
            if (isTfaRomaniaOffer) {
              description = `Piano a ${numberOfPayments} rate - Include acconto €1.500`;
            } else {
              description = `Piano a ${numberOfPayments} rate come definito dal partner`;
            }
          }
          
          const partnerPlan: PaymentPlan = {
            id: 'partner-plan',
            name: planName,
            description: description,
            installments: numberOfPayments,
            frequency: numberOfPayments === 1 ? 'Immediato' : 'Personalizzato',
            totalAmount: customPlanWithCoupon.finalAmount,
            monthlyAmount: averagePaymentAmount,
            isRecommended: true,
            useCustomSchedule // Flag per il calendario pagamenti
          };

          // SOLO il piano del partner - nessuna alternativa
          console.log('Setting payment plans:', [partnerPlan]);
          setPaymentPlans([partnerPlan]);
        } else {
          // ERRORE: Nessuna informazione offerta disponibile
          setPaymentPlans([]);
        }
      }
    } else {
      setPaymentPlans([]);
    }
  }, [selectedCourse, courses, formData?.couponCode, calculateCouponDiscount, offerInfo]);

  // Auto-select course and payment plan for specific offers
  useEffect(() => {
    if (offerInfo && courses.length > 0) {
      // Auto-select the course from the offer
      const courseId = offerInfo.course.id;
      if (!selectedCourse) {
        console.log('Auto-selecting course:', courseId);
        setValue('courseId', courseId, { shouldValidate: true, shouldTouch: true });
        // Trigger onChange manually to update parent
        if (onChange) {
          onChange({ courseId });
        }
      }
    }
  }, [offerInfo, courses, selectedCourse, setValue, onChange]);

  // Auto-select the ONLY payment plan available (partner-defined)
  useEffect(() => {
    console.log('Payment plan auto-selection check:', { 
      paymentPlansLength: paymentPlans.length, 
      selectedPaymentPlan,
      paymentPlans: paymentPlans.map(p => ({ id: p.id, name: p.name }))
    });
    
    if (paymentPlans.length > 0 && !selectedPaymentPlan) {
      // Auto-select the partner plan (only option available)
      const partnerPlan = paymentPlans.find(plan => plan.id === 'partner-plan');
      if (partnerPlan) {
        console.log('Auto-selecting payment plan:', partnerPlan.id);
        setValue('paymentPlan', partnerPlan.id, { shouldValidate: true, shouldTouch: true });
        // Trigger onChange manually to update parent
        if (onChange) {
          onChange({ paymentPlan: partnerPlan.id });
        }
      } else {
        console.log('Partner plan not found in payment plans:', paymentPlans);
      }
    } else if (paymentPlans.length === 0) {
      console.log('No payment plans available yet');
    } else {
      console.log('Payment plan already selected:', selectedPaymentPlan);
    }
  }, [paymentPlans, selectedPaymentPlan, setValue, onChange]);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
      console.log('Form values changed:', value);
      if (onChange) {
        onChange(value as Partial<EnrollmentForm>);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const onSubmit = (formData: EnrollmentForm) => {
    onNext(formData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };


  // Generate payment schedule for displaying to customer
  const generatePaymentSchedule = (plan: PaymentPlan) => {
    if (!plan || plan.installments <= 0) return [];

    const schedule: Array<{
      installmentNumber: number;
      dueDate: string;
      amount: number;
      isAcconto: boolean;
      isFirst: boolean;
    }> = [];
    
    // Check if this is a partner plan
    if (plan.id === 'partner-plan' && plan.useCustomSchedule && offerInfo?.customPaymentPlan) {
      // Use the actual custom payment plan from the partner but recalculate amounts with discounts
      const customPayments = offerInfo.customPaymentPlan.payments;
      
      // Determine if TFA Romania for correct calculation
      const isTfaRomania = offerInfo?.course?.templateType === 'TFA';
      
      // Calculate discount info - need to access formData for coupon information
      const totalAmount = Number(offerInfo.totalAmount);
      const couponCode = formData?.couponCode;
      const couponValidation = formData?.couponValidation;
      
      let discountInfo;
      if (!couponCode || !couponValidation?.isValid || !couponValidation.discount) {
        discountInfo = { 
          discountAmount: 0, 
          finalAmount: totalAmount,
          imponibileAmount: isTfaRomania ? totalAmount - 1500 : totalAmount,
          accontoAmount: isTfaRomania ? 1500 : 0
        };
      } else {
        const discount = couponValidation.discount;
        let discountAmount = 0;
        let imponibileAmount = isTfaRomania ? totalAmount - 1500 : totalAmount;
        let finalImponibileAmount = imponibileAmount;
        
        if (discount.type === 'PERCENTAGE') {
          discountAmount = imponibileAmount * (discount.amount / 100);
          finalImponibileAmount = imponibileAmount - discountAmount;
        } else if (discount.type === 'FIXED') {
          discountAmount = Math.min(discount.amount, imponibileAmount);
          finalImponibileAmount = Math.max(0, imponibileAmount - discount.amount);
        }
        
        const finalAmount = (isTfaRomania ? 1500 : 0) + finalImponibileAmount;
        
        discountInfo = {
          discountAmount: discountAmount,
          finalAmount: finalAmount,
          imponibileAmount: finalImponibileAmount,
          accontoAmount: isTfaRomania ? 1500 : 0
        };
      }
      
      // Calculate the corrected amount per installment
      let correctedAmountPerInstallment: number;
      if (isTfaRomania) {
        // For TFA Romania: divide discounted imponibile by number of payments
        correctedAmountPerInstallment = discountInfo.imponibileAmount / customPayments.length;
      } else {
        // For other courses: divide discounted total by number of payments
        correctedAmountPerInstallment = discountInfo.finalAmount / customPayments.length;
      }
      
      customPayments.forEach((payment, index) => {
        const dueDate = new Date(payment.dueDate);
        
        schedule.push({
          installmentNumber: index + 1,
          dueDate: dueDate.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          }),
          amount: correctedAmountPerInstallment, // Use corrected amount instead of original
          isAcconto: false,
          isFirst: index === 0
        });
      });
      
      return schedule;
    }

    // For non-custom plans, use the original logic
    const today = new Date();
    
    // Determina se è TFA Romania
    const isTfaRomania = offerInfo?.offerType === 'TFA_ROMANIA' || 
                         offerInfo?.name?.includes('TFA') ||
                         offerInfo?.name?.includes('Corso di Formazione Diamante');
    
    const downPayment = isTfaRomania ? 1500 : 0;
    
    // Per TFA Romania: aggiungi l'acconto come primo elemento
    if (isTfaRomania && plan.installments > 1) {
      const accontoDueDate = new Date(today);
      accontoDueDate.setDate(today.getDate() + 1); // Acconto immediato
      
      schedule.push({
        installmentNumber: 0,
        dueDate: accontoDueDate.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        amount: downPayment,
        isAcconto: true,
        isFirst: true
      });
    }
    
    // Determine frequency in months
    let frequencyMonths = 1;
    if (plan.frequency === 'Ogni 3 mesi') {
      frequencyMonths = 3;
    } else if (plan.frequency === 'Ogni 6 mesi') {
      frequencyMonths = 6;
    } else if (plan.frequency === 'Immediato') {
      frequencyMonths = 0;
    }

    for (let i = 0; i < plan.installments; i++) {
      const dueDate = new Date(today);
      if (frequencyMonths === 0) {
        // Immediate payment
        dueDate.setDate(today.getDate() + 1);
      } else {
        // Per TFA Romania: le rate iniziano dopo l'acconto
        const monthOffset = isTfaRomania && plan.installments > 1 ? (i + 1) * frequencyMonths : i * frequencyMonths;
        dueDate.setMonth(today.getMonth() + monthOffset);
      }
      
      // Tutte le rate sono uguali
      let amount = plan.monthlyAmount;
      
      schedule.push({
        installmentNumber: i + 1,
        dueDate: dueDate.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        amount: amount,
        isAcconto: false,
        isFirst: !isTfaRomania && i === 0
      });
    }

    return schedule;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center">
          <svg className="w-6 h-6 animate-spin text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Caricamento corsi disponibili...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Opzioni di Iscrizione</h3>
        {offerInfo?.customPaymentPlan && offerInfo.customPaymentPlan.payments && offerInfo.customPaymentPlan.payments.length > 0 ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Piano di Pagamento Definito</h4>
                <p className="text-blue-800 text-sm">
                  Il partner ha configurato per questa offerta "{offerInfo.name}" un piano di pagamento specifico con {offerInfo.customPaymentPlan.payments.length === 1 ? 'pagamento unico' : `${offerInfo.customPaymentPlan.payments.length} rate`}. Questo è l'unico piano disponibile per questa offerta.
                </p>
              </div>
            </div>
          </div>
        ) : offerInfo?.installments && offerInfo.installments > 0 ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Piano di Pagamento Standard</h4>
                <p className="text-blue-800 text-sm">
                  Il partner ha configurato per questa offerta "{offerInfo.name}" un piano di pagamento {offerInfo.installments === 1 ? 'con pagamento unico' : `in ${offerInfo.installments} rate`}.
                </p>
              </div>
            </div>
          </div>
        ) : offerInfo?.course?.templateType === 'CERTIFICATION' ? (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-blue-900 font-semibold mb-1">Iscrizione Certificazione</h4>
                <p className="text-blue-800 text-sm">
                  Stai procedendo con l'iscrizione alla certificazione "{offerInfo.name}". 
                  Il piano di pagamento è stato predefinito dal partner con condizioni speciali.
                </p>
              </div>
            </div>
          </div>
        ) : offerInfo ? (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-red-900 font-semibold mb-1">Piano di Pagamento Non Configurato</h4>
                <p className="text-red-800 text-sm">
                  Questa offerta non ha un piano di pagamento configurato dal partner. Ogni offerta deve avere un piano di pagamento specifico definito.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Coupon applicato - Indicazione */}
        {formData?.couponCode && (() => {
          const courseData = courses.find(c => c.id === selectedCourse);
          if (courseData) {
            // Determina se è TFA Romania per il calcolo corretto
            const isTfaRomania = offerInfo?.course?.templateType === 'TFA';
            
            const discount = calculateCouponDiscount(courseData.totalAmount, isTfaRomania);
            if (discount.discountAmount > 0) {
              return (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2.01 2.01 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <div>
                      <p className="text-green-800 font-medium">
                        Coupon "{formData.couponCode}" applicato con successo!
                      </p>
                      <p className="text-green-700 text-sm">
                        Risparmio: {formatCurrency(discount.discountAmount)} 
                        {discount.coupon?.type === 'PERCENTAGE' && ` (${discount.coupon.amount}%)`}
                        {isTfaRomania && (
                          <span className="block text-xs mt-1">
                            * Sconto applicato solo sull'imponibile (escluso acconto €1.500)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          }
          return null;
        })()}

        {/* Selezione Corso */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Corso di Interesse *
          </label>
          
          {courses.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                ⚠️ Nessun corso disponibile al momento. Contatta l'amministrazione per maggiori informazioni.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {courses.map((course) => (
                <label
                  key={course.id}
                  className={`
                    relative flex items-start p-4 border rounded-lg cursor-pointer transition-all duration-200
                    ${selectedCourse === course.id 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    {...register('courseId')}
                    value={course.id}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-md font-semibold text-gray-900">{course.name}</h4>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(course.totalAmount)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          
          {errors.courseId && (
            <p className="mt-2 text-sm text-red-600">{errors.courseId.message}</p>
          )}
        </div>

        {/* Error message when no payment plans are available */}
        {selectedCourse && paymentPlans.length === 0 && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-red-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-red-900 font-semibold mb-2">Piano di Pagamento Non Disponibile</h4>
                <p className="text-red-800 text-sm mb-3">
                  Non è stato possibile caricare il piano di pagamento per questa offerta. 
                  Questo potrebbe indicare un problema di configurazione.
                </p>
                <p className="text-red-700 text-sm">
                  <strong>Cosa fare:</strong><br/>
                  • Ricarica la pagina e riprova<br/>
                  • Contatta il tuo partner di riferimento se il problema persiste<br/>
                  • Oppure scegli un'offerta diversa
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Piani di Pagamento */}
        {selectedCourse && paymentPlans.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {offerInfo?.customPaymentPlan && offerInfo.customPaymentPlan.payments.length > 0
                ? (offerInfo.customPaymentPlan.payments.length === 1 
                    ? 'Pagamento Unico' 
                    : `Piano Personalizzato - ${offerInfo.customPaymentPlan.payments.length} Rate`)
                : offerInfo?.course?.templateType === 'CERTIFICATION'
                  ? 'Piano di Pagamento Predefinito'
                  : 'Piano di Pagamento *'
              }
            </label>
            
            <div className="space-y-3">
              {paymentPlans.map((plan) => (
                <div key={plan.id} className="space-y-4">
                  <label
                    className={`
                      relative flex items-start p-4 border rounded-lg cursor-pointer transition-all duration-200
                      ${selectedPaymentPlan === plan.id 
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200' 
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }
                      ${plan.isRecommended ? 'ring-2 ring-blue-300 border-blue-400' : ''}
                    `}
                  >
                    {plan.isRecommended && (
                      <div className="absolute -top-2 left-4">
                        <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
                          Consigliato
                        </span>
                      </div>
                    )}
                    
                    <input
                      type="radio"
                      {...register('paymentPlan')}
                      value={plan.id}
                      className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold text-gray-900">{plan.name}</h4>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(plan.monthlyAmount)}
                            {plan.installments > 1 && (
                              <span className="text-sm font-normal text-gray-500"> / rata</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            Totale: {formatCurrency(plan.totalAmount)}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                      
                      {plan.installments > 1 && (
                        <div className="text-xs text-gray-500 mt-2">
                          {plan.installments} rate • {plan.frequency}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Payment Schedule Table - shown when plan is selected - NON mostrare per piano personalizzato */}
                  {selectedPaymentPlan === plan.id && plan.installments > 1 && !plan.useCustomSchedule && (
                    <div className="ml-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        Calendario Pagamenti
                      </h5>
                      <div className="overflow-hidden border border-blue-300 rounded-lg">
                        <div className="overflow-x-auto">
                          <table className="min-w-full bg-white">
                            <thead className="bg-blue-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                  Rata
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                  Scadenza
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-blue-900 uppercase tracking-wider">
                                  Importo
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-200">
                              {generatePaymentSchedule(plan).map((payment, index) => (
                                <tr key={index} className={payment.isAcconto || payment.isFirst ? 'bg-green-50' : 'bg-white hover:bg-blue-50'}>
                                  <td className="px-3 py-2 text-sm">
                                    <div className="flex items-center">
                                      {(payment.isAcconto || payment.isFirst) && (
                                        <svg className="w-4 h-4 text-green-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      <span className={`font-medium ${
                                        payment.isAcconto || payment.isFirst ? 'text-green-700' : 'text-gray-900'
                                      }`}>
                                        {payment.isAcconto ? 'Acconto' : `${payment.installmentNumber}° rata`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-700">
                                    {payment.dueDate}
                                  </td>
                                  <td className="px-3 py-2 text-sm font-medium text-right">
                                    <span className={payment.isAcconto || payment.isFirst ? 'text-green-700' : 'text-gray-900'}>
                                      {formatCurrency(payment.amount)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Messaggio informativo per piani personalizzati */}
                  {selectedPaymentPlan === plan.id && plan.useCustomSchedule && (
                    <div className="ml-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-indigo-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <h5 className="text-sm font-semibold text-indigo-900 mb-1">Piano Personalizzato Attivo</h5>
                          <p className="text-indigo-800 text-sm">
                            Il calendario e le scadenze specifiche saranno visibili nella tua area riservata dopo il completamento dell'iscrizione. 
                            Il partner ha configurato un piano di pagamento personalizzato per le tue esigenze.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            
            {errors.paymentPlan && (
              <p className="mt-2 text-sm text-red-600">{errors.paymentPlan.message}</p>
            )}
          </div>
        )}

        {/* Info aggiuntive */}
        {selectedCourse && selectedPaymentPlan && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-green-800 text-sm font-medium mb-1">Selezione Confermata</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default EnrollmentStep;