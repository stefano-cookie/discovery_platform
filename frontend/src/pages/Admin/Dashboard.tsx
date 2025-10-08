import React, { useEffect, useState } from 'react';
import { Building2, FileText, Euro, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StatsCard } from '../../components/Admin/Dashboard/StatsCard';
import { RevenueChart } from '../../components/Admin/Dashboard/RevenueChart';
import { RegistrationsChart } from '../../components/Admin/Dashboard/RegistrationsChart';
import { StatusDonutChart } from '../../components/Admin/Dashboard/StatusDonutChart';
import { TopCompanies } from '../../components/Admin/Dashboard/TopCompanies';
import { QuickActions } from '../../components/Admin/Dashboard/QuickActions';
import { useRealtimeAdmin } from '../../hooks/useRealtimeRegistration';
import RealtimeToast from '../../components/UI/RealtimeToast';
import api from '../../services/api';

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalRegistrations: number;
  totalRevenue: number;
  registrationsToday: number;
  registrationsThisWeek: number;
  registrationsThisMonth: number;
}

interface DashboardData {
  summary: DashboardStats;
  revenueChart: Array<{
    month: string;
    revenue: number;
  }>;
  registrationsChart: Array<{
    month: string;
    registrations: number;
    tfaCount: number;
    certCount: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  topCompanies: Array<{
    id: string;
    name: string;
    registrations: number;
    revenue: number;
    isPremium: boolean;
  }>;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeToast, setRealtimeToast] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);

  // Real-time admin notifications
  const { refreshTrigger } = useRealtimeAdmin(
    // onNewRegistration
    (payload) => {
      console.log('🆕 New registration:', payload);
      setRealtimeToast({
        message: `Nuova iscrizione: ${payload.userEmail} - ${payload.courseName}`,
        type: 'success',
      });
      fetchDashboardData(); // Refresh dashboard stats
    },
    // onDocumentPending
    (payload) => {
      console.log('📄 Document pending:', payload);
      setRealtimeToast({
        message: `Documento in attesa di approvazione da ${payload.userEmail}`,
        type: 'warning',
      });
      fetchDashboardData(); // Refresh dashboard stats
    },
    // onRegistrationDeleted
    (payload) => {
      console.log('🗑️ Registration deleted:', payload);
      setRealtimeToast({
        message: `Iscrizione eliminata`,
        type: 'info',
      });
      fetchDashboardData(); // Refresh dashboard stats
    }
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/dashboard/stats');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case 'create-company':
        navigate('/admin/companies');
        break;
      case 'export-data':
        navigate('/admin/export');
        break;
      default:
        console.log(`Action ${actionId} not implemented yet`);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-8">
        <div className="text-center text-gray-500">
          Errore nel caricamento dei dati dashboard
        </div>
      </div>
    );
  }

  const stats = dashboardData.summary;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Header with Gradient */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Discovery
            </h1>
            <p className="text-gray-600 mt-2 text-lg">
              Vista globale della piattaforma • Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title="Company Attive"
          value={stats.activeCompanies}
          icon={Building2}
          color="indigo"
        />
        <StatsCard
          title="Totale Iscrizioni"
          value={stats.totalRegistrations}
          icon={FileText}
          color="blue"
        />
        <StatsCard
          title="Revenue Totale"
          value={formatCurrency(stats.totalRevenue)}
          icon={Euro}
          color="green"
        />
      </div>

      {/* Charts Section - Top Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RevenueChart data={dashboardData.revenueChart || []} />
        <RegistrationsChart data={dashboardData.registrationsChart || []} />
      </div>

      {/* Status Distribution Chart */}
      <div className="mb-8">
        <StatusDonutChart data={dashboardData.statusDistribution || []} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <QuickActions onAction={handleQuickAction} />
      </div>

      {/* Recent Activity & Top Companies */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Activity */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Attività Recente
          </h2>
          <div className="space-y-3">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Iscrizioni Oggi</p>
              <p className="text-3xl font-bold text-blue-600">
                {stats.registrationsToday}
              </p>
            </div>
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg border border-indigo-200">
              <p className="text-sm text-gray-600 mb-1">Questa Settimana</p>
              <p className="text-3xl font-bold text-indigo-600">
                {stats.registrationsThisWeek}
              </p>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600 mb-1">Questo Mese</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats.registrationsThisMonth}
              </p>
            </div>
          </div>
        </div>

        {/* Top Companies */}
        <div className="lg:col-span-2">
          <TopCompanies companies={dashboardData.topCompanies || []} />
        </div>
      </div>

      {/* Company Overview Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Riepilogo Companies
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm text-gray-600 mb-1">Totale Companies</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
            <div>
              <p className="text-sm text-gray-600 mb-1">Companies Attive</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeCompanies}</p>
            </div>
            <Building2 className="w-8 h-8 text-green-400" />
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border border-red-200">
            <div>
              <p className="text-sm text-gray-600 mb-1">Companies Inattive</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.totalCompanies - stats.activeCompanies}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Real-time Toast */}
      {realtimeToast && (
        <RealtimeToast
          message={realtimeToast.message}
          type={realtimeToast.type}
          onClose={() => setRealtimeToast(null)}
        />
      )}
    </div>
  );
};