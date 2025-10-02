import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { CheckCircle2, Clock, FileCheck, AlertCircle } from 'lucide-react';

interface StatusData {
  name: string;
  value: number;
  color: string;
  icon: React.ElementType;
}

interface StatusDonutChartProps {
  data: Array<{
    status: string;
    count: number;
  }>;
}

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({ data }) => {
  // Mappa status a colori e icone
  const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    PENDING: { color: '#eab308', icon: Clock, label: 'In Attesa' },
    DATA_VERIFIED: { color: '#3b82f6', icon: FileCheck, label: 'Dati Verificati' },
    CONTRACT_SIGNED: { color: '#8b5cf6', icon: FileCheck, label: 'Contratto Firmato' },
    ENROLLED: { color: '#10b981', icon: CheckCircle2, label: 'Iscritto' },
    REJECTED: { color: '#ef4444', icon: AlertCircle, label: 'Rifiutato' },
  };

  // Prepara dati per il grafico
  const chartData: StatusData[] = data.map(item => ({
    name: statusConfig[item.status]?.label || item.status,
    value: item.count,
    color: statusConfig[item.status]?.color || '#6b7280',
    icon: statusConfig[item.status]?.icon || AlertCircle,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom label per il centro del donut
  const renderCustomLabel = () => {
    return (
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
        <tspan x="50%" dy="-0.5em" fontSize="32" fontWeight="bold" fill="#111827">
          {total}
        </tspan>
        <tspan x="50%" dy="1.5em" fontSize="14" fill="#6b7280">
          Totale
        </tspan>
      </text>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Distribuzione per Status
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              {renderCustomLabel()}
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with stats */}
        <div className="space-y-2">
          {chartData.map((item, index) => {
            const Icon = item.icon;
            const percentage = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <Icon className="w-4 h-4" style={{ color: item.color }} />
                  <span className="text-sm font-medium text-gray-700">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">
                    {item.value}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};