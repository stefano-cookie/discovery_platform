import React, { useState } from 'react';
import { PartnerUser } from '../../types/partner';
import Button from '../UI/Button';
import { partnerService } from '../../services/partner';
import { getStatusBadge } from '../../utils/statusTranslations';
import UserOffersModal from './UserOffersModal';
import OrphanedUserModal from './OrphanedUserModal';
import EditUserProfileModal from './EditUserProfileModal';

interface UserTableProps {
  users: PartnerUser[];
  isLoading: boolean;
  onFilterChange: (filter: 'all' | 'direct' | 'children' | 'orphaned') => void;
  currentFilter: 'all' | 'direct' | 'children' | 'orphaned';
  onNavigateToEnrollmentDetail?: (registrationId: string) => void;
  onRegistrationsUpdated?: () => void; // Callback per aggiornare la lista dopo eliminazione
}

const UserTable: React.FC<UserTableProps> = ({ 
  users, 
  isLoading, 
  onFilterChange, 
  currentFilter,
  onNavigateToEnrollmentDetail,
  onRegistrationsUpdated
}) => {
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState<{ count: number; registrations: any[] } | null>(null);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [userForOffers, setUserForOffers] = useState<PartnerUser | null>(null);
  const [showOrphanedModal, setShowOrphanedModal] = useState(false);
  const [orphanedUser, setOrphanedUser] = useState<PartnerUser | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userForEdit, setUserForEdit] = useState<PartnerUser | null>(null);


  const toggleRegistrationSelection = (registrationId: string) => {
    if (!registrationId) return; // Skip orphaned users
    setSelectedRegistrations(prev => 
      prev.includes(registrationId) 
        ? prev.filter(id => id !== registrationId)
        : [...prev, registrationId]
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };


  const handleDeleteRegistrations = async () => {
    if (selectedRegistrations.length === 0) return;
    
    // Salva info delle registrazioni prima dell'eliminazione per il messaggio di successo
    const registrationsInfo = getSelectedRegistrationsInfo();
    
    setIsDeleting(true);
    try {
      // Elimina tutte le registrazioni selezionate
      await Promise.all(
        selectedRegistrations.map(regId => 
          partnerService.deleteRegistration(regId)
        )
      );
      
      // Reset selezione
      setSelectedRegistrations([]);
      setShowDeleteConfirm(false);
      
      // Mostra messaggio di successo
      setDeleteSuccess({
        count: registrationsInfo.length,
        registrations: registrationsInfo
      });
      
      // Nascondi messaggio dopo 5 secondi
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 5000);
      
      // Aggiorna la lista
      if (onRegistrationsUpdated) {
        onRegistrationsUpdated();
      }
      
    } catch (error: any) {
      console.error('Errore eliminazione iscrizioni:', error);
      alert('Errore durante l\'eliminazione delle iscrizioni: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const getSelectedRegistrationsInfo = () => {
    return selectedRegistrations.map(regId => {
      const user = users.find(u => u.registrationId === regId);
      return user ? {
        registrationId: regId,
        userName: user.profile ? `${user.profile.nome} ${user.profile.cognome}` : user.email,
        course: user.course,
        status: user.status
      } : null;
    }).filter((info): info is NonNullable<typeof info> => info !== null);
  };


  const handleOffersUpdated = () => {
    setShowOffersModal(false);
    setUserForOffers(null);
    if (onRegistrationsUpdated) {
      onRegistrationsUpdated();
    }
  };

  const handleManageOrphanedUser = (user: PartnerUser) => {
    setOrphanedUser(user);
    setShowOrphanedModal(true);
  };

  const handleOrphanedUserUpdated = () => {
    setShowOrphanedModal(false);
    setOrphanedUser(null);
    if (onRegistrationsUpdated) {
      onRegistrationsUpdated();
    }
  };

  const handleOrphanedUserDeleted = () => {
    setShowOrphanedModal(false);
    setOrphanedUser(null);
    if (onRegistrationsUpdated) {
      onRegistrationsUpdated();
    }
  };

  const handleEditProfile = (user: PartnerUser) => {
    setUserForEdit(user);
    setShowEditProfileModal(true);
  };

  const handleProfileUpdated = () => {
    setShowEditProfileModal(false);
    setUserForEdit(null);
    if (onRegistrationsUpdated) {
      onRegistrationsUpdated();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-12 text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-pulse"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Caricamento utenti...</p>
          <p className="text-gray-400 text-sm mt-1">Preparazione dei dati in corso</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Gestione Utenti
          </h3>
          
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
            <select
              value={currentFilter}
              onChange={(e) => onFilterChange(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="all">Tutti gli Utenti</option>
              <option value="direct">Utenti Diretti</option>
              <option value="children">Da Partner Figli</option>
              <option value="orphaned">Utenti Orfani</option>
            </select>
            
            {selectedRegistrations.length > 0 && (
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Eliminando...' : `Elimina ${selectedRegistrations.length} iscrizioni`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRegistrations(Array.isArray(users) ? users.filter(u => u.registrationId && u.canDelete).map(u => u.registrationId!) : []);
                    } else {
                      setSelectedRegistrations([]);
                    }
                  }}
                  checked={Array.isArray(users) && selectedRegistrations.length === users.filter(u => u.registrationId && u.canDelete).length && users.filter(u => u.registrationId && u.canDelete).length > 0}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Utente
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Corso
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                📊 Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                🤝 Partner Responsabile
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                📅 Data Iscrizione
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                ⚡ Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {Array.isArray(users) ? users.map((user, index) => (
              <tr 
                key={user.registrationId} 
                className={`hover:bg-blue-50/50 transition-colors duration-200 ${
                  user.canManagePayments ? 'cursor-pointer' : 'cursor-default'
                } ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                }`}
                onClick={(e) => {
                  // Prevent navigation if clicking on checkbox or action buttons
                  if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                      (e.target as HTMLElement).closest('button')) {
                    return;
                  }
                  if (onNavigateToEnrollmentDetail && user.registrationId && user.canManagePayments) {
                    onNavigateToEnrollmentDetail(user.registrationId);
                  }
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {user.registrationId && user.canDelete ? (
                    <input
                      type="checkbox"
                      checked={selectedRegistrations.includes(user.registrationId)}
                      onChange={() => toggleRegistrationSelection(user.registrationId!)}
                      className="rounded border-gray-300"
                    />
                  ) : (
                    <div className="w-4 h-4"></div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {user.profile ? `${user.profile.nome} ${user.profile.cognome}` : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    {user.profile && (
                      <div className="text-xs text-gray-400">{user.profile.telefono}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.course}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(user.status).className}`}>
                    {getStatusBadge(user.status).label}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.isDirectUser ? (
                    <div>
                      <span className="text-green-600 font-medium">{user.requestedByEmployee || user.partnerName || 'Diretto'}</span>
                      <div className="text-xs text-gray-500">(Iscrizione diretta)</div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-blue-600 font-medium">
                        {user.requestedByEmployee || user.partnerName}
                      </span>
                      <div className="text-xs text-gray-500">(Da sub-partner)</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <div className="font-medium text-gray-900">
                      {user.enrollmentDate ? formatDate(user.enrollmentDate) : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Registrato: {formatDate(user.createdAt)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {user.isOrphaned ? (
                      <button
                        onClick={() => handleManageOrphanedUser(user)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                        </svg>
                        Gestisci
                      </button>
                    ) : null}
                    {user.profile && (
                      <button
                        onClick={() => handleEditProfile(user)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        title="Modifica anagrafica"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Modifica
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                  Errore nel caricamento dei dati utenti
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {Array.isArray(users) && users.length === 0 && (
        <div className="text-center py-16">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">Nessun utente trovato</p>
            <p className="text-gray-400 text-sm">I tuoi utenti registrati appariranno qui</p>
          </div>
        </div>
      )}

      {/* Modale di conferma eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => !isDeleting && setShowDeleteConfirm(false)}></div>

            <div className="relative inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full">
              <div className="bg-white px-6 pt-6 pb-4">
                <div className="text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.884-.833-2.664 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg leading-6 font-semibold text-gray-900 mb-2">
                    Conferma eliminazione
                  </h3>
                  <div className="text-left">
                    <p className="text-sm text-gray-600 mb-3">
                      Stai per eliminare {selectedRegistrations.length} iscrizioni:
                    </p>
                    <div className="max-h-32 overflow-y-auto mb-4 bg-gray-50 rounded-lg p-3">
                      {getSelectedRegistrationsInfo().map((info) => (
                        <div key={info.registrationId} className="text-sm py-1 border-b border-gray-200 last:border-b-0">
                          <span className="font-medium text-gray-900">{info.userName}</span>
                          <span className="text-gray-500"> - {info.course} ({info.status})</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700 font-medium">
                        ⚠️ Questa azione eliminerà definitivamente le iscrizioni, inclusi pagamenti e documenti correlati. I profili utente rimarranno intatti.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none"
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleDeleteRegistrations}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? (
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

      {/* Messaggio di successo eliminazione */}
      {deleteSuccess && (
        <div className="fixed top-4 right-4 z-60 max-w-md">
          <div className="bg-white rounded-lg shadow-xl border-l-4 border-green-500 p-4 animate-slide-in-right">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {deleteSuccess.count === 1 ? 'Iscrizione eliminata' : 'Iscrizioni eliminate'}
                  </h3>
                  <button
                    onClick={() => setDeleteSuccess(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mt-2 text-sm text-gray-700">
                  {deleteSuccess.count === 1 ? (
                    <div>
                      <span className="font-medium">{deleteSuccess.registrations[0]?.userName}</span>
                      <br />
                      <span className="text-gray-500">{deleteSuccess.registrations[0]?.course}</span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium mb-1">{deleteSuccess.count} iscrizioni eliminate:</p>
                      <div className="space-y-1">
                        {deleteSuccess.registrations.slice(0, 3).map((reg, index) => (
                          <div key={index} className="text-xs bg-gray-50 rounded px-2 py-1">
                            <span className="font-medium">{reg.userName}</span> - {reg.course}
                          </div>
                        ))}
                        {deleteSuccess.registrations.length > 3 && (
                          <div className="text-xs text-gray-500">
                            ...e altre {deleteSuccess.registrations.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Progress bar per auto-dismiss */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-1">
              <div className="bg-green-500 h-1 rounded-full animate-shrink-width"></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestione offerte utente */}
      <UserOffersModal
        user={userForOffers}
        isOpen={showOffersModal}
        onClose={() => setShowOffersModal(false)}
        onOffersUpdated={handleOffersUpdated}
      />

      {/* Modal gestione utenti orfani */}
      <OrphanedUserModal
        user={orphanedUser}
        isOpen={showOrphanedModal}
        onClose={() => setShowOrphanedModal(false)}
        onUserUpdated={handleOrphanedUserUpdated}
        onUserDeleted={handleOrphanedUserDeleted}
      />

      {/* Modal modifica anagrafica */}
      {showEditProfileModal && userForEdit && (
        <EditUserProfileModal
          user={userForEdit}
          onClose={() => setShowEditProfileModal(false)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
};

export default UserTable;