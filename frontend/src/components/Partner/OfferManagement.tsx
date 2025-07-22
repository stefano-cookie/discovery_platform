import React, { useState, useEffect } from 'react';
import { PartnerOffer, Course } from '../../types/offers';
import { OfferService } from '../../services/offerService';
import apiClient from '../../services/api';
import CreateOfferModal from './CreateOfferModal';
import EditOfferModal from './EditOfferModal';
import CopiedModal from '../UI/CopiedModal';
import OfferVisibilityModal from './OfferVisibilityModal';

const OfferManagement: React.FC = () => {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<PartnerOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCopiedModal, setShowCopiedModal] = useState(false);
  const [visibilityOffer, setVisibilityOffer] = useState<PartnerOffer | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [offersData, coursesData] = await Promise.all([
        OfferService.getOffers(),
        apiClient.get('/courses').then(res => res.data).catch(() => [])
      ]);
      setOffers(offersData);
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (offerData: any) => {
    try {
      await OfferService.createOffer(offerData);
      await loadData();
      setShowCreateModal(false);
      setError(null); // Clear any previous errors
      setSuccessMessage('Offerta creata con successo!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      console.error('Error creating offer:', error);
      let errorMessage = 'Errore nella creazione dell\'offerta';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleUpdateOffer = async (id: string, offerData: any) => {
    try {
      await OfferService.updateOffer(id, offerData);
      await loadData();
      setEditingOffer(null);
    } catch (error) {
      console.error('Error updating offer:', error);
      setError('Errore nell\'aggiornamento dell\'offerta');
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa offerta?')) {
      return;
    }

    try {
      await OfferService.deleteOffer(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting offer:', error);
      setError('Errore nell\'eliminazione dell\'offerta');
    }
  };

  const toggleOfferStatus = async (offer: PartnerOffer) => {
    try {
      await OfferService.updateOffer(offer.id, { isActive: !offer.isActive });
      await loadData();
    } catch (error) {
      console.error('Error toggling offer status:', error);
      setError('Errore nel cambio stato offerta');
    }
  };

  const copyReferralLink = (referralLink: string) => {
    const url = `${window.location.origin}/registration/${referralLink}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedModal(true);
      setTimeout(() => setShowCopiedModal(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestione Offerte</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nuova Offerta
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Offerta
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prezzo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registrazioni
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stato
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Link
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {offers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  Nessuna offerta creata
                </td>
              </tr>
            ) : (
              offers.map((offer) => (
                <tr key={offer.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{offer.name}</div>
                      <div className="text-sm text-gray-500">{offer.course?.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      offer.offerType === 'TFA_ROMANIA' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {offer.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{offer.totalAmount.toLocaleString('it-IT')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer.installments} rate
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {offer._count?.registrations || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleOfferStatus(offer)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        offer.isActive 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {offer.isActive ? 'Attiva' : 'Inattiva'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => copyReferralLink(offer.referralLink)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Copia link referral"
                    >
                      {offer.referralLink}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col space-y-1">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingOffer(offer)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => setVisibilityOffer(offer)}
                          className="text-green-600 hover:text-green-900"
                          title="Gestisci visibilità utenti"
                        >
                          Visibilità
                        </button>
                      </div>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="text-red-600 hover:text-red-900 text-left"
                        disabled={(offer._count?.registrations || 0) > 0}
                      >
                        Elimina
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateOfferModal
          courses={courses}
          onSave={handleCreateOffer}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingOffer && (
        <EditOfferModal
          offer={editingOffer}
          courses={courses}
          onSave={(data) => handleUpdateOffer(editingOffer.id, data)}
          onClose={() => setEditingOffer(null)}
        />
      )}

      <CopiedModal
        isOpen={showCopiedModal}
        onClose={() => setShowCopiedModal(false)}
        title="Link Offerta Copiato!"
        message="Il link dell'offerta è stato copiato negli appunti"
      />

      {visibilityOffer && (
        <OfferVisibilityModal
          isOpen={!!visibilityOffer}
          onClose={() => setVisibilityOffer(null)}
          offerId={visibilityOffer.id}
          offerName={visibilityOffer.name}
        />
      )}
    </div>
  );
};

export default OfferManagement;