import React, { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  DollarSign,
} from 'lucide-react';
import api from '../../services/api';
import { RegistrationDetailModal } from '../../components/Admin/RegistrationDetailModal';

interface Registration {
  id: string;
  createdAt: string;
  status: string;
  offerType: string;
  user: {
    id: string;
    email: string;
    profile?: {
      nome?: string;
      cognome?: string;
      codiceFiscale?: string;
    };
  };
  partnerCompany: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  offer: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
      templateType: string;
    };
  } | null;
  originalAmount: number;
  finalAmount: number;
  installments: number;
  hasPaidPayments?: boolean; // Flag per indicare se ha pagamenti registrati
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const AdminRegistrations: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Company list for filter
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);

  // Detail modal state
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    selectedStatuses,
    selectedCompany,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
  ]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/admin/companies');
      setCompanies(
        response.data.map((c: any) => ({ id: c.id, name: c.name }))
      );
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchRegistrations = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedStatuses.length > 0)
        params.append('statuses', selectedStatuses.join(','));
      if (selectedCompany) params.append('companyId', selectedCompany);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (amountMin) params.append('amountMin', amountMin);
      if (amountMax) params.append('amountMax', amountMax);

      const response = await api.get(`/admin/registrations?${params}`);

      setRegistrations(response.data.registrations);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportRegistrations = async () => {
    try {
      // Build query params based on active filters
      const params: any = {};

      if (selectedCompany) {
        params.companyId = selectedCompany;
      }

      if (selectedStatuses.length > 0) {
        params.status = selectedStatuses.join(',');
      }

      if (dateFrom) {
        params.dateFrom = dateFrom;
      }

      if (dateTo) {
        params.dateTo = dateTo;
      }

      const response = await api.get('/admin/export/registrations', {
        params,
        responseType: 'blob'
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Iscrizioni_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting registrations:', error);
      alert('Errore durante l\'export delle iscrizioni');
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '€ 0,00';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      // Stati iniziali enrollment
      PENDING: { label: 'In Attesa', color: 'bg-yellow-100 text-yellow-800' },
      DATA_VERIFIED: {
        label: 'Dati Verificati',
        color: 'bg-blue-100 text-blue-800',
      },
      DOCUMENTS_UPLOADED: {
        label: 'Documenti Caricati',
        color: 'bg-blue-100 text-blue-800',
      },
      DOCUMENTS_PARTNER_CHECKED: {
        label: 'Documenti Checkati Partner',
        color: 'bg-indigo-100 text-indigo-800',
      },
      CONTRACT_GENERATED: {
        label: 'Contratto Generato',
        color: 'bg-purple-100 text-purple-800',
      },
      CONTRACT_SIGNED: {
        label: 'Contratto Firmato',
        color: 'bg-purple-100 text-purple-800',
      },

      // Nuovo workflow approvazione Discovery
      AWAITING_DISCOVERY_APPROVAL: {
        label: 'In Attesa Approvazione Discovery',
        color: 'bg-orange-100 text-orange-800',
      },
      DISCOVERY_APPROVED: {
        label: 'Approvato da Discovery',
        color: 'bg-green-100 text-green-800',
      },

      // Stati post-approvazione
      ENROLLED: { label: 'Iscritto', color: 'bg-green-100 text-green-800' },

      // Stati Certificazione
      DOCUMENTS_APPROVED: {
        label: 'Documenti Approvati',
        color: 'bg-blue-100 text-blue-800',
      },
      EXAM_REGISTERED: {
        label: 'Iscritto all\'Esame',
        color: 'bg-teal-100 text-teal-800',
      },

      // Stati TFA
      CNRED_RELEASED: {
        label: 'CNRED Rilasciato',
        color: 'bg-cyan-100 text-cyan-800',
      },
      FINAL_EXAM: {
        label: 'Esame Finale',
        color: 'bg-orange-100 text-orange-800',
      },
      RECOGNITION_REQUEST: {
        label: 'Richiesta Riconoscimento',
        color: 'bg-pink-100 text-pink-800',
      },

      // Stati finali
      COMPLETED: {
        label: 'Completato',
        color: 'bg-emerald-100 text-emerald-800',
      },
      PAYMENT_COMPLETED: {
        label: 'Pagamento Completato',
        color: 'bg-emerald-100 text-emerald-800',
      },
      CANCELLED: { label: 'Annullato', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || {
      label: status,
      color: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setSelectedCompany('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    searchTerm ||
    selectedStatuses.length > 0 ||
    selectedCompany ||
    dateFrom ||
    dateTo ||
    amountMin ||
    amountMax;

  // Calcola revenue solo dalle iscrizioni con pagamenti registrati
  const totalRevenue = registrations
    .filter(reg => reg.hasPaidPayments)
    .reduce((sum, reg) => sum + reg.finalAmount, 0);

  const handleOpenDetail = (registrationId: string) => {
    setSelectedRegistrationId(registrationId);
    setShowDetailModal(true);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedRegistrationId(null);
  };

  const handleRegistrationUpdate = () => {
    fetchRegistrations(); // Refresh list after update
  };

  if (loading && registrations.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">Iscrizioni Globali</h1>
          <p className="text-gray-600 mt-2">
            {pagination.total} iscrizioni totali
            {hasActiveFilters && ` (${registrations.length} filtrate)`}
          </p>
        </div>
        <button
          onClick={handleExportRegistrations}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          Esporta Excel
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Iscrizioni (pagina corrente)</p>
          <p className="text-3xl font-bold text-gray-900">{registrations.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Revenue Totale</p>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* Primary Filters */}
        <div className="flex gap-4 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per email, nome, cognome o codice fiscale..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showAdvancedFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filtri Avanzati
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            >
              <X className="w-5 h-5" />
              Pulisci
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-gray-200 space-y-4">
            {/* Status Multi-Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stati (multi-selezione)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'PENDING',
                  'DATA_VERIFIED',
                  'DOCUMENTS_UPLOADED',
                  'DOCUMENTS_PARTNER_CHECKED',
                  'CONTRACT_GENERATED',
                  'CONTRACT_SIGNED',
                  'AWAITING_DISCOVERY_APPROVAL',
                  'DISCOVERY_APPROVED',
                  'ENROLLED',
                  'DOCUMENTS_APPROVED',
                  'EXAM_REGISTERED',
                  'CNRED_RELEASED',
                  'FINAL_EXAM',
                  'RECOGNITION_REQUEST',
                  'COMPLETED',
                  'PAYMENT_COMPLETED',
                  'CANCELLED',
                ].map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedStatuses.includes(status)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {getStatusBadge(status).props.children}
                  </button>
                ))}
              </div>
            </div>

            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Tutte le companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Data Da
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Data A
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  Importo Min (€)
                </label>
                <input
                  type="number"
                  value={amountMin}
                  onChange={(e) => {
                    setAmountMin(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="inline w-4 h-4 mr-1" />
                  Importo Max (€)
                </label>
                <input
                  type="number"
                  value={amountMax}
                  onChange={(e) => {
                    setAmountMax(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  placeholder="10000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Registrations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {registrations.map((reg) => (
                <tr
                  key={reg.id}
                  onClick={() => handleOpenDetail(reg.id)}
                  className="hover:bg-indigo-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {reg.user.profile?.nome && reg.user.profile?.cognome
                          ? `${reg.user.profile.nome} ${reg.user.profile.cognome}`
                          : reg.user.email}
                      </div>
                      <div className="text-sm text-gray-500">{reg.user.email}</div>
                      {reg.user.profile?.codiceFiscale && (
                        <div className="text-xs text-gray-400">
                          {reg.user.profile.codiceFiscale}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {reg.offer?.name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">{reg.offerType}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {reg.partnerCompany ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {reg.partnerCompany.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {reg.partnerCompany.referralCode}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Nessuna company</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(reg.status)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(reg.finalAmount)}
                    </div>
                    {reg.originalAmount !== reg.finalAmount && (
                      <div className="text-xs text-gray-500 line-through">
                        {formatCurrency(reg.originalAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(reg.createdAt).toLocaleDateString('it-IT')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {registrations.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {hasActiveFilters
                ? 'Nessuna iscrizione trovata con questi filtri'
                : 'Nessuna iscrizione trovata'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Pagina {pagination.page} di {pagination.totalPages} (
            {pagination.total} iscrizioni totali)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page === 1}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Precedente
            </button>

            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: pageNum }))
                    }
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      pagination.page === pageNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page === pagination.totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Successiva
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Registration Detail Modal */}
      {selectedRegistrationId && (
        <RegistrationDetailModal
          registrationId={selectedRegistrationId}
          isOpen={showDetailModal}
          onClose={handleCloseDetail}
          onUpdate={handleRegistrationUpdate}
        />
      )}
    </div>
  );
};