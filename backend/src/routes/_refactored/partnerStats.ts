import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../middleware/auth';
import ExcelJS from 'exceljs';

const router = Router();
const prisma = new PrismaClient();

// Get partner stats
router.get('/stats', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Get direct registrations count
    const directRegistrations = await prisma.registration.count({
      where: { 
        partnerCompanyId,
        isDirectRegistration: true 
      }
    });

    // Get indirect registrations (from child companies)
    const childCompanies = await prisma.partnerCompany.findMany({
      where: { parentId: partnerCompanyId }
    });

    let indirectRegistrations = 0;
    for (const child of childCompanies) {
      const count = await prisma.registration.count({
        where: { 
          sourcePartnerCompanyId: child.id,
          isDirectRegistration: false
        }
      });
      indirectRegistrations += count;
    }

    // Calculate monthly revenue (simplified) - only for ADMINISTRATIVE role
    let monthlyRevenue = 0;
    if (req.partnerEmployee?.role === 'ADMINISTRATIVE') {
      const revenueData = await prisma.registration.aggregate({
        _sum: { finalAmount: true },
        where: {
          OR: [
            { partnerCompanyId, isDirectRegistration: true },
            { sourcePartnerCompanyId: { in: childCompanies.map(c => c.id) } }
          ],
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      });
      monthlyRevenue = Number(revenueData._sum.finalAmount || 0);
    }

    // Get active registrations
    const activeRegistrations = await prisma.registration.count({
      where: {
        OR: [
          { partnerCompanyId, isDirectRegistration: true },
          { sourcePartnerCompanyId: { in: childCompanies.map(c => c.id) } }
        ],
        status: { in: ['ENROLLED', 'CONTRACT_SIGNED', 'DATA_VERIFIED'] }
      }
    });

    res.json({
      totalRegistrations: directRegistrations + indirectRegistrations,
      directRegistrations,
      indirectRegistrations,
      monthlyRevenue: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? monthlyRevenue : undefined,
      conversionRate: 0.15, // Placeholder - could be calculated from actual data
      totalEmployees: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? 1 : undefined, // Could count actual employees
      activeEmployees: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? 1 : undefined,
      childCompanies: req.partnerEmployee?.role === 'ADMINISTRATIVE' ? childCompanies.length : undefined,
      canViewFinancials: req.partnerEmployee?.role === 'ADMINISTRATIVE'
    });
  } catch (error) {
    console.error('Get partner stats error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get recent enrollments
router.get('/recent-enrollments', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const recentEnrollments = await prisma.registration.findMany({
      where: { partnerId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        }
      }
    });

    const enrollments = recentEnrollments.map((reg: any) => ({
      id: reg.id,
      user: {
        nome: reg.user.profile?.nome || 'N/A',
        cognome: reg.user.profile?.cognome || 'N/A',
        email: reg.user.email
      },
      course: reg.offer?.course?.name || reg.offer?.name || 'Corso non specificato',
      status: reg.status,
      createdAt: reg.createdAt
    }));

    res.json(enrollments);
  } catch (error) {
    console.error('Get recent enrollments error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Export partner's registrations to Excel
router.get('/export/registrations', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Get partner info for filename
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { referralCode: true }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Fetch partner's registrations with comprehensive data
    const registrations = await prisma.registration.findMany({
      where: { partnerId },
      include: {
        user: {
          include: {
            profile: true
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

    console.log(`Found ${registrations.length} registrations for partner ${partner.referralCode}`);

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Le Mie Registrazioni');

    // Define columns (same as admin but tailored for partners)
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
      { header: 'Importo Prossima Rata', key: 'nextAmount', width: 15 }
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
        nextAmount: nextDeadline ? `€ ${nextDeadline.amount.toFixed(2)}` : ''
      });
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.width && column.width < 8) {
        column.width = 8;
      }
    });

    // Generate filename with current date and partner code
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    const filename = `registrazioni_${partner.referralCode}_${dateString}.xlsx`;

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
    console.error('Error generating Partner Excel export:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;