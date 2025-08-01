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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Input
          label="Email"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />
      </div>

      <div>
        <Input
          label="Password"
          type="password"
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

      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        disabled={isLoading}
      >
        Accedi
      </Button>
    </form>
  );
};

export default LoginForm;