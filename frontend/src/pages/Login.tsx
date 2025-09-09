import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoginForm from '../components/Auth/LoginForm';

const Login: React.FC = () => {
  const location = useLocation();
  const successMessage = (location.state as any)?.message;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 sm:space-y-8">
          {/* Logo/Brand Section */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg transform hover:scale-105 transition-transform duration-300">
              <svg className="h-7 w-7 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Discovery Platform
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Benvenuto! Accedi per continuare
            </p>
          </div>
          
          {/* Success message */}
          {successMessage && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-400 rounded-r-lg p-4 shadow-sm">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Login Form Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-6 sm:px-8 sm:py-8">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-6 text-center">
                Accedi al tuo account
              </h2>
              <LoginForm />
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 sm:px-8 sm:py-6 bg-gray-50 border-t border-gray-100">
              <div className="text-center space-y-4">                
                {/* Partner Login Link */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    Sei un partner aziendale?
                  </p>
                  <Link 
                    to="/partner/login" 
                    className="mt-2 inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md px-2 py-1"
                    aria-label="Vai al login partner"
                  >
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m4 0V9a2 2 0 011-1h4a2 2 0 011 1v12" />
                    </svg>
                    <span>Accedi come Partner</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
          
          {/* Security Info */}
          <div className="mt-6 sm:mt-8 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center text-xs text-gray-500 space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>Connessione sicura</span>
              </div>
              <div className="flex items-center">
                <svg className="h-4 w-4 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>Supporto disponibile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;