import { useEffect, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

/**
 * Generic hook to listen to Socket.IO events
 *
 * Usage:
 * ```tsx
 * useSocket('notice:new', (data) => {
 *   console.log('New notice:', data);
 *   // Update state, show notification, etc.
 * });
 * ```
 */
export const useSocket = <T = any>(
  event: string,
  callback: (data: T) => void,
  deps: any[] = []
): void => {
  const { socket, isConnected, isAuthenticated } = useSocketContext();

  // Memoize callback to avoid re-subscribing on every render
  const memoizedCallback = useCallback(callback, deps);

  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated) {
      return;
    }

    console.log(`[useSocket] Subscribing to event: ${event}`);

    socket.on(event, memoizedCallback);

    // Cleanup on unmount or when dependencies change
    return () => {
      console.log(`[useSocket] Unsubscribing from event: ${event}`);
      socket.off(event, memoizedCallback);
    };
  }, [socket, isConnected, isAuthenticated, event, memoizedCallback]);
};

/**
 * Hook to emit events to the server
 *
 * Usage:
 * ```tsx
 * const emit = useSocketEmit();
 *
 * const acknowledgeNotice = (noticeId: string) => {
 *   emit('notice:acknowledge', { noticeId });
 * };
 * ```
 */
export const useSocketEmit = () => {
  const { socket, isConnected, isAuthenticated } = useSocketContext();

  const emit = useCallback(
    (event: string, data?: any) => {
      if (!socket || !isConnected || !isAuthenticated) {
        console.warn(`[useSocketEmit] Cannot emit "${event}" - socket not ready`);
        return false;
      }

      console.log(`[useSocketEmit] Emitting event: ${event}`, data);
      socket.emit(event, data);
      return true;
    },
    [socket, isConnected, isAuthenticated]
  );

  return emit;
};

/**
 * Hook to get socket connection status
 *
 * Usage:
 * ```tsx
 * const { isConnected, isAuthenticated } = useSocketStatus();
 *
 * if (!isConnected) {
 *   return <div>Connecting to real-time updates...</div>;
 * }
 * ```
 */
export const useSocketStatus = () => {
  const { isConnected, isAuthenticated } = useSocketContext();

  return {
    isConnected,
    isAuthenticated,
    isReady: isConnected && isAuthenticated,
  };
};
