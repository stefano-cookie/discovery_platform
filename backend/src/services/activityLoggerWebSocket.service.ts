/**
 * Activity Logger WebSocket Service
 *
 * Streaming real-time dei log per dashboard Discovery Admin
 */

import { Server as SocketIOServer } from 'socket.io';
import { activityLogger } from './activityLogger.service';
import { ActivityLogCategory } from '@prisma/client';

interface ActivityLogStreamFilters {
  partnerCompanyId?: string;
  category?: ActivityLogCategory;
  actions?: string[];
}

class ActivityLoggerWebSocketService {
  private io: SocketIOServer | null = null;
  private subscribedSockets = new Map<string, ActivityLogStreamFilters>();

  /**
   * Inizializza WebSocket server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;

    // Namespace dedicato ai log
    const activityNamespace = io.of('/activity-logs');

    activityNamespace.on('connection', socket => {
      console.log(`[ActivityLogWS] Client connected: ${socket.id}`);

      // Subscribe ai log real-time
      socket.on('subscribe', (filters: ActivityLogStreamFilters) => {
        console.log(`[ActivityLogWS] Client ${socket.id} subscribed with filters:`, filters);
        this.subscribedSockets.set(socket.id, filters);

        socket.emit('subscribed', {
          success: true,
          filters,
        });
      });

      // Unsubscribe
      socket.on('unsubscribe', () => {
        console.log(`[ActivityLogWS] Client ${socket.id} unsubscribed`);
        this.subscribedSockets.delete(socket.id);

        socket.emit('unsubscribed', {
          success: true,
        });
      });

      // Update filtri
      socket.on('updateFilters', (filters: ActivityLogStreamFilters) => {
        console.log(`[ActivityLogWS] Client ${socket.id} updated filters:`, filters);
        this.subscribedSockets.set(socket.id, filters);

        socket.emit('filtersUpdated', {
          success: true,
          filters,
        });
      });

      // Disconnessione
      socket.on('disconnect', () => {
        console.log(`[ActivityLogWS] Client disconnected: ${socket.id}`);
        this.subscribedSockets.delete(socket.id);
      });
    });

    // Listener su activity logger per broadcast
    activityLogger.on('log', logEntry => {
      this.broadcastLog(logEntry);
    });
  }

  /**
   * Broadcast log a tutti i client sottoscritti con filtri matching
   */
  private broadcastLog(logEntry: any): void {
    if (!this.io) return;

    const activityNamespace = this.io.of('/activity-logs');

    activityNamespace.sockets.forEach((socket, socketId) => {
      const filters = this.subscribedSockets.get(socketId);

      if (!filters) return; // Client non sottoscritto

      // Applica filtri
      if (filters.partnerCompanyId && logEntry.partnerCompanyId !== filters.partnerCompanyId) {
        return;
      }

      if (filters.category && logEntry.category !== filters.category) {
        return;
      }

      if (filters.actions && filters.actions.length > 0) {
        if (!filters.actions.includes(logEntry.action)) {
          return;
        }
      }

      // Invia log al client
      socket.emit('activityLog', logEntry);
    });
  }

  /**
   * Broadcast notifica admin (per eventi critici)
   */
  broadcastAdminNotification(notification: {
    type: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    data?: any;
  }): void {
    if (!this.io) return;

    const activityNamespace = this.io.of('/activity-logs');
    activityNamespace.emit('adminNotification', notification);
  }

  /**
   * Disconnetti tutti i client
   */
  disconnectAll(): void {
    if (!this.io) return;

    const activityNamespace = this.io.of('/activity-logs');
    activityNamespace.disconnectSockets(true);
    this.subscribedSockets.clear();
  }
}

export const activityLoggerWS = new ActivityLoggerWebSocketService();
