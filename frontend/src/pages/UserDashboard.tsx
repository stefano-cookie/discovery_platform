import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import { Link, useParams, useNavigate } from 'react-router-dom';
import UserEnrollmentDetail from '../components/User/EnrollmentDetail';
import { getUserStatusDisplay, getStatusColors, getStatusBadge } from '../utils/statusTranslations';
import LogoutDropdown from '../components/UI/LogoutDropdown';
import { useRealtimeRegistration } from '../hooks/useRealtimeRegistration';

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
  delayedAmount?: number;
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
    partialAmount?: number;
    paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
    notes?: string;
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
    partialInstallments: number;
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
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // 🔌 WebSocket Real-time Updates
  const { refreshTrigger } = useRealtimeRegistration(
    // onStatusChange
    (payload) => {
      console.log('[UserDashboard] 🔄 Registration status changed:', payload);
      setLastUpdate(new Date());
      loadUserData();
    },
    // onPaymentUpdate
    (payload) => {
      console.log('[UserDashboard] 💳 Payment updated:', payload);
      setLastUpdate(new Date());
      loadUserData();
    },
    // onDocumentUpload
    (payload) => {
      console.log('[UserDashboard] 📄 Document uploaded:', payload);
      setLastUpdate(new Date());
      loadUserData();
    },
    // onDocumentApproval
    (payload) => {
      console.log('[UserDashboard] ✅ Document approved:', payload);
      setLastUpdate(new Date());
      loadUserData();
    },
    // onDocumentRejection
    (payload) => {
      console.log('[UserDashboard] ❌ Document rejected:', payload);
      setLastUpdate(new Date());
      loadUserData();
    },
    // onContractSigned
    (payload) => {
      console.log('[UserDashboard] ✍️ Contract signed:', payload);
      setLastUpdate(new Date());
      loadUserData();
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

  const renderStatusBadge = (status: string) => {
    const badge = getStatusBadge(status);
    return (
      <span className={badge.className}>
        {badge.label}
      </span>
    );
  };


  const getNextPaymentDue = (registration: UserRegistration) => {
    if (!registration.deadlines || !Array.isArray(registration.deadlines)) {
      return null;
    }
    
    const unpaidDeadlines = registration.deadlines
      .filter(d => !d.isPaid && d.paymentStatus !== 'PARTIAL')
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

  const handleLogoutClick = () => {
    setShowLogoutDropdown(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDropdown(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutDropdown(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
                Benvenuto, {profile?.nome || user?.email?.split('@')[0]}
              </h1>
              <div className="mt-2 flex items-center space-x-3">
                <p className="text-lg text-slate-600">
                  Gestisci le tue iscrizioni e il tuo profilo
                </p>
                <div className="flex items-center space-x-2 text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Aggiornato in tempo reale</span>
                  <span className="text-xs text-slate-400">
                    ({lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                  </span>
                </div>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={handleLogoutClick}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
              >
                Esci
              </button>
              <LogoutDropdown 
                isOpen={showLogoutDropdown}
                onConfirm={handleLogoutConfirm}
                onCancel={handleLogoutCancel}
                position="bottom"
                align="end"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-10">
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'overview', label: 'Panoramica' },
              { id: 'registrations', label: 'Le Mie Iscrizioni' },
              { id: 'profile', label: 'Profilo' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Iscrizioni Totali</p>
                    <p className="text-2xl font-bold text-slate-900">{registrations.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600">Iscrizioni Attive</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {registrations.filter(r => ['ENROLLED', 'CONTRACT_SIGNED'].includes(r.status)).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Registrations */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Iscrizioni Recenti</h3>
              </div>
              <div className="p-6">
                {registrations.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-slate-900 mb-2">Nessuna iscrizione</h4>
                    <p className="text-slate-600 text-sm max-w-sm mx-auto">
                      Non hai ancora effettuato nessuna iscrizione. Controlla la sezione "Corsi Disponibili" per iniziare.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {registrations.slice(0, 3).map((registration) => (
                      <div 
                        key={registration.id} 
                        className="group p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200"
                        onClick={() => navigate(`/dashboard/enrollment/${registration.id}`)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {registration.courseName}
                            </h4>
                            <p className="text-sm text-slate-600 mt-1">
                              {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                            </p>
                          </div>
                          {renderStatusBadge(registration.status)}
                        </div>
                        <div className="flex justify-between items-center text-sm text-slate-600">
                          <span>Iscritto il {formatDate(registration.createdAt)}</span>
                          <span className="text-blue-600 group-hover:text-blue-700 font-medium">
                            Visualizza dettagli →
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {registrations.length > 3 && (
                      <div className="pt-4 border-t border-slate-200">
                        <button
                          onClick={() => handleTabChange('registrations')}
                          className="w-full text-center py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Visualizza tutte le iscrizioni ({registrations.length - 3} altre)
                        </button>
                      </div>
                    )}
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
                            <span>
                              {registration.paymentSummary.paidInstallments} pagate
                              {registration.paymentSummary.partialInstallments > 0 && 
                                ` + ${registration.paymentSummary.partialInstallments} parziali`
                              }
                            </span>
                            <span>{registration.paymentSummary.unpaidInstallments} rimanenti</span>
                          </div>
                        </div>
                      )}

                      {/* Payment Details Grid */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
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
                          <p className="text-xs text-gray-600">Ritardi</p>
                          <p className="text-lg font-semibold text-red-600">
                            {formatCurrency(registration.delayedAmount || 0)}
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

                      {/* All Payment Deadlines - Show for CONTRACT_SIGNED, ENROLLED, COMPLETED */}
                      {registration.deadlines && registration.deadlines.length > 0 && 
                       ['CONTRACT_SIGNED', 'ENROLLED', 'COMPLETED'].includes(registration.status) && (
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
                                        : deadline.paymentStatus === 'PARTIAL'
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : isNext
                                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
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
                                        ) : deadline.paymentStatus === 'PARTIAL' ? (
                                          <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">½</span>
                                          </div>
                                        ) : isNext ? (
                                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
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
                                            : deadline.paymentStatus === 'PARTIAL'
                                            ? 'text-yellow-700'
                                            : isNext
                                            ? 'text-blue-900'
                                            : isOverdue
                                            ? 'text-red-700'
                                            : 'text-gray-700'
                                        }`}>
                                          {deadline.paymentNumber === 0 ? 'Acconto' : `Rata ${deadline.paymentNumber}`}
                                          {deadline.paymentStatus === 'PARTIAL' && <span className="ml-2 text-xs bg-yellow-200 px-2 py-1 rounded">PARZIALE</span>}
                                          {isNext && <span className="ml-2 text-xs bg-blue-200 px-2 py-1 rounded">PROSSIMA</span>}
                                        </p>
                                        <p className={`text-xs ${
                                          deadline.isPaid 
                                            ? 'text-green-600' 
                                            : deadline.paymentStatus === 'PARTIAL'
                                            ? 'text-yellow-600'
                                            : 'text-gray-500'
                                        }`}>
                                          {formatDate(deadline.dueDate)}
                                          {deadline.isPaid && ' - Pagata'}
                                          {deadline.paymentStatus === 'PARTIAL' && ' - Pagamento Personalizzato'}
                                          {!deadline.isPaid && deadline.paymentStatus !== 'PARTIAL' && isOverdue && ' - SCADUTA'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                        {deadline.paymentStatus === 'PARTIAL' && deadline.partialAmount ? (
                                          <div>
                                            <p className="font-semibold text-yellow-700">
                                              {formatCurrency(deadline.partialAmount)} / {formatCurrency(deadline.amount)}
                                            </p>
                                            <p className="text-xs text-red-600">
                                              Ritardo: {formatCurrency(deadline.amount - deadline.partialAmount)}
                                            </p>
                                          </div>
                                        ) : (
                                          <p className={`font-semibold ${
                                            deadline.isPaid 
                                              ? 'text-green-700 line-through' 
                                              : isNext
                                              ? 'text-blue-900 text-lg'
                                              : 'text-gray-700'
                                          }`}>
                                            {formatCurrency(deadline.amount)}
                                          </p>
                                        )}
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
          <div className="space-y-6">
            {registrations.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Nessuna iscrizione</h3>
                <p className="text-slate-600 text-lg mb-2 max-w-md mx-auto">Non hai ancora effettuato nessuna iscrizione ai corsi.</p>
                <p className="text-slate-500 text-sm max-w-lg mx-auto">
                  Controlla la sezione "Corsi Disponibili" per vedere i corsi a cui puoi iscriverti tramite i link del tuo partner
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {registrations.map((registration) => (
                  <div 
                    key={registration.id} 
                    className="group bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
                    onClick={() => navigate(`/dashboard/enrollment/${registration.id}`)}
                  >
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {registration.courseName}
                          </h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                          </p>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {renderStatusBadge(registration.status)}
                        </div>
                      </div>

                      {/* Amount & Discount */}
                      <div className="mb-4">
                        {Number(registration.originalAmount) !== Number(registration.finalAmount) && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center">
                              <div className="w-4 h-4 bg-emerald-500 rounded-full flex-shrink-0 mr-2"></div>
                              <span className="text-sm text-emerald-700 font-medium">
                                Sconto applicato: {formatCurrency((registration.originalAmount || 0) - (registration.finalAmount || 0))}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-600">Importo totale</span>
                            <span className="text-xl font-bold text-slate-900">{formatCurrency(registration.finalAmount)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-xs text-blue-600 font-medium mb-1">Rate</div>
                          <div className="text-lg font-bold text-blue-900">{registration.installments}</div>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-lg">
                          <div className="text-xs text-slate-600 font-medium mb-1">Iscrizione</div>
                          <div className="text-sm font-bold text-slate-900">{formatDate(registration.createdAt)}</div>
                        </div>
                      </div>

                      {/* Next Payment */}
                      {(() => {
                        const nextPayment = getNextPaymentDue(registration);
                        return nextPayment ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-semibold text-amber-800">
                                {nextPayment.paymentNumber === 0 ? 'Acconto in scadenza' : `Rata ${nextPayment.paymentNumber}`}
                              </span>
                              <span className="text-sm font-bold text-amber-900">
                                {formatCurrency(nextPayment?.amount)}
                              </span>
                            </div>
                            <div className="text-xs text-amber-700">
                              Scadenza: {formatDate(nextPayment.dueDate)}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Click indicator */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="text-center text-sm text-blue-600 group-hover:text-blue-700 font-medium transition-colors">
                          Visualizza dettagli completi →
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
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 bg-slate-50 border-b border-slate-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-900">Dati Anagrafici</h3>
                  <Link
                    to="/change-password"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2m0 0V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 9l2 2 4-4" />
                    </svg>
                    Cambia Password
                  </Link>
                </div>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Informazioni Personali</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Email</span>
                        <span className="text-slate-900 font-medium">{user?.email}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Nome Completo</span>
                        <span className="text-slate-900 font-medium">{profile.nome} {profile.cognome}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Data di Nascita</span>
                        <span className="text-slate-900 font-medium">{new Date(profile.dataNascita).toLocaleDateString('it-IT')}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Luogo di Nascita</span>
                        <span className="text-slate-900 font-medium">{profile.luogoNascita}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Codice Fiscale</span>
                        <span className="text-slate-900 font-medium font-mono tracking-wide">{profile.codiceFiscale}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-600 block mb-1">Telefono</span>
                        <span className="text-slate-900 font-medium">{profile.telefono}</span>
                      </div>
                      {profile.nomePadre && (
                        <div className="p-4 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600 block mb-1">Nome Padre</span>
                          <span className="text-slate-900 font-medium">{profile.nomePadre}</span>
                        </div>
                      )}
                      {profile.nomeMadre && (
                        <div className="p-4 bg-slate-50 rounded-lg">
                          <span className="text-sm font-medium text-slate-600 block mb-1">Nome Madre</span>
                          <span className="text-slate-900 font-medium">{profile.nomeMadre}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-bold text-slate-900">Residenza</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                        <span className="text-sm font-medium text-purple-700 block mb-1">Indirizzo di Residenza</span>
                        <div className="text-slate-900 font-medium">
                          <div>{profile.residenzaVia}</div>
                          <div className="text-slate-600 mt-1">
                            {profile.residenzaCap} {profile.residenzaCitta} ({profile.residenzaProvincia})
                          </div>
                        </div>
                      </div>
                      {profile.hasDifferentDomicilio && (
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                          <span className="text-sm font-medium text-amber-700 block mb-1">Domicilio</span>
                          <div className="text-slate-900 font-medium">
                            <div>{profile.domicilioVia}</div>
                            <div className="text-slate-600 mt-1">
                              {profile.domicilioCap} {profile.domicilioCitta} ({profile.domicilioProvincia})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {(profile.tipoLaurea || profile.tipoProfessione) && (
                      <>
                        <div className="flex items-center space-x-3 mb-6 mt-8">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">Istruzione e Professione</h4>
                        </div>
                        <div className="space-y-4">
                          {profile.tipoLaurea && (
                            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                              <span className="text-sm font-medium text-emerald-700 block mb-1">Laurea</span>
                              <div className="text-slate-900 font-medium">
                                <div>{profile.tipoLaurea} in {profile.laureaConseguita}</div>
                                {profile.laureaUniversita && (
                                  <div className="text-slate-600 mt-1">presso {profile.laureaUniversita}</div>
                                )}
                              </div>
                            </div>
                          )}
                          {profile.tipoProfessione && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                              <span className="text-sm font-medium text-blue-700 block mb-1">Professione</span>
                              <div className="text-slate-900 font-medium">
                                <div>{profile.tipoProfessione}</div>
                                {profile.scuolaDenominazione && (
                                  <div className="text-slate-600 mt-1">
                                    presso {profile.scuolaDenominazione}, {profile.scuolaCitta}
                                  </div>
                                )}
                              </div>
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-blue-900">Partner di Riferimento</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/70 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-700 mb-1">Email Partner</div>
                    <div className="text-blue-900 font-bold">{assignedPartner.email}</div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-700 mb-1">Codice Partner</div>
                    <div className="text-blue-900 font-bold font-mono">{assignedPartner.referralCode}</div>
                  </div>
                </div>
                
                <div className="bg-blue-100/50 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h5 className="text-blue-900 font-semibold text-sm mb-1">Informazioni Importanti</h5>
                      <p className="text-blue-800 text-sm">
                        Tutte le tue future iscrizioni saranno automaticamente associate a questo partner. 
                        Per qualsiasi domanda o supporto, contattalo direttamente.
                      </p>
                    </div>
                  </div>
                </div>
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