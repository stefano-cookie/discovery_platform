import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import twoFactorService from '../services/twoFactorService';
import { validateEncryptionKey } from '../utils/encryption';

const router = express.Router();
const prisma = new PrismaClient();

// Valida encryption key all'avvio
validateEncryptionKey();

/**
 * Middleware per autenticare PartnerEmployee via JWT o session token
 */
interface AuthRequest extends Request {
  partnerEmployeeId?: string;
  employee?: any;
}

const authenticateEmployee = async (
  req: AuthRequest,
  res: Response,
  next: Function
) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token non fornito' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.partnerEmployeeId = decoded.id;

    // Carica employee
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: decoded.id },
    });

    if (!employee || !employee.isActive) {
      return res.status(401).json({ error: 'Employee non valido' });
    }

    req.employee = employee;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};

/**
 * POST /api/auth/2fa/setup
 * Inizia il processo di setup 2FA (genera QR + secret)
 */
router.post('/setup', authenticateEmployee, async (req: AuthRequest, res: Response) => {
  try {
    const partnerEmployeeId = req.partnerEmployeeId!;
    const employee = req.employee;

    // Verifica che 2FA non sia già abilitato
    if (employee.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Autenticazione a due fattori già abilitata',
      });
    }

    // Genera setup
    const setup = await twoFactorService.generateTwoFactorSetup(
      partnerEmployeeId,
      employee.email
    );

    return res.json({
      message: 'Setup 2FA generato con successo',
      data: {
        qrCode: setup.qrCodeDataUrl,
        secret: setup.secret, // Manual entry fallback
        recoveryCodes: setup.recoveryCodes,
      },
      instructions: {
        step1: 'Scansiona il QR code con la tua app (Google Authenticator, Authy, etc.)',
        step2: 'Oppure inserisci manualmente il secret nella tua app',
        step3: 'Salva i recovery codes in un posto sicuro',
        step4: 'Verifica il setup inserendo il codice a 6 cifre',
      },
    });
  } catch (error) {
    console.error('Errore setup 2FA:', error);
    return res.status(500).json({ error: 'Errore durante setup 2FA' });
  }
});

/**
 * POST /api/auth/2fa/verify-setup
 * Conferma setup con primo codice
 */
router.post(
  '/verify-setup',
  authenticateEmployee,
  async (req: AuthRequest, res: Response) => {
    try {
      const { secret, code, recoveryCodes } = req.body;

      if (!secret || !code || !recoveryCodes) {
        return res.status(400).json({
          error: 'Parametri mancanti: secret, code, recoveryCodes richiesti',
        });
      }

      const partnerEmployeeId = req.partnerEmployeeId!;

      // Verifica e attiva 2FA
      const success = await twoFactorService.verifyAndEnableTwoFactor(
        partnerEmployeeId,
        secret,
        code,
        recoveryCodes
      );

      if (!success) {
        return res.status(400).json({
          error: 'Codice non valido. Riprova.',
        });
      }

      return res.json({
        message: 'Autenticazione a due fattori attivata con successo',
        twoFactorEnabled: true,
      });
    } catch (error) {
      console.error('Errore verifica setup 2FA:', error);
      return res.status(500).json({ error: 'Errore durante attivazione 2FA' });
    }
  }
);

