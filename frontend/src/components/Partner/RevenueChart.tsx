import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PartnerAnalytics } from '../../hooks/usePartnerAnalytics';

interface RevenueChartProps {
  analytics: PartnerAnalytics | null;
  loading: boolean;
}

const RevenueChart: React.FC<RevenueChartProps> = ({ analytics, loading }) => {
  const data = analytics?.revenueChart || [];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Andamento Ricavi</h3>
          <p className="text-sm text-slate-500">Confronto con obiettivi mensili</p>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
            <span className="text-slate-600">Ricavi Effettivi</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-slate-300 rounded mr-2"></div>
            <span className="text-slate-600">Target</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12, fill: '#64748b' }}
              stroke="#cbd5e1"
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              stroke="#cbd5e1"
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name) => [
                `€${value.toLocaleString()}`, 
                name === 'revenue' ? 'Ricavi' : 'Target'
              ]}
            />
            <Area
              type="monotone"
              dataKey="target"
              stroke="#cbd5e1"
              fill="transparent"
              strokeDasharray="5 5"
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              fill="url(#colorRevenue)"
              strokeWidth={2}
            />
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-2xl font-bold text-slate-900">
            €{data.length > 0 ? data[data.length - 1]?.revenue?.toLocaleString() || '0' : '0'}
          </p>
          <p className="text-sm text-slate-500">Questo Mese</p>
        </div>
        <div className="text-center p-3 bg-emerald-50 rounded-lg">
          <p className="text-2xl font-bold text-emerald-600">
            {analytics?.metrics?.growthRate ? `${analytics.metrics?.growthRate > 0 ? '+' : ''}${analytics.metrics?.growthRate}%` : '0%'}
          </p>
          <p className="text-sm text-slate-500">vs Mesi Precedenti</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">
            €{data.length > 0 ? data[0]?.target?.toLocaleString() || '2.800' : '2.800'}
          </p>
          <p className="text-sm text-slate-500">Target Mensile</p>
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;