import React, { useState } from 'react';
import { X, AlertTriangle, ArrowRightLeft, XCircle } from 'lucide-react';
import api from '../../../services/api';

interface TransferUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    profile?: {
      nome: string;
      cognome: string;
    } | null;
    assignedPartner?: {
      referralCode: string;
    } | null;
    _count: {
      registrations: number;
    };
  };
  companies: Array<{
    id: string;
    name: string;
    referralCode: string;
  }>;
  onSuccess: () => void;
}

export const TransferUserModal: React.FC<TransferUserModalProps> = ({
  isOpen,
  onClose,
  user,
  companies,
  onSuccess,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompanyId) {
      setError('Seleziona una company di destinazione');
      return;
    }

    if (!reason.trim()) {
      setError('Inserisci un motivo per il trasferimento');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post('/admin/users/transfer', {
        userId: user.id,
        toPartnerCompanyId: selectedCompanyId,
        reason: reason.trim(),
      });

      onSuccess();
      resetForm();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Errore durante il trasferimento utente';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCompanyId('');
    setReason('');
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const userName = user.profile?.nome && user.profile?.cognome
    ? `${user.profile.nome} ${user.profile.cognome}`
    : user.email;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3 text-white">
            <ArrowRightLeft className="w-6 h-6" />
            <h2 className="text-xl font-bold">Trasferisci Utente</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Utente da Trasferire</h3>
            <p className="text-gray-900 font-medium">{userName}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
            {user._count.registrations > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                {user._count.registrations} iscrizione
                {user._count.registrations !== 1 ? 'i' : ''} attiva
                {user._count.registrations !== 1 ? 'e' : ''}
              </p>
            )}
          </div>

          {/* Company Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company di Destinazione *
            </label>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setError(null);
              }}
              disabled={loading}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Seleziona company --</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.referralCode})
                </option>
              ))}
            </select>
          </div>

          {/* Warning - Blocked Transfer */}
          {user._count.registrations > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900 mb-1">
                    Trasferimento Non Permesso
                  </p>
                  <p className="text-sm text-red-800">
                    L'utente ha <strong>{user._count.registrations} iscrizione{user._count.registrations !== 1 ? 'i' : ''} attiva{user._count.registrations !== 1 ? 'e' : ''}</strong>. Il trasferimento è permesso solo per utenti senza iscrizioni attive (cancellate o rifiutate sono OK).
                  </p>
                  <p className="text-xs text-red-700 mt-2">
                    💡 <strong>Suggerimento</strong>: Se necessario, cancella prima le iscrizioni attive dell'utente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo del Trasferimento *
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              disabled={loading}
              required
              rows={4}
              placeholder="Spiega il motivo del trasferimento (es: cambio partner, riorganizzazione, ecc.)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Minimo 10 caratteri. Questo motivo verrà salvato nei log di sistema.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCompanyId || reason.trim().length < 10 || user._count.registrations > 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Trasferimento...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Conferma Trasferimento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};