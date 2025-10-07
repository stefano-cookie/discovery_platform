import { Server } from 'socket.io';
import { AuthenticatedSocket } from '../auth.middleware';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '../types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Setup coupon-related WebSocket events
 */
export const setupCouponEvents = (io: Server, socket: AuthenticatedSocket): void => {
  // No client-initiated events yet, just server broadcasts
  console.log(`[Coupon Events] Handler registered for ${socket.data.email}`);
};

/**
 * Broadcast coupon usage
 * Call this when a user successfully uses a coupon during registration
 */
export const broadcastCouponUsed = async (
  io: Server,
  couponUseId: string
): Promise<void> => {
  try {
    const couponUse = await prisma.couponUse.findUnique({
      where: { id: couponUseId },
      include: {
        coupon: {
          include: {
            partner: true,
            partnerCompany: true,
          },
        },
        registration: true,
      },
    });

    if (!couponUse) {
      console.error(`[Coupon Events] CouponUse not found: ${couponUseId}`);
      return;
    }

    const { coupon, registration } = couponUse;

    // Fetch user and course separately
    const [user, course] = await Promise.all([
      prisma.user.findUnique({
        where: { id: registration.userId },
        select: { id: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: registration.courseId },
        select: { name: true },
      }),
    ]);

    if (!user || !course) {
      console.error(`[Coupon Events] Missing user or course for coupon use: ${couponUseId}`);
      return;
    }

    const payload = {
      couponUseId,
      couponId: coupon.id,
      couponCode: coupon.code,
      discountApplied: Number(couponUse.discountApplied),
      discountType: coupon.discountType,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      isExhausted: coupon.maxUses ? coupon.usedCount >= coupon.maxUses : false,
      registrationId: registration.id,
      userId: user.id,
      userEmail: user.email,
      courseName: course.name,
      finalAmount: Number(registration.finalAmount),
      originalAmount: Number(registration.originalAmount || 0),
      usedAt: couponUse.usedAt.toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Emit to partner who owns the coupon
    const partnerId = coupon.partnerCompanyId || coupon.partnerId;
    if (partnerId) {
      io.to(SOCKET_ROOMS.PARTNER(partnerId)).emit(SOCKET_EVENTS.COUPON_USED, payload);

      // If sub-partner (partnerCompany with parent), also notify parent
      if (coupon.partnerCompany?.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(coupon.partnerCompany.parentId)).emit(
          SOCKET_EVENTS.COUPON_USED,
          payload
        );
      }
    }

    // Emit to admin
    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.COUPON_USED, {
      ...payload,
      partnerName: coupon.partnerCompany?.name || 'Unknown',
    });

    // Emit stats update to partner dashboard
    const statsPayload = {
      couponId: coupon.id,
      couponCode: coupon.code,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      remainingUses: coupon.maxUses ? coupon.maxUses - coupon.usedCount : null,
      isExhausted: coupon.maxUses ? coupon.usedCount >= coupon.maxUses : false,
      timestamp: new Date().toISOString(),
    };

    if (partnerId) {
      io.to(SOCKET_ROOMS.PARTNER(partnerId)).emit(
        SOCKET_EVENTS.COUPON_STATS_UPDATED,
        statsPayload
      );

      if (coupon.partnerCompany?.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(coupon.partnerCompany.parentId)).emit(
          SOCKET_EVENTS.COUPON_STATS_UPDATED,
          statsPayload
        );
      }
    }

    console.log(`[Coupon Events] Coupon used broadcast: ${coupon.code} (${coupon.usedCount}/${coupon.maxUses || '∞'})`);
  } catch (error) {
    console.error('[Coupon Events] Error broadcasting coupon usage:', error);
  }
};

/**
 * Broadcast coupon expiration
 * Call this when a coupon reaches maxUses or expires by date
 */
export const broadcastCouponExpired = async (
  io: Server,
  couponId: string,
  reason: 'MAX_USES_REACHED' | 'DATE_EXPIRED'
): Promise<void> => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        partner: true,
        partnerCompany: true,
      },
    });

    if (!coupon) {
      console.error(`[Coupon Events] Coupon not found: ${couponId}`);
      return;
    }

    const payload = {
      couponId: coupon.id,
      couponCode: coupon.code,
      reason,
      usedCount: coupon.usedCount,
      maxUses: coupon.maxUses,
      validUntil: coupon.validUntil.toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Emit to partner
    const partnerId = coupon.partnerCompanyId || coupon.partnerId;
    if (partnerId) {
      io.to(SOCKET_ROOMS.PARTNER(partnerId)).emit(SOCKET_EVENTS.COUPON_EXPIRED, payload);

      // Parent partner if exists
      if (coupon.partnerCompany?.parentId) {
        io.to(SOCKET_ROOMS.PARTNER(coupon.partnerCompany.parentId)).emit(
          SOCKET_EVENTS.COUPON_EXPIRED,
          payload
        );
      }
    }

    // Emit to admin
    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.COUPON_EXPIRED, {
      ...payload,
      partnerName: coupon.partnerCompany?.name || 'Unknown',
    });

    console.log(`[Coupon Events] Coupon expired broadcast: ${coupon.code} (${reason})`);
  } catch (error) {
    console.error('[Coupon Events] Error broadcasting coupon expiration:', error);
  }
};

/**
 * Broadcast coupon created
 * Call this when a partner creates a new coupon
 */
export const broadcastCouponCreated = async (
  io: Server,
  couponId: string
): Promise<void> => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        partner: true,
        partnerCompany: true,
      },
    });

    if (!coupon) {
      console.error(`[Coupon Events] Coupon not found: ${couponId}`);
      return;
    }

    const payload = {
      couponId: coupon.id,
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountAmount: coupon.discountAmount ? Number(coupon.discountAmount) : null,
      discountPercent: coupon.discountPercent ? Number(coupon.discountPercent) : null,
      maxUses: coupon.maxUses,
      validFrom: coupon.validFrom.toISOString(),
      validUntil: coupon.validUntil.toISOString(),
      isActive: coupon.isActive,
      timestamp: new Date().toISOString(),
    };

    // Emit to admin (for monitoring)
    io.to(SOCKET_ROOMS.ADMIN_GLOBAL).emit(SOCKET_EVENTS.COUPON_CREATED, {
      ...payload,
      partnerName: coupon.partnerCompany?.name || 'Unknown',
    });

    console.log(`[Coupon Events] Coupon created broadcast: ${coupon.code}`);
  } catch (error) {
    console.error('[Coupon Events] Error broadcasting coupon creation:', error);
  }
};
