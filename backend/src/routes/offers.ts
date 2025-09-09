import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, AuthRequest } from '../middleware/auth';
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

// GET /api/offers - Get all offers for partner company
router.get('/', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    const offers = await prisma.partnerOffer.findMany({
      where: { partnerCompanyId },
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

// GET /api/offers/:id - Get specific offer (accessible to authenticateUnifiedd users)
router.get('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
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

    // Return simplified offer data for enrollment
    const simplifiedOffer = {
      id: offer.id,
      name: offer.name,
      offerType: offer.offerType,
      course: offer.course,
      totalAmount: offer.totalAmount,
      installments: offer.installments,
      referralLink: offer.referralLink
    };

    res.json({ offer: simplifiedOffer });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/offers - Create new offer
router.post('/', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const validatedData = validateCreateOffer(req.body);

    const partnerCompanyId = req.partnerCompany?.id;
    const partnerCompany = req.partnerCompany;

    if (!partnerCompanyId || !partnerCompany) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    // Generate unique referral link
    const referralLink = `${partnerCompany.referralCode}-${generateUniqueId(8)}`;

    // Find or create a legacy Partner record for backward compatibility
    let legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${partnerCompany.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      const dummyUserId = `dummy-user-for-partner-${partnerCompanyId}`;
      
      // Create a dummy user if it doesn't exist
      let dummyUser = await prisma.user.findUnique({
        where: { id: dummyUserId }
      });
      
      if (!dummyUser) {
        dummyUser = await prisma.user.create({
          data: {
            id: dummyUserId,
            email: `dummy-${partnerCompanyId}@legacy.system`,
            password: 'dummy-password-hash',
            role: 'PARTNER',
            isActive: false,
            emailVerified: false
          }
        });
      }
      
      // Create a legacy partner entry for backward compatibility
      legacyPartner = await prisma.partner.create({
        data: {
          id: `legacy-partner-${partnerCompanyId}`,
          userId: dummyUserId,
          referralCode: `${partnerCompany.referralCode}-LEGACY`,
          canCreateChildren: false,
          commissionPerUser: 0,
          commissionToAdmin: 0
        }
      });
    }

    const offer = await prisma.partnerOffer.create({
      data: {
        partnerId: legacyPartner.id, // For backward compatibility
        partnerCompanyId,
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
router.put('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerCompanyId: partnerCompanyId
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
router.delete('/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(404).json({ error: 'Partner company not found' });
    }

    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.id,
        partnerCompanyId: partnerCompanyId
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

    // Include all fields needed by the frontend, including customPaymentPlan
    const offerResponse = {
      ...offer,
      customPaymentPlan: offer.customPaymentPlan // Ensure this field is included
    };

    res.json(offerResponse);
  } catch (error) {
    console.error('Error fetching offer by link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;