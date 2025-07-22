import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get partner stats
router.get('/stats', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get direct users count
    const directUsers = await prisma.registration.count({
      where: { partnerId }
    });

    // Get children partners users count
    const childrenPartners = await prisma.partner.findMany({
      where: { parentId: partnerId }
    });

    let childrenUsers = 0;
    for (const child of childrenPartners) {
      const count = await prisma.registration.count({
        where: { partnerId: child.id }
      });
      childrenUsers += count;
    }

    // Calculate monthly revenue (simplified)
    const monthlyRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        registration: { partnerId },
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    res.json({
      totalUsers: directUsers + childrenUsers,
      directUsers,
      childrenUsers,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      pendingCommissions: 0 // To be implemented
    });
  } catch (error) {
    console.error('Get partner stats error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner users
router.get('/users', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const filter = req.query.filter as string || 'all';
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    let whereClause: any = {};
    
    if (filter === 'direct') {
      whereClause = { partnerId };
    } else if (filter === 'children') {
      const childrenPartners = await prisma.partner.findMany({
        where: { parentId: partnerId },
        select: { id: true }
      });
      whereClause = { 
        partnerId: { in: childrenPartners.map((p: { id: string }) => p.id) } 
      };
    } else {
      // All users (direct + children)
      const childrenPartners = await prisma.partner.findMany({
        where: { parentId: partnerId },
        select: { id: true }
      });
      whereClause = { 
        partnerId: { in: [partnerId, ...childrenPartners.map((p: { id: string }) => p.id)] } 
      };
    }

    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        user: {
          include: { profile: true }
        },
        partner: {
          include: { user: true }
        }
      }
    });

    const users = registrations.map((reg: any) => ({
      id: reg.user.id,
      email: reg.user.email,
      profile: reg.user.profile,
      status: reg.status,
      course: 'Corso Default', // To be implemented with course relation
      isDirectUser: reg.partnerId === partnerId,
      partnerName: reg.partner.user.email,
      canManagePayments: true // To be implemented based on permissions
    }));

    res.json(users);
  } catch (error) {
    console.error('Get partner users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner coupons
router.get('/coupons', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const coupons = await prisma.coupon.findMany({
      where: { partnerId },
      include: {
        uses: true
      },
      orderBy: { validFrom: 'desc' }
    });

    res.json(coupons);
  } catch (error) {
    console.error('Get partner coupons error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner coupon
router.post('/coupons', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { code, discountType, discountAmount, discountPercent, maxUses, validFrom, validUntil } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Check if coupon code already exists for this partner
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        partnerId,
        code
      }
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Codice coupon già esistente' });
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        partnerId,
        code,
        discountType,
        discountAmount: discountAmount ? Number(discountAmount) : null,
        discountPercent: discountPercent ? Number(discountPercent) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil)
      }
    });

    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update coupon status
router.put('/coupons/:id/status', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Update coupon - only if it belongs to this partner
    const coupon = await prisma.coupon.updateMany({
      where: {
        id,
        partnerId
      },
      data: { isActive }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update coupon status error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete coupon
router.delete('/coupons/:id', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { id } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Check if coupon has been used
    const couponUse = await prisma.couponUse.findFirst({
      where: { couponId: id }
    });

    if (couponUse) {
      return res.status(400).json({ error: 'Impossibile eliminare un coupon già utilizzato' });
    }

    // Delete coupon - only if it belongs to this partner
    const coupon = await prisma.coupon.deleteMany({
      where: {
        id,
        partnerId
      }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Validate coupon code
router.post('/coupons/validate', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { code } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Find coupon
    const coupon = await prisma.coupon.findFirst({
      where: {
        code,
        partnerId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Codice sconto non valido o scaduto' });
    }

    // Check if max uses reached
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Codice sconto esaurito' });
    }

    // Check if coupon was already used
    const existingUse = await prisma.couponUse.findFirst({
      where: { couponId: coupon.id }
    });

    if (existingUse) {
      return res.status(400).json({ error: 'Codice sconto già utilizzato' });
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;