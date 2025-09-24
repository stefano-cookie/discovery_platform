import React, { useState, useCallback, useEffect } from 'react';
import { PartnerUser } from '../../types/partner';
import { partnerService } from '../../services/partner';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface OrphanedUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: PartnerUser | null;
  onUserUpdated?: () => void;
  onUserDeleted?: () => void;
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

const OrphanedUserModal: React.FC<OrphanedUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onUserDeleted
}) => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Carica le offerte quando il modal si apre o l'utente cambia
  useEffect(() => {
    if (isOpen && user) {
      fetchUserOffers();
    }
  }, [isOpen, user, fetchUserOffers]);

  const handleToggleOfferAccess = async (offerId: string, hasAccess: boolean) => {
    if (!user) return;
    
    try {
      setUpdatingOfferId(offerId);
      
      if (hasAccess) {
        await partnerService.revokeUserOfferAccess(user.id, offerId);
      } else {
        await partnerService.grantUserOfferAccessWithToken(user.id, offerId, undefined);
        console.log('✅ Grant access completed for orphaned user:', {
          userId: user.id,
          offerId
        });
      }
      
      // Ricarica le offerte per aggiornare lo stato
      await fetchUserOffers();
      
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (err: any) {
      setError(err.message || 'Errore nell\'aggiornamento dell\'accesso');
    } finally {
      setUpdatingOfferId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    
    try {
      setDeleting(true);
      await partnerService.deleteOrphanedUser(user.id);
      
      setShowDeleteConfirm(false);
      onClose();
      
      if (onUserDeleted) {
        onUserDeleted();
      }
    } catch (err: any) {
      setError(err.message || 'Errore nell\'eliminazione dell\'utente');
      setDeleting(false);
    }
  };

  if (!user) return null;

  const userName = user.profile ? `${user.profile.nome} ${user.profile.cognome}` : user.email;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔧 Gestione Utente Orfano"
      size="lg"
    >
      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* User info header */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{userName}</h3>
              <p className="text-sm text-gray-600 mt-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.884-.833-2.664 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Utente Orfano
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-2">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Management Actions */}
        <div className="space-y-6">
          {/* Offers section */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h4 className="text-base font-semibold text-gray-900">Gestione Offerte</h4>
                </div>
                {loading && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm text-blue-600">Caricamento...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              {offers.length > 0 ? (
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {offers.map((offer) => (
                    <div key={offer.id} className="group bg-gradient-to-r from-gray-50 to-blue-50 hover:from-blue-50 hover:to-indigo-50 border border-gray-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="text-sm font-semibold text-gray-900">{offer.name}</h5>
                            {offer.hasAccess && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Attivo
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-600">
                            <span className="flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              {offer.courseName}
                            </span>
                            <span className="flex items-center font-medium text-blue-600">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                              €{offer.totalAmount}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={offer.hasAccess ? 'outline' : 'primary'}
                          onClick={() => handleToggleOfferAccess(offer.id, offer.hasAccess)}
                          disabled={updatingOfferId === offer.id}
                          className={`flex-shrink-0 transition-all duration-200 ${
                            offer.hasAccess
                              ? 'border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                          }`}
                        >
                          {updatingOfferId === offer.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              {offer.hasAccess ? <XMarkIcon className="w-4 h-4" /> : <CheckIcon className="w-4 h-4" />}
                              <span className="font-medium">{offer.hasAccess ? 'Revoca' : 'Attiva'}</span>
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">Nessuna offerta disponibile</p>
                  <p className="text-xs text-gray-400 mt-1">Le offerte appariranno qui quando saranno create</p>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-red-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 bg-gradient-to-r from-red-50 to-pink-50">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.884-.833-2.664 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h4 className="text-base font-semibold text-red-900">Zona Pericolosa</h4>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <TrashIcon className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-semibold text-red-900 mb-2">Eliminazione Definitiva</h5>
                    <p className="text-sm text-red-700 mb-4">
                      Questa azione rimuoverà permanentemente l'utente e tutti i suoi dati dal sistema.
                      <strong className="block mt-1">⚠️ Operazione irreversibile</strong>
                    </p>
                    <div className="flex items-center space-x-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="border-red-300 text-red-700 hover:bg-red-100 hover:border-red-400 transition-all duration-200 font-medium"
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Elimina Utente
                      </Button>
                      <span className="text-xs text-red-500">Non potrà essere annullato</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tutte le modifiche vengono salvate automaticamente
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-gray-300 font-medium transition-all duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Chiudi
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => !deleting && setShowDeleteConfirm(false)}></div>

            <div className="relative inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all max-w-md w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Elimina Utente</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-700">
                      Stai per eliminare definitivamente <span className="font-semibold">{userName}</span> dal sistema.
                    </p>
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠️ Questa azione non può essere annullata e rimuoverà tutti i dati dell'utente.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 sm:flex-none"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Eliminando...
                    </div>
                  ) : (
                    'Elimina'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default OrphanedUserModal;