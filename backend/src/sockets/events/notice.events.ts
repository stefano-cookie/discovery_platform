import { Server } from 'socket.io';
import { AuthenticatedSocket, checkRateLimit } from '../auth.middleware';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../types';
import type {
  NoticeNewPayload,
  NoticeUpdatedPayload,
  NoticeDeletedPayload,
  NoticeAcknowledgedPayload,
} from '../types';

/**
 * Setup Notice Board event handlers
 */
export const setupNoticeEvents = (io: Server, socket: AuthenticatedSocket): void => {
  /**
   * Client acknowledges reading a notice
   * Receives: { noticeId: string }
   */
  socket.on(SOCKET_EVENTS.NOTICE_ACKNOWLEDGE, async (data: { noticeId: string }) => {
    if (!checkRateLimit(socket)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Rate limit exceeded' });
      return;
    }

    try {
      const { noticeId } = data;

      if (!noticeId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Notice ID required' });
        return;
      }

      console.log(
        `[Notice] Acknowledgement received: ${noticeId} from ${socket.data.email}`
      );

      // Emit to admin room for real-time stats update
      const ackPayload: NoticeAcknowledgedPayload = {
        noticeId,
        userId: socket.data.userId,
        readAt: new Date().toISOString(),
        totalReads: 0, // Will be updated by controller
      };

      io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.NOTICE_ACKNOWLEDGED, ackPayload);
    } catch (error) {
      console.error('[Notice] Error handling acknowledgement:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process notice acknowledgement',
      });
    }
  });
};

/**
 * Server-side functions to emit notice events
 * These are called from controllers, not from socket handlers
 */

/**
 * Broadcast new notice to all users
 */
export const emitNoticeNew = (io: Server, payload: NoticeNewPayload): void => {
  io.to(SOCKET_ROOMS.NOTICES_GLOBAL).emit(SOCKET_EVENTS.NOTICE_NEW, payload);
  console.log(`[Notice] Broadcasted new notice: ${payload.id} (${payload.title})`);
};

/**
 * Broadcast notice update
 */
export const emitNoticeUpdated = (io: Server, payload: NoticeUpdatedPayload): void => {
  io.to(SOCKET_ROOMS.NOTICES_GLOBAL).emit(SOCKET_EVENTS.NOTICE_UPDATED, payload);
  console.log(`[Notice] Broadcasted notice update: ${payload.id}`);
};

/**
 * Broadcast notice deletion
 */
export const emitNoticeDeleted = (io: Server, payload: NoticeDeletedPayload): void => {
  io.to(SOCKET_ROOMS.NOTICES_GLOBAL).emit(SOCKET_EVENTS.NOTICE_DELETED, payload);
  console.log(`[Notice] Broadcasted notice deletion: ${payload.id}`);
};

/**
 * Notify admins of new acknowledgement
 */
export const emitNoticeAcknowledged = (
  io: Server,
  payload: NoticeAcknowledgedPayload
): void => {
  io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.NOTICE_ACKNOWLEDGED, payload);
  console.log(
    `[Notice] Notified admins of acknowledgement: ${payload.noticeId} (total: ${payload.totalReads})`
  );
};
