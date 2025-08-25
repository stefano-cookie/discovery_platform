import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { apiRequest } from '../../../services/api';
import UserEnrollmentFlow from './UserEnrollmentFlow';
import UserContractSection from './UserContractSection';
import MyDocuments from '../Documents/MyDocuments';
import TfaSteps from './TfaSteps';
import CertificationSteps from './CertificationSteps';
import { getUserStatusDisplay, getStatusTranslation } from '../../../utils/statusTranslations';

interface UserRegistration {
  id: string;
  courseId: string;
  courseName: string;
  status: string;
  originalAmount: number;
  finalAmount: number;
  installments: number;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  createdAt: string;
  contractTemplateUrl?: string;
  contractSignedUrl?: string;
  contractGeneratedAt?: string;
  contractUploadedAt?: string;
  partner: {
    referralCode: string;
    user: {
      email: string;
    };
  };
  deadlines: Array<{
    id: string;
    amount: number;
    dueDate: string;
    paymentNumber: number;
    isPaid: boolean;
    partialAmount?: number;
    paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
    notes?: string;
  }>;
  totalPaid?: number;
  remainingAmount?: number;
  delayedAmount?: number;
}

interface UserEnrollmentDetailProps {
  registrationId: string;
  onBack: () => void;
}

const UserEnrollmentDetail: React.FC<UserEnrollmentDetailProps> = ({ 
  registrationId, 
  onBack 
}) => {
  const { user } = useAuth();
  const [registration, setRegistration] = useState<UserRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistrationDetails();
  }, [registrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRegistrationDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiRequest<{ registration: UserRegistration }>({
        method: 'GET',
        url: `/user/registrations/${registrationId}`
      });
      
      setRegistration(response.registration);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento dei dettagli dell\'iscrizione');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusTranslation(status).color}`}>
        {getUserStatusDisplay(status)}
      </span>
    );
  };

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dettagli iscrizione...</p>
        </div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onBack}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Torna alle iscrizioni
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Torna al dashboard
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  La Mia Iscrizione
                </h1>
                <p className="text-sm text-gray-600">
                  {registration.courseName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge(registration.status)}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Workflow Flow */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stato della Tua Iscrizione</h2>
            <UserEnrollmentFlow status={registration.status} registration={registration} />
          </div>

          {/* Course Details */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dettagli Corso</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Informazioni Corso</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Nome corso:</span>
                    <span className="font-medium">{registration.courseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">
                      {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Partner:</span>
                    <span className="font-medium">{registration.partner.user.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data iscrizione:</span>
                    <span className="font-medium">{formatDate(registration.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Informazioni Pagamento</h3>
                <div className="space-y-2 text-sm">
                  {Number(registration.originalAmount) !== Number(registration.finalAmount) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-700 font-medium">
                          🎉 Sconto applicato: {formatCurrency(Number(registration.originalAmount) - Number(registration.finalAmount))}
                        </span>
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Da {formatCurrency(Number(registration.originalAmount))} a {formatCurrency(Number(registration.finalAmount))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Importo totale:</span>
                    <span className="font-medium">{formatCurrency(Number(registration.finalAmount))}</span>
                  </div>
                  {registration.totalPaid !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Importo pagato:</span>
                      <span className="font-medium text-green-600">{formatCurrency(registration.totalPaid)}</span>
                    </div>
                  )}
                  {registration.delayedAmount !== undefined && registration.delayedAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Importo in ritardo:</span>
                      <span className="font-medium text-red-600">{formatCurrency(registration.delayedAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Numero rate:</span>
                    <span className="font-medium">{registration.installments}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Schedule */}
          {registration.deadlines.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Scadenze Pagamenti</h2>
              
              {/* Payment Summary */}
              {(registration.totalPaid || registration.delayedAmount) && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600">Pagato</p>
                    <p className="text-xl font-semibold text-green-900">
                      {formatCurrency(registration.totalPaid || 0)}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-orange-600">Rimanente</p>
                    <p className="text-xl font-semibold text-orange-900">
                      {formatCurrency(registration.remainingAmount || 0)}
                    </p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-600">Ritardi</p>
                    <p className="text-xl font-semibold text-red-900">
                      {formatCurrency(registration.delayedAmount || 0)}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {registration.deadlines.map((deadline) => {
                  const isOverdue = !deadline.isPaid && deadline.paymentStatus !== 'PARTIAL' && new Date(deadline.dueDate) < new Date();
                  return (
                    <div key={deadline.id} className={`p-4 rounded-lg border ${
                      deadline.isPaid 
                        ? 'bg-green-50 border-green-200' 
                        : deadline.paymentStatus === 'PARTIAL'
                        ? 'bg-yellow-50 border-yellow-200'
                        : isOverdue
                          ? 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {deadline.paymentNumber === 0 ? 'Acconto' : `Rata ${deadline.paymentNumber}`}
                          </span>
                          {deadline.isPaid && (
                            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          {deadline.paymentStatus === 'PARTIAL' && (
                            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-bold">½</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          deadline.isPaid 
                            ? 'bg-green-100 text-green-800'
                            : deadline.paymentStatus === 'PARTIAL'
                            ? 'bg-yellow-100 text-yellow-800'
                            : isOverdue
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {deadline.isPaid ? 'Pagata' : deadline.paymentStatus === 'PARTIAL' ? 'Personalizzato' : isOverdue ? 'Scaduta' : 'In attesa'}
                        </span>
                      </div>
                      
                      {deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount ? (
                        <div>
                          <div className="text-lg font-semibold mb-1 text-yellow-700">
                            {formatCurrency(deadline.partialAmount)} / {formatCurrency(Number(deadline.amount))}
                          </div>
                          <div className="text-sm text-red-600 mb-1">
                            Ritardo: {formatCurrency(Number(deadline.amount) - deadline.partialAmount)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-lg font-semibold mb-1">
                          {formatCurrency(Number(deadline.amount))}
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Scadenza: {formatDate(deadline.dueDate)}
                        {deadline.isPaid && ' - Pagata'}
                        {deadline.paymentStatus === 'PARTIAL' && ' - Pagamento Personalizzato'}
                      </div>
                      
                      {deadline.notes && (
                        <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-100 rounded">
                          Note: {deadline.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Payment Instructions */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Come effettuare il pagamento</h4>
                    <p className="text-xs text-blue-700">
                      Tutti i pagamenti devono essere effettuati tramite bonifico bancario. 
                      I dettagli per il bonifico ti verranno forniti dal tuo partner di riferimento.
                      Contatta {registration.partner.user.email} per ricevere le coordinate bancarie.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contract Section - Only for TFA */}
          {registration.offerType === 'TFA_ROMANIA' && (
            <UserContractSection registration={registration} />
          )}

          {/* TFA Post-enrollment Steps */}
          {registration.offerType === 'TFA_ROMANIA' && registration.status !== 'PENDING' && registration.status !== 'DATA_VERIFIED' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <TfaSteps registrationId={registration.id} />
            </div>
          )}

          {/* Certification Steps - Nascosto perché già mostrato in UserEnrollmentFlow */}
          {/* {registration.offerType === 'CERTIFICATION' && registration.status !== 'PENDING' && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <CertificationSteps registrationId={registration.id} />
            </div>
          )} */}

          {/* Documents Section */}
          {user && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <MyDocuments 
                userId={user.id} 
                registrations={registration ? [registration] : []}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserEnrollmentDetail;