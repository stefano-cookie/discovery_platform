import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import { activityLogger } from '../services/activityLogger.service';

const router = Router();
const prisma = new PrismaClient();

const PASSWORD_EXPIRY_DAYS = 90;

/**
 * Password validation regex:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - Allowed special characters: @$!%*?&;.
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&;.]{8,}$/;

/**
 * Calculate password expiration date (90 days from now)
 */
const calculatePasswordExpiry = (): Date => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + PASSWORD_EXPIRY_DAYS);
  return expiryDate;
};

/**
 * Change password for User (role: USER or ADMIN)
 */
router.post('/user/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Password corrente e nuova password sono obbligatorie'
      });
    }

    // Validate new password strength
    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        error: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola e un numero'
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Password corrente errata' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'La nuova password deve essere diversa dalla password corrente'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and expiration date
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        passwordExpiresAt: calculatePasswordExpiry(),
        passwordExpiryReminderSentAt: null // Reset reminder flag
      }
    });

    // Log password change action
    await prisma.discoveryAdminLog.create({
      data: {
        adminId: userId,
        action: 'PASSWORD_CHANGE',
        targetType: 'USER',
        targetId: userId,
        previousValue: {
          email: user.email,
          role: user.role
        },
        newValue: {
          email: user.email,
          role: user.role,
          passwordChangedAt: new Date().toISOString(),
          passwordExpiresAt: calculatePasswordExpiry().toISOString()
        },
        reason: 'User-initiated password change',
        ipAddress: req.ip
      }
    });

    // Send confirmation email (non-blocking)
    try {
      await emailService.sendPasswordChangeConfirmation(user.email, user.role);
    } catch (emailError) {
      console.error('Errore invio email conferma cambio password (non bloccante):', emailError);
      // Continue anyway - password was changed successfully
    }

    res.json({
      success: true,
      message: 'Password modificata con successo. La nuova password scadrà tra 90 giorni.'
    });

  } catch (error) {
    console.error('Error changing user password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * Change password for PartnerEmployee
 */
router.post('/partner/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, partnerEmployeeId } = req.body;

    if (!partnerEmployeeId || !currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'ID dipendente, password corrente e nuova password sono obbligatorie'
      });
    }

    // Validate new password strength
    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        error: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola e un numero'
      });
    }

    // Get partner employee from database
    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: partnerEmployeeId }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Dipendente non trovato' });
    }

    if (!employee.isActive) {
      return res.status(403).json({ error: 'Account disattivato' });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, employee.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Password corrente errata' });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, employee.password);
    if (isSamePassword) {
      return res.status(400).json({
        error: 'La nuova password deve essere diversa dalla password corrente'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and expiration date
    await prisma.partnerEmployee.update({
      where: { id: partnerEmployeeId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        passwordExpiresAt: calculatePasswordExpiry(),
        passwordExpiryReminderSentAt: null // Reset reminder flag
      }
    });

    // Log partner password change activity
    await activityLogger.log({
        partnerEmployeeId: employee.id,
        partnerCompanyId: employee.partnerCompanyId,
        action: 'PASSWORD_CHANGE',
        category: 'CRITICAL',
        method: 'POST',
        endpoint: '/api/password/partner/change-password',
        resourceType: 'PARTNER_EMPLOYEE',
        resourceId: employee.id,
        details: {
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName,
          passwordChangedAt: new Date().toISOString(),
          passwordExpiresAt: calculatePasswordExpiry().toISOString()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Send confirmation email (non-blocking)
    try {
      await emailService.sendPasswordChangeConfirmation(employee.email, 'PARTNER');
    } catch (emailError) {
      console.error('Errore invio email conferma cambio password (non bloccante):', emailError);
      // Continue anyway - password was changed successfully
    }

    res.json({
      success: true,
      message: 'Password modificata con successo. La nuova password scadrà tra 90 giorni.'
    });

  } catch (error) {
    console.error('Error changing partner password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

/**
 * Check password expiration status for authenticated user
 */
router.get('/check-expiration', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type; // 'user' or 'partner'

    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }

    let expiresAt: Date | null = null;
    let daysUntilExpiry: number | null = null;
    let isExpired = false;

    if (userType === 'partner') {
      // Check PartnerEmployee
      const employee = await prisma.partnerEmployee.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });

      if (employee?.passwordExpiresAt) {
        expiresAt = employee.passwordExpiresAt;
      }
    } else {
      // Check User
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });

      if (user?.passwordExpiresAt) {
        expiresAt = user.passwordExpiresAt;
      }
    }

    if (expiresAt) {
      const now = new Date();
      const timeDiff = expiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      isExpired = daysUntilExpiry <= 0;
    }

    res.json({
      expiresAt,
      daysUntilExpiry,
      isExpired,
      requiresChange: isExpired
    });

  } catch (error) {
    console.error('Error checking password expiration:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;
