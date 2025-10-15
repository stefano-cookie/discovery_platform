/**
 * Admin Account Management Routes
 * Multi-admin system for Discovery platform
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Middleware to ensure user is ADMIN
const requireAdmin = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

/**
 * GET /api/admin/accounts
 * List all admin accounts
 */
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminAccounts = await prisma.adminAccount.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: adminAccounts,
    });
  } catch (error: any) {
    console.error('Error fetching admin accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin accounts',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/accounts/:id
 * Get single admin account details
 */
router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const adminAccount = await prisma.adminAccount.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
        performedActions: {
          take: 20,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!adminAccount) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    res.json({
      success: true,
      data: adminAccount,
    });
  } catch (error: any) {
    console.error('Error fetching admin account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin account',
      details: error.message,
    });
  }
});

/**
 * POST /api/admin/accounts
 * Create new admin account
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, displayName, password } = req.body;

    // Validation
    if (!email || !displayName || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, display name, and password are required',
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with ADMIN role
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
        emailVerified: true, // Auto-verify admin accounts
      },
    });

    // Create admin account
    const adminAccount = await prisma.adminAccount.create({
      data: {
        userId: user.id,
        displayName,
        email,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
      },
    });

    // Log the action
    const performingAdmin = (req as any).user;
    const performingAdminAccount = await prisma.adminAccount.findUnique({
      where: { userId: performingAdmin.id },
    });

    await prisma.discoveryAdminLog.create({
      data: {
        adminId: performingAdmin.id,
        adminAccountId: performingAdminAccount?.id,
        performedBy: performingAdminAccount?.displayName || performingAdmin.email,
        action: 'COMPANY_CREATE', // Using existing enum, can add ADMIN_CREATE later
        targetType: 'ADMIN',
        targetId: adminAccount.id,
        newValue: {
          email: adminAccount.email,
          displayName: adminAccount.displayName,
        },
        reason: 'Created new admin account',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: adminAccount,
    });
  } catch (error: any) {
    console.error('Error creating admin account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create admin account',
      details: error.message,
    });
  }
});

/**
 * PUT /api/admin/accounts/:id
 * Update admin account
 */
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, isActive } = req.body;

    const existingAccount = await prisma.adminAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    // Update admin account
    const updatedAccount = await prisma.adminAccount.update({
      where: { id },
      data: {
        ...(displayName && { displayName }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            twoFactorEnabled: true,
            createdAt: true,
          },
        },
      },
    });

    // Also update User.isActive if provided
    if (typeof isActive === 'boolean') {
      await prisma.user.update({
        where: { id: existingAccount.userId },
        data: { isActive },
      });
    }

    // Log the action
    const performingAdmin = (req as any).user;
    const performingAdminAccount = await prisma.adminAccount.findUnique({
      where: { userId: performingAdmin.id },
    });

    await prisma.discoveryAdminLog.create({
      data: {
        adminId: performingAdmin.id,
        adminAccountId: performingAdminAccount?.id,
        performedBy: performingAdminAccount?.displayName || performingAdmin.email,
        action: 'COMPANY_EDIT', // Using existing enum
        targetType: 'ADMIN',
        targetId: id,
        previousValue: {
          displayName: existingAccount.displayName,
          isActive: existingAccount.isActive,
        },
        newValue: {
          displayName: updatedAccount.displayName,
          isActive: updatedAccount.isActive,
        },
        reason: 'Updated admin account',
      },
    });

    res.json({
      success: true,
      message: 'Admin account updated successfully',
      data: updatedAccount,
    });
  } catch (error: any) {
    console.error('Error updating admin account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update admin account',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/admin/accounts/:id
 * Deactivate admin account (soft delete)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const performingAdmin = (req as any).user;

    const existingAccount = await prisma.adminAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    // Prevent self-deactivation
    if (existingAccount.userId === performingAdmin.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account',
      });
    }

    // Deactivate (soft delete)
    const updatedAccount = await prisma.adminAccount.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.user.update({
      where: { id: existingAccount.userId },
      data: { isActive: false },
    });

    // Log the action
    const performingAdminAccount = await prisma.adminAccount.findUnique({
      where: { userId: performingAdmin.id },
    });

    await prisma.discoveryAdminLog.create({
      data: {
        adminId: performingAdmin.id,
        adminAccountId: performingAdminAccount?.id,
        performedBy: performingAdminAccount?.displayName || performingAdmin.email,
        action: 'COMPANY_DISABLE', // Using existing enum
        targetType: 'ADMIN',
        targetId: id,
        reason: 'Deactivated admin account',
      },
    });

    res.json({
      success: true,
      message: 'Admin account deactivated successfully',
      data: updatedAccount,
    });
  } catch (error: any) {
    console.error('Error deactivating admin account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate admin account',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/accounts/current/info
 * Get current admin account info
 */
router.get('/current/info', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;

    const adminAccount = await prisma.adminAccount.findUnique({
      where: { userId: currentUser.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            twoFactorEnabled: true,
          },
        },
      },
    });

    if (!adminAccount) {
      return res.status(404).json({
        success: false,
        error: 'Admin account not found',
      });
    }

    res.json({
      success: true,
      data: adminAccount,
    });
  } catch (error: any) {
    console.error('Error fetching current admin info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin info',
      details: error.message,
    });
  }
});

export default router;
