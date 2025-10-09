import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authenticateUnified, AuthRequest } from '../../middleware/auth';
import uploadRouter from './upload';
import { getSocketIO } from '../../sockets';
import {
  emitNoticeNew,
  emitNoticeUpdated,
  emitNoticeDeleted,
  emitNoticeAcknowledged,
} from '../../sockets/events/notice.events';

const router = Router();
const prisma = new PrismaClient();

// Mount upload routes
router.use('/upload', uploadRouter);

/**
 * GET /api/notices
 * Get all notices with read status for current user
 * Accessible by: ADMIN, PARTNER employees
 */
router.get('/', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    // Extract user info from authenticated request
    const currentUserId = req.user?.id || null;
    const currentPartnerEmployeeId = req.partnerEmployee?.id || null;
    const isAdmin = req.user?.role === 'ADMIN' || false;

    // Fetch all notices with their acknowledgements
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
          include: {
            user: {
              select: {
                id: true,
                role: true
              }
            }
          }
        }
      }
    });

    // Transform to include read status
    const noticesWithStatus = notices.map(notice => {
      // Find current user's acknowledgement
      const currentUserAck = notice.acknowledgements.find(ack =>
        currentUserId ? ack.userId === currentUserId : ack.partnerEmployeeId === currentPartnerEmployeeId
      );

      // Count only non-admin reads
      const totalReads = notice.acknowledgements.filter(ack =>
        !ack.user || ack.user.role !== 'ADMIN'
      ).length;

      return {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        contentHtml: notice.contentHtml,
        attachments: notice.attachments,
        priority: notice.priority,
        isPinned: notice.isPinned,
        publishedAt: notice.publishedAt,
        createdBy: notice.createdBy,
        createdAt: notice.createdAt,
        updatedAt: notice.updatedAt,
        creator: notice.creator,
        isRead: !!currentUserAck,
        readAt: currentUserAck?.readAt || null,
        totalReads
      };
    });

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
    console.log('POST /api/notices - User:', user ? { id: user.id, email: user.email, role: user.role } : 'No user');

    if (!user || user.role !== 'ADMIN') {
      console.log('POST /api/notices - Access denied. User role:', user?.role);
      return res.status(403).json({ error: 'Only admins can create notices' });
    }

    const { title, content, contentHtml, priority, isPinned, attachments } = req.body;
    console.log('POST /api/notices - Request body:', { title, content, contentHtml, priority, isPinned, attachments });

    if (!title || !content) {
      console.log('POST /api/notices - Missing title or content');
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        contentHtml: contentHtml || null,
        attachments: attachments || [],
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

    console.log('POST /api/notices - Notice created successfully:', notice.id);

    // Emit WebSocket event to all users
    try {
      const io = getSocketIO();
      emitNoticeNew(io, {
        id: notice.id,
        title: notice.title,
        content: notice.content,
        contentHtml: notice.contentHtml || undefined,
        priority: notice.priority,
        isPinned: notice.isPinned,
        publishedAt: notice.publishedAt.toISOString(),
        createdBy: notice.createdBy,
        attachments: notice.attachments as any[],
      });
      console.log('POST /api/notices - WebSocket event emitted');
    } catch (socketError) {
      console.error('POST /api/notices - Failed to emit WebSocket event:', socketError);
      // Don't fail the request if WebSocket fails
    }

    res.status(201).json({ notice });
  } catch (error: any) {
    console.error('Error creating notice:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create notice', details: error.message });
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

    // Emit WebSocket event
    try {
      const io = getSocketIO();
      emitNoticeUpdated(io, {
        id: notice.id,
        changes: {
          title: notice.title,
          content: notice.content,
          priority: notice.priority,
          isPinned: notice.isPinned,
        },
      });
      console.log('PATCH /api/notices/:id - WebSocket event emitted');
    } catch (socketError) {
      console.error('PATCH /api/notices/:id - Failed to emit WebSocket event:', socketError);
    }

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

    // Emit WebSocket event
    try {
      const io = getSocketIO();
      emitNoticeDeleted(io, { id });
      console.log('DELETE /api/notices/:id - WebSocket event emitted');
    } catch (socketError) {
      console.error('DELETE /api/notices/:id - Failed to emit WebSocket event:', socketError);
    }

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
router.post('/:id/acknowledge', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Extract user info from authenticated request
    const currentUserId = req.user?.id || null;
    const currentPartnerEmployeeId = req.partnerEmployee?.id || null;

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

    // Get total reads for this notice
    const totalReads = await prisma.noticeAcknowledgement.count({
      where: { noticeId: id },
    });

    // Emit WebSocket event to notify admins
    try {
      const io = getSocketIO();
      emitNoticeAcknowledged(io, {
        noticeId: id,
        userId: currentUserId || undefined,
        partnerEmployeeId: currentPartnerEmployeeId || undefined,
        readAt: acknowledgement.readAt.toISOString(),
        totalReads,
      });
      console.log('POST /api/notices/:id/acknowledge - WebSocket event emitted');
    } catch (socketError) {
      console.error('POST /api/notices/:id/acknowledge - Failed to emit WebSocket event:', socketError);
    }

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
      // Count only non-admin users
      prisma.user.count({
        where: {
          isActive: true,
          role: { not: 'ADMIN' }
        }
      }),
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
    // Count only reads from non-admin users and partner employees
    const totalReads = acknowledgements.filter(ack =>
      !ack.user || ack.user.role !== 'ADMIN'
    ).length;
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
