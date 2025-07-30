import axios, { AxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Extract meaningful error message from backend
    if (error.response?.data?.error) {
      const backendError = new Error(error.response.data.error);
      backendError.name = 'BackendError';
      return Promise.reject(backendError);
    }
    
    return Promise.reject(error);
  }
);

export const apiRequest = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response = await api(config);
  return response.data;
};

// Registration API
export interface RegistrationData {
  // Dati generali
  email: string;
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  codiceFiscale: string;
  telefono: string;
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
  laureaConseguitaCustom?: string;
  laureaUniversita: string;
  laureaData: string;
  
  // Istruzione triennale (condizionale per Magistrale)
  tipoLaureaTriennale?: string;
  laureaConseguitaTriennale?: string;
  laureaUniversitaTriennale?: string;
  laureaDataTriennale?: string;
  
  // Professione
  tipoProfessione: string;
  scuolaDenominazione?: string;
  scuolaCitta?: string;
  scuolaProvincia?: string;
  
  // Iscrizione
  referralCode?: string;
  courseId: string;
  couponCode?: string;
  paymentPlan: string;
  partnerOfferId?: string;
  
  // Payment information (calculated)
  originalAmount?: number;
  finalAmount?: number;
  installments?: number;
  downPayment?: number;
  installmentAmount?: number;
  verifiedEmail?: string;
  
  // File
  cartaIdentita?: File | null;
  certificatoTriennale?: File | null;
  certificatoMagistrale?: File | null;
  pianoStudioTriennale?: File | null;
  pianoStudioMagistrale?: File | null;
  certificatoMedico?: File | null;
  certificatoNascita?: File | null;
  diplomoLaurea?: File | null;
  pergamenaLaurea?: File | null;
}

export interface RegistrationResponse {
  success: boolean;
  registrationId: string;
  message: string;
}

// Submit enrollment for email-verified users (non-authenticated)
export const submitVerifiedUserEnrollment = async (data: RegistrationData & { verifiedEmail: string }): Promise<RegistrationResponse> => {
  try {
    const response = await api.post('/registration/verified-user-enrollment', data);
    return response.data;
  } catch (error) {
    console.error('Verified user enrollment error:', error);
    throw error;
  }
};

export const submitEnrollment = async (data: RegistrationData): Promise<RegistrationResponse> => {
  // This function is now only for AUTHENTICATED users doing course enrollment
  // Non-authenticated users should use RegistrationModal → /auth/register flow
  
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('User must be authenticated to enroll in courses. Please register first.');
  }
  
  try {
    const response = await api.post('/registration/additional-enrollment', {
      courseId: data.courseId,
      partnerOfferId: data.partnerOfferId,
      referralCode: data.referralCode,
      paymentPlan: {
        originalAmount: data.originalAmount ?? 0,
        finalAmount: data.finalAmount ?? data.originalAmount ?? 0,
        installments: data.installments ?? 1
      },
      couponCode: data.couponCode,
      // Include course-specific data that goes into Registration table
      courseData: {
        tipoLaurea: data.tipoLaurea,
        laureaConseguita: data.laureaConseguita,
        laureaConseguitaCustom: data.laureaConseguitaCustom,
        laureaUniversita: data.laureaUniversita,
        laureaData: data.laureaData,
        // Dati triennale (se presenti)
        tipoLaureaTriennale: data.tipoLaureaTriennale,
        laureaConseguitaTriennale: data.laureaConseguitaTriennale,
        laureaUniversitaTriennale: data.laureaUniversitaTriennale,
        laureaDataTriennale: data.laureaDataTriennale,
        // Dati professione
        tipoProfessione: data.tipoProfessione,
        scuolaDenominazione: data.scuolaDenominazione,
        scuolaCitta: data.scuolaCitta,
        scuolaProvincia: data.scuolaProvincia
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Course Enrollment API Error:', error);
    console.error('Course Enrollment API Error Response:', (error as any).response?.data);
    throw error;
  }
};

// Email verification API
export const sendEmailVerification = async (email: string, referralCode?: string) => {
  return apiRequest({
    method: 'POST',
    url: '/auth/send-email-verification',
    data: { email, referralCode }
  });
};

export const verifyEmail = async (token: string, email: string) => {
  return apiRequest<{ success: boolean; message: string; alreadyVerified?: boolean }>({
    method: 'POST',
    url: '/auth/verify-email',
    data: { token, email }
  });
};

export const checkEmailVerification = async (email: string) => {
  return apiRequest<{ verified: boolean; exists: boolean }>({
    method: 'GET',
    url: `/auth/check-email-verification/${encodeURIComponent(email)}`
  });
};

export interface ExistingUser {
  id: string;
  email: string;
  hasProfile: boolean;
  registrationsCount: number;
  hasTemporaryPassword: boolean;
}

export const checkUserExists = async (email: string) => {
  return apiRequest<{ exists: boolean; user?: ExistingUser }>({
    method: 'GET',
    url: `/registration/check-user/${encodeURIComponent(email)}`
  });
};

export default api;