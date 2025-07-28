import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import DocumentUpload from './DocumentUpload';

interface Registration {
  id: string;
  courseId: string;
  courseName: string;
  status: string;
  createdAt: string;
  originalAmount: number;
  finalAmount: number;
  installments: number;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalPaid: number;
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

interface UserDocument {
  id: string;
  type: string;
  fileName: string;
  uploadedAt: string;
  isVerified: boolean;
}

interface AvailableCourse {
  id: string;
  name: string;
  description: string;
  partnerOfferId?: string;
  referralLink?: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  totalAmount: number;
  installments: number;
  isOriginal: boolean;
  isEnrolled: boolean;
  enrollmentStatus: string | null;
}

interface DocumentType {
  value: string;
  label: string;
  required: boolean;
}

const UserDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'registrations' | 'documents' | 'courses'>('registrations');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Load user registrations
      const regResponse = await fetch('/api/user/registrations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (regResponse.ok) {
        const regData = await regResponse.json();
        setRegistrations(regData.registrations || []);
      }

      // Load user documents
      const docResponse = await fetch('/api/user/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (docResponse.ok) {
        const docData = await docResponse.json();
        setDocuments(docData.documents || []);
      }

      // Load available courses
      const coursesResponse = await fetch('/api/user/available-courses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setAvailableCourses(coursesData.courses || []);
      }

