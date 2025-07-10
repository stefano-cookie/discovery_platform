import React, { useState } from 'react';
import { PartnerUser } from '../../types/partner';
import Button from '../UI/Button';

interface UserTableProps {
  users: PartnerUser[];
  isLoading: boolean;
  onFilterChange: (filter: 'all' | 'direct' | 'children') => void;
  currentFilter: 'all' | 'direct' | 'children';
}

const UserTable: React.FC<UserTableProps> = ({ 
  users, 
  isLoading, 
  onFilterChange, 
  currentFilter 
}) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Attesa' },
      DATA_VERIFIED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Dati Verificati' },
      CONTRACT_GENERATED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Contratto Generato' },
      CONTRACT_SIGNED: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Contratto Firmato' },
      ENROLLED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Iscritto' },
      COMPLETED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completato' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Caricamento utenti...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Gestione Utenti</h3>
          
          <div className="flex space-x-2">
            <select
              value={currentFilter}
              onChange={(e) => onFilterChange(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="all">Tutti gli Utenti</option>
              <option value="direct">Utenti Diretti</option>
              <option value="children">Da Partner Figli</option>
            </select>
            
            {selectedUsers.length > 0 && (
              <Button size="sm" variant="outline">
                Azioni su {selectedUsers.length} utenti
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(users.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                  checked={selectedUsers.length === users.length && users.length > 0}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Corso
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Partner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Iscrizione
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                    className="rounded border-gray-300"
                  />
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
                  {getStatusBadge(user.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.isDirectUser ? (
                    <span className="text-green-600 font-medium">Diretto</span>
                  ) : (
                    <span className="text-blue-600">Via: {user.partnerName}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">
                      Dettagli
                    </button>
                    {user.canManagePayments && (
                      <>
                        <button className="text-green-600 hover:text-green-900">
                          + Pagamento
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          Gestisci
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nessun utente trovato</p>
        </div>
      )}
    </div>
  );
};

export default UserTable;