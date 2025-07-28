import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/offer-types - Get available offer types (courses) that can be offered
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    // Get all active courses
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // Transform courses to offer types with base pricing
    const offerTypes = courses.map(course => {
      // Determine base amount and type based on course name/id
      let baseAmount = 1000;
      let type: 'TFA_ROMANIA' | 'CERTIFICATION' = 'CERTIFICATION';
      
      if (course.name.toLowerCase().includes('tfa') || course.id.includes('tfa')) {
        type = 'TFA_ROMANIA';
        baseAmount = 3000;
      } else if (course.name.toLowerCase().includes('certificazione') || course.name.toLowerCase().includes('certification')) {
        type = 'CERTIFICATION';
        // Different base amounts for different certifications
        if (course.name.toLowerCase().includes('a2')) {
          baseAmount = 500;
        } else if (course.name.toLowerCase().includes('b1')) {
          baseAmount = 550;
        } else if (course.name.toLowerCase().includes('b2')) {
          baseAmount = 600;
        } else if (course.name.toLowerCase().includes('c1')) {
          baseAmount = 700;
        }
      }

      return {
        id: course.id,
        name: course.name,
        description: course.description || '',
        baseAmount,
        type
      };
    });

    res.json(offerTypes);
  } catch (error) {
    console.error('Error fetching offer types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/offer-types/:id - Get specific offer type details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id }
    });

    if (!course || !course.isActive) {
      return res.status(404).json({ error: 'Offer type not found' });
    }

    // Determine base amount and type
    let baseAmount = 1000;
    let type: 'TFA_ROMANIA' | 'CERTIFICATION' = 'CERTIFICATION';
    
    if (course.name.toLowerCase().includes('tfa') || course.id.includes('tfa')) {
      type = 'TFA_ROMANIA';
      baseAmount = 3000;
    } else if (course.name.toLowerCase().includes('certificazione') || course.name.toLowerCase().includes('certification')) {
      type = 'CERTIFICATION';
      if (course.name.toLowerCase().includes('a2')) {
        baseAmount = 500;
      } else if (course.name.toLowerCase().includes('b1')) {
        baseAmount = 550;
      } else if (course.name.toLowerCase().includes('b2')) {
        baseAmount = 600;
      } else if (course.name.toLowerCase().includes('c1')) {
        baseAmount = 700;
      }
    }

    res.json({
      id: course.id,
      name: course.name,
      description: course.description || '',
      baseAmount,
      type
    });
  } catch (error) {
    console.error('Error fetching offer type:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;