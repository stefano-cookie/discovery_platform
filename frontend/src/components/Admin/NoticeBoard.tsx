import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import RichTextEditor from '../UI/RichTextEditor';

interface Notice {
  id: string;
  title: string;
  content: string;
  contentHtml?: string;
  attachments?: Array<{ name: string; url: string; type: string; size: number }>;
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
}

interface NoticeStats {
  totalStaff: number;
  totalReads: number;
  readPercentage: number;
  acknowledgements: Array<{
    readAt: string;
    user?: {
      id: string;
      email: string;
      role: string;
    };
    partnerEmployee?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
}

const NoticeBoard: React.FC = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedNoticeStats, setSelectedNoticeStats] = useState<NoticeStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    contentHtml: '',
    priority: 'NORMAL' as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
    isPinned: false,
    attachments: [] as Array<{ name: string; url: string; type: string; size: number }>
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotices(response.data.notices);
    } catch (error) {
      console.error('Error fetching notices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/notices/upload`,
          formDataUpload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );

        setFormData(prev => ({
          ...prev,
          attachments: [...prev.attachments, response.data.attachment]
        }));
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert(`Errore upload: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = async (index: number) => {
    const attachment = formData.attachments[index];

    // Delete file from R2 if it has a key
    if (attachment.url && !attachment.url.startsWith('http')) {
      // Old format: /uploads/notices/filename.jpg
      try {
        const token = localStorage.getItem('token');
        const filename = attachment.url.split('/').pop();
        await axios.delete(
          `${process.env.REACT_APP_API_URL}/notices/upload/${filename}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    } else if (attachment.url && attachment.url.includes('r2.dev')) {
      // New format: https://pub-xxx.r2.dev/notices/filename.jpg
      try {
        const token = localStorage.getItem('token');
        const urlParts = attachment.url.split('/');
        const fileKey = urlParts.slice(-2).join('/'); // notices/filename.jpg
        await axios.delete(
          `${process.env.REACT_APP_API_URL}/notices/upload/${encodeURIComponent(fileKey)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Error deleting file from R2:', error);
      }
    }

    setFormData({
      ...formData,
      attachments: formData.attachments.filter((_, i) => i !== index)
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/notices`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Notice created successfully:', response.data);
      setShowCreateModal(false);
      setFormData({
        title: '',
        content: '',
        contentHtml: '',
        priority: 'NORMAL',
        isPinned: false,
        attachments: []
      });
      fetchNotices();
    } catch (error: any) {
      console.error('Error creating notice:', error);
      alert(`Errore nella creazione del post: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo post?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${process.env.REACT_APP_API_URL}/notices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotices();
    } catch (error) {
      console.error('Error deleting notice:', error);
      alert('Errore nell\'eliminazione del post');
    }
  };

  const fetchStats = async (noticeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/notices/${noticeId}/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedNoticeStats(response.data.stats);
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error fetching stats:', error);
      alert('Errore nel caricamento delle statistiche');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bacheca Annunci</h1>
          <p className="text-gray-600 text-sm mt-1">Gestisci le comunicazioni per partner e staff</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="font-medium">{notices.length}</span> {notices.length === 1 ? 'annuncio' : 'annunci'}
        </div>
      </div>

      {/* Create Post Card */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-md border border-blue-100 p-5 hover:shadow-lg transition-shadow">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
            A
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 text-left px-5 py-3 bg-white hover:bg-gray-50 rounded-full text-gray-600 transition-all border border-gray-200 hover:border-blue-300 hover:shadow-sm font-medium"
          >
            Scrivi un nuovo annuncio...
          </button>
        </div>
      </div>

      {/* Notices Feed */}
      {notices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-16 text-center">
          <div className="text-gray-300 mb-4">
            <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nessun annuncio pubblicato</h3>
          <p className="text-gray-500 mb-6">Inizia creando il primo annuncio per il tuo team</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crea annuncio
          </button>
        </div>
      ) : (
        notices.map((notice) => (
          <div
            key={notice.id}
            className={`bg-white rounded-2xl shadow-md border transition-all overflow-hidden ${
              notice.isPinned
                ? 'border-yellow-400 border-2 shadow-yellow-100'
                : 'border-gray-200 hover:shadow-lg hover:border-blue-200'
            }`}
          >
            {/* Pinned Banner */}
            {notice.isPinned && (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-yellow-800">Annuncio fissato</span>
              </div>
            )}

            {/* Post Header */}
            <div className="p-5 pb-3">
              <div className="flex items-start justify-between">
                <div className="flex gap-3 flex-1">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
                    {notice.creator.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{notice.creator.email}</h3>
                      {getPriorityBadge(notice.priority)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(notice.publishedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchStats(notice.id)}
                    className="p-2.5 hover:bg-blue-50 rounded-xl transition-all hover:scale-105"
                    title="Statistiche"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(notice.id)}
                    className="p-2.5 hover:bg-red-50 rounded-xl transition-all hover:scale-105"
                    title="Elimina"
                  >
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
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

            {/* Post Stats */}
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-gray-200">
              <button
                onClick={() => fetchStats(notice.id)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 font-medium transition-colors group"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>{notice.totalReads} {notice.totalReads === 1 ? 'visualizzazione' : 'visualizzazioni'}</span>
              </button>
            </div>
          </div>
        ))
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Crea nuovo annuncio</h2>
                <p className="text-blue-100 text-sm mt-1">Condividi informazioni importanti con il team</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ title: '', content: '', contentHtml: '', priority: 'NORMAL', isPinned: false, attachments: [] });
                }}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Titolo</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Es: Aggiornamento importante sulle procedure"
                  className="w-full text-2xl font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Contenuto</label>
                <RichTextEditor
                  content={formData.contentHtml || formData.content}
                  onChange={(text, html) => setFormData({ ...formData, content: text, contentHtml: html })}
                  placeholder="Scrivi il messaggio che vuoi condividere..."
                />
              </div>

              {/* Attachments */}
              {formData.attachments.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Allegati ({formData.attachments.length})</label>
                  <div className="space-y-2">
                    {formData.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {file.type === 'image' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              ) : file.type === 'pdf' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              )}
                            </svg>
                          </div>
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">{file.name}</div>
                            <div className="text-xs text-gray-600">{(file.size / 1024).toFixed(1)} KB</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="p-2 hover:bg-red-100 rounded-xl transition-all"
                          title="Rimuovi"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-blue-200">
                <label className="block text-sm font-bold text-gray-700 mb-3">Opzioni annuncio</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-green-300 text-gray-700 hover:bg-green-50 rounded-xl transition-all disabled:opacity-50 font-semibold"
                  >
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{uploading ? 'Caricamento...' : 'Aggiungi file'}</span>
                  </button>

                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="px-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="LOW">Priorità bassa</option>
                    <option value="NORMAL">Priorità normale</option>
                    <option value="HIGH">Priorità alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>

                  <label className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-yellow-300 rounded-xl cursor-pointer hover:bg-yellow-50 transition-all">
                    <input
                      type="checkbox"
                      checked={formData.isPinned}
                      onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                      className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">Fissa in alto</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ title: '', content: '', contentHtml: '', priority: 'NORMAL', isPinned: false, attachments: [] });
                }}
                className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-semibold transition-all"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pubblica annuncio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && selectedNoticeStats && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Statistiche visualizzazioni</h2>
                <p className="text-blue-100 text-sm mt-1">Monitoraggio engagement</p>
              </div>
              <button
                onClick={() => setShowStatsModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                  <div className="text-4xl font-extrabold text-blue-700 mb-1">{selectedNoticeStats.totalStaff}</div>
                  <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Staff totale</div>
                </div>
                <div className="text-center p-5 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                  <div className="text-4xl font-extrabold text-green-700 mb-1">{selectedNoticeStats.totalReads}</div>
                  <div className="text-sm font-semibold text-green-600 uppercase tracking-wide">Hanno visto</div>
                </div>
                <div className="text-center p-5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                  <div className="text-4xl font-extrabold text-purple-700 mb-1">{selectedNoticeStats.readPercentage}%</div>
                  <div className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Copertura</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
                  <span>Progresso visualizzazioni</span>
                  <span className="text-blue-600">{selectedNoticeStats.totalReads}/{selectedNoticeStats.totalStaff}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${selectedNoticeStats.readPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Readers List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Chi ha visualizzato
                  </h3>
                  <span className="text-sm text-gray-500 font-medium">{selectedNoticeStats.acknowledgements.length} {selectedNoticeStats.acknowledgements.length === 1 ? 'persona' : 'persone'}</span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedNoticeStats.acknowledgements.map((ack, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-blue-100 hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                          {ack.user ? ack.user.email.charAt(0).toUpperCase() :
                           ack.partnerEmployee ? ack.partnerEmployee.firstName?.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-900">
                            {ack.user ? ack.user.email :
                             ack.partnerEmployee ? `${ack.partnerEmployee.firstName} ${ack.partnerEmployee.lastName}` : 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-600 font-medium">
                            {ack.user ? `${ack.user.role}` :
                             ack.partnerEmployee ? `Partner - ${ack.partnerEmployee.role}` : 'Unknown'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatTime(ack.readAt)}
                      </div>
                    </div>
                  ))}
                  {selectedNoticeStats.acknowledgements.length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <div className="text-gray-400 mb-3">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Nessuna visualizzazione ancora</p>
                      <p className="text-sm text-gray-500 mt-1">L'annuncio è stato pubblicato ma non ancora visualizzato</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
