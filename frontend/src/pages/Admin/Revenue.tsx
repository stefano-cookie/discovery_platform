import React, { useEffect, useState } from 'react';
import { Euro, TrendingUp, Building2, FileText } from 'lucide-react';
import api from '../../services/api';

interface CompanyRevenue {
  company: {
    id: string;
    name: string;
    referralCode: string;
    isPremium: boolean;
    discoveryCommissionType: 'PERCENTAGE' | 'FIXED' | null;
    discoveryCommissionValue: number | null;
  };
  totalRegistrations: number;
  totalRevenue: number;
  discoveryCommissions: number;
  companyEarnings: number;
  byOfferType: {
    offerType: string;
    count: number;
    revenue: number;
  }[];
  byCourse: {
    courseName: string;
    courseType: string;
    count: number;
    revenue: number;
  }[];
}

export const AdminRevenue: React.FC = () => {
  const [revenueData, setRevenueData] = useState<CompanyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      const response = await api.get<CompanyRevenue[]>('/admin/revenue/companies');
      setRevenueData(response.data);
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatCommission = (type: string | null, value: number | null) => {
    if (!type || value === null) return 'Non configurata';
    return type === 'PERCENTAGE' ? `${value}%` : formatCurrency(value);
  };

  const totalStats = revenueData.reduce(
    (acc, item) => ({
      registrations: acc.registrations + item.totalRegistrations,
      revenue: acc.revenue + item.totalRevenue,
      commissions: acc.commissions + item.discoveryCommissions,
      companyEarnings: acc.companyEarnings + item.companyEarnings,
    }),
    { registrations: 0, revenue: 0, commissions: 0, companyEarnings: 0 }
  );

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Commissioni
        </h1>
        <p className="text-gray-600 mt-2">
          Analisi commissioni per company con breakdown dettagliato
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-600">Iscrizioni Totali</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {totalStats.registrations}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Euro className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-600">Revenue Totale</p>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(totalStats.revenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-600">Commissioni Discovery</p>
          </div>
          <p className="text-3xl font-bold text-indigo-600">
            {formatCurrency(totalStats.commissions)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-600">Guadagni Companies</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600">
            {formatCurrency(totalStats.companyEarnings)}
          </p>
        </div>
      </div>

      {/* Company Revenue Cards */}
      <div className="space-y-4">
        {revenueData.map((item) => (
          <div
            key={item.company.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Company Header */}
            <div
              className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() =>
                setExpandedCompany(
                  expandedCompany === item.company.id ? null : item.company.id
                )
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900">
                        {item.company.name}
                      </h3>
                      {item.company.isPremium && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Premium
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {item.company.referralCode} •{' '}
                      Commissione:{' '}
                      {formatCommission(
                        item.company.discoveryCommissionType,
                        item.company.discoveryCommissionValue
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {item.totalRegistrations} iscrizioni
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(item.totalRevenue)}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Revenue Totale</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(item.totalRevenue)}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">
                    Commissioni Discovery
                  </p>
                  <p className="text-lg font-bold text-indigo-600">
                    {formatCurrency(item.discoveryCommissions)}
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Guadagno Company</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {formatCurrency(item.companyEarnings)}
                  </p>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedCompany === item.company.id && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* By Offer Type */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Breakdown per Tipo Offerta
                    </h4>
                    <div className="space-y-2">
                      {item.byOfferType.map((offer) => (
                        <div
                          key={offer.offerType}
                          className="flex justify-between items-center p-3 bg-white rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {offer.offerType}
                            </p>
                            <p className="text-sm text-gray-500">
                              {offer.count} iscrizioni
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">
                            {formatCurrency(offer.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Course */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Breakdown per Corso
                    </h4>
                    <div className="space-y-2">
                      {item.byCourse.map((course, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-3 bg-white rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {course.courseName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {course.courseType} • {course.count} iscrizioni
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">
                            {formatCurrency(course.revenue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {revenueData.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Euro className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun dato revenue disponibile</p>
          </div>
        )}
      </div>
    </div>
  );
};