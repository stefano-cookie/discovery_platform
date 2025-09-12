import React, { useState, useEffect } from 'react';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';

interface ReactivateUserModalProps {
  user: PartnerUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Offer {
  id: string;
  name: string;
  price: number;
  offerType: string;
  course?: {
    name: string;
  };
}

const ReactivateUserModal: React.FC<ReactivateUserModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadOffers();
    }
  }, [isOpen, user]);

  const loadOffers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await partnerService.getOffers();
      setOffers(data.offers);
      
      if (data.offers.length > 0) {
        setSelectedOfferId(data.offers[0].id);
      }
    } catch (err: any) {
      setError('Errore nel caricamento delle offerte: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfferChange = (offerId: string) => {
    setSelectedOfferId(offerId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedOfferId) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await partnerService.grantUserOfferAccess(user.id, selectedOfferId);

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Errore nella concessione accesso: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dai Accesso a Offerta</h2>
              <p className="text-sm text-gray-600 mt-1">
                Rendi un'offerta disponibile per l'utente orfano
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Utente a cui dare accesso:</h3>
            <p className="text-sm text-gray-700">
              <span className="font-medium">Email:</span> {user.email}
            </p>
            {user.profile && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">Nome:</span> {user.profile.nome} {user.profile.cognome}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-amber-800 mb-1">Come funziona</h4>
                <p className="text-sm text-amber-700">
                  L'utente vedrà l'offerta disponibile nel suo account e potrà decidere se iscriversi. Non verrà creata automaticamente una registrazione.
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Caricamento offerte...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Offer Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Offerta da rendere disponibile *
                </label>
                <select
                  value={selectedOfferId}
                  onChange={(e) => handleOfferChange(e.target.value)}
                  required
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleziona un'offerta da rendere disponibile...</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.course?.name || offer.name} - €{offer.price} ({offer.offerType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedOfferId}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Concedendo accesso...
                    </>
                  ) : (
                    'Dai Accesso'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReactivateUserModal;