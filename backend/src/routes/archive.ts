import { Router, Response } from 'express';
import { PrismaClient, ArchivePaymentType, ArchivePaymentStatus } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import archiveStorageService from '../services/archiveStorageService';

const router = Router();
const prisma = new PrismaClient();

// Multer configuration for in-memory uploads (R2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext === 'zip' || ext === 'pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo file ZIP e PDF sono permessi'));
    }
  }
});

// ========================================
// MIDDLEWARE: Solo admin Discovery
// ========================================
const requireAdmin = (req: AuthRequest, res: Response, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accesso negato. Solo amministratori Discovery.' });
  }
  next();
};

// ========================================
// POST /api/admin/archive/registrations
// Crea nuova iscrizione archiviata
// ========================================
router.post('/registrations', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      // Anagrafica
      firstName,
      lastName,
      birthDate,
      email,
      fiscalCode,
      phone,
      residenceVia,
      residenceCity,
      residenceProvince,
      residenceCap,

      // Company e Corso
      companyName,
      courseName,

      // Importi e rate
      finalAmount,
      installments,

      // Pagamenti
      payments, // Array di pagamenti

      // Documenti
      documentsZipUrl,
      documentsZipKey,
      contractPdfUrl,
      contractPdfKey,

      // Metadata
      originalYear
    } = req.body;

    // Validazione campi obbligatori
    if (!firstName || !lastName || !birthDate || !email || !fiscalCode || !phone) {
      return res.status(400).json({ error: 'Campi anagrafica obbligatori mancanti' });
    }

    if (!companyName || !courseName) {
      return res.status(400).json({ error: 'Company e corso obbligatori' });
    }

    if (!finalAmount || !installments || !originalYear) {
      return res.status(400).json({ error: 'Importo, rate e anno obbligatori' });
    }

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ error: 'Almeno un pagamento richiesto' });
    }

    // Calcola totali
    const totalExpected = payments.reduce((sum: number, p: any) => sum + parseFloat(p.expectedAmount), 0);
    const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.paidAmount), 0);
    const totalOutstanding = totalExpected - totalPaid;
    const paymentProgress = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

    // Crea iscrizione archiviata
    const archivedRegistration = await prisma.archivedRegistration.create({
      data: {
        // Anagrafica
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        email,
        fiscalCode,
        phone,
        residenceVia,
        residenceCity,
        residenceProvince,
        residenceCap,

        // Company e Corso
        companyName,
        courseName,

        // Importi
        finalAmount: parseFloat(finalAmount),
        installments: parseInt(installments),

        // Totali calcolati
        totalExpected,
        totalPaid,
        totalOutstanding,
        paymentProgress,

        // Documenti
        documentsZipUrl: documentsZipUrl || null,
        documentsZipKey: documentsZipKey || null,
        contractPdfUrl: contractPdfUrl || null,
        contractPdfKey: contractPdfKey || null,

        // Metadata
        originalYear: parseInt(originalYear),
        uploadedBy: req.user!.id,

        // Pagamenti
        payments: {
          create: payments.map((payment: any) => ({
            type: payment.type as ArchivePaymentType,
            label: payment.label,
            installmentNumber: payment.installmentNumber || null,
            expectedAmount: parseFloat(payment.expectedAmount),
            paidAmount: parseFloat(payment.paidAmount),
            status: payment.status as ArchivePaymentStatus
          }))
        }
      },
      include: {
        payments: true
      }
    });

    // Converti Decimal in Number
    const serializedRegistration = {
      ...archivedRegistration,
      finalAmount: Number(archivedRegistration.finalAmount),
      totalExpected: Number(archivedRegistration.totalExpected),
      totalPaid: Number(archivedRegistration.totalPaid),
      totalOutstanding: Number(archivedRegistration.totalOutstanding),
      paymentProgress: Number(archivedRegistration.paymentProgress),
      payments: archivedRegistration.payments.map(p => ({
        ...p,
        expectedAmount: Number(p.expectedAmount),
        paidAmount: Number(p.paidAmount)
      }))
    };

    res.json({
      success: true,
      registration: serializedRegistration
    });
  } catch (error: any) {
    console.error('Errore creazione iscrizione archiviata:', error);
    res.status(500).json({
      error: 'Errore durante la creazione dell\'iscrizione archiviata',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/stats
// Statistiche dashboard archivio
// ========================================
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Totali generali
    const totalRegistrations = await prisma.archivedRegistration.count();

    const aggregates = await prisma.archivedRegistration.aggregate({
      _sum: {
        totalExpected: true,
        totalPaid: true,
        totalOutstanding: true
      },
      _avg: {
        paymentProgress: true
      }
    });

    // Conteggi per status pagamento
    const paymentStatusCounts = await prisma.archivedPayment.groupBy({
      by: ['status'],
      _count: true
    });

    // Distribuzione per anno
    const yearlyDistribution = await prisma.archivedRegistration.groupBy({
      by: ['originalYear'],
      _count: true,
      orderBy: {
        originalYear: 'desc'
      }
    });

    // Top 5 company per numero iscrizioni
    const topCompanies = await prisma.archivedRegistration.groupBy({
      by: ['companyName'],
      _count: true,
      orderBy: {
        _count: {
          companyName: 'desc'
        }
      },
      take: 5
    });

    res.json({
      success: true,
      stats: {
        totalRegistrations,
        totalExpected: Number(aggregates._sum.totalExpected || 0),
        totalPaid: Number(aggregates._sum.totalPaid || 0),
        totalOutstanding: Number(aggregates._sum.totalOutstanding || 0),
        averageProgress: Number(aggregates._avg.paymentProgress || 0),
        paymentStatusCounts: paymentStatusCounts.reduce((acc: any, item: any) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        yearlyDistribution,
        topCompanies
      }
    });
  } catch (error: any) {
    console.error('Errore recupero statistiche archivio:', error);
    res.status(500).json({
      error: 'Errore durante il recupero delle statistiche',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/registrations
// Lista iscrizioni archiviate con filtri
// ========================================
router.get('/registrations', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      year,
      company,
      paymentStatus, // 'paid', 'partial', 'unpaid'
      search // Ricerca per nome, email, codice fiscale
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filters
    const where: any = {};

    if (year) {
      where.originalYear = parseInt(year as string);
    }

    if (company) {
      where.companyName = {
        contains: company as string,
        mode: 'insensitive'
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { fiscalCode: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Filtro per status pagamento (logica custom)
    let havingFilter: any = undefined;
    if (paymentStatus === 'paid') {
      where.totalOutstanding = 0;
    } else if (paymentStatus === 'unpaid') {
      where.totalPaid = 0;
    } else if (paymentStatus === 'partial') {
      where.AND = [
        { totalPaid: { gt: 0 } },
        { totalOutstanding: { gt: 0 } }
      ];
    }

    // Query
    const [registrations, total] = await Promise.all([
      prisma.archivedRegistration.findMany({
        where,
        include: {
          payments: {
            orderBy: {
              installmentNumber: 'asc'
            }
          }
        },
        orderBy: {
          uploadedAt: 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.archivedRegistration.count({ where })
    ]);

    // Converti Decimal in Number
    const serializedRegistrations = registrations.map(reg => ({
      ...reg,
      finalAmount: Number(reg.finalAmount),
      totalExpected: Number(reg.totalExpected),
      totalPaid: Number(reg.totalPaid),
      totalOutstanding: Number(reg.totalOutstanding),
      paymentProgress: Number(reg.paymentProgress),
      payments: reg.payments.map(p => ({
        ...p,
        expectedAmount: Number(p.expectedAmount),
        paidAmount: Number(p.paidAmount)
      }))
    }));

    res.json({
      success: true,
      registrations: serializedRegistrations,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Errore recupero iscrizioni archiviate:', error);
    res.status(500).json({
      error: 'Errore durante il recupero delle iscrizioni',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/registrations/:id
// Dettaglio singola iscrizione archiviata
// ========================================
router.get('/registrations/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const registration = await prisma.archivedRegistration.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: {
            installmentNumber: 'asc'
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione archiviata non trovata' });
    }

    // Converti Decimal in Number
    const serializedRegistration = {
      ...registration,
      finalAmount: Number(registration.finalAmount),
      totalExpected: Number(registration.totalExpected),
      totalPaid: Number(registration.totalPaid),
      totalOutstanding: Number(registration.totalOutstanding),
      paymentProgress: Number(registration.paymentProgress),
      payments: registration.payments.map(p => ({
        ...p,
        expectedAmount: Number(p.expectedAmount),
        paidAmount: Number(p.paidAmount)
      }))
    };

    res.json({
      success: true,
      registration: serializedRegistration
    });
  } catch (error: any) {
    console.error('Errore recupero dettaglio iscrizione archiviata:', error);
    res.status(500).json({
      error: 'Errore durante il recupero del dettaglio',
      details: error.message
    });
  }
});

// ========================================
// PATCH /api/admin/archive/registrations/:id
// Modifica iscrizione archiviata
// ========================================
router.patch('/registrations/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      // Anagrafica
      firstName,
      lastName,
      birthDate,
      email,
      fiscalCode,
      phone,
      residenceVia,
      residenceCity,
      residenceProvince,
      residenceCap,

      // Company e Corso
      companyName,
      courseName,

      // Importi
      finalAmount,
      installments,

      // Documenti
      documentsZipUrl,
      documentsZipKey,
      contractPdfUrl,
      contractPdfKey,

      // Metadata
      originalYear,

      // Pagamenti (opzionale, se modificati)
      payments
    } = req.body;

    // Verifica esistenza
    const existing = await prisma.archivedRegistration.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Iscrizione archiviata non trovata' });
    }

    // Se i pagamenti sono modificati, ricalcola totali
    let totalExpected: number | any = existing.totalExpected;
    let totalPaid: number | any = existing.totalPaid;
    let totalOutstanding: number | any = existing.totalOutstanding;
    let paymentProgress: number | any = existing.paymentProgress;

    if (payments && Array.isArray(payments)) {
      totalExpected = payments.reduce((sum: number, p: any) => sum + parseFloat(p.expectedAmount), 0);
      totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.paidAmount), 0);
      totalOutstanding = totalExpected - totalPaid;
      paymentProgress = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

      // Elimina vecchi pagamenti e ricrea
      await prisma.archivedPayment.deleteMany({
        where: { registrationId: id }
      });
    }

    // Aggiorna iscrizione
    const updated = await prisma.archivedRegistration.update({
      where: { id },
      data: {
        // Anagrafica
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(birthDate && { birthDate: new Date(birthDate) }),
        ...(email && { email }),
        ...(fiscalCode && { fiscalCode }),
        ...(phone && { phone }),
        ...(residenceVia && { residenceVia }),
        ...(residenceCity && { residenceCity }),
        ...(residenceProvince && { residenceProvince }),
        ...(residenceCap && { residenceCap }),

        // Company e Corso
        ...(companyName && { companyName }),
        ...(courseName && { courseName }),

        // Importi
        ...(finalAmount && { finalAmount: parseFloat(finalAmount) }),
        ...(installments && { installments: parseInt(installments) }),

        // Totali
        totalExpected,
        totalPaid,
        totalOutstanding,
        paymentProgress,

        // Documenti
        ...(documentsZipUrl !== undefined && { documentsZipUrl }),
        ...(documentsZipKey !== undefined && { documentsZipKey }),
        ...(contractPdfUrl !== undefined && { contractPdfUrl }),
        ...(contractPdfKey !== undefined && { contractPdfKey }),

        // Metadata
        ...(originalYear && { originalYear: parseInt(originalYear) }),

        // Pagamenti
        ...(payments && {
          payments: {
            create: payments.map((payment: any) => ({
              type: payment.type as ArchivePaymentType,
              label: payment.label,
              installmentNumber: payment.installmentNumber || null,
              expectedAmount: parseFloat(payment.expectedAmount),
              paidAmount: parseFloat(payment.paidAmount),
              status: payment.status as ArchivePaymentStatus
            }))
          }
        })
      },
      include: {
        payments: true
      }
    });

    // Converti Decimal in Number
    const serializedUpdated = {
      ...updated,
      finalAmount: Number(updated.finalAmount),
      totalExpected: Number(updated.totalExpected),
      totalPaid: Number(updated.totalPaid),
      totalOutstanding: Number(updated.totalOutstanding),
      paymentProgress: Number(updated.paymentProgress),
      payments: updated.payments.map(p => ({
        ...p,
        expectedAmount: Number(p.expectedAmount),
        paidAmount: Number(p.paidAmount)
      }))
    };

    res.json({
      success: true,
      registration: serializedUpdated
    });
  } catch (error: any) {
    console.error('Errore modifica iscrizione archiviata:', error);
    res.status(500).json({
      error: 'Errore durante la modifica dell\'iscrizione',
      details: error.message
    });
  }
});

// ========================================
// DELETE /api/admin/archive/registrations/:id
// Elimina iscrizione archiviata
// ========================================
router.delete('/registrations/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verifica esistenza
    const existing = await prisma.archivedRegistration.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Iscrizione archiviata non trovata' });
    }

    // Elimina (cascade automatico per payments)
    await prisma.archivedRegistration.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Iscrizione archiviata eliminata con successo'
    });
  } catch (error: any) {
    console.error('Errore eliminazione iscrizione archiviata:', error);
    res.status(500).json({
      error: 'Errore durante l\'eliminazione dell\'iscrizione',
      details: error.message
    });
  }
});

// ========================================
// POST /api/admin/archive/import-excel
// Import massivo da Excel
// ========================================
router.post('/import-excel', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { registrations } = req.body;

    if (!registrations || !Array.isArray(registrations)) {
      return res.status(400).json({ error: 'Array registrations richiesto' });
    }

    const results = {
      success: 0,
      errors: [] as any[]
    };

    // Elabora ogni iscrizione
    for (const reg of registrations) {
      try {
        // Calcola totali
        const totalExpected = reg.payments.reduce((sum: number, p: any) => sum + parseFloat(p.expectedAmount), 0);
        const totalPaid = reg.payments.reduce((sum: number, p: any) => sum + parseFloat(p.paidAmount), 0);
        const totalOutstanding = totalExpected - totalPaid;
        const paymentProgress = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

        await prisma.archivedRegistration.create({
          data: {
            // Anagrafica
            firstName: reg.firstName,
            lastName: reg.lastName,
            birthDate: new Date(reg.birthDate),
            email: reg.email,
            fiscalCode: reg.fiscalCode,
            phone: reg.phone,
            residenceVia: reg.residenceVia,
            residenceCity: reg.residenceCity,
            residenceProvince: reg.residenceProvince,
            residenceCap: reg.residenceCap,

            // Company e Corso
            companyName: reg.companyName,
            courseName: reg.courseName,

            // Importi
            finalAmount: parseFloat(reg.finalAmount),
            installments: parseInt(reg.installments),

            // Totali
            totalExpected,
            totalPaid,
            totalOutstanding,
            paymentProgress,

            // Documenti
            documentsZipUrl: reg.documentsZipUrl || null,

            // Metadata
            originalYear: parseInt(reg.originalYear),
            uploadedBy: req.user!.id,

            // Pagamenti
            payments: {
              create: reg.payments.map((payment: any) => ({
                type: payment.type as ArchivePaymentType,
                label: payment.label,
                installmentNumber: payment.installmentNumber || null,
                expectedAmount: parseFloat(payment.expectedAmount),
                paidAmount: parseFloat(payment.paidAmount),
                status: payment.status as ArchivePaymentStatus
              }))
            }
          }
        });

        results.success++;
      } catch (error: any) {
        results.errors.push({
          registration: reg,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results
    });
  } catch (error: any) {
    console.error('Errore import Excel:', error);
    res.status(500).json({
      error: 'Errore durante l\'import Excel',
      details: error.message
    });
  }
});

// ========================================
// POST /api/admin/archive/upload-zip
// Upload file ZIP documenti su R2
// ========================================
router.post('/upload-zip', authenticate, requireAdmin, upload.single('zipFile'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file ZIP caricato' });
    }

    const { registrationId, companyName, userName, originalYear } = req.body;

    if (!registrationId || !companyName || !userName || !originalYear) {
      return res.status(400).json({ error: 'Metadata mancanti (registrationId, companyName, userName, originalYear)' });
    }

    // Upload su R2 bucket documenti
    const result = await archiveStorageService.uploadArchiveZip(
      req.file.buffer,
      req.file.originalname,
      {
        registrationId,
        companyName,
        userName,
        originalYear: parseInt(originalYear)
      }
    );

    res.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
      originalName: req.file.originalname
    });
  } catch (error: any) {
    console.error('[Archive] Errore upload ZIP:', error);
    res.status(500).json({
      error: 'Errore durante l\'upload del file ZIP',
      details: error.message
    });
  }
});

