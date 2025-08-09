import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { registrationId } = useParams();
  
  // Determine active tab from URL
  const getActiveTabFromPath = (pathname: string): 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' => {
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/chat')) return 'chat';
    if (pathname.includes('/coupons')) return 'coupons';
    if (pathname.includes('/offers')) return 'offers';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'chat' | 'coupons' | 'offers'>(
    getActiveTabFromPath(location.pathname)
  );

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath(location.pathname));
  }, [location.pathname]);

  // Navigation functions
  const handleTabChange = (tab: 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers') => {
    const basePath = '/dashboard';
    const newPath = tab === 'dashboard' ? basePath : `${basePath}/${tab}`;
    navigate(newPath);
  };

  const handleNavigateToEnrollmentDetail = (regId: string) => {
    navigate(`/dashboard/users/${regId}`);
  };

  const handleBackToUsers = () => {
    navigate('/dashboard/users');
  };

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
        if (registrationId) {
          return (
            <EnrollmentDetail 
              registrationId={registrationId}
              onBackToUsers={handleBackToUsers}
            />
          );
        }

        return (
          <div className="flex h-screen bg-gray-50">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
            <div className="flex-1 lg:ml-64">
              <div className="p-6 lg:p-8">
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    onNavigateToUsers={() => navigate('/dashboard/users')}
                    onNavigateToEnrollmentDetail={handleNavigateToEnrollmentDetail}
                  />
                )}
                {activeTab === 'users' && (
                  <UsersView 
                    onNavigateToEnrollmentDetail={handleNavigateToEnrollmentDetail}
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