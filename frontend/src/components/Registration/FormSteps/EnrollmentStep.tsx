import React, { useEffect, useState, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { OfferInfo } from '../../../types/offers';

// Schema per questo step
const enrollmentSchema = z.object({
  courseId: z.string().min(1, 'Corso richiesto'),
  paymentPlan: z.string().min(1, 'Piano di pagamento richiesto'),
  customInstallments: z.number().optional(),
}).refine((data) => {
  if (data.paymentPlan === 'custom') {
    return data.customInstallments && data.customInstallments >= 1 && data.customInstallments <= 24;
  }
  return true;
}, {
  message: 'Per il piano personalizzato inserisci un numero di rate tra 1 e 24',
  path: ['customInstallments'],
});

type EnrollmentForm = z.infer<typeof enrollmentSchema>;

interface EnrollmentStepProps {
  data: Partial<EnrollmentForm>;
  partnerId?: string;
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
}

const EnrollmentStep: React.FC<EnrollmentStepProps> = ({ data, partnerId, formData, onNext, onChange, offerInfo }) => {
  const {
    register,
    handleSubmit,
    watch,
    control,
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

  // Calcola sconto da coupon applicato
  // NOTA: Il calcolo finale del coupon viene fatto nel backend durante la registrazione
  // Qui mostriamo solo un'indicazione visiva se è presente un coupon
  const calculateCouponDiscount = useCallback((baseAmount: number) => {
    const couponCode = formData?.couponCode;
    if (!couponCode) return { discountAmount: 0, finalAmount: baseAmount };

    // Per ora mostriamo il prezzo originale - il calcolo esatto sarà fatto nel backend
    // In futuro si potrebbe chiamare l'API per ottenere l'anteprima dello sconto
    return {
      discountAmount: 0, // Will be calculated by backend
      finalAmount: baseAmount,
      coupon: { code: couponCode, type: 'UNKNOWN', amount: 0 }
    };
  }, [formData?.couponCode]);

  // Load courses from offer info
  useEffect(() => {
    if (offerInfo) {
      // Use the specific course from the offer
      const courseFromOffer: Course = {
        id: offerInfo.course.id,
        name: offerInfo.course.name,
        description: offerInfo.course.description || '',
        totalAmount: Number(offerInfo.totalAmount),
        isActive: offerInfo.course.isActive,
      };

      setCourses([courseFromOffer]);
      setLoading(false);
    } else {
      // Fallback to mock data for legacy referral codes
      const mockCourses: Course[] = [
        {
          id: 'tfa-2024',
          name: 'TFA Sostegno 2024',
          description: 'Tirocinio Formativo Attivo per il Sostegno Didattico',
          totalAmount: 4500,
          isActive: true,
        },
      ];

      setCourses(mockCourses);
      setLoading(false);
    }
  }, [offerInfo]);

  // Load payment plans based on offer type
  useEffect(() => {
    if (selectedCourse) {
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
      if (selectedCourseData) {
        if (offerInfo?.offerType === 'CERTIFICATION' && offerInfo.customPaymentPlan) {
          // For certifications: use the fixed payment plan from the partner
          const totalAmount = Number(offerInfo.totalAmount);
          const customPlanWithCoupon = calculateCouponDiscount(totalAmount);
          
          const certificationPlan: PaymentPlan = {
            id: 'certification-plan',
            name: `Piano Certificazione - ${offerInfo.installments} Rate`,
            description: `Piano di pagamento personalizzato dal partner`,
            installments: offerInfo.installments,
            frequency: offerInfo.installmentFrequency === 1 ? 'Mensile' : `Ogni ${offerInfo.installmentFrequency} mesi`,
            totalAmount: customPlanWithCoupon.finalAmount,
            monthlyAmount: customPlanWithCoupon.finalAmount / offerInfo.installments,
            isRecommended: true,
          };

          setPaymentPlans([certificationPlan]);
        } else {
          const baseAmount = selectedCourseData.totalAmount;

          const baseWithCoupon = calculateCouponDiscount(baseAmount);

          const tfaPaymentPlans: PaymentPlan[] = [
            {
              id: 'single',
              name: 'Pagamento Unico',
              description: 'Paga tutto subito',
              installments: 1,
              frequency: 'Immediato',
              totalAmount: baseWithCoupon.finalAmount,
              monthlyAmount: baseWithCoupon.finalAmount,
              isRecommended: false,
            },
            {
              id: 'quarterly',
              name: '4 Rate',
              description: 'Pagamento trimestrale',
              installments: 4,
              frequency: 'Ogni 3 mesi',
              totalAmount: baseWithCoupon.finalAmount,
              monthlyAmount: baseWithCoupon.finalAmount / 4,
              isRecommended: true,
            },
            {
              id: 'monthly',
              name: '12 Rate',
              description: 'Pagamento mensile',
              installments: 12,
              frequency: 'Mensile',
              totalAmount: baseWithCoupon.finalAmount,
              monthlyAmount: baseWithCoupon.finalAmount / 12,
              isRecommended: false,
            },
            {
              id: 'custom',
              name: 'Piano Personalizzato',
              description: 'Scegli il numero di rate che preferisci (1-24)',
              installments: 0,
              frequency: 'Personalizzabile',
              totalAmount: baseWithCoupon.finalAmount,
              monthlyAmount: 0,
              isRecommended: false,
            },
          ];

          setPaymentPlans(tfaPaymentPlans);
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
        // Set the course ID
        const event = { target: { value: courseId } };
        register('courseId').onChange(event);
      }
    }
  }, [offerInfo, courses, selectedCourse, register]);

  // Auto-select payment plan for certifications
  useEffect(() => {
    if (offerInfo?.offerType === 'CERTIFICATION' && paymentPlans.length > 0 && !selectedPaymentPlan) {
      // Auto-select the certification plan
      const certificationPlan = paymentPlans.find(plan => plan.id === 'certification-plan');
      if (certificationPlan) {
        const event = { target: { value: certificationPlan.id } };
        register('paymentPlan').onChange(event);
      }
    }
  }, [offerInfo, paymentPlans, selectedPaymentPlan, register]);

  // Watch all form values and update parent in real-time
  useEffect(() => {
    const subscription = watch((value) => {
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

  const calculateCustomPlan = (installments: number) => {
    const selectedCourseData = courses.find(c => c.id === selectedCourse);
    if (!selectedCourseData || installments < 1) return null;

    // Applica coupon al prezzo base
    const withCoupon = calculateCouponDiscount(selectedCourseData.totalAmount);
    const monthlyAmount = withCoupon.finalAmount / installments;
    
    return {
      totalAmount: withCoupon.finalAmount,
      originalAmount: selectedCourseData.totalAmount,
      discountAmount: withCoupon.discountAmount,
      monthlyAmount,
      installments,
      coupon: withCoupon.coupon,
    };
  };

  // Generate payment schedule for displaying to customer
  const generatePaymentSchedule = (plan: PaymentPlan) => {
    if (!plan || plan.installments <= 0) return [];

    const schedule = [];
    const today = new Date();
    const monthlyAmount = plan.monthlyAmount;
    
    // Determine frequency in months
    let frequencyMonths = 1;
    if (plan.frequency === 'Ogni 3 mesi') {
      frequencyMonths = 3;
    } else if (plan.frequency === 'Immediato') {
      frequencyMonths = 0;
    }

    for (let i = 0; i < plan.installments; i++) {
      const dueDate = new Date(today);
      if (frequencyMonths === 0) {
        // Immediate payment
        dueDate.setDate(today.getDate() + 1);
      } else {
        dueDate.setMonth(today.getMonth() + (i * frequencyMonths));
      }
      
      schedule.push({
        installmentNumber: i + 1,
        dueDate: dueDate.toLocaleDateString('it-IT', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }),
        amount: monthlyAmount,
        isFirst: i === 0
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
        {offerInfo?.offerType === 'CERTIFICATION' ? (
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
        ) : (
          <p className="text-gray-600 mb-6">
            Seleziona il corso a cui vuoi iscriverti e scegli il piano di pagamento più adatto alle tue esigenze.
          </p>
        )}

        {/* Coupon applicato - Indicazione */}
        {formData?.couponCode && (() => {
          const courseData = courses.find(c => c.id === selectedCourse);
          if (courseData) {
            const discount = calculateCouponDiscount(courseData.totalAmount);
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

        {/* Piani di Pagamento */}
        {selectedCourse && paymentPlans.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {offerInfo?.offerType === 'CERTIFICATION' ? 'Piano di Pagamento Predefinito' : 'Piano di Pagamento *'}
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
                            {plan.id === 'custom' 
                              ? 'Personalizzabile' 
                              : formatCurrency(plan.monthlyAmount)
                            }
                            {plan.id !== 'custom' && plan.installments > 1 && (
                              <span className="text-sm font-normal text-gray-500"> / rata</span>
                            )}
                          </div>
                          {plan.id !== 'custom' && (
                            <div className="text-sm text-gray-600">
                              Totale: {formatCurrency(plan.totalAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                      
                      {plan.id !== 'custom' && plan.installments > 1 && (
                        <div className="text-xs text-gray-500 mt-2">
                          {plan.installments} rate • {plan.frequency}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Payment Schedule Table - shown when plan is selected */}
                  {selectedPaymentPlan === plan.id && plan.id !== 'custom' && plan.installments > 1 && (
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
                                <tr key={index} className={payment.isFirst ? 'bg-green-50' : 'bg-white hover:bg-blue-50'}>
                                  <td className="px-3 py-2 text-sm">
                                    <div className="flex items-center">
                                      {payment.isFirst && (
                                        <svg className="w-4 h-4 text-green-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      <span className={`font-medium ${
                                        payment.isFirst ? 'text-green-700' : 'text-gray-900'
                                      }`}>
                                        {payment.installmentNumber}° rata
                                      </span>
                                      {payment.isFirst && (
                                        <span className="ml-2 text-xs text-green-600 font-medium">
                                          (Acconto)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-700">
                                    {payment.dueDate}
                                  </td>
                                  <td className="px-3 py-2 text-sm font-medium text-right">
                                    <span className={payment.isFirst ? 'text-green-700' : 'text-gray-900'}>
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
                </div>
              ))}
            </div>

            {/* Piano Personalizzato */}
            {selectedPaymentPlan === 'custom' && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero di Rate Desiderate *
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    {...register('customInstallments', { valueAsNumber: true })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12"
                  />
                  <span className="text-sm text-gray-600">rate (da 1 a 24)</span>
                </div>
                
{watch('customInstallments') && (() => {
                  const customPlan = calculateCustomPlan(watch('customInstallments') || 0);
                  if (!customPlan) {
                    return (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <div className="text-red-600 text-sm">
                          Inserisci un numero valido di rate (1-24)
                        </div>
                      </div>
                    );
                  }

                  // Create a temporary plan for schedule generation
                  const tempPlan: PaymentPlan = {
                    id: 'temp-custom',
                    name: `Piano Personalizzato - ${watch('customInstallments')} Rate`,
                    description: 'Piano personalizzato',
                    installments: watch('customInstallments') || 0,
                    frequency: 'Mensile',
                    totalAmount: customPlan.totalAmount,
                    monthlyAmount: customPlan.monthlyAmount
                  };

                  return (
                    <>
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="text-sm space-y-2">
                          <div className="font-medium text-blue-800">
                            Piano Personalizzato: {watch('customInstallments')} rate
                          </div>
                          {customPlan.discountAmount > 0 && (
                            <div className="bg-green-100 border border-green-200 rounded p-2">
                              <div className="text-green-800 text-xs font-medium">
                                💰 Coupon applicato!
                              </div>
                              <div className="text-green-700 text-xs">
                                Prezzo originale: {formatCurrency(customPlan.originalAmount)}
                              </div>
                              <div className="text-green-700 text-xs">
                                Sconto: -{formatCurrency(customPlan.discountAmount)}
                              </div>
                            </div>
                          )}
                          <div className="text-blue-700 mt-1">
                            <strong>{formatCurrency(customPlan.monthlyAmount)}</strong> per rata
                          </div>
                          <div className="text-blue-600">
                            Totale: {formatCurrency(customPlan.totalAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Custom Plan Payment Schedule */}
                      {customPlan.installments > 1 && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                            <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            Calendario Pagamenti Personalizzato
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
                                  {generatePaymentSchedule(tempPlan).map((payment, index) => (
                                    <tr key={index} className={payment.isFirst ? 'bg-green-50' : 'bg-white hover:bg-blue-50'}>
                                      <td className="px-3 py-2 text-sm">
                                        <div className="flex items-center">
                                          {payment.isFirst && (
                                            <svg className="w-4 h-4 text-green-600 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                          )}
                                          <span className={`font-medium ${
                                            payment.isFirst ? 'text-green-700' : 'text-gray-900'
                                          }`}>
                                            {payment.installmentNumber}° rata
                                          </span>
                                          {payment.isFirst && (
                                            <span className="ml-2 text-xs text-green-600 font-medium">
                                              (Acconto)
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-700">
                                        {payment.dueDate}
                                      </td>
                                      <td className="px-3 py-2 text-sm font-medium text-right">
                                        <span className={payment.isFirst ? 'text-green-700' : 'text-gray-900'}>
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
                    </>
                  );
                })()}
                
                {errors.customInstallments && (
                  <p className="mt-2 text-sm text-red-600">{errors.customInstallments.message}</p>
                )}
              </div>
            )}
            
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
                <ul className="text-green-700 text-sm space-y-1">
                  <li>• Le rate saranno addebitate automaticamente</li>
                  <li>• Riceverai una email di conferma con i dettagli</li>
                  <li>• Puoi modificare il piano di pagamento fino a 48h prima dell'inizio corso</li>
                  <li>• Tutti i prezzi sono IVA inclusa</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
};

export default EnrollmentStep;