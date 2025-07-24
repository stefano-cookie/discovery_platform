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
  customInstallments?: number;
  partnerOfferId?: string;
  
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

export const submitRegistration = async (data: RegistrationData): Promise<RegistrationResponse> => {
  const formData = new FormData();
  
  // Aggiungi tutti i campi al FormData
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else if (value !== undefined && value !== null && typeof value !== 'object') {
      formData.append(key, value.toString());
    }
  });
  
  try {
    const response = await api.post('/registration/submit', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    console.error('API Error Response:', (error as any).response?.data);
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