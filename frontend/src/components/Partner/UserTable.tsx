import React, { useState } from 'react';
import { PartnerUser } from '../../types/partner';
import Button from '../UI/Button';

interface UserTableProps {
  users: PartnerUser[];
  isLoading: boolean;
  onFilterChange: (filter: 'all' | 'direct' | 'children') => void;
  currentFilter: 'all' | 'direct' | 'children';
  onNavigateToEnrollmentDetail?: (registrationId: string) => void;
}

const UserTable: React.FC<UserTableProps> = ({ 
  users, 
  isLoading, 
  onFilterChange, 
  currentFilter,
  onNavigateToEnrollmentDetail
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
            </select>
            
            {selectedUsers.length > 0 && (
              <Button size="sm" variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100">
                Azioni su {selectedUsers.length} utenti
              </Button>
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
                      setSelectedUsers(users.map(u => u.id));
                    } else {
                      setSelectedUsers([]);
                    }
                  }}
                  checked={selectedUsers.length === users.length && users.length > 0}
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
                🤝 Partner
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                📅 Data Iscrizione
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {users.map((user, index) => (
              <tr 
                key={user.id} 
                className={`hover:bg-blue-50/50 transition-colors duration-200 cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                }`}
                onClick={() => {
                  if (onNavigateToEnrollmentDetail) {
                    onNavigateToEnrollmentDetail(user.registrationId);
                  }
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                  <div>
                    <div className="font-medium text-gray-900">
                      {formatDate(user.enrollmentDate)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Registrato: {formatDate(user.createdAt)}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
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
    </div>
  );
};

export default UserTable;