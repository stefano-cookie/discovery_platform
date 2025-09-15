import { Router } from 'express';
import { PrismaClient, PartnerEmployeeRole } from '@prisma/client';
import { authenticateUnified, authenticatePartner, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// Get partner company stats
router.get('/stats', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Simple stats for now - include both owned and generated registrations
    const totalRegistrations = await prisma.registration.count({
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      }
    });

    const activeRegistrations = await prisma.registration.count({
      where: { 
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ],
        status: { in: ['ENROLLED', 'CONTRACT_SIGNED'] }
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentRegistrations = await prisma.registration.count({
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ],
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    res.json({
      totalRegistrations,
      activeRegistrations,
      recentRegistrations,
      totalRevenue: 0 // Simplified for now
    });

  } catch (error) {
    console.error('Error getting partner stats:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner users - simplified
router.get('/users', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    const registrations = await prisma.registration.findMany({
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit for performance
    });

    const users = registrations.map(reg => ({
      id: reg.user.id,
      email: reg.user.email,
      firstName: '',
      lastName: '', 
      phoneNumber: '',
      emailVerified: reg.user.emailVerified,
      registrationStatus: reg.status,
      registrationDate: reg.createdAt,
      finalAmount: Number(reg.finalAmount || 0)
    }));

    res.json({ users, total: users.length });

  } catch (error) {
    console.error('Error getting partner users:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner analytics - simplified
router.get('/analytics', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Status distribution
    const statusData = await prisma.registration.groupBy({
      by: ['status'],
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      },
      _count: { id: true }
    });

    res.json({
      monthlyRegistrations: [],
      statusDistribution: statusData,
      courseDistribution: { 'CERTIFICATION': 0, 'TFA': 0 }
    });

  } catch (error) {
    console.error('Error getting partner analytics:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get company hierarchy for ADMINISTRATIVE users
router.get('/companies/hierarchy', authenticatePartner, async (req: AuthRequest, res) => {
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

    let companies = [];
    
    // Only ADMINISTRATIVE users can see hierarchy
    if (employee.role === 'ADMINISTRATIVE') {
      // Get all child companies
      const getAllChildren = async (parentId: string): Promise<any[]> => {
        const children = await prisma.partnerCompany.findMany({
          where: { parentId },
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        });
        
        let allChildren = [...children];
        for (const child of children) {
          const grandChildren = await getAllChildren(child.id);
          allChildren = allChildren.concat(grandChildren);
        }
        
        return allChildren;
      };
      
      const childrenCompanies = await getAllChildren(employee.partnerCompanyId);
      
      companies = [
        {
          id: employee.partnerCompany.id,
          name: employee.partnerCompany.name,
          referralCode: employee.partnerCompany.referralCode
        },
        ...childrenCompanies
      ];
    } else {
      // COMMERCIAL users only see their own company
      companies = [{
        id: employee.partnerCompany.id,
        name: employee.partnerCompany.name,
        referralCode: employee.partnerCompany.referralCode
      }];
    }

    res.json({ companies });

  } catch (error) {
    console.error('Error getting company hierarchy:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ========================================
// PARTNER OFFERS MANAGEMENT
// ========================================

// Get partner offers
router.get('/offers', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get offers for the partner company
    const offers = await prisma.partnerOffer.findMany({
      where: { partnerCompanyId: employee.partnerCompanyId },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(offers);

  } catch (error) {
    console.error('Error getting partner offers:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner offer
router.post('/offers', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    const { courseId, name, offerType, totalAmount, installments, installmentFrequency, customPaymentPlan } = req.body;

    // Validation
    if (!courseId || !name || !offerType || !totalAmount || !installments || !installmentFrequency) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    if (!['TFA_ROMANIA', 'CERTIFICATION'].includes(offerType)) {
      return res.status(400).json({ error: 'Tipo offerta non valido' });
    }

    if (totalAmount <= 0 || installments <= 0 || installmentFrequency <= 0) {
      return res.status(400).json({ error: 'I valori di importo e rate devono essere positivi' });
    }

    // Generate unique referral link
    const generateReferralLink = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let referralLink = generateReferralLink();
    
    // Ensure uniqueness
    let existing = await prisma.partnerOffer.findUnique({ where: { referralLink } });
    while (existing) {
      referralLink = generateReferralLink();
      existing = await prisma.partnerOffer.findUnique({ where: { referralLink } });
    }

    const offer = await prisma.partnerOffer.create({
      data: {
        partnerId: legacyPartner.id,
        partnerCompanyId: employee.partnerCompanyId,
        courseId,
        name,
        offerType,
        totalAmount,
        installments,
        installmentFrequency,
        customPaymentPlan,
        referralLink,
        isActive: true
      },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      }
    });

    res.json(offer);

  } catch (error) {
    console.error('Error creating partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update partner offer
router.put('/offers/:id', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    const { name, totalAmount, installments, installmentFrequency, customPaymentPlan } = req.body;

    // Update offer - only if it belongs to this partner
    const offer = await prisma.partnerOffer.updateMany({
      where: {
        id,
        partnerId: legacyPartner.id
      },
      data: {
        name,
        totalAmount,
        installments,
        installmentFrequency,
        customPaymentPlan
      }
    });

    if (offer.count === 0) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Get updated offer with includes
    const updatedOffer = await prisma.partnerOffer.findUnique({
      where: { id },
      include: {
        course: true,
        _count: {
          select: { registrations: true }
        }
      }
    });

    res.json(updatedOffer);

  } catch (error) {
    console.error('Error updating partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete partner offer
router.delete('/offers/:id', authenticatePartner, async (req: AuthRequest, res) => {
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

    // Only ADMINISTRATIVE users can manage offers
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire le offerte' });
    }

    // Get legacy partner for compatibility
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: employee.id }
    });

    if (!legacyPartner) {
      return res.status(400).json({ error: 'Partner legacy non trovato' });
    }

    // Check if offer has registrations
    const offerWithRegistrations = await prisma.partnerOffer.findFirst({
      where: {
        id,
        partnerId: legacyPartner.id
      },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });

    if (!offerWithRegistrations) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    if (offerWithRegistrations._count.registrations > 0) {
      return res.status(400).json({ error: 'Impossibile eliminare offerte con iscrizioni attive' });
    }

    // Delete offer
    await prisma.partnerOffer.delete({
      where: { id }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting partner offer:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ========================================
// PARTNER INVITE SYSTEM
// ========================================

// Get collaborators for the company
router.get('/collaborators', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: { partnerCompany: true }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE can manage collaborators
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono gestire i collaboratori' });
    }

    const collaborators = await prisma.partnerEmployee.findMany({
      where: { 
        partnerCompanyId: employee.partnerCompanyId,
        id: { not: employeeId } // Esclude l'utente corrente dalla lista
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isOwner: true,
        inviteToken: true,
        acceptedAt: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const collaboratorsWithStatus = collaborators.map(collab => ({
      ...collab,
      status: collab.acceptedAt ? 'ACTIVE' : 'PENDING_INVITATION',
      inviteToken: undefined // Don't send token to client
    }));

    res.json({ collaborators: collaboratorsWithStatus });

  } catch (error) {
    console.error('Error getting collaborators:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Invite new collaborator
router.post('/invite', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { email, role, firstName, lastName } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    // Validation
    if (!email || !role || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, ruolo, nome e cognome sono obbligatori' });
    }

    if (!Object.values(PartnerEmployeeRole).includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido' });
    }

    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: { partnerCompany: true }
    });

    if (!employee || !employee.partnerCompany) {
      return res.status(400).json({ error: 'Azienda partner non trovata' });
    }

    // Only ADMINISTRATIVE can invite collaborators
    if (employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono invitare collaboratori' });
    }

    // Check if email already exists in the system
    const [existingUser, existingPartnerEmployee] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.partnerEmployee.findFirst({ where: { email } })
    ]);

    if (existingUser) {
      return res.status(400).json({ error: 'Questa email è già registrata come utente nel sistema' });
    }

    if (existingPartnerEmployee) {
      if (existingPartnerEmployee.partnerCompanyId === employee.partnerCompanyId) {
        return res.status(400).json({ error: 'Un collaboratore con questa email esiste già in questa azienda' });
      } else {
        return res.status(400).json({ error: 'Questa email è già registrata come dipendente di un\'altra azienda partner' });
      }
    }

    // Generate secure invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setHours(inviteExpiresAt.getHours() + 72); // 72 hours expiry

    // Create temporary password (will be set by user during acceptance)
    const tempPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    // Create pending collaborator
    let newCollaborator;
    try {
      newCollaborator = await prisma.partnerEmployee.create({
        data: {
          partnerCompanyId: employee.partnerCompanyId,
          email,
          password: tempPassword,
          firstName,
          lastName,
          role,
          isActive: false, // Will be activated when invite is accepted
          inviteToken,
          inviteExpiresAt,
          invitedBy: employeeId
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          partnerCompany: {
            select: {
              name: true
            }
          }
        }
      });
    } catch (createError: any) {
      // Handle specific database errors
      if (createError.code === 'P2002' && createError.meta?.target?.includes('email')) {
        return res.status(400).json({ error: 'Questa email è già in uso nel sistema' });
      }
      console.error('Error creating collaborator:', createError);
      return res.status(500).json({ error: 'Errore nella creazione del collaboratore' });
    }

    // Send invite email
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/accept-invite/${inviteToken}`;
    
    try {
      await emailService.sendPartnerInvite(
        email, 
        inviteUrl, 
        employee.partnerCompany.name, 
        `${employee.firstName} ${employee.lastName}`,
        role
      );
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      // Don't fail the request if email sending fails, just log it
    }

    // Log activity
    await prisma.partnerActivityLog.create({
      data: {
        partnerEmployeeId: employeeId,
        action: 'INVITE_COLLABORATOR',
        details: {
          invitedEmail: email,
          invitedRole: role,
          invitedName: `${firstName} ${lastName}`
        }
      }
    });

    res.json({ 
      message: 'Invito inviato con successo',
      collaborator: {
        ...newCollaborator,
        status: 'PENDING_INVITATION'
      }
    });

  } catch (error) {
    console.error('Error inviting collaborator:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Accept invite
router.post('/accept-invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token e password sono obbligatori' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve essere lunga almeno 6 caratteri' });
    }

    // Find collaborator with valid invite token
    const collaborator = await prisma.partnerEmployee.findFirst({
      where: {
        inviteToken: token,
        inviteExpiresAt: {
          gt: new Date()
        },
        acceptedAt: null
      },
      include: {
        partnerCompany: true
      }
    });

    if (!collaborator) {
      return res.status(400).json({ error: 'Token di invito non valido o scaduto' });
    }

    // Hash password and activate collaborator
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const updatedCollaborator = await prisma.partnerEmployee.update({
      where: { id: collaborator.id },
      data: {
        password: hashedPassword,
        isActive: true,
        acceptedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        partnerCompany: {
          select: {
            id: true,
            name: true,
            referralCode: true
          }
        }
      }
    });

    // Log activity
    await prisma.partnerActivityLog.create({
      data: {
        partnerEmployeeId: updatedCollaborator.id,
        action: 'ACCEPT_INVITE',
        details: {
          acceptedAt: new Date()
        }
      }
    });

    res.json({ 
      message: 'Invito accettato con successo',
      collaborator: updatedCollaborator
    });

  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Resend invite
router.post('/collaborators/:id/resend-invite', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId },
      include: { partnerCompany: true }
    });

    if (!employee || employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Non autorizzato' });
    }

    const collaborator = await prisma.partnerEmployee.findFirst({
      where: {
        id,
        partnerCompanyId: employee.partnerCompanyId,
        acceptedAt: null
      }
    });

    if (!collaborator) {
      return res.status(404).json({ error: 'Collaboratore non trovato o già attivo' });
    }

    // Generate new invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setHours(inviteExpiresAt.getHours() + 72);

    await prisma.partnerEmployee.update({
      where: { id },
      data: {
        inviteToken,
        inviteExpiresAt
      }
    });

    // Send new invite email
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/partner/accept-invite/${inviteToken}`;
    
    try {
      await emailService.sendPartnerInvite(
        collaborator.email, 
        inviteUrl, 
        employee.partnerCompany.name, 
        `${employee.firstName} ${employee.lastName}`,
        collaborator.role
      );
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
    }

    res.json({ message: 'Invito rinviato con successo' });

  } catch (error) {
    console.error('Error resending invite:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update collaborator (only ADMINISTRATIVE)
router.put('/collaborators/:id', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    const { role, isActive } = req.body;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId }
    });

    if (!employee || employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono modificare i collaboratori' });
    }

    // Cannot modify self
    if (id === employeeId) {
      return res.status(400).json({ error: 'Non puoi modificare te stesso' });
    }

    // Find collaborator to update
    const collaboratorToUpdate = await prisma.partnerEmployee.findFirst({
      where: {
        id,
        partnerCompanyId: employee.partnerCompanyId
      }
    });

    if (!collaboratorToUpdate) {
      return res.status(404).json({ error: 'Collaboratore non trovato' });
    }

    // Cannot modify owner
    if (collaboratorToUpdate.isOwner) {
      return res.status(400).json({ error: 'Non puoi modificare il proprietario dell\'azienda' });
    }

    // Validate role if provided
    if (role && !Object.values(PartnerEmployeeRole).includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido' });
    }

    // Build update data
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update collaborator
    const updatedCollaborator = await prisma.partnerEmployee.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isOwner: true,
        acceptedAt: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    // Log activity
    await prisma.partnerActivityLog.create({
      data: {
        partnerEmployeeId: employeeId,
        action: 'UPDATE_COLLABORATOR',
        details: {
          updatedEmail: updatedCollaborator.email,
          updatedName: `${updatedCollaborator.firstName} ${updatedCollaborator.lastName}`,
          changes: updateData
        }
      }
    });

    res.json({ 
      message: 'Collaboratore aggiornato con successo',
      collaborator: {
        ...updatedCollaborator,
        status: updatedCollaborator.acceptedAt ? 'ACTIVE' : 'PENDING_INVITATION'
      }
    });

  } catch (error) {
    console.error('Error updating collaborator:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Remove collaborator (only ADMINISTRATIVE)
router.delete('/collaborators/:id', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const employeeId = req.partnerEmployee?.id;
    const { id } = req.params;
    
    if (!employeeId) {
      return res.status(400).json({ error: 'Partner employee non trovato' });
    }

    const employee = await prisma.partnerEmployee.findUnique({
      where: { id: employeeId }
    });

    if (!employee || employee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Solo gli utenti ADMINISTRATIVE possono rimuovere collaboratori' });
    }

    // Cannot remove self
    if (id === employeeId) {
      return res.status(400).json({ error: 'Non puoi rimuovere te stesso' });
    }

    // Cannot remove owner
    const collaboratorToRemove = await prisma.partnerEmployee.findFirst({
      where: {
        id,
        partnerCompanyId: employee.partnerCompanyId
      }
    });

    if (!collaboratorToRemove) {
      return res.status(404).json({ error: 'Collaboratore non trovato' });
    }

    if (collaboratorToRemove.isOwner) {
      return res.status(400).json({ error: 'Non puoi rimuovere il proprietario dell\'azienda' });
    }

    // Remove collaborator
    await prisma.partnerEmployee.delete({
      where: { id }
    });

    // Log activity
    await prisma.partnerActivityLog.create({
      data: {
        partnerEmployeeId: employeeId,
        action: 'REMOVE_COLLABORATOR',
        details: {
          removedEmail: collaboratorToRemove.email,
          removedName: `${collaboratorToRemove.firstName} ${collaboratorToRemove.lastName}`
        }
      }
    });

    res.json({ message: 'Collaboratore rimosso con successo' });

  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;