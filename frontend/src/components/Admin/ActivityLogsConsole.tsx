/**
 * Activity Logs Console - Discovery Admin Dashboard
 *
 * Console real-time per monitoraggio attività partner
 */

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Play,
  Pause,
  Download,
  X,
  Filter,
  Activity,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  partnerEmployeeId: string;
  partnerCompanyId: string;
  action: string;
  category: 'CRITICAL' | 'WARNING' | 'INFO';
  method?: string;
  endpoint?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  isSuccess: boolean;
  errorCode?: string;
  duration?: number;
  createdAt: string;
  partnerEmployee: {
    email: string;
    firstName: string;
    lastName: string;
  };
  partnerCompany: {
    name: string;
    referralCode: string;
  };
}

const CATEGORY_COLORS = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  INFO: 'bg-blue-100 text-blue-800 border-blue-200',
} as const;

const CATEGORY_ROW_COLORS = {
  CRITICAL: 'bg-red-50',
  WARNING: 'bg-yellow-50',
  INFO: 'bg-transparent',
} as const;

export const ActivityLogsConsole: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    partnerCompanyId: '',
    action: '',
  });

  const socketRef = useRef<Socket | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  /**
   * WebSocket connection
   */
  useEffect(() => {
    // Remove /api suffix from REACT_APP_API_URL since WebSocket is on base domain
    const baseApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const wsUrl = baseApiUrl.replace('/api', '');

    const socket = io(`${wsUrl}/activity-logs`, {
      transports: ['websocket'],
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ActivityLogsConsole] Connected to WebSocket');

      // Subscribe con filtri
      const subscribeFilters: any = {};
      if (filters.category !== 'all') subscribeFilters.category = filters.category;
      if (filters.partnerCompanyId) subscribeFilters.partnerCompanyId = filters.partnerCompanyId;
      if (filters.action) subscribeFilters.actions = [filters.action];

      socket.emit('subscribe', subscribeFilters);
    });

    socket.on('subscribed', ({ success, filters: appliedFilters }) => {
      console.log('[ActivityLogsConsole] Subscribed with filters:', appliedFilters);
    });

    socket.on('activityLog', (log: ActivityLog) => {
      if (isStreaming) {
        setLogs((prev) => [log, ...prev].slice(0, 500)); // Limita a 500 log
      }
    });

    socket.on('adminNotification', (notification: any) => {
      console.log('[ActivityLogsConsole] Admin notification:', notification);
    });

    socket.on('disconnect', () => {
      console.log('[ActivityLogsConsole] Disconnected from WebSocket');
    });

    return () => {
      socket.disconnect();
    };
  }, [filters, isStreaming]);

  /**
   * Auto-scroll al nuovo log
   */
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  /**
   * Toggle streaming
   */
  const toggleStreaming = () => {
    setIsStreaming(!isStreaming);

    if (!isStreaming && socketRef.current) {
      const subscribeFilters: any = {};
      if (filters.category !== 'all') subscribeFilters.category = filters.category;
      if (filters.partnerCompanyId) subscribeFilters.partnerCompanyId = filters.partnerCompanyId;

      socketRef.current.emit('subscribe', subscribeFilters);
    } else if (socketRef.current) {
      socketRef.current.emit('unsubscribe');
    }
  };

  /**
   * Clear logs
   */
  const clearLogs = () => {
    setLogs([]);
  };

  /**
   * Export logs
   */
  const exportLogs = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const params = new URLSearchParams({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        format: 'csv',
      });

      if (filters.partnerCompanyId) {
        params.append('partnerCompanyId', filters.partnerCompanyId);
      }

      const response = await fetch(
        `${API_URL}/api/admin/activity-logs/export?${params}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[ActivityLogsConsole] Export error:', error);
      alert('Errore durante export');
    }
  };

  /**
   * Update filters
   */
  const updateFilters = (newFilters: typeof filters) => {
    setFilters(newFilters);

    if (socketRef.current && isStreaming) {
      const subscribeFilters: any = {};
      if (newFilters.category !== 'all') subscribeFilters.category = newFilters.category;
      if (newFilters.partnerCompanyId) subscribeFilters.partnerCompanyId = newFilters.partnerCompanyId;
      if (newFilters.action) subscribeFilters.actions = [newFilters.action];

      socketRef.current.emit('updateFilters', subscribeFilters);
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs Console</h1>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                isStreaming
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isStreaming ? 'LIVE' : 'PAUSED'}
            </span>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-scroll
            </label>

            <button
              onClick={toggleStreaming}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title={isStreaming ? 'Pause' : 'Resume'}
            >
              {isStreaming ? (
                <Pause className="w-5 h-5 text-gray-700" />
              ) : (
                <Play className="w-5 h-5 text-gray-700" />
              )}
            </button>

            <button
              onClick={clearLogs}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Clear logs"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>

            <button
              onClick={exportLogs}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Export CSV"
            >
              <Download className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Filtri */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="w-4 h-4 inline mr-1" />
              Categoria
            </label>
            <select
              value={filters.category}
              onChange={(e) => updateFilters({ ...filters, category: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Tutte</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company ID
            </label>
            <input
              type="text"
              value={filters.partnerCompanyId}
              onChange={(e) => updateFilters({ ...filters, partnerCompanyId: e.target.value })}
              placeholder="UUID azienda..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => updateFilters({ ...filters, action: e.target.value })}
              placeholder="LOGIN, CREATE_EMPLOYEE..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            📊 Mostrando ultimi <strong>{logs.length}</strong> log in tempo reale (max 500)
          </p>
        </div>
      </div>

      {/* Console Logs */}
      <div
        ref={logsContainerRef}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto"
        style={{ height: 'calc(100vh - 450px)' }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Timestamp</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Resource</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr
                key={log.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  CATEGORY_ROW_COLORS[log.category]
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {formatTime(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium border ${
                      CATEGORY_COLORS[log.category]
                    }`}
                  >
                    {log.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-900">{log.partnerCompany.name}</td>
                <td className="px-4 py-3 text-gray-900">
                  {log.partnerEmployee.firstName} {log.partnerEmployee.lastName}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{log.action}</td>
                <td className="px-4 py-3">
                  {log.resourceType && (
                    <span className="font-mono text-xs text-gray-600">
                      {log.resourceType}:{log.resourceId?.slice(0, 8)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      log.isSuccess
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                  >
                    {log.isSuccess ? 'OK' : log.errorCode || 'ERROR'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.duration ? `${log.duration}ms` : '-'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.ipAddress}</td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  {isStreaming
                    ? '⏳ In attesa di nuovi log...'
                    : '⏸️ Streaming in pausa'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
