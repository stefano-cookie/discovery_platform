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
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentDeadlines();
  }, [registrationId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      alert('Errore nel marcare il pagamento come pagato');
    } finally {
      setMarkingPaid(null);
      setSelectedDeadlineId(null);
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
  const unpaidDeadlines = deadlines.filter(d => !d.isPaid);
  const nextDeadline = unpaidDeadlines[0];
  const totalPaid = paidDeadlines.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gestione Pagamenti</h2>
        
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
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
              <button
                onClick={() => handleMarkAsPaid(nextDeadline.id)}
                disabled={markingPaid === nextDeadline.id}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {markingPaid === nextDeadline.id ? 'Elaborazione...' : 'Marca come Pagato'}
              </button>
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
                deadline.isPaid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
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
                  </div>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-sm text-gray-600">
                      Importo: € {(deadline.amount || 0).toFixed(2)}
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
                {!deadline.isPaid && deadline.id !== nextDeadline?.id && (
                  <button
                    onClick={() => handleMarkAsPaid(deadline.id)}
                    disabled={markingPaid === deadline.id}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Marca come Pagato
                  </button>
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
    </>
  );
};

export default PaymentSection;