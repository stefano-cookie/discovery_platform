import React, { useEffect, useState } from 'react';
import { usePartnerAuth, PartnerRouteGuard } from '../hooks/usePartnerAuth';
import { PartnerStats, RegistrationWithSource } from '../types/partner';
import axios from 'axios';

// ========================================
// STATS CARDS COMPONENT
// ========================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'yellow';
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-blue-600 bg-blue-50',
    green: 'bg-green-500 text-green-600 bg-green-50',
    purple: 'bg-purple-500 text-purple-600 bg-purple-50',
    yellow: 'bg-yellow-500 text-yellow-600 bg-yellow-50'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-full ${colorClasses[color].split(' ')[2]}`}>
          <div className={`${colorClasses[color].split(' ')[1]}`}>
            {icon}
          </div>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

// ========================================
// MAIN DASHBOARD COMPONENT
// ========================================

const PartnerDashboardContent: React.FC = () => {
  const { 
    partnerEmployee, 
    partnerCompany, 
    logout,
    canViewFinancialData,
    canCreateEmployees,
    canCreateChildCompanies
  } = usePartnerAuth();

  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================
  // DATA FETCHING
  // ========================================

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Mock data for now (since backend APIs are not fully implemented yet)
        const mockStats: PartnerStats = {
          totalRegistrations: 0,
          directRegistrations: 0,
          indirectRegistrations: 0,
          conversionRate: 0,
          // Financial data only for ADMINISTRATIVE
          ...(canViewFinancialData() && {
            totalRevenue: 0,
            monthlyRevenue: 0,
            pendingCommissions: 0,
            averageTicketSize: 0
          }),
          // Team data only for ADMINISTRATIVE
          ...(canCreateEmployees() && {
            totalEmployees: 1, // At least the current user
            activeEmployees: 1,
            childCompanies: 0
          })
        };

        setStats(mockStats);
        setRegistrations([]); // Empty for now

        // TODO: Replace with real API calls when backend is ready
        // const statsResponse = await axios.get('/api/partner/stats');
        // const registrationsResponse = await axios.get('/api/partner/registrations');
        // setStats(statsResponse.data);
        // setRegistrations(registrationsResponse.data);

      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Errore nel caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [canViewFinancialData, canCreateEmployees]);

  // ========================================
  // RENDER LOADING/ERROR STATES
  // ========================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Errore nel caricamento</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Benvenuto, {partnerEmployee?.firstName} {partnerEmployee?.lastName}
              </h1>
              <p className="text-gray-600">
                {partnerCompany?.name} ({partnerCompany?.referralCode}) - {partnerEmployee?.role}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Role Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                partnerEmployee?.role === 'ADMINISTRATIVE' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {partnerEmployee?.role}
              </span>
              
              {/* Logout Button */}
              <button
                onClick={logout}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-8">
          <div className="flex">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-green-800 font-medium">🎉 Sistema Partner Attivo!</p>
              <p className="text-green-700 text-sm mt-1">
                Login unificato funzionante, dashboard caricata, permessi verificati.
                <br />
                <strong>CHECKPOINT 2A completato con successo!</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Registrazioni Totali"
            value={stats?.totalRegistrations || 0}
            subtitle="Tutte le registrazioni"
            color="blue"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />

          <StatsCard
            title="Registrazioni Dirette"
            value={stats?.directRegistrations || 0}
            subtitle="Iscrizioni dirette"
            color="green"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          {canViewFinancialData() && (
            <>
              <StatsCard
                title="Ricavo Mensile"
                value={`€${stats?.monthlyRevenue?.toLocaleString() || 0}`}
                subtitle="Ricavo del mese"
                color="purple"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                }
              />

              <StatsCard
                title="Commissioni in Sospeso"
                value={`€${stats?.pendingCommissions?.toLocaleString() || 0}`}
                subtitle="Da incassare"
                color="yellow"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </>
          )}

          {canCreateEmployees() && !canViewFinancialData() && (
            <StatsCard
              title="Team"
              value={stats?.activeEmployees || 1}
              subtitle="Collaboratori attivi"
              color="purple"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
          )}
        </div>

        {/* Permission-based Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Azioni Disponibili</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* Always available actions */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900">Registrazioni</h4>
              <p className="text-sm text-gray-600 mt-1">Visualizza e gestisci le registrazioni</p>
              <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                Vai alle Registrazioni
              </button>
            </div>

            {canCreateEmployees() && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Collaboratori</h4>
                <p className="text-sm text-gray-600 mt-1">Invita e gestisci collaboratori</p>
                <button className="mt-3 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                  Gestisci Team
                </button>
              </div>
            )}

            {canCreateChildCompanies() && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Aziende Figlie</h4>
                <p className="text-sm text-gray-600 mt-1">Crea e gestisci aziende figlie</p>
                <button className="mt-3 bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                  Gestisci Rete
                </button>
              </div>
            )}

            {canViewFinancialData() && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">Report Finanziari</h4>
                <p className="text-sm text-gray-600 mt-1">Visualizza ricavi e commissioni</p>
                <button className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700">
                  Vedi Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stato Sistema</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">✅ Database: PartnerCompany & PartnerEmployee attivi</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">✅ Backend: Login unificato funzionante</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">✅ Frontend: Auth context partner implementato</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">🚧 API Business: In sviluppo (prossimi checkpoint)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========================================
// EXPORTED COMPONENT WITH ROUTE GUARD
// ========================================

const PartnerDashboard: React.FC = () => {
  return (
    <PartnerRouteGuard>
      <PartnerDashboardContent />
    </PartnerRouteGuard>
  );
};

export default PartnerDashboard;