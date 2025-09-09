import React from 'react';
import { PartnerStats } from '../../types/partner';
import { PartnerAnalytics } from '../../hooks/usePartnerAnalytics';

interface QuickMetricsProps {
  stats: PartnerStats | null;
  analytics: PartnerAnalytics | null;
  loading: boolean;
  formatCurrency: (amount: number) => string;
}

const QuickMetrics: React.FC<QuickMetricsProps> = ({ stats, analytics, loading, formatCurrency }) => {
  const metrics = [
    {
      label: 'Commissioni Pending',
      value: stats?.pendingCommissions || 0,
      format: 'currency',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      label: 'Media per Utente',
      value: stats?.totalRegistrations ? Math.round((stats.monthlyRevenue || 0) / stats.totalRegistrations) : 0,
      format: 'currency',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Tasso Crescita',
      value: 15,
      format: 'percentage',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      label: 'Utenti Rete',
      value: stats?.indirectRegistrations || 0,
      format: 'number',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2a3 3 0 01 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'text-violet-600',
      bgColor: 'bg-violet-50'
    }
  ];

  const formatValue = (value: number, format: string) => {
    if (loading) return '...';
    
    switch (format) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Metriche Rapide</h3>
        <div className="flex items-center text-sm text-emerald-600">
          <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>
      
      <div>
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${metric.bgColor} ${metric.color} mr-3`}>
                {metric.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{formatValue(metric.value, metric.format)}</p>
                <p className="text-xs text-slate-500">{metric.label}</p>
              </div>
            </div>
            <div className="text-right">
              {!loading && (metric as any).trend && (
                <div className={`flex items-center text-xs ${
                  (metric as any).trend.includes('+') ? 'text-emerald-600' : 
                  (metric as any).trend.includes('-') ? 'text-red-600' : 'text-slate-600'
                }`}>
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={(metric as any).trend.includes('+') ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"} />
                  </svg>
                  <span>{(metric as any).trend}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Tasso Conversione</span>
          <div className="flex items-center">
            <div className="w-20 h-2 bg-slate-200 rounded-full mr-2">
              <div 
                className="h-2 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((analytics?.metrics?.conversionRate || 0), 100)}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-emerald-600">{analytics?.metrics?.conversionRate || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickMetrics;