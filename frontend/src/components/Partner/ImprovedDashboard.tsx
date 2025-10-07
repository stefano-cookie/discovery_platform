import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerAuth } from '../../hooks/usePartnerAuth';
import { usePartnerStats } from '../../hooks/usePartnerStats';
import { usePartnerAnalytics } from '../../hooks/usePartnerAnalytics';
import { useRealtimeRegistration } from '../../hooks/useRealtimeRegistration';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import StatsCard from './StatsCard';
import UserTable from './UserTable';
import RevenueChart from './RevenueChart';
import UserGrowthChart from './UserGrowthChart';
import QuickMetrics from './QuickMetrics';
import PriorityAlerts from './PriorityAlerts';
import SuccessModal from '../UI/SuccessModal';
import ErrorModal from '../UI/ErrorModal';
import RealtimeToast from '../UI/RealtimeToast';

const ImprovedPartnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { partnerEmployee } = usePartnerAuth();
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = usePartnerStats();
  const { analytics, isLoading: analyticsLoading, error: analyticsError } = usePartnerAnalytics();
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'direct' | 'children' | 'orphaned'>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [realtimeToast, setRealtimeToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Real-time updates
  const { refreshTrigger } = useRealtimeRegistration(
    // onStatusChange
    (payload) => {
      console.log('🔄 Real-time status change:', payload);
      setRealtimeToast({
        message: `${payload.userEmail} - Stato aggiornato: ${payload.newStatus}`,
        type: 'info',
      });
      fetchUsers(currentFilter);
      refetchStats();
    },
    // onPaymentUpdate
    (payload) => {
      console.log('💰 Real-time payment update:', payload);
      setRealtimeToast({
        message: `Pagamento rata ${payload.deadlineNumber} - €${payload.amount.toFixed(2)}`,
        type: 'success',
      });
      fetchUsers(currentFilter);
      refetchStats();
    },
    // onDocumentUpload
    (payload) => {
      console.log('📄 Real-time document upload:', payload);
      setRealtimeToast({
        message: `Nuovo documento caricato: ${payload.type}`,
        type: 'info',
      });
      fetchUsers(currentFilter);
    },
    // onDocumentApproval
    (payload) => {
      console.log('✅ Real-time document approved:', payload);
      setRealtimeToast({
        message: `Documento ${payload.type} approvato per ${payload.userEmail}`,
        type: 'success',
      });
      fetchUsers(currentFilter);
    },
    // onDocumentRejection
    (payload) => {
      console.log('❌ Real-time document rejected:', payload);
      setRealtimeToast({
        message: `Documento ${payload.type} rifiutato: ${payload.rejectionReason || 'da rivedere'}`,
        type: 'warning',
      });
      fetchUsers(currentFilter);
    },
    // onContractSigned
    (payload) => {
      console.log('✍️ Real-time contract signed:', payload);
      setRealtimeToast({
        message: `${payload.userEmail} ha firmato il contratto!`,
        type: 'success',
      });
      fetchUsers(currentFilter);
      refetchStats();
    }
  );

  const fetchUsers = async (filter: 'all' | 'direct' | 'children' | 'orphaned' = 'all') => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await partnerService.getUsers(filter);
      
      // L'API restituisce {users: PartnerUser[], total: number}
      if (data && data.users && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        console.error('API response format invalid:', data);
        setUsers([]);
        setUsersError('Formato dati non valido dal server');
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
      setUsers([]); // Reset users to empty array on error
      setUsersError(err.response?.data?.error || 'Errore nel caricamento utenti');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(currentFilter);
  }, [currentFilter]);

  // Listen for refresh events from payment updates
  useEffect(() => {
    const handleRefresh = () => {
      console.log('Dashboard received refresh event');
      fetchUsers(currentFilter);
      refetchStats();
    };

    window.addEventListener('refreshRegistrations', handleRefresh);
    window.addEventListener('refreshCertificationSteps', handleRefresh);
    
    return () => {
      window.removeEventListener('refreshRegistrations', handleRefresh);
      window.removeEventListener('refreshCertificationSteps', handleRefresh);
    };
  }, [currentFilter, refetchStats]);

  const handleFilterChange = (filter: 'all' | 'direct' | 'children' | 'orphaned') => {
    setCurrentFilter(filter);
  };

  const handleNavigateToEnrollmentDetail = (registrationId: string) => {
    navigate(`/dashboard/users/${registrationId}`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const handleExportToExcel = async () => {
    setExportLoading(true);
    
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      
      const response = await fetch('/api/partners/export/registrations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        setErrorMessage(`Errore ${response.status}: ${errorText}`);
        setShowErrorModal(true);
        return;
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `registrazioni_partner_${new Date().toISOString().split('T')[0]}.xlsx`;

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
      
    } catch (error: any) {
      setErrorMessage('Errore durante l\'export: ' + error.message);
      setShowErrorModal(true);
    } finally {
      setExportLoading(false);
    }
  };

  if (statsError || usersError || analyticsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-md mx-auto">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.498 0L4.402 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-red-800">Errore di Caricamento</h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            {statsError || usersError || analyticsError}
          </p>
          <button 
            onClick={() => {
              refetchStats();
              fetchUsers(currentFilter);
            }}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                Dashboard Partner
              </h1>
              <p className="text-slate-600 mt-2 text-lg font-medium">Panoramica completa delle tue performance e gestione utenti</p>
            </div>
            <div className="mt-6 lg:mt-0 flex items-center gap-4">
              <div className="flex items-center px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2"></div>
                <span className="text-sm font-medium text-emerald-700">Sistema Operativo</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">Ultimo aggiornamento</div>
                <div className="text-xs text-slate-500">{new Date().toLocaleString('it-IT')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Alerts */}
        <PriorityAlerts analytics={analytics} stats={stats} />

        {/* Stats Cards */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${partnerEmployee?.role === 'ADMINISTRATIVE' ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-6 mb-8`}>
          <StatsCard
            title="Utenti Totali"
            value={statsLoading ? '...' : stats?.totalRegistrations || 0}
            color="blue"
            subtitle="Tutti gli utenti gestiti"
            trend={stats?.directRegistrations && stats?.totalRegistrations ? `${Math.round((stats.directRegistrations / stats.totalRegistrations) * 100)}% diretti` : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2a3 3 0 01-5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 01-9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          {/* Ricavi visibili solo per ADMINISTRATIVE */}
          {partnerEmployee?.role === 'ADMINISTRATIVE' && (
            <StatsCard
              title="Ricavi Mensili"
              value={statsLoading ? '...' : formatCurrency(stats?.monthlyRevenue || 0)}
              color="emerald"
              subtitle="Entrate del mese corrente"
              trend={analytics?.metrics?.growthRate ? `${analytics.metrics?.growthRate > 0 ? '+' : ''}${analytics.metrics?.growthRate}% crescita` : undefined}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              }
            />
          )}

          <StatsCard
            title="Utenti Diretti"
            value={statsLoading ? '...' : stats?.directRegistrations || 0}
            color="violet"
            subtitle="Iscrizioni dirette"
            trend={stats?.indirectRegistrations ? `+${stats.indirectRegistrations} rete` : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          <StatsCard
            title="Conversione"
            value={analyticsLoading ? '...' : `${analytics?.metrics?.conversionRate || 0}%`}
            color="amber"
            subtitle="Tasso di completamento"
            trend={analytics?.metrics?.conversionRate ? `${analytics.metrics?.conversionRate}% completate` : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>

        {/* Charts Section */}
        {partnerEmployee?.role === 'ADMINISTRATIVE' ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
            {/* Revenue Chart */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 h-full">
                <RevenueChart analytics={analytics} loading={analyticsLoading} />
              </div>
            </div>

            {/* Sidebar with metrics and charts */}
            <div className="space-y-6">
              <UserGrowthChart analytics={analytics} loading={analyticsLoading} />
              <QuickMetrics stats={stats} analytics={analytics} loading={statsLoading || analyticsLoading} formatCurrency={formatCurrency} />
            </div>
          </div>
        ) : (
          // Layout per COMMERCIAL - solo crescita utenti e metriche (senza ricavi)
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
              <UserGrowthChart analytics={analytics} loading={analyticsLoading} />
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Metriche Rapide</h3>
              {(statsLoading || analyticsLoading) ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center text-sm">
                      <div className="w-2 h-2 bg-slate-300 rounded-full mr-3"></div>
                      <div className="h-4 bg-slate-200 rounded flex-1"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Utenti Attivi</span>
                    <span className="font-semibold text-gray-900">{stats?.totalRegistrations || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tasso Conversione</span>
                    <span className="font-semibold text-gray-900">{analytics?.metrics?.conversionRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Iscrizioni Dirette</span>
                    <span className="font-semibold text-gray-900">{stats?.directRegistrations || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions & Management Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                  <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3"></div>
                  Centro di Controllo
                </h2>
              </div>
              
              <div className="w-full">
                <button 
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={exportLoading}
                  className="group w-full relative overflow-hidden bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-center justify-center">
                    {exportLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Esportando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Excel
                      </>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                </button>
                
              </div>
              
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 font-medium">
                  📊 Export Excel include: anagrafiche complete, dettagli corsi, cronologia pagamenti e commissioni
                </p>
              </div>
            </div>
          </div>
          
          {/* Actions Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/50 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Prossime Azioni
            </h3>
            {analyticsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center text-sm">
                    <div className="w-2 h-2 bg-slate-300 rounded-full mr-3"></div>
                    <div className="h-4 bg-slate-200 rounded flex-1"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(analytics?.pendingActions?.documentsToApprove || 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-3"></div>
                      <span className="text-slate-600">Documenti da approvare</span>
                    </div>
                    <span className="font-medium text-red-600">{analytics?.pendingActions?.documentsToApprove || 0}</span>
                  </div>
                )}
                {(analytics?.pendingActions?.contractsToSign || 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-amber-400 rounded-full mr-3"></div>
                      <span className="text-slate-600">Contratti da firmare</span>
                    </div>
                    <span className="font-medium text-amber-600">{analytics?.pendingActions?.contractsToSign || 0}</span>
                  </div>
                )}
                {(analytics?.pendingActions?.paymentsInProgress || 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                      <span className="text-slate-600">Pagamenti in corso</span>
                    </div>
                    <span className="font-medium text-blue-600">{analytics?.pendingActions?.paymentsInProgress || 0}</span>
                  </div>
                )}
                {(analytics?.pendingActions?.completedEnrollments || 0) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                      <span className="text-slate-600">Iscrizioni completate</span>
                    </div>
                    <span className="font-medium text-green-600">{analytics?.pendingActions?.completedEnrollments || 0}</span>
                  </div>
                )}
                {!(analytics?.pendingActions?.documentsToApprove || 0) && 
                 !(analytics?.pendingActions?.contractsToSign || 0) && 
                 !(analytics?.pendingActions?.paymentsInProgress || 0) && (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Tutto a posto!</p>
                    <p className="text-xs text-slate-400">Nessuna azione richiesta</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Users Table */}
        <UserTable
          users={users}
          isLoading={usersLoading}
          onFilterChange={handleFilterChange}
          currentFilter={currentFilter}
          onNavigateToEnrollmentDetail={handleNavigateToEnrollmentDetail}
        />

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

        {/* Real-time Toast */}
        {realtimeToast && (
          <RealtimeToast
            message={realtimeToast.message}
            type={realtimeToast.type}
            onClose={() => setRealtimeToast(null)}
          />
        )}
      </div>
    </div>
  );
};

export default ImprovedPartnerDashboard;