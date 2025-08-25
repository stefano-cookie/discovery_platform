import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PartnerAnalytics } from '../../hooks/usePartnerAnalytics';

interface UserGrowthChartProps {
  analytics: PartnerAnalytics | null;
  loading: boolean;
}

const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ analytics, loading }) => {
  const statusData = React.useMemo(() => {
    if (!analytics?.statusDistribution.length) return [];
    
    const statusLabels: Record<string, string> = {
      'COMPLETED': 'Completati',
      'PENDING': 'In Attesa', 
      'DOCUMENTS_UPLOAD': 'Caricamento Doc.',
      'CONTRACT_GENERATED': 'Contratto Generato',
      'CONTRACT_SIGNED': 'Contratto Firmato',
      'ENROLLED': 'Iscritti',
      'CNRED_RELEASED': 'CNRED Rilasciato',
      'DOCUMENTS_APPROVED': 'Documenti Approvati',
      'EXAM_REGISTERED': 'Iscritti Esame'
    };

    return analytics.statusDistribution.map(item => ({
      name: statusLabels[item.status] || item.status,
      value: item.count,
      status: item.status
    }));
  }, [analytics]);

  const COLORS = {
    'COMPLETED': '#10b981',
    'PENDING': '#f59e0b', 
    'DOCUMENTS_UPLOAD': '#3b82f6',
    'CONTRACT_GENERATED': '#8b5cf6',
    'CONTRACT_SIGNED': '#06b6d4',
    'ENROLLED': '#16a34a',
    'CNRED_RELEASED': '#0891b2',
    'DOCUMENTS_APPROVED': '#2563eb',
    'EXAM_REGISTERED': '#ea580c'
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
          <div className="h-48 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Distribuzione Utenti</h3>
        <p className="text-sm text-slate-500">Per stato di avanzamento</p>
      </div>
      
      {statusData.length > 0 ? (
        <>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.status as keyof typeof COLORS] || '#64748b'} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-2">
            {statusData.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: COLORS[item.status as keyof typeof COLORS] || '#64748b' }}
                  ></div>
                  <span className="text-sm text-slate-600">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-500">Nessun dato disponibile</p>
        </div>
      )}
    </div>
  );
};

export default UserGrowthChart;