import React, { useState } from 'react';
import { usePartnerEmployees } from '../../../hooks/usePartnerEmployees';
import { usePartnerAuth } from '../../../hooks/usePartnerAuth';
import EmployeeCard from './EmployeeCard';
import InviteEmployeeForm from './InviteEmployeeForm';
import LoadingSpinner from '../../UI/LoadingSpinner';

const CollaboratorsManagement: React.FC = () => {
  const { employees, loading, error, inviteEmployee, updateEmployee, resendInvite, removeEmployee } = usePartnerEmployees();
  const { partnerEmployee, partnerCompany } = usePartnerAuth();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleInviteEmployee = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMINISTRATIVE' | 'COMMERCIAL';
  }) => {
    try {
      setActionLoading('invite');
      await inviteEmployee(data);
      setShowInviteForm(false);
    } catch (error) {
      // Error handled by the hook
      console.error('Failed to invite employee:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateEmployee = async (id: string, data: {
    role?: 'ADMINISTRATIVE' | 'COMMERCIAL';
    isActive?: boolean;
  }) => {
    try {
      setActionLoading(`update-${id}`);
      await updateEmployee(id, data);
    } catch (error) {
      console.error('Failed to update employee:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvite = async (id: string) => {
    try {
      setActionLoading(`resend-${id}`);
      await resendInvite(id);
    } catch (error) {
      console.error('Failed to resend invite:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveEmployee = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler rimuovere questo collaboratore?')) {
      return;
    }

    try {
      setActionLoading(`remove-${id}`);
      await removeEmployee(id);
    } catch (error) {
      console.error('Failed to remove employee:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto mt-8">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.498 0L4.402 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800">Errore di Caricamento</h3>
        </div>
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Ricarica Pagina
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
            Gestione Collaboratori
          </h1>
          <p className="text-slate-600 mt-2 text-lg font-medium">
            Gestisci il team di <span className="font-semibold text-slate-900">{partnerCompany?.name}</span>
          </p>
        </div>
        <div className="mt-6 lg:mt-0 flex items-center gap-4">
          <div className="flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-blue-700">
              {employees.length} Collaborator{employees.length !== 1 ? 'i' : 'e'}
            </span>
          </div>
          <button 
            onClick={() => setShowInviteForm(true)}
            disabled={actionLoading === 'invite'}
            className="group relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center">
              {actionLoading === 'invite' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Invitando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Invita Collaboratore
                </>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
          </button>
        </div>
      </div>

      {/* Current User Info */}
      <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200/50 rounded-xl p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-4">
            <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-600 text-lg font-semibold">
                {partnerEmployee?.firstName?.charAt(0).toUpperCase()}{partnerEmployee?.lastName?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {partnerEmployee?.firstName} {partnerEmployee?.lastName} (Tu)
            </h3>
            <p className="text-slate-600">{partnerEmployee?.email}</p>
            <div className="flex items-center mt-1">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                {partnerEmployee?.role}
              </span>
              <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Account Principale
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Employees List */}
      {employees.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Nessun Collaboratore</h3>
          <p className="text-slate-600 mb-6">Invita il tuo primo collaboratore per iniziare a gestire il team.</p>
          <button 
            onClick={() => setShowInviteForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Invita Primo Collaboratore
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onUpdate={(data) => handleUpdateEmployee(employee.id, data)}
              onResendInvite={() => handleResendInvite(employee.id)}
              onRemove={() => handleRemoveEmployee(employee.id)}
              loading={
                actionLoading === `update-${employee.id}` || 
                actionLoading === `resend-${employee.id}` || 
                actionLoading === `remove-${employee.id}`
              }
            />
          ))}
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <InviteEmployeeForm 
          onClose={() => setShowInviteForm(false)}
          onSubmit={handleInviteEmployee}
          loading={actionLoading === 'invite'}
        />
      )}
    </div>
  );
};

export default CollaboratorsManagement;