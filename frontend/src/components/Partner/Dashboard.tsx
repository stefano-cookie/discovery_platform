import React, { useState, useEffect } from 'react';
import { usePartnerStats } from '../../hooks/usePartnerStats';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import StatsCard from './StatsCard';
import UserTable from './UserTable';

const PartnerDashboard: React.FC = () => {
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = usePartnerStats();
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'direct' | 'children'>('all');

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (statsError || usersError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Errore</h3>
          <p className="text-sm text-red-700 mt-1">
            {statsError || usersError}
          </p>
          <button 
            onClick={() => {
              refetchStats();
              fetchUsers(currentFilter);
            }}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Partner</h1>
        <p className="text-gray-600 mt-1">Gestisci i tuoi utenti e monitora le performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Utenti Totali"
          value={statsLoading ? '...' : stats?.totalUsers || 0}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Utenti Diretti"
          value={statsLoading ? '...' : stats?.directUsers || 0}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        <StatsCard
          title="Ricavi Mensili"
          value={statsLoading ? '...' : formatCurrency(stats?.monthlyRevenue || 0)}
          color="yellow"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          }
        />

        <StatsCard
          title="Commissioni Pending"
          value={statsLoading ? '...' : formatCurrency(stats?.pendingCommissions || 0)}
          color="red"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Azioni Rapide</h2>
        <div className="flex flex-wrap gap-4">
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuovo Utente
          </button>
          
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4M8 7v4a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
            </svg>
            Esporta Dati
          </button>
          
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Genera Report
          </button>
        </div>
      </div>

      {/* Users Table */}
      <UserTable
        users={users}
        isLoading={usersLoading}
        onFilterChange={handleFilterChange}
        currentFilter={currentFilter}
      />
    </div>
  );
};

export default PartnerDashboard;