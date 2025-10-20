import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { TwoFactorSetup, TwoFactorVerify } from '../User/TwoFactor';
import Button from '../UI/Button';
import Input from '../UI/Input';
import ErrorMessage from '../UI/ErrorMessage';
import ErrorService, { ErrorDetails } from '../../services/errorService';
import api from '../../services/api';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorDetails | null>(null);

  // 2FA State
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FAVerify, setShow2FAVerify] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      setCredentials(data);

      // Call login API directly to intercept 2FA responses
      const response = await api.post('/auth/login', data);

      // Check for 2FA setup required
      if (response.data.requires2FASetup) {
        // Save temporary token for 2FA setup API calls
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        // Save user data if provided
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        setShow2FASetup(true);
        setIsLoading(false);
        return;
      }

      // Check for 2FA verification required
      if (response.data.requires2FA && response.data.sessionToken) {
        setSessionToken(response.data.sessionToken);
        setShow2FAVerify(true);
        setIsLoading(false);
        return;
      }

      // Standard login (no 2FA or already verified)
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect based on role - use full page reload for admin
      console.log('🎯 Direct login successful, user role:', user.role);
      if (user.role === 'ADMIN') {
        console.log('➡️ Redirecting ADMIN to /admin via window.location');
        window.location.href = '/admin';
      } else {
        console.log('➡️ Reloading for USER/PARTNER');
        window.location.reload();
      }

    } catch (err: any) {
      const processedError = ErrorService.processApiError(err);
      setError(processedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASetupComplete = async (setupResponse?: any) => {
    setShow2FASetup(false);

    // If setup response includes token and user (backend updated to return these),
    // user is fully authenticated - no need to re-login
    if (setupResponse?.token && setupResponse?.user) {
      localStorage.setItem('token', setupResponse.token);
      localStorage.setItem('user', JSON.stringify(setupResponse.user));

      // Redirect based on role
      if (setupResponse.user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        window.location.reload();
      }
      return;
    }

    // Legacy flow: After setup, require 2FA verification
    if (credentials) {
      try {
        setIsLoading(true);
        const response = await api.post('/auth/login', credentials);

        if (response.data.requires2FA && response.data.sessionToken) {
          setSessionToken(response.data.sessionToken);
          setShow2FAVerify(true);
        }
      } catch (err: any) {
        const processedError = ErrorService.processApiError(err);
        setError(processedError);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handle2FAVerifySuccess = (token: string, user: any) => {
    console.log('🎯 2FA verified successfully, full user data:', user);
    console.log('🔑 Token to save:', token.substring(0, 20) + '...');

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    // Verify what was saved
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    console.log('✅ Saved to localStorage:', {
      tokenSaved: !!savedToken,
      userSaved: !!savedUser,
      userRole: user.role
    });

    // Redirect based on role/type - use full page reload for admin to ensure clean state
    if (user.role === 'ADMIN') {
      console.log('➡️ Redirecting ADMIN to /admin via window.location');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 100); // Small delay to ensure localStorage is written
    } else {
      console.log('➡️ Reloading for USER/PARTNER');
      window.location.reload();
    }
  };

  const handle2FACancel = () => {
    setShow2FASetup(false);
    setShow2FAVerify(false);
    setSessionToken(null);
    setCredentials(null);
  };

  // Render 2FA Setup - return null and let parent handle via prop
  if (show2FASetup) {
    // Break out of card layout by rendering in portal or returning special component
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <TwoFactorSetup
          onComplete={handle2FASetupComplete}
          onCancel={handle2FACancel}
        />
      </div>
    );
  }

  // Render 2FA Verify modal
  if (show2FAVerify && sessionToken) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <TwoFactorVerify
          sessionToken={sessionToken}
          onSuccess={handle2FAVerifySuccess}
          onCancel={handle2FACancel}
        />
      </div>
    );
  }

  // Render standard login form
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        <div>
          <Input
            label="Indirizzo Email"
            type="email"
            placeholder="nome@email.com"
            {...register('email')}
            error={errors.email?.message}
          />
        </div>

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="Inserisci la tua password"
            {...register('password')}
            error={errors.password?.message}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorMessage
            message={error.message}
            type={error.type}
            onClose={() => setError(null)}
          />
        </div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          className="w-full py-3 text-base font-medium"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Accesso in corso...' : 'Accedi alla piattaforma'}
        </Button>
      </div>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2 py-1"
          onClick={() => {
            // TODO: Implement forgot password functionality
            alert('Funzionalità di recupero password in sviluppo');
          }}
          aria-label="Recupera la tua password dimenticata"
        >
          Hai dimenticato la password?
        </button>
      </div>
    </form>
  );
};

export default LoginForm;