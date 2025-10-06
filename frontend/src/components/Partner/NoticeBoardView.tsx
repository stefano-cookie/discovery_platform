import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    email: string;
  };
  totalReads: number;
  isRead: boolean;
  readAt: string | null;
}

const NoticeBoardView: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotices(response.data.notices);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (noticeId: string) => {
    try {
      const token = localStorage.getItem('partnerToken') || localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/notices/${noticeId}/acknowledge`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setNotices(notices.map(n =>
        n.id === noticeId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ));
    } catch (error) {
      console.error('Error acknowledging notice:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'NORMAL': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'Urgente';
      case 'HIGH': return 'Alta';
      case 'NORMAL': return 'Normale';
      case 'LOW': return 'Bassa';
      default: return priority;
    }
  };

  const filteredNotices = filter === 'unread'
    ? notices.filter(n => !n.isRead)
    : notices;

  const unreadCount = notices.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bacheca Comunicazioni</h1>
            <p className="text-gray-600 mt-1">
              Annunci e comunicazioni importanti da Discovery
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-semibold">
              {unreadCount} {unreadCount === 1 ? 'nuovo messaggio' : 'nuovi messaggi'}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-2 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Tutti ({notices.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Non letti ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'unread' ? 'Nessun nuovo messaggio' : 'Nessun messaggio'}
            </h3>
            <p className="text-gray-500">
              {filter === 'unread' ? 'Hai letto tutti i messaggi!' : 'Non ci sono messaggi in bacheca'}
            </p>
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${
                notice.isPinned ? 'border-2 border-yellow-400' : 'border border-gray-200'
              } ${!notice.isRead ? 'ring-2 ring-blue-200' : ''}`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {!notice.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                      {notice.isPinned && (
                        <span className="text-yellow-500">📌</span>
                      )}
                      <h3 className="text-xl font-semibold text-gray-900">{notice.title}</h3>
                    </div>
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded border ${getPriorityColor(notice.priority)}`}>
                        {getPriorityLabel(notice.priority)}
                      </span>
                      <span>
                        {new Date(notice.publishedAt).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {notice.isRead && notice.readAt && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">
                            ✓ Letto il {new Date(notice.readAt).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="prose max-w-none mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{notice.content}</p>
                </div>

                {/* Action Button */}
                {!notice.isRead && (
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleAcknowledge(notice.id)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Ho letto</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NoticeBoardView;