// ========================================
// POST /api/admin/archive/upload-contract
// Upload file PDF contratto su R2
// ========================================
router.post('/upload-contract', authenticate, requireAdmin, upload.single('contractFile'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file PDF caricato' });
    }

    // Verifica che sia PDF
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      return res.status(400).json({ error: 'Solo file PDF sono permessi per i contratti' });
    }

    const { registrationId, companyName, userName, originalYear } = req.body;

    if (!registrationId || !companyName || !userName || !originalYear) {
      return res.status(400).json({ error: 'Metadata mancanti (registrationId, companyName, userName, originalYear)' });
    }

    // Upload su R2 bucket contratti
    const result = await archiveStorageService.uploadContractPdf(
      req.file.buffer,
      req.file.originalname,
      {
        registrationId,
        companyName,
        userName,
        originalYear: parseInt(originalYear)
      }
    );

    res.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
      originalName: req.file.originalname
    });
  } catch (error: any) {
    console.error('[Archive] Errore upload contratto PDF:', error);
    res.status(500).json({
      error: 'Errore durante l\'upload del contratto PDF',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/contract-preview/:registrationId
// URL temporaneo per preview PDF contratto (signed URL)
// ========================================
router.get('/contract-preview/:registrationId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId } = req.params;

    const registration = await prisma.archivedRegistration.findUnique({
      where: { id: registrationId },
      select: { contractPdfKey: true }
    });

    if (!registration || !registration.contractPdfKey) {
      return res.status(404).json({ error: 'Contratto PDF non trovato' });
    }

    // Genera signed URL temporaneo per preview (1 ora)
    const signedUrl = await archiveStorageService.getSignedDownloadUrl(registration.contractPdfKey, 'contracts');

    res.json({
      success: true,
      previewUrl: signedUrl,
      key: registration.contractPdfKey,
      expiresIn: 3600 // secondi
    });
  } catch (error: any) {
    console.error('[Archive] Errore recupero preview contratto:', error);
    res.status(500).json({
      error: 'Errore durante il recupero del contratto',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/download-zip/:registrationId
// Download ZIP documenti (signed URL temporaneo)
// ========================================
router.get('/download-zip/:registrationId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId } = req.params;

    const registration = await prisma.archivedRegistration.findUnique({
      where: { id: registrationId },
      select: { documentsZipKey: true, firstName: true, lastName: true }
    });

    if (!registration || !registration.documentsZipKey) {
      return res.status(404).json({ error: 'ZIP documenti non trovato' });
    }

    // Genera signed URL temporaneo (1 ora)
    const signedUrl = await archiveStorageService.getSignedDownloadUrl(registration.documentsZipKey, 'docs');

    res.json({
      success: true,
      downloadUrl: signedUrl,
      fileName: `documenti_${registration.firstName}_${registration.lastName}.zip`,
      expiresIn: 3600 // secondi
    });
  } catch (error: any) {
    console.error('[Archive] Errore download ZIP:', error);
    res.status(500).json({
      error: 'Errore durante la generazione del link di download',
      details: error.message
    });
  }
});

// ========================================
// GET /api/admin/archive/download-contract/:registrationId
// Download PDF contratto (signed URL temporaneo)
// ========================================
router.get('/download-contract/:registrationId', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId } = req.params;

    const registration = await prisma.archivedRegistration.findUnique({
      where: { id: registrationId },
      select: { contractPdfKey: true, firstName: true, lastName: true }
    });

    if (!registration || !registration.contractPdfKey) {
      return res.status(404).json({ error: 'Contratto PDF non trovato' });
    }

    // Genera signed URL temporaneo (1 ora)
    const signedUrl = await archiveStorageService.getSignedDownloadUrl(registration.contractPdfKey, 'contracts');

    res.json({
      success: true,
      downloadUrl: signedUrl,
      fileName: `contratto_${registration.firstName}_${registration.lastName}.pdf`,
      expiresIn: 3600 // secondi
    });
  } catch (error: any) {
    console.error('[Archive] Errore download contratto:', error);
    res.status(500).json({
      error: 'Errore durante la generazione del link di download',
      details: error.message
    });
  }
});

export default router;
