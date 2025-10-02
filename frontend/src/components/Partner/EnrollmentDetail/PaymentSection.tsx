import React, { useState, useEffect } from 'react';
import Portal from '../../UI/Portal';
import axios from 'axios';
import SuccessModal from '../../UI/SuccessModal';
import ErrorModal from '../../UI/ErrorModal';
import { triggerCertificationStepsRefresh, triggerRegistrationsRefresh } from '../../../utils/refreshEvents';

interface PaymentDeadline {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  partialAmount?: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentNumber?: number;
}

interface PaymentSectionProps {
  registrationId: string;
  courseName?: string;
  finalAmount?: number;
  offerType?: string;
  installments?: number;
}

// Helper function to format date
const formatDate = (dateString: string, format: 'long' | 'short' = 'short') => {
  const date = new Date(dateString);
  if (format === 'long') {
    const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                   'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const PaymentSection: React.FC<PaymentSectionProps> = ({ 
  registrationId, 
  courseName,
  finalAmount,
  offerType,
  installments = 1
}) => {
  const [deadlines, setDeadlines] = useState<PaymentDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [remainingAmount, setRemainingAmount] = useState<number | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [delayedAmount, setDelayedAmount] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchPaymentDeadlines();
  }, [registrationId]); // eslint-disable-line react-hooks/exhaustive-deps


  const showSuccessMessage = (title: string, details: string) => {
    setSuccessMessage(details);
    setShowSuccessModal(true);
  };

  const fetchPaymentDeadlines = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');

      console.log('💰 Fetching payment deadlines:', {
        registrationId,
        hasToken: !!token,
        tokenType: localStorage.getItem('partnerToken') ? 'partner' : 'user',
        url: `${process.env.REACT_APP_API_URL}/partners/registrations/${registrationId}/deadlines`
      });

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/partners/registrations/${registrationId}/deadlines`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log('💰 Payment deadlines response:', {
        deadlinesCount: response.data.deadlines?.length || 0,
        deadlines: response.data.deadlines,
        remainingAmount: response.data.remainingAmount,
        delayedAmount: response.data.delayedAmount
      });

      setDeadlines(response.data.deadlines || []);
      const remaining = response.data.remainingAmount || finalAmount || 0;
      setRemainingAmount(typeof remaining === 'number' ? remaining : parseFloat(remaining) || 0);
      setDelayedAmount(response.data.delayedAmount || 0);
    } catch (error) {
      console.error('❌ Error fetching payment deadlines:', error);
      console.error('❌ Error details:', (error as any).response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (deadlineId: string) => {
    setSelectedDeadlineId(deadlineId);
    setShowNotesModal(true);
    setNotes('');
  };

  const handleMarkAsCustomPaid = (deadlineId: string) => {
    setSelectedDeadlineId(deadlineId);
    setShowPartialModal(true);
    setPartialAmount('');
    setNotes('');
  };

  const confirmMarkAsPaid = async () => {
    if (!selectedDeadlineId) return;
    
    try {
      setMarkingPaid(selectedDeadlineId);
      setShowNotesModal(false);
      
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/partners/registrations/${registrationId}/payments/${selectedDeadlineId}/mark-paid`,
        { notes },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setRemainingAmount(response.data.remainingAmount);
      await fetchPaymentDeadlines();
      
      // Get deadline details for success message
      const deadline = deadlines.find(d => d.id === selectedDeadlineId);
      const amount = deadline ? (deadline.amount || 0).toFixed(2) : '0.00';
      const description = deadline ? 
        (deadline.paymentNumber === 0 ? 'Acconto' : 
         deadline.paymentNumber ? `Rata ${deadline.paymentNumber}` : 'Pagamento') : 
        'Pagamento';
      
      showSuccessMessage(
        '🎉 Pagamento Registrato!',
        `${description} di €${amount} è stato marcato come pagato con successo.`
      );

      // Trigger refresh events after success modal has time to display
      console.log('Payment registered, triggering refresh');
      setTimeout(() => {
        triggerCertificationStepsRefresh();
        triggerRegistrationsRefresh();
      }, 1500); // Wait for success modal to display
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      setErrorMessage('Errore nel marcare il pagamento come pagato');
      setShowErrorModal(true);
    } finally {
      setMarkingPaid(null);
      setSelectedDeadlineId(null);
      setNotes('');
    }
  };

  const confirmMarkAsCustomPaid = async () => {
    if (!selectedDeadlineId || !partialAmount) return;
    
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Inserisci un importo valido');
      return;
    }

    try {
      setMarkingPaid(selectedDeadlineId);
      setShowPartialModal(false);
      
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/partners/registrations/${registrationId}/payments/${selectedDeadlineId}/mark-partial-paid`,
        { partialAmount: amount, notes },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setRemainingAmount(response.data.remainingAmount);
      setDelayedAmount(response.data.delayedAmount || 0);
      await fetchPaymentDeadlines();
      
      // Get deadline details for success message
      const deadline = deadlines.find(d => d.id === selectedDeadlineId);
      const totalAmount = deadline ? (deadline.amount || 0).toFixed(2) : '0.00';
      const paidAmount = parseFloat(partialAmount).toFixed(2);
      const totalDelayedAmount = (response.data.delayedAmount || 0).toFixed(2);
      const description = deadline ? 
        (deadline.paymentNumber === 0 ? 'Acconto' : 
         deadline.paymentNumber ? `Rata ${deadline.paymentNumber}` : 'Pagamento') : 
        'Pagamento';
      
      showSuccessMessage(
        '💰 Pagamento Personalizzato Registrato!',
        `${description}: €${paidAmount} di €${totalAmount} pagato. Rimangono €${totalDelayedAmount} in ritardo.`
      );

      // Trigger refresh events after success modal has time to display
      console.log('Custom payment registered, triggering refresh');
      setTimeout(() => {
        triggerCertificationStepsRefresh();
        triggerRegistrationsRefresh();
      }, 1500); // Wait for success modal to display
    } catch (error: any) {
      console.error('Error marking payment as custom:', error);
      setErrorMessage('Errore nel marcare il pagamento come personalizzato: ' + (error.response?.data?.error || error.message));
      setShowErrorModal(true);
    } finally {
      setMarkingPaid(null);
      setSelectedDeadlineId(null);
      setPartialAmount('');
      setNotes('');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gestione Pagamenti</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const paidDeadlines = deadlines.filter(d => d.isPaid);
  const customDeadlines = deadlines.filter(d => d.paymentStatus === 'PARTIAL');
  const unpaidDeadlines = deadlines.filter(d => !d.isPaid && d.paymentStatus !== 'PARTIAL');
  const nextDeadline = unpaidDeadlines[0];
  
  // Determine if custom payments should be allowed
  // For certifications with single payment (installments = 1), only allow full payment
  const isSinglePaymentCertification = offerType === 'CERTIFICATION' && installments === 1;
  const allowCustomPayments = !isSinglePaymentCertification;
  
  const totalPaid = paidDeadlines.reduce((sum, d) => sum + (d.amount || 0), 0) +
                   customDeadlines.reduce((sum, d) => sum + (d.partialAmount || 0), 0);
  
  // Calcola il totale dei ritardi localmente considerando anche i surplus
  let calculatedDelayedAmount = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let accumulatedSurplus = 0;
  
  // Ordina le scadenze per data per calcolare correttamente i surplus cumulativi
  const sortedCustomDeadlines = [...customDeadlines].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  sortedCustomDeadlines.forEach(d => {
    if (d.partialAmount) {
      const diff = (d.amount || 0) - d.partialAmount;
      if (diff > 0) {
        // Pagamento insufficiente, aggiunge al ritardo
        calculatedDelayedAmount += diff;
      } else if (diff < 0) {
        // Pagamento in eccesso, riduce i ritardi accumulati
        const surplus = Math.abs(diff);
        calculatedDelayedAmount = Math.max(0, calculatedDelayedAmount - surplus);
        accumulatedSurplus += surplus;
      }
    }
  });

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gestione Pagamenti</h2>
        
        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Totale Corso</p>
            <p className="text-xl font-semibold text-gray-900">
              € {(finalAmount && typeof finalAmount === 'number' ? finalAmount.toFixed(2) : '0.00')}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Pagato</p>
            <p className="text-xl font-semibold text-green-900">
              € {(totalPaid || 0).toFixed(2)}
            </p>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600">Residuo</p>
            <p className="text-xl font-semibold text-orange-900">
              € {(remainingAmount && typeof remainingAmount === 'number' ? remainingAmount.toFixed(2) : '0.00')}
            </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600">Ritardi</p>
            <p className="text-xl font-semibold text-red-900">
              € {(delayedAmount || calculatedDelayedAmount || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Next Payment */}
        {nextDeadline && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Prossimo Pagamento</p>
                <p className="text-lg font-semibold text-blue-900">
                  € {(nextDeadline.amount || 0).toFixed(2)}
                </p>
                <p className="text-sm text-blue-700">
                  Scadenza: {formatDate(nextDeadline.dueDate, 'long')}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleMarkAsPaid(nextDeadline.id)}
                  disabled={markingPaid === nextDeadline.id}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {markingPaid === nextDeadline.id ? 'Elaborazione...' : 'Pagato'}
                </button>
                {allowCustomPayments ? (
                  <button
                    onClick={() => handleMarkAsCustomPaid(nextDeadline.id)}
                    disabled={markingPaid === nextDeadline.id}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Personalizzato
                  </button>
                ) : (
                  <div className="relative group">
                    <button
                      disabled
                      className="bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed opacity-50"
                    >
                      Personalizzato
                    </button>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                      Non disponibile per certificazioni con pagamento unico
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Deadlines */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Scadenze Pagamento</h3>
          {deadlines.map((deadline) => (
            <div
              key={deadline.id}
              className={`border rounded-lg p-3 ${
                deadline.isPaid 
                  ? 'bg-green-50 border-green-200' 
                  : deadline.paymentStatus === 'PARTIAL'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900">
                      {deadline.description}
                    </p>
                    {deadline.isPaid && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Pagato
                      </span>
                    )}
                    {deadline.paymentStatus === 'PARTIAL' && (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        Personalizzato
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-sm text-gray-600">
                      {deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount ? (
                        <>
                          Importo: € {deadline.partialAmount.toFixed(2)} / € {(deadline.amount || 0).toFixed(2)}
                          {deadline.partialAmount < (deadline.amount || 0) ? (
                            <span className="text-orange-600 ml-2">
                              (Da pagare: € {((deadline.amount || 0) - deadline.partialAmount).toFixed(2)})
                            </span>
                          ) : deadline.partialAmount > (deadline.amount || 0) ? (
                            <span className="text-green-600 ml-2">
                              (Surplus: € {(deadline.partialAmount - (deadline.amount || 0)).toFixed(2)})
                            </span>
                          ) : null}
                        </>
                      ) : (
                        `Importo: € ${(deadline.amount || 0).toFixed(2)}`
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      Scadenza: {formatDate(deadline.dueDate)}
                    </p>
                    {deadline.isPaid && deadline.paidAt && (
                      <p className="text-sm text-green-600">
                        Pagato il: {formatDate(deadline.paidAt)}
                      </p>
                    )}
                  </div>
                  {deadline.notes && (
                    <p className="text-sm text-gray-500 mt-1">
                      Note: {deadline.notes}
                    </p>
                  )}
                </div>
                {!deadline.isPaid && deadline.paymentStatus !== 'PARTIAL' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleMarkAsPaid(deadline.id)}
                      disabled={markingPaid === deadline.id}
                      className="text-green-600 hover:text-green-700 text-sm font-medium"
                    >
                      Pagato
                    </button>
                    {allowCustomPayments ? (
                      <button
                        onClick={() => handleMarkAsCustomPaid(deadline.id)}
                        disabled={markingPaid === deadline.id}
                        className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                      >
                        Personalizzato
                      </button>
                    ) : (
                      <div className="relative group">
                        <button
                          disabled
                          className="text-gray-400 text-sm font-medium cursor-not-allowed"
                        >
                          Personalizzato
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                          Non disponibile per certificazioni con pagamento unico
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {deadlines.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Nessuna scadenza di pagamento trovata</p>
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {showNotesModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Conferma Pagamento</h3>
            <p className="text-gray-600 mb-4">
              Stai per marcare questo pagamento come completato. Puoi aggiungere delle note opzionali.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note sul pagamento (opzionale)"
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSelectedDeadlineId(null);
                  setNotes('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annulla
              </button>
              <button
                onClick={confirmMarkAsPaid}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Conferma
              </button>
            </div>
          </div>
          </div>
        </Portal>
      )}

      {/* Partial Payment Modal */}
      {showPartialModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Pagamento Personalizzato</h3>
            <p className="text-gray-600 mb-4">
              Inserisci l'importo effettivamente pagato. La differenza verrà registrata come ritardo.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Importo Pagato (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder="0.00"
                className="w-full p-3 border rounded-lg"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note (opzionale)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aggiungi una nota..."
                className="w-full p-3 border rounded-lg resize-none"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPartialModal(false);
                  setSelectedDeadlineId(null);
                  setPartialAmount('');
                  setNotes('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annulla
              </button>
              <button
                onClick={confirmMarkAsCustomPaid}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Conferma Pagamento Personalizzato
              </button>
            </div>
          </div>
          </div>
        </Portal>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Operazione Completata!"
        message={successMessage}
        autoClose={true}
        autoCloseDelay={1200}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Errore"
        message={errorMessage}
        autoClose={false}
      />
    </>
  );
};

export default PaymentSection;