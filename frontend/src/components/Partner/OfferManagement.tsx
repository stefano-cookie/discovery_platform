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
  const [createStep, setCreateStep] = useState<'template' | 'details'>('template');
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
      // Mock data for now - solo TFA e Certificazioni
      setAvailableOfferTypes([
        {
          id: 'tfa-romania-2024',
          name: 'TFA Romania 2024',
          description: 'Corso di abilitazione all\'insegnamento in Romania',
          baseAmount: 4000,
          type: 'TFA_ROMANIA'
        },
        {
          id: 'cert-generic',
          name: 'Certificazioni Professionali',
          description: 'Certificazioni e corsi professionali vari',
          baseAmount: 1500,
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
    setCreateStep('template');
    setCreateFormData({
      name: '',
      totalAmount: 0,
      installments: 1,
      installmentFrequency: 1
    });
  };

  const handleOfferTypeSelect = (offerType: OfferType) => {
    setSelectedOfferType(offerType);
    setCreateStep('details');
    setCreateFormData({
      ...createFormData,
      name: offerType.name,
      totalAmount: offerType.baseAmount,
      installments: offerType.type === 'TFA_ROMANIA' ? 4 : 3 // Default consigliato
    });
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 1500); // Ridotto da 3000 a 1500ms
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
      // SEMPRE genera il customPaymentPlan per offerte modificate
      // In questo modo si aggiorna correttamente il numero di rate
      let customPaymentPlan = null;
      
      if (editFormData.installments > 1) {
        // Per TFA Romania: calcola sulla parte rateizzabile (totale - acconto)
        // Per altri corsi: calcola sul totale
        const amountToInstall = isTfaRomaniaEdit ? 
          Math.max(0, editFormData.totalAmount - 1500) : 
          editFormData.totalAmount;
          
        const payments = OfferService.generatePaymentPlan(
          amountToInstall,
          editFormData.installments
        );
        customPaymentPlan = { payments };
      } else {
        // Per pagamento unico, rimuovi il customPaymentPlan
        customPaymentPlan = null;
      }

      const updateData: any = {
        name: editFormData.name,
        totalAmount: editFormData.totalAmount,
        installments: editFormData.installments,
        installmentFrequency: editFormData.installmentFrequency,
        // IMPORTANTE: Includi sempre customPaymentPlan per aggiornare correttamente
        customPaymentPlan: customPaymentPlan
      };

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
    <div className="w-full h-fit space-y-6">
      {/* Notification */}
      {notification && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-none animate-in fade-in-0 duration-200"
          onClick={() => setNotification(null)}
        >
          <div 
            className={`pointer-events-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95 duration-200 p-6 rounded-2xl shadow-2xl max-w-md mx-4 cursor-pointer hover:scale-105 ${
              notification.type === 'success' 
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-800 border-2 border-emerald-200 hover:from-emerald-100 hover:to-green-100' 
                : 'bg-gradient-to-r from-red-50 to-rose-50 text-red-800 border-2 border-red-200 hover:from-red-100 hover:to-rose-100'
            }`}
            onClick={() => setNotification(null)}
          >
            <div className="flex items-center justify-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full mr-4 ${
                notification.type === 'success' 
                  ? 'bg-emerald-100 text-emerald-600' 
                  : 'bg-red-100 text-red-600'
              }`}>
                {notification.type === 'success' ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">
                  {notification.type === 'success' ? 'Perfetto!' : 'Errore'}
                </h3>
                <p className="text-sm opacity-90">
                  {notification.message}
                </p>
              </div>
              <div className="ml-2 text-xs opacity-60">
                Clicca per chiudere
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Offerte</h2>
          <p className="text-gray-600 mt-1">Crea e gestisci le tue offerte personalizzate</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl flex items-center group"
        >
          <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Crea Nuova Offerta
        </button>
      </div>

      {/* Offers Grid */}
      {offers.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna offerta creata</h3>
          <p className="text-gray-600 mb-6">Inizia creando la tua prima offerta personalizzata per iniziare a raccogliere iscrizioni.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl inline-flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Crea la tua prima offerta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {offers.map((offer) => (
          <div 
            key={offer.id} 
            className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-blue-200 overflow-hidden group"
          >
            {/* Card Header */}
            <div className="p-6 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {offer.name}
                  </h3>
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      offer.offerType === 'TFA_ROMANIA' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {offer.offerType === 'TFA_ROMANIA' ? '🎓 TFA Romania' : '📜 Certificazione'}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-semibold shadow-sm ${
                    offer.isActive 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-1.5 ${
                      offer.isActive ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    {offer.isActive ? 'Attiva' : 'Inattiva'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="px-6 pb-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">
                    €{Number(offer.totalAmount).toLocaleString('it-IT')}
                  </div>
                  <div className="text-xs text-gray-600 font-medium">Importo</div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-blue-700">
                    {offer.installments}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">Rate</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-700">
                    {offer._count?.registrations || 0}
                  </div>
                  <div className="text-xs text-green-600 font-medium">Iscritti</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6">
              <div className="space-y-2">
                {/* Copy Referral Link Button */}
                <button
                  onClick={() => copyReferralLink(offer)}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md flex items-center justify-center group"
                >
                  <svg className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Copia Link Referral
                </button>
                
                {/* Edit and Delete Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleEditOffer(offer)}
                    className="bg-white border border-green-200 text-green-700 px-4 py-2.5 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium text-sm flex items-center justify-center group"
                  >
                    <svg className="w-4 h-4 mr-1.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </button>
                  
                  <button
                    onClick={() => handleDeleteOffer(offer)}
                    disabled={(offer._count?.registrations || 0) > 0}
                    className={`px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center transition-all duration-200 ${
                      (offer._count?.registrations || 0) > 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 group'
                    }`}
                    title={(offer._count?.registrations || 0) > 0 ? 'Non è possibile eliminare offerte con iscrizioni' : 'Elimina offerta'}
                  >
                    <svg className={`w-4 h-4 mr-1.5 transition-transform ${(offer._count?.registrations || 0) === 0 ? 'group-hover:scale-110' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Create Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-2xl transform transition-all duration-300 scale-100 mx-auto my-auto relative animate-in fade-in-0 zoom-in-95 duration-300">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {createStep === 'template' ? 'Scegli Template' : 'Configura Offerta'}
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {createStep === 'template' 
                      ? 'Seleziona il tipo di corso per la tua offerta' 
                      : 'Imposta nome, importo e rate personalizzate'
                    }
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="text-white hover:text-blue-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-8">
              {createStep === 'template' ? (
                /* Step 1: Template Selection */
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Seleziona il Template del Corso</h3>
                    <p className="text-gray-600">Ogni template definisce quali form e documenti mostrare agli utenti</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {availableOfferTypes.map((offerType) => (
                      <div
                        key={offerType.id}
                        onClick={() => handleOfferTypeSelect(offerType)}
                        className="p-8 border-3 rounded-xl cursor-pointer transition-all shadow-lg hover:shadow-xl hover:scale-105 border-gray-300 hover:border-purple-400 bg-white"
                      >
                        <div className="text-center">
                          <h4 className="text-xl font-bold text-gray-900 mb-3">{offerType.name}</h4>
                          <p className="text-sm text-gray-600 mb-4">{offerType.description}</p>
                          
                          <div className={`text-xs p-3 rounded-lg ${
                            offerType.type === 'TFA_ROMANIA' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            <strong>Include:</strong> {offerType.type === 'TFA_ROMANIA' 
                              ? 'Form completo (anagrafica, istruzione, professione, documenti completi)'
                              : 'Form semplificato (solo documento identità + codice fiscale)'
                            }
                          </div>
                          
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-center text-blue-600 font-semibold">
                              <span>Seleziona questo template</span>
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Step 2: Offer Configuration */
                <div className="space-y-8">
                  {/* Selected Template Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">{selectedOfferType?.name}</h4>
                        <p className="text-sm text-gray-600">{selectedOfferType?.description}</p>
                        <button
                          onClick={() => {
                            setCreateStep('template');
                            setSelectedOfferType(null);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          ← Cambia template
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Configuration Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">
                        Nome Offerta *
                      </label>
                      <input
                        type="text"
                        value={createFormData.name}
                        onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                        placeholder={selectedOfferType?.name}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Questo nome sarà visibile agli utenti che accedono tramite il tuo link
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">
                        Importo Totale (€) *
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
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                      />
                      {selectedOfferType?.type === 'TFA_ROMANIA' && (
                        <div className="mt-2">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            acconto €1.500
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Payment Options */}
                  <div className="bg-gray-50 p-6 rounded-xl">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Opzioni Pagamento</h4>
                    
                    {/* Quick Payment Options */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => setCreateFormData({ ...createFormData, installments: 1 })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          createFormData.installments === 1 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-sm font-semibold">Unico</div>
                        <div className="text-xs text-gray-600">Tutto subito</div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCreateFormData({ ...createFormData, installments: 2 })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          createFormData.installments === 2 
                            ? 'border-blue-500 bg-blue-50 text-blue-700' 
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        <div className="text-sm font-semibold">2 Rate</div>
                        <div className="text-xs text-gray-600">Bimestrale</div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCreateFormData({ 
                          ...createFormData, 
                          installments: selectedOfferType?.type === 'TFA_ROMANIA' ? 4 : 3 
                        })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          createFormData.installments === (selectedOfferType?.type === 'TFA_ROMANIA' ? 4 : 3)
                            ? 'border-green-500 bg-green-50 text-green-700' 
                            : 'border-gray-300 hover:border-green-300'
                        }`}
                      >
                        <div className="text-sm font-semibold">Consigliato</div>
                        <div className="text-xs text-gray-600">
                          {selectedOfferType?.type === 'TFA_ROMANIA' ? '4' : '3'} rate
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setCreateFormData({ ...createFormData, installments: 6 })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          createFormData.installments === 6 
                            ? 'border-purple-500 bg-purple-50 text-purple-700' 
                            : 'border-gray-300 hover:border-purple-300'
                        }`}
                      >
                        <div className="text-sm font-semibold">6 Rate</div>
                        <div className="text-xs text-gray-600">Semestrale</div>
                      </button>
                    </div>
                    
                    {/* Custom Rate Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numero Rate Personalizzato
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="es. 3"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Da 1 a 24 rate personalizzabili
                        {isTfaRomania && ' - Per TFA: (totale - acconto €1.500) / numero rate'}
                      </p>
                    </div>
                  </div>

                  <PaymentPlanPreview />
                </div>
              )}
              
              {/* Bottom Actions */}
              <div className="mt-8 pt-6 border-t flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {createStep === 'template' ? 'Step 1 di 2: Selezione Template' : 'Step 2 di 2: Configurazione'}
                </div>
                
                <div className="flex space-x-3">
                  {createStep === 'details' && (
                    <button
                      onClick={() => {
                        setCreateStep('template');
                        setSelectedOfferType(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      ← Indietro
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Annulla
                  </button>
                  
                  {createStep === 'details' && (
                    <button
                      onClick={handleCreateOffer}
                      disabled={!createFormData.totalAmount || !createFormData.name}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium shadow-md"
                    >
                      {!createFormData.totalAmount || !createFormData.name ? 'Compila tutti i campi' : 'Crea Offerta'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Offer Modal */}
      {showEditModal && selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all duration-300 scale-100 mx-auto my-auto relative animate-in fade-in-0 zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Modifica Offerta</h3>
                  <p className="text-emerald-100 mt-1">Aggiorna i parametri della tua offerta</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-white hover:text-emerald-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">

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
            </div> {/* Close content div */}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedOffer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl transform transition-all duration-300 scale-100 mx-auto my-auto relative animate-in fade-in-0 zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Conferma Eliminazione</h3>
                  <p className="text-red-100 mt-1">Questa azione non può essere annullata</p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-white hover:text-red-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
            
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
            </div> {/* Close content div */}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferManagement;