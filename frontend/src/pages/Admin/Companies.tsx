import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Edit,
  Eye,
  Power,
  Users,
  TrendingUp,
} from 'lucide-react';
import api from '../../services/api';
import { CreateCompanyModal } from '../../components/Admin/Companies/CreateCompanyModal';
import { EditCompanyModal } from '../../components/Admin/Companies/EditCompanyModal';
import { CompanyDetailModal } from '../../components/Admin/Companies/CompanyDetailModal';
import { ConfirmToggleModal } from '../../components/Admin/Companies/ConfirmToggleModal';

interface PartnerCompany {
  id: string;
  name: string;
  referralCode: string;
  isActive: boolean;
  isPremium: boolean;
  canCreateChildren: boolean;
  totalEarnings: number;
  employeesCount: number;
  registrationsCount: number;
  subPartnersCount: number;
  createdAt: string;
  updatedAt: string;
  parent?: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
}

export const AdminCompanies: React.FC = () => {
  const [companies, setCompanies] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [toggleCompany, setToggleCompany] = useState<{ id: string; name: string; isActive: boolean } | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get<PartnerCompany[]>('/admin/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
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


  const handleToggleActive = async () => {
    if (!toggleCompany) return;

    try {
      await api.patch(`/admin/companies/${toggleCompany.id}`, {
        isActive: !toggleCompany.isActive,
      });

      // Refresh lista
      fetchCompanies();
      setToggleCompany(null);
    } catch (error) {
      console.error('Error toggling company status:', error);
      window.alert('Errore durante il cambio di stato della company');
    }
  };

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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-600 mt-2">
            Gestione companies partner ({companies.length} totali)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuova Company
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Companies Attive</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.filter((c) => c.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Companies Premium</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.filter((c) => c.isPremium).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Totale Dipendenti</p>
              <p className="text-2xl font-bold text-gray-900">
                {companies.reduce((sum, c) => sum + c.employeesCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dipendenti
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Iscrizioni
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue TFA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {company.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {company.referralCode}
                      </div>
                      {company.isPremium && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                          Premium
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        company.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {company.isActive ? 'Attiva' : 'Disattivata'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {company.employeesCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {company.registrationsCount}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-600">
                    {formatCurrency(company.totalEarnings)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedCompanyId(company.id)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Visualizza dettagli"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingCompanyId(company.id)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                        title="Modifica"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setToggleCompany({
                          id: company.id,
                          name: company.name,
                          isActive: company.isActive
                        })}
                        className={`p-1 rounded ${
                          company.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={company.isActive ? 'Disattiva' : 'Attiva'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessuna company trovata</p>
          </div>
        )}
      </div>

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchCompanies}
      />

      {/* Edit Company Modal */}
      {editingCompanyId && (
        <EditCompanyModal
          companyId={editingCompanyId}
          onClose={() => setEditingCompanyId(null)}
          onSuccess={fetchCompanies}
        />
      )}

      {/* Company Detail Modal */}
      {selectedCompanyId && (
        <CompanyDetailModal
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
        />
      )}

      {/* Confirm Toggle Status Modal */}
      {toggleCompany && (
        <ConfirmToggleModal
          isOpen={!!toggleCompany}
          companyName={toggleCompany.name}
          isCurrentlyActive={toggleCompany.isActive}
          onConfirm={handleToggleActive}
          onCancel={() => setToggleCompany(null)}
        />
      )}
    </div>
  );
};