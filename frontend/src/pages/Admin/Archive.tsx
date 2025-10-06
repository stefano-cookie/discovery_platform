import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ArchiveStats {
  totalRegistrations: number;
  totalExpected: number;
  totalPaid: number;
  totalOutstanding: number;
  averageProgress: number;
  paymentStatusCounts: {
    PAID?: number;
    PARTIAL?: number;
    UNPAID?: number;
  };
  yearlyDistribution: Array<{
    originalYear: number;
    _count: number;
  }>;
  topCompanies: Array<{
    companyName: string;
    _count: number;
  }>;
}

interface ArchivedRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fiscalCode: string;
  companyName: string;
  courseName: string;
  finalAmount: number;
  installments: number;
  totalExpected: number;
  totalPaid: number;
  totalOutstanding: number;
  paymentProgress: number;
  originalYear: number;
  uploadedAt: string;
  payments: Array<{
    id: string;
    type: string;
    label: string;
    expectedAmount: number;
    paidAmount: number;
    status: string;
  }>;
}

const Archive: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [registrations, setRegistrations] = useState<ArchivedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtri
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadRegistrations();
  }, [page, selectedYear, companyFilter, paymentStatusFilter, searchQuery]);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/archive/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats);
    } catch (err: any) {
      console.error('Errore caricamento statistiche:', err);
      // Non mostrare errore se l'archivio è semplicemente vuoto
      if (err.response?.status !== 404) {
        setError(err.response?.data?.error || 'Errore caricamento statistiche');
      }
      // Set default empty stats
      setStats({
        totalRegistrations: 0,
        totalExpected: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        averageProgress: 0,
        paymentStatusCounts: {},
        yearlyDistribution: [],
        topCompanies: []
      });
    }
  };

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const params: any = { page, limit: 20 };
      if (selectedYear) params.year = selectedYear;
      if (companyFilter) params.company = companyFilter;
      if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await axios.get(`${API_URL}/admin/archive/registrations`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setRegistrations(response.data.registrations || []);
      setTotalPages(response.data.pagination?.pages || 1);
      setError('');
    } catch (err: any) {
      console.error('Errore caricamento iscrizioni:', err);
      // Non mostrare errore se l'archivio è semplicemente vuoto
      if (err.response?.status !== 404) {
        setError(err.response?.data?.error || 'Errore caricamento iscrizioni');
      }
      setRegistrations([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | any) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const getPaymentStatusBadge = (progress: number) => {
    if (progress === 100) {
      return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Pagato</span>;
    } else if (progress > 0) {
      return <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Parziale</span>;
    } else {
      return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Non pagato</span>;
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento archivio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archivio Iscrizioni</h1>
        <p className="mt-2 text-gray-600">Gestione iscrizioni storiche (separate dal sistema attuale)</p>
      </div>

      {/* Empty Archive Info */}
      {stats && stats.totalRegistrations === 0 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-900">
                Archivio vuoto
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  L'archivio è attualmente vuoto. Questo sistema è completamente separato dalle iscrizioni attuali
                  e serve per ospitare <strong>solo iscrizioni storiche/passate</strong>.
                </p>
                <p className="mt-2">
                  Puoi iniziare caricando iscrizioni manualmente o tramite import Excel.
                </p>
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => navigate('/admin/archive/create')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Crea Prima Iscrizione
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Totale Iscrizioni */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Totale Iscrizioni</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.totalRegistrations}</div>
          </div>

          {/* Totale Dovuto */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Totale Dovuto</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {formatCurrency(stats.totalExpected)}
            </div>
          </div>

          {/* Totale Incassato */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Totale Incassato</div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {formatCurrency(stats.totalPaid)}
            </div>
          </div>

          {/* Residuo */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Residuo</div>
            <div className="mt-2 text-3xl font-bold text-red-600">
              {formatCurrency(stats.totalOutstanding)}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {Number(stats.averageProgress).toFixed(1)}% medio pagato
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Anno */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anno
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti gli anni</option>
              {stats?.yearlyDistribution.map((item) => (
                <option key={item.originalYear} value={item.originalYear}>
                  {item.originalYear} ({item._count})
                </option>
              ))}
            </select>
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Azienda
            </label>
            <input
              type="text"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filtra per azienda..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Pagamento
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tutti</option>
              <option value="paid">Pagato</option>
              <option value="partial">Parziale</option>
              <option value="unpaid">Non pagato</option>
            </select>
          </div>

          {/* Ricerca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ricerca
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Nome, email, CF..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex justify-end space-x-3">
          <button
            onClick={() => navigate('/admin/archive/import')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Import Excel
          </button>
          <button
            onClick={() => navigate('/admin/archive/create')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Nuova Iscrizione
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Registrations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Studente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azienda
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Anno
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pagato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Caricamento...
                  </td>
                </tr>
              ) : registrations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Nessuna iscrizione trovata
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr
                    key={reg.id}
                    onClick={() => navigate(`/admin/archive/${reg.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {reg.firstName} {reg.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{reg.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {reg.companyName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {reg.courseName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {reg.originalYear}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(reg.finalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(reg.totalPaid)}
                      </div>
                      <div className="text-xs text-gray-500">
                        su {formatCurrency(reg.totalExpected)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getPaymentStatusBadge(Number(reg.paymentProgress))}
                      <div className="mt-1 text-xs text-gray-500">
                        {Number(reg.paymentProgress).toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Precedente
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Successivo
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Pagina <span className="font-medium">{page}</span> di{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ←
                  </button>
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= page - 1 && pageNum <= page + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === page - 2 || pageNum === page + 2) {
                      return <span key={pageNum} className="px-2">...</span>;
                    }
                    return null;
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    →
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Archive;
