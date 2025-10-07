import React, { useState } from 'react';
import { useNotices } from '../../contexts/NoticeContext';
import { Notice } from '../../hooks/useRealtimeNotices';

const NoticeBoardView: React.FC = () => {
  // Use shared context instead of creating new instance
  const { notices, unreadCount, acknowledgeNotice, loading } = useNotices();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleAcknowledge = async (noticeId: string) => {
    try {
      await acknowledgeNotice(noticeId);
    } catch (error) {
      console.error('Error acknowledging notice:', error);
      // You could show a toast/notification here
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Urgente</span>;
      case 'HIGH':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Importante</span>;
      case 'NORMAL':
        return null;
      case 'LOW':
        return null;
      default:
        return null;
    }
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffMs = now.getTime() - postDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins}m fa`;
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays < 7) return `${diffDays}g fa`;

    return postDate.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'short'
    });
  };

  const filteredNotices = filter === 'unread'
    ? notices.filter(n => !n.isRead)
    : notices;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bacheca</h1>
          <p className="text-gray-600 text-sm mt-1">Comunicazioni importanti da Discovery</p>
        </div>

        {/* Stats Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-blue-900">{notices.length} {notices.length === 1 ? 'messaggio' : 'messaggi'}</span>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-200 animate-pulse">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
              <span className="text-sm font-bold text-red-900">{unreadCount} {unreadCount === 1 ? 'nuovo' : 'nuovi'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-2 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
            filter === 'all'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            Tutti
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filter === 'all' ? 'bg-white/20' : 'bg-gray-200'
            }`}>
              {notices.length}
            </span>
          </span>
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`flex-1 px-5 py-3 rounded-xl font-semibold text-sm transition-all relative ${
            filter === 'unread'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            Non letti
            {unreadCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filter === 'unread' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {unreadCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Notices Feed */}
      {filteredNotices.length === 0 ? (
        <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-md border border-gray-200 p-16 text-center">
          <div className="text-green-400 mb-4">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {filter === 'unread' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              )}
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            {filter === 'unread' ? 'Ottimo lavoro!' : 'Nessun messaggio'}
          </h3>
          <p className="text-gray-600">
            {filter === 'unread' ? 'Hai visualizzato tutti i messaggi' : 'Non ci sono comunicazioni al momento'}
          </p>
        </div>
      ) : (
        filteredNotices.map((notice) => (
          <div
            key={notice.id}
            className={`bg-white rounded-2xl shadow-md border transition-all overflow-hidden ${
              notice.isPinned
                ? 'border-yellow-400 border-2 shadow-yellow-100'
                : !notice.isRead
                ? 'border-blue-400 border-2 shadow-blue-100'
                : 'border-gray-200 hover:shadow-lg hover:border-gray-300'
            }`}
          >
            {/* Pinned or New Banner */}
            {notice.isPinned && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
                <span className="text-sm font-bold text-yellow-800">Messaggio importante</span>
              </div>
            )}
            {!notice.isPinned && !notice.isRead && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-4 py-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-blue-800">Nuovo messaggio</span>
              </div>
            )}

            {/* Post Header */}
            <div className="p-5 pb-3">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg">
                  D
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900">Discovery Admin</h3>
                    {getPriorityBadge(notice.priority)}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{formatTime(notice.publishedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div className="px-5 pb-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">{notice.title}</h2>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                {notice.contentHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: notice.contentHtml }} />
                ) : (
                  <p className="whitespace-pre-wrap">{notice.content}</p>
                )}
              </div>
            </div>

            {/* Attachments */}
            {notice.attachments && notice.attachments.length > 0 && (
              <div className="px-5 pb-4 space-y-3">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Allegati
                </div>

                {/* Image attachments - show as previews */}
                {notice.attachments.filter(f => f.type === 'image').length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {notice.attachments.filter(f => f.type === 'image').map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-video overflow-hidden rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg"
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <div className="text-white text-xs font-medium truncate">{file.name}</div>
                            <div className="text-white/80 text-xs">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Other attachments (PDF, documents) - show as list */}
                {notice.attachments.filter(f => f.type !== 'image').length > 0 && (
                  <div className="space-y-2">
                    {notice.attachments.filter(f => f.type !== 'image').map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-200 rounded-xl hover:shadow-md hover:from-blue-50 hover:to-indigo-50 transition-all group"
                      >
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {file.type === 'pdf' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{file.name}</div>
                          <div className="text-xs text-gray-600">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <svg className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post Footer */}
            <div className={`px-5 py-3 border-t ${
              notice.isRead
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
            }`}>
              {notice.isRead ? (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-bold">Visualizzato</span>
                  </div>
                  <span className="text-gray-600 text-xs font-medium">
                    {formatTime(notice.readAt || notice.publishedAt)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleAcknowledge(notice.id)}
                  className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Segna come visualizzato
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default NoticeBoardView;
