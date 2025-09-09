import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerStats } from '../../hooks/usePartnerStats';
import { partnerService } from '../../services/partner';
import { PartnerUser } from '../../types/partner';
import StatsCard from './StatsCard';
import UserTable from './UserTable';
import SuccessModal from '../UI/SuccessModal';
import ErrorModal from '../UI/ErrorModal';

const PartnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = usePartnerStats();
  const [users, setUsers] = useState<PartnerUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'direct' | 'children'>('all');
  const [exportLoading, setExportLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchUsers = async (filter: 'all' | 'direct' | 'children' = 'all') => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const data = await partnerService.getUsers(filter);
      setUsers(data.users);
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

      // Get filename and download
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Dashboard Partner</h1>
              <p className="text-gray-600 mt-2 text-lg">Gestisci i tuoi utenti e monitora le performance in tempo reale</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatsCard
          title="Utenti Totali"
          value={statsLoading ? '...' : stats?.totalRegistrations || 0}
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Utenti Diretti"
          value={statsLoading ? '...' : stats?.directRegistrations || 0}
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
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-10 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Azioni Rapide
          </h2>
          <div className="max-w-md">
            <button 
              type="button"
              onClick={handleExportToExcel}
              disabled={exportLoading}
              className={`
                w-full inline-flex items-center justify-center px-6 py-3 
                border border-transparent text-base font-medium rounded-lg
                text-white bg-green-600 hover:bg-green-700 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200
                ${exportLoading ? 'bg-green-400' : ''}
              `}
            >
              {exportLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Esportando Excel...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Esporta Registrazioni Excel
                </>
              )}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Scarica tutti i tuoi clienti e pagamenti in formato Excel
            </p>
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
      </div>
      
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
    </div>
  );
};

export default PartnerDashboard;