/**
 * POST /api/auth/2fa/verify
 * Verifica codice 2FA durante login
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { sessionToken, code } = req.body;

    if (!sessionToken || !code) {
      return res.status(400).json({
        error: 'Parametri mancanti: sessionToken e code richiesti',
      });
    }

    // Verifica sessione temporanea
    const partnerEmployeeId = await twoFactorService.verifyTwoFactorSession(
      sessionToken
    );

    if (!partnerEmployeeId) {
      return res.status(401).json({
        error: 'Sessione scaduta o non valida',
      });
    }

    // Verifica codice 2FA
    const result = await twoFactorService.verifyTwoFactorCode(
      partnerEmployeeId,
      code,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      });
    }

    // Marca sessione come verificata
    await twoFactorService.markSessionVerified(sessionToken);

    // Genera JWT finale con flag 2FA
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: partnerEmployeeId },
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true,
            canCreateChildren: true,
            isPremium: true,
          },
        },
      },
    });

    const token = jwt.sign(
      {
        id: employee!.id,
        email: employee!.email,
        role: employee!.role,
        partnerCompanyId: employee!.partnerCompanyId,
        twoFactorVerified: true, // Flag importante
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Autenticazione completata',
      token,
      employee: {
        id: employee!.id,
        email: employee!.email,
        firstName: employee!.firstName,
        lastName: employee!.lastName,
        role: employee!.role,
        partnerCompany: employee!.partnerCompany,
        twoFactorVerified: true,
      },
    });
  } catch (error) {
    console.error('Errore verifica 2FA:', error);
    return res.status(500).json({ error: 'Errore durante verifica 2FA' });
  }
});

/**
 * POST /api/auth/2fa/recovery
 * Usa recovery code per accedere
 */
router.post('/recovery', async (req: Request, res: Response) => {
  try {
    const { sessionToken, recoveryCode } = req.body;

    if (!sessionToken || !recoveryCode) {
      return res.status(400).json({
        error: 'Parametri mancanti: sessionToken e recoveryCode richiesti',
      });
    }

    // Verifica sessione temporanea
    const partnerEmployeeId = await twoFactorService.verifyTwoFactorSession(
      sessionToken
    );

    if (!partnerEmployeeId) {
      return res.status(401).json({
        error: 'Sessione scaduta o non valida',
      });
    }

    // Verifica recovery code
    const result = await twoFactorService.verifyRecoveryCode(
      partnerEmployeeId,
      recoveryCode.replace(/\s+/g, ''), // Rimuovi spazi
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    // Marca sessione come verificata
    await twoFactorService.markSessionVerified(sessionToken);

    // Genera JWT finale
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: partnerEmployeeId },
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true,
            canCreateChildren: true,
            isPremium: true,
          },
        },
      },
    });

    const token = jwt.sign(
      {
        id: employee!.id,
        email: employee!.email,
        role: employee!.role,
        partnerCompanyId: employee!.partnerCompanyId,
        twoFactorVerified: true,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // Ottieni stato aggiornato
    const status = await twoFactorService.getTwoFactorStatus(partnerEmployeeId);

    return res.json({
      message: 'Autenticazione completata con recovery code',
      token,
      employee: {
        id: employee!.id,
        email: employee!.email,
        firstName: employee!.firstName,
        lastName: employee!.lastName,
        role: employee!.role,
        partnerCompany: employee!.partnerCompany,
        twoFactorVerified: true,
      },
      warning:
        status?.needsRecoveryCodeRefresh
          ? 'Attenzione: restano meno di 3 recovery codes. Considera di rigenerarli.'
          : null,
    });
  } catch (error) {
    console.error('Errore recovery code:', error);
    return res.status(500).json({ error: 'Errore durante verifica recovery code' });
  }
});

/**
 * GET /api/auth/2fa/status
 * Ottieni stato 2FA dell'employee corrente
 */
router.get('/status', authenticateEmployee, async (req: AuthRequest, res: Response) => {
  try {
    const partnerEmployeeId = req.partnerEmployeeId!;

    const status = await twoFactorService.getTwoFactorStatus(partnerEmployeeId);

    if (!status) {
      return res.status(404).json({ error: 'Employee non trovato' });
    }

    return res.json(status);
  } catch (error) {
    console.error('Errore stato 2FA:', error);
    return res.status(500).json({ error: 'Errore durante recupero stato 2FA' });
  }
});

/**
 * POST /api/auth/2fa/regenerate-backup
 * Rigenera recovery codes (richiede password corrente)
 */
router.post(
  '/regenerate-backup',
  authenticateEmployee,
  async (req: AuthRequest, res: Response) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: 'Password richiesta' });
      }

      const employee = req.employee;

      // Verifica password
      const isPasswordValid = await bcrypt.compare(password, employee.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Password non corretta' });
      }

      // Verifica che 2FA sia abilitato
      if (!employee.twoFactorEnabled) {
        return res.status(400).json({
          error: 'Autenticazione a due fattori non abilitata',
        });
      }

      // Rigenera recovery codes
      const newRecoveryCodes = await twoFactorService.regenerateRecoveryCodes(
        employee.id
      );

      return res.json({
        message: 'Recovery codes rigenerati con successo',
        recoveryCodes: newRecoveryCodes,
        warning:
          'Salva questi codici in un posto sicuro. I vecchi codici non sono più validi.',
      });
    } catch (error) {
      console.error('Errore rigenerazione backup codes:', error);
      return res.status(500).json({
        error: 'Errore durante rigenerazione recovery codes',
      });
    }
  }
);

/**
 * DELETE /api/auth/2fa/disable
 * Disabilita 2FA (richiede codice 2FA corrente)
 */
router.delete(
  '/disable',
  authenticateEmployee,
  async (req: AuthRequest, res: Response) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Codice 2FA richiesto' });
      }

      const partnerEmployeeId = req.partnerEmployeeId!;

      // Verifica codice prima di disabilitare
      const result = await twoFactorService.verifyTwoFactorCode(
        partnerEmployeeId,
        code
      );

      if (!result.success) {
        return res.status(400).json({
          error: 'Codice non valido',
        });
      }

      // Disabilita 2FA
      await twoFactorService.disableTwoFactor(partnerEmployeeId);

      return res.json({
        message: 'Autenticazione a due fattori disabilitata',
        twoFactorEnabled: false,
      });
    } catch (error) {
      console.error('Errore disabilitazione 2FA:', error);
      return res.status(500).json({ error: 'Errore durante disabilitazione 2FA' });
    }
  }
);

/**
 * GET /api/auth/2fa/audit-logs
 * Ottieni audit logs 2FA (solo per l'employee corrente)
 */
router.get(
  '/audit-logs',
  authenticateEmployee,
  async (req: AuthRequest, res: Response) => {
    try {
      const partnerEmployeeId = req.partnerEmployeeId!;
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await prisma.twoFactorAuditLog.findMany({
        where: { partnerEmployeeId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return res.json({ logs });
    } catch (error) {
      console.error('Errore audit logs:', error);
      return res.status(500).json({ error: 'Errore durante recupero audit logs' });
    }
  }
);

// ========== ADMIN ENDPOINTS ==========

/**
 * GET /api/auth/2fa/admin/status
 * Stato 2FA di tutti i partner (solo ADMIN Discovery)
 */
router.get('/admin/status', async (req: Request, res: Response) => {
  try {
    // TODO: Aggiungere autenticazione admin Discovery
    const stats = await prisma.partnerEmployee.groupBy({
      by: ['twoFactorEnabled'],
      _count: true,
    });

    const locked = await prisma.partnerEmployee.count({
      where: {
        twoFactorLockedUntil: {
          gt: new Date(),
        },
      },
    });

    return res.json({
      stats,
      lockedAccounts: locked,
    });
  } catch (error) {
    console.error('Errore stats 2FA:', error);
    return res.status(500).json({ error: 'Errore durante recupero statistiche' });
  }
});

/**
 * POST /api/auth/2fa/admin/force-reset
 * Reset forzato 2FA (emergenza, solo ADMIN Discovery)
 */
router.post('/admin/force-reset/:employeeId', async (req: Request, res: Response) => {
  try {
    // TODO: Aggiungere autenticazione admin Discovery
    const { employeeId } = req.params;

    await twoFactorService.disableTwoFactor(employeeId);

    return res.json({
      message: 'Reset 2FA completato',
      employeeId,
    });
  } catch (error) {
    console.error('Errore force reset:', error);
    return res.status(500).json({ error: 'Errore durante reset forzato' });
  }
});

export default router;
