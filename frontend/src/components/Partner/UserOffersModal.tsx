import React, { useState, useEffect, useCallback } from 'react';
import { PartnerUser } from '../../types/partner';
import { partnerService } from '../../services/partner';
import Modal from '../UI/Modal';

interface UserOffersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: PartnerUser | null;
  onOffersUpdated?: () => void;
}

interface PartnerOffer {
  id: string;
  name: string;
  courseName: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalAmount: number;
  installments: number;
  isActive: boolean;
  hasAccess: boolean; // Se l'utente ha già accesso
  isOriginal: boolean; // Se è l'offerta originale di iscrizione
}

const UserOffersModal: React.FC<UserOffersModalProps> = ({
  isOpen,
  onClose,
  user,
  onOffersUpdated
}) => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  const fetchUserOffers = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await partnerService.getUserOffers(user.id);
      setOffers(data);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento delle offerte');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserOffers();
    }
  }, [isOpen, user, fetchUserOffers]);

  const toggleOfferAccess = async (offerId: string, hasAccess: boolean) => {
    if (!user) return;
    
    try {
      setUpdatingOfferId(offerId);
      
      if (hasAccess) {
        await partnerService.revokeUserOfferAccess(user.id, offerId);
      } else {
        await partnerService.grantUserOfferAccess(user.id, offerId);
      }
      
      // Aggiorna lo stato locale
      setOffers(prev => prev.map(offer => 
        offer.id === offerId 
          ? { ...offer, hasAccess: !hasAccess }
          : offer
      ));
      
      if (onOffersUpdated) {
        onOffersUpdated();
      }
    } catch (err: any) {
      setError(err.message || 'Errore nell\'aggiornamento dell\'accesso');
    } finally {
      setUpdatingOfferId(null);
    }
  };

  const getOfferTypeLabel = (type: string) => {
    return type === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione';
  };

  const getOfferTypeBadge = (type: string) => {
    const isRomania = type === 'TFA_ROMANIA';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isRomania 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-green-100 text-green-800'
      }`}>
        {getOfferTypeLabel(type)}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={!loading && !updatingOfferId}
      closeOnEscape={!loading && !updatingOfferId}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            Gestisci Offerte per {user?.profile?.nome} {user?.profile?.cognome}
          </h2>
          <p className="text-purple-100 text-sm">
            {user?.email} • Abilita o disabilita l'accesso alle tue offerte
          </p>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">Caricamento offerte...</span>
          </div>
        ) : (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Come funziona:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li><strong>Offerta Originale:</strong> L'utente ha accesso automatico all'offerta con cui si è iscritto</li>
                    <li><strong>Offerte Aggiuntive:</strong> Puoi abilitare l'accesso alle tue altre offerte attive</li>
                    <li><strong>Dashboard Utente:</strong> L'utente vedrà tutte le offerte abilitate nella sua area riservata</li>
                  </ul>
                </div>
              </div>
            </div>

            {offers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg font-medium mb-2">Nessuna offerta disponibile</p>
                <p className="text-gray-400 text-sm">Crea delle offerte per poterle assegnare agli utenti</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                      offer.isOriginal
                        ? 'border-green-200 bg-green-50'
                        : offer.hasAccess
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {offer.name}
                          </h3>
                          {getOfferTypeBadge(offer.offerType)}
                          {offer.isOriginal && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Offerta Originale
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <p><span className="font-medium">Corso:</span> {offer.courseName}</p>
                          <p><span className="font-medium">Prezzo:</span> €{offer.totalAmount.toFixed(2)}</p>
                          <p><span className="font-medium">Rate:</span> {offer.installments} {offer.installments === 1 ? 'rata' : 'rate'}</p>
                        </div>
                      </div>

                      <div className="ml-6 flex flex-col items-end">
                        {offer.isOriginal ? (
                          <div className="flex items-center text-green-700 font-medium">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Accesso Automatico
                          </div>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <span className={`text-sm font-medium ${
                              offer.hasAccess ? 'text-blue-700' : 'text-gray-500'
                            }`}>
                              {offer.hasAccess ? 'Abilitato' : 'Disabilitato'}
                            </span>
                            
                            <label className="flex items-center cursor-pointer">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={offer.hasAccess}
                                  onChange={() => toggleOfferAccess(offer.id, offer.hasAccess)}
                                  disabled={updatingOfferId === offer.id}
                                  className="sr-only"
                                />
                                <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                                  offer.hasAccess ? 'bg-blue-500' : 'bg-gray-300'
                                } ${updatingOfferId === offer.id ? 'opacity-50' : ''}`}>
                                  <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-200 transform ${
                                    offer.hasAccess ? 'translate-x-5' : 'translate-x-0'
                                  } mt-0.5 ml-0.5 flex items-center justify-center`}>
                                    {updatingOfferId === offer.id && (
                                      <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Chiudi
        </button>
      </div>
    </Modal>
  );
};

export default UserOffersModal;