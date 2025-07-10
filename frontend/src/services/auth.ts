import { apiRequest } from './api';
import { LoginRequest, LoginResponse, ChangePasswordRequest, User } from '../types/auth';

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

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
};