import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePartnerAuth } from '../hooks/usePartnerAuth';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Partner/Sidebar';
import DashboardView from '../components/Partner/DashboardView';
import UsersView from '../components/Partner/UsersView';
import ChatView from '../components/Partner/ChatView';
import CouponManagement from '../components/Partner/CouponManagement';
import OfferManagement from '../components/Partner/OfferManagement';
import UserManagement from '../components/Admin/UserManagement';
import EnrollmentDetail from '../components/Partner/EnrollmentDetail';
import CollaboratorsManagement from '../components/Partner/Collaborators/CollaboratorsManagement';
import SubPartnerManagement from '../components/Partner/SubPartnerManagement';
import LogoutDropdown from '../components/UI/LogoutDropdown';

const Dashboard: React.FC = () => {
  const { user, logout: userLogout } = useAuth();
  const { partnerEmployee, partnerCompany, logout: partnerLogout } = usePartnerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { registrationId } = useParams();
  
  // Determine which user is active and their role
  const currentUser = user || partnerEmployee;
  const currentLogout = user ? userLogout : partnerLogout;
  const userRole = user?.role || (partnerEmployee ? 'PARTNER' : null);
  
  // Determine active tab from URL
  const getActiveTabFromPath = (pathname: string): 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' | 'collaborators' | 'sub-partners' => {
    if (pathname.includes('/users')) return 'users';
    if (pathname.includes('/chat')) return 'chat';
    if (pathname.includes('/coupons')) return 'coupons';
    if (pathname.includes('/offers')) return 'offers';
    if (pathname.includes('/collaborators')) return 'collaborators';
    if (pathname.includes('/sub-partners')) return 'sub-partners';
    
    // For sub-partners, default to users instead of dashboard
    if (partnerCompany?.parentId) return 'users';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' | 'collaborators' | 'sub-partners'>(
    getActiveTabFromPath(location.pathname)
  );
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromPath(location.pathname));
  }, [location.pathname]);

  // Navigation functions
  const handleTabChange = (tab: 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' | 'collaborators' | 'sub-partners') => {
    const basePath = '/dashboard';
    
    // For sub-partners, prevent navigation to dashboard and redirect to users
    if (partnerCompany?.parentId && tab === 'dashboard') {
      navigate(`${basePath}/users`);
      return;
    }
    
    const newPath = tab === 'dashboard' ? basePath : `${basePath}/${tab}`;
    navigate(newPath);
  };

  const handleNavigateToEnrollmentDetail = (regId: string) => {
    navigate(`/dashboard/users/${regId}`);
  };

  const handleBackToUsers = () => {
    navigate('/dashboard/users');
  };

  const handleLogoutClick = () => {
    setShowLogoutDropdown(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDropdown(false);
    currentLogout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutDropdown(false);
  };

  const getDashboardContent = () => {
    switch (userRole) {
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
                {activeTab === 'dashboard' && !partnerCompany?.parentId && (
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
                {activeTab === 'coupons' && !partnerCompany?.parentId && <CouponManagement />}
                {activeTab === 'offers' && <OfferManagement />}
                {activeTab === 'collaborators' && <CollaboratorsManagement />}
                {activeTab === 'sub-partners' && <SubPartnerManagement />}
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
  if (userRole !== 'PARTNER') {
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
                  {currentUser?.email} ({userRole})
                  {partnerEmployee && partnerCompany && (
                    <span className="ml-2 text-xs text-gray-500">({partnerCompany.name})</span>
                  )}
                </span>
                <div className="relative">
                  <button
                    onClick={handleLogoutClick}
                    className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
                  >
                    Esci
                  </button>
                  <LogoutDropdown 
                    isOpen={showLogoutDropdown}
                    onConfirm={handleLogoutConfirm}
                    onCancel={handleLogoutCancel}
                    position="bottom"
                    align="end"
                  />
                </div>
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