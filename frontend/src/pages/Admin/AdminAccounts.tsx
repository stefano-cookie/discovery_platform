import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  Key,
  Clock,
  Calendar,
} from 'lucide-react';
import api from '../../services/api';

interface AdminAccount {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  user: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    twoFactorEnabled: boolean;
    createdAt: string;
  };
}

const AdminAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState({
    email: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/accounts');
      if (response.data.success) {
        setAccounts(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching admin accounts:', err);
      setError(err.response?.data?.error || 'Failed to fetch admin accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setFormData({
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    });
    setFormErrors({
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    });
    setShowCreateDialog(true);
  };

  const handleOpenEditDialog = (account: AdminAccount) => {
    setSelectedAccount(account);
    setFormData({
      email: account.email,
      displayName: account.displayName,
      password: '',
      confirmPassword: '',
    });
    setFormErrors({
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    });
    setShowEditDialog(true);
  };

  const validateForm = (isCreate: boolean): boolean => {
    const errors = {
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    };

    let isValid = true;

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
      isValid = false;
    }

    // Display name validation
    if (!formData.displayName) {
      errors.displayName = 'Display name is required';
      isValid = false;
    } else if (formData.displayName.length < 3) {
      errors.displayName = 'Display name must be at least 3 characters';
      isValid = false;
    }

    // Password validation (only for create)
    if (isCreate) {
      if (!formData.password) {
        errors.password = 'Password is required';
        isValid = false;
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
        isValid = false;
      }

      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm password';
        isValid = false;
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleCreateAccount = async () => {
    if (!validateForm(true)) return;

    try {
      const response = await api.post('/api/admin/accounts', {
        email: formData.email,
        displayName: formData.displayName,
        password: formData.password,
      });

      if (response.data.success) {
        setSuccess('Admin account created successfully');
        setShowCreateDialog(false);
        fetchAccounts();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Error creating admin account:', err);
      setError(err.response?.data?.error || 'Failed to create admin account');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount || !validateForm(false)) return;

    try {
      const response = await api.put(`/api/admin/accounts/${selectedAccount.id}`, {
        displayName: formData.displayName,
      });

      if (response.data.success) {
        setSuccess('Admin account updated successfully');
        setShowEditDialog(false);
        fetchAccounts();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Error updating admin account:', err);
      setError(err.response?.data?.error || 'Failed to update admin account');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeactivateAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this admin account?')) return;

    try {
      const response = await api.delete(`/api/admin/accounts/${accountId}`);

      if (response.data.success) {
        setSuccess('Admin account deactivated successfully');
        fetchAccounts();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Error deactivating admin account:', err);
      setError(err.response?.data?.error || 'Failed to deactivate admin account');
      setTimeout(() => setError(''), 5000);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            Admin Accounts
          </h1>
          <p className="text-gray-600 mt-2">Manage Discovery platform administrators</p>
        </div>
        <button
          onClick={handleOpenCreateDialog}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Create Admin Account
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-sm text-green-700">{success}</p>
          </div>
          <button onClick={() => setSuccess('')} className="text-green-600 hover:text-green-800">
            ×
          </button>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Admin
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                2FA
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No admin accounts found
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-semibold text-gray-900">{account.displayName}</div>
                      <div className="text-sm text-gray-600">{account.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {account.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                        <Ban className="w-3.5 h-3.5" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {account.user.twoFactorEnabled ? (
                      <div className="flex items-center gap-2 text-green-600" title="2FA Enabled">
                        <Key className="w-4 h-4" />
                        <span className="text-sm font-medium">Enabled</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400" title="2FA Not Configured">
                        <Key className="w-4 h-4" />
                        <span className="text-sm font-medium">Not Set</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {formatDate(account.lastLoginAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(account.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditDialog(account)}
                        disabled={!account.isActive}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeactivateAccount(account.id)}
                        disabled={!account.isActive}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Deactivate"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Admin Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Admin Account</h2>
              <p className="text-sm text-gray-600 mt-1">Add a new administrator to the platform</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className={`w-full px-4 py-2 border ${
                    formErrors.displayName ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="Full name (e.g., John Doe)"
                />
                {formErrors.displayName && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-2 border ${
                    formErrors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="admin@example.com"
                />
                {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-2 border ${
                    formErrors.password ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="Minimum 8 characters"
                />
                {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full px-4 py-2 border ${
                    formErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                  placeholder="Re-enter password"
                />
                {formErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                )}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ℹ️ The admin will be required to set up 2FA on first login.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAccount}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Dialog */}
      {showEditDialog && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Admin Account</h2>
              <p className="text-sm text-gray-600 mt-1">Update administrator information</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className={`w-full px-4 py-2 border ${
                    formErrors.displayName ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
                />
                {formErrors.displayName && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEditDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAccount}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccounts;
