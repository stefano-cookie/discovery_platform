import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePartnerAuth } from '../hooks/usePartnerAuth';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import ErrorMessage from '../components/UI/ErrorMessage';
import ErrorService, { ErrorDetails } from '../services/errorService';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const PartnerLogin: React.FC = () => {
  const { login, isLoading } = usePartnerAuth();
  const [error, setError] = useState<ErrorDetails | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data);
      // Navigation will be handled by the auth provider
    } catch (err: any) {
      const processedError = ErrorService.processApiError(err);
      setError(processedError);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Partner Login
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Accedi alla dashboard partner
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Input
                label="Email aziendale"
                type="email"
                placeholder="admin@company.com"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                placeholder="Inserisci la password"
                {...register('password')}
                error={errors.password?.message}
              />
            </div>

            {error && (
              <ErrorMessage 
                message={error.message} 
                type={error.type}
                onClose={() => setError(null)}
              />
            )}

            <div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full"
                variant="primary"
              >
                {isLoading ? 'Accesso in corso...' : 'Accedi'}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Sei un utente?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <a
                href="/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-emerald-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 border-emerald-300"
              >
                Login Utente
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerLogin;