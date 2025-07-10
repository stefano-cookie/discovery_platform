import React, { useState, useEffect } from 'react';
import { usePartnerStats } from '../../hooks/usePartnerStats';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import StatsCard from './StatsCard';

const DashboardView: React.FC = () => {
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = usePartnerStats();
  const [recentUsers, setRecentUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const fetchRecentUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await partnerService.getUsers('all');
      setRecentUsers(data.slice(0, 5)); // Solo ultimi 5 utenti
    } catch (err) {
      console.error('Error fetching recent users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentUsers();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  if (statsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Errore</h3>
          <p className="text-sm text-red-700 mt-1">{statsError}</p>
          <button 
            onClick={refetchStats}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Benvenuto nella tua Dashboard! 👋</h1>
            <p className="text-blue-100 text-lg">
              Monitora le tue performance e gestisci i tuoi clienti in tempo reale
            </p>
          </div>
          <div className="mt-6 lg:mt-0">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Sistema Online</span>
              </div>
              <p className="text-xs text-blue-100 mt-1">
                Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Attività Recenti
            </h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Vedi tutto →
            </button>
          </div>
          
          {usersLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentUsers.length > 0 ? (
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">
                      {user.profile ? user.profile.nome.charAt(0) : user.email.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.profile ? `${user.profile.nome} ${user.profile.cognome}` : user.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Registrato il {formatDate(user.createdAt)}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {user.status === 'PENDING' && '⏳'}
                    {user.status === 'ENROLLED' && '✅'}
                    {user.status === 'COMPLETED' && '🎓'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Nessuna attività recente</p>
              <p className="text-gray-400 text-sm mt-1">Le attività dei tuoi utenti appariranno qui</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Azioni Rapide
          </h2>
          
          <div className="space-y-4">
            <button className="w-full group relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <div className="relative flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Nuovo Utente</span>
              </div>
            </button>
            
            <button className="w-full group relative overflow-hidden bg-white border border-gray-200 text-gray-700 p-4 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-gray-300">
              <div className="absolute inset-0 bg-gray-50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <div className="relative flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4M8 7v4a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
                </svg>
                <span>Esporta Dati</span>
              </div>
            </button>
            
            <button className="w-full group relative overflow-hidden bg-white border border-gray-200 text-gray-700 p-4 rounded-xl font-medium shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-gray-300">
              <div className="absolute inset-0 bg-gray-50 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <div className="relative flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Genera Report</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;