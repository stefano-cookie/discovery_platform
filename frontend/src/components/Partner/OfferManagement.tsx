import React, { useState, useEffect } from 'react';
import { OfferService } from '../../services/offerService';
import { PartnerOffer, CreateOfferData } from '../../types/offers';
import { apiRequest } from '../../services/api';

interface OfferType {
  id: string;
  name: string;
  description: string;
  baseAmount: number;
  type: 'TFA_ROMANIA' | 'CERTIFICATION';
}

const OfferManagement: React.FC = () => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [availableOfferTypes, setAvailableOfferTypes] = useState<OfferType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<PartnerOffer | null>(null);
  const [selectedOfferType, setSelectedOfferType] = useState<OfferType | null>(null);
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    totalAmount: 0,
    installments: 1,
    installmentFrequency: 1
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    totalAmount: 0,
    installments: 1,
    installmentFrequency: 1
  });

  useEffect(() => {
    loadOffers();
    loadOfferTypes();
  }, []);

  const loadOffers = async () => {
    try {
      const data = await OfferService.getOffers();
      setOffers(data);
    } catch (error) {
      console.error('Error loading offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOfferTypes = async () => {
    try {
      // This should be an API call to get available offer types from admin
      const response = await apiRequest<OfferType[]>({
        method: 'GET',
        url: '/offer-types'
      });
      setAvailableOfferTypes(response);
    } catch (error) {
      console.error('Error loading offer types:', error);
      // Mock data for now
      setAvailableOfferTypes([
        {
          id: 'tfa-romania-2024',
          name: 'TFA Romania 2024',
          description: 'Corso di abilitazione all\'insegnamento in Romania',
          baseAmount: 3000,
          type: 'TFA_ROMANIA'
        },
        {
          id: 'cert-spagnolo-a2',
          name: 'Certificazione Spagnolo A2',
          description: 'Certificazione linguistica Spagnolo livello A2',
          baseAmount: 500,
          type: 'CERTIFICATION'
        },
        {
          id: 'cert-inglese-b2',
          name: 'Certificazione Inglese B2',
          description: 'Certificazione linguistica Inglese livello B2',
          baseAmount: 600,
          type: 'CERTIFICATION'
        }
      ]);
    }
  };

  const handleCreateOffer = async () => {
    if (!selectedOfferType) return;

    try {
      const offerData: CreateOfferData = {
        courseId: selectedOfferType.id,
        name: createFormData.name || selectedOfferType.name,
        offerType: selectedOfferType.type,
        totalAmount: createFormData.totalAmount,
        installments: createFormData.installments,
        installmentFrequency: createFormData.installmentFrequency
      };

      // Generate custom payment plan if installments > 1
      if (createFormData.installments > 1) {
        const payments = OfferService.generatePaymentPlan(
          createFormData.totalAmount,
          createFormData.installments
        );
        offerData.customPaymentPlan = { payments };
      }

      await OfferService.createOffer(offerData);
      await loadOffers();
      setShowCreateModal(false);
      resetCreateForm();
      showNotification('success', 'Offerta creata con successo!');
    } catch (error) {
      console.error('Error creating offer:', error);
      showNotification('error', 'Errore durante la creazione dell\'offerta');
    }
  };

  const resetCreateForm = () => {
    setSelectedOfferType(null);
    setCreateFormData({
      name: '',
      totalAmount: 0,
      installments: 1,
      installmentFrequency: 1
    });
  };

  const handleOfferTypeSelect = (offerType: OfferType) => {
    setSelectedOfferType(offerType);
    setCreateFormData({
      ...createFormData,
      name: offerType.name,
      totalAmount: offerType.baseAmount
    });
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const copyReferralLink = (offer: PartnerOffer) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/registration/${offer.referralLink}`;
    navigator.clipboard.writeText(link);
    showNotification('success', 'Link copiato negli appunti!');
  };

  const handleEditOffer = (offer: PartnerOffer) => {
    setSelectedOffer(offer);
    setEditFormData({
      name: offer.name,
      totalAmount: Number(offer.totalAmount),
      installments: offer.installments,
      installmentFrequency: offer.installmentFrequency
    });
    setShowEditModal(true);
  };

  const handleDeleteOffer = (offer: PartnerOffer) => {
    setSelectedOffer(offer);
    setShowDeleteModal(true);
  };

  const confirmEditOffer = async () => {
    if (!selectedOffer) return;

    try {
      // Generate custom payment plan if installments > 1
      let customPaymentPlan = null;
      if (editFormData.installments > 1) {
        const payments = OfferService.generatePaymentPlan(
          editFormData.totalAmount,
          editFormData.installments
        );
        customPaymentPlan = { payments };
      }

      const updateData: any = {
        name: editFormData.name,
        totalAmount: editFormData.totalAmount,
        installments: editFormData.installments,
        installmentFrequency: editFormData.installmentFrequency
      };

      if (customPaymentPlan) {
        updateData.customPaymentPlan = customPaymentPlan;
      }

      await OfferService.updateOffer(selectedOffer.id, updateData);

      await loadOffers();
      setShowEditModal(false);
      setSelectedOffer(null);
      showNotification('success', 'Offerta modificata con successo!');
    } catch (error) {
      console.error('Error updating offer:', error);
      showNotification('error', 'Errore durante la modifica dell\'offerta');
    }
  };

  const confirmDeleteOffer = async () => {
    if (!selectedOffer) return;

    try {
      await OfferService.deleteOffer(selectedOffer.id);
      await loadOffers();
      setShowDeleteModal(false);
      setSelectedOffer(null);
      showNotification('success', 'Offerta eliminata con successo!');
    } catch (error: any) {
      console.error('Error deleting offer:', error);
      const errorMessage = error?.response?.data?.error || 'Errore durante l\'eliminazione dell\'offerta';
      showNotification('error', errorMessage);
    }
  };

  // Calcola se il corso selezionato è tipo TFA Romania (con acconto)
  const isTfaRomania = selectedOfferType?.type === 'TFA_ROMANIA' || 
                       selectedOfferType?.name?.includes('TFA') ||
                       selectedOfferType?.name?.includes('Corso di Formazione Diamante');

  // Calcola se l'offerta in modifica è tipo TFA Romania  
  const isTfaRomaniaEdit = selectedOffer?.offerType === 'TFA_ROMANIA' || 
                          selectedOffer?.name?.includes('TFA') ||
                          selectedOffer?.name?.includes('Corso di Formazione Diamante');

  const PaymentPlanPreview = () => {
    if (createFormData.installments <= 1 || createFormData.totalAmount <= 0) return null;

    // Per TFA Romania: (totale - acconto 1500€) / numero rate
    // Per altri corsi: totale / numero rate
    const downPayment = isTfaRomania ? 1500 : 0;
    const remainingAmount = Math.max(0, createFormData.totalAmount - downPayment);

    // Se l'importo rimanente è 0 o negativo per TFA Romania, mostra messaggio
    if (isTfaRomania && remainingAmount <= 0) {
      return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            L'importo totale deve essere superiore all'acconto di €1.500
          </p>
        </div>
      );
    }

    const payments = OfferService.generatePaymentPlan(
      remainingAmount,
      createFormData.installments
    );

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Anteprima Piano Pagamenti:</h4>
        

        {/* Riassunto calcolo */}
        <div className="mb-3 p-3 bg-gray-100 border border-gray-300 rounded text-xs">
          <div className="flex justify-between">
            <span>Importo Totale:</span>
            <span className="font-medium">€{createFormData.totalAmount.toFixed(2)}</span>
          </div>
          {isTfaRomania && downPayment > 0 && (
            <>
              <div className="flex justify-between text-blue-700">
                <span>- Acconto (al momento iscrizione):</span>
                <span className="font-medium">€{downPayment.toFixed(2)}</span>
              </div>
              <hr className="my-1 border-gray-400" />
              <div className="flex justify-between font-semibold">
                <span>Importo da rateizzare:</span>
                <span>€{remainingAmount.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
        
        {/* Acconto per questo corso */}
        {isTfaRomania && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-900">Acconto al momento dell'iscrizione</p>
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">€{downPayment.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {payments.map((payment, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>Rata {index + 1} - {new Date(payment.dueDate).toLocaleDateString('it-IT')}</span>
              <span className="font-medium">€{payment.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t">
          <div className="flex justify-between text-sm font-medium">
            <span>Totale</span>
            <span>€{createFormData.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center">
            <span className="mr-2">
              {notification.type === 'success' ? '✓' : '✗'}
            </span>
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestione Offerte</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Crea Nuova Offerta
        </button>
      </div>

      {/* Offers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((offer) => (
          <div key={offer.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{offer.name}</h3>
                <p className="text-sm text-gray-500">
                  {offer.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                offer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {offer.isActive ? 'Attiva' : 'Inattiva'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Importo totale:</span>
                <span className="font-medium">€{Number(offer.totalAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rate:</span>
                <span className="font-medium">{offer.installments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Iscrizioni:</span>
                <span className="font-medium">{offer._count?.registrations || 0}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t space-y-2">
              <button
                onClick={() => copyReferralLink(offer)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
              >
                Copia Link Referral
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditOffer(offer)}
                  className="flex-1 text-center text-sm text-green-600 hover:text-green-800 py-1"
                >
                  Modifica
                </button>
                <button
                  onClick={() => handleDeleteOffer(offer)}
                  className="flex-1 text-center text-sm text-red-600 hover:text-red-800 py-1"
                  disabled={(offer._count?.registrations || 0) > 0}
                  title={(offer._count?.registrations || 0) > 0 ? 'Non è possibile eliminare offerte con iscrizioni' : ''}
                >
                  Elimina
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Crea Nuova Offerta</h3>

            {!selectedOfferType ? (
              <>
                <p className="text-gray-600 mb-4">Seleziona il tipo di offerta:</p>
                <div className="grid grid-cols-1 gap-3">
                  {availableOfferTypes.map((offerType) => (
                    <button
                      key={offerType.id}
                      onClick={() => handleOfferTypeSelect(offerType)}
                      className="p-4 border rounded-lg hover:bg-gray-50 text-left"
                    >
                      <h4 className="font-medium">{offerType.name}</h4>
                      <p className="text-sm text-gray-600">{offerType.description}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Importo base: €{offerType.baseAmount}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">{selectedOfferType.name}</h4>
                  <p className="text-sm text-blue-700">{selectedOfferType.description}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Personalizzato (opzionale)
                    </label>
                    <input
                      type="text"
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                      placeholder={selectedOfferType.name}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importo Totale (€)
                    </label>
                    <input
                      type="number"
                      value={createFormData.totalAmount}
                      onChange={(e) => setCreateFormData({ 
                        ...createFormData, 
                        totalAmount: parseFloat(e.target.value) || 0 
                      })}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Numero di Rate Personalizzabile
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={createFormData.installments}
                      onChange={(e) => setCreateFormData({ 
                        ...createFormData, 
                        installments: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="es. 3"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Da 1 a 24 rate personalizzabili
                      {isTfaRomania && 
                        ' - Per questo corso: (totale - acconto €1.500) / numero rate'
                      }
                    </p>
                  </div>

                  <PaymentPlanPreview />
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              {selectedOfferType && (
                <button
                  onClick={handleCreateOffer}
                  disabled={!createFormData.totalAmount}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Crea Offerta
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Offer Modal */}
      {showEditModal && selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Modifica Offerta</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900">{selectedOffer.name}</h4>
              <p className="text-sm text-gray-600">
                {selectedOffer.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Offerta
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importo Totale (€)
                </label>
                <input
                  type="number"
                  value={editFormData.totalAmount}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    totalAmount: parseFloat(e.target.value) || 0 
                  })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numero di Rate Personalizzabile
                </label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={editFormData.installments}
                  onChange={(e) => setEditFormData({ 
                    ...editFormData, 
                    installments: parseInt(e.target.value) || 1
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="es. 3"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Da 1 a 24 rate personalizzabili
                  {isTfaRomaniaEdit && 
                    ' - Per questo corso: (totale - acconto €1.500) / numero rate'
                  }
                </p>
              </div>

              {/* Payment Plan Preview for Edit */}
              {editFormData.installments > 1 && editFormData.totalAmount > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-700 mb-2">Anteprima Piano Pagamenti:</h4>
                  
                  {(() => {
                    const downPayment = isTfaRomaniaEdit ? 1500 : 0;
                    const remainingAmount = Math.max(0, editFormData.totalAmount - downPayment);
                    
                    if (isTfaRomaniaEdit && remainingAmount <= 0) {
                      return (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm text-red-800">
                            L'importo totale deve essere superiore all'acconto di €1.500
                          </p>
                        </div>
                      );
                    }
                    
                    const payments = OfferService.generatePaymentPlan(remainingAmount, editFormData.installments);
                    
                    return (
                      <>
                        {/* Riassunto calcolo */}
                        <div className="mb-3 p-3 bg-gray-100 border border-gray-300 rounded text-xs">
                          <div className="flex justify-between">
                            <span>Importo Totale:</span>
                            <span className="font-medium">€{editFormData.totalAmount.toFixed(2)}</span>
                          </div>
                          {isTfaRomaniaEdit && downPayment > 0 && (
                            <>
                              <div className="flex justify-between text-blue-700">
                                <span>- Acconto (al momento iscrizione):</span>
                                <span className="font-medium">€{downPayment.toFixed(2)}</span>
                              </div>
                              <hr className="my-1 border-gray-400" />
                              <div className="flex justify-between font-semibold">
                                <span>Importo da rateizzare:</span>
                                <span>€{remainingAmount.toFixed(2)}</span>
                              </div>
                            </>
                          )}
                        </div>
                        
                                        {/* Acconto per questo corso */}
                        {isTfaRomaniaEdit && (
                          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-sm font-medium text-blue-900">Acconto al momento dell'iscrizione</p>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-blue-900">€{downPayment.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          {payments.map((payment, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span>Rata {index + 1} - {new Date(payment.dueDate).toLocaleDateString('it-IT')}</span>
                              <span className="font-medium">€{payment.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedOffer(null);
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={confirmEditOffer}
                disabled={!editFormData.name || !editFormData.totalAmount}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Salva Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Conferma Eliminazione</h3>
            
            <p className="text-gray-600 mb-4">
              Sei sicuro di voler eliminare l'offerta "{selectedOffer.name}"?
            </p>
            
            {(selectedOffer._count?.registrations || 0) > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  ⚠️ Questa offerta ha {selectedOffer._count?.registrations || 0} iscrizioni attive e non può essere eliminata.
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedOffer(null);
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={confirmDeleteOffer}
                disabled={(selectedOffer._count?.registrations || 0) > 0}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferManagement;