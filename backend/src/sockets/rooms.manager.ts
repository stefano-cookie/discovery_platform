import { AuthenticatedSocket } from './auth.middleware';
import { SOCKET_ROOMS } from './types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Auto-join user to appropriate rooms based on role
 */
export const autoJoinRooms = async (socket: AuthenticatedSocket): Promise<void> => {
  const { userId, role, partnerId } = socket.data;

  try {
    // All authenticated users join their personal room
    socket.join(SOCKET_ROOMS.USER(userId));
    console.log(`[Rooms] ${socket.data.email} joined: ${SOCKET_ROOMS.USER(userId)}`);

    // All users join global notices room
    socket.join(SOCKET_ROOMS.NOTICES_GLOBAL);
    console.log(`[Rooms] ${socket.data.email} joined: ${SOCKET_ROOMS.NOTICES_GLOBAL}`);

    // Role-specific room joins
    if (role === 'ADMIN') {
      socket.join(SOCKET_ROOMS.ADMIN_GLOBAL);
      console.log(`[Rooms] ${socket.data.email} joined: ${SOCKET_ROOMS.ADMIN_GLOBAL}`);
    }

    if (role === 'PARTNER' && partnerId) {
      socket.join(SOCKET_ROOMS.PARTNER(partnerId));
      console.log(`[Rooms] ${socket.data.email} joined: ${SOCKET_ROOMS.PARTNER(partnerId)}`);
    }

    // Join registration rooms for active registrations
    if (role === 'USER') {
      const registrations = await prisma.registration.findMany({
        where: {
          userId,
          // Get all registrations - user may need updates on any
        },
        select: { id: true },
      });

      for (const registration of registrations) {
        socket.join(SOCKET_ROOMS.REGISTRATION(registration.id));
        console.log(
          `[Rooms] ${socket.data.email} joined: ${SOCKET_ROOMS.REGISTRATION(registration.id)}`
        );
      }
    }

    // Admin joins all registration rooms (optional - can be performance issue)
    // if (role === 'ADMIN') {
    //   const allRegistrations = await prisma.registration.findMany({
    //     where: { status: { notIn: ['ARCHIVED'] } },
    //     select: { id: true },
    //   });
    //
    //   for (const registration of allRegistrations) {
    //     socket.join(SOCKET_ROOMS.REGISTRATION(registration.id));
    //   }
    // }
  } catch (error) {
    console.error(`[Rooms] Error auto-joining rooms for ${socket.data.email}:`, error);
  }
};

/**
 * Verify if user has permission to join a specific room
 */
export const canJoinRoom = (socket: AuthenticatedSocket, roomName: string): boolean => {
  const { userId, role, partnerId } = socket.data;

  // Admin can join any room
  if (role === 'ADMIN') {
    return true;
  }

  // User-specific room
  if (roomName === SOCKET_ROOMS.USER(userId)) {
    return true;
  }

  // Partner-specific room
  if (partnerId && roomName === SOCKET_ROOMS.PARTNER(partnerId)) {
    return true;
  }

  // Global notices room (everyone)
  if (roomName === SOCKET_ROOMS.NOTICES_GLOBAL) {
    return true;
  }

  // Registration room (need to verify ownership)
  if (roomName.startsWith('registration:')) {
    // This requires async check - better to handle in event handler
    console.warn(`[Rooms] Registration room join requires async verification: ${roomName}`);
    return false;
  }

  console.warn(
    `[Rooms] Unauthorized room join attempt by ${socket.data.email}: ${roomName}`
  );
  return false;
};

/**
 * Join registration room with ownership verification
 */
export const joinRegistrationRoom = async (
  socket: AuthenticatedSocket,
  registrationId: string
): Promise<boolean> => {
  const { userId, role } = socket.data;

  // Admin can join any registration room
  if (role === 'ADMIN') {
    socket.join(SOCKET_ROOMS.REGISTRATION(registrationId));
    console.log(
      `[Rooms] Admin ${socket.data.email} joined registration room: ${registrationId}`
    );
    return true;
  }

  // Verify user owns this registration
  const registration = await prisma.registration.findFirst({
    where: {
      id: registrationId,
      userId,
    },
  });

  if (!registration) {
    console.warn(
      `[Rooms] User ${socket.data.email} denied access to registration room: ${registrationId}`
    );
    return false;
  }

  socket.join(SOCKET_ROOMS.REGISTRATION(registrationId));
  console.log(
    `[Rooms] User ${socket.data.email} joined registration room: ${registrationId}`
  );
  return true;
};

/**
 * Get list of rooms a socket is currently in (excluding internal rooms)
 */
export const getSocketRooms = (socket: AuthenticatedSocket): string[] => {
  return Array.from(socket.rooms).filter((room) => room !== socket.id);
};

/**
 * Broadcast to specific room with logging
 */
export const broadcastToRoom = (
  socket: AuthenticatedSocket,
  room: string,
  event: string,
  data: any
): void => {
  socket.to(room).emit(event, data);
  console.log(`[Broadcast] Event "${event}" sent to room "${room}" by ${socket.data.email}`);
};
