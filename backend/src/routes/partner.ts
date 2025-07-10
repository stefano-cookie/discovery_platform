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
        partnerId: { in: childrenPartners.map(p => p.id) } 
      };
    } else {
      // All users (direct + children)
      const childrenPartners = await prisma.partner.findMany({
        where: { parentId: partnerId },
        select: { id: true }
      });
      whereClause = { 
        partnerId: { in: [partnerId, ...childrenPartners.map(p => p.id)] } 
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

    const users = registrations.map(reg => ({
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

export default router;