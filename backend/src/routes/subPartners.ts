import { Router, Request, Response } from 'express';
import { PrismaClient, PartnerEmployeeRole, CompanyInviteStatus } from '@prisma/client';
import { authenticatePartner } from '../middleware/auth';
import crypto from 'crypto';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// Middleware per verificare che l'utente sia un partner con permessi amministrativi
const requireAdminPartner = async (req: any, res: Response, next: any) => {
  try {
    if (!req.partnerEmployee || req.partnerEmployee.role !== PartnerEmployeeRole.ADMINISTRATIVE) {
      return res.status(403).json({ error: 'Administrative access required' });
    }

    next();
  } catch (error) {
    console.error('Admin partner middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware per verificare che l'azienda sia premium
const requirePremiumCompany = async (req: any, res: Response, next: any) => {
  try {
    if (!req.partnerEmployee?.partnerCompany.isPremium) {
      return res.status(403).json({ 
        error: 'Premium account required to manage sub-partners',
        isPremium: false 
      });
    }
    next();
  } catch (error) {
    console.error('Premium company middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/sub-partners - Lista delle aziende figlie
router.get('/', authenticatePartner, requireAdminPartner, async (req: any, res: Response) => {
  try {
    const companyId = req.partnerEmployee.partnerCompanyId;
    
    const children = await prisma.partnerCompany.findMany({
      where: { parentId: companyId },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isOwner: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            registrations: true,
            sourceRegistrations: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Per ogni sub-partner, conta le registrazioni che porta al partner padre
    const childrenWithStats = await Promise.all(children.map(async (child) => {
      // Conta le registrazioni dove questo sub-partner è la fonte
      // (registrazioni gestite dal parent ma generate dal sub-partner)
      const registrationsBroughtToParent = await prisma.registration.count({
        where: {
          sourcePartnerCompanyId: child.id,
          partnerCompanyId: companyId // Gestite dal parent
        }
      });

      return {
        ...child,
        stats: {
          // Il conteggio principale deve essere quello delle iscrizioni portate al parent
          totalRegistrations: registrationsBroughtToParent,
          // Mantieni anche il conteggio delle registrazioni dirette per completezza
          directRegistrations: child._count.registrations,
          indirectRegistrations: child._count.sourceRegistrations,
          employeeCount: child.employees.length
        }
      };
    }));

    res.json({
      success: true,
      data: childrenWithStats
    });

  } catch (error) {
    console.error('Get sub-partners error:', error);
    res.status(500).json({ error: 'Failed to fetch sub-partners' });
  }
});

// POST /api/sub-partners/invite - Invita una nuova azienda figlia
router.post('/invite', authenticatePartner, requireAdminPartner, requirePremiumCompany, async (req: any, res: Response) => {
  try {
    const { email, companyName } = req.body;
    const parentCompanyId = req.partnerEmployee.partnerCompanyId;
    const invitedBy = req.partnerEmployee.id;

    if (!email || !companyName) {
      return res.status(400).json({ error: 'Email and company name are required' });
    }

    // Verifica che l'email non sia già in uso
    const existingEmployee = await prisma.partnerEmployee.findUnique({
      where: { email }
    });

    if (existingEmployee) {
      return res.status(400).json({ error: 'Email already registered as partner employee' });
    }

    // Verifica inviti pendenti
    const existingInvite = await prisma.partnerCompanyInvite.findFirst({
      where: {
        email,
        parentCompanyId,
        status: CompanyInviteStatus.PENDING,
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'Pending invitation already exists for this email' });
    }

    // Genera token sicuro
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Scade dopo 7 giorni

    // Crea l'invito
    const invite = await prisma.partnerCompanyInvite.create({
      data: {
        parentCompanyId,
        inviteToken,
        email,
        companyName,
        invitedBy,
        expiresAt,
        status: CompanyInviteStatus.PENDING
      },
      include: {
        parentCompany: {
          select: { name: true }
        }
      }
    });

    // Invia email di invito
    const inviteUrl = `${process.env.FRONTEND_URL}/accept-company-invite/${inviteToken}`;
    
    await emailService.sendEmail({
      to: email,
      subject: `Invito per creare azienda partner: ${companyName}`,
      template: 'companyInvite',
      data: {
        companyName,
        parentCompanyName: invite.parentCompany.name,
        inviteUrl,
        expiresAt: expiresAt.toLocaleDateString('it-IT')
      }
    });

    res.json({
      success: true,
      message: 'Company invitation sent successfully',
      data: {
        id: invite.id,
        email: invite.email,
        companyName: invite.companyName,
        expiresAt: invite.expiresAt
      }
    });

  } catch (error) {
    console.error('Send company invite error:', error);
    res.status(500).json({ error: 'Failed to send company invitation' });
  }
});

// GET /api/sub-partners/invites - Lista inviti aziende
router.get('/invites', authenticatePartner, requireAdminPartner, async (req: any, res: Response) => {
  try {
    const parentCompanyId = req.partnerEmployee.partnerCompanyId;
    
    const invites = await prisma.partnerCompanyInvite.findMany({
      where: { parentCompanyId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: invites
    });

  } catch (error) {
    console.error('Get company invites error:', error);
    res.status(500).json({ error: 'Failed to fetch company invites' });
  }
});

// DELETE /api/sub-partners/invites/:inviteId - Revoca invito azienda
router.delete('/invites/:inviteId', authenticatePartner, requireAdminPartner, async (req: any, res: Response) => {
  try {
    const { inviteId } = req.params;
    const parentCompanyId = req.partnerEmployee.partnerCompanyId;

    const invite = await prisma.partnerCompanyInvite.findFirst({
      where: {
        id: inviteId,
        parentCompanyId,
        status: CompanyInviteStatus.PENDING
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    await prisma.partnerCompanyInvite.update({
      where: { id: inviteId },
      data: {
        status: CompanyInviteStatus.REVOKED,
        isActive: false
      }
    });

    res.json({
      success: true,
      message: 'Company invitation revoked successfully'
    });

  } catch (error) {
    console.error('Revoke company invite error:', error);
    res.status(500).json({ error: 'Failed to revoke company invitation' });
  }
});

// POST /api/sub-partners/accept-invite/:token - Accetta invito e crea azienda figlia
router.post('/accept-invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { 
      firstName, 
      lastName, 
      password,
      referralCode // Codice referral per la nuova azienda
    } = req.body;

    if (!firstName || !lastName || !password || !referralCode) {
      return res.status(400).json({ 
        error: 'First name, last name, password and referral code are required' 
      });
    }

    // Trova l'invito
    const invite = await prisma.partnerCompanyInvite.findFirst({
      where: {
        inviteToken: token,
        status: CompanyInviteStatus.PENDING,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      include: {
        parentCompany: true
      }
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Verifica che il codice referral sia univoco
    const existingCode = await prisma.partnerCompany.findUnique({
      where: { referralCode }
    });

    if (existingCode) {
      return res.status(400).json({ error: 'Referral code already in use' });
    }

    // Verifica che l'email non sia già in uso
    const existingEmployee = await prisma.partnerEmployee.findUnique({
      where: { email: invite.email }
    });

    if (existingEmployee) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Transazione per creare azienda figlia e amministratore
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crea l'azienda figlia
      const childCompany = await tx.partnerCompany.create({
        data: {
          name: invite.companyName,
          referralCode,
          parentId: invite.parentCompanyId,
          hierarchyLevel: invite.parentCompany.hierarchyLevel + 1,
          canCreateChildren: false, // Le aziende figlie non possono creare altre aziende
          isPremium: false,
          isActive: true
        }
      });

      // 2. Crea l'amministratore della nuova azienda
      const adminEmployee = await tx.partnerEmployee.create({
        data: {
          partnerCompanyId: childCompany.id,
          email: invite.email,
          password: hashedPassword,
          firstName,
          lastName,
          role: PartnerEmployeeRole.ADMINISTRATIVE,
          isOwner: true,
          isActive: true,
          acceptedAt: new Date()
        }
      });

      // 3. Marca l'invito come accettato
      await tx.partnerCompanyInvite.update({
        where: { id: invite.id },
        data: {
          status: CompanyInviteStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedBy: adminEmployee.id
        }
      });

      return { childCompany, adminEmployee };
    });

    // Invia email di benvenuto
    await emailService.sendEmail({
      to: invite.email,
      subject: `Benvenuto in Discovery Platform - ${invite.companyName}`,
      template: 'subPartnerWelcome',
      data: {
        firstName,
        companyName: invite.companyName,
        parentCompanyName: invite.parentCompany.name,
        loginUrl: `${process.env.FRONTEND_URL}/partner-login`
      }
    });

    // Notifica il parent company
    await emailService.sendEmail({
      to: 'admin@discovery.com', // o recupera l'email dell'admin del parent
      subject: `Nuova azienda figlia creata: ${invite.companyName}`,
      template: 'parentNotification',
      data: {
        childCompanyName: invite.companyName,
        parentCompanyName: invite.parentCompany.name,
        adminName: `${firstName} ${lastName}`,
        adminEmail: invite.email
      }
    });

    res.json({
      success: true,
      message: 'Sub-partner company created successfully',
      data: {
        companyId: result.childCompany.id,
        companyName: result.childCompany.name,
        referralCode: result.childCompany.referralCode
      }
    });

  } catch (error) {
    console.error('Accept company invite error:', error);
    res.status(500).json({ error: 'Failed to accept company invitation' });
  }
});

// GET /api/sub-partners/analytics - Analytics aggregate per premium companies
router.get('/analytics', authenticatePartner, requireAdminPartner, requirePremiumCompany, async (req: any, res: Response) => {
  try {
    const companyId = req.partnerEmployee.partnerCompanyId;
    
    // Ottieni tutte le aziende figlie
    const children = await prisma.partnerCompany.findMany({
      where: { parentId: companyId },
      select: { id: true }
    });

    const childrenIds = children.map(c => c.id);
    const allCompanyIds = [companyId, ...childrenIds];

    // Analytics aggregate
    const [
      directRegistrations,
      indirectRegistrations,
      totalRevenue,
      monthlyStats
    ] = await Promise.all([
      // Registrazioni dirette (parent company)
      prisma.registration.count({
        where: {
          partnerCompanyId: companyId,
          isDirectRegistration: true
        }
      }),
      // Registrazioni indirette (dalle aziende figlie)
      prisma.registration.count({
        where: {
          sourcePartnerCompanyId: { in: childrenIds },
          isDirectRegistration: false
        }
      }),
      // Revenue totale (parent + children)
      prisma.registration.aggregate({
        where: {
          partnerCompanyId: { in: allCompanyIds }
        },
        _sum: { finalAmount: true }
      }),
      // Statistiche mensili ultimi 6 mesi
      prisma.registration.groupBy({
        by: ['createdAt'],
        where: {
          partnerCompanyId: { in: allCompanyIds },
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        },
        _count: true,
        _sum: { finalAmount: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalSubPartners: children.length,
          directRegistrations,
          indirectRegistrations,
          totalRegistrations: directRegistrations + indirectRegistrations,
          totalRevenue: totalRevenue._sum.finalAmount || 0
        },
        monthlyStats: monthlyStats.map(stat => ({
          month: new Date(stat.createdAt).toISOString().substring(0, 7),
          registrations: stat._count,
          revenue: stat._sum.finalAmount || 0
        }))
      }
    });

  } catch (error) {
    console.error('Get sub-partner analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// PUT /api/sub-partners/:companyId/status - Attiva/disattiva azienda figlia
router.put('/:companyId/status', authenticatePartner, requireAdminPartner, requirePremiumCompany, async (req: any, res: Response) => {
  try {
    const { companyId } = req.params;
    const { isActive } = req.body;
    const parentCompanyId = req.partnerEmployee.partnerCompanyId;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    // Verifica che l'azienda sia effettivamente figlia
    const childCompany = await prisma.partnerCompany.findFirst({
      where: {
        id: companyId,
        parentId: parentCompanyId
      }
    });

    if (!childCompany) {
      return res.status(404).json({ error: 'Sub-partner company not found' });
    }

    // Aggiorna lo stato
    await prisma.partnerCompany.update({
      where: { id: companyId },
      data: { isActive }
    });

    res.json({
      success: true,
      message: `Sub-partner company ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Update sub-partner status error:', error);
    res.status(500).json({ error: 'Failed to update sub-partner status' });
  }
});

export default router;