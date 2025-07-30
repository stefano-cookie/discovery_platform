import { apiRequest } from './api';
import { LoginRequest, LoginResponse, ChangePasswordRequest, User } from '../types/auth';

export interface RegisterRequest {
  email: string;
  password: string;
  referralCode?: string;
  // Dati profilo
  cognome: string;
  nome: string;
  dataNascita: string;
  luogoNascita: string;
  provinciaNascita: string;
  sesso: string;
  codiceFiscale: string;
  telefono: string;
  nomePadre?: string;
  nomeMadre?: string;
  // Residenza
  residenzaVia: string;
  residenzaCitta: string;
  residenzaProvincia: string;
  residenzaCap: string;
  // Domicilio
  hasDifferentDomicilio?: boolean;
  domicilioVia?: string;
  domicilioCitta?: string;
  domicilioProvincia?: string;
  domicilioCap?: string;
  // Privacy
  privacyPolicy: boolean;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface VerifyEmailRequest {
  token: string;
  email: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  alreadyVerified?: boolean;
}

export interface ReferralCheckResponse {
  valid: boolean;
  partnerEmail: string;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
  },

  async changePassword(data: ChangePasswordRequest): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>({
      method: 'POST',
      url: '/auth/change-password',
      data,
    });
  },

  async getCurrentUser(): Promise<User> {
    return apiRequest<User>({
      method: 'GET',
      url: '/auth/me',
    });
  },

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>({
      method: 'POST',
      url: '/auth/register',
      data,
    });
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    return apiRequest<VerifyEmailResponse>({
      method: 'POST',
      url: '/auth/verify-email',
      data,
    });
  },

  async checkReferralCode(code: string): Promise<ReferralCheckResponse> {
    return apiRequest<ReferralCheckResponse>({
      method: 'GET',
      url: `/auth/check-referral/${code}`,
    });
  },

  async checkEmailStatus(email: string): Promise<{ verified: boolean; exists: boolean; hasProfile: boolean }> {
    return apiRequest<{ verified: boolean; exists: boolean; hasProfile: boolean }>({
      method: 'GET',
      url: `/auth/check-email-verification/${email}`,
    });
  },

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};