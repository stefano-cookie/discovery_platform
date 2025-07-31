import React, { useState } from 'react';
import { PartnerUser } from '../../../types/partner';
import UserOffersModal from '../UserOffersModal';

interface OffersSectionProps {
  user: PartnerUser;
}

const OffersSection: React.FC<OffersSectionProps> = ({ user }) => {
  const [isOffersModalOpen, setIsOffersModalOpen] = useState(false);

  const handleManageOffers = () => {
    setIsOffersModalOpen(true);
  };

  const handleCloseOffersModal = () => {
    setIsOffersModalOpen(false);
  };

  const handleOffersUpdated = () => {
    // In futuro: aggiornare i dati dell'utente localmente
    console.log('Offers updated for user:', user.id);
  };

  return (
    <>
      {/* Gestione Offerte */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Gestione Offerte</h3>
              <p className="text-sm text-gray-600">Configura l'accesso ai corsi per questo utente</p>
            </div>
          </div>

          <button
            onClick={handleManageOffers}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Gestisci Accessi
          </button>
        </div>

        {/* Informazioni Attuali */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Corso Principale</p>
                <p className="text-xs text-gray-600">{user.course || 'Non specificato'}</p>
              </div>
            </div>
            <div className="flex items-center text-green-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium">Attivo</span>
            </div>
          </div>

          {/* Placeholder per offerte aggiuntive */}
          <div className="text-center py-4">
            <div className="text-sm text-gray-500 mb-2">Offerte Aggiuntive</div>
            <div className="text-xs text-gray-400">
              Utilizza "Gestisci Accessi" per configurare l'accesso a corsi aggiuntivi
            </div>
          </div>
        </div>

        {/* Note Utili */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Gestione Offerte</p>
              <p className="text-xs text-blue-700 mt-1">
                Puoi aggiungere l'accesso a nuovi corsi o rimuovere quelli esistenti. 
                Le modifiche si rifletteranno immediatamente nell'area riservata dell'utente.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Gestione Offerte */}
      <UserOffersModal
        isOpen={isOffersModalOpen}
        onClose={handleCloseOffersModal}
        user={user}
        onOffersUpdated={handleOffersUpdated}
      />
    </>
  );
};

export default OffersSection;