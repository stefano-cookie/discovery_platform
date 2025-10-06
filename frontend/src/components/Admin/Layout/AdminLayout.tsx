import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  Download,
  FileCheck,
  LogOut,
  Search,
  Archive,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { GlobalSearch } from './GlobalSearch';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems: NavItem[] = [
    { path: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/admin/companies', label: 'Companies', icon: <Building2 className="w-5 h-5" /> },
    { path: '/admin/registrations', label: 'Iscrizioni Globali', icon: <FileText className="w-5 h-5" /> },
    { path: '/admin/users', label: 'Utenti', icon: <Users className="w-5 h-5" /> },
    { path: '/admin/notices', label: 'Bacheca', icon: <Bell className="w-5 h-5" /> },
    { path: '/admin/archive', label: 'Archivio', icon: <Archive className="w-5 h-5" /> },
    { path: '/admin/export', label: 'Export & Report', icon: <Download className="w-5 h-5" /> },
    { path: '/admin/logs', label: 'Audit Log', icon: <FileCheck className="w-5 h-5" /> },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // ESC to close
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50">
      {/* Sidebar */}
      <aside className="w-72 bg-white shadow-xl flex flex-col">
        {/* Header - Brand */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Discovery Admin</h1>
              <p className="text-xs text-indigo-100 mt-0.5">Super Amministratore</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={() => setSearchOpen(true)}
            className="relative w-full group"
          >
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            <div className="w-full pl-10 pr-16 py-2 border border-gray-200 rounded-lg text-sm text-left text-gray-500 group-hover:border-indigo-500 group-hover:bg-indigo-50 transition-all cursor-pointer">
              Cerca...
            </div>
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs text-gray-500 font-mono group-hover:bg-indigo-100 group-hover:border-indigo-300 group-hover:text-indigo-600 transition-all">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-200 font-medium scale-[1.02]'
                  : 'text-gray-700 hover:bg-gray-50 hover:scale-[1.01]'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          {/* User Info */}
          <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-white rounded-lg">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
              {user?.email?.[0].toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email || 'Admin'}
              </p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200 hover:scale-[1.01]"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {navItems.find(item => isActive(item.path))?.label || 'Dashboard'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sistema di gestione globale Discovery
            </p>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};