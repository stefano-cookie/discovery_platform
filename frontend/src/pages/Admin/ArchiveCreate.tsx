import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface PaymentItem {
  type: 'DEPOSIT' | 'INSTALLMENT';
  label: string;
  installmentNumber: number | null;
  expectedAmount: string;
  paidAmount: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

const STORAGE_KEY = 'archiveCreateFormData';

const ArchiveCreate: React.FC = () => {
  const navigate = useNavigate();

  // Carica dati da localStorage se esistono
  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.error('Errore caricamento localStorage:', err);
      return null;
    }
  };

  const savedData = loadFromStorage();

  const [currentStep, setCurrentStep] = useState(savedData?.currentStep || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Anagrafica
  const [firstName, setFirstName] = useState(savedData?.firstName || '');
  const [lastName, setLastName] = useState(savedData?.lastName || '');
  const [email, setEmail] = useState(savedData?.email || '');
  const [fiscalCode, setFiscalCode] = useState(savedData?.fiscalCode || '');
  const [birthDate, setBirthDate] = useState(savedData?.birthDate || '');
  const [phone, setPhone] = useState(savedData?.phone || '');
  const [residenceVia, setResidenceVia] = useState(savedData?.residenceVia || '');
  const [residenceCity, setResidenceCity] = useState(savedData?.residenceCity || '');
  const [residenceProvince, setResidenceProvince] = useState(savedData?.residenceProvince || '');
  const [residenceCap, setResidenceCap] = useState(savedData?.residenceCap || '');

  // Step 2: Company
  const [companyName, setCompanyName] = useState(savedData?.companyName || '');

  // Step 3: Corso e Pagamenti
  const [courseName, setCourseName] = useState(savedData?.courseName || '');
  const [finalAmount, setFinalAmount] = useState(savedData?.finalAmount || '');
  const [installments, setInstallments] = useState(savedData?.installments || '4');
  const [originalYear, setOriginalYear] = useState(savedData?.originalYear || new Date().getFullYear().toString());
  const [isSinglePayment, setIsSinglePayment] = useState(savedData?.isSinglePayment || false);

  // Step 3b: Importi Manuali
  const [depositAmount, setDepositAmount] = useState(savedData?.depositAmount || '');
  const [installmentAmount, setInstallmentAmount] = useState(savedData?.installmentAmount || '');

  // Step 4: Pagamenti dettagliati
  const [payments, setPayments] = useState<PaymentItem[]>(savedData?.payments || []);

  // Step 5: Documenti
  const [documentsZipUrl, setDocumentsZipUrl] = useState(savedData?.documentsZipUrl || '');
  const [documentsZipKey, setDocumentsZipKey] = useState(savedData?.documentsZipKey || '');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Contratto PDF
  const [contractPdfUrl, setContractPdfUrl] = useState(savedData?.contractPdfUrl || '');
  const [contractPdfKey, setContractPdfKey] = useState(savedData?.contractPdfKey || '');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractUploadProgress, setContractUploadProgress] = useState(0);

  // Drag & Drop states
  const [isDraggingZip, setIsDraggingZip] = useState(false);
  const [isDraggingContract, setIsDraggingContract] = useState(false);

  // Salva automaticamente in localStorage quando cambiano i dati
  React.useEffect(() => {
    const dataToSave = {
      currentStep,
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
      finalAmount,
      installments,
      originalYear,
      isSinglePayment,
      depositAmount,
      installmentAmount,
      payments,
      documentsZipUrl,
      documentsZipKey,
      contractPdfUrl,
      contractPdfKey
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (err) {
      console.error('Errore salvataggio localStorage:', err);
    }
  }, [
    currentStep,
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
    finalAmount,
    installments,
    originalYear,
    isSinglePayment,
    depositAmount,
    installmentAmount,
    payments,
    documentsZipUrl,
    documentsZipKey,
    contractPdfUrl,
    contractPdfKey
  ]);

  // Resetta localStorage
  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Errore pulizia localStorage:', err);
    }
  };

  // Genera pagamenti quando si passa allo step 4
  const generatePaymentsManual = () => {
    // Pagamento unico
    if (isSinglePayment) {
      const total = parseFloat(finalAmount);
      if (isNaN(total) || total <= 0) {
        return;
      }

      const newPayments: PaymentItem[] = [
        {
          type: 'DEPOSIT',
          label: 'Pagamento Unico',
          installmentNumber: null,
          expectedAmount: total.toFixed(2),
          paidAmount: '0',
          status: 'UNPAID'
        }
      ];

      setPayments(newPayments);
      return;
    }

    // Pagamento con acconto + rate
    const numInstallments = parseInt(installments);
    const deposit = parseFloat(depositAmount);
    const installment = parseFloat(installmentAmount);

    if (isNaN(numInstallments) || isNaN(deposit) || isNaN(installment) || numInstallments < 1) {
      return;
    }

    const newPayments: PaymentItem[] = [
      {
        type: 'DEPOSIT',
        label: 'Acconto',
        installmentNumber: null,
        expectedAmount: deposit.toFixed(2),
        paidAmount: '0',
        status: 'UNPAID'
      }
    ];

    for (let i = 1; i <= numInstallments; i++) {
      newPayments.push({
        type: 'INSTALLMENT',
        label: `Rata ${i}`,
        installmentNumber: i,
        expectedAmount: installment.toFixed(2),
        paidAmount: '0',
        status: 'UNPAID'
      });
    }

    setPayments(newPayments);
  };

  const updatePaymentStatus = (index: number, status: 'PAID' | 'PARTIAL' | 'UNPAID') => {
    const newPayments = [...payments];
    const currentPaid = parseFloat(newPayments[index].paidAmount || '0');
    const expected = parseFloat(newPayments[index].expectedAmount);

    newPayments[index].status = status;

    if (status === 'PAID') {
      // Solo se non c'è già un valore inserito, usa l'importo atteso
      if (currentPaid === 0) {
        newPayments[index].paidAmount = newPayments[index].expectedAmount;
      }
      // Altrimenti mantieni il valore già inserito
    } else if (status === 'UNPAID') {
      newPayments[index].paidAmount = '0';
    }
    // Per PARTIAL non modificare il paidAmount

    setPayments(newPayments);
  };

  const updatePaidAmount = (index: number, value: string) => {
    const newPayments = [...payments];
    const paid = parseFloat(value) || 0;
    const expected = parseFloat(newPayments[index].expectedAmount);

    // Se pagamento è 0
    if (paid === 0) {
      newPayments[index].paidAmount = '0';
      newPayments[index].status = 'UNPAID';
      setPayments(newPayments);
      return;
    }

    // Se pagamento copre esattamente o meno del dovuto
    if (paid < expected) {
      newPayments[index].paidAmount = value;
      newPayments[index].status = 'PARTIAL';
      setPayments(newPayments);
      return;
    }

    // Se pagamento è >= dovuto
    newPayments[index].status = 'PAID';

    // Calcola surplus (eccedenza)
    let surplus = paid - expected;

    // Mantieni l'importo pagato sulla rata corrente (non limitarlo a expected)
    newPayments[index].paidAmount = value;

    // Distribuisci il surplus alle rate precedenti con residuo
    if (surplus > 0) {
      for (let i = index - 1; i >= 0; i--) {
        if (surplus <= 0) break;

        const previousExpected = parseFloat(newPayments[i].expectedAmount);
        const previousPaid = parseFloat(newPayments[i].paidAmount || '0');
        const previousOutstanding = previousExpected - previousPaid;

        if (previousOutstanding > 0) {
          // Applica il surplus al residuo
          const amountToApply = Math.min(surplus, previousOutstanding);
          const newPaidAmount = previousPaid + amountToApply;

          newPayments[i].paidAmount = newPaidAmount.toFixed(2);

          // Aggiorna status
          if (newPaidAmount >= previousExpected) {
            newPayments[i].status = 'PAID';
          } else if (newPaidAmount > 0) {
            newPayments[i].status = 'PARTIAL';
          }

          surplus -= amountToApply;
        }
      }
    }

    setPayments(newPayments);
  };

  // Calcola quanto residuo totale c'è prima di una determinata rata
  const getOutstandingBeforeIndex = (beforeIndex: number) => {
    let outstanding = 0;
    for (let i = 0; i < beforeIndex; i++) {
      const expected = parseFloat(payments[i].expectedAmount);
      const paid = parseFloat(payments[i].paidAmount || '0');
      outstanding += expected - paid;
    }
    return outstanding;
  };

  const calculateTotals = () => {
    const totalExpected = payments.reduce((sum, p) => sum + parseFloat(p.expectedAmount), 0);
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.paidAmount || '0'), 0);
    const totalOutstanding = totalExpected - totalPaid;
    const progress = totalExpected > 0 ? Math.min((totalPaid / totalExpected) * 100, 100) : 0;

    return { totalExpected, totalPaid, totalOutstanding, progress };
  };

  const handleZipUpload = async (file: File) => {
    try {
      setUploadingZip(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('zipFile', file);
      // Metadata temporanei (verranno aggiornati al submit finale)
      formData.append('registrationId', 'temp-' + Date.now());
      formData.append('companyName', companyName || 'Temp');
      formData.append('userName', `${firstName} ${lastName}` || 'Temp User');
      formData.append('originalYear', originalYear || new Date().getFullYear().toString());

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/admin/archive/upload-zip`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      setDocumentsZipUrl(response.data.url);
      setDocumentsZipKey(response.data.key);
      setError('');
    } catch (err: any) {
      console.error('Errore upload ZIP:', err);
      setError(err.response?.data?.error || 'Errore durante l\'upload del file');
      setZipFile(null);
    } finally {
      setUploadingZip(false);
    }
  };

  const handleContractUpload = async (file: File) => {
    try {
      setUploadingContract(true);
      setContractUploadProgress(0);

      const formData = new FormData();
      formData.append('contractFile', file);
      // Metadata temporanei (verranno aggiornati al submit finale)
      formData.append('registrationId', 'temp-' + Date.now());
      formData.append('companyName', companyName || 'Temp');
      formData.append('userName', `${firstName} ${lastName}` || 'Temp User');
      formData.append('originalYear', originalYear || new Date().getFullYear().toString());

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/admin/archive/upload-contract`, formData, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setContractUploadProgress(percentCompleted);
          }
        }
      });

      setContractPdfUrl(response.data.url);
      setContractPdfKey(response.data.key);
      setError('');
    } catch (err: any) {
      console.error('Errore upload contratto:', err);
      setError(err.response?.data?.error || 'Errore durante l\'upload del contratto');
      setContractFile(null);
    } finally {
      setUploadingContract(false);
    }
  };

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError('Il file è troppo grande. Dimensione massima: 50MB');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Solo file ZIP sono permessi');
        return;
      }
      setZipFile(file);
      handleZipUpload(file);
    }
  };

  const handleContractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Il file è troppo grande. Dimensione massima: 10MB');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Solo file PDF sono permessi per i contratti');
        return;
      }
      setContractFile(file);
      handleContractUpload(file);
    }
  };

  // Drag & Drop Handlers per ZIP
  const handleZipDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingZip(true);
  };

  const handleZipDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingZip(false);
  };

  const handleZipDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingZip(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError('Il file è troppo grande. Dimensione massima: 50MB');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Solo file ZIP sono permessi');
        return;
      }
      setZipFile(file);
      handleZipUpload(file);
    }
  };

  // Drag & Drop Handlers per PDF contratto
  const handleContractDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingContract(true);
  };

  const handleContractDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingContract(false);
  };

  const handleContractDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleContractDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingContract(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Il file è troppo grande. Dimensione massima: 10MB');
        return;
      }
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Solo file PDF sono permessi per i contratti');
        return;
      }
      setContractFile(file);
      handleContractUpload(file);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');

      const data = {
        // Anagrafica
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

        // Company e Corso
        companyName,
        courseName,

        // Importi
        finalAmount: parseFloat(finalAmount),
        installments: parseInt(installments),

        // Pagamenti
        payments: payments.map(p => ({
          type: p.type,
          label: p.label,
          installmentNumber: p.installmentNumber,
          expectedAmount: parseFloat(p.expectedAmount),
          paidAmount: parseFloat(p.paidAmount || '0'),
          status: p.status
        })),

        // Documenti
        documentsZipUrl: documentsZipUrl || null,
        documentsZipKey: documentsZipKey || null,
        contractPdfUrl: contractPdfUrl || null,
        contractPdfKey: contractPdfKey || null,

        // Metadata
        originalYear: parseInt(originalYear)
      };

      await axios.post(`${API_URL}/admin/archive/registrations`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Resetta localStorage dopo submit con successo
      clearStorage();

      navigate('/admin/archive');
    } catch (err: any) {
      console.error('Errore creazione iscrizione:', err);
      setError(err.response?.data?.error || 'Errore durante la creazione');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = firstName && lastName && email && fiscalCode && birthDate && phone && residenceVia && residenceCity && residenceProvince && residenceCap;
  const canProceedStep2 = companyName;
  const canProceedStep3 = courseName && finalAmount && originalYear && (
    isSinglePayment ? true : (installments && depositAmount && installmentAmount)
  );
  const canProceedStep4 = payments.length > 0;

  const totals = calculateTotals();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Anagrafica</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cognome *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice Fiscale *
                </label>
                <input
                  type="text"
                  value={fiscalCode}
                  onChange={(e) => setFiscalCode(e.target.value.toUpperCase())}
                  maxLength={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data di Nascita *
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mt-6">Residenza</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Via *
                </label>
                <input
                  type="text"
                  value={residenceVia}
                  onChange={(e) => setResidenceVia(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Città *
                </label>
                <input
                  type="text"
                  value={residenceCity}
                  onChange={(e) => setResidenceCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provincia *
                </label>
                <input
                  type="text"
                  value={residenceProvince}
                  onChange={(e) => setResidenceProvince(e.target.value)}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CAP *
                </label>
                <input
                  type="text"
                  value={residenceCap}
                  onChange={(e) => setResidenceCap(e.target.value)}
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Azienda</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Azienda *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setCompanyName('Diamante')}
                className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Diamante
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Corso e Importi</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Corso *
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo Finale (€) *
                </label>
                <input
                  type="number"
                  value={finalAmount}
                  onChange={(e) => setFinalAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Rate *
                </label>
                <input
                  type="number"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  min="1"
                  max="12"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anno Iscrizione *
                </label>
                <input
                  type="number"
                  value={originalYear}
                  onChange={(e) => setOriginalYear(e.target.value)}
                  min="2000"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="mt-6 flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="singlePayment"
                checked={isSinglePayment}
                onChange={(e) => setIsSinglePayment(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="singlePayment" className="text-sm font-medium text-gray-700">
                Pagamento Unico (nessun acconto o rata)
              </label>
            </div>

            {!isSinglePayment && (
              <>
                <h3 className="text-lg font-medium text-gray-900 mt-6">Importi Pagamenti</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo Acconto (€) *
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="es. 500.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importo Singola Rata (€) *
                </label>
                <input
                  type="number"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="es. 250.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

                  {depositAmount && installmentAmount && installments && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h3 className="text-sm font-medium text-blue-900 mb-2">
                        Riepilogo Pagamenti
                      </h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div>• Acconto: €{parseFloat(depositAmount).toFixed(2)}</div>
                        <div>• {installments} rate da €{parseFloat(installmentAmount).toFixed(2)} ciascuna = €{(parseFloat(installmentAmount) * parseInt(installments)).toFixed(2)}</div>
                        <div className="font-semibold mt-2 pt-2 border-t border-blue-200">
                          Totale: €{(parseFloat(depositAmount) + parseFloat(installmentAmount) * parseInt(installments)).toFixed(2)}
                          {finalAmount && Math.abs((parseFloat(depositAmount) + parseFloat(installmentAmount) * parseInt(installments)) - parseFloat(finalAmount)) > 0.01 && (
                            <span className="text-red-600 ml-2">
                              ⚠️ Non corrisponde all'importo finale (€{finalAmount})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {isSinglePayment && finalAmount && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h3 className="text-sm font-medium text-green-900 mb-2">
                    Riepilogo Pagamento Unico
                  </h3>
                  <div className="text-sm text-green-800">
                    <div className="font-semibold">
                      Totale: €{parseFloat(finalAmount).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Gestione Pagamenti</h2>

            {/* Totali */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Totale Dovuto</div>
                <div className="text-xl font-bold text-blue-600">
                  €{totals.totalExpected.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Totale Pagato</div>
                <div className="text-xl font-bold text-green-600">
                  €{totals.totalPaid.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Residuo</div>
                <div className="text-xl font-bold text-red-600">
                  €{totals.totalOutstanding.toFixed(2)}
                </div>
              </div>
              <div className="col-span-3">
                <div className="text-sm text-gray-600 mb-1">Progresso Pagamento</div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-green-600 h-4 rounded-full transition-all"
                    style={{ width: `${totals.progress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{totals.progress.toFixed(1)}%</div>
              </div>
            </div>

            {/* Info Surplus */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-900">
                    Recupero Automatico Debiti
                  </h3>
                  <div className="mt-1 text-sm text-blue-700">
                    Se inserisci un importo superiore al dovuto, il surplus verrà automaticamente applicato
                    alle rate precedenti con residuo, a partire dalla più recente.
                  </div>
                </div>
              </div>
            </div>

            {/* Lista Pagamenti */}
            <div className="space-y-3">
              {payments.map((payment, index) => {
                const expected = parseFloat(payment.expectedAmount);
                const paid = parseFloat(payment.paidAmount || '0');
                const outstanding = expected - paid;
                const outstandingBefore = getOutstandingBeforeIndex(index);
                const totalRecoverable = expected + outstandingBefore;
                const hasSurplus = paid > expected;
                const surplusAmount = hasSurplus ? paid - expected : 0;

                return (
                  <div key={index} className={`p-4 border-2 rounded-lg ${
                    hasSurplus ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-gray-900">{payment.label}</div>
                      <div className="text-sm text-gray-600">
                        Dovuto: €{payment.expectedAmount}
                        {payment.status === 'PARTIAL' && !hasSurplus && outstanding > 0 && (
                          <span className="ml-2 text-red-600">
                            (Residuo: €{outstanding.toFixed(2)})
                          </span>
                        )}
                        {hasSurplus && (
                          <span className="ml-2 text-green-600 font-semibold">
                            (Pagato: €{paid.toFixed(2)} | Surplus: €{surplusAmount.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => updatePaymentStatus(index, 'PAID')}
                      className={`px-3 py-2 text-sm rounded-lg transition ${
                        payment.status === 'PAID'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Pagato
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(index, 'PARTIAL')}
                      className={`px-3 py-2 text-sm rounded-lg transition ${
                        payment.status === 'PARTIAL'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Parziale
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(index, 'UNPAID')}
                      className={`px-3 py-2 text-sm rounded-lg transition ${
                        payment.status === 'UNPAID'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Non Pagato
                    </button>
                  </div>

                  {payment.status === 'PARTIAL' && (
                    <div className="mt-3">
                      {/* Info residuo recuperabile */}
                      {outstandingBefore > 0 && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start">
                            <svg className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-yellow-800">
                              <div className="font-medium">Residuo precedente disponibile: €{outstandingBefore.toFixed(2)}</div>
                              <div className="text-xs mt-1">
                                Inserendo €{totalRecoverable.toFixed(2)} su questa rata, saldi completamente il residuo
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Importo Pagato (€)
                      </label>
                      <input
                        type="number"
                        value={payment.paidAmount}
                        onChange={(e) => updatePaidAmount(index, e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder={outstandingBefore > 0
                          ? `€${totalRecoverable.toFixed(2)} per saldare tutto`
                          : `Dovuto: €${payment.expectedAmount}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Inserisci un importo maggiore del dovuto per recuperare debiti precedenti
                      </p>

                      {/* Feedback visivo se si sta saldando il residuo */}
                      {paid >= totalRecoverable && outstandingBefore > 0 && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800 flex items-center">
                          <svg className="h-4 w-4 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Questo pagamento salda completamente il residuo precedente
                        </div>
                      )}
                    </div>
                  )}

                  {payment.status === 'PAID' && hasSurplus && (
                    <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg">
                      <div className="text-sm text-green-900">
                        <div className="font-semibold mb-1">Pagamento con surplus</div>
                        <div className="space-y-1 text-xs">
                          <div>• Dovuto per questa rata: €{expected.toFixed(2)}</div>
                          <div>• Importo pagato: €{paid.toFixed(2)}</div>
                          <div className="font-semibold text-green-700">• Surplus applicato a rate precedenti: €{surplusAmount.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Documenti (Opzionale)</h2>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDraggingZip
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
              onDragEnter={handleZipDragEnter}
              onDragLeave={handleZipDragLeave}
              onDragOver={handleZipDragOver}
              onDrop={handleZipDrop}
            >
              {!zipFile && !documentsZipUrl ? (
                <>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
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
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <span>Carica File ZIP</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        accept=".zip"
                        className="sr-only"
                        onChange={handleZipFileChange}
                        disabled={uploadingZip}
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    o trascina qui il file ZIP (max 50MB)
                  </p>
                </>
              ) : uploadingZip ? (
                <div className="space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <div className="text-sm text-gray-600">
                    Upload in corso... {uploadProgress}%
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center text-green-600">
                    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {zipFile?.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {zipFile && `${(zipFile.size / 1024 / 1024).toFixed(2)} MB`}
                  </div>
                  <button
                    onClick={() => {
                      setZipFile(null);
                      setDocumentsZipUrl('');
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Rimuovi file
                  </button>
                </div>
              )}
            </div>

            {/* Contratto PDF */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contratto PDF (Opzionale)</h3>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDraggingContract
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300'
                }`}
                onDragEnter={handleContractDragEnter}
                onDragLeave={handleContractDragLeave}
                onDragOver={handleContractDragOver}
                onDrop={handleContractDrop}
              >
                {!contractFile && !contractPdfUrl ? (
                  <>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <div className="mt-4">
                      <label
                        htmlFor="contract-upload"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <span>Carica Contratto PDF</span>
                        <input
                          id="contract-upload"
                          name="contract-upload"
                          type="file"
                          accept=".pdf"
                          className="sr-only"
                          onChange={handleContractFileChange}
                          disabled={uploadingContract}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      o trascina qui il file PDF (max 10MB)
                    </p>
                  </>
                ) : uploadingContract ? (
                  <div className="space-y-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <div className="text-sm text-gray-600">
                      Upload contratto in corso... {contractUploadProgress}%
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${contractUploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center text-green-600">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {contractFile?.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {contractFile && `${(contractFile.size / 1024 / 1024).toFixed(2)} MB`}
                    </div>
                    <button
                      onClick={() => {
                        setContractFile(null);
                        setContractPdfUrl('');
                        setContractPdfKey('');
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Rimuovi contratto
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 mt-4">
              Il caricamento dei documenti e del contratto è opzionale
            </div>

            {/* Riepilogo Finale */}
            <div className="mt-8 p-6 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Finale</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Studente:</span>
                  <span className="font-medium">{firstName} {lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Azienda:</span>
                  <span className="font-medium">{companyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Corso:</span>
                  <span className="font-medium">{courseName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Anno:</span>
                  <span className="font-medium">{originalYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Importo Totale:</span>
                  <span className="font-medium">€{finalAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pagato:</span>
                  <span className="font-medium text-green-600">€{totals.totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Residuo:</span>
                  <span className="font-medium text-red-600">€{totals.totalOutstanding.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/admin/archive')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Torna all'archivio
          </button>
          <button
            onClick={() => {
              if (window.confirm('Sei sicuro di voler svuotare il form? Tutti i dati inseriti verranno persi.')) {
                clearStorage();
                window.location.reload();
              }
            }}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Svuota form
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Nuova Iscrizione Archiviata</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((step) => (
            <React.Fragment key={step}>
              <div className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    step <= currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                <div className={`ml-2 text-sm ${step === currentStep ? 'font-semibold' : ''}`}>
                  {step === 1 && 'Anagrafica'}
                  {step === 2 && 'Azienda'}
                  {step === 3 && 'Corso'}
                  {step === 4 && 'Pagamenti'}
                  {step === 5 && 'Documenti'}
                </div>
              </div>
              {step < 5 && (
                <div
                  className={`flex-1 h-1 mx-4 ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Form Content */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        {renderStep()}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Indietro
        </button>

        {currentStep < 5 ? (
          <button
            onClick={() => {
              // Genera pagamenti quando si passa da step 3 a step 4
              if (currentStep === 3) {
                generatePaymentsManual();
              }
              setCurrentStep(currentStep + 1);
            }}
            disabled={
              (currentStep === 1 && !canProceedStep1) ||
              (currentStep === 2 && !canProceedStep2) ||
              (currentStep === 3 && !canProceedStep3) ||
              (currentStep === 4 && !canProceedStep4)
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Avanti
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Salvataggio...' : 'Crea Iscrizione'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ArchiveCreate;
