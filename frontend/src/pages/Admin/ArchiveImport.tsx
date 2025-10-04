import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface ExcelRow {
  // Anagrafica
  Nome: string;
  Cognome: string;
  'Data di Nascita': string; // formato: YYYY-MM-DD o DD/MM/YYYY
  Email: string;
  'Codice Fiscale': string;
  Telefono: string;
  Via: string;
  Città: string;
  Provincia: string;
  CAP: string;

  // Company e Corso
  Azienda: string;
  Corso: string;

  // Importi
  'Importo Totale': number;
  'Numero Rate': number;
  Anno: number;

  // Pagamenti (formato CSV separato da ; per multiple righe)
  // Es: "DEPOSIT|Acconto||500|500|PAID;INSTALLMENT|Rata 1|1|250|250|PAID;INSTALLMENT|Rata 2|2|250|0|UNPAID"
  Pagamenti: string;
}

interface ParsedRegistration {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  fiscalCode: string;
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
    type: 'DEPOSIT' | 'INSTALLMENT';
    label: string;
    installmentNumber: number | null;
    expectedAmount: number;
    paidAmount: number;
    status: 'PAID' | 'PARTIAL' | 'UNPAID';
  }>;
}

const ArchiveImport: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRegistration[]>([]);
  const [importResults, setImportResults] = useState<any>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    // Verifica che sia un file Excel
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Solo file Excel (.xlsx, .xls) sono permessi');
      return;
    }

    setFile(selectedFile);
    setParsedData([]);
    setImportResults(null);
    setError('');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const parseDate = (dateStr: string): string => {
    // Supporta formati: YYYY-MM-DD, DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr; // Assume già formato YYYY-MM-DD
  };

  const parsePayments = (paymentsStr: string) => {
    if (!paymentsStr || paymentsStr.trim() === '') {
      throw new Error('Nessun pagamento specificato');
    }

    const paymentRows = paymentsStr.split(';');
    return paymentRows.map((row) => {
      const parts = row.trim().split('|');
      if (parts.length !== 6) {
        throw new Error(`Formato pagamento non valido: ${row}`);
      }

      const [type, label, installmentNum, expectedAmount, paidAmount, status] = parts;

      return {
        type: type as 'DEPOSIT' | 'INSTALLMENT',
        label,
        installmentNumber: installmentNum ? parseInt(installmentNum) : null,
        expectedAmount: parseFloat(expectedAmount),
        paidAmount: parseFloat(paidAmount),
        status: status as 'PAID' | 'PARTIAL' | 'UNPAID'
      };
    });
  };

  const parseExcelFile = async () => {
    if (!file) {
      setError('Seleziona un file Excel');
      return;
    }

    try {
      setParsing(true);
      setError('');

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

      const registrations: ParsedRegistration[] = jsonData.map((row, index) => {
        try {
          return {
            firstName: row.Nome,
            lastName: row.Cognome,
            birthDate: parseDate(row['Data di Nascita']),
            email: row.Email,
            fiscalCode: row['Codice Fiscale'],
            phone: row.Telefono,
            residenceVia: row.Via,
            residenceCity: row.Città,
            residenceProvince: row.Provincia,
            residenceCap: row.CAP,
            companyName: row.Azienda,
            courseName: row.Corso,
            finalAmount: parseFloat(String(row['Importo Totale'])),
            installments: parseInt(String(row['Numero Rate'])),
            originalYear: parseInt(String(row.Anno)),
            payments: parsePayments(row.Pagamenti)
          };
        } catch (err: any) {
          throw new Error(`Riga ${index + 2}: ${err.message}`);
        }
      });

      setParsedData(registrations);
      setError('');
    } catch (err: any) {
      console.error('Errore parsing Excel:', err);
      setError(err.message || 'Errore durante il parsing del file Excel');
      setParsedData([]);
    } finally {
      setParsing(false);
    }
  };

  const importToArchive = async () => {
    if (parsedData.length === 0) {
      setError('Nessun dato da importare');
      return;
    }

    try {
      setImporting(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/admin/archive/import-excel`,
        { registrations: parsedData },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setImportResults(response.data.results);
    } catch (err: any) {
      console.error('Errore import:', err);
      setError(err.response?.data?.error || 'Errore durante l\'import');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Crea Excel template di esempio
    const template: ExcelRow[] = [
      {
        Nome: 'Mario',
        Cognome: 'Rossi',
        'Data di Nascita': '1990-01-15',
        Email: 'mario.rossi@example.com',
        'Codice Fiscale': 'RSSMRA90A15H501X',
        Telefono: '3331234567',
        Via: 'Via Roma 123',
        Città: 'Milano',
        Provincia: 'MI',
        CAP: '20100',
        Azienda: 'Azienda Diamante',
        Corso: 'CFO Executive',
        'Importo Totale': 1000,
        'Numero Rate': 2,
        Anno: 2023,
        Pagamenti: 'DEPOSIT|Acconto||500|500|PAID;INSTALLMENT|Rata 1|1|250|250|PAID;INSTALLMENT|Rata 2|2|250|0|UNPAID'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Iscrizioni');

    // Download
    XLSX.writeFile(workbook, 'template_archivio_iscrizioni.xlsx');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/archive')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Torna all'Archivio
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Import Excel Archivio</h1>
        <p className="mt-2 text-gray-600">
          Importa iscrizioni storiche da file Excel
        </p>
      </div>

      {/* Template Download */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-900">
              Template Excel
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Scarica il template Excel di esempio per capire il formato richiesto.
              </p>
              <p className="mt-2">
                <strong>Formato Pagamenti:</strong> Usa il separatore <code className="bg-blue-100 px-1 rounded">;</code> per separare i pagamenti.
                <br />
                Formato: <code className="bg-blue-100 px-1 rounded">TIPO|Label|NumRata|Importo|Pagato|Status</code>
                <br />
                Es: <code className="bg-blue-100 px-1 rounded text-xs">DEPOSIT|Acconto||500|500|PAID;INSTALLMENT|Rata 1|1|250|250|PAID</code>
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                📥 Scarica Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">1. Carica File Excel</h2>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="text-center">
            <svg
              className={`mx-auto h-12 w-12 transition-colors ${
                isDragging ? 'text-blue-500' : 'text-gray-400'
              }`}
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label className="cursor-pointer">
                <span className={`mt-2 block text-sm font-medium ${
                  isDragging ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {file ? (
                    <>
                      <span className="inline-flex items-center">
                        <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {file.name}
                      </span>
                    </>
                  ) : isDragging ? (
                    'Rilascia il file qui'
                  ) : (
                    'Trascina il file Excel qui oppure clicca per selezionare'
                  )}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  XLSX o XLS fino a 10MB
                </span>
              </label>
            </div>
            {file && (
              <button
                onClick={parseExcelFile}
                disabled={parsing}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {parsing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Parsing in corso...
                  </span>
                ) : (
                  'Analizza File'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Parsed Data Preview */}
      {parsedData.length > 0 && !importResults && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">2. Anteprima Dati ({parsedData.length} iscrizioni)</h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Azienda</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Corso</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Anno</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pagamenti</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedData.map((reg, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">{index + 1}</td>
                    <td className="px-4 py-2 text-sm">
                      {reg.firstName} {reg.lastName}
                    </td>
                    <td className="px-4 py-2 text-sm">{reg.email}</td>
                    <td className="px-4 py-2 text-sm">{reg.companyName}</td>
                    <td className="px-4 py-2 text-sm">{reg.courseName}</td>
                    <td className="px-4 py-2 text-sm">{reg.originalYear}</td>
                    <td className="px-4 py-2 text-sm">{reg.payments.length} rate</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={importToArchive}
              disabled={importing}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {importing ? 'Importazione in corso...' : `Importa ${parsedData.length} Iscrizioni`}
            </button>
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">3. Risultati Import</h2>

          {/* Success */}
          {importResults.success > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-900">
                    {importResults.success} iscrizioni importate con successo
                  </h3>
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {importResults.errors && importResults.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-900 mb-2">
                    {importResults.errors.length} errori
                  </h3>
                  <div className="text-sm text-red-700 space-y-1">
                    {importResults.errors.map((err: any, index: number) => (
                      <div key={index}>
                        {err.registration?.email || 'Sconosciuto'}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setParsedData([]);
                setImportResults(null);
                setFile(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Importa Altri
            </button>
            <button
              onClick={() => navigate('/admin/archive')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Torna all'Archivio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveImport;
