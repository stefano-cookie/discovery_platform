import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Button from '../UI/Button';
import Input from '../UI/Input';

const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
      // Check for pending enrollment after successful login
      const pendingEnrollment = sessionStorage.getItem('pendingEnrollment');
      if (pendingEnrollment) {
        try {
          const enrollment = JSON.parse(pendingEnrollment);
          sessionStorage.removeItem('pendingEnrollment');
          
          // Redirect to registration page with referral code
          if (enrollment.referralCode) {
            navigate(`/registration/${enrollment.referralCode}`);
          } else {
            navigate('/dashboard');
          }
        } catch (e) {
          // If parsing fails, just go to dashboard
          navigate('/dashboard');
        }
      }
      // If no pending enrollment, the ProtectedRoute will handle the redirect to dashboard
      
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il login');
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
        <div className="text-red-600 text-sm">{error}</div>
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