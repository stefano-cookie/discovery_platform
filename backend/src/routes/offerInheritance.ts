import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../middleware/auth';
import { OfferInheritanceService } from '../services/offerInheritanceService';

const router = Router();
const prisma = new PrismaClient();

// Generate inherited offers for a sub-partner
router.post('/generate/:childCompanyId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { childCompanyId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Verify that the requesting company is the parent of the child company
    const childCompany = await prisma.partnerCompany.findUnique({
      where: { id: childCompanyId },
      select: { parentId: true, name: true }
    });

    if (!childCompany) {
      return res.status(404).json({ error: 'Azienda figlia non trovata' });
    }

    if (childCompany.parentId !== partnerCompanyId) {
      return res.status(403).json({ error: 'Non autorizzato a generare offerte per questa azienda' });
    }

    // Generate inherited offers
    const inheritedCount = await OfferInheritanceService.createInheritedOffers(
      partnerCompanyId, 
      childCompanyId
    );

    res.json({ 
      success: true, 
      message: `Generati ${inheritedCount} offerte ereditate per ${childCompany.name}`,
      inheritedCount
    });

  } catch (error) {
    console.error('Generate inherited offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Sync all inherited offers for all sub-partners
router.post('/sync', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Check if company can create children (is premium)
    const parentCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { canCreateChildren: true, isPremium: true, name: true }
    });

    if (!parentCompany?.canCreateChildren && !parentCompany?.isPremium) {
      return res.status(403).json({ 
        error: 'Solo le aziende premium possono sincronizzare offerte per sub-partner' 
      });
    }

    await OfferInheritanceService.syncInheritedOffers(partnerCompanyId);

    res.json({ 
      success: true, 
      message: `Sincronizzazione offerte completata per ${parentCompany.name}`
    });

  } catch (error) {
    console.error('Sync inherited offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get all inherited offers for current company
router.get('/list', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    const inheritedOffers = await prisma.partnerOffer.findMany({
      where: {
        partnerCompanyId,
        isInherited: true,
        isActive: true
      },
      include: {
        course: {
          select: { name: true, templateType: true }
        },
        parentOffer: {
          select: { name: true }
        },
        partnerCompany: {
          select: { name: true, referralCode: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const parentOffers = await prisma.partnerOffer.findMany({
      where: {
        partnerCompanyId,
        isInherited: false,
        isActive: true
      },
      include: {
        course: {
          select: { name: true, templateType: true }
        },
        inheritedBy: {
          include: {
            partnerCompany: {
              select: { name: true, referralCode: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      inheritedOffers: inheritedOffers.map(offer => ({
        id: offer.id,
        name: offer.name,
        referralLink: offer.referralLink,
        parentOfferName: offer.parentOffer?.name,
        courseName: offer.course?.name,
        courseType: offer.course?.templateType,
        totalAmount: Number(offer.totalAmount),
        installments: offer.installments,
        createdAt: offer.createdAt
      })),
      parentOffers: parentOffers.map(offer => ({
        id: offer.id,
        name: offer.name,
        referralLink: offer.referralLink,
        courseName: offer.course?.name,
        courseType: offer.course?.templateType,
        totalAmount: Number(offer.totalAmount),
        installments: offer.installments,
        inheritedByCount: offer.inheritedBy.length,
        inheritedBy: offer.inheritedBy.map(inherited => ({
          companyName: inherited.partnerCompany?.name,
          companyCode: inherited.partnerCompany?.referralCode,
          referralLink: inherited.referralLink
        }))
      }))
    });

  } catch (error) {
    console.error('List inherited offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete inherited offer
router.delete('/:offerId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { offerId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Verify that the offer belongs to this company and is inherited
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        partnerCompanyId,
        isInherited: true
      }
    });

    if (!offer) {
      return res.status(404).json({ 
        error: 'Offerta ereditata non trovata o non autorizzata' 
      });
    }

    // Check if there are any active registrations using this offer
    const activeRegistrations = await prisma.registration.findMany({
      where: {
        partnerOfferId: offerId,
        status: {
          not: 'PENDING' // Use an existing status since CANCELLED doesn't exist
        }
      }
    });

    if (activeRegistrations.length > 0) {
      return res.status(400).json({
        error: `Impossibile eliminare l'offerta: ${activeRegistrations.length} registrazioni attive`
      });
    }

    // Soft delete by deactivating
    await prisma.partnerOffer.update({
      where: { id: offerId },
      data: { isActive: false }
    });

    res.json({ 
      success: true, 
      message: 'Offerta ereditata disattivata con successo'
    });

  } catch (error) {
    console.error('Delete inherited offer error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;