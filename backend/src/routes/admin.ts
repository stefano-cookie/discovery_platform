import express from 'express';
import { PrismaClient, CommissionType, Prisma } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// ========================================
// MIDDLEWARE: Require Admin Role
// ========================================
const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access denied. Admin role required.',
      requiredRole: 'ADMIN',
      currentRole: req.user?.role || 'none'
    });
  }
  next();
};

// ========================================
// DASHBOARD STATS
// ========================================

/**
 * GET /api/admin/dashboard/stats
 * Statistiche globali piattaforma per dashboard Discovery
 */
router.get('/dashboard/stats', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Fetch dati in parallelo per performance
    const [
      totalCompanies,
      activeCompanies,
      totalRegistrations,
      totalUsers,
      revenueData,
      recentRegistrations
    ] = await Promise.all([
      // Totale company
      prisma.partnerCompany.count(),

      // Company attive
      prisma.partnerCompany.count({
        where: { isActive: true }
      }),

      // Totale iscrizioni
      prisma.registration.count(),

      // Totale utenti (role USER)
      prisma.user.count({
        where: { role: 'USER' }
      }),

      // Calcolo revenue totale e commissioni Discovery
      prisma.registration.aggregate({
        _sum: {
          finalAmount: true,
          discoveryCommission: true,
          companyEarnings: true
        }
      }),

      // Iscrizioni recenti (ultimi 7 giorni)
      prisma.registration.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Top 5 company per revenue
    const topCompanies = await prisma.partnerCompany.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        referralCode: true,
        totalEarnings: true,
        discoveryTotalCommissions: true,
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: {
        totalEarnings: 'desc'
      },
      take: 5
    });

    // Breakdown per tipo corso
    const courseBreakdown = await prisma.registration.groupBy({
      by: ['offerType'],
      _count: {
        id: true
      },
      _sum: {
        finalAmount: true,
        discoveryCommission: true
      }
    });

    res.json({
      summary: {
        totalCompanies,
        activeCompanies,
        totalRegistrations,
        totalUsers,
        totalRevenue: Number(revenueData._sum.finalAmount || 0),
        totalDiscoveryCommissions: Number(revenueData._sum.discoveryCommission || 0),
        totalCompanyEarnings: Number(revenueData._sum.companyEarnings || 0),
        recentRegistrations
      },
      topCompanies: topCompanies.map(c => ({
        ...c,
        totalEarnings: Number(c.totalEarnings),
        discoveryTotalCommissions: Number(c.discoveryTotalCommissions),
        registrationCount: c._count.registrations
      })),
      courseBreakdown: courseBreakdown.map(cb => ({
        offerType: cb.offerType,
        count: cb._count.id,
        totalRevenue: Number(cb._sum.finalAmount || 0),
        discoveryCommissions: Number(cb._sum.discoveryCommission || 0)
      }))
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// COMPANY MANAGEMENT
// ========================================

/**
 * GET /api/admin/companies
 * Lista tutte le company con statistiche
 */
router.get('/companies', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const companies = await prisma.partnerCompany.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            registrations: true,
            children: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedCompanies = companies.map(company => ({
      id: company.id,
      name: company.name,
      referralCode: company.referralCode,
      isActive: company.isActive,
      isPremium: company.isPremium,
      canCreateChildren: company.canCreateChildren,
      hierarchyLevel: company.hierarchyLevel,

      // Commissioni Discovery
      discoveryCommissionType: company.discoveryCommissionType,
      discoveryCommissionValue: company.discoveryCommissionValue ? Number(company.discoveryCommissionValue) : null,
      discoveryTotalCommissions: Number(company.discoveryTotalCommissions),

      // Business metrics
      totalEarnings: Number(company.totalEarnings),
      commissionPerUser: Number(company.commissionPerUser),

      // Counts
      employeesCount: company._count.employees,
      registrationsCount: company._count.registrations,
      subPartnersCount: company._count.children,

      // Relations
      parent: company.parent,

      // Timestamps
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString()
    }));

    res.json(formattedCompanies);

  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/companies/:id
 * Dettaglio company singola con revenue breakdown
 */
router.get('/companies/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.partnerCompany.findUnique({
      where: { id },
      include: {
        employees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            isOwner: true,
            createdAt: true
          }
        },
        registrations: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            finalAmount: true,
            discoveryCommission: true,
            companyEarnings: true,
            offerType: true,
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
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        children: {
          select: {
            id: true,
            name: true,
            referralCode: true,
            isActive: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        },
        _count: {
          select: {
            employees: true,
            registrations: true,
            children: true
          }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Revenue breakdown per tipo corso
    const revenueByType = await prisma.registration.groupBy({
      by: ['offerType'],
      where: { partnerCompanyId: id },
      _count: {
        id: true
      },
      _sum: {
        finalAmount: true,
        discoveryCommission: true,
        companyEarnings: true
      }
    });

    res.json({
      ...company,
      totalEarnings: Number(company.totalEarnings),
      discoveryTotalCommissions: Number(company.discoveryTotalCommissions),
      discoveryCommissionValue: company.discoveryCommissionValue ? Number(company.discoveryCommissionValue) : null,
      commissionPerUser: Number(company.commissionPerUser),
      registrations: company.registrations.map(r => ({
        ...r,
        finalAmount: Number(r.finalAmount),
        discoveryCommission: r.discoveryCommission ? Number(r.discoveryCommission) : null,
        companyEarnings: r.companyEarnings ? Number(r.companyEarnings) : null
      })),
      revenueBreakdown: revenueByType.map(rb => ({
        offerType: rb.offerType,
        count: rb._count.id,
        totalRevenue: Number(rb._sum.finalAmount || 0),
        discoveryCommissions: Number(rb._sum.discoveryCommission || 0),
        companyEarnings: Number(rb._sum.companyEarnings || 0)
      }))
    });

  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/companies
 * Crea nuova company + primo admin + invito email
 */
router.post('/companies', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      referralCode,
      isPremium = false,
      commissionType,
      commissionValue,
      adminEmail,
      adminFirstName,
      adminLastName
    } = req.body;

    // Validazione input
    if (!name || !referralCode || !adminEmail || !adminFirstName || !adminLastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'referralCode', 'adminEmail', 'adminFirstName', 'adminLastName']
      });
    }

    // Valida commissione se presente
    if (commissionType && !['PERCENTAGE', 'FIXED'].includes(commissionType)) {
      return res.status(400).json({
        error: 'Invalid commission type. Must be PERCENTAGE or FIXED'
      });
    }

    if (commissionType && !commissionValue) {
      return res.status(400).json({
        error: 'Commission value required when commission type is set'
      });
    }

    // Verifica referral code univoco
    const existingCompany = await prisma.partnerCompany.findUnique({
      where: { referralCode }
    });

    if (existingCompany) {
      return res.status(409).json({
        error: 'Referral code already exists',
        code: referralCode
      });
    }

    // Verifica email admin univoca
    const existingEmployee = await prisma.partnerEmployee.findUnique({
      where: { email: adminEmail }
    });

    if (existingEmployee) {
      return res.status(409).json({
        error: 'Admin email already exists',
        email: adminEmail
      });
    }

    // Crea company + primo admin in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crea company
      const company = await tx.partnerCompany.create({
        data: {
          name,
          referralCode,
          isPremium,
          canCreateChildren: isPremium, // Premium può creare sub-partner
          hierarchyLevel: 0, // Root company
          isActive: true,
          discoveryCommissionType: commissionType as CommissionType || null,
          discoveryCommissionValue: commissionValue ? new Prisma.Decimal(commissionValue) : null,
          discoveryTotalCommissions: new Prisma.Decimal(0),
          commissionPerUser: new Prisma.Decimal(0),
          totalEarnings: new Prisma.Decimal(0)
        }
      });

      // 2. Genera token invito sicuro
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni

      // 3. Crea primo employee (owner)
      const admin = await tx.partnerEmployee.create({
        data: {
          partnerCompanyId: company.id,
          email: adminEmail,
          firstName: adminFirstName,
          lastName: adminLastName,
          password: '', // Sarà impostata dall'admin al primo accesso
          role: 'ADMINISTRATIVE',
          isOwner: true,
          isActive: true,
          inviteToken,
          inviteExpiresAt
        }
      });

      // 4. Log azione admin Discovery
      await tx.discoveryAdminLog.create({
        data: {
          adminId: req.user!.id,
          action: 'COMPANY_CREATE',
          targetType: 'COMPANY',
          targetId: company.id,
          newValue: {
            name,
            referralCode,
            isPremium,
            commissionType,
            commissionValue,
            adminEmail
          },
          reason: 'Company created by Discovery admin',
          ipAddress: req.ip,
          createdAt: new Date()
        }
      });

      return { company, admin, inviteToken };
    });

    // TODO: Invia email invito con link accettazione
    // const inviteLink = `${process.env.FRONTEND_URL}/accept-invite/${result.inviteToken}`;
    // await emailService.sendCompanyInvite(adminEmail, {
    //   companyName: name,
    //   inviteLink,
    //   expiresAt: result.admin.inviteExpiresAt
    // });

    res.status(201).json({
      message: 'Company created successfully',
      company: {
        id: result.company.id,
        name: result.company.name,
        referralCode: result.company.referralCode,
        isPremium: result.company.isPremium
      },
      admin: {
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
        inviteToken: result.inviteToken,
        inviteExpiresAt: result.admin.inviteExpiresAt?.toISOString()
      }
    });

  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/companies/:id
 * Modifica company (nome, status, premium, commissioni)
 */
router.patch('/companies/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      isActive,
      isPremium,
      canCreateChildren,
      commissionType,
      commissionValue
    } = req.body;

    // Fetch company corrente per confronto
    const currentCompany = await prisma.partnerCompany.findUnique({
      where: { id }
    });

    if (!currentCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Valida commissione se modificata
    if (commissionType && !['PERCENTAGE', 'FIXED', null].includes(commissionType)) {
      return res.status(400).json({
        error: 'Invalid commission type. Must be PERCENTAGE, FIXED, or null'
      });
    }

    // Prepara update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isPremium !== undefined) {
      updateData.isPremium = isPremium;
      updateData.canCreateChildren = isPremium; // Sync premium status
    }
    if (canCreateChildren !== undefined) updateData.canCreateChildren = canCreateChildren;
    if (commissionType !== undefined) {
      updateData.discoveryCommissionType = commissionType;
      if (commissionType === null) {
        updateData.discoveryCommissionValue = null;
      }
    }
    if (commissionValue !== undefined && commissionType) {
      updateData.discoveryCommissionValue = new Prisma.Decimal(commissionValue);
    }

    // Update company + log azione
    const result = await prisma.$transaction(async (tx) => {
      const updatedCompany = await tx.partnerCompany.update({
        where: { id },
        data: updateData
      });

      // Log azione admin
      await tx.discoveryAdminLog.create({
        data: {
          adminId: req.user!.id,
          action: 'COMPANY_EDIT',
          targetType: 'COMPANY',
          targetId: id,
          previousValue: {
            name: currentCompany.name,
            isActive: currentCompany.isActive,
            isPremium: currentCompany.isPremium,
            commissionType: currentCompany.discoveryCommissionType,
            commissionValue: currentCompany.discoveryCommissionValue ? Number(currentCompany.discoveryCommissionValue) : null
          },
          newValue: updateData,
          reason: 'Company updated by Discovery admin',
          ipAddress: req.ip
        }
      });

      return updatedCompany;
    });

    res.json({
      message: 'Company updated successfully',
      company: {
        ...result,
        totalEarnings: Number(result.totalEarnings),
        discoveryTotalCommissions: Number(result.discoveryTotalCommissions),
        discoveryCommissionValue: result.discoveryCommissionValue ? Number(result.discoveryCommissionValue) : null,
        commissionPerUser: Number(result.commissionPerUser)
      }
    });

  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/companies/:id
 * Disattiva company (soft delete)
 */
router.delete('/companies/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.partnerCompany.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!company.isActive) {
      return res.status(400).json({ error: 'Company already inactive' });
    }

    // Soft delete + log
    await prisma.$transaction(async (tx) => {
      await tx.partnerCompany.update({
        where: { id },
        data: { isActive: false }
      });

      await tx.discoveryAdminLog.create({
        data: {
          adminId: req.user!.id,
          action: 'COMPANY_DISABLE',
          targetType: 'COMPANY',
          targetId: id,
          reason: 'Company disabled by Discovery admin',
          ipAddress: req.ip
        }
      });
    });

    res.json({ message: 'Company disabled successfully' });

  } catch (error) {
    console.error('Error disabling company:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// REGISTRATIONS (GLOBAL VIEW)
// ========================================

/**
 * GET /api/admin/registrations
 * Lista globale iscrizioni con filtri avanzati
 */
router.get('/registrations', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      companyId,
      courseId,
      status,
      offerType,
      dateFrom,
      dateTo,
      page = '1',
      limit = '50'
    } = req.query;

    // Build where clause
    const where: any = {};
    if (companyId) where.partnerCompanyId = companyId as string;
    if (courseId) where.courseId = courseId as string;
    if (status) where.status = status as string;
    if (offerType) where.offerType = offerType as string;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  nome: true,
                  cognome: true,
                  codiceFiscale: true
                }
              }
            }
          },
          partnerCompany: {
            select: {
              id: true,
              name: true,
              referralCode: true,
              discoveryCommissionType: true,
              discoveryCommissionValue: true
            }
          },
          offer: {
            select: {
              name: true,
              course: {
                select: {
                  name: true,
                  templateType: true
                }
              }
            }
          },
          deadlines: {
            select: {
              isPaid: true,
              amount: true,
              dueDate: true
            },
            orderBy: {
              dueDate: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.registration.count({ where })
    ]);

    const formattedRegistrations = registrations.map(reg => {
      const paidDeadlines = reg.deadlines.filter(d => d.isPaid);
      const unpaidDeadlines = reg.deadlines.filter(d => !d.isPaid);
      const nextDeadline = unpaidDeadlines[0];

      return {
        id: reg.id,
        createdAt: reg.createdAt.toISOString(),
        status: reg.status,
        offerType: reg.offerType,

        // User info
        user: {
          email: reg.user.email,
          nome: reg.user.profile?.nome,
          cognome: reg.user.profile?.cognome,
          codiceFiscale: reg.user.profile?.codiceFiscale
        },

        // Company info
        company: reg.partnerCompany ? {
          id: reg.partnerCompany.id,
          name: reg.partnerCompany.name,
          referralCode: reg.partnerCompany.referralCode,
          commissionType: reg.partnerCompany.discoveryCommissionType,
          commissionValue: reg.partnerCompany.discoveryCommissionValue ?
            Number(reg.partnerCompany.discoveryCommissionValue) : null
        } : null,

        // Course info
        course: reg.offer?.course ? {
          name: reg.offer.course.name,
          type: reg.offer.course.templateType
        } : null,

        // Financial data
        originalAmount: Number(reg.originalAmount),
        finalAmount: Number(reg.finalAmount),
        discoveryCommission: reg.discoveryCommission ? Number(reg.discoveryCommission) : null,
        companyEarnings: reg.companyEarnings ? Number(reg.companyEarnings) : null,

        // Payment info
        installments: reg.installments,
        paidInstallments: paidDeadlines.length,
        totalInstallments: reg.deadlines.length,
        nextDeadline: nextDeadline ? {
          dueDate: nextDeadline.dueDate.toISOString(),
          amount: Number(nextDeadline.amount)
        } : null
      };
    });

    res.json({
      registrations: formattedRegistrations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;