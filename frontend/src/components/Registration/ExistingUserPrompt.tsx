import React from 'react';
import { ExistingUser } from '../../services/api';

interface ExistingUserPromptProps {
  user: ExistingUser;
  onLoginRedirect: () => void;
  onContinueAsNew: () => void;
}

const ExistingUserPrompt: React.FC<ExistingUserPromptProps> = ({
  user,
  onLoginRedirect,
  onContinueAsNew
}) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
            👤 Utente già registrato
          </h3>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">
                  Abbiamo trovato un account esistente
                </h4>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Email: <span className="font-semibold">{user.email}</span></p>
                  {user.hasProfile && (
                    <p>✅ Profilo completo</p>
                  )}
                  {user.registrationsCount > 0 && (
                    <p>📝 {user.registrationsCount} iscrizione{user.registrationsCount > 1 ? 'i' : 'e'} attiva{user.registrationsCount > 1 ? 'e' : ''}</p>
                  )}
                  {user.hasTemporaryPassword && (
                    <p>🔑 Password temporanea attiva</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 mb-2">
                🎯 Opzione Consigliata: Accedi al tuo account
              </h4>
              <p className="text-sm text-green-700 mb-3">
                Effettua il login per iscriverti a questo nuovo corso utilizzando i tuoi dati esistenti.
                Sarà più veloce e potrai riutilizzare i documenti già caricati.
              </p>
              <button
                onClick={onLoginRedirect}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                🚀 Accedi al mio account
              </button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                ⚠️ Opzione Alternativa: Continua come nuovo utente
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                Puoi continuare la registrazione con una email diversa, ma dovrai inserire nuovamente tutti i dati e documenti.
              </p>
              <button
                onClick={onContinueAsNew}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-yellow-300 text-sm font-medium rounded-md shadow-sm text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                📝 Usa un'email diversa
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              💡 Suggerimento: Con un solo account puoi gestire tutte le tue iscrizioni facilmente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExistingUserPrompt;