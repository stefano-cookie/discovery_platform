import React from 'react';
import { PartnerEmployee, PartnerEmployeeRole } from '../../../types/partner';
import Dropdown from '../../UI/Dropdown';

interface EmployeeCardProps {
  employee: PartnerEmployee;
  onUpdate: (data: {
    role?: PartnerEmployeeRole;
    isActive?: boolean;
  }) => Promise<void>;
  onResendInvite: () => Promise<void>;
  onRemove: () => void;
  loading: boolean;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  employee,
  onUpdate,
  onResendInvite,
  onRemove,
  loading
}) => {

  const isActive = employee.isActive;
  const isPending = !employee.acceptedAt && !isActive;
  const isInviteExpired = employee.inviteExpiresAt && new Date(employee.inviteExpiresAt) < new Date();

  const getStatusInfo = () => {
    if (isPending) {
      return {
        text: isInviteExpired ? 'Invito Scaduto' : 'Invito Inviato',
        color: isInviteExpired ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800',
        icon: isInviteExpired ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      };
    }

    if (!isActive) {
      return {
        text: 'Disattivato',
        color: 'bg-gray-100 text-gray-800',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        )
      };
    }

    return {
      text: 'Attivo',
      color: 'bg-green-100 text-green-800',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    };
  };

  const statusInfo = getStatusInfo();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200/60 overflow-hidden hover:shadow-xl transition-shadow duration-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-4">
              <div className="h-12 w-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-lg font-semibold">
                  {employee.firstName?.charAt(0).toUpperCase()}{employee.lastName?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 truncate">
                {employee.firstName} {employee.lastName}
              </h3>
              <p className="text-slate-600 text-sm truncate">{employee.email}</p>
            </div>
          </div>

          <Dropdown
            trigger={
              <button
                disabled={loading}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            }
            options={[
              ...(isPending ? [{
                label: 'Reinvia Invito',
                value: 'resend',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a1 1 0 001.42 0L21 7M5 19h14" />
                  </svg>
                )
              }] : []),
              ...(isActive ? [{
                label: 'Cambia Ruolo',
                value: 'changeRole',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }, {
                label: 'Disattiva',
                value: 'deactivate',
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )
              }] : []),
              ...(!isActive && !isPending ? [{
                label: 'Riattiva',
                value: 'activate',
                color: 'success' as const,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }] : []),
              {
                label: 'Rimuovi',
                value: 'remove',
                color: 'danger' as const,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )
              }
            ]}
            onSelect={(value) => {
              switch (value) {
                case 'resend':
                  onResendInvite();
                  break;
                case 'changeRole':
                  onUpdate({
                    role: employee.role === 'ADMINISTRATIVE' ? PartnerEmployeeRole.COMMERCIAL : PartnerEmployeeRole.ADMINISTRATIVE
                  });
                  break;
                case 'deactivate':
                  onUpdate({ isActive: false });
                  break;
                case 'activate':
                  onUpdate({ isActive: true });
                  break;
                case 'remove':
                  onRemove();
                  break;
              }
            }}
            disabled={loading}
            placement="bottom-right"
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        {/* Status e Ruolo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.text}</span>
            </span>
          </div>
          <div className="flex items-center">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              employee.role === 'ADMINISTRATIVE'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {employee.role}
            </span>
          </div>
        </div>

        {/* Info aggiuntive */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Creato:</span>
            <span className="text-slate-700">{formatDate(employee.createdAt)}</span>
          </div>

          {employee.lastLoginAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Ultimo accesso:</span>
              <span className="text-slate-700">{formatDate(employee.lastLoginAt)}</span>
            </div>
          )}

          {employee.acceptedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Invito accettato:</span>
              <span className="text-slate-700">{formatDate(employee.acceptedAt)}</span>
            </div>
          )}

          {isPending && employee.inviteExpiresAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Invito scade:</span>
              <span className={`text-slate-700 ${isInviteExpired ? 'text-red-600 font-medium' : ''}`}>
                {formatDate(employee.inviteExpiresAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
          <div className="flex items-center text-slate-600">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Aggiornando...
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCard;