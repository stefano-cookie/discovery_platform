import React, { useState, useEffect } from 'react';
import { Course, PartnerOffer, UpdateOfferData } from '../../types/offers';
import { OfferService } from '../../services/offerService';
import Modal from '../UI/Modal';

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
    <Modal
      isOpen={true}
      onClose={onClose}
      size="full"
      closeOnOverlayClick={false}
      closeOnEscape={true}
    >
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Modifica Offerta</h2>
          <p className="text-indigo-100 mt-1">{offer.name}</p>
        </div>
      </div>
      <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Configurazione Base */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Configurazione Base
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Offerta
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Importo Totale (€)
                  </label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={formData.totalAmount}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stato Offerta
                  </label>
                  <div className="flex items-center h-12">
                    <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer transition-all ${
                      formData.isActive 
                        ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                        : 'bg-red-100 text-red-700 border-2 border-red-300'
                    }`}>
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      {formData.isActive ? 'Attiva' : 'Disattiva'}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {!useCustomPlan && (
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  Piano Pagamenti Standard
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Numero Rate
                    </label>
                    <select
                      name="installments"
                      value={formData.installments}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={1}>Pagamento unico</option>
                      <option value={2}>2 rate</option>
                      <option value={4}>4 rate</option>
                      <option value={12}>12 rate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Frequenza Rate (mesi)
                    </label>
                    <input
                      type="number"
                      name="installmentFrequency"
                      value={formData.installmentFrequency}
                      onChange={handleInputChange}
                      min="1"
                      max="12"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ogni quanti mesi scade una rata</p>
                  </div>
                </div>
              </div>
            )}

            {/* Informazioni Offerta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  Informazioni Offerta
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      offer.offerType === 'TFA_ROMANIA' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {offer.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                    </span>
                  </div>
                  <div className="text-sm space-y-2">
                    <div><span className="font-medium">Corso:</span> {offer.course?.name || 'Non specificato'}</div>
                    <div className="break-all">
                      <span className="font-medium">Link:</span> 
                      <span className="text-blue-600 text-xs ml-1">{offer.referralLink}</span>
                    </div>
                    <div><span className="font-medium">Creata il:</span> {new Date(offer.createdAt).toLocaleDateString('it-IT')}</div>
                    {offer._count && (
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">Registrazioni:</span> 
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">
                          {offer._count.registrations}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  Piano Pagamenti Attuale
                </h3>
                <div className="bg-white p-4 rounded-lg border max-h-40 overflow-y-auto">
                  {currentPayments.length > 0 ? (
                    currentPayments.map((payment, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium">Rata {index + 1}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-600">€{payment.amount.toLocaleString('it-IT')}</div>
                          <div className="text-xs text-gray-500">{payment.formattedDate}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <div className="text-sm">
                        {offer.offerType === 'TFA_ROMANIA' && offer.totalAmount > 1500 && offer.installments > 1 ? (
                          <>Acconto: €1.500 + {offer.installments} rate da €{((offer.totalAmount - 1500) / offer.installments).toFixed(2)}</>
                        ) : (
                          <>{offer.installments} rate da €{(offer.totalAmount / offer.installments).toFixed(2)}</>
                        )}
                      </div>
                      <div className="text-xs mt-1">
                        ogni {offer.installmentFrequency} mese/i
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {offer.offerType === 'CERTIFICATION' && (
              <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      Modifica Piano Pagamenti
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Personalizza il piano di pagamento per questa certificazione</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer transition-all ${
                      useCustomPlan 
                        ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                        : 'bg-gray-100 text-gray-700 border-2 border-gray-300'
                    }`}>
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
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 shadow-md"
                      >
                        <span>+</span>
                        <span>Aggiungi Rata</span>
                      </button>
                    )}
                  </div>
                </div>

                {useCustomPlan && (
                  <div>
                    {customPayments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Nessuna rata personalizzata configurata</p>
                        <p className="text-sm">Clicca "Aggiungi Rata" per iniziare</p>
                      </div>
                    ) : (
                      customPayments.map((payment, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                          <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-bold">
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
                            <input
                              type="date"
                              value={payment.dueDate}
                              onChange={(e) => updateCustomPayment(index, 'dueDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
                      ))
                    )}

                    {customPayments.length > 0 && (
                      <div className="mt-6 p-4 bg-white border-2 border-dashed border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                              <span className="text-yellow-600 font-bold">Σ</span>
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
                )}
              </div>
            )}

            <div className="bg-gray-50 p-6 rounded-lg flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <p>Le modifiche saranno applicate immediatamente</p>
                <p className="text-xs mt-1">Il link referral rimarrà invariato</p>
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
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-lg hover:from-indigo-700 hover:to-purple-800 font-medium shadow-md"
                >
                  Salva Modifiche
                </button>
              </div>
            </div>
          </form>
      </div>
    </Modal>
  );
};

export default EditOfferModal;