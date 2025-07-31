import React, { useState, useEffect } from 'react';
import { partnerService } from '../../../services/partner';
import { PartnerUser } from '../../../types/partner';
import UserInfo from './UserInfo';
import EnrollmentFlow from './EnrollmentFlow';
import EnhancedDocumentsSection from './EnhancedDocumentsSection';
import OffersSection from './OffersSection';
import { getPartnerStatusDisplay } from '../../../utils/statusTranslations';

interface EnrollmentDetailProps {
  registrationId: string;
  onBackToUsers: () => void;
}

const EnrollmentDetail: React.FC<EnrollmentDetailProps> = ({ 
  registrationId, 
  onBackToUsers 
}) => {
  const [user, setUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserDetails();
  }, [registrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Per ora uso l'API esistente per ottenere tutti gli utenti
      // e filtro per registrationId - in futuro creeremo un endpoint dedicato
      const users = await partnerService.getUsers('all');
      const targetUser = users.find(u => u.registrationId === registrationId);
      
      if (!targetUser) {
        setError('Iscrizione non trovata');
        return;
      }
      
      setUser(targetUser);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento dei dettagli');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dettagli iscrizione...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBackToUsers}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Torna alla lista utenti
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBackToUsers}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Torna alla lista
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestisci Iscrizione
                </h1>
                <p className="text-sm text-gray-600">
                  {user.profile ? `${user.profile.nome} ${user.profile.cognome}` : user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                user.status === 'CONTRACT_GENERATED' ? 'bg-purple-100 text-purple-800' :
                user.status === 'CONTRACT_SIGNED' ? 'bg-indigo-100 text-indigo-800' :
                user.status === 'ENROLLED' ? 'bg-green-100 text-green-800' :
                user.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {user.status === 'PENDING' && 'In Attesa'}
                {user.status === 'CONTRACT_GENERATED' && 'Contratto Generato'}
                {user.status === 'CONTRACT_SIGNED' && 'Contratto Firmato'}
                {user.status === 'ENROLLED' && 'Attivo'}
                {user.status === 'COMPLETED' && 'Completato'}
                {!['PENDING', 'CONTRACT_GENERATED', 'CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(user.status) && getPartnerStatusDisplay(user.status)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Workflow Flow */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato Iscrizione</h2>
            <EnrollmentFlow status={user.status} registrationId={registrationId} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - User Info & Course */}
            <div className="lg:col-span-2 space-y-6">
              <UserInfo user={user} />
            </div>

            {/* Right Column - Documents & Actions */}
            <div className="space-y-6">
              <EnhancedDocumentsSection user={user} />
              <OffersSection user={user} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentDetail;