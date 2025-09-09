import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper function to get company IDs in hierarchy (current + descendants)
async function getCompanyHierarchyIds(companyId: string): Promise<string[]> {
  const getAllChildren = async (parentId: string): Promise<string[]> => {
    const children = await prisma.partnerCompany.findMany({
      where: { parentId },
      select: { id: true }
    });
    
    let allIds: string[] = [];
    for (const child of children) {
      allIds.push(child.id);
      const grandChildren = await getAllChildren(child.id);
      allIds = allIds.concat(grandChildren);
    }
    
    return allIds;
  };
  
  const childrenIds = await getAllChildren(companyId);
  return [companyId, ...childrenIds];
}

// Get partner coupons
router.get('/coupons', authenticatePartner, async (req: AuthRequest, res) => {
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

    // ADMINISTRATIVE can see all company hierarchy coupons, COMMERCIAL only own company
    let companyIds: string[];
    if (employee.role === 'ADMINISTRATIVE') {
      companyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);
    } else {
      companyIds = [employee.partnerCompanyId];
    }

    const coupons = await prisma.coupon.findMany({
      where: { 
        partnerCompanyId: { in: companyIds }
      },
      include: {
        uses: true,
        partnerCompany: {
          select: {
            name: true,
            referralCode: true
          }
        }
      },
      orderBy: { validFrom: 'desc' }
    });

    res.json(coupons);
  } catch (error) {
    console.error('Get partner coupons error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner coupon
router.post('/coupons', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { code, discountType, discountAmount, discountPercent, maxUses, validFrom, validUntil, targetCompanyId } = req.body;
    
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

    // Determine target company for coupon creation
    let companyId = employee.partnerCompanyId;
    
    // ADMINISTRATIVE can create coupons for child companies
    if (targetCompanyId && employee.role === 'ADMINISTRATIVE') {
      const hierarchyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);
      if (hierarchyIds.includes(targetCompanyId)) {
        companyId = targetCompanyId;
      } else {
        return res.status(403).json({ error: 'Non autorizzato a creare coupon per questa azienda' });
      }
    }

    // Check if coupon code already exists for this company hierarchy
    const hierarchyIds = await getCompanyHierarchyIds(companyId);
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        partnerCompanyId: { in: hierarchyIds },
        code
      }
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Codice coupon già esistente nella gerarchia aziendale' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        partnerId: legacyPartner.id, // Legacy compatibility
        partnerCompanyId: companyId,
        code,
        discountType,
        discountAmount: discountAmount ? Number(discountAmount) : null,
        discountPercent: discountPercent ? Number(discountPercent) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil)
      },
      include: {
        partnerCompany: {
          select: {
            name: true,
            referralCode: true
          }
        }
      }
    });

    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update coupon status
router.put('/coupons/:id/status', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    const { isActive } = req.body;
    
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

    // Get accessible company IDs based on role
    let companyIds: string[];
    if (employee.role === 'ADMINISTRATIVE') {
      companyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);
    } else {
      companyIds = [employee.partnerCompanyId];
    }

    // Update coupon - only if it belongs to accessible companies
    const coupon = await prisma.coupon.updateMany({
      where: {
        id,
        partnerCompanyId: { in: companyIds }
      },
      data: { isActive }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato o non autorizzato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update coupon status error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete coupon
router.delete('/coupons/:id', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Only ADMINISTRATIVE can delete coupons
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono eliminare coupon' });
    }

    // Get accessible company IDs
    const companyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);

    // Check if coupon has been used
    const couponUse = await prisma.couponUse.findFirst({
      where: { couponId: id }
    });

    if (couponUse) {
      return res.status(400).json({ error: 'Impossibile eliminare un coupon già utilizzato' });
    }

    // Delete coupon - only if it belongs to accessible companies
    const coupon = await prisma.coupon.deleteMany({
      where: {
        id,
        partnerCompanyId: { in: companyIds }
      }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato o non autorizzato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Validate coupon code
router.post('/coupons/validate', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { code } = req.body;
    
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

    // Get accessible company IDs based on role
    let companyIds: string[];
    if (employee.role === 'ADMINISTRATIVE') {
      companyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);
    } else {
      companyIds = [employee.partnerCompanyId];
    }

    // Find coupon
    const coupon = await prisma.coupon.findFirst({
      where: {
        code,
        partnerCompanyId: { in: companyIds },
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      },
      include: {
        partnerCompany: {
          select: {
            name: true,
            referralCode: true
          }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Codice sconto non valido o scaduto' });
    }

    // Check if max uses reached
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Codice sconto esaurito' });
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
        companyName: coupon.partnerCompany?.name
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get coupon usage logs with user details
router.get('/coupons/:couponId/usage-logs', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { couponId } = req.params;
    
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

    // Get accessible company IDs based on role
    let companyIds: string[];
    if (employee.role === 'ADMINISTRATIVE') {
      companyIds = await getCompanyHierarchyIds(employee.partnerCompanyId);
    } else {
      companyIds = [employee.partnerCompanyId];
    }

    // Verify coupon belongs to accessible companies
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        partnerCompanyId: { in: companyIds }
      },
      include: {
        partnerCompany: {
          select: {
            name: true,
            referralCode: true
          }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon non trovato o non autorizzato' });
    }

    // Get usage logs with user and registration details
    const usageLogs = await prisma.couponUse.findMany({
      where: { couponId: couponId },
      include: {
        registration: {
          include: {
            user: {
              include: {
                profile: {
                  select: {
                    nome: true,
                    cognome: true
                  }
                }
              }
            },
            offer: {
              select: {
                name: true
              }
            },
            partnerCompany: {
              select: {
                name: true,
                referralCode: true
              }
            }
          }
        }
      },
      orderBy: { usedAt: 'desc' }
    });

    // Transform data for frontend
    const formattedLogs = usageLogs.map(log => ({
      id: log.id,
      usedAt: log.usedAt,
      discountApplied: log.discountApplied,
      user: {
        email: log.registration.user.email,
        nome: log.registration.user.profile?.nome || 'N/A',
        cognome: log.registration.user.profile?.cognome || 'N/A'
      },
      registration: {
        id: log.registrationId,
        offerName: log.registration.offer?.name || 'Offerta diretta',
        partnerCompany: log.registration.partnerCompany?.name || 'N/A'
      }
    }));

    res.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        companyName: coupon.partnerCompany?.name
      },
      usageLogs: formattedLogs,
      totalUses: formattedLogs.length
    });
  } catch (error) {
    console.error('Get coupon usage logs error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;