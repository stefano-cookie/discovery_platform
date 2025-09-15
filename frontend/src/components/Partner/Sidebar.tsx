import React, { useState } from 'react';
import { usePartnerAuth } from '../../hooks/usePartnerAuth';
import LogoutDropdown from '../UI/LogoutDropdown';

interface SidebarProps {
  activeTab: 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' | 'collaborators' | 'sub-partners';
  onTabChange: (tab: 'dashboard' | 'users' | 'chat' | 'coupons' | 'offers' | 'collaborators' | 'sub-partners') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { partnerEmployee, partnerCompany, logout } = usePartnerAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutDropdown(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutDropdown(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutDropdown(false);
  };

  // Base menu items for all partners (COMMERCIAL and ADMINISTRATIVE)
  const baseMenuItems = [
    {
      id: 'users',
      name: 'Gestione Utenti',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 0 1 5 0z" />
        </svg>
      )
    },
    {
      id: 'offers',
      name: 'Gestione Offerte',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'chat',
      name: 'Chat',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    }
  ];

  // Additional menu items for parent companies (not sub-partners)
  const parentOnlyItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
        </svg>
      )
    },
    {
      id: 'coupons',
      name: 'Coupon',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2.01 2.01 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    }
  ];

  // Menu items only for ADMINISTRATIVE role
  const administrativeOnlyItems = [
    {
      id: 'collaborators',
      name: 'Dipendenti',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2a3 3 0 515.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    }
  ];

  // Build menu items based on company type and role
  let menuItems;

  if (partnerCompany?.parentId) {
    // Sub-partners: only basic items (no collaborators even for ADMINISTRATIVE)
    menuItems = baseMenuItems;
  } else {
    // Parent companies
    if (partnerEmployee?.role === 'ADMINISTRATIVE') {
      // ADMINISTRATIVE: dashboard + all items + coupons + collaborators
      menuItems = [
        parentOnlyItems[0], // dashboard
        ...baseMenuItems.slice(0, 2), // users, offers
        ...administrativeOnlyItems, // collaborators
        baseMenuItems[baseMenuItems.length - 1], // chat
        parentOnlyItems[1] // coupons
      ];
    } else {
      // COMMERCIAL: dashboard + basic items + coupons (no collaborators)
      menuItems = [
        parentOnlyItems[0], // dashboard
        ...baseMenuItems, // users, offers, chat
        parentOnlyItems[1] // coupons
      ];
    }
  }

  // Add sub-partners menu item for premium companies (only for ADMINISTRATIVE)
  const extendedMenuItems = (partnerCompany?.isPremium && partnerEmployee?.role === 'ADMINISTRATIVE')
    ? [
        ...menuItems.slice(0, -1), // All items except chat
        {
          id: 'sub-partners',
          name: 'Collaboratori',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0h6" />
            </svg>
          ),
          isPremium: true
        },
        menuItems[menuItems.length - 1] // Add chat at the end
      ]
    : menuItems;

  return (
    <>
      {/* Sidebar Desktop */}
      <div className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'} transition-all duration-300`}>
        <div className="flex flex-col flex-1 min-h-0 bg-gradient-to-b from-gray-900 to-gray-800 shadow-xl">
          {/* Header */}
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-900">
            <div className="flex items-center w-full">
              {!isCollapsed && (
                <div className="flex-1">
                  <h1 className="text-white text-lg font-bold">Discovery Platform</h1>
                  <p className="text-gray-300 text-xs">
                    Partner Dashboard
                  </p>
                </div>
              )}
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                </svg>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {extendedMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as any)}
                className={`group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === item.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <div className="mr-3 flex-shrink-0">
                  {item.icon}
                </div>
                {!isCollapsed && (
                  <div className="flex items-center justify-between w-full">
                    <span>{item.name}</span>
                    {(item as any).isPremium && (
                      <span className="ml-2 text-yellow-400 text-xs">⭐</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </nav>


          {/* User Profile */}
          <div className="flex-shrink-0 border-t border-gray-700">
            {!isCollapsed && partnerCompany && (
              <div className="px-4 py-3 bg-gray-800">
                {/* Company Info */}
                <div className="mb-3">
                  <div className="flex items-center mb-1">
                    <div className="h-6 w-6 bg-purple-600 rounded flex items-center justify-center mr-2">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {partnerCompany.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-300">
                          Code: {partnerCompany.referralCode}
                        </p>
                        {partnerCompany.isPremium && (
                          <span className="text-yellow-400 text-xs">
                            ⭐ Premium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-600 pt-3">
                  {/* Employee Info */}
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {partnerEmployee?.firstName?.charAt(0).toUpperCase() || partnerEmployee?.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {partnerEmployee?.firstName && partnerEmployee?.lastName
                          ? `${partnerEmployee.firstName} ${partnerEmployee.lastName}`
                          : partnerEmployee?.email
                        }
                      </p>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                          partnerEmployee?.role === 'ADMINISTRATIVE'
                            ? 'bg-blue-800 text-blue-100'
                            : 'bg-gray-700 text-gray-200'
                        }`}>
                          {partnerEmployee?.role === 'ADMINISTRATIVE' ? (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                              </svg>
                              Admin
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                              </svg>
                              Commercial
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={handleLogoutClick}
                        className="ml-2 p-1 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
                        title="Logout"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                      <LogoutDropdown
                        isOpen={showLogoutDropdown}
                        onConfirm={handleLogoutConfirm}
                        onCancel={handleLogoutCancel}
                        position="top"
                        align="end"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Collapsed User Profile */}
            {isCollapsed && (
              <div className="p-4">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center mb-2">
                    <span className="text-white text-sm font-medium">
                      {partnerEmployee?.firstName?.charAt(0).toUpperCase() || partnerEmployee?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={handleLogoutClick}
                      className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
                      title="Logout"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </button>
                    <LogoutDropdown
                      isOpen={showLogoutDropdown}
                      onConfirm={handleLogoutConfirm}
                      onCancel={handleLogoutCancel}
                      position="top"
                      align="center"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-10">
        <nav className="flex justify-around">
          {extendedMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              className={`flex flex-col items-center py-2 px-3 ${
                activeTab === item.id
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              {item.icon}
              <span className="text-xs mt-1">{item.name.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      </div>

    </>
  );
};

export default Sidebar;