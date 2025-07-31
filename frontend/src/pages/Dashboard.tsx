import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Partner/Sidebar';
import DashboardView from '../components/Partner/DashboardView';
import UsersView from '../components/Partner/UsersView';
import ChatView from '../components/Partner/ChatView';
import CouponManagement from '../components/Partner/CouponManagement';
import OfferManagement from '../components/Partner/OfferManagement';
import UserManagement from '../components/Admin/UserManagement';
import EnrollmentDetail from '../components/Partner/EnrollmentDetail';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'chat' | 'coupons' | 'offers'>('dashboard');
  const [enrollmentDetailId, setEnrollmentDetailId] = useState<string | null>(null);

  const getDashboardContent = () => {
    switch (user?.role) {
      case 'ADMIN':
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Dashboard Admin</h2>
            <UserManagement />
          </div>
        );
      case 'PARTNER':
        // Se stiamo visualizzando il dettaglio iscrizione, mostra solo quello
        if (enrollmentDetailId) {
          return (
            <EnrollmentDetail 
              registrationId={enrollmentDetailId}
              onBackToUsers={() => {
                setEnrollmentDetailId(null);
                setActiveTab('users');
              }}
            />
          );
        }

        return (
          <div className="flex h-screen bg-gray-50">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 lg:ml-64">
              <div className="p-6 lg:p-8">
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    onNavigateToUsers={() => setActiveTab('users')}
                    onNavigateToEnrollmentDetail={(registrationId) => setEnrollmentDetailId(registrationId)}
                  />
                )}
                {activeTab === 'users' && (
                  <UsersView 
                    onNavigateToEnrollmentDetail={(registrationId) => setEnrollmentDetailId(registrationId)}
                  />
                )}
                {activeTab === 'coupons' && <CouponManagement />}
                {activeTab === 'offers' && <OfferManagement />}
                {activeTab === 'chat' && <ChatView />}
              </div>
            </div>
          </div>
        );
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

  // Per ADMIN e USER manteniamo il layout originale
  if (user?.role !== 'PARTNER') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold">Discovery Platform</h1>
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
  }

  // Per PARTNER usiamo il nuovo layout con sidebar
  return getDashboardContent();
};

export default Dashboard;