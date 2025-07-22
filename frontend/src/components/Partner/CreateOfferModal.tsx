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
    totalAmount: 0,
    installments: 1,
    installmentFrequency: 1,
  });

  const [customPayments, setCustomPayments] = useState<Array<{ amount: number; dueDate: string }>>([]);
  const [useCustomPlan, setUseCustomPlan] = useState(false);
  const [previewPayments, setPreviewPayments] = useState<Array<{ amount: number; dueDate: string }>>([]);

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
      const preview = OfferService.generatePaymentPlan(
        updatedData.totalAmount,
        updatedData.installments
      );
      setPreviewPayments(preview);
    }
  };

  const handleOfferTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const offerType = e.target.value as 'TFA_ROMANIA' | 'CERTIFICATION';
    setFormData({ ...formData, offerType });
    
    // Set default values based on offer type
    if (offerType === 'CERTIFICATION') {
      setFormData(prev => ({
        ...prev,
        offerType,
        totalAmount: prev.totalAmount || 1500,
        installments: prev.installments || 3
      }));
      setUseCustomPlan(true);
    } else {
      setUseCustomPlan(false);
    }
  };

  const addCustomPayment = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + customPayments.length + 1);
    nextMonth.setDate(30);
    
    setCustomPayments([
      ...customPayments,
      {
        amount: 0,
        dueDate: nextMonth.toISOString().split('T')[0]
      }
    ]);
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
    setCustomPayments(customPayments.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: CreateOfferData = {
      ...formData,
      customPaymentPlan: useCustomPlan && customPayments.length > 0
        ? { payments: customPayments }
        : undefined
    };
    
    onSave(submitData);
  };

  const isFormValid = () => {
    const baseValid = formData.courseId && formData.name && formData.totalAmount > 0 && formData.installments > 0;
    
    if (useCustomPlan) {
      const totalCustomAmount = customPayments.reduce((sum, payment) => sum + payment.amount, 0);
      return baseValid && customPayments.length > 0 && totalCustomAmount === formData.totalAmount;
    }
    
    return baseValid;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6">Crea Nuova Offerta</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Offerta *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo Offerta *
                </label>
                <select
                  name="offerType"
                  value={formData.offerType}
                  onChange={handleOfferTypeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TFA_ROMANIA">TFA Romania (Form Completo)</option>
                  <option value="CERTIFICATION">Certificazione (Form Semplificato)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Corso *
                </label>
                <select
                  name="courseId"
                  value={formData.courseId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleziona corso...</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo Totale (€) *
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {!useCustomPlan && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numero Rate *
                    </label>
                    <input
                      type="number"
                      name="installments"
                      value={formData.installments}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequenza Rate (mesi)
                    </label>
                    <input
                      type="number"
                      name="installmentFrequency"
                      value={formData.installmentFrequency}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            {formData.offerType === 'CERTIFICATION' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Piano Pagamenti Personalizzato</h3>
                  <button
                    type="button"
                    onClick={addCustomPayment}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    + Aggiungi Rata
                  </button>
                </div>

                <div className="space-y-3">
                  {customPayments.map((payment, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 border border-gray-200 rounded">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-600">Importo (€)</label>
                        <input
                          type="number"
                          value={payment.amount}
                          onChange={(e) => updateCustomPayment(index, 'amount', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-gray-600">Scadenza</label>
                        <input
                          type="date"
                          value={payment.dueDate}
                          onChange={(e) => updateCustomPayment(index, 'dueDate', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomPayment(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>

                {customPayments.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <div className="text-sm text-gray-600">
                      Totale rate: €{customPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('it-IT')}
                      {customPayments.reduce((sum, p) => sum + p.amount, 0) !== formData.totalAmount && (
                        <span className="text-red-600 ml-2">
                          (Non corrisponde all'importo totale!)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!useCustomPlan && previewPayments.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Anteprima Piano Pagamenti</h3>
                <div className="bg-gray-50 p-4 rounded">
                  {previewPayments.map((payment, index) => (
                    <div key={index} className="flex justify-between py-1">
                      <span>Rata {index + 1}:</span>
                      <span>€{payment.amount.toLocaleString('it-IT')} - {new Date(payment.dueDate).toLocaleDateString('it-IT')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!isFormValid()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Crea Offerta
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateOfferModal;