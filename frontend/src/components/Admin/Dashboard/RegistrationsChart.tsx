import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Users, Award } from 'lucide-react';

interface RegistrationsChartProps {
  data: Array<{
    month: string;
    registrations: number;
    tfaCount: number;
    certCount: number;
  }>;
}

export const RegistrationsChart: React.FC<RegistrationsChartProps> = ({ data }) => {
  // Calcola totali
  const totalRegistrations = data.reduce((sum, d) => sum + d.registrations, 0);
  const totalTfa = data.reduce((sum, d) => sum + d.tfaCount, 0);
  const totalCert = data.reduce((sum, d) => sum + d.certCount, 0);

  // Calcola percentuali
  const tfaPercentage = totalRegistrations > 0 ? (totalTfa / totalRegistrations) * 100 : 0;
  const certPercentage = totalRegistrations > 0 ? (totalCert / totalRegistrations) * 100 : 0;

  // Media mensile
  const avgMonthly = data.length > 0 ? totalRegistrations / data.length : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          Iscrizioni per Tipo Corso
        </h2>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700">
          <span className="text-sm font-semibold">
            {avgMonthly.toFixed(0)} / mese
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-700 font-medium mb-1">Totale Iscrizioni</p>
          <p className="text-lg font-bold text-gray-900">{totalRegistrations}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
          <p className="text-xs text-blue-700 font-medium mb-1">TFA Romania</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-blue-900">{totalTfa}</p>
            <p className="text-xs text-blue-600">({tfaPercentage.toFixed(0)}%)</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
          <p className="text-xs text-purple-700 font-medium mb-1 flex items-center gap-1">
            <Award className="w-3 h-3" />
            Certificazioni
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-purple-900">{totalCert}</p>
            <p className="text-xs text-purple-600">({certPercentage.toFixed(0)}%)</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
          />
          <Legend />
          <Bar
            dataKey="tfaCount"
            stackId="a"
            fill="#3b82f6"
            name="TFA Romania"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="certCount"
            stackId="a"
            fill="#8b5cf6"
            name="Certificazioni"
            radius={[8, 8, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="registrations"
            stroke="#059669"
            strokeWidth={3}
            dot={{ fill: '#059669', r: 5 }}
            name="Totale"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};