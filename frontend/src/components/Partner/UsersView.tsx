import React, { useState, useEffect } from 'react';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import UserTable from './UserTable';

const UsersView: React.FC = () => {
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'direct' | 'children'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async (filter: 'all' | 'direct' | 'children' = 'all') => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await partnerService.getUsers(filter);
      setUsers(data);
    } catch (err: any) {
      setUsersError(err.response?.data?.error || 'Errore nel caricamento utenti');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentFilter);
  }, [currentFilter]);

  const handleFilterChange = (filter: 'all' | 'direct' | 'children') => {
    setCurrentFilter(filter);
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.profile && 
        (`${user.profile.nome} ${user.profile.cognome}`.toLowerCase().includes(searchLower) ||
         user.profile.telefono.includes(searchTerm) ||
         user.profile.codiceFiscale.toLowerCase().includes(searchLower)))
    );
  });

  const getFilterStats = () => {
    return {
      all: users.length,
      direct: users.filter(u => u.isDirectUser).length,
      children: users.filter(u => !u.isDirectUser).length
    };
  };

  const stats = getFilterStats();

  if (usersError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Errore</h3>
          <p className="text-sm text-red-700 mt-1">{usersError}</p>
          <button 
            onClick={() => fetchUsers(currentFilter)}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestione Utenti</h1>
            <p className="text-gray-600">
              Monitora e gestisci tutti i tuoi utenti registrati
            </p>
          </div>
          <div className="mt-4 lg:mt-0 flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Aggiornato in tempo reale</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border-2 transition-colors ${
          currentFilter === 'all' 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tutti gli Utenti</p>
              <p className="text-2xl font-bold text-gray-900">{stats.all}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border-2 transition-colors ${
          currentFilter === 'direct' 
            ? 'border-green-500 bg-green-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Utenti Diretti</p>
              <p className="text-2xl font-bold text-gray-900">{stats.direct}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border-2 transition-colors ${
          currentFilter === 'children' 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Da Partner Figli</p>
              <p className="text-2xl font-bold text-gray-900">{stats.children}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cerca per nome, email, telefono o codice fiscale..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">Filtro:</span>
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { id: 'all', label: 'Tutti', count: stats.all },
                { id: 'direct', label: 'Diretti', count: stats.direct },
                { id: 'children', label: 'Figli', count: stats.children }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => handleFilterChange(filter.id as any)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentFilter === filter.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        {searchTerm && (
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredUsers.length} di {users.length} utenti per "{searchTerm}"
            {filteredUsers.length !== users.length && (
              <button
                onClick={() => setSearchTerm('')}
                className="ml-2 text-blue-600 hover:text-blue-700"
              >
                Cancella ricerca
              </button>
            )}
          </div>
        )}
      </div>

      {/* Users Table */}
      <UserTable
        users={filteredUsers}
        isLoading={usersLoading}
        onFilterChange={handleFilterChange}
        currentFilter={currentFilter}
      />
    </div>
  );
};

export default UsersView;