import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check admin permissions
const requireAdmin = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// GET /api/admin/users - Get all users with their assigned partners and registration counts
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: 'USER'
      },
      include: {
        profile: {
          select: {
            nome: true,
            cognome: true
          }
        },
        assignedPartner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
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

    // Format users for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      assignedPartnerId: user.assignedPartnerId,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        user: {
          email: user.assignedPartner.user.email
        }
      } : undefined,
      profile: user.profile,
      _count: user._count
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/partners - Get all partners
router.get('/partners', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const partners = await prisma.partner.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedPartners = partners.map(partner => ({
      id: partner.id,
      referralCode: partner.referralCode,
      user: {
        email: partner.user.email
      }
    }));

    res.json(formattedPartners);
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/user-transfers - Get all user transfers history
router.get('/user-transfers', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const transfers = await prisma.userTransfer.findMany({
      include: {
        fromPartner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        toPartner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        transferredAt: 'desc'
      }
    });

    // Get user info separately since UserTransfer doesn't have direct user relation
    const transfersWithUsers = await Promise.all(
      transfers.map(async (transfer) => {
        const user = await prisma.user.findUnique({
          where: { id: transfer.userId },
          select: {
            email: true,
            profile: {
              select: {
                nome: true,
                cognome: true
              }
            }
          }
        });

        return {
          id: transfer.id,
          userId: transfer.userId,
          fromPartnerId: transfer.fromPartnerId,
          toPartnerId: transfer.toPartnerId,
          reason: transfer.reason,
          transferredAt: transfer.transferredAt.toISOString(),
          transferredBy: transfer.transferredBy,
          user: user,
          fromPartner: transfer.fromPartner,
          toPartner: transfer.toPartner
        };
      })
    );

    res.json(transfersWithUsers);
  } catch (error) {
    console.error('Error fetching user transfers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/transfer-user - Transfer user between partners
router.post('/transfer-user', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { userId, toPartnerId, reason } = req.body;

    if (!userId || !toPartnerId || !reason) {
      return res.status(400).json({ error: 'Missing required fields: userId, toPartnerId, reason' });
    }

    // Validate user exists and is a USER role
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: 'USER'
      },
      include: {
        assignedPartner: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.assignedPartnerId) {
      return res.status(400).json({ error: 'User is not assigned to any partner' });
    }

    // Validate new partner exists
    const newPartner = await prisma.partner.findUnique({
      where: { id: toPartnerId }
    });

    if (!newPartner) {
      return res.status(404).json({ error: 'Target partner not found' });
    }

    if (user.assignedPartnerId === toPartnerId) {
      return res.status(400).json({ error: 'User is already assigned to this partner' });
    }

    // Perform the transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create transfer record
      const transfer = await tx.userTransfer.create({
        data: {
          userId: userId,
          fromPartnerId: user.assignedPartnerId!,
          toPartnerId: toPartnerId,
          reason: reason,
          transferredBy: req.user!.email,
          transferredAt: new Date()
        }
      });

      // Update user's assigned partner
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { assignedPartnerId: toPartnerId }
      });

      // Update all user's registrations to the new partner
      await tx.registration.updateMany({
        where: { userId: userId },
        data: { partnerId: toPartnerId }
      });

      return { transfer, updatedUser };
    });

    res.json({
      message: 'User transferred successfully',
      transfer: result.transfer
    });
  } catch (error) {
    console.error('Error transferring user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/export/registrations - Export registrations to Excel
router.get('/export/registrations', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    console.log('Starting Excel export generation...');

    // Fetch all registrations with comprehensive data
    const registrations = await prisma.registration.findMany({
      include: {
        user: {
          include: {
            profile: true
          }
        },
        partner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        deadlines: {
          orderBy: {
            dueDate: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${registrations.length} registrations to export`);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrazioni');

    // Define columns
    worksheet.columns = [
      { header: 'ID Registrazione', key: 'registrationId', width: 15 },
      { header: 'Data Iscrizione', key: 'createdAt', width: 12 },
      { header: 'Stato', key: 'status', width: 15 },
      { header: 'Nome', key: 'nome', width: 15 },
      { header: 'Cognome', key: 'cognome', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Codice Fiscale', key: 'codiceFiscale', width: 16 },
      { header: 'Telefono', key: 'telefono', width: 12 },
      { header: 'Data Nascita', key: 'dataNascita', width: 12 },
      { header: 'Luogo Nascita', key: 'luogoNascita', width: 15 },
      { header: 'Residenza Via', key: 'residenzaVia', width: 25 },
      { header: 'Residenza Città', key: 'residenzaCitta', width: 15 },
      { header: 'Residenza Provincia', key: 'residenzaProvincia', width: 8 },
      { header: 'Residenza CAP', key: 'residenzaCap', width: 8 },
      { header: 'Corso', key: 'courseName', width: 30 },
      { header: 'Tipo Corso', key: 'courseType', width: 12 },
      { header: 'Offerta', key: 'offerName', width: 25 },
      { header: 'Tipo Offerta', key: 'offerType', width: 15 },
      { header: 'Costo Totale', key: 'totalAmount', width: 12 },
      { header: 'Importo Finale', key: 'finalAmount', width: 12 },
      { header: 'Rate Pagate', key: 'paidInstallments', width: 12 },
      { header: 'Rate Totali', key: 'totalInstallments', width: 12 },
      { header: 'Residuo da Pagare', key: 'remainingAmount', width: 15 },
      { header: 'Prossima Scadenza', key: 'nextDueDate', width: 15 },
      { header: 'Importo Prossima Rata', key: 'nextAmount', width: 15 },
      { header: 'Partner', key: 'partnerEmail', width: 25 },
      { header: 'Codice Referral', key: 'referralCode', width: 15 }
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E2E2' }
    };

    // Add data rows
    for (const registration of registrations) {
      const profile = registration.user.profile;
      const paidDeadlines = registration.deadlines.filter((pd: any) => pd.isPaid);
      const unpaidDeadlines = registration.deadlines.filter((pd: any) => !pd.isPaid);
      const nextDeadline = unpaidDeadlines[0];
      
      // Calculate remaining amount
      const totalPaid = paidDeadlines.reduce((sum: number, pd: any) => sum + pd.amount, 0);
      const remainingAmount = Number(registration.finalAmount) - totalPaid;

      worksheet.addRow({
        registrationId: registration.id.substring(0, 8) + '...',
        createdAt: registration.createdAt.toLocaleDateString('it-IT'),
        status: registration.status,
        nome: profile?.nome || '',
        cognome: profile?.cognome || '',
        email: registration.user.email,
        codiceFiscale: profile?.codiceFiscale || '',
        telefono: profile?.telefono || '',
        dataNascita: profile?.dataNascita ? new Date(profile.dataNascita).toLocaleDateString('it-IT') : '',
        luogoNascita: profile?.luogoNascita || '',
        residenzaVia: profile?.residenzaVia || '',
        residenzaCitta: profile?.residenzaCitta || '',
        residenzaProvincia: profile?.residenzaProvincia || '',
        residenzaCap: profile?.residenzaCap || '',
        courseName: registration.offer?.course?.name || 'N/A',
        courseType: registration.offer?.course?.templateType || 'N/A',
        offerName: registration.offer?.name || 'N/A',
        offerType: registration.offer?.offerType || 'N/A',
        totalAmount: `€ ${Number(registration.offer?.totalAmount || 0).toFixed(2)}`,
        finalAmount: `€ ${Number(registration.finalAmount).toFixed(2)}`,
        paidInstallments: paidDeadlines.length,
        totalInstallments: registration.deadlines.length,
        remainingAmount: `€ ${remainingAmount.toFixed(2)}`,
        nextDueDate: nextDeadline ? nextDeadline.dueDate.toLocaleDateString('it-IT') : '',
        nextAmount: nextDeadline ? `€ ${nextDeadline.amount.toFixed(2)}` : '',
        partnerEmail: registration.partner?.user.email || '',
        referralCode: registration.partner?.referralCode || ''
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.width && column.width < 8) {
        column.width = 8;
      }
    });

    // Generate filename with current date
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const filename = `registrazioni_export_${dateString}.xlsx`;

    console.log(`Generated Excel file: ${filename}`);

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating Excel export:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;