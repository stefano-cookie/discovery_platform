import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
  finalAmount 
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentDeadlines();
  }, [registrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setSuccessDetails(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const showSuccessMessage = (title: string, details: string) => {
    setSuccessMessage(title);
    setSuccessDetails(details);
  };

  const fetchPaymentDeadlines = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/partners/registrations/${registrationId}/deadlines`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setDeadlines(response.data.deadlines || []);
      const remaining = response.data.remainingAmount || finalAmount || 0;
      setRemainingAmount(typeof remaining === 'number' ? remaining : parseFloat(remaining) || 0);
      setDelayedAmount(response.data.delayedAmount || 0);
    } catch (error) {
      console.error('Error fetching payment deadlines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (deadlineId: string) => {
    setSelectedDeadlineId(deadlineId);
    setShowNotesModal(true);
    setNotes('');
  };

  const handleMarkAsPartiallyPaid = (deadlineId: string) => {
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
      
      const token = localStorage.getItem('token');
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
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      alert('Errore nel marcare il pagamento come pagato');
    } finally {
      setMarkingPaid(null);
      setSelectedDeadlineId(null);
      setNotes('');
    }
  };

  const confirmMarkAsPartiallyPaid = async () => {
    if (!selectedDeadlineId || !partialAmount) return;
    
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Inserisci un importo valido');
      return;
    }

    try {
      setMarkingPaid(selectedDeadlineId);
      setShowPartialModal(false);
      
      const token = localStorage.getItem('token');
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
      const remainingAmount = deadline ? (deadline.amount - parseFloat(partialAmount)).toFixed(2) : '0.00';
      const description = deadline ? 
        (deadline.paymentNumber === 0 ? 'Acconto' : 
         deadline.paymentNumber ? `Rata ${deadline.paymentNumber}` : 'Pagamento') : 
        'Pagamento';
      
      showSuccessMessage(
        '💰 Pagamento Parziale Registrato!',
        `${description}: €${paidAmount} di €${totalAmount} pagato. Rimangono €${remainingAmount} in ritardo.`
      );
    } catch (error: any) {
      console.error('Error marking payment as partially paid:', error);
      alert('Errore nel marcare il pagamento come parzialmente pagato: ' + (error.response?.data?.error || error.message));
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
  const partialDeadlines = deadlines.filter(d => d.paymentStatus === 'PARTIAL');
  const unpaidDeadlines = deadlines.filter(d => !d.isPaid && d.paymentStatus !== 'PARTIAL');
  const nextDeadline = unpaidDeadlines[0];
  
  const totalPaid = paidDeadlines.reduce((sum, d) => sum + (d.amount || 0), 0) +
                   partialDeadlines.reduce((sum, d) => sum + (d.partialAmount || 0), 0);

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
              € {(delayedAmount || 0).toFixed(2)}
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
                <button
                  onClick={() => handleMarkAsPartiallyPaid(nextDeadline.id)}
                  disabled={markingPaid === nextDeadline.id}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  Pagato Parzialmente
                </button>
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
                        Pagato Parzialmente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-sm text-gray-600">
                      {deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount ? (
                        <>
                          Importo: € {deadline.partialAmount.toFixed(2)} / € {(deadline.amount || 0).toFixed(2)}
                          <span className="text-red-600 ml-2">
                            (Ritardo: € {((deadline.amount || 0) - deadline.partialAmount).toFixed(2)})
                          </span>
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
                    <button
                      onClick={() => handleMarkAsPartiallyPaid(deadline.id)}
                      disabled={markingPaid === deadline.id}
                      className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                    >
                      Parziale
                    </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
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
      )}

      {/* Partial Payment Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Pagamento Parziale</h3>
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
                onClick={confirmMarkAsPartiallyPaid}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Conferma Pagamento Parziale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <div className="bg-white rounded-lg shadow-lg border-l-4 border-green-500 p-4 mb-4 transform transition-all duration-300 ease-out animate-pulse" 
               style={{animation: 'slideInRight 0.3s ease-out'}}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900">
                    {successMessage}
                  </h3>
                  <button
                    onClick={() => {
                      setSuccessMessage(null);
                      setSuccessDetails(null);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {successDetails && (
                  <p className="mt-1 text-sm text-gray-600">
                    {successDetails}
                  </p>
                )}
                <div className="mt-3">
                  <div className="flex items-center text-xs text-green-700">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Il sistema è stato aggiornato automaticamente
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentSection;