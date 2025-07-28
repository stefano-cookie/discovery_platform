import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoginForm from '../components/Auth/LoginForm';

const Login: React.FC = () => {
  const location = useLocation();
  const successMessage = (location.state as any)?.message;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accedi a Discovery Platform
          </h2>
        </div>
        
        {/* Success message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-sm text-green-800">{successMessage}</p>
            </div>
          </div>
        )}
        
        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <LoginForm />
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Non hai un account?{' '}
              <Link to="/registration" className="font-medium text-blue-600 hover:text-blue-500">
                Registrati qui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;