      // Load document types
      const typesResponse = await fetch('/api/user/documents/types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (typesResponse.ok) {
        const typesData = await typesResponse.json();
        setDocumentTypes(typesData.documentTypes || []);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'PENDING': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Attesa' },
      'DATA_VERIFIED': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Dati Verificati' },
      'CONTRACT_GENERATED': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Contratto Generato' },
      'CONTRACT_SIGNED': { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Contratto Firmato' },
      'ENROLLED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Iscritto' },
      'COMPLETED': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completato' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['PENDING'];
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleNewEnrollment = (courseId: string, referralLink?: string) => {
    // All enrollments must use referral links now
    if (referralLink) {
      window.location.href = `/registration/${referralLink}`;
    } else {
      // No generic enrollment page exists - user should use partner links
      console.warn('Enrollment requires a referral link');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="lg:flex lg:items-center lg:justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
                  Area Personale
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Benvenuto {user?.email}, gestisci le tue iscrizioni e documenti
                </p>
              </div>
              <div className="mt-5 flex lg:mt-0 lg:ml-4 space-x-3">
                <button
                  onClick={() => window.location.href = '/change-password'}
                  className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cambia Password
                </button>
                <button
                  onClick={logout}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Esci
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('registrations')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'registrations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📝 Le Mie Iscrizioni ({registrations.length})
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📄 I Miei Documenti ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'courses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎓 Corsi Disponibili ({availableCourses.length})
            </button>
          </nav>
        </div>

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Le Tue Iscrizioni
              </h3>
              {registrations.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna iscrizione</h3>
                  <p className="text-gray-500 mb-4">Non hai ancora nessuna iscrizione attiva.</p>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Esplora i Corsi
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Corso</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {registrations.map((registration) => (
                        <tr key={registration.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{registration.courseName}</div>
                            <div className="text-sm text-gray-500">ID: {registration.id.slice(0, 8)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              registration.offerType === 'TFA_ROMANIA' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {registration.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(registration.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              €{registration.finalAmount.toLocaleString('it-IT')}
                              {registration.originalAmount !== registration.finalAmount && (
                                <span className="text-xs text-gray-500 line-through ml-1">
                                  €{registration.originalAmount.toLocaleString('it-IT')}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              Pagato €{registration.totalPaid.toLocaleString('it-IT')} su €{registration.finalAmount.toLocaleString('it-IT')}
                            </div>
                            <div className="text-xs text-gray-400">{registration.installments} rate</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(registration.createdAt).toLocaleDateString('it-IT')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Payment Details and Deadlines */}
              {registrations.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Scadenze e Pagamenti</h4>
                  {registrations.map((registration) => (
                    <div key={`details-${registration.id}`} className="mb-6 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-900">{registration.courseName}</h5>
                        <span className="text-sm text-gray-500">ID: {registration.id.slice(0, 8)}...</span>
                      </div>
                      
                      {/* Deadlines */}
                      {registration.deadlines.length > 0 && (
                        <div className="mb-4">
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Scadenze Pagamenti:</h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {registration.deadlines.map((deadline) => (
                              <div key={deadline.id} className={`p-3 rounded-lg border ${
                                deadline.isPaid 
                                  ? 'bg-green-50 border-green-200' 
                                  : new Date(deadline.dueDate) < new Date() 
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-yellow-50 border-yellow-200'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    Rata {deadline.paymentNumber}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    deadline.isPaid 
                                      ? 'bg-green-100 text-green-800'
                                      : new Date(deadline.dueDate) < new Date()
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {deadline.isPaid ? 'Pagata' : new Date(deadline.dueDate) < new Date() ? 'Scaduta' : 'In attesa'}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  €{deadline.amount.toLocaleString('it-IT')}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Scadenza: {new Date(deadline.dueDate).toLocaleDateString('it-IT')}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Payments */}
                      {registration.payments.length > 0 && (
                        <div>
                          <h6 className="text-sm font-medium text-gray-700 mb-2">Storico Pagamenti:</h6>
                          <div className="space-y-2">
                            {registration.payments.map((payment) => (
                              <div key={payment.id} className={`flex items-center justify-between p-2 rounded-lg ${
                                payment.isConfirmed ? 'bg-green-50' : 'bg-gray-50'
                              }`}>
                                <div>
                                  <span className="text-sm font-medium">
                                    Pagamento {payment.paymentNumber}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    {new Date(payment.paymentDate).toLocaleDateString('it-IT')}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium">
                                    €{payment.amount.toLocaleString('it-IT')}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    payment.isConfirmed 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {payment.isConfirmed ? 'Confermato' : 'In attesa'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {registration.deadlines.length === 0 && registration.payments.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          Nessuna scadenza o pagamento registrato
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                I Tuoi Documenti
              </h3>
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">📄</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun documento</h3>
                  <p className="text-gray-500">I documenti caricati durante le iscrizioni appariranno qui.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {documents.map((document) => (
                    <div key={document.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-900">{document.type}</div>
                        {document.isVerified ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Verificato
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            In Attesa
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">{document.fileName}</div>
                      <div className="text-xs text-gray-400">
                        Caricato il {new Date(document.uploadedAt).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Document Upload Section */}
              <div className="mt-8">
                <DocumentUpload 
                  onUploadComplete={loadUserData}
                  documentTypes={documentTypes}
                />
              </div>
            </div>
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Corsi Disponibili
              </h3>
              {availableCourses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 text-6xl mb-4">🎓</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun corso disponibile</h3>
                  <p className="text-gray-500">Al momento non ci sono corsi disponibili per te.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {availableCourses.map((course) => (
                    <div key={course.id} className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-medium text-gray-900">{course.name}</h4>
                        <div className="flex items-center space-x-2">
                          {/* Primary course type badge */}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            course.offerType === 'TFA_ROMANIA' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {course.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                          </span>
                          
                          {/* Status badge */}
                          {course.isEnrolled && course.enrollmentStatus && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              ✓ Iscritto
                            </span>
                          )}
                          
                          {/* Course origin badge */}
                          {course.isOriginal && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              Corso Originale
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {course.description && (
                        <p className="text-sm text-gray-600 mb-4">{course.description}</p>
                      )}
                      
                      {/* Price information */}
                      <div className="mb-4">
                        <div className="text-lg font-semibold text-green-600">
                          €{course.totalAmount.toLocaleString('it-IT')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {course.installments} rate
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleNewEnrollment(course.id, course.referralLink)}
                        disabled={course.isEnrolled && !course.referralLink}
                        className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          course.isEnrolled && !course.referralLink
                            ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                            : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        }`}
                      >
                        {course.isEnrolled 
                          ? (course.referralLink ? 'Nuova Iscrizione' : 'Già Iscritto')
                          : 'Iscriviti al Corso'
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;