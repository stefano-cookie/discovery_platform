import React, { useState } from 'react';
import { DocumentManager } from '../Documents';
import { useDocuments } from '../../hooks/useDocuments';
import { FileText, Users, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface DocumentManagementProps {
  partnerId: string;
}

const DocumentManagement: React.FC<DocumentManagementProps> = ({ partnerId }) => {
  const [selectedRegistration, setSelectedRegistration] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pending' | 'registration' | 'user'>('pending');

  // Get pending documents for approval
  const {
    documents: pendingDocs,
    isLoading: isLoadingPending,
    actions: pendingActions
  } = useDocuments({
    source: 'partner',
    autoRefresh: true
  });

  // Get documents for specific registration
  const {
    documents: registrationDocs,
    isLoading: isLoadingRegistration,
    actions: registrationActions
  } = useDocuments({
    source: 'partner',
    registrationId: selectedRegistration || undefined
  });

  // Get documents for specific user
  const {
    documents: userDocs,
    isLoading: isLoadingUser,
    actions: userActions
  } = useDocuments({
    source: 'partner',
    userId: selectedUser || undefined
  });

  const handleApprovalComplete = () => {
    // Refresh pending documents after approval/rejection
    pendingActions.refresh();
    if (selectedRegistration) {
      registrationActions.refresh();
    }
    if (selectedUser) {
      userActions.refresh();
    }
  };

  const getPendingStats = () => {
    const total = pendingDocs.length;
    const approved = pendingDocs.filter(doc => doc.status === 'APPROVED').length;
    const rejected = pendingDocs.filter(doc => doc.status === 'REJECTED').length;
    const pending = pendingDocs.filter(doc => doc.status === 'PENDING').length;

    return { total, approved, rejected, pending };
  };

  const stats = getPendingStats();

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestione Documenti</h2>
          <p className="text-gray-600">
            Approva o rifiuta i documenti caricati dagli utenti
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Attesa</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approvati</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rifiutati</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="w-full bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <div className="w-full flex space-x-8 px-6">
            <button
              onClick={() => setViewMode('pending')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Documenti in Attesa</span>
                {stats.pending > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => setViewMode('registration')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'registration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Per Iscrizione</span>
              </div>
            </button>

            <button
              onClick={() => setViewMode('user')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                viewMode === 'user'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Per Utente</span>
              </div>
            </button>
          </div>
        </div>

        <div className="w-full p-6">
          {/* Pending Documents */}
          {viewMode === 'pending' && (
            <div className="w-full">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Documenti in Attesa di Verifica
                </h3>
                <p className="text-gray-600 text-sm">
                  Tutti i documenti che richiedono la tua approvazione o rifiuto.
                </p>
              </div>

              {stats.pending === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    Nessun documento in attesa
                  </h4>
                  <p className="text-gray-600">
                    Tutti i documenti sono stati processati.
                  </p>
                </div>
              ) : (
                <DocumentManager
                  userId=""
                  source="partner"
                  allowUpload={false}
                  allowDelete={false}
                  allowApproval={true}
                  onDocumentChange={handleApprovalComplete}
                />
              )}
            </div>
          )}

          {/* By Registration */}
          {viewMode === 'registration' && (
            <div className="w-full">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Documenti per Iscrizione
                </h3>
                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    placeholder="Inserisci ID iscrizione"
                    value={selectedRegistration || ''}
                    onChange={(e) => setSelectedRegistration(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => registrationActions.refresh()}
                    disabled={!selectedRegistration || isLoadingRegistration}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Cerca
                  </button>
                </div>
              </div>

              {selectedRegistration && (
                <DocumentManager
                  userId=""
                  registrationId={selectedRegistration}
                  source="partner"
                  allowUpload={false}
                  allowDelete={false}
                  allowApproval={true}
                  onDocumentChange={handleApprovalComplete}
                />
              )}
            </div>
          )}

          {/* By User */}
          {viewMode === 'user' && (
            <div className="w-full">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Documenti per Utente
                </h3>
                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    placeholder="Inserisci ID utente"
                    value={selectedUser || ''}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => userActions.refresh()}
                    disabled={!selectedUser || isLoadingUser}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Cerca
                  </button>
                </div>
              </div>

              {selectedUser && (
                <DocumentManager
                  userId={selectedUser}
                  source="partner"
                  allowUpload={false}
                  allowDelete={false}
                  allowApproval={true}
                  onDocumentChange={handleApprovalComplete}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions for Pending Documents */}
      {viewMode === 'pending' && stats.pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">
                Azioni Rapide
              </h4>
              <p className="text-sm text-yellow-800 mb-3">
                Hai {stats.pending} documenti in attesa di verifica. Usa le azioni rapide per processarli più velocemente.
              </p>
              <div className="flex space-x-3">
                <button className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  Approva Tutti i PDF
                </button>
                <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                  Filtra per Tipo
                </button>
                <button className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                  Esporta Lista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManagement;