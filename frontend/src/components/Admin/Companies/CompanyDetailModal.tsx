import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  Users,
  FileText,
  Euro,
  TrendingUp,
  Award,
  Calendar,
  Hash,
  CheckCircle,
  XCircle,
  Loader,
} from 'lucide-react';
import api from '../../../services/api';

interface CompanyDetail {
  id: string;
  name: string;
  referralCode: string;
  isActive: boolean;
  isPremium: boolean;
  canCreateChildren: boolean;
  totalEarnings: number;
  commissionPerUser: number;
  createdAt: string;
  updatedAt: string;
  employees: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    isOwner: boolean;
  }>;
  registrations: {
    total: number;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byCourse: Array<{
      courseType: string;
      count: number;
      revenue: number;
    }>;
  };
}

interface CompanyDetailModalProps {
  companyId: string;
  onClose: () => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  companyId,
  onClose,
}) => {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyDetail();
  }, [companyId]);

  const fetchCompanyDetail = async () => {
    try {
      const response = await api.get(`/admin/companies/${companyId}`);
      setCompany(response.data);
    } catch (error) {
      console.error('Error fetching company detail:', error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <div className="text-center py-12">
            <p className="text-gray-500">Errore nel caricamento dei dettagli</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg">
              <Building2 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{company.name}</h2>
              <p className="text-sm text-indigo-100">Dettagli Company</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-indigo-600 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Cards Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-medium text-blue-700">Referral Code</p>
              </div>
              <p className="text-2xl font-bold text-blue-900">{company.referralCode}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                {company.isActive ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <p className="text-sm font-medium text-green-700">Status</p>
              </div>
              <p className="text-lg font-bold text-green-900">
                {company.isActive ? 'Attiva' : 'Inattiva'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-purple-600" />
                <p className="text-sm font-medium text-purple-700">Premium</p>
              </div>
              <p className="text-lg font-bold text-purple-900">
                {company.isPremium ? 'Sì' : 'No'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-medium text-orange-700">Creata il</p>
              </div>
              <p className="text-sm font-bold text-orange-900">
                {formatDate(company.createdAt)}
              </p>
            </div>
          </div>

          {/* Revenue & Commission Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-green-700">Revenue Totale</p>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(company.totalEarnings)}
              </p>
            </div>

            {company.isPremium && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <p className="text-sm font-medium text-purple-700">Commissione TFA per Collaboratori</p>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(company.commissionPerUser)}
                </p>
                <p className="text-xs text-purple-600 mt-1">per iscrizione TFA</p>
              </div>
            )}
          </div>

          {/* Registrations Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Iscrizioni ({company.registrations.total})
            </h3>

            {/* By Course Type */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Per Tipo Corso</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.registrations.byCourse.map((course) => (
                  <div
                    key={course.courseType}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900">
                        {course.courseType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazioni'}
                      </p>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
                        {course.count}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Revenue: <span className="font-semibold">{formatCurrency(course.revenue)}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* By Status */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Per Status</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {company.registrations.byStatus.map((status) => (
                  <div
                    key={status.status}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center"
                  >
                    <p className="text-xs text-gray-600 mb-1">{status.status}</p>
                    <p className="text-xl font-bold text-gray-900">{status.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Employees */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Dipendenti ({company.employees.length})
            </h3>
            <div className="space-y-2">
              {company.employees.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessun dipendente trovato
                </p>
              ) : (
                company.employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-700 font-semibold text-sm">
                          {employee.firstName[0]}{employee.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                          {employee.isOwner && (
                            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Owner
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">{employee.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{employee.role}</span>
                      {employee.isActive ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};