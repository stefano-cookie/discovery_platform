import React, { useEffect, useState } from 'react';
import {
  FileText,
  Filter,
  Download,
  Clock,
  User,
  Building2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  performedBy?: string | null; // Nome e Cognome dell'admin
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  previousValue: any;
  newValue: any;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });

  // Filtri
  const [filters, setFilters] = useState({
    action: '',
    targetType: '',
    dateFrom: '',
    dateTo: '',
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.targetType) params.append('targetType', filters.targetType);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const response = await api.get(`/admin/logs?${params.toString()}`);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-green-700 bg-green-100 border-green-200';
    if (action.includes('EDIT') || action.includes('CHANGE')) return 'text-blue-700 bg-blue-100 border-blue-200';
    if (action.includes('DELETE') || action.includes('DISABLE')) return 'text-red-700 bg-red-100 border-red-200';
    if (action.includes('EXPORT')) return 'text-purple-700 bg-purple-100 border-purple-200';
    return 'text-gray-700 bg-gray-100 border-gray-200';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return <CheckCircle className="w-4 h-4" />;
    if (action.includes('DELETE') || action.includes('DISABLE')) return <XCircle className="w-4 h-4" />;
    if (action.includes('EXPORT')) return <Download className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getTargetIcon = (targetType: string) => {
    if (targetType === 'COMPANY') return <Building2 className="w-4 h-4" />;
    if (targetType === 'USER') return <User className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const resetFilters = () => {
    setFilters({
      action: '',
      targetType: '',
      dateFrom: '',
      dateTo: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">
          Tracciamento completo di tutte le azioni amministrative
        </p>
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              showFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtri
          </button>

          {(filters.action || filters.targetType || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              <XCircle className="w-4 h-4" />
              Reset Filtri
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtri Ricerca</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Azione
              </label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tutte le azioni</option>
                <option value="COMPANY_CREATE">Company Create</option>
                <option value="COMPANY_EDIT">Company Edit</option>
                <option value="COMPANY_DISABLE">Company Disable</option>
                <option value="USER_TRANSFER">User Transfer</option>
                <option value="REGISTRATION_TRANSFER">Registration Transfer</option>
                <option value="EXPORT_DATA">Export Data</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Target
              </label>
              <select
                value={filters.targetType}
                onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Tutti i tipi</option>
                <option value="COMPANY">Company</option>
                <option value="USER">User</option>
                <option value="REGISTRATION">Registration</option>
                <option value="SYSTEM">System</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Da
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data A
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Info */}
      <div className="mb-4 text-sm text-gray-600">
        Mostrando {logs.length} di {pagination.total} log • Pagina {pagination.page} di {pagination.pages}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun log trovato</h3>
          <p className="text-gray-600">Prova a modificare i filtri di ricerca</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Timeline dot */}
                <div className="flex-shrink-0 mt-1">
                  <div className={`p-2 rounded-lg border ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Admin:</span>
                      <span className="font-medium text-gray-900">
                        {log.performedBy || log.adminEmail}
                      </span>
                      {log.performedBy && (
                        <span className="text-xs text-gray-500">({log.adminEmail})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {getTargetIcon(log.targetType)}
                      <span className="text-gray-600">Target:</span>
                      <span className="font-medium text-gray-900">{log.targetName}</span>
                      <span className="text-xs text-gray-500">({log.targetType})</span>
                    </div>

                    {log.reason && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                          <strong>Motivo:</strong> {log.reason}
                        </p>
                      </div>
                    )}

                    {(log.previousValue || log.newValue) && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                          Mostra dettagli modifiche
                        </summary>
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg space-y-3">
                          {log.previousValue && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Prima:</p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(log.previousValue, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-1">Dopo:</p>
                              <pre className="text-xs text-gray-600 overflow-x-auto">
                                {JSON.stringify(log.newValue, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>

                {/* IP Address Badge */}
                {log.ipAddress && (
                  <div className="flex-shrink-0">
                    <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
                      {log.ipAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Precedente
          </button>

          <span className="px-4 py-2 text-sm text-gray-600">
            Pagina {pagination.page} di {pagination.pages}
          </span>

          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Successivo
          </button>
        </div>
      )}
    </div>
  );
};