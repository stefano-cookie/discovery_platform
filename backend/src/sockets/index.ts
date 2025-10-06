import { Server as HTTPServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { authenticateSocket, cleanupRateLimit, AuthenticatedSocket } from './auth.middleware';
import { autoJoinRooms } from './rooms.manager';
import { setupNoticeEvents } from './events/notice.events';
import { SOCKET_EVENTS } from './types';

/**
 * Initialize Socket.IO server
 */
export const initializeSocketIO = (httpServer: HTTPServer): Server => {
  const socketOptions: Partial<ServerOptions> = {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Enable compression for better performance
    perMessageDeflate: {
      threshold: 1024, // Only compress messages > 1KB
    },
    // Connection timeout
    connectTimeout: 10000,
    // Ping/pong for connection health
    pingTimeout: 20000,
    pingInterval: 25000,
  };

  const io = new Server(httpServer, socketOptions);

  console.log('🔌 Socket.IO server initialized');
  console.log(`   CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

  // Apply authentication middleware
  io.use(authenticateSocket);

  // Connection event handler
  io.on(SOCKET_EVENTS.CONNECTION, async (socket: AuthenticatedSocket) => {
    console.log(`[WebSocket] Client connected: ${socket.id} (${socket.data.email})`);

    // Auto-join appropriate rooms
    await autoJoinRooms(socket);

    // Setup event handlers for different features
    setupNoticeEvents(io, socket);

    // TODO: Future event handlers
    // setupRegistrationEvents(io, socket);
    // setupNotificationEvents(io, socket);

    // Disconnect event
    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log(
        `[WebSocket] Client disconnected: ${socket.id} (${socket.data.email}) - Reason: ${reason}`
      );

      // Cleanup rate limiting data
      cleanupRateLimit(socket.id);
    });

    // Error handling
    socket.on(SOCKET_EVENTS.ERROR, (error) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });

    // Send welcome message
    socket.emit('welcome', {
      message: 'Connected to Discovery Platform WebSocket',
      userId: socket.data.userId,
      role: socket.data.role,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  io.engine.on('connection_error', (err) => {
    console.error('[WebSocket] Connection error:', {
      code: err.code,
      message: err.message,
      context: err.context,
    });
  });

  return io;
};

/**
 * Get Socket.IO instance
 * Use this to emit events from controllers
 */
let ioInstance: Server | null = null;

export const setSocketIOInstance = (io: Server): void => {
  ioInstance = io;
};

export const getSocketIO = (): Server => {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return ioInstance;
};

/**
 * Health check data for /api/health/websocket endpoint
 */
export const getWebSocketHealth = (io: Server) => {
  const sockets = io.sockets.sockets;
  const connectedUsers = new Map<string, { email: string; role: string }>();

  sockets.forEach((socket) => {
    const authSocket = socket as AuthenticatedSocket;
    if (authSocket.data) {
      connectedUsers.set(authSocket.data.userId, {
        email: authSocket.data.email,
        role: authSocket.data.role,
      });
    }
  });

  return {
    status: 'healthy',
    connections: {
      total: sockets.size,
      uniqueUsers: connectedUsers.size,
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
};
