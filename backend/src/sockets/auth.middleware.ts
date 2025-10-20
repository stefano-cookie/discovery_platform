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

    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    // Check token type: 'admin', 'partner', or standard user token
    if (decoded.type === 'admin') {
      // Admin Account token
      const adminAccount = await prisma.adminAccount.findUnique({
        where: { id: decoded.id },
        include: { user: true },
      });

      if (!adminAccount || !adminAccount.isActive) {
        return next(new Error('Admin account not found or inactive'));
      }

      if (!adminAccount.user || !adminAccount.user.isActive) {
        return next(new Error('Associated user account is inactive'));
      }

      // Attach admin data to socket
      const socketData: SocketData = {
        userId: adminAccount.userId,
        role: 'ADMIN',
        email: adminAccount.email,
        partnerId: undefined,
      };

      socket.data = socketData;

      console.log(
        `[WebSocket] Authenticated Admin: ${adminAccount.email} (${adminAccount.nome} ${adminAccount.cognome})`
      );

      return next();
    }

    if (decoded.type === 'partner') {
      // Partner Employee token
      const partnerEmployee = await prisma.partnerEmployee.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          partnerCompanyId: true,
        },
      });

      if (!partnerEmployee) {
        return next(new Error('Partner employee not found'));
      }

      if (!partnerEmployee.isActive) {
        return next(new Error('Partner account is inactive'));
      }

      // Attach partner data to socket
      const socketData: SocketData = {
        userId: partnerEmployee.id,
        role: 'PARTNER',
        email: partnerEmployee.email,
        partnerId: partnerEmployee.partnerCompanyId,
      };

      socket.data = socketData;

      console.log(
        `[WebSocket] Authenticated Partner: ${partnerEmployee.email} (${partnerEmployee.role}) - Company: ${partnerEmployee.partnerCompanyId}`
      );

      return next();
    }

    // Standard User token
    // Support both 'id' and 'userId' for backward compatibility
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return next(new Error('Invalid token format'));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      `[WebSocket] Authenticated User: ${user.email} (${user.role})${
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
