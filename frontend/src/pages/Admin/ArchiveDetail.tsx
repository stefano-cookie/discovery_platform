import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

interface ArchivedRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fiscalCode: string;
  birthDate: string;
  phone: string;
  residenceVia: string;
  residenceCity: string;
  residenceProvince: string;
  residenceCap: string;
  companyName: string;
  courseName: string;
  finalAmount: number;
  installments: number;
  totalExpected: number;
  totalPaid: number;
  totalOutstanding: number;
  paymentProgress: number;
  originalYear: number;
  documentsZipUrl?: string;
  documentsZipKey?: string;
  contractPdfUrl?: string;
  contractPdfKey?: string;
  uploadedAt: string;
  payments: Array<{
    id: string;
    type: string;
    label: string;
    expectedAmount: number;
    paidAmount: number;
    status: string;
    installmentNumber?: number;
  }>;
}

const ArchiveDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<ArchivedRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    loadRegistration();
  }, [id]);

  const loadRegistration = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/archive/registrations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRegistration(response.data.registration);
    } catch (err: any) {
      console.error('Errore caricamento iscrizione:', err);
      setError(err.response?.data?.error || 'Errore caricamento iscrizione');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!registration?.documentsZipKey) return;

    try {
      setDownloadingZip(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/archive/download-zip/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Apri signed URL in nuova finestra
      window.open(response.data.downloadUrl, '_blank');
    } catch (err: any) {
      console.error('Errore download ZIP:', err);
      alert(err.response?.data?.error || 'Errore download documenti');
    } finally {
      setDownloadingZip(false);
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

  const getPaymentStatusBadge = (status: string) => {
    const badges = {
      PAID: <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Pagato</span>,
      PARTIAL: <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Parziale</span>,
      UNPAID: <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Non pagato</span>
    };
    return badges[status as keyof typeof badges] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Iscrizione non trovata'}
        </div>
        <button
          onClick={() => navigate('/admin/archive')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          ← Torna all'archivio
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/archive')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Torna all'archivio
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          Dettaglio Iscrizione Archiviata
        </h1>
        <p className="mt-2 text-gray-600">
          {registration.firstName} {registration.lastName} - {registration.originalYear}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Anagrafica */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Anagrafica</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Nome:</span>
                <div className="font-medium">{registration.firstName} {registration.lastName}</div>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>
                <div className="font-medium">{registration.email}</div>
              </div>
              <div>
                <span className="text-gray-600">Codice Fiscale:</span>
                <div className="font-medium">{registration.fiscalCode}</div>
              </div>
              <div>
                <span className="text-gray-600">Data di Nascita:</span>
                <div className="font-medium">{formatDate(registration.birthDate)}</div>
              </div>
              <div>
                <span className="text-gray-600">Telefono:</span>
                <div className="font-medium">{registration.phone}</div>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Residenza:</span>
                <div className="font-medium">
                  {registration.residenceVia}, {registration.residenceCap} {registration.residenceCity} ({registration.residenceProvince})
                </div>
              </div>
            </div>
          </div>

          {/* Corso e Company */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Corso e Azienda</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Azienda:</span>
                <div className="font-medium">{registration.companyName}</div>
              </div>
              <div>
                <span className="text-gray-600">Corso:</span>
                <div className="font-medium">{registration.courseName}</div>
              </div>
              <div>
                <span className="text-gray-600">Anno Iscrizione:</span>
                <div className="font-medium">{registration.originalYear}</div>
              </div>
              <div>
                <span className="text-gray-600">Importo Finale:</span>
                <div className="font-medium text-blue-600">{formatCurrency(registration.finalAmount)}</div>
              </div>
            </div>
          </div>

          {/* Pagamenti */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Pagamenti</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dovuto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagato</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registration.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {payment.label}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(payment.expectedAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(payment.paidAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getPaymentStatusBadge(payment.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Totali */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Pagamenti</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between pb-2 border-b">
                <span className="text-gray-600">Totale Dovuto:</span>
                <span className="font-semibold text-blue-600">{formatCurrency(registration.totalExpected)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="text-gray-600">Totale Pagato:</span>
                <span className="font-semibold text-green-600">{formatCurrency(registration.totalPaid)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b">
                <span className="text-gray-600">Residuo:</span>
                <span className="font-semibold text-red-600">{formatCurrency(registration.totalOutstanding)}</span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Progresso:</span>
                  <span className="font-semibold">{Number(registration.paymentProgress).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${Number(registration.paymentProgress)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Documenti */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documenti</h2>
            <div className="space-y-3">
              {/* ZIP Documenti */}
              {registration.documentsZipKey ? (
                <button
                  onClick={handleDownloadZip}
                  disabled={downloadingZip}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {downloadingZip ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Download...
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Scarica ZIP Documenti
                    </>
                  )}
                </button>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Nessun ZIP documenti caricato
                </div>
              )}

              {/* Contratto PDF */}
              {registration.contractPdfUrl ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPdfPreview(!showPdfPreview)}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {showPdfPreview ? 'Nascondi' : 'Visualizza'} Contratto PDF
                  </button>

                  {showPdfPreview && (
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        src={registration.contractPdfUrl}
                        className="w-full h-96"
                        title="Contratto PDF Preview"
                      />
                    </div>
                  )}

                  <a
                    href={registration.contractPdfUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center px-4 py-2 border border-green-600 text-green-600 rounded-lg hover:bg-green-50"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Scarica Contratto
                  </a>
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Nessun contratto PDF caricato
                </div>
              )}
            </div>
          </div>

          {/* Azioni */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/admin/archive/${id}/edit`)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Modifica Iscrizione
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Sei sicuro di voler eliminare questa iscrizione archiviata?')) {
                    // TODO: implementare delete
                  }
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Elimina Iscrizione
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveDetail;
