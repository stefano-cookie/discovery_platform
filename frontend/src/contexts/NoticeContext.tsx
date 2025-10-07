import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeNotices, Notice } from '../hooks/useRealtimeNotices';

interface NoticeContextType {
  notices: Notice[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  acknowledgeNotice: (noticeId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const NoticeContext = createContext<NoticeContextType | undefined>(undefined);

export const NoticeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const noticeState = useRealtimeNotices();

  return (
    <NoticeContext.Provider value={noticeState}>
      {children}
    </NoticeContext.Provider>
  );
};

export const useNotices = (): NoticeContextType => {
  const context = useContext(NoticeContext);
  if (!context) {
    throw new Error('useNotices must be used within a NoticeProvider');
  }
  return context;
};
