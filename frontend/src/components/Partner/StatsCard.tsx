import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'emerald' | 'violet' | 'amber';
  subtitle?: string;
  trend?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  subtitle,
  trend
}) => {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/25',
    green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25',
    emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25',
    yellow: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/25',
    amber: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/25',
    red: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/25',
    violet: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/25',
  };

  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200/60 hover:border-slate-300/60">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/30 to-transparent"></div>
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            )}
            <p className="text-3xl font-bold text-slate-900 mt-3 group-hover:text-slate-800 transition-colors">
              {value}
            </p>
          </div>
          {icon && (
            <div className={`rounded-xl p-3 ${colorClasses[color]} shadow-lg group-hover:scale-105 transition-transform duration-200`}>
              {icon}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-slate-500">
            <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
            <span>Live</span>
          </div>
          {trend && (
            <div className="flex items-center text-sm font-medium text-emerald-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;