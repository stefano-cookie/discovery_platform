import React, { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Search,
  Filter,
  Download,
  Eye,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Mail,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { UserDetailModal } from '../../components/Admin/Users/UserDetailModal';
import { TransferUserModal } from '../../components/Admin/Users/TransferUserModal';

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  assignedPartnerId: string | null;
  assignedPartner?: {
    id: string;
    name: string;
    referralCode: string;
  } | null;
  profile?: {
    nome: string;
    cognome: string;
  } | null;
  _count: {
    registrations: number;
  };
}

interface Company {
  id: string;
  name: string;
  referralCode: string;
}

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [registrationsFilter, setRegistrationsFilter] = useState<'all' | 'with' | 'without'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<User[]>('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/admin/companies');
      // Filter only autonomous partners (not collaborators)
      const autonomousPartners = response.data.filter((c: any) => !c.parent);
      setCompanies(autonomousPartners.map((c: any) => ({
        id: c.id,
        name: c.name,
        referralCode: c.referralCode
      })));
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleExportUsers = async () => {
    try {
      // Build query params based on active filters
      const params: any = {};

      if (selectedCompany) {
        params.companyId = selectedCompany;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (emailVerifiedFilter !== 'all') {
        params.emailVerified = emailVerifiedFilter;
      }

      if (registrationsFilter !== 'all') {
        params.hasRegistrations = registrationsFilter === 'with' ? 'with' : 'without';
      }

      const response = await api.get('/admin/export/users', {
        params,
        responseType: 'blob'
      });

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Utenti_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting users:', error);
      alert('Errore durante l\'export degli utenti');
    }
  };

  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const handleTransfer = (user: User) => {
    setSelectedUser(user);
    setShowTransferModal(true);
  };

  const handleTransferSuccess = () => {
    fetchUsers();
    setShowTransferModal(false);
  };

  // Apply filters
  const filteredUsers = users.filter((user) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchEmail = user.email.toLowerCase().includes(search);
      const matchNome = user.profile?.nome?.toLowerCase().includes(search);
      const matchCognome = user.profile?.cognome?.toLowerCase().includes(search);
      if (!matchEmail && !matchNome && !matchCognome) return false;
    }

    // Company filter
    if (selectedCompany && user.assignedPartner?.id !== selectedCompany) return false;

    // Status filter
    if (statusFilter === 'active' && !user.isActive) return false;
    if (statusFilter === 'inactive' && user.isActive) return false;

    // Email verified filter
    if (emailVerifiedFilter === 'verified' && !user.emailVerified) return false;
    if (emailVerifiedFilter === 'unverified' && user.emailVerified) return false;

    // Registrations filter
    if (registrationsFilter === 'with' && user._count.registrations === 0) return false;
    if (registrationsFilter === 'without' && user._count.registrations > 0) return false;

    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCompany('');
    setStatusFilter('all');
    setEmailVerifiedFilter('all');
    setRegistrationsFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    selectedCompany ||
    statusFilter !== 'all' ||
    emailVerifiedFilter !== 'all' ||
    registrationsFilter !== 'all';

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    emailVerified: users.filter((u) => u.emailVerified).length,
    withRegistrations: users.filter((u) => u._count.registrations > 0).length,
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
          <h1 className="text-3xl font-bold text-gray-900">Utenti</h1>
          <p className="text-gray-600 mt-2">
            {stats.total} utenti totali
            {hasActiveFilters && ` (${filteredUsers.length} filtrati)`}
          </p>
        </div>
        <button
          onClick={handleExportUsers}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          Esporta Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Utenti</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <UsersIcon className="w-10 h-10 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Utenti Attivi</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Email Verificate</p>
              <p className="text-3xl font-bold text-blue-600">
                {stats.emailVerified}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {((stats.emailVerified / stats.total) * 100).toFixed(1)}%
              </p>
            </div>
            <Mail className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Con Iscrizioni</p>
              <p className="text-3xl font-bold text-purple-600">
                {stats.withRegistrations}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {((stats.withRegistrations / stats.total) * 100).toFixed(1)}%
              </p>
            </div>
            <Building2 className="w-10 h-10 text-purple-600" />
          </div>
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
              placeholder="Cerca per email, nome o cognome..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
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
            Filtri
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
          <div className="pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setSelectedCompany(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tutte le companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Account
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tutti</option>
                <option value="active">Attivi</option>
                <option value="inactive">Disattivati</option>
              </select>
            </div>

            {/* Email Verified Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Verificata
              </label>
              <select
                value={emailVerifiedFilter}
                onChange={(e) => {
                  setEmailVerifiedFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tutte</option>
                <option value="verified">Verificate</option>
                <option value="unverified">Non verificate</option>
              </select>
            </div>

            {/* Registrations Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Iscrizioni
              </label>
              <select
                value={registrationsFilter}
                onChange={(e) => {
                  setRegistrationsFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Tutti</option>
                <option value="with">Con iscrizioni</option>
                <option value="without">Senza iscrizioni</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Iscrizioni
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Registrazione
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.profile?.nome && user.profile?.cognome
                          ? `${user.profile.cognome} ${user.profile.nome}`
                          : user.role === 'ADMIN'
                          ? 'Admin'
                          : user.email.split('@')[0]}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {user.emailVerified ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Verificata
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-yellow-600">
                            <XCircle className="w-3 h-3" />
                            Non verificata
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.assignedPartner ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.assignedPartner.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.assignedPartner.referralCode}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">
                        Nessuna company
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Attivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Disattivato
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {user._count.registrations}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(user)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Visualizza dettaglio"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTransfer(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Trasferisci company"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedUsers.length === 0 && (
          <div className="text-center py-12">
            <UsersIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {hasActiveFilters
                ? 'Nessun utente trovato con questi filtri'
                : 'Nessun utente trovato'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Pagina {currentPage} di {totalPages} ({filteredUsers.length} utenti
            totali)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Precedente
            </button>

            {/* Page Numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      currentPage === pageNum
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Successiva
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedUser && (
        <>
          <UserDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            user={selectedUser}
          />
          <TransferUserModal
            isOpen={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            user={selectedUser}
            companies={companies}
            onSuccess={handleTransferSuccess}
          />
        </>
      )}
    </div>
  );
};