import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueChartProps {
  data: Array<{
    month: string;
    revenue: number;
  }>;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calcola totali e trend
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  // Calcola crescita percentuale (ultimo vs primo mese)
  const growthPercent = data.length >= 2
    ? ((data[data.length - 1].revenue - data[0].revenue) / data[0].revenue) * 100
    : 0;
  const isPositiveGrowth = growthPercent >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Andamento Revenue
        </h2>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
          isPositiveGrowth ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isPositiveGrowth ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="text-sm font-semibold">
            {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="mb-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-700 font-medium mb-1">Revenue Totale Piattaforma</p>
          <p className="text-2xl font-bold text-green-900">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="revenue"
            fill="url(#colorRevenue)"
            stroke="none"
            name="Revenue Piattaforma"
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', r: 4 }}
            name="Revenue Totale"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};