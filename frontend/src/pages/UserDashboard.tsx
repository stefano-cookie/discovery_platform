import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import { Link } from 'react-router-dom';

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
  partner: {
    referralCode: string;
    user: {
      email: string;
    };
  };
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    isConfirmed: boolean;
    paymentNumber: number;
  }>;
  deadlines: Array<{
    id: string;
    amount: number;
    dueDate: string;
    paymentNumber: number;
    isPaid: boolean;
  }>;
}

interface UserProfile {
  id: string;
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  codiceFiscale: string;
  telefono: string;
  nomePadre?: string;
  nomeMadre?: string;
  residenzaVia: string;
  residenzaCitta: string;
  residenzaProvincia: string;
  residenzaCap: string;
  hasDifferentDomicilio: boolean;
  domicilioVia?: string;
  domicilioCitta?: string;
  domicilioProvincia?: string;
  domicilioCap?: string;
  tipoLaurea?: string;
  laureaConseguita?: string;
  laureaUniversita?: string;
  laureaData?: string;
  tipoProfessione?: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
}

const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assignedPartner, setAssignedPartner] = useState<any>(null);
  const [availableCourses, setAvailableCourses] = useState<{
    id: string;
    name: string;
    description: string;
    partnerOfferId: string;
    offerType: string;
    totalAmount: number;
    finalAmount?: number;
    installments: number;
    isOriginal: boolean;
    isEnrolled: boolean;
    enrollmentStatus: string | null;
    referralLink: string | null;
  }[]>([]);
  const [coursesMessage, setCoursesMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'profile'>('overview');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [registrationsData, profileResponse, coursesData] = await Promise.all([
        apiRequest<{ registrations: UserRegistration[] }>({
          method: 'GET',
          url: '/user/registrations'
        }),
        apiRequest<{ user: any; profile: UserProfile; assignedPartner: any }>({
          method: 'GET',
          url: '/user/profile'
        }),
        apiRequest<{ courses: any[]; message?: string }>({
          method: 'GET',
          url: '/user/available-courses'
        })
      ]);

      setRegistrations(registrationsData.registrations || []);
      setProfile(profileResponse.profile);
      setAssignedPartner(profileResponse.assignedPartner);
      setAvailableCourses(coursesData.courses || []);
      setCoursesMessage(coursesData.message || null);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { label: 'In Attesa', color: 'bg-yellow-100 text-yellow-800' },
      DATA_VERIFIED: { label: 'Dati Verificati', color: 'bg-blue-100 text-blue-800' },
      CONTRACT_GENERATED: { label: 'Contratto Generato', color: 'bg-purple-100 text-purple-800' },
      CONTRACT_SIGNED: { label: 'Contratto Firmato', color: 'bg-indigo-100 text-indigo-800' },
      ENROLLED: { label: 'Iscritto', color: 'bg-green-100 text-green-800' },
      COMPLETED: { label: 'Completato', color: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };


  const getNextPaymentDue = (registration: UserRegistration) => {
    const unpaidDeadlines = registration.deadlines
      .filter(d => !d.isPaid)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    return unpaidDeadlines[0] || null;
  };

  const hasDownPaymentDue = () => {
    return registrations.some(r => {
      const nextPayment = getNextPaymentDue(r);
      return nextPayment && nextPayment.paymentNumber === 0;
    });
  };

  const formatCurrency = (amount: number) => `€${amount.toFixed(2)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Ciao, {profile?.nome || user?.email}!
              </h1>
              <p className="mt-1 text-gray-600">
                Gestisci le tue iscrizioni e il tuo profilo
              </p>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Panoramica' },
              { id: 'registrations', label: 'Le Mie Iscrizioni' },
              { id: 'profile', label: 'Profilo' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Iscrizioni Totali</h3>
                <p className="text-3xl font-bold text-blue-600">{registrations.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Iscrizioni Attive</h3>
                <p className="text-3xl font-bold text-green-600">
                  {registrations.filter(r => ['ENROLLED', 'CONTRACT_SIGNED'].includes(r.status)).length}
                </p>
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Iscrizioni Recenti</h3>
              </div>
              <div className="p-6">
                {registrations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-xl mb-2">📚</div>
                    <p className="text-gray-500 mb-4">Non hai ancora nessuna iscrizione</p>
                    <p className="text-gray-400 text-sm">
                      Controlla la sezione "Corsi Disponibili" per vedere i corsi a cui puoi iscriverti
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {registrations.slice(0, 3).map((registration) => (
                      <div key={registration.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {registration.courseName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                            </p>
                          </div>
                          {getStatusBadge(registration.status)}
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Iscritto il: {formatDate(registration.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Down Payment Info Badge */}
            {hasDownPaymentDue() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                {registrations.map((registration) => {
                  const nextPayment = getNextPaymentDue(registration);
                  if (!nextPayment || nextPayment.paymentNumber !== 0) return null;
                  
                  // Calculate installment amount dynamically from actual deadlines
                  const installmentDeadlines = registration.deadlines.filter(d => d.paymentNumber > 0);
                  const installmentAmount = installmentDeadlines.length > 0 ? Number(installmentDeadlines[0].amount) : 0;
                  
                  return (
                    <div key={registration.id} className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-blue-900 mb-3">
                          💳 Piano di Pagamento - {registration.courseName}
                        </h3>
                        {Number(registration.originalAmount) !== Number(registration.finalAmount) && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-green-700">
                                🎉 Sconto applicato: <span className="font-bold">{formatCurrency(Number(registration.originalAmount) - Number(registration.finalAmount))}</span>
                              </span>
                              <span className="text-green-600">
                                Da {formatCurrency(Number(registration.originalAmount))} a {formatCurrency(Number(registration.finalAmount))}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700">Acconto</span>
                              <span className="font-bold text-blue-900">{formatCurrency(Number(nextPayment.amount))}</span>
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Scadenza: {formatDate(nextPayment.dueDate)}
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700">Rate mensili</span>
                              <span className="font-bold text-blue-900">
                                {registration.installments} × {formatCurrency(installmentAmount)}
                              </span>
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Dal mese successivo
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700">Totale corso</span>
                              <span className="font-bold text-blue-900">{formatCurrency(Number(registration.finalAmount))}</span>
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Importo finale
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Nota:</span> Le rate mensili inizieranno automaticamente dal mese successivo al pagamento dell'acconto.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Next Payments */}
            {registrations.some(r => getNextPaymentDue(r)) && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Prossimi Pagamenti</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {registrations.map((registration) => {
                      const nextPayment = getNextPaymentDue(registration);
                      if (!nextPayment) return null;
                      
                      return (
                        <div key={registration.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{registration.courseName}</p>
                            <p className="text-sm text-gray-600">
                              {nextPayment.paymentNumber === 0 ? 'Acconto' : `Rata ${nextPayment.paymentNumber}`} - Scadenza: {formatDate(nextPayment.dueDate)}
                            </p>
                          </div>
                          <span className="font-bold text-yellow-800">{formatCurrency(Number(nextPayment.amount))}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Available Courses */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Corsi Disponibili</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Corsi che il tuo partner ha abilitato per te
                </p>
              </div>
              <div className="p-6">
                {availableCourses.length > 0 ? (
                  <div className="space-y-4">
                    {availableCourses.map((course) => (
                      <div key={course.partnerOfferId} className={`border-2 rounded-xl p-6 transition-all duration-200 ${
                        course.isOriginal 
                          ? 'border-green-200 bg-green-50' 
                          : course.isEnrolled
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-3">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {course.name}
                              </h4>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Prezzo:</span> {formatCurrency(course.finalAmount ?? course.totalAmount)}
                              </div>
                              <div>
                                <span className="font-medium">Rate:</span> {course.installments} {course.installments === 1 ? 'rata' : 'rate'}
                              </div>
                            </div>
                          </div>

                          <div className="ml-6 flex flex-col items-end space-y-3">
                            {course.isEnrolled ? (
                              <div className="text-center">
                                <div className="flex items-center text-green-700 font-medium mb-2">
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Già Iscritto
                                </div>
                                {course.enrollmentStatus && (
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    course.enrollmentStatus === 'ENROLLED' 
                                      ? 'bg-green-100 text-green-800'
                                      : course.enrollmentStatus === 'PENDING'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {course.enrollmentStatus === 'ENROLLED' ? 'Attivo' :
                                     course.enrollmentStatus === 'PENDING' ? 'In Attesa' :
                                     course.enrollmentStatus}
                                  </span>
                                )}
                              </div>
                            ) : course.referralLink ? (
                              <a
                                href={course.referralLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center"
                              >
                                Iscriviti Ora
                                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M17 1l4 4-4 4M21 5H9" />
                                </svg>
                              </a>
                            ) : (
                              <div className="text-center">
                                <span className="text-gray-500 text-sm font-medium">
                                  Disponibile
                                </span>
                                <p className="text-xs text-gray-400 mt-1">
                                  Usa il link del partner
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-1">Come funziona:</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-700">
                            <li><strong>In attesa:</strong> Hai effettuato la richiesta di iscrizione</li>
                            <li><strong>Corsi Aggiuntivi:</strong> Altri corsi che il tuo partner ti ha abilitato</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-xl mb-4">🎓</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Nessun corso disponibile</h4>
                    <p className="text-gray-600 mb-4">
                      {coursesMessage || 'Non ci sono corsi disponibili per te al momento.'}
                    </p>
                    {assignedPartner ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-blue-800 text-sm">
                          <strong>Partner di riferimento:</strong> {assignedPartner.email}
                        </p>
                        <p className="text-blue-700 text-sm mt-1">
                          Contatta il tuo partner per richiedere l'accesso a nuovi corsi.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-orange-800 text-sm font-medium">
                          ⚠️ Nessun partner assegnato
                        </p>
                        <p className="text-orange-700 text-sm mt-1">
                          Contatta il supporto per ottenere accesso ai corsi.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            {registrations.map((registration) => (
              <div key={registration.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {registration.courseName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                      </p>
                    </div>
                    {getStatusBadge(registration.status)}
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Payment Info */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Informazioni Pagamento</h4>
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
                        <div className="flex justify-between">
                          <span className="text-gray-600">Numero rate:</span>
                          <span className="font-medium">{registration.installments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Iscritto il:</span>
                          <span className="font-medium">{formatDate(registration.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Schedule */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Scadenze Pagamenti</h4>
                      <div className="space-y-2">
                        {registration.deadlines.map((deadline) => (
                          <div key={deadline.id} className={`flex justify-between items-center p-2 rounded text-sm ${
                            deadline.isPaid ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'
                          }`}>
                            <span>{deadline.paymentNumber === 0 ? 'Acconto' : `Rata ${deadline.paymentNumber}`}</span>
                            <span>{formatDate(deadline.dueDate)}</span>
                            <span className="font-medium">{formatCurrency(Number(deadline.amount))}</span>
                            <span className={deadline.isPaid ? 'text-green-600' : 'text-orange-600'}>
                              {deadline.isPaid ? '✓ Pagata' : 'In sospeso'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {registrations.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📚</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Nessuna iscrizione</h3>
                <p className="text-gray-600 mb-4">Non hai ancora effettuato nessuna iscrizione ai corsi.</p>
                <p className="text-gray-500 text-sm">
                  Controlla la sezione "Corsi Disponibili" per vedere i corsi a cui puoi iscriverti tramite i link del tuo partner
                </p>
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Dati Anagrafici</h3>
                  <Link
                    to="/change-password"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Cambia Password
                  </Link>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Informazioni Personali</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-600 block">Email:</span>
                        <span className="font-medium">{user?.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Nome Completo:</span>
                        <span className="font-medium">{profile.nome} {profile.cognome}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Data di Nascita:</span>
                        <span className="font-medium">{new Date(profile.dataNascita).toLocaleDateString('it-IT')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Luogo di Nascita:</span>
                        <span className="font-medium">{profile.luogoNascita}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Codice Fiscale:</span>
                        <span className="font-medium">{profile.codiceFiscale}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 block">Telefono:</span>
                        <span className="font-medium">{profile.telefono}</span>
                      </div>
                      {profile.nomePadre && (
                        <div>
                          <span className="text-gray-600 block">Nome Padre:</span>
                          <span className="font-medium">{profile.nomePadre}</span>
                        </div>
                      )}
                      {profile.nomeMadre && (
                        <div>
                          <span className="text-gray-600 block">Nome Madre:</span>
                          <span className="font-medium">{profile.nomeMadre}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Residenza</h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-600 block">Indirizzo:</span>
                        <span className="font-medium">
                          {profile.residenzaVia}, {profile.residenzaCap} {profile.residenzaCitta} ({profile.residenzaProvincia})
                        </span>
                      </div>
                      {profile.hasDifferentDomicilio && (
                        <div>
                          <span className="text-gray-600 block">Domicilio:</span>
                          <span className="font-medium">
                            {profile.domicilioVia}, {profile.domicilioCap} {profile.domicilioCitta} ({profile.domicilioProvincia})
                          </span>
                        </div>
                      )}
                    </div>

                    {(profile.tipoLaurea || profile.tipoProfessione) && (
                      <>
                        <h4 className="font-medium text-gray-900 mb-3 mt-6">Istruzione e Professione</h4>
                        <div className="space-y-3 text-sm">
                          {profile.tipoLaurea && (
                            <div>
                              <span className="text-gray-600 block">Laurea:</span>
                              <span className="font-medium">
                                {profile.tipoLaurea} in {profile.laureaConseguita}
                              </span>
                              {profile.laureaUniversita && (
                                <span className="block text-gray-600">presso {profile.laureaUniversita}</span>
                              )}
                            </div>
                          )}
                          {profile.tipoProfessione && (
                            <div>
                              <span className="text-gray-600 block">Professione:</span>
                              <span className="font-medium">{profile.tipoProfessione}</span>
                              {profile.scuolaDenominazione && (
                                <span className="block text-gray-600">
                                  presso {profile.scuolaDenominazione}, {profile.scuolaCitta}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {assignedPartner && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 mb-2">Partner di Riferimento</h4>
                <p className="text-blue-700">
                  Il tuo partner di riferimento è: <span className="font-medium">{assignedPartner.email}</span>
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Codice Partner: <span className="font-medium">{assignedPartner.referralCode}</span>
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Tutte le tue future iscrizioni saranno associate a questo partner.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;