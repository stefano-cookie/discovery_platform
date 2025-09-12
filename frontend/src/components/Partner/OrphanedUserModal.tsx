import React, { useState, useEffect, useCallback } from 'react';
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
        await partnerService.grantUserOfferAccess(user.id, offerId);
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
      title={`Gestisci ${userName}`}
      size="lg"
    >
      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* User info */}
        <div className="text-center py-2">
          <p className="text-sm text-gray-600">
            Utente senza iscrizioni attive • {user.email}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* Offers section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Offerte Disponibili</h4>
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>}
            </div>
            
            {offers.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-medium text-gray-900">{offer.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{offer.courseName} • €{offer.totalAmount}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={offer.hasAccess ? 'outline' : 'primary'}
                      onClick={() => handleToggleOfferAccess(offer.id, offer.hasAccess)}
                      disabled={updatingOfferId === offer.id}
                      className={`flex-shrink-0 ${offer.hasAccess ? 'border-red-200 text-red-700 hover:bg-red-50' : ''}`}
                    >
                      {updatingOfferId === offer.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                      ) : (
                        <>
                          {offer.hasAccess ? <XMarkIcon className="w-3 h-3 mr-1" /> : <CheckIcon className="w-3 h-3 mr-1" />}
                          {offer.hasAccess ? 'Revoca' : 'Attiva'}
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nessuna offerta disponibile</p>
            )}
          </div>

          {/* Delete section */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <h4 className="text-sm font-medium text-red-800">Elimina utente</h4>
                <p className="text-xs text-red-600 mt-1">Elimina definitivamente questo utente dal sistema</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-shrink-0 border-red-300 text-red-700 hover:bg-red-100"
              >
                <TrashIcon className="w-4 h-4 mr-2" />
                Elimina
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </div>

      {/* Simple Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-500 opacity-75" onClick={() => !deleting && setShowDeleteConfirm(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-md w-full">
              <div className="bg-white px-4 pt-5 pb-4">
                <div className="text-center">
                  <TrashIcon className="mx-auto h-8 w-8 text-red-600 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Elimina Utente</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Eliminare definitivamente <span className="font-medium">{userName}</span>?
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="flex-1"
                    >
                      Annulla
                    </Button>
                    <Button
                      onClick={handleDeleteUser}
                      disabled={deleting}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {deleting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        'Elimina'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default OrphanedUserModal;