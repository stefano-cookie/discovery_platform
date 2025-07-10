import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon, 
  color = 'blue' 
}) => {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/25',
    green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25',
    yellow: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/25',
    red: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/25',
  };

  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent"></div>
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2 group-hover:text-gray-800 transition-colors">{value}</p>
          </div>
          {icon && (
            <div className={`rounded-xl p-3 ${colorClasses[color]} shadow-lg`}>
              {icon}
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
          <span>Aggiornato ora</span>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;