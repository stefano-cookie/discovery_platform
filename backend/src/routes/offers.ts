import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateUniqueId } from '../utils/idGenerator';

const router = express.Router();
const prisma = new PrismaClient();

// Validation functions
function validateCreateOffer(data: any) {
  const required = ['courseId', 'name', 'offerType', 'totalAmount', 'installments', 'installmentFrequency'];
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Field ${field} is required`);
    }
  }
  
  if (!['TFA_ROMANIA', 'CERTIFICATION'].includes(data.offerType)) {
    throw new Error('Invalid offer type');
  }
  
  if (data.totalAmount <= 0 || data.installments <= 0 || data.installmentFrequency <= 0) {
    throw new Error('Amount and installment values must be positive');
  }
  
  return data;
}

// GET /api/offers - Get all offers for authenticated partner
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const offers = await prisma.partnerOffer.findMany({
      where: { partnerId: partner.id },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/offers/:id - Get specific offer
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerId: partner.id
      },
      include: {
        course: true,
        registrations: {
          include: {
            user: {
              select: {
                email: true,
                profile: {
                  select: {
                    nome: true,
                    cognome: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/offers - Create new offer
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const validatedData = validateCreateOffer(req.body);

    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Generate unique referral link
    const referralLink = `${partner.referralCode}-${generateUniqueId(8)}`;

    const offer = await prisma.partnerOffer.create({
      data: {
        partnerId: partner.id,
        courseId: validatedData.courseId,
        name: validatedData.name,
        offerType: validatedData.offerType,
        totalAmount: validatedData.totalAmount,
        installments: validatedData.installments,
        installmentFrequency: validatedData.installmentFrequency,
        customPaymentPlan: validatedData.customPaymentPlan,
        referralLink: referralLink
      },
      include: {
        course: true
      }
    });

    res.status(201).json(offer);
  } catch (error: any) {
    if (error.message.includes('Field') || error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/offers/:id - Update offer
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const updatedOffer = await prisma.partnerOffer.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        course: true
      }
    });

    res.json(updatedOffer);
  } catch (error: any) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/offers/:id - Delete offer
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Check if offer has registrations
    const registrationCount = await prisma.registration.count({
      where: { partnerOfferId: req.params.id }
    });

    if (registrationCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete offer with existing registrations' 
      });
    }

    await prisma.partnerOffer.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/offers/by-link/:referralLink - Get offer by referral link (public)
router.get('/by-link/:referralLink', async (req, res) => {
  try {
    const offer = await prisma.partnerOffer.findUnique({
      where: { 
        referralLink: req.params.referralLink,
        isActive: true
      },
      include: {
        course: true,
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json(offer);
  } catch (error) {
    console.error('Error fetching offer by link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;