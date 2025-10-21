import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';

// Helper per ottenere il token JWT
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

// Helper per ottenere l'URL base del backend
const getBackendUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
};

interface Registration {
  id: string;
  createdAt: string;
  status: string;
  offerType: string;
  finalAmount: number;
  originalAmount: number;
  installments: number;
  discoveryApprovedAt?: string | null;
  discoveryApprovedBy?: string | null;
  user: {
    id: string;
    email: string;
    profile?: {
      nome?: string;
      cognome?: string;
      codiceFiscale?: string;
      telefono?: string;
      dataNascita?: string;
      luogoNascita?: string;
    };
  };
  partnerCompany?: {
    id: string;
    name: string;
    referralCode: string;
    isPremium: boolean;
  };
  offer?: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
      templateType: string;
    };
  };
  userDocuments: UserDocument[];
}

interface UserDocument {
  id: string;
  type: string;
  status: string;
  url: string;
  uploadedAt: string;
  partnerCheckedAt?: string;
  partnerCheckedBy?: string;
  discoveryApprovedAt?: string;
  discoveryApprovedBy?: string;
  discoveryRejectedAt?: string;
  discoveryRejectionReason?: string;
  uploadSource?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
}

interface RegistrationDetailModalProps {
  registrationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const RegistrationDetailModal: React.FC<RegistrationDetailModalProps> = ({
  registrationId,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewDocument, setPreviewDocument] = useState<UserDocument | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen && registrationId) {
      fetchRegistrationDetail();
    }
  }, [isOpen, registrationId]);

  const fetchRegistrationDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/registrations/${registrationId}`);
      setRegistration(response.data);
    } catch (error) {
      console.error('Error fetching registration detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/admin/registrations/${registrationId}/approve`, {
        notes: 'Approvato da Discovery Admin'
      });
      setShowApproveConfirm(false);
      onUpdate?.();
      onClose();
    } catch (error: any) {
      console.error('Error approving registration:', error);
      alert(error.response?.data?.error || 'Errore durante approvazione');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Inserisci un motivo per il rifiuto');
      return;
    }

    try {
      setActionLoading(true);
      await api.patch(`/admin/registrations/${registrationId}/reject`, {
        reason: rejectionReason
      });
      setShowRejectForm(false);
      setRejectionReason('');
      onUpdate?.();
      onClose();
    } catch (error: any) {
      console.error('Error rejecting registration:', error);
      alert(error.response?.data?.error || 'Errore durante rifiuto');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      // Stati iniziali enrollment
      PENDING: { label: 'In Attesa', color: 'bg-yellow-100 text-yellow-800' },
      DATA_VERIFIED: { label: 'Dati Verificati', color: 'bg-blue-100 text-blue-800' },
      DOCUMENTS_UPLOADED: { label: 'Documenti Caricati', color: 'bg-indigo-100 text-indigo-800' },
      DOCUMENTS_PARTNER_CHECKED: { label: 'Documenti Checkati Partner', color: 'bg-purple-100 text-purple-800' },
      CONTRACT_GENERATED: { label: 'Contratto Generato', color: 'bg-purple-100 text-purple-800' },
      CONTRACT_SIGNED: { label: 'Contratto Firmato', color: 'bg-purple-100 text-purple-800' },

      // Nuovo workflow approvazione Discovery
      AWAITING_DISCOVERY_APPROVAL: { label: 'In Attesa Approvazione Discovery', color: 'bg-orange-100 text-orange-800' },
      DISCOVERY_APPROVED: { label: 'Approvato Discovery', color: 'bg-teal-100 text-teal-800' },

      // Stati post-approvazione
      ENROLLED: { label: 'Iscritto', color: 'bg-green-100 text-green-800' },

      // Stati Certificazione
      DOCUMENTS_APPROVED: { label: 'Documenti Approvati', color: 'bg-blue-100 text-blue-800' },
      EXAM_REGISTERED: { label: 'Iscritto all\'Esame', color: 'bg-teal-100 text-teal-800' },

      // Stati TFA
      CNRED_RELEASED: { label: 'CNRED Rilasciato', color: 'bg-cyan-100 text-cyan-800' },
      FINAL_EXAM: { label: 'Esame Finale', color: 'bg-orange-100 text-orange-800' },
      RECOGNITION_REQUEST: { label: 'Richiesta Riconoscimento', color: 'bg-pink-100 text-pink-800' },

      // Stati finali
      COMPLETED: { label: 'Completato', color: 'bg-emerald-100 text-emerald-800' },
      PAYMENT_COMPLETED: { label: 'Pagamento Completato', color: 'bg-emerald-100 text-emerald-800' },
      CANCELLED: { label: 'Annullato', color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      IDENTITY_CARD: "Carta d'Identità",
      PASSPORT: 'Passaporto',
      TESSERA_SANITARIA: 'Tessera Sanitaria / Codice Fiscale',
      BACHELOR_DEGREE: 'Certificato Laurea Triennale',
      MASTER_DEGREE: 'Certificato Laurea Magistrale',
      TRANSCRIPT: 'Piano di Studio',
      MEDICAL_CERT: 'Certificato Medico',
      BIRTH_CERT: 'Certificato di Nascita',
      DIPLOMA: 'Diploma di Laurea',
      OTHER: 'Altri Documenti'
    };
    return labels[type] || type;
  };

  // Allow approval if:
  // 1. Status is DOCUMENTS_PARTNER_CHECKED or AWAITING_DISCOVERY_APPROVAL (normal flow)
  // 2. OR discoveryApprovedAt is NULL (recovery mode - for enrollments that advanced without admin approval)
  const canApprove = (
    registration?.status === 'DOCUMENTS_PARTNER_CHECKED' ||
    registration?.status === 'AWAITING_DISCOVERY_APPROVAL' ||
    !registration?.discoveryApprovedAt
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div>
            <h2 className="text-2xl font-bold">Dettaglio Iscrizione</h2>
            <p className="text-indigo-100 text-sm mt-1">ID: {registrationId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : registration ? (
            <div className="space-y-6">
              {/* Status e Azioni */}
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Stato Attuale</p>
                  {getStatusBadge(registration.status)}
                </div>
                {canApprove && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowApproveConfirm(true)}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Approva
                    </button>
                    {/* Reject button removed - not needed for certification flow */}
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Informazioni Utente</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Nome Completo</p>
                    <p className="font-medium text-gray-900">
                      {registration.user.profile?.nome && registration.user.profile?.cognome
                        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
                        : 'Non disponibile'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{registration.user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Codice Fiscale</p>
                    <p className="font-medium text-gray-900">
                      {registration.user.profile?.codiceFiscale || 'Non disponibile'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Telefono</p>
                    <p className="font-medium text-gray-900">
                      {registration.user.profile?.telefono || 'Non disponibile'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Data di Nascita</p>
                    <p className="font-medium text-gray-900">
                      {registration.user.profile?.dataNascita
                        ? new Date(registration.user.profile.dataNascita).toLocaleDateString('it-IT')
                        : 'Non disponibile'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Luogo di Nascita</p>
                    <p className="font-medium text-gray-900">
                      {registration.user.profile?.luogoNascita || 'Non disponibile'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Company & Course Info */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Company</h3>
                  </div>
                  {registration.partnerCompany ? (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Nome</p>
                        <p className="font-medium text-gray-900">{registration.partnerCompany.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Codice Referral</p>
                        <p className="font-medium text-gray-900">{registration.partnerCompany.referralCode}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tipo</p>
                        <p className="font-medium text-gray-900">
                          {registration.partnerCompany.isPremium ? '⭐ Premium' : 'Standard'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Nessuna company assegnata</p>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Corso</h3>
                  </div>
                  {registration.offer ? (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-600">Nome Corso</p>
                        <p className="font-medium text-gray-900">{registration.offer.course.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tipo Template</p>
                        <p className="font-medium text-gray-900">{registration.offer.course.templateType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tipo Offerta</p>
                        <p className="font-medium text-gray-900">{registration.offerType}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Nessun corso disponibile</p>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Informazioni Pagamento</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Importo Finale</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(registration.finalAmount)}
                    </p>
                  </div>
                  {registration.originalAmount !== registration.finalAmount && (
                    <div>
                      <p className="text-sm text-gray-600">Importo Originale</p>
                      <p className="text-lg font-medium text-gray-500 line-through">
                        {formatCurrency(registration.originalAmount)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Rate</p>
                    <p className="text-lg font-medium text-gray-900">{registration.installments}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Documenti Caricati</h3>
                  <span className="ml-auto text-sm text-gray-600">
                    {registration.userDocuments.length} documento/i
                  </span>
                </div>

                {registration.userDocuments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nessun documento caricato</p>
                ) : (
                  <div className="space-y-3">
                    {registration.userDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{getDocumentTypeLabel(doc.type)}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(doc.uploadedAt).toLocaleDateString('it-IT')}
                            </span>
                            {doc.partnerCheckedAt && (
                              <span className="flex items-center gap-1 text-purple-600">
                                <CheckCircle2 className="w-4 h-4" />
                                Partner Check {new Date(doc.partnerCheckedAt).toLocaleDateString('it-IT')}
                              </span>
                            )}
                            {doc.discoveryApprovedAt && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="w-4 h-4" />
                                Discovery OK {new Date(doc.discoveryApprovedAt).toLocaleDateString('it-IT')}
                              </span>
                            )}
                            {doc.discoveryRejectedAt && (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                Rifiutato {new Date(doc.discoveryRejectedAt).toLocaleDateString('it-IT')}
                              </span>
                            )}
                          </div>
                          {doc.discoveryRejectionReason && (
                            <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                              <AlertCircle className="w-4 h-4 inline mr-1" />
                              {doc.discoveryRejectionReason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewDocument(doc)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Anteprima"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <a
                            href={`${getBackendUrl()}/admin/documents/${doc.id}/download?token=${getAuthToken()}`}
                            download={doc.originalName}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  Iscrizione creata il {new Date(registration.createdAt).toLocaleString('it-IT')}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Iscrizione non trovata</p>
            </div>
          )}
        </div>

        {/* Document Preview Modal */}
        {previewDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold">{getDocumentTypeLabel(previewDocument.type)}</h3>
                <button
                  onClick={() => setPreviewDocument(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
                {previewDocument.mimeType?.startsWith('image/') ? (
                  <img src={`${getBackendUrl()}/admin/documents/${previewDocument.id}/preview?token=${getAuthToken()}`} alt={previewDocument.originalName} className="max-w-full h-auto" />
                ) : previewDocument.mimeType === 'application/pdf' ? (
                  <iframe src={`${getBackendUrl()}/admin/documents/${previewDocument.id}/preview?token=${getAuthToken()}`} className="w-full h-[600px] border-0" />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Anteprima non disponibile per questo tipo di file</p>
                    <a
                      href={`${getBackendUrl()}/admin/documents/${previewDocument.id}/download?token=${getAuthToken()}`}
                      download={previewDocument.originalName}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Download className="w-5 h-5" />
                      Scarica File
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approve Confirmation */}
        {showApproveConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Conferma Approvazione</h3>
              <p className="text-gray-600 mb-6">
                Sei sicuro di voler approvare questa iscrizione? Verrà inviata un'email di conferma all'utente.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Approvazione...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Approva
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Form */}
        {showRejectForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Rifiuta Iscrizione</h3>
              <p className="text-gray-600 mb-4">
                Specifica il motivo del rifiuto. Verrà inviata un'email all'utente con le tue indicazioni.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Motivo del rifiuto..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent min-h-[120px] mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason('');
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Rifiuto...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      Rifiuta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
