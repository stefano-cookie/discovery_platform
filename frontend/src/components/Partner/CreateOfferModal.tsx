import React, { useState } from 'react';
import { Course, CreateOfferData } from '../../types/offers';
import { OfferService } from '../../services/offerService';

interface CreateOfferModalProps {
  courses: Course[];
  onSave: (data: CreateOfferData) => void;
  onClose: () => void;
}

const CreateOfferModal: React.FC<CreateOfferModalProps> = ({ courses, onSave, onClose }) => {
  const [formData, setFormData] = useState<CreateOfferData>({
    courseId: '',
    name: '',
    offerType: 'TFA_ROMANIA',
    totalAmount: 4000,
    installments: 1,
    installmentFrequency: 1,
  });

  const [customPayments, setCustomPayments] = useState<Array<{ amount: number; dueDate: string }>>([]);
  const [useCustomPlan, setUseCustomPlan] = useState(true);

  // Set appropriate course when courses are loaded or offer type changes
  React.useEffect(() => {
    if (courses.length > 0) {
      // Find appropriate course based on offer type
      const appropriateCourse = courses.find(course => {
        const isTfaCourse = course.name.includes('Formazione Diamante') || course.id === 'default-course';
        const isCertificationCourse = course.name.includes('Certificazioni') || course.id === 'certification-course';
        
        return (formData.offerType === 'TFA_ROMANIA' && isTfaCourse) || 
               (formData.offerType === 'CERTIFICATION' && isCertificationCourse);
      });
      
      if (appropriateCourse && (!formData.courseId || formData.courseId !== appropriateCourse.id)) {
        const baseAmount = formData.offerType === 'TFA_ROMANIA' ? 4000 : 1500;
        setFormData(prev => ({
          ...prev,
          courseId: appropriateCourse.id,
          totalAmount: baseAmount
        }));
      }
      
      // Initialize default payments
      if (customPayments.length === 0) {
        generateInstallmentPlan(3); // 3 rate di default
        setUseCustomPlan(true);
      }
    }
  }, [courses, formData.offerType, customPayments.length]);

  // Update custom payment amounts when total amount changes
  React.useEffect(() => {
    if (useCustomPlan && customPayments.length > 0 && formData.totalAmount > 0) {
      // Per TFA Romania: (totale - acconto 1500€) / numero rate
      // Per altri corsi: totale / numero rate
      const downPayment = formData.offerType === 'TFA_ROMANIA' ? 1500 : 0;
      const remainingAmount = formData.totalAmount - downPayment;
      const amountPerPayment = remainingAmount / customPayments.length;
      
      setCustomPayments(prevPayments => 
        prevPayments.map(payment => ({
          ...payment,
          amount: Number(amountPerPayment.toFixed(2))
        }))
      );
    }
  }, [formData.totalAmount, formData.offerType, useCustomPlan, customPayments.length]); // customPayments.length to avoid infinite loop but still track changes

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updatedData = {
      ...formData,
      [name]: name === 'totalAmount' || name === 'installments' || name === 'installmentFrequency' 
        ? Number(value) 
        : value
    };
    
    setFormData(updatedData);
    
    // Update preview if not using custom plan
    if (!useCustomPlan && updatedData.totalAmount > 0 && updatedData.installments > 0) {
      OfferService.generatePaymentPlan(
        updatedData.totalAmount,
        updatedData.installments
      );
    }
  };

  const handleOfferTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const offerType = e.target.value as 'TFA_ROMANIA' | 'CERTIFICATION';
    
    // Update offer type and reset course selection - amounts will be set by useEffect
    setFormData(prev => ({
      ...prev,
      offerType,
      courseId: '', // Reset course selection to trigger auto-selection
      name: prev.name || (offerType === 'CERTIFICATION' ? 'Certificazione Personalizzata' : 'TFA Romania Personalizzato')
    }));
    
    setUseCustomPlan(true);
  };


  const generateInstallmentPlan = (targetInstallments: number) => {
    const newPayments = [];
    
    // Per TFA Romania: (totale - acconto 1500€) / numero rate
    // Per altri corsi: totale / numero rate
    const downPayment = formData.offerType === 'TFA_ROMANIA' ? 1500 : 0;
    const remainingAmount = formData.totalAmount - downPayment;
    const amountPerInstallment = Number((remainingAmount / targetInstallments).toFixed(2));
    
    for (let i = 0; i < targetInstallments; i++) {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      dueDate.setDate(30);
      
      newPayments.push({
        amount: amountPerInstallment,
        dueDate: dueDate.toISOString().split('T')[0]
      });
    }
    
    setCustomPayments(newPayments);
    // Aggiorna anche il campo installments nel formData
    setFormData(prev => ({ ...prev, installments: newPayments.length }));
  };

  const addCustomPayment = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + customPayments.length + 1);
    nextMonth.setDate(30);
    
    const newPayments = [
      ...customPayments,
      {
        amount: 0,
        dueDate: nextMonth.toISOString().split('T')[0]
      }
    ];
    
    setCustomPayments(newPayments);
    // Aggiorna anche il campo installments nel formData
    setFormData(prev => ({ ...prev, installments: newPayments.length }));
  };

  const updateCustomPayment = (index: number, field: 'amount' | 'dueDate', value: string | number) => {
    const updated = [...customPayments];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? Number(value) : value
    };
    setCustomPayments(updated);
  };

  const removeCustomPayment = (index: number) => {
    const newPayments = customPayments.filter((_, i) => i !== index);
    setCustomPayments(newPayments);
    // Aggiorna anche il campo installments nel formData
    setFormData(prev => ({ ...prev, installments: newPayments.length }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: CreateOfferData = {
      ...formData,
      installments: customPayments.length, // Aggiorna con il numero effettivo di rate
      customPaymentPlan: useCustomPlan && customPayments.length > 0
        ? { payments: customPayments }
        : undefined
    };
    
    onSave(submitData);
  };

  const isFormValid = () => {
    const baseValid = formData.courseId && 
                     formData.name.trim() && 
                     formData.totalAmount > 0 && 
                     formData.installments > 0;
    
    if (useCustomPlan) {
      const totalCustomAmount = customPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return baseValid && customPayments.length > 0 && totalCustomAmount === formData.totalAmount;
    }
    
    return baseValid;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto m-4 shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">✨ Crea Nuova Offerta</h2>
              <p className="text-blue-100 mt-1">Configura la tua offerta personalizzata per i clienti</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Tipo Offerta - Prima sezione prominente */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Tipo di Offerta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.offerType === 'TFA_ROMANIA'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleOfferTypeChange({ target: { value: 'TFA_ROMANIA' } } as any)}
                >
                  <div className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="offerType"
                      value="TFA_ROMANIA"
                      checked={formData.offerType === 'TFA_ROMANIA'}
                      onChange={(e) => handleOfferTypeChange(e as any)}
                      className="mr-3"
                    />
                    <span className="font-medium text-purple-700">TFA Romania</span>
                  </div>
                  <p className="text-sm text-gray-600">Form completo con tutti i passaggi di registrazione</p>
                </div>
                
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.offerType === 'CERTIFICATION'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                  onClick={() => handleOfferTypeChange({ target: { value: 'CERTIFICATION' } } as any)}
                >
                  <div className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="offerType"
                      value="CERTIFICATION"
                      checked={formData.offerType === 'CERTIFICATION'}
                      onChange={(e) => handleOfferTypeChange(e as any)}
                      className="mr-3"
                    />
                    <span className="font-medium text-green-700">Certificazione</span>
                  </div>
                  <p className="text-sm text-gray-600">Form semplificato con meno documenti richiesti</p>
                </div>
              </div>
            </div>

            {/* Dettagli Offerta */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Configurazione Offerta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Seleziona il corso:
                  </label>
                  <div className="space-y-3">
                    {courses.map(course => {
                      // Mostra corsi appropriati in base al tipo di offerta
                      const isTfaCourse = course.name.includes('Formazione Diamante') || course.id === 'default-course';
                      const isCertificationCourse = course.name.includes('Certificazioni') || course.id === 'certification-course';
                      
                      // Per TFA Romania mostra solo corsi TFA, per Certificazioni solo certificazioni
                      const shouldShow = (formData.offerType === 'TFA_ROMANIA' && isTfaCourse) || 
                                        (formData.offerType === 'CERTIFICATION' && isCertificationCourse);
                      
                      if (!shouldShow) return null;
                      
                      const isSelected = formData.courseId === course.id;
                      const baseAmount = formData.offerType === 'TFA_ROMANIA' ? 4000 : 1000;
                      
                      return (
                        <div
                          key={course.id}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? formData.offerType === 'TFA_ROMANIA'
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            setFormData(prev => ({ 
                              ...prev, 
                              courseId: course.id,
                              totalAmount: baseAmount
                            }));
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <input
                                  type="radio"
                                  name="courseId"
                                  value={course.id}
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="mr-3"
                                />
                                <h4 className="font-medium text-gray-900">{course.name}</h4>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{course.description}</p>
                              <div className="text-sm">
                                <span className="font-medium">Importo base: </span>
                                <span className={`font-bold ${
                                  formData.offerType === 'TFA_ROMANIA' ? 'text-purple-600' : 'text-green-600'
                                }`}>
                                  €{baseAmount.toLocaleString()}
                                </span>
                                {formData.offerType === 'TFA_ROMANIA' && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    (include acconto €1.500)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {courses.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Nessun corso disponibile. Contatta l'amministratore.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Offerta *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="es. TFA Romania Promozionale"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Importo Totale (€) *
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.offerType === 'TFA_ROMANIA' ? 'Prezzo suggerito: €4.000' : 'Prezzo suggerito: €1.500'}
                  </p>
                </div>
              </div>
            </div>

            {/* Piano Pagamenti Personalizzato per entrambi i tipi */}
            <div className={`p-6 rounded-lg border ${
              formData.offerType === 'TFA_ROMANIA' 
                ? 'bg-purple-50 border-purple-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    Piano Pagamenti Personalizzato
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {formData.offerType === 'TFA_ROMANIA' 
                      ? 'Configura le rate e scadenze per TFA Romania' 
                      : 'Per le certificazioni è richiesto un piano di pagamento personalizzato'
                    }
                  </p>
                </div>
              </div>

              {/* Configurazione rapida numero rate */}
              <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800 mb-3">⚡ Configurazione Rapida</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numero Rate Desiderato
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={customPayments.length || 1}
                      onChange={(e) => {
                        const targetInstallments = parseInt(e.target.value) || 1;
                        generateInstallmentPlan(targetInstallments);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="es. 3"
                    />
                    <p className="text-xs text-gray-500 mt-1">Da 1 a 24 rate</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Importo per Rata
                    </label>
                    <div className="text-lg font-semibold text-gray-800">
                      €{customPayments.length > 0 ? 
                        (() => {
                          const downPayment = formData.offerType === 'TFA_ROMANIA' ? 1500 : 0;
                          const remainingAmount = formData.totalAmount - downPayment;
                          return (remainingAmount / customPayments.length).toFixed(2);
                        })() : 
                        formData.totalAmount.toFixed(2)
                      }
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.offerType === 'TFA_ROMANIA' ? 
                        `+ acconto €1.500 al momento dell'iscrizione` : 
                        'Importo distribuito equamente'
                      }
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={addCustomPayment}
                      className={`w-full px-4 py-2 rounded-lg text-white flex items-center justify-center space-x-2 shadow-md ${
                        formData.offerType === 'TFA_ROMANIA'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      <span>Aggiungi Rata Manuale</span>
                    </button>
                  </div>
                </div>
              </div>

              {customPayments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-6xl mb-2 text-gray-300">💳</div>
                  <p>Nessuna rata configurata</p>
                  <p className="text-sm">Clicca "Aggiungi Rata" per iniziare</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customPayments.map((payment, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Importo (€)</label>
                          <input
                            type="number"
                            value={payment.amount}
                            onChange={(e) => updateCustomPayment(index, 'amount', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                          <input
                            type="date"
                            value={payment.dueDate}
                            onChange={(e) => updateCustomPayment(index, 'dueDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCustomPayment(index)}
                          className="flex-shrink-0 w-10 h-10 bg-red-100 text-red-600 rounded-full hover:bg-red-200 flex items-center justify-center"
                          title="Rimuovi rata"
                        >
                          ✕
                        </button>
                    </div>
                  ))}
                </div>
              )}

                {customPayments.length > 0 && (
                  <div className="mt-6 p-4 bg-white border-2 border-dashed border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-bold">Σ</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            Totale rate: €{customPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('it-IT')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {customPayments.length} rata/e configurata/e
                          </p>
                        </div>
                      </div>
                      {customPayments.reduce((sum, p) => sum + p.amount, 0) !== formData.totalAmount && (
                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                          Non corrisponde all'importo totale!
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>


            <div className="bg-gray-50 p-6 rounded-lg flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <p>L'offerta sarà disponibile tramite link referral univoco</p>
                <p className="text-xs mt-1">I clienti potranno registrarsi utilizzando il tuo link personalizzato</p>
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium shadow-md"
                >
                  {isFormValid() ? 'Crea Offerta' : 'Compila tutti i campi'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateOfferModal;