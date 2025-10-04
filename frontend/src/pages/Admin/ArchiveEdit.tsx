import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface PaymentItem {
  id?: string;
  type: 'DEPOSIT' | 'INSTALLMENT';
  label: string;
  installmentNumber: number | null;
  expectedAmount: string;
  paidAmount: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

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
  originalYear: number;
  payments: Array<{
    id: string;
    type: 'DEPOSIT' | 'INSTALLMENT';
    label: string;
    installmentNumber: number | null;
    expectedAmount: number;
    paidAmount: number;
    status: 'PAID' | 'PARTIAL' | 'UNPAID';
  }>;
}

const ArchiveEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Anagrafica
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [residenceVia, setResidenceVia] = useState('');
  const [residenceCity, setResidenceCity] = useState('');
  const [residenceProvince, setResidenceProvince] = useState('');
  const [residenceCap, setResidenceCap] = useState('');

  // Company e Corso
  const [companyName, setCompanyName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [installments, setInstallments] = useState('');
  const [originalYear, setOriginalYear] = useState('');

  // Pagamenti
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  // Carica dati esistenti
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

      const reg: ArchivedRegistration = response.data.registration;

      // Popola form
      setFirstName(reg.firstName);
      setLastName(reg.lastName);
      setEmail(reg.email);
      setFiscalCode(reg.fiscalCode);
      setBirthDate(reg.birthDate.split('T')[0]); // YYYY-MM-DD
      setPhone(reg.phone);
      setResidenceVia(reg.residenceVia);
      setResidenceCity(reg.residenceCity);
      setResidenceProvince(reg.residenceProvince);
      setResidenceCap(reg.residenceCap);
      setCompanyName(reg.companyName);
      setCourseName(reg.courseName);
      setFinalAmount(reg.finalAmount.toString());
      setInstallments(reg.installments.toString());
      setOriginalYear(reg.originalYear.toString());

      // Converti pagamenti
      const paymentsData = reg.payments.map(p => ({
        id: p.id,
        type: p.type,
        label: p.label,
        installmentNumber: p.installmentNumber,
        expectedAmount: p.expectedAmount.toString(),
        paidAmount: p.paidAmount.toString(),
        status: p.status
      }));
      setPayments(paymentsData);
    } catch (err: any) {
      console.error('Errore caricamento:', err);
      setError(err.response?.data?.error || 'Errore durante il caricamento');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentChange = (index: number, field: keyof PaymentItem, value: any) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-aggiorna status in base ai valori
    if (field === 'paidAmount' || field === 'expectedAmount') {
      const expected = parseFloat(updated[index].expectedAmount) || 0;
      const paid = parseFloat(updated[index].paidAmount) || 0;

      if (paid === 0) {
        updated[index].status = 'UNPAID';
      } else if (paid >= expected) {
        updated[index].status = 'PAID';
        updated[index].paidAmount = expected.toString(); // Cap al massimo
      } else {
        updated[index].status = 'PARTIAL';
      }
    }

    setPayments(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.patch(
        `${API_URL}/admin/archive/registrations/${id}`,
        {
          firstName,
          lastName,
          email,
          fiscalCode,
          birthDate,
          phone,
          residenceVia,
          residenceCity,
          residenceProvince,
          residenceCap,
          companyName,
          courseName,
          finalAmount: parseFloat(finalAmount),
          installments: parseInt(installments),
          originalYear: parseInt(originalYear),
          payments: payments.map(p => ({
            type: p.type,
            label: p.label,
            installmentNumber: p.installmentNumber,
            expectedAmount: parseFloat(p.expectedAmount),
            paidAmount: parseFloat(p.paidAmount),
            status: p.status
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        navigate('/admin/archive');
      }
    } catch (err: any) {
      console.error('Errore salvataggio:', err);
      setError(err.response?.data?.error || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotals = () => {
    const totalExpected = payments.reduce((sum, p) => sum + parseFloat(p.expectedAmount || '0'), 0);
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.paidAmount || '0'), 0);
    const totalOutstanding = totalExpected - totalPaid;
    const progress = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

    return { totalExpected, totalPaid, totalOutstanding, progress };
  };

  const totals = calculateTotals();

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/archive')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Torna all'Archivio
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Modifica Iscrizione Archiviata</h1>
        <p className="mt-2 text-gray-600">
          {firstName} {lastName} - {companyName}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Anagrafica */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Anagrafica</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  value={fiscalCode}
                  onChange={(e) => setFiscalCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data di Nascita</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Residenza */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Residenza</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Via</label>
                <input
                  type="text"
                  value={residenceVia}
                  onChange={(e) => setResidenceVia(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                <input
                  type="text"
                  value={residenceCity}
                  onChange={(e) => setResidenceCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    value={residenceProvince}
                    onChange={(e) => setResidenceProvince(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                  <input
                    type="text"
                    value={residenceCap}
                    onChange={(e) => setResidenceCap(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Company e Corso */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Company e Corso</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Azienda</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corso</label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anno</label>
                <input
                  type="number"
                  value={originalYear}
                  onChange={(e) => setOriginalYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Importo Totale</label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Pagamenti */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Pagamenti</h2>
            <div className="space-y-4">
              {payments.map((payment, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {payment.type === 'DEPOSIT' ? 'Acconto' : `Rata ${payment.installmentNumber}`}
                      </label>
                      <input
                        type="text"
                        value={payment.label}
                        onChange={(e) => handlePaymentChange(index, 'label', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="Etichetta"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Dovuto</label>
                      <input
                        type="number"
                        value={payment.expectedAmount}
                        onChange={(e) => handlePaymentChange(index, 'expectedAmount', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Pagato</label>
                      <input
                        type="number"
                        value={payment.paidAmount}
                        onChange={(e) => handlePaymentChange(index, 'paidAmount', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <div className="flex items-center h-8">
                        {payment.status === 'PAID' && (
                          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">Pagato</span>
                        )}
                        {payment.status === 'PARTIAL' && (
                          <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Parziale</span>
                        )}
                        {payment.status === 'UNPAID' && (
                          <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">Non Pagato</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Riepilogo Pagamenti</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Totale Dovuto:</span>
                <span className="font-medium">€{totals.totalExpected.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Totale Incassato:</span>
                <span className="font-medium text-green-600">€{totals.totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Residuo:</span>
                <span className="font-medium text-red-600">€{totals.totalOutstanding.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Completamento:</span>
                  <span className="font-medium">{totals.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(totals.progress, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
              </button>
              <button
                onClick={() => navigate('/admin/archive')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveEdit;
