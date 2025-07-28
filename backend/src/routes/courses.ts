import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/courses - Get all active courses (admin/partner only)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  // Only allow admin or partner access
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'PARTNER') {
    return res.status(403).json({ error: 'Access denied. Admin or Partner role required.' });
  }
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/courses/:id - Get specific course (admin/partner only)
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  // Only allow admin or partner access
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'PARTNER') {
    return res.status(403).json({ error: 'Access denied. Admin or Partner role required.' });
  }
  try {
    const course = await prisma.course.findUnique({
      where: { 
        id: req.params.id,
        isActive: true
      }
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;