import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import SuccessModal from '../UI/SuccessModal';
import ErrorModal from '../UI/ErrorModal';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'PARTNER' | 'USER';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  assignedPartnerId?: string;
  assignedPartner?: {
    id: string;
    referralCode: string;
    user: {
      email: string;
    };
  };
  profile?: {
    nome: string;
    cognome: string;
  };
  _count?: {
    registrations: number;
  };
}

interface Partner {
  id: string;
  referralCode: string;
  user: {
    email: string;
  };
}

interface UserTransfer {
  id: string;
  userId: string;
  fromPartnerId: string;
  toPartnerId: string;
  reason: string;
  transferredAt: string;
  transferredBy: string;
  user: {
    email: string;
    profile?: {
      nome: string;
      cognome: string;
    };
  };
  fromPartner: {
    referralCode: string;
    user: {
      email: string;
    };
  };
  toPartner: {
    referralCode: string;
    user: {
      email: string;
    };
  };
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transfers, setTransfers] = useState<UserTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'transfers' | 'export'>('users');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transferForm, setTransferForm] = useState({
    toPartnerId: '',
    reason: ''
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, partnersData, transfersData] = await Promise.all([
        apiRequest<User[]>({
          method: 'GET',
          url: '/admin/users'
        }).catch(() => []), // Mock empty array if endpoint doesn't exist
        apiRequest<Partner[]>({
          method: 'GET',
          url: '/admin/partners'
        }).catch(() => []), // Mock empty array if endpoint doesn't exist
        apiRequest<UserTransfer[]>({
          method: 'GET',
          url: '/admin/user-transfers'
        }).catch(() => []) // Mock empty array if endpoint doesn't exist
      ]);

      setUsers(usersData);
      setPartners(partnersData);
      setTransfers(transfersData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferUser = async () => {
    if (!selectedUser || !transferForm.toPartnerId || !transferForm.reason) return;

    try {
      await apiRequest({
        method: 'POST',
        url: '/admin/transfer-user',
        data: {
          userId: selectedUser.id,
          toPartnerId: transferForm.toPartnerId,
          reason: transferForm.reason
        }
      });

      await loadData();
      setShowTransferModal(false);
      setSelectedUser(null);
      setTransferForm({ toPartnerId: '', reason: '' });
      alert('Utente trasferito con successo!');
    } catch (error) {
      console.error('Error transferring user:', error);
      alert('Errore durante il trasferimento utente.');
    }
  };

  const handleExportRegistrations = async () => {
    setExportLoading(true);
    try {
      const response = await fetch('/api/admin/export/registrations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `registrazioni_export_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error exporting registrations:', error);
      setErrorMessage('Errore durante l\'export. Riprova più tardi.');
      setShowErrorModal(true);
    } finally {
      setExportLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      ADMIN: { label: 'Admin', color: 'bg-red-100 text-red-800' },
      PARTNER: { label: 'Partner', color: 'bg-blue-100 text-blue-800' },
      USER: { label: 'Utente', color: 'bg-green-100 text-green-800' }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.USER;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
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
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestione Utenti</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'users', label: 'Utenti' },
            { id: 'transfers', label: 'Trasferimenti' },
            { id: 'export', label: 'Export' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {users.filter(u => u.role === 'USER').map((user) => (
              <li key={user.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.profile?.nome?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {user.profile ? `${user.profile.nome} ${user.profile.cognome}` : user.email}
                        </p>
                        {getRoleBadge(user.role)}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.emailVerified ? 'Verificato' : 'Non verificato'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Iscrizioni: {user._count?.registrations || 0}</span>
                        <span>Registrato: {new Date(user.createdAt).toLocaleDateString('it-IT')}</span>
                        {user.assignedPartner && (
                          <span>Partner: {user.assignedPartner.referralCode}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {user.assignedPartner && (
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowTransferModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Trasferisci
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {users.filter(u => u.role === 'USER').length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nessun utente registrato.</p>
            </div>
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === 'transfers' && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transfer.user.profile ? 
                        `${transfer.user.profile.nome} ${transfer.user.profile.cognome}` : 
                        transfer.user.email
                      }
                    </p>
                    <p className="text-sm text-gray-600">
                      Da <span className="font-medium">{transfer.fromPartner.referralCode}</span> a{' '}
                      <span className="font-medium">{transfer.toPartner.referralCode}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Motivo: {transfer.reason}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {new Date(transfer.transferredAt).toLocaleDateString('it-IT')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transfer.transferredAt).toLocaleTimeString('it-IT')}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {transfers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nessun trasferimento effettuato.</p>
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Export Dati Registrazioni
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Scarica un file Excel contenente tutte le registrazioni con dati anagrafici completi,
              dettagli dei corsi, stato dei pagamenti e informazioni sui partner.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Il file Excel include:
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Dati anagrafici completi (nome, cognome, codice fiscale, residenza)</li>
                <li>• Informazioni corso e offerta selezionata</li>
                <li>• Stato pagamenti con importi e scadenze</li>
                <li>• Dettagli partner assegnato</li>
                <li>• Stato registrazione e date</li>
              </ul>
            </div>

            <button
              onClick={handleExportRegistrations}
              disabled={exportLoading}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {exportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generando Excel...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Scarica Excel Registrazioni</span>
                </>
              )}
            </button>

            <div className="mt-6 text-xs text-gray-500">
              <p>
                <strong>Nota:</strong> Il download potrebbe richiedere alcuni secondi a seconda
                del numero di registrazioni presenti nel sistema.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Export Completato!"
        message="Il file Excel è stato scaricato con successo"
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Errore Export"
        message={errorMessage}
      />

      {/* Transfer Modal */}
      {showTransferModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Trasferisci Utente</h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Utente da trasferire:</p>
              <p className="font-medium">
                {selectedUser.profile ? 
                  `${selectedUser.profile.nome} ${selectedUser.profile.cognome}` : 
                  selectedUser.email
                }
              </p>
              <p className="text-sm text-gray-500">
                Partner attuale: {selectedUser.assignedPartner?.referralCode}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuovo Partner
              </label>
              <select
                value={transferForm.toPartnerId}
                onChange={(e) => setTransferForm({ ...transferForm, toPartnerId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Seleziona partner...</option>
                {partners
                  .filter(p => p.id !== selectedUser.assignedPartnerId)
                  .map(partner => (
                    <option key={partner.id} value={partner.id}>
                      {partner.referralCode} - {partner.user.email}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del trasferimento
              </label>
              <textarea
                value={transferForm.reason}
                onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Inserisci il motivo del trasferimento..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedUser(null);
                  setTransferForm({ toPartnerId: '', reason: '' });
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleTransferUser}
                disabled={!transferForm.toPartnerId || !transferForm.reason}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Trasferisci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;