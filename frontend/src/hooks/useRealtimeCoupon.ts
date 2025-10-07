import { useEffect, useState, useCallback } from 'react';
import { useSocketContext } from '../contexts/SocketContext';

export interface CouponUsedPayload {
  couponUseId: string;
  couponId: string;
  couponCode: string;
  discountApplied: number;
  discountType: string;
  usedCount: number;
  maxUses: number | null;
  isExhausted: boolean;
  registrationId: string;
  userId: string;
  userEmail: string;
  courseName: string;
  finalAmount: number;
  originalAmount: number;
  usedAt: string;
  timestamp: string;
  partnerName?: string; // Only for admin
}

export interface CouponStatsUpdatedPayload {
  couponId: string;
  couponCode: string;
  usedCount: number;
  maxUses: number | null;
  remainingUses: number | null;
  isExhausted: boolean;
  timestamp: string;
}

export interface CouponExpiredPayload {
  couponId: string;
  couponCode: string;
  reason: 'MAX_USES_REACHED' | 'DATE_EXPIRED';
  usedCount: number;
  maxUses: number | null;
  validUntil: string;
  timestamp: string;
  partnerName?: string; // Only for admin
}

export interface CouponCreatedPayload {
  couponId: string;
  couponCode: string;
  discountType: string;
  discountAmount: number | null;
  discountPercent: number | null;
  maxUses: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  timestamp: string;
  partnerName?: string; // Only for admin
}

interface UseRealtimeCouponResult {
  lastCouponUsed: CouponUsedPayload | null;
  lastStatsUpdate: CouponStatsUpdatedPayload | null;
  lastCouponExpired: CouponExpiredPayload | null;
  lastCouponCreated: CouponCreatedPayload | null;
  refreshTrigger: number; // Increment to trigger refresh in parent component
}

/**
 * Hook for real-time coupon events
 *
 * Usage in Partner Dashboard:
 * ```tsx
 * const { lastCouponUsed, lastStatsUpdate, lastCouponExpired, refreshTrigger } = useRealtimeCoupon(
 *   (payload) => {
 *     toast.success(`Coupon ${payload.couponCode} used by ${payload.userEmail}!`);
 *   },
 *   (payload) => {
 *     // Update coupon stats in UI
 *   },
 *   (payload) => {
 *     toast.warning(`Coupon ${payload.couponCode} has expired: ${payload.reason}`);
 *   }
 * );
 * ```
 */
export const useRealtimeCoupon = (
  onCouponUsed?: (payload: CouponUsedPayload) => void,
  onStatsUpdated?: (payload: CouponStatsUpdatedPayload) => void,
  onCouponExpired?: (payload: CouponExpiredPayload) => void,
  onCouponCreated?: (payload: CouponCreatedPayload) => void
): UseRealtimeCouponResult => {
  const { socket } = useSocketContext();

  const [lastCouponUsed, setLastCouponUsed] = useState<CouponUsedPayload | null>(null);
  const [lastStatsUpdate, setLastStatsUpdate] = useState<CouponStatsUpdatedPayload | null>(null);
  const [lastCouponExpired, setLastCouponExpired] = useState<CouponExpiredPayload | null>(null);
  const [lastCouponCreated, setLastCouponCreated] = useState<CouponCreatedPayload | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!socket) {
      console.log('[useRealtimeCoupon] Socket not connected');
      return;
    }

    console.log('[useRealtimeCoupon] Setting up coupon event listeners');

    // Handle coupon:used
    const handleCouponUsed = (payload: CouponUsedPayload) => {
      console.log('[useRealtimeCoupon] Coupon used:', payload);
      setLastCouponUsed(payload);
      triggerRefresh();
      onCouponUsed?.(payload);
    };

    // Handle coupon:stats_updated
    const handleStatsUpdated = (payload: CouponStatsUpdatedPayload) => {
      console.log('[useRealtimeCoupon] Stats updated:', payload);
      setLastStatsUpdate(payload);
      triggerRefresh();
      onStatsUpdated?.(payload);
    };

    // Handle coupon:expired
    const handleCouponExpired = (payload: CouponExpiredPayload) => {
      console.log('[useRealtimeCoupon] Coupon expired:', payload);
      setLastCouponExpired(payload);
      triggerRefresh();
      onCouponExpired?.(payload);
    };

    // Handle coupon:created (mainly for admin)
    const handleCouponCreated = (payload: CouponCreatedPayload) => {
      console.log('[useRealtimeCoupon] Coupon created:', payload);
      setLastCouponCreated(payload);
      triggerRefresh();
      onCouponCreated?.(payload);
    };

    // Register event listeners
    socket.on('coupon:used', handleCouponUsed);
    socket.on('coupon:stats_updated', handleStatsUpdated);
    socket.on('coupon:expired', handleCouponExpired);
    socket.on('coupon:created', handleCouponCreated);

    return () => {
      console.log('[useRealtimeCoupon] Cleaning up coupon event listeners');
      socket.off('coupon:used', handleCouponUsed);
      socket.off('coupon:stats_updated', handleStatsUpdated);
      socket.off('coupon:expired', handleCouponExpired);
      socket.off('coupon:created', handleCouponCreated);
    };
  }, [socket, onCouponUsed, onStatsUpdated, onCouponExpired, onCouponCreated, triggerRefresh]);

  return {
    lastCouponUsed,
    lastStatsUpdate,
    lastCouponExpired,
    lastCouponCreated,
    refreshTrigger,
  };
};
