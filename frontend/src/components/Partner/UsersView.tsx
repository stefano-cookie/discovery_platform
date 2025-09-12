import React, { useState, useEffect } from 'react';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import UserTable from './UserTable';
import { usePartnerAuth } from '../../hooks/usePartnerAuth';
import subPartnerApi, { SubPartner } from '../../services/subPartnerApi';

interface UsersViewProps {
  onNavigateToEnrollmentDetail?: (registrationId: string) => void;
}

const UsersView: React.FC<UsersViewProps> = ({ onNavigateToEnrollmentDetail }) => {
  const { partnerCompany } = usePartnerAuth();
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'direct' | 'children' | 'orphaned'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsersStats, setAllUsersStats] = useState({ all: 0, direct: 0, children: 0, orphaned: 0 });
  const [subPartners, setSubPartners] = useState<SubPartner[]>([]);
  const [selectedSubPartner, setSelectedSubPartner] = useState<string>('');
  
  const isSubPartner = partnerCompany?.parentId != null;

  const fetchUsers = async (filter: 'all' | 'direct' | 'children' | 'orphaned' = 'all') => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await partnerService.getUsers(filter, selectedSubPartner || undefined);
      setUsers(data.users);
      
      // Se è 'all', aggiorna anche le statistiche
      if (filter === 'all') {
        const stats = {
          all: data.users.length,
          direct: data.users.filter(u => u.isDirectUser && !u.isOrphaned).length,
          children: data.users.filter(u => !u.isDirectUser && !u.isOrphaned).length,
          orphaned: data.users.filter(u => u.isOrphaned).length
        };
        setAllUsersStats(stats);
      }
    } catch (err: any) {
      setUsersError(err.response?.data?.error || 'Errore nel caricamento utenti');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentFilter);
  }, [currentFilter, selectedSubPartner]);

  // Carica la lista dei sub-partner per i partner parent
  useEffect(() => {
    const loadSubPartners = async () => {
      if (!isSubPartner) {
        try {
          const subPartnersData = await subPartnerApi.getSubPartners();
          setSubPartners(subPartnersData);
        } catch (err) {
          console.error('Error loading sub-partners:', err);
        }
      }
    };
    loadSubPartners();
  }, [isSubPartner]);

  // Carica le statistiche totali all'inizio
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await partnerService.getUsers('all');
        const stats = {
          all: data.users.length,
          direct: data.users.filter(u => u.isDirectUser && !u.isOrphaned).length,
          children: data.users.filter(u => !u.isDirectUser && !u.isOrphaned).length,
          orphaned: data.users.filter(u => u.isOrphaned).length
        };
        setAllUsersStats(stats);
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };
    loadStats();
  }, []);

  // Listen for refresh events from certification steps updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('UsersView received refresh event, reloading users');
      fetchUsers(currentFilter);
    };

    window.addEventListener('refreshRegistrations', handleRefresh);
    window.addEventListener('refreshCertificationSteps', handleRefresh);
    window.addEventListener('userStatusUpdated', handleRefresh);
    
    return () => {
      window.removeEventListener('refreshRegistrations', handleRefresh);
      window.removeEventListener('refreshCertificationSteps', handleRefresh);
      window.removeEventListener('userStatusUpdated', handleRefresh);
    };
  }, [currentFilter]);

  const handleFilterChange = async (filter: 'all' | 'direct' | 'children' | 'orphaned') => {
    setCurrentFilter(filter);
    
    // Aggiorna sempre le statistiche quando cambi filtro
    try {
      const data = await partnerService.getUsers('all');
      const stats = {
        all: data.users.length,
        direct: data.users.filter(u => u.isDirectUser && !u.isOrphaned).length,
        children: data.users.filter(u => !u.isDirectUser && !u.isOrphaned).length,
        orphaned: data.users.filter(u => u.isOrphaned).length
      };
      setAllUsersStats(stats);
      console.log('Updated stats:', stats);
    } catch (err) {
      console.error('Error updating stats:', err);
    }
  };

  const filteredUsers = (users || []).filter(user => {
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

  // Usa le statistiche salvate invece di calcolarle sui dati filtrati
  const stats = allUsersStats;

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
      <div className={`grid grid-cols-1 gap-4 ${isSubPartner ? 'sm:grid-cols-1' : 'sm:grid-cols-4'}`}>
        <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
          currentFilter === 'all' 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`} onClick={() => handleFilterChange('all')}>
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

        {!isSubPartner && (
          <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
            currentFilter === 'direct' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`} onClick={() => handleFilterChange('direct')}>
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
        )}

        {!isSubPartner && (
          <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
            currentFilter === 'children' 
              ? 'border-purple-500 bg-purple-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`} onClick={() => handleFilterChange('children')}>
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
        )}

        {!isSubPartner && (
          <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
            currentFilter === 'orphaned' 
              ? 'border-orange-500 bg-orange-50' 
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`} onClick={() => handleFilterChange('orphaned')}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Utenti Orfani</p>
                <p className="text-2xl font-bold text-gray-900">{stats.orphaned}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div>
        )}
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
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-3 lg:space-y-0 lg:space-x-6">
            {/* Sub-Partner Filter (solo per parent companies) */}
            {!isSubPartner && subPartners.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">Sub-Partner:</span>
                <select
                  value={selectedSubPartner}
                  onChange={(e) => setSelectedSubPartner(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tutti i sub-partner</option>
                  {subPartners.map((subPartner) => (
                    <option key={subPartner.id} value={subPartner.id}>
                      {subPartner.name} ({subPartner.stats.totalRegistrations})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">Filtro:</span>
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'all', label: 'Tutti', count: stats.all },
                  { id: 'direct', label: 'Diretti', count: stats.direct },
                  // Hide "Figli" filter for sub-partners as they can't have children
                  ...(isSubPartner ? [] : [{ id: 'children', label: 'Figli', count: stats.children }]),
                  { id: 'orphaned', label: 'Orfani', count: stats.orphaned }
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
        </div>

        {(searchTerm || selectedSubPartner) && (
          <div className="mt-4 space-y-2">
            {searchTerm && (
              <div className="text-sm text-gray-600">
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
            {selectedSubPartner && (
              <div className="text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                Filtrando per sub-partner: {subPartners.find(sp => sp.id === selectedSubPartner)?.name}
                <button
                  onClick={() => setSelectedSubPartner('')}
                  className="ml-2 text-blue-700 hover:text-blue-800 font-medium"
                >
                  Rimuovi filtro
                </button>
              </div>
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
        onNavigateToEnrollmentDetail={onNavigateToEnrollmentDetail}
        onRegistrationsUpdated={() => fetchUsers(currentFilter)}
      />
    </div>
  );
};

export default UsersView;