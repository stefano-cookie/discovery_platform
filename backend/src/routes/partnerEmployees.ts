import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUnified, authenticatePartner, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get partner company stats
router.get('/stats', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Simple stats for now
    const totalRegistrations = await prisma.registration.count({
      where: { partnerCompanyId }
    });

    const activeRegistrations = await prisma.registration.count({
      where: { 
        partnerCompanyId,
        status: { in: ['ENROLLED', 'CONTRACT_SIGNED'] }
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRegistrations = await prisma.registration.count({
      where: {
        partnerCompanyId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    res.json({
      totalRegistrations,
      activeRegistrations,
      recentRegistrations,
      totalRevenue: 0 // Simplified for now
    });

  } catch (error) {
    console.error('Error getting partner stats:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner users - simplified
router.get('/users', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    const registrations = await prisma.registration.findMany({
      where: { partnerCompanyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit for performance
    });

    const users = registrations.map(reg => ({
      id: reg.user.id,
      email: reg.user.email,
      firstName: '',
      lastName: '', 
      phoneNumber: '',
      emailVerified: reg.user.emailVerified,
      registrationStatus: reg.status,
      registrationDate: reg.createdAt,
      finalAmount: Number(reg.finalAmount || 0)
    }));

    res.json({ users, total: users.length });

  } catch (error) {
    console.error('Error getting partner users:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner analytics - simplified
router.get('/analytics', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Status distribution
    const statusData = await prisma.registration.groupBy({
      by: ['status'],
      where: { partnerCompanyId },
      _count: { id: true }
    });

    res.json({
      monthlyRegistrations: [],
      statusDistribution: statusData,
      courseDistribution: { 'CERTIFICATION': 0, 'TFA': 0 }
    });

  } catch (error) {
    console.error('Error getting partner analytics:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get company hierarchy for ADMINISTRATIVE users
router.get('/companies/hierarchy', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Get employee with company info
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: {
        partnerCompany: true
      }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    let companies = [];
    
    // Only ADMINISTRATIVE users can see hierarchy
    if (employee.role === 'ADMINISTRATIVE') {
      // Get all child companies
      const getAllChildren = async (parentId: string): Promise<any[]> => {
        const children = await prisma.partnerCompany.findMany({
          where: { parentId },
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        });
        
        let allChildren = [...children];
        for (const child of children) {
          const grandChildren = await getAllChildren(child.id);
          allChildren = allChildren.concat(grandChildren);
        }
        
        return allChildren;
      };
      
      const childrenCompanies = await getAllChildren(employee.partnerCompanyId);
      
      companies = [
        {
          id: employee.partnerCompany.id,
          name: employee.partnerCompany.name,
          referralCode: employee.partnerCompany.referralCode
        },
        ...childrenCompanies
      ];
    } else {
      // COMMERCIAL users only see their own company
      companies = [{
        id: employee.partnerCompany.id,
        name: employee.partnerCompany.name,
        referralCode: employee.partnerCompany.referralCode
      }];
    }

    res.json({ companies });

  } catch (error) {
    console.error('Error getting company hierarchy:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ========================================
// PARTNER OFFERS MANAGEMENT
// ========================================

// Get partner offers
router.get('/offers', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Get employee with company info
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: {
        partnerCompany: true
      }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get offers for the partner company
    const offers = await prisma.partnerOffer.findMany({
      where: { partnerCompanyId: employee.partnerCompanyId },
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
    console.error('Error getting partner offers:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner offer
router.post('/offers', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Get employee with company info
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: {
        partnerCompany: true
      }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    const { courseId, name, offerType, totalAmount, installments, installmentFrequency, customPaymentPlan } = req.body;

    // Validation
    if (!courseId || !name || !offerType || !totalAmount || !installments || !installmentFrequency) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    if (!['TFA_ROMANIA', 'CERTIFICATION'].includes(offerType)) {
      return res.status(400).json({ error: 'Tipo offerta non valido' });
    }

    if (totalAmount <= 0 || installments <= 0 || installmentFrequency <= 0) {
      return res.status(400).json({ error: 'I valori di importo e rate devono essere positivi' });
    }

    // Generate unique referral link
    const generateReferralLink = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let referralLink = generateReferralLink();
    
    // Ensure uniqueness
    let existing = await prisma.partnerOffer.findUnique({ where: { referralLink } });
    while (existing) {
      referralLink = generateReferralLink();
      existing = await prisma.partnerOffer.findUnique({ where: { referralLink } });
    }

    const offer = await prisma.partnerOffer.create({
      data: {
        partnerId: legacyPartner.id,
        partnerCompanyId: employee.partnerCompanyId,
        courseId,
        name,
        offerType,
        totalAmount,
        installments,
        installmentFrequency,
        customPaymentPlan,
        referralLink,
        isActive: true
      },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      }
    });

    res.json(offer);

  } catch (error) {
    console.error('Error creating partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update partner offer
router.put('/offers/:id', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Get employee with company info
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: {
        partnerCompany: true
      }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    const { name, totalAmount, installments, installmentFrequency, customPaymentPlan } = req.body;

    // Update offer - only if it belongs to this partner
    const offer = await prisma.partnerOffer.updateMany({
      where: {
        id,
        partnerId: legacyPartner.id
      },
      data: {
        name,
        totalAmount,
        installments,
        installmentFrequency,
        customPaymentPlan
      }
    });

    if (offer.count === 0) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Get updated offer with includes
    const updatedOffer = await prisma.partnerOffer.findUnique({
      where: { id },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      }
    });

    res.json(updatedOffer);

  } catch (error) {
    console.error('Error updating partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete partner offer
router.delete('/offers/:id', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Get employee with company info
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: {
        partnerCompany: true
      }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    // Check if offer has registrations
    const offerWithRegistrations = await prisma.partnerOffer.findFirst({
      where: {
        id,
        partnerId: legacyPartner.id
      },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!offerWithRegistrations) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    if (offerWithRegistrations._count.registrations > 0) {
      return res.status(400).json({ error: 'Impossibile eliminare offerte con iscrizioni attive' });
    }

    // Delete offer
    await prisma.partnerOffer.delete({
      where: { id }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;