import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../hooks/useAuth';
import Button from '../UI/Button';
import Input from '../UI/Input';
import ErrorMessage from '../UI/ErrorMessage';
import ErrorService, { ErrorDetails } from '../../services/errorService';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);
      setError(null);
      
      await login(data);
      
      // After successful login, App.tsx will handle the redirect based on localStorage pendingReferral
      // No need to manually navigate here - let the auth state change trigger the redirect
      
    } catch (err: any) {
      const processedError = ErrorService.processApiError(err);
      setError(processedError);
    } finally {
      setIsLoading(false);
    }
  };

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