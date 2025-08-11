import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import { Link, useParams, useNavigate } from 'react-router-dom';
import UserEnrollmentDetail from '../components/User/EnrollmentDetail';
import { getUserStatusDisplay, getStatusColors } from '../utils/statusTranslations';

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
  totalPaid?: number;
  remainingAmount?: number;
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
  paymentSummary?: {
    nextDeadline: {
      id: string;
      amount: number;
      dueDate: string;
      paymentNumber: number;
      daysUntilDue: number;
      isOverdue: boolean;
    } | null;
    paidInstallments: number;
    unpaidInstallments: number;
    totalInstallments: number;
    percentagePaid: number;
  };
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

interface UserDashboardProps {
  onRegistrationClick?: (registrationId: string) => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ onRegistrationClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [urlParams] = useState(() => new URLSearchParams(window.location.search));
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
  const [activeTab, setActiveTab] = useState<'overview' | 'registrations' | 'profile'>(
    () => {
      const tabParam = urlParams.get('tab');
      if (tabParam && ['overview', 'registrations', 'profile'].includes(tabParam)) {
        return tabParam as 'overview' | 'registrations' | 'profile';
      }
      return 'overview';
    }
  );

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

      console.log('API Response - Registrations:', registrationsData);
      console.log('Registrations array:', registrationsData.registrations);
      
      setRegistrations(registrationsData.registrations || []);
      setProfile(profileResponse.profile);
      setAssignedPartner(profileResponse.assignedPartner);
      
      console.log('API Response - Available Courses:', coursesData);
      console.log('Courses array:', coursesData.courses);
      console.log('Courses length:', coursesData.courses?.length);
      
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
    if (!registration.deadlines || !Array.isArray(registration.deadlines)) {
      return null;
    }
    
    const unpaidDeadlines = registration.deadlines
      .filter(d => !d.isPaid)
      .sort((a, b) => {
        // Priorità: acconto (paymentNumber 0) sempre per primo
        if (a.paymentNumber === 0 && b.paymentNumber !== 0) return -1;
        if (a.paymentNumber !== 0 && b.paymentNumber === 0) return 1;
        
        // Se entrambi sono acconto o entrambi sono rate, ordina per data
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    
    return unpaidDeadlines[0] || null;
  };

  const hasDownPaymentDue = () => {
    return registrations.some(r => {
      const nextPayment = getNextPaymentDue(r);
      return nextPayment && nextPayment.paymentNumber === 0;
    });
  };

  const formatCurrency = (amount: number | undefined | null) => {
    const value = Number(amount);
    const safeValue = isNaN(value) ? 0 : value;
    return `€${safeValue.toFixed(2)}`;
  };
  const formatDate = (date: string) => new Date(date).toLocaleDateString('it-IT');

  const handleTabChange = (newTab: 'overview' | 'registrations' | 'profile') => {
    setActiveTab(newTab);
    // Aggiorna l'URL senza ricaricare la pagina
    const url = new URL(window.location.href);
    if (newTab === 'overview') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', newTab);
    }
    window.history.replaceState({}, '', url.toString());
  };

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
                onClick={() => handleTabChange(tab.id as any)}
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
                      <div 
                        key={registration.id} 
                        className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/dashboard/enrollment/${registration.id}`)}
                      >
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
                  const installmentDeadlines = registration.deadlines?.filter(d => d.paymentNumber > 0) || [];
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
                                🎉 Sconto applicato: <span className="font-bold">{formatCurrency((registration.originalAmount || 0) - (registration.finalAmount || 0))}</span>
                              </span>
                              <span className="text-green-600">
                                Da {formatCurrency(registration.originalAmount)} a {formatCurrency(registration.finalAmount)}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                          <div className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-blue-700">Acconto</span>
                              <span className="font-bold text-blue-900">{formatCurrency(nextPayment?.amount)}</span>
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
                              <span className="font-bold text-blue-900">{formatCurrency(registration.finalAmount)}</span>
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

            {/* Payment Overview Section */}
            {registrations.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Riepilogo Pagamenti</h3>
                </div>
                <div className="p-6 space-y-6">
                  {registrations.map((registration) => (
                    <div key={registration.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{registration.courseName}</h4>
                          <p className="text-sm text-gray-600">
                            {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Totale corso</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(registration.finalAmount)}</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {registration.paymentSummary && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Progresso pagamenti</span>
                            <span>{registration.paymentSummary.percentagePaid}% completato</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${registration.paymentSummary.percentagePaid}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{registration.paymentSummary.paidInstallments} rate pagate</span>
                            <span>{registration.paymentSummary.unpaidInstallments} rate rimanenti</span>
                          </div>
                        </div>
                      )}

                      {/* Payment Details Grid */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white rounded p-3">
                          <p className="text-xs text-gray-600">Pagato</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(registration.totalPaid || 0)}
                          </p>
                        </div>
                        <div className="bg-white rounded p-3">
                          <p className="text-xs text-gray-600">Rimanente</p>
                          <p className="text-lg font-semibold text-orange-600">
                            {formatCurrency(registration.remainingAmount || 0)}
                          </p>
                        </div>
                        <div className="bg-white rounded p-3">
                          <p className="text-xs text-gray-600">Rate totali</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {registration.paymentSummary?.totalInstallments || registration.installments}
                          </p>
                        </div>
                      </div>

                      {/* Next Payment Alert */}
                      {registration.paymentSummary?.nextDeadline && (
                        <div className={`border rounded-lg p-3 mb-4 ${
                          registration.paymentSummary.nextDeadline.isOverdue 
                            ? 'bg-red-50 border-red-200' 
                            : registration.paymentSummary.nextDeadline.daysUntilDue <= 7
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className={`font-medium ${
                                registration.paymentSummary.nextDeadline.isOverdue 
                                  ? 'text-red-900' 
                                  : registration.paymentSummary.nextDeadline.daysUntilDue <= 7
                                  ? 'text-yellow-900'
                                  : 'text-blue-900'
                              }`}>
                                ⏰ Prossima scadenza: {
                                  registration.paymentSummary.nextDeadline.paymentNumber === 0 
                                    ? 'Acconto' 
                                    : `Rata ${registration.paymentSummary.nextDeadline.paymentNumber}`
                                }
                              </p>
                              <p className={`text-sm ${
                                registration.paymentSummary.nextDeadline.isOverdue 
                                  ? 'text-red-700' 
                                  : registration.paymentSummary.nextDeadline.daysUntilDue <= 7
                                  ? 'text-yellow-700'
                                  : 'text-blue-700'
                              }`}>
                                {registration.paymentSummary.nextDeadline.isOverdue 
                                  ? '⚠️ SCADUTA' 
                                  : registration.paymentSummary.nextDeadline.daysUntilDue === 0
                                  ? 'Scade oggi'
                                  : registration.paymentSummary.nextDeadline.daysUntilDue === 1
                                  ? 'Scade domani'
                                  : `Scade tra ${registration.paymentSummary.nextDeadline.daysUntilDue} giorni`
                                } - {formatDate(registration.paymentSummary.nextDeadline.dueDate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                registration.paymentSummary.nextDeadline.isOverdue 
                                  ? 'text-red-900' 
                                  : registration.paymentSummary.nextDeadline.daysUntilDue <= 7
                                  ? 'text-yellow-900'
                                  : 'text-blue-900'
                              }`}>
                                {formatCurrency(registration.paymentSummary.nextDeadline.amount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* All Payment Deadlines */}
                      {registration.deadlines && registration.deadlines.length > 0 && (
                        <div className="mt-4">
                          <h5 className="text-sm font-semibold text-gray-700 mb-2">📅 Scadenzario Completo</h5>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {registration.deadlines
                              .sort((a, b) => a.paymentNumber - b.paymentNumber)
                              .map((deadline, index) => {
                                const isNext = registration.paymentSummary?.nextDeadline?.id === deadline.id;
                                const isOverdue = !deadline.isPaid && new Date(deadline.dueDate) < new Date();
                                
                                return (
                                  <div 
                                    key={deadline.id}
                                    className={`flex items-center justify-between p-2 rounded-lg border ${
                                      deadline.isPaid 
                                        ? 'bg-green-50 border-green-200' 
                                        : isNext
                                        ? 'bg-yellow-50 border-yellow-300 ring-2 ring-yellow-400'
                                        : isOverdue
                                        ? 'bg-red-50 border-red-200'
                                        : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-shrink-0">
                                        {deadline.isPaid ? (
                                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                        ) : isNext ? (
                                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center animate-pulse">
                                            <span className="text-white text-xs font-bold">!</span>
                                          </div>
                                        ) : (
                                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                                            <span className="text-gray-600 text-xs">{index + 1}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <p className={`text-sm font-medium ${
                                          deadline.isPaid 
                                            ? 'text-green-700' 
                                            : isNext
                                            ? 'text-yellow-900'
                                            : isOverdue
                                            ? 'text-red-700'
                                            : 'text-gray-700'
                                        }`}>
                                          {deadline.paymentNumber === 0 ? 'Acconto' : `Rata ${deadline.paymentNumber}`}
                                          {isNext && <span className="ml-2 text-xs bg-yellow-200 px-2 py-1 rounded">PROSSIMA</span>}
                                        </p>
                                        <p className={`text-xs ${
                                          deadline.isPaid 
                                            ? 'text-green-600' 
                                            : 'text-gray-500'
                                        }`}>
                                          {formatDate(deadline.dueDate)}
                                          {deadline.isPaid && ' - Pagata'}
                                          {!deadline.isPaid && isOverdue && ' - SCADUTA'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={`font-semibold ${
                                        deadline.isPaid 
                                          ? 'text-green-700 line-through' 
                                          : isNext
                                          ? 'text-yellow-900 text-lg'
                                          : 'text-gray-700'
                                      }`}>
                                        {formatCurrency(deadline.amount)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* View Details Link */}
                      <div className="mt-3 text-center">
                        <button
                          onClick={() => navigate(`/dashboard/enrollment/${registration.id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Visualizza dettagli completi →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Courses - Only show if there are enabled courses */}
            {availableCourses.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Corsi Disponibili</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Corsi aggiuntivi che il tuo partner ha abilitato per te
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
                                <span className="font-medium">Prezzo:</span> {formatCurrency(course.finalAmount || course.totalAmount)}
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
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColors(course.enrollmentStatus).combined}`}>
                                    {getUserStatusDisplay(course.enrollmentStatus)}
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
            )}
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="space-y-4">
            {registrations.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📚</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Nessuna iscrizione</h3>
                <p className="text-gray-600 mb-4">Non hai ancora effettuato nessuna iscrizione ai corsi.</p>
                <p className="text-gray-500 text-sm">
                  Controlla la sezione "Corsi Disponibili" per vedere i corsi a cui puoi iscriverti tramite i link del tuo partner
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registrations.map((registration) => (
                  <div 
                    key={registration.id} 
                    className="bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 transform hover:-translate-y-1"
                    onClick={() => navigate(`/dashboard/enrollment/${registration.id}`)}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {registration.courseName}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                          </p>
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {getStatusBadge(registration.status)}
                        </div>
                      </div>

                      {/* Amount & Discount */}
                      <div className="mb-3">
                        {Number(registration.originalAmount) !== Number(registration.finalAmount) && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-2">
                            <div className="text-xs text-green-700 font-medium">
                              🎉 Sconto: {formatCurrency((registration.originalAmount || 0) - (registration.finalAmount || 0))}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Importo totale:</span>
                          <span className="text-lg font-bold text-gray-900">{formatCurrency(registration.finalAmount)}</span>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Rate:</span>
                          <span className="font-medium">{registration.installments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Data iscrizione:</span>
                          <span className="font-medium">{formatDate(registration.createdAt)}</span>
                        </div>
                      </div>

                      {/* Next Payment */}
                      {(() => {
                        const nextPayment = getNextPaymentDue(registration);
                        return nextPayment ? (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium text-yellow-800">
                                {nextPayment.paymentNumber === 0 ? 'Acconto' : `Rata ${nextPayment.paymentNumber}`}
                              </span>
                              <span className="text-xs font-bold text-yellow-900">
                                {formatCurrency(nextPayment?.amount)}
                              </span>
                            </div>
                            <div className="text-xs text-yellow-700 mt-1">
                              Scadenza: {formatDate(nextPayment.dueDate)}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Click indicator */}
                      <div className="mt-3 text-center">
                        <div className="text-xs text-blue-600 font-medium">
                          Clicca per vedere i dettagli →
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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

// Enhanced UserDashboard with URL-based routing
const EnhancedUserDashboard: React.FC = () => {
  const { registrationId } = useParams<{ registrationId?: string }>();
  const navigate = useNavigate();

  const handleBackToRegistrations = () => {
    navigate('/dashboard');
  };

  // If a registration is selected via URL, show the detail view
  if (registrationId) {
    return (
      <UserEnrollmentDetail 
        registrationId={registrationId}
        onBack={handleBackToRegistrations}
      />
    );
  }

  // Otherwise, show the regular dashboard
  return <UserDashboard />;
};

export default EnhancedUserDashboard;