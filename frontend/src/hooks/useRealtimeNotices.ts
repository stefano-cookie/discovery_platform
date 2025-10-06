import { useState, useEffect, useCallback } from 'react';
import { useSocket, useSocketEmit } from './useSocket';
import axios from 'axios';

interface Notice {
  id: string;
  title: string;
  content: string;
  contentHtml?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isPinned: boolean;
  publishedAt: string;
  createdBy: string;
  attachments?: any[];
  isRead?: boolean;
}

interface NoticeStats {
  totalReads: number;
  totalUsers: number;
  readPercentage: number;
}

/**
 * Hook for real-time Notice Board updates
 *
 * Features:
 * - Automatically fetches notices on mount
 * - Listens for real-time updates (new, updated, deleted)
 * - Provides acknowledgement function
 * - Tracks unread count
 *
 * Usage:
 * ```tsx
 * const { notices, unreadCount, acknowledgeNotice, loading } = useRealtimeNotices();
 * ```
 */
export const useRealtimeNotices = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const emit = useSocketEmit();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  /**
   * Fetch initial notices from API
   */
  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await axios.get(`${API_URL}/api/notices`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // API returns { notices: Notice[] }
      setNotices(response.data.notices || response.data);
      setError(null);
    } catch (err: any) {
      console.error('[useRealtimeNotices] Error fetching notices:', err);
      setError(err.response?.data?.message || 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Fetch on mount
  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  /**
   * Handle new notice
   */
  useSocket<Notice>(
    'notice:new',
    (newNotice) => {
      console.log('[useRealtimeNotices] New notice received:', newNotice);

      setNotices((prev) => {
        // Add to beginning
        return [newNotice, ...prev];
      });
    },
    []
  );

  /**
   * Handle notice update
   */
  useSocket<{ id: string; changes: Partial<Notice> }>(
    'notice:updated',
    (update) => {
      console.log('[useRealtimeNotices] Notice updated:', update);

      setNotices((prev) =>
        prev.map((notice) =>
          notice.id === update.id ? { ...notice, ...update.changes } : notice
        )
      );
    },
    []
  );

  /**
   * Handle notice deletion
   */
  useSocket<{ id: string }>(
    'notice:deleted',
    (deleted) => {
      console.log('[useRealtimeNotices] Notice deleted:', deleted);

      setNotices((prev) => prev.filter((notice) => notice.id !== deleted.id));
    },
    []
  );

  /**
   * Acknowledge notice (mark as read)
   */
  const acknowledgeNotice = useCallback(
    async (noticeId: string) => {
      try {
        const token = localStorage.getItem('token');

        // Call API
        await axios.post(
          `${API_URL}/api/notices/${noticeId}/acknowledge`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Update local state
        setNotices((prev) =>
          prev.map((notice) =>
            notice.id === noticeId ? { ...notice, isRead: true } : notice
          )
        );

        // Emit to WebSocket for admin notification
        emit('notice:acknowledge', { noticeId });

        console.log('[useRealtimeNotices] Notice acknowledged:', noticeId);
      } catch (err: any) {
        console.error('[useRealtimeNotices] Error acknowledging notice:', err);
        throw err;
      }
    },
    [API_URL, emit]
  );

  /**
   * Calculate unread count
   */
  const unreadCount = notices.filter((notice) => !notice.isRead).length;

  /**
   * Sort notices: pinned first, then by date
   */
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return {
    notices: sortedNotices,
    unreadCount,
    loading,
    error,
    acknowledgeNotice,
    refetch: fetchNotices,
  };
};

/**
 * Hook for admin to track notice statistics (real-time)
 *
 * Usage:
 * ```tsx
 * const { stats, loading } = useNoticeStats(noticeId);
 * ```
 */
export const useNoticeStats = (noticeId: string) => {
  const [stats, setStats] = useState<NoticeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  /**
   * Fetch initial stats
   */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');

        const response = await axios.get(`${API_URL}/api/notices/${noticeId}/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setStats(response.data);
        setLoading(false);
      } catch (err) {
        console.error('[useNoticeStats] Error fetching stats:', err);
        setLoading(false);
      }
    };

    fetchStats();
  }, [noticeId, API_URL]);

  /**
   * Listen for acknowledgements (admin only)
   */
  useSocket<{ noticeId: string; totalReads: number }>(
    'notice:acknowledged',
    (data) => {
      if (data.noticeId === noticeId) {
        console.log('[useNoticeStats] Stats updated:', data);

        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalReads: data.totalReads,
            readPercentage: (data.totalReads / prev.totalUsers) * 100,
          };
        });
      }
    },
    [noticeId]
  );

  return {
    stats,
    loading,
  };
};
