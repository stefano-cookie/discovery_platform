import React from 'react';
import { TrendingUp, Users, Euro, Award } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  registrations: number;
  revenue: number;
  isPremium: boolean;
}

interface TopCompaniesProps {
  companies: Company[];
}

export const TopCompanies: React.FC<TopCompaniesProps> = ({ companies }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const topCompanies = companies.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Top 5 Companies
        </h2>
        <span className="text-sm text-gray-500">Per Revenue</span>
      </div>

      <div className="space-y-4">
        {topCompanies.map((company, index) => (
          <div
            key={company.id}
            className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100 hover:shadow-md transition-shadow"
          >
            {/* Rank Badge */}
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm
              ${index === 0 ? 'bg-yellow-100 text-yellow-700' : ''}
              ${index === 1 ? 'bg-gray-100 text-gray-700' : ''}
              ${index === 2 ? 'bg-orange-100 text-orange-700' : ''}
              ${index > 2 ? 'bg-blue-50 text-blue-600' : ''}
            `}>
              {index === 0 && <Award className="w-5 h-5" />}
              {index !== 0 && `#${index + 1}`}
            </div>

            {/* Company Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {company.name}
                </h3>
                {company.isPremium && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                    Premium
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{company.registrations} iscrizioni</span>
                </div>
              </div>
            </div>

            {/* Revenue Badge */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Revenue</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(company.revenue)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nessuna company trovata
        </div>
      )}
    </div>
  );
};