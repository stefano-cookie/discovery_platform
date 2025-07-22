import React, { useState, useEffect } from 'react';
import { Course, PartnerOffer, UpdateOfferData } from '../../types/offers';
import { OfferService } from '../../services/offerService';

interface EditOfferModalProps {
  offer: PartnerOffer;
  courses: Course[];
  onSave: (data: UpdateOfferData) => void;
  onClose: () => void;
}

const EditOfferModal: React.FC<EditOfferModalProps> = ({ offer, courses, onSave, onClose }) => {
  const [formData, setFormData] = useState<UpdateOfferData>({
    name: offer.name,
    totalAmount: offer.totalAmount,
    installments: offer.installments,
    installmentFrequency: offer.installmentFrequency,
    customPaymentPlan: offer.customPaymentPlan,
    isActive: offer.isActive
  });

  const [customPayments, setCustomPayments] = useState<Array<{ amount: number; dueDate: string }>>([]);
  const [useCustomPlan, setUseCustomPlan] = useState(!!offer.customPaymentPlan);

  useEffect(() => {
    if (offer.customPaymentPlan?.payments) {
      setCustomPayments(offer.customPaymentPlan.payments);
    }
  }, [offer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : 
              type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
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
    
    const submitData: UpdateOfferData = {
      ...formData,
      customPaymentPlan: useCustomPlan && customPayments.length > 0
        ? { payments: customPayments }
        : undefined
    };
    
    onSave(submitData);
  };

  const currentPayments = OfferService.formatPaymentPlan(offer.customPaymentPlan);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-6">Modifica Offerta: {offer.name}</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Offerta
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stato
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  Offerta attiva
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo Totale (€)
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!useCustomPlan && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numero Rate
                    </label>
                    <input
                      type="number"
                      name="installments"
                      value={formData.installments}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Informazioni Offerta</h3>
                <div className="bg-gray-50 p-4 rounded space-y-2">
                  <div><strong>Tipo:</strong> {offer.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}</div>
                  <div><strong>Corso:</strong> {offer.course?.name}</div>
                  <div><strong>Link Referral:</strong> {offer.referralLink}</div>
                  <div><strong>Creata il:</strong> {new Date(offer.createdAt).toLocaleDateString('it-IT')}</div>
                  {offer._count && <div><strong>Registrazioni:</strong> {offer._count.registrations}</div>}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Piano Pagamenti Attuale</h3>
                <div className="bg-gray-50 p-4 rounded max-h-40 overflow-y-auto">
                  {currentPayments.length > 0 ? (
                    currentPayments.map((payment, index) => (
                      <div key={index} className="flex justify-between py-1 text-sm">
                        <span>Rata {index + 1}:</span>
                        <span>€{payment.amount.toLocaleString('it-IT')} - {payment.formattedDate}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">
                      {offer.installments} rate da €{(offer.totalAmount / offer.installments).toFixed(2)} ogni {offer.installmentFrequency} mese/i
                    </div>
                  )}
                </div>
              </div>
            </div>

            {offer.offerType === 'CERTIFICATION' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Modifica Piano Pagamenti</h3>
                  <div className="space-x-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={useCustomPlan}
                        onChange={(e) => setUseCustomPlan(e.target.checked)}
                        className="mr-2"
                      />
                      Piano personalizzato
                    </label>
                    {useCustomPlan && (
                      <button
                        type="button"
                        onClick={addCustomPayment}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        + Aggiungi Rata
                      </button>
                    )}
                  </div>
                </div>

                {useCustomPlan && (
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
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Salva Modifiche
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditOfferModal;