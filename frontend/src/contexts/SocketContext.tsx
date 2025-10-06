import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  connect: () => {},
  disconnect: () => {},
});

export const useSocketContext = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
}

/**
 * WebSocket Provider
 * Manages a single Socket.IO connection for the entire app
 */
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const connect = useCallback(() => {
    // Don't create multiple connections
    if (socket?.connected) {
      console.log('[Socket] Already connected');
      return;
    }

    // Get JWT token from localStorage (try both user and partner tokens)
    const token = localStorage.getItem('token') || localStorage.getItem('partnerToken');

    if (!token) {
      console.warn('[Socket] No authentication token found');
      return;
    }

    // Remove /api suffix if present - Socket.IO connects to server root
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const BACKEND_URL = apiUrl.replace(/\/api$/, '');

    console.log('[Socket] Connecting to:', BACKEND_URL);

    // Create Socket.IO connection
    const newSocket = io(BACKEND_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
      setIsAuthenticated(false);

      // If authentication failed, clear token
      if (error.message.includes('token') || error.message.includes('Authentication')) {
        console.warn('[Socket] Authentication failed - clearing token');
        localStorage.removeItem('token');
      }
    });

    // Welcome message (indicates successful auth)
    newSocket.on('welcome', (data) => {
      console.log('[Socket] Welcome message:', data);
      setIsAuthenticated(true);
    });

    // Generic error handler
    newSocket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    // Reconnection events
    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
    });

    setSocket(newSocket);
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('[Socket] Disconnecting...');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setIsAuthenticated(false);
    }
  }, [socket]);

  // Auto-connect when token is available
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('partnerToken');

    if (token && !socket) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          // Token added/changed - reconnect
          disconnect();
          setTimeout(() => connect(), 500);
        } else {
          // Token removed - disconnect
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [connect, disconnect]);

  const value: SocketContextType = {
    socket,
    isConnected,
    isAuthenticated,
    connect,
    disconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
