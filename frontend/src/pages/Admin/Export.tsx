import React, { useState, useEffect } from 'react';
import {
  Download,
  FileText,
  Euro,
  Filter,
  CheckCircle,
  Loader,
  AlertCircle,
} from 'lucide-react';
import api from '../../services/api';

interface Company {
  id: string;
  name: string;
  referralCode: string;
}

export const AdminExport: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [success, setSuccess] = useState<{ [key: string]: boolean }>({});

  // Filtri Export Iscrizioni
  const [registrationFilters, setRegistrationFilters] = useState({
    companyId: '',
    status: [] as string[],
    courseType: '',
    dateFrom: '',
    dateTo: '',
  });

  // Filtri Export Revenue
  const [revenueFilters, setRevenueFilters] = useState({
    dateFrom: '',
    dateTo: '',
    onlyActive: true,
    includeBreakdown: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/admin/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleExportRegistrations = async () => {
    try {
      setLoading({ ...loading, registrations: true });

      // Build query params
      const params: any = {};
      if (registrationFilters.companyId) params.companyId = registrationFilters.companyId;
      if (registrationFilters.courseType) params.courseType = registrationFilters.courseType;
      if (registrationFilters.status.length > 0) params.status = registrationFilters.status.join(',');
      if (registrationFilters.dateFrom) params.dateFrom = registrationFilters.dateFrom;
      if (registrationFilters.dateTo) params.dateTo = registrationFilters.dateTo;

      const response = await api.get(
        '/admin/export/registrations',
        {
          params,
          responseType: 'blob'
        }
      );

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Iscrizioni_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess({ ...success, registrations: true });
      setTimeout(() => setSuccess({ ...success, registrations: false }), 3000);
    } catch (error) {
      console.error('Error exporting registrations:', error);
      alert('Errore durante l\'export');
    } finally {
      setLoading({ ...loading, registrations: false });
    }
  };

  const handleExportRevenue = async () => {
    try {
      setLoading({ ...loading, revenue: true });

      // Build query params
      const params: any = {};
      if (revenueFilters.dateFrom) params.dateFrom = revenueFilters.dateFrom;
      if (revenueFilters.dateTo) params.dateTo = revenueFilters.dateTo;
      params.onlyActive = revenueFilters.onlyActive.toString();
      params.includeBreakdown = revenueFilters.includeBreakdown.toString();

      const response = await api.get(
        '/admin/export/revenue',
        {
          params,
          responseType: 'blob'
        }
      );

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Revenue_Companies_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess({ ...success, revenue: true });
      setTimeout(() => setSuccess({ ...success, revenue: false }), 3000);
    } catch (error) {
      console.error('Error exporting revenue:', error);
      alert('Errore durante l\'export');
    } finally {
      setLoading({ ...loading, revenue: false });
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Export & Report</h1>
        <p className="text-gray-600 mt-2">
          Esporta dati piattaforma in formato Excel
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Iscrizioni Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Export Iscrizioni Globali
              </h2>
              <p className="text-sm text-gray-600">
                Esporta tutte le iscrizioni con dati completi
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <select
                value={registrationFilters.companyId}
                onChange={(e) =>
                  setRegistrationFilters({
                    ...registrationFilters,
                    companyId: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutte le company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.referralCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo Corso
              </label>
              <select
                value={registrationFilters.courseType}
                onChange={(e) =>
                  setRegistrationFilters({
                    ...registrationFilters,
                    courseType: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutti i corsi</option>
                <option value="TFA_ROMANIA">TFA Romania</option>
                <option value="CERTIFICATION">Certificazioni</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Da
                </label>
                <input
                  type="date"
                  value={registrationFilters.dateFrom}
                  onChange={(e) =>
                    setRegistrationFilters({
                      ...registrationFilters,
                      dateFrom: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data A
                </label>
                <input
                  type="date"
                  value={registrationFilters.dateTo}
                  onChange={(e) =>
                    setRegistrationFilters({
                      ...registrationFilters,
                      dateTo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportRegistrations}
            disabled={loading.registrations}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading.registrations ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Esportazione in corso...
              </>
            ) : success.registrations ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Export Completato!
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Esporta Iscrizioni (Excel)
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-900 font-medium">
                  Colonne incluse nell'export:
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Dati anagrafici, corso, company, importi, commissioni, rate
                  pagamento, stato documenti
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Export Revenue Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-100 rounded-lg">
              <Euro className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Export Revenue per Company
              </h2>
              <p className="text-sm text-gray-600">
                Report revenue con breakdown commissioni
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Da
                </label>
                <input
                  type="date"
                  value={revenueFilters.dateFrom}
                  onChange={(e) =>
                    setRevenueFilters({
                      ...revenueFilters,
                      dateFrom: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data A
                </label>
                <input
                  type="date"
                  value={revenueFilters.dateTo}
                  onChange={(e) =>
                    setRevenueFilters({
                      ...revenueFilters,
                      dateTo: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={revenueFilters.onlyActive}
                  onChange={(e) =>
                    setRevenueFilters({
                      ...revenueFilters,
                      onlyActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  Solo Company Attive
                </span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={revenueFilters.includeBreakdown}
                  onChange={(e) =>
                    setRevenueFilters({
                      ...revenueFilters,
                      includeBreakdown: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  Include Breakdown per Corso (TFA/Cert)
                </span>
              </label>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportRevenue}
            disabled={loading.revenue}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading.revenue ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Esportazione in corso...
              </>
            ) : success.revenue ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Export Completato!
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Esporta Revenue (Excel)
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-900 font-medium">
                  Colonne incluse nell'export:
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Nome company, commissioni Discovery, revenue totale, guadagno
                  netto, breakdown per tipo corso
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center opacity-60">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Export Audit Log</h3>
          <p className="text-sm text-gray-500">Prossimamente</p>
        </div>

        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center opacity-60">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Export Utenti</h3>
          <p className="text-sm text-gray-500">Prossimamente</p>
        </div>

        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center opacity-60">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700 mb-1">Report PDF</h3>
          <p className="text-sm text-gray-500">Prossimamente</p>
        </div>
      </div>
    </div>
  );
};