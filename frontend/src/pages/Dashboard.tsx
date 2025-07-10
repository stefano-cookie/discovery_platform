import React from 'react';
import { useAuth } from '../hooks/useAuth';
import PartnerDashboard from '../components/Partner/Dashboard';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const getDashboardContent = () => {
    switch (user?.role) {
      case 'ADMIN':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Dashboard Admin</h2>
            <div className="bg-white p-6 rounded-lg shadow">
              <p>Benvenuto, amministratore!</p>
              <p>Qui puoi gestire tutti gli aspetti della piattaforma.</p>
            </div>
          </div>
        );
      case 'PARTNER':
        return <PartnerDashboard />;
      case 'USER':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Dashboard Utente</h2>
            <div className="bg-white p-6 rounded-lg shadow">
              <p>Benvenuto!</p>
              <p>Qui puoi visualizzare i tuoi corsi e progressi.</p>
            </div>
          </div>
        );
      default:
        return <div>Ruolo non riconosciuto</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Piattaforma Diamante</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user?.email} ({user?.role})
              </span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {getDashboardContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;