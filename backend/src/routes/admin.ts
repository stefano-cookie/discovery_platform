import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check admin permissions
const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// GET /api/admin/users - Get all users with their assigned partners and registration counts
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'USER'
      },
      include: {
        profile: {
          select: {
            nome: true,
            cognome: true
          }
        },
        assignedPartner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format users for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      assignedPartnerId: user.assignedPartnerId,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        user: {
          email: user.assignedPartner.user.email
        }
      } : undefined,
      profile: user.profile,
      _count: user._count
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/partners - Get all partners
router.get('/partners', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const partners = await prisma.partner.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedPartners = partners.map(partner => ({
      id: partner.id,
      referralCode: partner.referralCode,
      user: {
        email: partner.user.email
      }
    }));

    res.json(formattedPartners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/user-transfers - Get all user transfers history
router.get('/user-transfers', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const transfers = await prisma.userTransfer.findMany({
      include: {
        fromPartner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        toPartner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        transferredAt: 'desc'
      }
    });

    // Get user info separately since UserTransfer doesn't have direct user relation
    const transfersWithUsers = await Promise.all(
      transfers.map(async (transfer) => {
        const user = await prisma.user.findUnique({
          where: { id: transfer.userId },
          select: {
            email: true,
            profile: {
              select: {
                nome: true,
                cognome: true
              }
            }
          }
        });

        return {
          id: transfer.id,
          userId: transfer.userId,
          fromPartnerId: transfer.fromPartnerId,
          toPartnerId: transfer.toPartnerId,
          reason: transfer.reason,
          transferredAt: transfer.transferredAt.toISOString(),
          transferredBy: transfer.transferredBy,
          user: user,
          fromPartner: transfer.fromPartner,
          toPartner: transfer.toPartner
        };
      })
    );

    res.json(transfersWithUsers);
  } catch (error) {
    console.error('Error fetching user transfers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/transfer-user - Transfer user between partners
router.post('/transfer-user', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId, toPartnerId, reason } = req.body;

    if (!userId || !toPartnerId || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, toPartnerId, reason' });
    }

    // Validate user exists and is a USER role
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'USER'
      },
      include: {
        assignedPartner: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.assignedPartnerId) {
      return res.status(400).json({ error: 'User is not assigned to any partner' });
    }

    // Validate new partner exists
    const newPartner = await prisma.partner.findUnique({
      where: { id: toPartnerId }
    });

    if (!newPartner) {
      return res.status(404).json({ error: 'Target partner not found' });
    }

    if (user.assignedPartnerId === toPartnerId) {
      return res.status(400).json({ error: 'User is already assigned to this partner' });
    }

    // Perform the transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create transfer record
      const transfer = await tx.userTransfer.create({
        data: {
          userId: userId,
          fromPartnerId: user.assignedPartnerId!,
          toPartnerId: toPartnerId,
          reason: reason,
          transferredBy: req.user!.email,
          transferredAt: new Date()
        }
      });

      // Update user's assigned partner
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { assignedPartnerId: toPartnerId }
      });

      // Update all user's registrations to the new partner
      await tx.registration.updateMany({
        where: { userId: userId },
        data: { partnerId: toPartnerId }
      });

      return { transfer, updatedUser };
    });

    res.json({
      message: 'User transferred successfully',
      transfer: result.transfer
    });
  } catch (error) {
    console.error('Error transferring user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;