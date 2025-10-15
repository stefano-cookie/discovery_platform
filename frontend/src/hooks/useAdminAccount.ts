import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface AdminAccountInfo {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  user: {
    twoFactorEnabled: boolean;
  };
}

export const useAdminAccount = () => {
  const [adminInfo, setAdminInfo] = useState<AdminAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminInfo();
  }, []);

  const fetchAdminInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/api/admin/accounts/current/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setAdminInfo(response.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching admin info:', err);
      setError(err.response?.data?.error || 'Failed to fetch admin info');
    } finally {
      setLoading(false);
    }
  };

  return { adminInfo, loading, error, refetch: fetchAdminInfo };
};
