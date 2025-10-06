import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/notices
 * Get all notices with read status for current user
 * Accessible by: ADMIN, PARTNER employees
 */
router.get('/', async (req, res) => {
  try {
    // Check auth from either User or PartnerEmployee
    const userAuth = req.headers.authorization;
    let currentUserId: string | null = null;
    let currentPartnerEmployeeId: string | null = null;
    let isAdmin = false;

    if (userAuth) {
      // Try User auth first
      try {
        const user = (req as any).user;
        if (user) {
          currentUserId = user.id;
          isAdmin = user.role === 'ADMIN';
        }
      } catch (e) {
        // If User auth fails, try PartnerEmployee
        const partnerEmployee = (req as any).partnerEmployee;
        if (partnerEmployee) {
          currentPartnerEmployeeId = partnerEmployee.id;
        }
      }
    }

    // Fetch all notices
    const notices = await prisma.notice.findMany({
      orderBy: [
        { isPinned: 'desc' },
        { publishedAt: 'desc' }
      ],
      include: {
        creator: {
          select: {
            id: true,
            email: true
          }
        },
        acknowledgements: {
          where: currentUserId
            ? { userId: currentUserId }
            : currentPartnerEmployeeId
            ? { partnerEmployeeId: currentPartnerEmployeeId }
            : undefined,
          select: {
            id: true,
            readAt: true
          }
        },
        _count: {
          select: {
            acknowledgements: true
          }
        }
      }
    });

    // Transform to include read status
    const noticesWithStatus = notices.map(notice => ({
      id: notice.id,
      title: notice.title,
      content: notice.content,
      priority: notice.priority,
      isPinned: notice.isPinned,
      publishedAt: notice.publishedAt,
      createdBy: notice.createdBy,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
      creator: notice.creator,
      isRead: notice.acknowledgements.length > 0,
      readAt: notice.acknowledgements[0]?.readAt || null,
      totalReads: notice._count.acknowledgements
    }));

    res.json({ notices: noticesWithStatus });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

/**
 * POST /api/notices
 * Create a new notice
 * Accessible by: ADMIN only
 */
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can create notices' });
    }

    const { title, content, priority, isPinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        priority: priority || 'NORMAL',
        isPinned: isPinned || false,
        createdBy: user.id
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({ notice });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

/**
 * PATCH /api/notices/:id
 * Update a notice
 * Accessible by: ADMIN only
 */
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can update notices' });
    }

    const { id } = req.params;
    const { title, content, priority, isPinned } = req.body;

    const notice = await prisma.notice.update({
      where: { id },
      data: {
        title,
        content,
        priority,
        isPinned,
        updatedAt: new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.json({ notice });
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({ error: 'Failed to update notice' });
  }
});

/**
 * DELETE /api/notices/:id
 * Delete a notice
 * Accessible by: ADMIN only
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can delete notices' });
    }

    const { id } = req.params;

    await prisma.notice.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({ error: 'Failed to delete notice' });
  }
});

/**
 * POST /api/notices/:id/acknowledge
 * Mark a notice as read
 * Accessible by: All authenticated users (ADMIN, USER, PARTNER employees)
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    // Determine user type and ID
    const userAuth = req.headers.authorization;
    let currentUserId: string | null = null;
    let currentPartnerEmployeeId: string | null = null;

    if (userAuth) {
      try {
        const user = (req as any).user;
        if (user) {
          currentUserId = user.id;
        }
      } catch (e) {
        const partnerEmployee = (req as any).partnerEmployee;
        if (partnerEmployee) {
          currentPartnerEmployeeId = partnerEmployee.id;
        }
      }
    }

    if (!currentUserId && !currentPartnerEmployeeId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if already acknowledged
    const existing = await prisma.noticeAcknowledgement.findFirst({
      where: {
        noticeId: id,
        ...(currentUserId ? { userId: currentUserId } : { partnerEmployeeId: currentPartnerEmployeeId })
      }
    });

    if (existing) {
      return res.json({ acknowledgement: existing });
    }

    // Create acknowledgement
    const acknowledgement = await prisma.noticeAcknowledgement.create({
      data: {
        noticeId: id,
        userId: currentUserId,
        partnerEmployeeId: currentPartnerEmployeeId
      }
    });

    res.status(201).json({ acknowledgement });
  } catch (error) {
    console.error('Error acknowledging notice:', error);
    res.status(500).json({ error: 'Failed to acknowledge notice' });
  }
});

/**
 * GET /api/notices/:id/stats
 * Get read statistics for a notice
 * Accessible by: ADMIN only
 */
router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can view stats' });
    }

    const { id } = req.params;

    const [notice, totalUsers, totalPartners, acknowledgements] = await Promise.all([
      prisma.notice.findUnique({ where: { id } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.partnerEmployee.count({ where: { isActive: true } }),
      prisma.noticeAcknowledgement.findMany({
        where: { noticeId: id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          },
          partnerEmployee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      })
    ]);

    const totalStaff = totalUsers + totalPartners;
    const totalReads = acknowledgements.length;
    const readPercentage = totalStaff > 0 ? Math.round((totalReads / totalStaff) * 100) : 0;

    res.json({
      notice,
      stats: {
        totalStaff,
        totalReads,
        readPercentage,
        acknowledgements
      }
    });
  } catch (error) {
    console.error('Error fetching notice stats:', error);
    res.status(500).json({ error: 'Failed to fetch notice stats' });
  }
});

export default router;
