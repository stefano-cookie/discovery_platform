import React, { useEffect, useState } from 'react';
import { X, User, Mail, Phone, CreditCard, Building2, Calendar, FileText } from 'lucide-react';
import api from '../../../services/api';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: string;
    profile?: {
      nome: string;
      cognome: string;
    } | null;
    assignedPartner?: {
      referralCode: string;
    } | null;
  };
}

interface UserDetail {
  id: string;
  email: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  profile?: {
    nome: string;
    cognome: string;
    codiceFiscale?: string;
    telefono?: string;
    dataNascita?: string;
    luogoNascita?: string;
  } | null;
  registrations: {
    id: string;
    status: string;
    finalAmount: number;
    createdAt: string;
    offer: {
      course: {
        name: string;
        templateType: string;
      };
    };
  }[];
}

export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchUserDetail();
    }
  }, [isOpen, user.id]);

  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/users/${user.id}`);
      setUserDetail(response.data);
    } catch (error) {
      console.error('Error fetching user detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      PENDING: { label: 'In Attesa', color: 'bg-yellow-100 text-yellow-800' },
      DATA_VERIFIED: { label: 'Dati Verificati', color: 'bg-blue-100 text-blue-800' },
      CONTRACT_SIGNED: { label: 'Contratto Firmato', color: 'bg-purple-100 text-purple-800' },
      ENROLLED: { label: 'Iscritto', color: 'bg-green-100 text-green-800' },
      PAYMENT_COMPLETED: { label: 'Completato', color: 'bg-emerald-100 text-emerald-800' },
      CANCELLED: { label: 'Annullato', color: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || {
      label: status,
      color: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dettaglio Utente</h2>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ) : userDetail ? (
            <div className="space-y-6">
              {/* Account Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Status Account</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className="font-medium text-gray-900">
                      {userDetail.isActive ? (
                        <span className="text-green-600">✓ Attivo</span>
                      ) : (
                        <span className="text-red-600">✗ Disattivato</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email Verificata</p>
                    <p className="font-medium text-gray-900">
                      {userDetail.emailVerified ? (
                        <span className="text-green-600">✓ Verificata</span>
                      ) : (
                        <span className="text-yellow-600">✗ Non verificata</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data Registrazione</p>
                    <p className="font-medium text-gray-900">
                      {new Date(userDetail.createdAt).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Company Assegnata</p>
                    <p className="font-medium text-gray-900">
                      {user.assignedPartner?.referralCode || 'Nessuna'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dati Anagrafici */}
              {userDetail.profile && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Dati Anagrafici
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Nome</p>
                      <p className="font-medium text-gray-900">
                        {userDetail.profile.nome || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cognome</p>
                      <p className="font-medium text-gray-900">
                        {userDetail.profile.cognome || 'N/A'}
                      </p>
                    </div>
                    {userDetail.profile.codiceFiscale && (
                      <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          Codice Fiscale
                        </p>
                        <p className="font-medium text-gray-900">
                          {userDetail.profile.codiceFiscale}
                        </p>
                      </div>
                    )}
                    {userDetail.profile.telefono && (
                      <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          Telefono
                        </p>
                        <p className="font-medium text-gray-900">
                          {userDetail.profile.telefono}
                        </p>
                      </div>
                    )}
                    {userDetail.profile.dataNascita && (
                      <div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Data di Nascita
                        </p>
                        <p className="font-medium text-gray-900">
                          {new Date(userDetail.profile.dataNascita).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                    )}
                    {userDetail.profile.luogoNascita && (
                      <div>
                        <p className="text-sm text-gray-600">Luogo di Nascita</p>
                        <p className="font-medium text-gray-900">
                          {userDetail.profile.luogoNascita}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Contatti
                </h3>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{userDetail.email}</p>
                </div>
              </div>

              {/* Iscrizioni */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Iscrizioni ({userDetail.registrations.length})
                </h3>
                {userDetail.registrations.length > 0 ? (
                  <div className="space-y-3">
                    {userDetail.registrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <h4 className="font-medium text-gray-900">
                                {reg.offer.course.name}
                              </h4>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{reg.offer.course.templateType}</span>
                              <span>•</span>
                              <span>
                                {new Date(reg.createdAt).toLocaleDateString('it-IT')}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(reg.status)}
                            <p className="text-sm font-medium text-gray-900 mt-2">
                              {formatCurrency(reg.finalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Nessuna iscrizione trovata</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Errore nel caricamento dei dati utente
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};