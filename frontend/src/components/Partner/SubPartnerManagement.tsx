import React, { useState, useEffect } from 'react';
import { PlusIcon, BuildingOffice2Icon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { UsersIcon } from '@heroicons/react/20/solid';
import subPartnerApi, { SubPartner, CompanyInvite } from '../../services/subPartnerApi';
import InviteCompanyModal from './SubPartner/InviteCompanyModal';
import SubPartnerDetailModal from './SubPartner/SubPartnerDetailModal';
import ConfirmModal from '../UI/ConfirmModal';

const SubPartnerManagement: React.FC = () => {
  const [subPartners, setSubPartners] = useState<SubPartner[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedSubPartner, setSelectedSubPartner] = useState<SubPartner | null>(null);
  const [activeTab, setActiveTab] = useState<'companies' | 'invites'>('companies');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'warning' | 'danger' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subPartnersData, invitesData] = await Promise.all([
        subPartnerApi.getSubPartners(),
        subPartnerApi.getCompanyInvites()
      ]);
      setSubPartners(subPartnersData);
      setInvites(invitesData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading sub-partner data:', err);
      if (err.response?.status === 403) {
        setError('Account premium richiesto per gestire le aziende figlie');
      } else {
        setError('Errore nel caricamento dei dati');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    loadData();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoca Invito',
      message: 'Sei sicuro di voler revocare questo invito? Questa azione non può essere annullata.',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await subPartnerApi.revokeCompanyInvite(inviteId);
          loadData();
        } catch (err) {
          console.error('Error revoking invite:', err);
        }
      }
    });
  };

  const handleToggleStatus = async (companyId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'disattivare' : 'attivare';
    const variant = currentStatus ? 'danger' : 'warning';
    
    setConfirmModal({
      isOpen: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Azienda Figlia`,
      message: `Sei sicuro di voler ${action} questa azienda figlia? Questo influenzerà le sue operazioni.`,
      variant,
      onConfirm: async () => {
        try {
          await subPartnerApi.updateSubPartnerStatus(companyId, !currentStatus);
          loadData();
        } catch (err) {
          console.error('Error updating status:', err);
        }
      }
    });
  };

  const getStatusBadge = (status: CompanyInvite['status']) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      EXPIRED: 'bg-red-100 text-red-800',
      REVOKED: 'bg-gray-100 text-gray-800'
    };
    
    const labels = {
      PENDING: 'In Attesa',
      ACCEPTED: 'Accettato',
      EXPIRED: 'Scaduto',
      REVOKED: 'Revocato'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Accesso Limitato</h3>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Gestione Aziende Collaboratrici</h2>
          <p className="text-gray-600 mt-1">Crea e gestisci le tue aziende collaboratrici</p>
        </div>
        <div className="mt-4 lg:mt-0">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl flex items-center group"
          >
            <PlusIcon className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
            Invita Nuova Azienda
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
          activeTab === 'companies' 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`} onClick={() => setActiveTab('companies')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aziende Attive</p>
              <p className="text-2xl font-bold text-gray-900">{subPartners.length}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <BuildingOffice2Icon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
          activeTab === 'invites' 
            ? 'border-orange-500 bg-orange-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`} onClick={() => setActiveTab('invites')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inviti Pendenti</p>
              <p className="text-2xl font-bold text-gray-900">{invites.filter(i => i.status === 'PENDING').length}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border-2 border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Totale Dipendenti</p>
              <p className="text-2xl font-bold text-gray-900">
                {subPartners.reduce((acc, company) => acc + company.stats.employeeCount, 0)}
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <UsersIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">

      {/* Tab Content */}
      {activeTab === 'companies' ? (
        <>
          {subPartners.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BuildingOffice2Icon className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna azienda figlia</h3>
              <p className="text-gray-600 mb-6">Inizia invitando la tua prima azienda partner per espandere la tua rete.</p>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl inline-flex items-center"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Invita Prima Azienda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {subPartners.map((company) => (
                <div key={company.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BuildingOffice2Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{company.name}</h3>
                        <p className="text-sm text-gray-500">{company.referralCode}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      company.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {company.isActive ? 'Attiva' : 'Inattiva'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{company.stats.employeeCount}</p>
                      <p className="text-xs text-gray-500">Dipendenti</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">{company.stats.totalRegistrations}</p>
                      <p className="text-xs text-gray-500">Iscrizioni</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                      <span>Azienda Partner</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedSubPartner(company)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Dettagli
                      </button>
                      <button
                        onClick={() => handleToggleStatus(company.id, company.isActive)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          company.isActive
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {company.isActive ? 'Disattiva' : 'Attiva'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {invites.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun invito pendente</h3>
              <p className="text-gray-600">Tutti gli inviti sono stati processati.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invites.map((invite) => (
                <div key={invite.id} className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{invite.companyName}</h3>
                          {getStatusBadge(invite.status)}
                        </div>
                        <p className="text-sm text-gray-600">{invite.email}</p>
                        <p className="text-xs text-gray-500">
                          Scade: {new Date(invite.expiresAt).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    </div>
                    
                    {invite.status === 'PENDING' && (
                      <button
                        onClick={() => handleRevokeInvite(invite.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-xs font-medium transition-colors"
                      >
                        Revoca
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>

      {/* Modals */}
      <InviteCompanyModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={handleInviteSuccess}
      />

      {selectedSubPartner && (
        <SubPartnerDetailModal
          subPartner={selectedSubPartner}
          isOpen={true}
          onClose={() => setSelectedSubPartner(null)}
          onRefresh={loadData}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText="Conferma"
        cancelText="Annulla"
      />
    </div>
  );
};

export default SubPartnerManagement;