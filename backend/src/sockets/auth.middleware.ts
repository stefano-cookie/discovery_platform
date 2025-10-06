import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { SocketData } from './types';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

/**
 * WebSocket Authentication Middleware
 * Validates JWT token and attaches user data to socket
 */
export const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    // Extract token from handshake auth
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid token'));
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        partner: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    if (!user.isActive) {
      return next(new Error('User account is inactive'));
    }

    // Attach user data to socket
    const socketData: SocketData = {
      userId: user.id,
      role: user.role,
      email: user.email,
      partnerId: user.partner?.id,
    };

    socket.data = socketData;

    console.log(
      `[WebSocket] Authenticated: ${user.email} (${user.role})${
        user.partner ? ` - Partner: ${user.partner.id}` : ''
      }`
    );

    next();
  } catch (error) {
    console.error('[WebSocket] Authentication error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid or expired token'));
    }

    return next(new Error('Authentication failed'));
  }
};

/**
 * Rate limiting helper
 * Tracks events per socket to prevent spam
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export const checkRateLimit = (
  socket: AuthenticatedSocket,
  maxEvents = 100,
  windowMs = 60000 // 1 minute
): boolean => {
  const socketId = socket.id;
  const now = Date.now();

  const existing = rateLimitMap.get(socketId);

  if (!existing || now > existing.resetAt) {
    // Reset or initialize
    rateLimitMap.set(socketId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (existing.count >= maxEvents) {
    console.warn(
      `[WebSocket] Rate limit exceeded for socket ${socketId} (user: ${socket.data.email})`
    );
    return false;
  }

  existing.count++;
  return true;
};

/**
 * Cleanup rate limit data on disconnect
 */
export const cleanupRateLimit = (socketId: string): void => {
  rateLimitMap.delete(socketId);
};
