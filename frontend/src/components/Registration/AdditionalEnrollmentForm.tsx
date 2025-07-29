import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import MultiStepForm from './MultiStepForm';

interface UserProfile {
  id: string;
  cognome: string;
  nome: string;
  email: string;
  codiceFiscale: string;
  telefono: string;
  dataNascita: string;
  luogoNascita: string;
  nomePadre?: string;
  nomeMadre?: string;
  // Residenza
  residenzaVia: string;
  residenzaCitta: string;
  residenzaProvincia: string;
  residenzaCap: string;
  hasDifferentDomicilio: boolean;
  domicilioVia?: string;
  domicilioCitta?: string;
  domicilioProvincia?: string;
  domicilioCap?: string;
  // Istruzione
  tipoLaurea: string;
  laureaConseguita: string;
  laureaUniversita: string;
  laureaData: string;
  // Professione
  tipoProfessione: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
}

interface OfferInfo {
  id: string;
  name: string;
  offerType: 'TFA_ROMANIA' | 'CERTIFICATION';
  course: {
    id: string;
    name: string;
    description?: string;
  };
  totalAmount: number;
  installments: number;
  referralLink: string;
}

interface UserDocument {
  id: string;
  type: string;
  fileName: string;
  isVerified: boolean;
}

const AdditionalEnrollmentForm: React.FC = () => {
  // User is handled by useAuth context - no need to access directly
  const { partnerOfferId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get('courseId');
  const referralCodeFromQuery = searchParams.get('referralCode');
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [offerInfo, setOfferInfo] = useState<OfferInfo | null>(null);
  const [userDocuments, setUserDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadEnrollmentData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load user profile
      const profileResponse = await api.get('/user/profile');
      if (profileResponse.data) {
        const safeProfile = {
          // Merge user and profile data safely
          ...(profileResponse.data.user || {}),
          ...(profileResponse.data.profile || {})
        };
        setUserProfile(safeProfile);
      }

      // Load offer info if partnerOfferId is provided
      if (partnerOfferId) {
        try {
          const response = await api.get(`/offers/${partnerOfferId}`);
          setOfferInfo(response.data.offer);
        } catch (error) {
          console.error('Error loading offer info:', error);
          setError('Errore nel caricamento dell\'offerta');
        }
      } else if (courseId || referralCodeFromQuery) {
        // If no partnerOfferId but courseId/referralCode is provided, try to get the course from available courses
        try {
          const availableCoursesResponse = await api.get('/user/available-courses');
          
          let availableCourse = null;
          
          if (courseId) {
            availableCourse = availableCoursesResponse.data.courses.find(
              (course: any) => course.id === courseId
            );
          } else if (referralCodeFromQuery) {
            // Find course by referral code
            availableCourse = availableCoursesResponse.data.courses.find(
              (course: any) => course.referralLink === referralCodeFromQuery
            );
          }
          
          if (availableCourse && availableCourse.partnerOfferId) {
            const response = await api.get(`/offers/${availableCourse.partnerOfferId}`);
            setOfferInfo(response.data.offer);
          } else {
            setError('Corso non disponibile per l\'iscrizione');
          }
        } catch (error) {
          console.error('Error loading course info:', error);
          setError('Errore nel caricamento del corso');
        }
      } else {
        setError('Nessuna offerta specificata');
      }

      // Load user documents
      try {
        const response = await api.get('/user/documents');
        setUserDocuments(response.data.documents || []);
      } catch (error) {
        console.error('Error loading user documents:', error);
      }

    } catch (error) {
      console.error('Error loading enrollment data:', error);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [partnerOfferId, courseId, referralCodeFromQuery]);

  useEffect(() => {
    loadEnrollmentData();
  }, [loadEnrollmentData]);

  const prepareFormData = () => {
    if (!userProfile || !offerInfo) return;

    // Determine what data to pre-populate based on offer type and existing data
    const currentOfferType = offerInfo.offerType;
    const baseFormData: any = {
      // Always include basic info with safe fallbacks
      email: userProfile.email || '',
      cognome: userProfile.cognome || '',
      nome: userProfile.nome || '',
      dataNascita: userProfile.dataNascita ? (() => {
        try {
          return new Date(userProfile.dataNascita).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      luogoNascita: userProfile.luogoNascita || '',
      codiceFiscale: userProfile.codiceFiscale || '',
      telefono: userProfile.telefono || '',
      
      // Residenza with safe fallbacks
      residenzaVia: userProfile.residenzaVia || '',
      residenzaCitta: userProfile.residenzaCitta || '',
      residenzaProvincia: userProfile.residenzaProvincia || '',
      residenzaCap: userProfile.residenzaCap || '',
      hasDifferentDomicilio: userProfile.hasDifferentDomicilio || false,
    };

    // Add optional residence fields with safe fallbacks
    baseFormData.domicilioVia = userProfile.domicilioVia || '';
    baseFormData.domicilioCitta = userProfile.domicilioCitta || '';
    baseFormData.domicilioProvincia = userProfile.domicilioProvincia || '';
    baseFormData.domicilioCap = userProfile.domicilioCap || '';

    // Add parent names for TFA_ROMANIA with safe fallbacks
    if (currentOfferType === 'TFA_ROMANIA') {
      baseFormData.nomePadre = userProfile.nomePadre || '';
      baseFormData.nomeMadre = userProfile.nomeMadre || '';
      
      // Add education data for TFA with safe fallbacks
      baseFormData.tipoLaurea = userProfile.tipoLaurea || '';
      baseFormData.laureaConseguita = userProfile.laureaConseguita || '';
      baseFormData.laureaUniversita = userProfile.laureaUniversita || '';
      baseFormData.laureaData = userProfile.laureaData ? (() => {
        try {
          return new Date(userProfile.laureaData).toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '';
      
      // Add profession data with safe fallbacks
      baseFormData.tipoProfessione = userProfile.tipoProfessione || '';
      baseFormData.scuolaDenominazione = userProfile.scuolaDenominazione || '';
      baseFormData.scuolaCitta = userProfile.scuolaCitta || '';
      baseFormData.scuolaProvincia = userProfile.scuolaProvincia || '';
    }

    // Add course and offer info
    baseFormData.courseId = offerInfo.course.id;
    baseFormData.partnerOfferId = offerInfo.id;
    baseFormData.referralCode = offerInfo.referralLink;

    // Store form data in localStorage for MultiStepForm to pick up
    localStorage.setItem('registrationFormData', JSON.stringify(baseFormData));
    localStorage.setItem('userDocuments', JSON.stringify(userDocuments));
    localStorage.setItem('isAdditionalEnrollment', 'true');
    
    // Create a virtual referral code for the form to understand this is additional enrollment
    const virtualReferralCode = `additional-${offerInfo.referralLink}`;
    
    return virtualReferralCode;
  };

  const proceedToForm = () => {
    prepareFormData();
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Caricamento dati...
          </h2>
          <p className="mt-2 text-gray-600">Preparazione della tua nuova iscrizione</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Errore</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Torna alla Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show the multi-step form if data is prepared
  if (showForm && offerInfo) {
    const virtualReferralCode = `additional-${offerInfo.referralLink}`;
    return <MultiStepForm referralCode={virtualReferralCode} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-gray-900">
                Nuova Iscrizione
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Iscriviti a un nuovo corso utilizzando i tuoi dati esistenti
              </p>
            </div>

            {/* Course Info */}
            {offerInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-medium text-blue-900 mb-4">Corso Selezionato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-blue-800">{offerInfo.name}</h4>
                    <p className="text-sm text-blue-600">{offerInfo.course.description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">
                      <span className="font-semibold">Tipo:</span> {offerInfo.offerType === 'TFA_ROMANIA' ? 'TFA Romania' : 'Certificazione'}
                    </p>
                    <p className="text-sm text-blue-600">
                      <span className="font-semibold">Prezzo:</span> €{offerInfo.totalAmount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* User Profile Summary */}
            {userProfile && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-medium text-green-900 mb-4">I Tuoi Dati Esistenti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-green-700">
                      <span className="font-semibold">Nome:</span> {userProfile.nome} {userProfile.cognome}
                    </p>
                    <p className="text-sm text-green-700">
                      <span className="font-semibold">Email:</span> {userProfile.email}
                    </p>
                    <p className="text-sm text-green-700">
                      <span className="font-semibold">CF:</span> {userProfile.codiceFiscale}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-green-700">
                      <span className="font-semibold">Telefono:</span> {userProfile.telefono}
                    </p>
                    <p className="text-sm text-green-700">
                      <span className="font-semibold">Residenza:</span> {userProfile.residenzaCitta}, {userProfile.residenzaProvincia}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Available Documents */}
            {userDocuments.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-medium text-yellow-900 mb-4">📄 Documenti Disponibili</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {userDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-2">
                      <span className={`inline-block w-3 h-3 rounded-full ${doc.isVerified ? 'bg-green-400' : 'bg-yellow-400'}`}></span>
                      <span className="text-sm text-yellow-700">{doc.fileName}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  I documenti potranno essere riutilizzati dove applicabile
                </p>
              </div>
            )}

            {/* What Happens Next */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🔄 Cosa Succede Ora?</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
                  <p className="text-sm text-gray-700">I tuoi dati esistenti verranno pre-compilati automaticamente</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
                  <p className="text-sm text-gray-700">
                    Ti sarà chiesto di completare solo i campi {offerInfo?.offerType === 'TFA_ROMANIA' 
                      ? (userProfile?.nomePadre && userProfile?.nomeMadre ? 'aggiuntivi necessari' : 'mancanti (es. nome genitori)')
                      : 'aggiuntivi necessari'}
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
                  <p className="text-sm text-gray-700">Potrai riutilizzare i documenti già caricati o aggiungerne di nuovi</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
                  <p className="text-sm text-gray-700">Sceglierai il piano di pagamento e completerai l'iscrizione</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={proceedToForm}
                disabled={!offerInfo || !userProfile}
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Procedi con l'Iscrizione
              </button>
              
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Torna alla Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdditionalEnrollmentForm;