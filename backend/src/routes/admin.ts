import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import CompanyService from '../services/CompanyService';
import CourseService from '../services/CourseService';
import RegistrationService from '../services/RegistrationService';
import { DocumentService } from '../services/documentService';
import { ExcelExporter, ExcelFormatters } from '../utils/excelExport';
import emailService from '../services/emailService';
import { UnifiedDownloadMiddleware } from '../middleware/unifiedDownload';

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
    const stats = await CompanyService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// COURSES
// ========================================

/**
 * GET /api/admin/courses
 * Lista tutti i template di corsi disponibili
 */
router.get('/courses', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const courses = await CourseService.listCourses();
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
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
    const companies = await CompanyService.listCompanies();

    const formattedCompanies = companies.map(company => ({
      id: company.id,
      name: company.name,
      referralCode: company.referralCode,
      isActive: company.isActive,
      isPremium: company.isPremium,
      canCreateChildren: company.canCreateChildren,
      totalEarnings: Number(company.totalEarnings),
      commissionPerUser: Number(company.commissionPerUser),
      employeesCount: company._count?.employees || 0,
      registrationsCount: company._count?.registrations || 0,
      subPartnersCount: company._count?.children || 0,
      parent: company.parent,
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
    const company = await CompanyService.getCompanyById(id);

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Filtra solo iscrizioni con pagamenti registrati
    const paidRegistrations = company.registrations?.filter((reg: any) =>
      reg.deadlines?.some((d: any) => d.isPaid === true || d.paymentStatus === 'PAID')
    ) || [];

    // Calcola breakdown revenue per tipo corso (solo iscrizioni pagate)
    const revenueByType: Record<string, { count: number; revenue: number }> = {};
    const statusCount: Record<string, number> = {};

    paidRegistrations.forEach((reg: any) => {
      const type = reg.offerType;
      if (!revenueByType[type]) {
        revenueByType[type] = { count: 0, revenue: 0 };
      }
      revenueByType[type].count++;
      revenueByType[type].revenue += reg.finalAmount.toNumber();
    });

    // Count by status (su tutte le registrazioni, non solo pagate)
    company.registrations?.forEach((reg: any) => {
      const status = reg.status;
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    res.json({
      id: company.id,
      name: company.name,
      referralCode: company.referralCode,
      isActive: company.isActive,
      isPremium: company.isPremium,
      canCreateChildren: company.canCreateChildren,
      totalEarnings: Number(company.totalEarnings),
      commissionPerUser: Number(company.commissionPerUser),
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
      employees: company.employees?.map((e: any) => ({
        id: e.id,
        email: e.email,
        firstName: e.firstName || '',
        lastName: e.lastName || '',
        role: e.role,
        isActive: e.isActive,
        isOwner: e.isOwner
      })) || [],
      registrations: {
        total: company.registrations?.length || 0,
        totalPaid: paidRegistrations.length,
        byStatus: Object.entries(statusCount).map(([status, count]) => ({
          status,
          count
        })),
        byCourse: Object.entries(revenueByType).map(([courseType, data]) => ({
          courseType,
          ...data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching company detail:', error);
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
      adminEmail,
      adminFirstName,
      adminLastName,
      commissionPerUser = 0
    } = req.body;

    // Validazione input
    if (!name || !referralCode || !adminEmail || !adminFirstName || !adminLastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'referralCode', 'adminEmail', 'adminFirstName', 'adminLastName']
      });
    }

    const result = await CompanyService.createCompany({
      name,
      referralCode,
      isPremium,
      adminEmail,
      adminFirstName,
      adminLastName,
      adminId: req.user!.id,
      ipAddress: req.ip
    });

    // Invia email invito all'amministratore
    try {
      const inviteLink = `${process.env.FRONTEND_URL}/partner/accept-invite/${result.inviteToken}`;
      await emailService.sendPartnerInvite(
        adminEmail,
        inviteLink,
        name,
        'Discovery Admin',
        'ADMINISTRATIVE'
      );
      console.log(`✉️ Invite email sent to ${adminEmail}`);
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      // Non bloccare la creazione se l'email fallisce
    }

    res.status(201).json({
      success: true,
      company: {
        id: result.company.id,
        name: result.company.name,
        referralCode: result.company.referralCode,
        isPremium: result.company.isPremium
      },
      admin: {
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName
      },
      inviteToken: result.inviteToken,
      message: 'Company created successfully. Invite email sent to admin.'
    });
  } catch (error: any) {
    console.error('Error creating company:', error);
    if (error.message === 'Referral code already exists') {
      return res.status(409).json({ error: error.message });
    }
    if (error.message === 'Admin email already exists') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/companies/:id
 * Elimina company e tutti i dati associati (employees, registrations, documents, etc.)
 */
router.delete('/companies/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const ipAddress = req.ip;

    const result = await CompanyService.deleteCompany(id, adminId, ipAddress);

    res.json({
      success: true,
      message: `Company "${result.deletedCompany}" eliminata con successo`
    });
  } catch (error: any) {
    console.error('Error deleting company:', error);
    res.status(400).json({
      error: error.message || 'Errore durante l\'eliminazione della company'
    });
  }
});

/**
 * PATCH /api/admin/companies/:id
 * Aggiorna company
 */
router.patch('/companies/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, isActive, isPremium, canCreateChildren, commissionPerUser } = req.body;

    const result = await CompanyService.updateCompany(
      id,
      { name, isActive, isPremium, canCreateChildren, commissionPerUser },
      req.user!.id,
      req.ip
    );

    res.json({
      success: true,
      company: {
        id: result.id,
        name: result.name,
        isActive: result.isActive,
        isPremium: result.isPremium,
        canCreateChildren: result.canCreateChildren,
        totalEarnings: Number(result.totalEarnings),
        commissionPerUser: Number(result.commissionPerUser)
      }
    });
  } catch (error: any) {
    console.error('Error updating company:', error);
    if (error.message === 'Company not found') {
      return res.status(404).json({ error: error.message });
    }
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

    await CompanyService.disableCompany(id, req.user!.id, req.ip);

    res.json({
      success: true,
      message: 'Company disabled successfully'
    });
  } catch (error: any) {
    console.error('Error disabling company:', error);
    if (error.message === 'Company not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/companies/:id/permanent
 * Elimina definitivamente company e tutti i dati associati (hard delete)
 */
router.delete('/companies/:id/permanent', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await CompanyService.deleteCompany(id, req.user!.id, req.ip);

    res.json({
      success: true,
      message: `Company "${result.deletedCompany}" eliminata definitivamente`,
      deletedCompany: result.deletedCompany
    });
  } catch (error: any) {
    console.error('Error deleting company:', error);
    if (error.message === 'Company not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Cannot delete company with active sub-partners') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// REGISTRATIONS
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
      hasCommission,
      page,
      limit
    } = req.query;

    const result = await RegistrationService.listRegistrations({
      companyId: companyId as string,
      courseId: courseId as string,
      status: status ? (status as string).split(',') as any : undefined,
      offerType: offerType as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      hasCommission: hasCommission === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/registrations/:id
 * Dettaglio iscrizione completo
 */
router.get('/registrations/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const registration = await RegistrationService.getRegistrationById(id);

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({
      ...registration,
      finalAmount: Number(registration.finalAmount),
      originalAmount: Number(registration.originalAmount),
      partnerCommission: registration.partnerCommission
        ? Number(registration.partnerCommission)
        : null
    });
  } catch (error) {
    console.error('Error fetching registration detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/registrations/:id/transfer
 * Trasferisci iscrizione a altra company
 */
router.patch(
  '/registrations/:id/transfer',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { toCompanyId, reason } = req.body;

      if (!toCompanyId || !reason) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['toCompanyId', 'reason']
        });
      }

      await RegistrationService.transferRegistration(
        id,
        toCompanyId,
        req.user!.id,
        reason,
        req.ip
      );

      res.json({
        success: true,
        message: 'Registration transferred successfully'
      });
    } catch (error: any) {
      console.error('Error transferring registration:', error);
      if (error.message === 'Registration not found' || error.message === 'Target company not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ========================================
// DISCOVERY DOCUMENT APPROVAL WORKFLOW
// ========================================

/**
 * GET /api/admin/registrations/pending-approval
 * Lista iscrizioni in attesa di approvazione Discovery
 */
router.get('/registrations/pending-approval', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const {
      companyId,
      courseId,
      dateFrom,
      dateTo,
      page,
      limit
    } = req.query;

    // Build filter - Include both DOCUMENTS_PARTNER_CHECKED and AWAITING_DISCOVERY_APPROVAL
    const where: any = {
      status: {
        in: ['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL']
      }
    };

    if (companyId) {
      where.partnerCompanyId = companyId as string;
    }

    if (courseId) {
      where.offer = {
        courseId: courseId as string
      };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
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
              referralCode: true
            }
          },
          offer: {
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  templateType: true
                }
              }
            }
          },
          userDocuments: {
            select: {
              id: true,
              type: true,
              status: true,
              partnerCheckedAt: true,
              partnerCheckedBy: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc' // Più vecchie prima
        },
        skip,
        take: limitNum
      }),
      prisma.registration.count({ where })
    ]);

    res.json({
      registrations: registrations.map(reg => ({
        ...reg,
        finalAmount: Number(reg.finalAmount),
        originalAmount: Number(reg.originalAmount)
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching pending approval registrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/admin/registrations/:id/approve
 * Discovery approva iscrizione (approvazione finale con email)
 */
router.patch('/registrations/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user!.id;

    // Verifica che la registrazione esista e sia in stato corretto
    const registration = await prisma.registration.findUnique({
      where: { id }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Accept both DOCUMENTS_PARTNER_CHECKED and AWAITING_DISCOVERY_APPROVAL
    const validStatuses = ['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL'];
    if (!validStatuses.includes(registration.status)) {
      return res.status(400).json({
        error: 'Registration is not in pending approval status',
        currentStatus: registration.status,
        expectedStatuses: validStatuses
      });
    }

    // Approva iscrizione tramite DocumentService
    const result = await DocumentService.discoveryApproveRegistration(
      id,
      adminId,
      notes
    );

    res.json({
      success: true,
      message: 'Registration approved successfully',
      registration: {
        ...result.registration,
        finalAmount: result.registration ? Number(result.registration.finalAmount) : null,
        originalAmount: result.registration ? Number(result.registration.originalAmount) : null
      },
      documentsApproved: result.documentsApproved,
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Error approving registration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * PATCH /api/admin/registrations/:id/reject
 * Discovery rifiuta iscrizione (con motivo e email)
 */
router.patch('/registrations/:id/reject', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user!.id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Rejection reason is required',
        required: ['reason']
      });
    }

    // Verifica che la registrazione esista e sia in stato corretto
    const registration = await prisma.registration.findUnique({
      where: { id }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Accept both DOCUMENTS_PARTNER_CHECKED and AWAITING_DISCOVERY_APPROVAL
    const validStatuses = ['DOCUMENTS_PARTNER_CHECKED', 'AWAITING_DISCOVERY_APPROVAL'];
    if (!validStatuses.includes(registration.status)) {
      return res.status(400).json({
        error: 'Registration is not in pending approval status',
        currentStatus: registration.status,
        expectedStatuses: validStatuses
      });
    }

    // Rifiuta iscrizione tramite DocumentService
    const result = await DocumentService.discoveryRejectRegistration(
      id,
      adminId,
      reason
    );

    res.json({
      success: true,
      message: 'Registration rejected successfully',
      registration: {
        ...result.registration,
        finalAmount: result.registration ? Number(result.registration.finalAmount) : null,
        originalAmount: result.registration ? Number(result.registration.originalAmount) : null
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ========================================
// COURSE TEMPLATE COMMISSION MANAGEMENT
// ========================================

/**
 * GET /api/admin/courses
 * Lista tutti i course templates con commissioni Discovery
 */
router.get('/courses', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const courses = await CourseService.listCourses();
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/courses/:id
 * Dettaglio course template
 */
router.get('/courses/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const course = await CourseService.getCourseById(id);

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.error('Error fetching course detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/revenue/companies
 * Revenue dettagliato per tutte le company
 */
router.get('/revenue/companies', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const revenueData = await CompanyService.getCompanyRevenue();
    res.json(revenueData);
  } catch (error) {
    console.error('Error fetching company revenue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// USERS MANAGEMENT
// ========================================

/**
 * GET /api/admin/users
 * Lista utenti con filtri
 */
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { role, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { email: { contains: search as string, mode: 'insensitive' } },
        { profile: { nome: { contains: search as string, mode: 'insensitive' } } },
        { profile: { cognome: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        assignedPartnerId: true,
        profile: {
          select: {
            nome: true,
            cognome: true,
            codiceFiscale: true
          }
        },
        registrations: {
          select: {
            partnerCompany: {
              select: {
                id: true,
                name: true,
                referralCode: true
              }
            }
          },
          take: 1,
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format response with company from first registration
    const formattedUsers = users.map(user => ({
      ...user,
      assignedPartner: user.registrations[0]?.partnerCompany || null,
      registrations: undefined // Remove registrations array from response
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users/:id
 * Dettaglio utente singolo
 */
router.get('/users/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        assignedPartnerId: true,
        profile: {
          select: {
            nome: true,
            cognome: true,
            codiceFiscale: true,
            telefono: true,
            dataNascita: true,
            luogoNascita: true
          }
        },
        registrations: {
          select: {
            id: true,
            status: true,
            finalAmount: true,
            createdAt: true,
            offer: {
              select: {
                course: {
                  select: {
                    name: true,
                    templateType: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users/transfer
 * Trasferisci utente a altra company
 */
router.post('/users/transfer', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId, toPartnerCompanyId, reason } = req.body;

    if (!userId || !toPartnerCompanyId || !reason) {
      return res.status(400).json({
        error: 'userId, toPartnerCompanyId, and reason are required'
      });
    }

    // Verifica utente
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        registrations: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verifica company destinazione
    const toCompany = await prisma.partnerCompany.findUnique({
      where: { id: toPartnerCompanyId }
    });

    if (!toCompany) {
      return res.status(404).json({ error: 'Destination company not found' });
    }

    if (!toCompany.isActive) {
      return res.status(400).json({ error: 'Destination company is not active' });
    }

    // Transfer user e tutte le registrazioni
    await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id: userId },
        data: {
          assignedPartnerId: toPartnerCompanyId
        }
      });

      // Update all registrations
      await tx.registration.updateMany({
        where: { userId },
        data: {
          partnerCompanyId: toPartnerCompanyId
        }
      });

      // Log transfer
      await tx.discoveryAdminLog.create({
        data: {
          adminId: req.user!.id,
          action: 'USER_TRANSFER',
          targetType: 'USER',
          targetId: userId,
          previousValue: {
            assignedPartnerId: user.assignedPartnerId
          },
          newValue: {
            assignedPartnerId: toPartnerCompanyId
          },
          reason,
          ipAddress: req.ip
        }
      });
    });

    res.json({
      success: true,
      message: `User and ${user.registrations.length} registration(s) transferred successfully`
    });
  } catch (error: any) {
    console.error('Error transferring user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// DOCUMENTS - Download & Preview
// ========================================

/**
 * GET /api/admin/documents/:documentId/preview
 * Preview documento (inline - per PDF e immagini)
 */
router.get('/documents/:documentId/preview', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;

    // Trova documento (admin può accedere a qualsiasi documento)
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Stream file per preview inline
    await UnifiedDownloadMiddleware.streamFile(
      res,
      document.url,
      document.originalName,
      document.mimeType
    );
  } catch (error) {
    console.error('Error previewing document:', error);
    res.status(500).json({ error: 'Errore durante il preview del documento' });
  }
});

/**
 * GET /api/admin/documents/:documentId/download
 * Download documento
 */
router.get('/documents/:documentId/download', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;

    // Trova documento (admin può accedere a qualsiasi documento)
    const document = await prisma.userDocument.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Download file
    await UnifiedDownloadMiddleware.sendFile(
      res,
      document.url,
      document.originalName,
      document.mimeType
    );
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Errore durante il download del documento' });
  }
});

// ========================================
// EXPORT
// ========================================

/**
 * GET /api/admin/export/registrations
 * Export Excel registrazioni globali
 */
router.get('/export/registrations', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { companyId, courseId, status, dateFrom, dateTo } = req.query;

    const result = await RegistrationService.listRegistrations({
      companyId: companyId as string,
      courseId: courseId as string,
      status: status ? (status as string).split(',') as any : undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      limit: 10000 // Max for export
    });

    const exporter = new ExcelExporter('Registrazioni Discovery');

    exporter.setColumns([
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Data Iscrizione', key: 'createdAt', width: 15 },
      { header: 'Utente Email', key: 'email', width: 30 },
      { header: 'Nome', key: 'nome', width: 20 },
      { header: 'Cognome', key: 'cognome', width: 20 },
      { header: 'Codice Fiscale', key: 'codiceFiscale', width: 20 },
      { header: 'Company', key: 'company', width: 30 },
      { header: 'Corso', key: 'course', width: 30 },
      { header: 'Tipo Corso', key: 'templateType', width: 15 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Importo Totale', key: 'finalAmount', width: 15 }
    ]);

    const rows = result.registrations.map((reg: any) => ({
      id: reg.id,
      createdAt: reg.createdAt,
      email: reg.user.email,
      nome: reg.user.profile?.nome || '',
      cognome: reg.user.profile?.cognome || '',
      codiceFiscale: reg.user.profile?.codiceFiscale || '',
      company: reg.partnerCompany?.name || 'N/A',
      course: reg.course?.name || 'N/A',
      templateType: reg.course?.templateType || 'N/A',
      status: reg.status,
      finalAmount: reg.finalAmount
    }));

    exporter.addRows(rows);

    const buffer = await exporter.generate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=registrazioni_discovery.xlsx');

    res.send(buffer);
    res.end();
  } catch (error) {
    console.error('Error exporting registrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// GLOBAL SEARCH
// ========================================

/**
 * GET /api/admin/search
 * Ricerca globale attraverso companies, utenti, iscrizioni, dipendenti, corsi
 */
router.get('/search', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { q, category = 'all', limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const searchQuery = q.trim();
    const searchLimit = parseInt(limit as string) || 10;

    // Initialize results
    const results: any = {
      query: searchQuery,
      category,
      totalResults: 0,
      results: {
        companies: [],
        users: [],
        registrations: [],
        employees: [],
        courses: []
      }
    };

    // Helper per aggiungere filtri di ricerca
    const createSearchFilter = (fields: string[]) => ({
      OR: fields.map(field => ({
        [field]: {
          contains: searchQuery,
          mode: 'insensitive' as const
        }
      }))
    });

    // Search Companies
    if (category === 'all' || category === 'companies') {
      const companies = await prisma.partnerCompany.findMany({
        where: createSearchFilter(['name', 'referralCode']),
        take: searchLimit,
        select: {
          id: true,
          name: true,
          referralCode: true,
          isPremium: true,
          isActive: true,
          _count: {
            select: {
              registrations: true,
              employees: true
            }
          }
        }
      });

      results.results.companies = companies.map(c => ({
        type: 'company',
        id: c.id,
        name: c.name,
        referralCode: c.referralCode,
        isPremium: c.isPremium,
        isActive: c.isActive,
        registrationsCount: c._count.registrations,
        employeesCount: c._count.employees
      }));
      results.totalResults += companies.length;
    }

    // Search Users
    if (category === 'all' || category === 'users') {
      const users = await prisma.userProfile.findMany({
        where: {
          OR: [
            { cognome: { contains: searchQuery, mode: 'insensitive' } },
            { nome: { contains: searchQuery, mode: 'insensitive' } },
            { codiceFiscale: { contains: searchQuery, mode: 'insensitive' } },
            { user: { email: { contains: searchQuery, mode: 'insensitive' } } }
          ]
        },
        take: searchLimit,
        select: {
          userId: true,
          cognome: true,
          nome: true,
          codiceFiscale: true,
          user: {
            select: {
              email: true,
              registrations: {
                select: { id: true }
              }
            }
          }
        }
      });

      results.results.users = users.map(u => ({
        type: 'user',
        id: u.userId,
        cognome: u.cognome,
        nome: u.nome,
        email: u.user.email,
        codiceFiscale: u.codiceFiscale,
        registrationsCount: u.user.registrations.length
      }));
      results.totalResults += users.length;
    }

    // Search Registrations
    if (category === 'all' || category === 'registrations') {
      const registrations = await prisma.registration.findMany({
        where: {
          OR: [
            { id: { contains: searchQuery, mode: 'insensitive' } },
            { user: { email: { contains: searchQuery, mode: 'insensitive' } } },
            { user: { profile: { cognome: { contains: searchQuery, mode: 'insensitive' } } } },
            { user: { profile: { nome: { contains: searchQuery, mode: 'insensitive' } } } }
          ]
        },
        take: searchLimit,
        select: {
          id: true,
          status: true,
          finalAmount: true,
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
          },
          partnerCompany: {
            select: {
              name: true
            }
          },
          partnerOffer: {
            select: {
              offerType: true
            }
          }
        }
      });

      results.results.registrations = registrations.map(r => ({
        type: 'registration',
        id: r.id,
        status: r.status,
        finalAmount: r.finalAmount,
        userEmail: r.user.email,
        userName: r.user.profile ? `${r.user.profile.nome} ${r.user.profile.cognome}` : null,
        companyName: r.partnerCompany.name,
        offerType: r.partnerOffer.offerType
      }));
      results.totalResults += registrations.length;
    }

    // Search Employees
    if (category === 'all' || category === 'employees') {
      const employees = await prisma.partnerEmployee.findMany({
        where: createSearchFilter(['firstName', 'lastName', 'email']),
        take: searchLimit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          isActive: true,
          isOwner: true,
          partnerCompany: {
            select: {
              name: true
            }
          }
        }
      });

      results.results.employees = employees.map(e => ({
        type: 'employee',
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        role: e.role,
        isActive: e.isActive,
        isOwner: e.isOwner,
        companyName: e.partnerCompany.name
      }));
      results.totalResults += employees.length;
    }

    // Search Courses
    if (category === 'all' || category === 'courses') {
      const courses = await prisma.course.findMany({
        where: createSearchFilter(['name', 'description']),
        take: searchLimit,
        select: {
          id: true,
          name: true,
          description: true,
          templateType: true,
          _count: {
            select: {
              partnerOffers: true
            }
          }
        }
      });

      results.results.courses = courses.map(c => ({
        type: 'course',
        id: c.id,
        name: c.name,
        description: c.description,
        templateType: c.templateType,
        offersCount: c._count.partnerOffers
      }));
      results.totalResults += courses.length;
    }

    res.json(results);
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;