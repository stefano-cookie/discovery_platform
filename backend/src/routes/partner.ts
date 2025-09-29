import { Router, Response as ExpressResponse } from 'express';
import { PrismaClient, DocumentStatus } from '@prisma/client';
// Auto-progression fix for certification status
import { authenticate, authenticateUnified, requireRole, requirePartnerRole, AuthRequest } from '../middleware/auth';
import { ContractService } from '../services/contractService';
import { DocumentService, upload as documentUpload } from '../services/documentService';
// import UnifiedDocumentService from '../services/unifiedDocumentService'; // OBSOLETO - ora usa DocumentService
import multer from 'multer';
import emailService from '../services/emailService';
import storageManager from '../services/storageManager';
import * as path from 'path';
import ExcelJS from 'exceljs';

const router = Router();
const prisma = new PrismaClient();

// Helper function to check if a user is orphaned for a specific partner
async function isUserOrphaned(userId: string, partnerCompanyId: string): Promise<boolean> {
  // Check if user has any registrations with this partner
  // A user is orphaned ONLY if they have never completed any registration
  const registrations = await prisma.registration.count({
    where: {
      userId,
      partnerCompanyId
    }
  });

  // User is orphaned if they have no registrations at all
  // UserOfferAccess (offer permissions) don't affect orphaned status
  return registrations === 0;
}
const contractService = new ContractService();

/**
 * Calculate the project root directory
 * Works in both development and production environments
 */
function getProjectRoot(): string {
  // In development: __dirname is like /path/to/project/backend/src/routes
  // In production: __dirname is like /path/to/project/backend/dist/routes

  let currentDir = __dirname;

  // Walk up the directory tree to find the project root
  // Look for package.json or backend directory to identify project root
  while (currentDir !== path.dirname(currentDir)) { // Not at filesystem root
    const parentDir = path.dirname(currentDir);

    // Check if parent contains backend directory (indicating project root)
    if (require('fs').existsSync(path.join(parentDir, 'backend')) &&
        (require('fs').existsSync(path.join(parentDir, 'package.json')) ||
         require('fs').existsSync(path.join(parentDir, 'frontend')))) {
      console.log(`[ROUTES] Found project root: ${parentDir}`);
      return parentDir;
    }

    currentDir = parentDir;
  }

  // Fallback: assume current working directory is project root
  console.log(`[ROUTES] Using fallback project root: ${process.cwd()}`);
  return process.cwd();
}

// Helper function to check if a partner company can manage a registration
const canManageRegistration = async (partnerCompanyId: string, registrationId: string): Promise<{ canManage: boolean, isReadOnly: boolean }> => {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      partnerCompany: true,
      sourcePartnerCompany: true
    }
  });

  if (!registration) {
    return { canManage: false, isReadOnly: false };
  }

  // If the partner company is the direct owner, they can fully manage
  if (registration.partnerCompanyId === partnerCompanyId) {
    return { canManage: true, isReadOnly: false };
  }

  // If the partner company is the source (child), they can only view (read-only)
  if (registration.sourcePartnerCompanyId === partnerCompanyId) {
    return { canManage: true, isReadOnly: true };
  }

  return { canManage: false, isReadOnly: false };
};

// Helper function to check if a partner company can delete a registration
const canDeleteRegistration = (partnerCompanyId: string, registration: any): boolean => {
  // Parent companies can delete any registration they manage (partnerCompanyId)
  if (registration.partnerCompanyId === partnerCompanyId) {
    return true;
  }

  // Sub-partners can ONLY delete registrations they directly generated (sourcePartnerCompanyId)
  // This means they can only delete their own registrations, not ones managed by parent
  if (registration.sourcePartnerCompanyId === partnerCompanyId && 
      registration.partnerCompanyId !== partnerCompanyId) {
    return true;
  }

  return false;
};

// Configure multer for contract uploads - Use project root for consistency
const contractStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const projectRoot = getProjectRoot();
    const signedContractsDir = path.join(projectRoot, 'backend/uploads/signed-contracts');
    // Ensure directory exists
    if (!require('fs').existsSync(signedContractsDir)) {
      require('fs').mkdirSync(signedContractsDir, { recursive: true });
    }
    cb(null, signedContractsDir);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `signed_contract_temp_${Date.now()}.pdf`);
  }
});

const uploadContract = multer({
  storage: contractStorage,
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo file PDF sono consentiti'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// ==================================================
// ACTION TOKEN SYSTEM per tracking partner azioni
// ==================================================

// Create action token for tracking partner actions
router.post('/actions/create-token', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployeeId = req.partnerEmployee?.id;
    const { actionType, targetUserId, targetOfferId } = req.body;

    if (!partnerCompanyId || !partnerEmployeeId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!actionType || !['GRANT_ACCESS', 'REACTIVATE_USER'].includes(actionType)) {
      return res.status(400).json({ error: 'Action type non valido' });
    }

    // Generate secure token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration (30 minutes)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Create action token
    const actionToken = await prisma.actionToken.create({
      data: {
        token,
        partnerEmployeeId,
        partnerCompanyId,
        actionType,
        targetUserId: targetUserId || null,
        targetOfferId: targetOfferId || null,
        expiresAt
      },
      include: {
        partnerEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        partnerCompany: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ Action token created: ${actionToken.id} for ${actionToken.partnerEmployee.firstName} ${actionToken.partnerEmployee.lastName} (${actionType})`);

    res.json({
      success: true,
      token: actionToken.token,
      expiresAt: actionToken.expiresAt,
      actionType: actionToken.actionType
    });

  } catch (error) {
    console.error('Create action token error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Helper function to validate and consume action token
async function validateAndConsumeActionToken(token: string, actionType: string): Promise<{
  isValid: boolean;
  partnerEmployeeId?: string;
  partnerCompanyId?: string;
  partnerEmployee?: any;
  error?: string;
}> {
  if (!token) {
    return { isValid: false, error: 'Token mancante' };
  }

  try {
    const actionToken = await prisma.actionToken.findUnique({
      where: { token },
      include: {
        partnerEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            partnerCompany: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!actionToken) {
      return { isValid: false, error: 'Token non valido' };
    }

    if (actionToken.isUsed) {
      return { isValid: false, error: 'Token già utilizzato' };
    }

    if (actionToken.expiresAt < new Date()) {
      return { isValid: false, error: 'Token scaduto' };
    }

    if (actionToken.actionType !== actionType) {
      return { isValid: false, error: 'Tipo di azione non corrispondente' };
    }

    // Mark token as used
    await prisma.actionToken.update({
      where: { id: actionToken.id },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    });

    console.log(`✅ Action token consumed: ${actionToken.id} by ${actionToken.partnerEmployee.firstName} ${actionToken.partnerEmployee.lastName} (${actionType})`);

    return {
      isValid: true,
      partnerEmployeeId: actionToken.partnerEmployeeId,
      partnerCompanyId: actionToken.partnerCompanyId,
      partnerEmployee: actionToken.partnerEmployee
    };

  } catch (error) {
    console.error('Token validation error:', error);
    return { isValid: false, error: 'Errore nella validazione del token' };
  }
}

// Get partner stats
router.get('/stats', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Get children partner companies first
    const childrenCompanies = await prisma.partnerCompany.findMany({
      where: { parentId: partnerCompanyId }
    });

    // Count ALL UNIQUE users (both direct and from children) - exclude PARTNER employees
    // This avoids double counting users who appear in both direct and children registrations
    const allCompanyIds = [partnerCompanyId, ...childrenCompanies.map(c => c.id)];

    const allUniqueUsersQuery = await prisma.user.findMany({
      where: {
        role: 'USER', // Only count real users, not PARTNER employees
        registrations: {
          some: {
            OR: [
              { partnerCompanyId: { in: allCompanyIds } },
              { sourcePartnerCompanyId: { in: allCompanyIds } }
            ]
          }
        }
      },
      select: { id: true } // Only need ID for counting
    });

    const totalUniqueUsers = allUniqueUsersQuery.length;

    // For backwards compatibility, also calculate separate counts (but don't sum them)
    const directUsersQuery = await prisma.user.findMany({
      where: {
        role: 'USER',
        registrations: {
          some: {
            OR: [
              { partnerCompanyId },
              { sourcePartnerCompanyId: partnerCompanyId }
            ]
          }
        }
      },
      select: { id: true }
    });
    const directUsers = directUsersQuery.length;

    let childrenUsers = 0;
    if (childrenCompanies.length > 0) {
      const childrenUsersQuery = await prisma.user.findMany({
        where: {
          role: 'USER',
          registrations: {
            some: {
              OR: [
                { partnerCompanyId: { in: childrenCompanies.map(c => c.id) } },
                { sourcePartnerCompanyId: { in: childrenCompanies.map(c => c.id) } }
              ]
            }
          }
        },
        select: { id: true }
      });
      childrenUsers = childrenUsersQuery.length;
    }

    // Also get registration counts for backwards compatibility
    const directRegistrations = await prisma.registration.count({
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      }
    });

    let childrenRegistrations = 0;
    for (const child of childrenCompanies) {
      const count = await prisma.registration.count({
        where: {
          OR: [
            { partnerCompanyId: child.id },
            { sourcePartnerCompanyId: child.id }
          ]
        }
      });
      childrenRegistrations += count;
    }

    // Calculate monthly revenue (simplified) - include all registrations this company is involved with
    const monthlyRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        registration: { 
          OR: [
            { partnerCompanyId },
            { sourcePartnerCompanyId: partnerCompanyId }
          ]
        },
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }
    });

    console.log('📊 STATS DEBUG:', {
      partnerCompanyId,
      totalUniqueUsers, // This is the correct count
      directUsers,
      childrenUsers,
      oldWrongTotal: directUsers + childrenUsers, // This was wrong (double counting)
      directRegistrations,
      childrenRegistrations,
      totalRegistrations: directRegistrations + childrenRegistrations
    });

    res.json({
      // Use UNIQUE user count for totalRegistrations (frontend expects this field name)
      totalRegistrations: totalUniqueUsers, // This is the correct "Utenti Totali" counter
      directRegistrations: directUsers,
      childrenRegistrations: childrenUsers,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      pendingCommissions: 0, // To be implemented
      // Also include actual registration counts for reference
      actualDirectRegistrations: directRegistrations,
      actualChildrenRegistrations: childrenRegistrations,
      actualTotalRegistrations: directRegistrations + childrenRegistrations
    });
  } catch (error) {
    console.error('Get partner stats error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner users
router.get('/users', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const filter = req.query.filter as string || 'all';
    const subPartnerFilter = req.query.subPartner as string; // ID del sub-partner specifico
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Handle orphaned users filter
    if (filter === 'orphaned') {
      // Find legacy partner ID that corresponds to this partner company
      const partnerCompany = await prisma.partnerCompany.findUnique({
        where: { id: partnerCompanyId },
        select: { referralCode: true }
      });
      
      let legacyPartnerIds: string[] = [];
      if (partnerCompany?.referralCode) {
        const legacyPartners = await prisma.partner.findMany({
          where: {
            OR: [
              { referralCode: { startsWith: partnerCompany.referralCode } },
              { referralCode: { endsWith: 'LEGACY' } }
            ]
          },
          select: { id: true, referralCode: true }
        });
        
        // Filter to only include partners that match this company's base referral code
        const baseCode = partnerCompany.referralCode.split('-')[0];
        legacyPartnerIds = legacyPartners
          .filter(p => p.referralCode.startsWith(baseCode))
          .map(p => p.id);
      }
      
      // Get all users assigned to this partner (both new and legacy systems)
      // EXCLUDE partner employees from the count - only count real users
      const assignedUsers = await prisma.user.findMany({
        where: {
          AND: [
            { role: 'USER' }, // Only count users with USER role, not PARTNER employees
            {
              OR: [
                { assignedPartnerId: partnerCompanyId }, // New system
                { assignedPartnerId: { in: legacyPartnerIds } } // Legacy system
              ]
            }
          ]
        },
        include: {
          profile: true,
          registrations: {
            where: {
              partnerCompanyId: partnerCompanyId
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Filter users who are truly orphaned: no registrations at all
      // UserOfferAccess (offer permissions) don't affect orphaned status
      const orphanedUsers = assignedUsers.filter(user => 
        user.registrations.length === 0
      );

      const users = orphanedUsers.map((user: any) => ({
        id: user.id,
        registrationId: null,
        email: user.email,
        profile: user.profile,
        status: 'ORPHANED',
        course: 'Nessuna iscrizione attiva',
        courseId: null,
        offerType: null,
        isDirectUser: true,
        partnerName: 'Utente orfano',
        requestedByEmployee: 'N/A', // Orphaned users have no registration requester
        canManagePayments: false,
        canDelete: false, // Orphaned users cannot be deleted via registration deletion
        isOrphaned: true,
        createdAt: user.createdAt,
        enrollmentDate: null,
        originalAmount: 0,
        finalAmount: 0,
        installments: 0,
        contractTemplateUrl: null,
        contractSignedUrl: null,
        contractGeneratedAt: null,
        contractUploadedAt: null,
      }));

      return res.json({ users, total: users.length });
    }

    // Check if this company is a sub-partner (has a parent)
    const currentCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });
    
    const isSubPartner = !!currentCompany?.parentId;
    
    let whereClause: any = {};
    
    if (isSubPartner) {
      // For sub-partners: show only registrations they generated (sourcePartnerCompanyId)
      if (filter === 'direct' || filter === 'all') {
        whereClause = { 
          sourcePartnerCompanyId: partnerCompanyId
        };
      } else if (filter === 'children') {
        // Sub-partners cannot have children
        whereClause = { 
          id: 'no-results' // This will return empty results
        };
      }
    } else {
      // For parent companies: existing logic with sub-partner filter
      if (subPartnerFilter) {
        // Filter per specifico sub-partner
        // Verifica che il sub-partner sia effettivamente figlio di questo parent
        const subPartnerCompany = await prisma.partnerCompany.findFirst({
          where: {
            id: subPartnerFilter,
            parentId: partnerCompanyId
          }
        });

        if (!subPartnerCompany) {
          return res.status(400).json({ error: 'Sub-partner non trovato o non autorizzato' });
        }

        // Mostra solo le registrazioni di questo specifico sub-partner
        whereClause = {
          sourcePartnerCompanyId: subPartnerFilter
        };
      } else if (filter === 'direct') {
        // Direct registrations: only registrations that are truly direct (not from sub-partners)
        whereClause = { 
          partnerCompanyId,
          isDirectRegistration: true
        };
      } else if (filter === 'children') {
        const childrenCompanies = await prisma.partnerCompany.findMany({
          where: { parentId: partnerCompanyId },
          select: { id: true }
        });
        const childrenIds = childrenCompanies.map((p: { id: string }) => p.id);
        whereClause = { 
          OR: [
            { partnerCompanyId: { in: childrenIds } },
            { sourcePartnerCompanyId: { in: childrenIds } }
          ]
        };
      } else {
        // All users (direct + children) - include both owned and generated registrations
        const childrenCompanies = await prisma.partnerCompany.findMany({
          where: { parentId: partnerCompanyId },
          select: { id: true }
        });
        const allCompanyIds = [partnerCompanyId, ...childrenCompanies.map((p: { id: string }) => p.id)];
        whereClause = { 
          OR: [
            { partnerCompanyId: { in: allCompanyIds } },
            { sourcePartnerCompanyId: { in: allCompanyIds } }
          ]
        };
      }
    }

    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        user: {
          include: { profile: true }
        },
        partnerCompany: true,
        sourcePartnerCompany: true,
        requestedByEmployee: true, // Include employee who made the registration
        offer: {
          include: { course: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });


    let users = registrations.map((reg: any) => {
      // Check if this partner can delete this registration
      const canDelete = (reg.partnerCompanyId === partnerCompanyId) || 
                       (reg.sourcePartnerCompanyId === partnerCompanyId && reg.partnerCompanyId !== partnerCompanyId);
      
      return {
        id: reg.user.id,
        registrationId: reg.id,
        email: reg.user.email,
        profile: reg.user.profile,
        status: reg.status,
        course: reg.offer?.name || 'Offerta non specificata',
        courseId: reg.courseId,
        offerType: reg.offerType,
        isDirectUser: reg.sourcePartnerCompanyId === partnerCompanyId ? true : reg.isDirectRegistration,
        partnerName: reg.sourcePartnerCompanyId === partnerCompanyId
          ? 'Diretto'
          : (reg.isDirectRegistration
            ? (reg.partnerCompany?.name || 'Partner non specificato')
            : (reg.sourcePartnerCompany?.name || 'Sub-partner non specificato')),
        requestedByEmployee: (() => {
          const result = (() => {
            if (reg.requestedByEmployee) {
              // If both names exist, use them
              if (reg.requestedByEmployee.firstName && reg.requestedByEmployee.lastName) {
                // Check if it's a sub-company registration
                if (reg.sourcePartnerCompanyId && reg.sourcePartnerCompany?.name) {
                  return `${reg.sourcePartnerCompany.name} - ${reg.requestedByEmployee.firstName} ${reg.requestedByEmployee.lastName}`;
                } else if (reg.partnerCompany?.name) {
                  // Callback aggiunta: mostra azienda - dipendente anche per partnerCompany
                  return `${reg.partnerCompany.name} - ${reg.requestedByEmployee.firstName} ${reg.requestedByEmployee.lastName}`;
                } else {
                  return `${reg.requestedByEmployee.firstName} ${reg.requestedByEmployee.lastName}`;
                }
              } else {
                // If employee exists but names are missing, show company or N/A
                if (reg.sourcePartnerCompanyId && reg.sourcePartnerCompany?.name) {
                  return reg.sourcePartnerCompany.name;
                } else if (reg.partnerCompany?.name) {
                  // Callback aggiunta: se non trova nome e cognome, mostra solo nome azienda
                  return reg.partnerCompany.name;
                } else {
                  return 'N/A';
                }
              }
            } else {
              // No employee found
              return 'N/A';
            }
          })();


          return result;
        })(), // Show who made the registration request
        canManagePayments: reg.partnerCompanyId === partnerCompanyId, // Only parent company can manage payments
        canDelete, // New field: can this partner delete this registration
        isOrphaned: false,
        // Date importanti
        createdAt: reg.user.createdAt, // Data registrazione utente
        enrollmentDate: reg.createdAt,  // Data iscrizione al corso
        // Dati pagamento
        originalAmount: Number(reg.originalAmount || 0),
        finalAmount: Number(reg.finalAmount || 0),
        installments: reg.installments,
        // Dati contratto
        contractTemplateUrl: reg.contractTemplateUrl,
        contractSignedUrl: reg.contractSignedUrl,
        contractGeneratedAt: reg.contractGeneratedAt,
        contractUploadedAt: reg.contractUploadedAt,
        // Lista offerte aggiuntive disponibili (sarà implementata dopo)
      };
    });

    // Per il filtro 'all', aggiungi anche gli utenti orfani
    if (filter === 'all') {
      // Find legacy partner ID that corresponds to this partner company
      const partnerCompany = await prisma.partnerCompany.findUnique({
        where: { id: partnerCompanyId },
        select: { referralCode: true }
      });
      
      let legacyPartnerIds: string[] = [];
      if (partnerCompany?.referralCode) {
        const legacyPartners = await prisma.partner.findMany({
          where: {
            OR: [
              { referralCode: { startsWith: partnerCompany.referralCode } },
              { referralCode: { endsWith: 'LEGACY' } }
            ]
          },
          select: { id: true, referralCode: true }
        });
        
        // Filter to only include partners that match this company's base referral code
        const baseCode = partnerCompany.referralCode.split('-')[0];
        legacyPartnerIds = legacyPartners
          .filter(p => p.referralCode.startsWith(baseCode))
          .map(p => p.id);
      }
      
      // Get all users assigned to this partner (both new and legacy systems)
      // EXCLUDE partner employees from the count - only count real users
      const allAssignedUsers = await prisma.user.findMany({
        where: {
          AND: [
            { role: 'USER' }, // Only count users with USER role, not PARTNER employees
            {
              OR: [
                { assignedPartnerId: partnerCompanyId }, // New system
                { assignedPartnerId: { in: legacyPartnerIds } } // Legacy system
              ]
            }
          ]
        },
        include: {
          profile: true,
          registrations: {
            where: {
              partnerCompanyId: partnerCompanyId
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Filter users who are truly orphaned: no registrations at all
      // UserOfferAccess (offer permissions) don't affect orphaned status
      const orphanedUsers = allAssignedUsers.filter(user => 
        user.registrations.length === 0
      );

      const orphanedUsersFormatted = orphanedUsers.map((user: any) => ({
        id: user.id,
        registrationId: null,
        email: user.email,
        profile: user.profile,
        status: 'ORPHANED',
        course: 'Nessuna iscrizione attiva',
        courseId: null,
        offerType: null,
        isDirectUser: true,
        partnerName: 'Utente orfano',
        requestedByEmployee: 'N/A', // Orphaned users have no registration requester
        canManagePayments: false,
        canDelete: false, // Orphaned users cannot be deleted via registration deletion
        isOrphaned: true,
        createdAt: user.createdAt,
        enrollmentDate: null,
        originalAmount: 0,
        finalAmount: 0,
        installments: 0,
        contractTemplateUrl: null,
        contractSignedUrl: null,
        contractGeneratedAt: null,
        contractUploadedAt: null,
      }));

      users = [...users, ...orphanedUsersFormatted];
    }

    res.json({ users, total: users.length });
  } catch (error) {
    console.error('Get partner users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});


// Get documents for a specific registration
router.get('/registrations/:registrationId/documents', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;

    console.log('🔍 DOCUMENTS ENDPOINT 1 (partner.ts:774 - FIRST/ACTIVE) CALLED:', {
      timestamp: new Date().toISOString(),
      registrationId,
      partnerCompanyId,
      endpoint: '/registrations/:registrationId/documents (ACTIVE FIRST INSTANCE)'
    });

    if (!partnerCompanyId) {
      console.log('❌ ENDPOINT 1: Partner company non trovata');
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify that the registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerCompanyId 
      },
      include: {
        userDocuments: true,  // Unified document system
        offer: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Get user documents to match against required documents
    const userDocuments = await prisma.userDocument.findMany({
      where: { userId: registration.userId }
    });

    console.log(`📄 Partner documents check for registration ${registrationId}:`);
    console.log(`- UserDocuments from registration: ${registration.userDocuments.length}`);
    console.log(`- UserDocuments from user: ${userDocuments.length}`);

    // Determine required documents based on offer type - EXACT match with form fields
    let requiredDocuments: any[] = [];
    
    if (registration.offerType === 'TFA_ROMANIA') {
      // Exact mapping from TFA form fields
      requiredDocuments = [
        // Basic documents
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità'
        },
        
        // Certificati di Laurea section
        {
          type: 'CERTIFICATO_TRIENNALE', 
          name: 'Certificato Laurea Triennale',
          required: false,
          description: 'Certificato di laurea triennale o diploma universitario'
        },
        {
          type: 'CERTIFICATO_MAGISTRALE',
          name: 'Certificato Laurea Magistrale', 
          required: false,
          description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento'
        },
        
        // Piani di Studio section
        {
          type: 'PIANO_STUDIO_TRIENNALE',
          name: 'Piano di Studio Triennale',
          required: false,
          description: 'Piano di studio della laurea triennale con lista esami sostenuti'
        },
        {
          type: 'PIANO_STUDIO_MAGISTRALE',
          name: 'Piano di Studio Magistrale',
          required: false,
          description: 'Piano di studio della laurea magistrale, specialistica o vecchio ordinamento'
        },
        
        // Altri Documenti section
        {
          type: 'CERTIFICATO_MEDICO',
          name: 'Certificato Medico di Sana e Robusta Costituzione',
          required: false,
          description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica'
        },
        {
          type: 'CERTIFICATO_NASCITA',
          name: 'Certificato di Nascita',
          required: false,
          description: 'Certificato di nascita o estratto di nascita dal Comune'
        },
        {
          type: 'DIPLOMA_LAUREA',
          name: 'Diploma di Laurea',
          required: false,
          description: 'Diploma di laurea (cartaceo o digitale)'
        },
        {
          type: 'PERGAMENA_LAUREA',
          name: 'Pergamena di Laurea',
          required: false,
          description: 'Pergamena di laurea (documento originale)'
        }
      ];
    } else if (registration.offerType === 'CERTIFICATION') {
      // Certification documents (simplified)
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità'
        },
        {
          type: 'TESSERA_SANITARIA',
          name: 'Tessera Sanitaria / Codice Fiscale',
          required: false,
          description: 'Tessera sanitaria o documento che attesti il codice fiscale'
        }
      ];
    } else {
      // Default fallback
      requiredDocuments = [
        {
          type: 'CARTA_IDENTITA',
          name: 'Carta d\'Identità',
          required: false,
          description: 'Documento d\'identità valido'
        }
      ];
    }

    // Combine all documents from different sources
    const allDocuments = [
      // UserDocuments from user query (with enum types)
      ...userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        filePath: doc.url,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.status === 'APPROVED',
        source: 'UserDocument'
      })),
      // UserDocuments from registration (unified document system)
      ...registration.userDocuments.map(doc => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.originalName,
        filePath: doc.url,
        uploadedAt: doc.uploadedAt,
        isVerified: doc.status === 'APPROVED',
        source: 'UserDocument-Registration'
      }))
    ];

    console.log(`📄 All documents found: ${allDocuments.map(d => `${d.fileName} (${d.type}, ${d.source})`).join(', ')}`);
    console.log(`🔍 Registration offer type: ${registration.offerType}`);
    console.log(`🔍 Required document types: ${requiredDocuments.map(d => d.type).join(', ')}`);

    // Create mapping function between standard DB document types and offer-specific types
    const mapDocumentType = (dbType: string, offerType: string) => {
      // Map standard database types to offer-specific types
      const typeMapping: { [key: string]: { [key: string]: string } } = {
        'TFA_ROMANIA': {
          'IDENTITY_CARD': 'CARTA_IDENTITA',
          'BACHELOR_DEGREE': 'CERTIFICATO_TRIENNALE',
          'MASTER_DEGREE': 'CERTIFICATO_MAGISTRALE',
          'TRANSCRIPT': 'PIANO_STUDIO_TRIENNALE',
          'DIPLOMA': 'DIPLOMA_SUPERIORE',
          'TESSERA_SANITARIA': 'TESSERA_SANITARIA',
          'BIRTH_CERT': 'CERTIFICATO_NASCITA',
          'MEDICAL_CERT': 'CERTIFICATO_MEDICO'
        },
        'CERTIFICATION': {
          'IDENTITY_CARD': 'CARTA_IDENTITA',
          'TESSERA_SANITARIA': 'TESSERA_SANITARIA'
        }
      };

      return typeMapping[offerType]?.[dbType] || dbType;
    };

    // Map user documents to required ones (checking all document sources with type mapping)
    const documentsWithStatus = requiredDocuments.map(reqDoc => {
      // Look for documents that match either the exact type OR map to this type
      const uploadedDoc = allDocuments.find(doc => {
        const exactMatch = doc.type === reqDoc.type;
        const mappedMatch = mapDocumentType(doc.type, registration.offerType || '') === reqDoc.type;
        if (mappedMatch && !exactMatch) {
          console.log(`🎯 Found document via mapping: ${doc.type} -> ${reqDoc.type} for ${doc.fileName}`);
        }
        return exactMatch || mappedMatch;
      });
      
      return {
        id: reqDoc.type,
        name: reqDoc.name,
        type: reqDoc.type,
        required: reqDoc.required,
        description: reqDoc.description,
        uploaded: !!uploadedDoc,
        fileName: uploadedDoc?.fileName || null,
        filePath: uploadedDoc?.filePath || null,
        uploadedAt: uploadedDoc?.uploadedAt || null,
        documentId: uploadedDoc?.id || null, // Add document ID for download
        isVerified: uploadedDoc?.isVerified || false,
        source: uploadedDoc?.source || null // For debugging
      };
    });

    res.json({
      registrationId,
      offerType: registration.offerType,
      documents: documentsWithStatus,
      uploadedCount: documentsWithStatus.filter(doc => doc.uploaded).length,
      totalCount: documentsWithStatus.length,
      requiredCount: documentsWithStatus.filter(doc => doc.required).length,
      completedRequired: documentsWithStatus.filter(doc => doc.required && doc.uploaded).length
    });

  } catch (error) {
    console.error('Get registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get user offers access - for managing what offers a user can access
router.get('/users/:userId/offers', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Get all partner's active offers
    const partnerOffers = await prisma.partnerOffer.findMany({
      where: { 
        partnerCompanyId,
        isActive: true 
      },
      include: {
        course: true
      }
    });

    // Get user's current registrations (original offers they signed up for)
    const userRegistrations = await prisma.registration.findMany({
      where: { 
        userId,
        partnerCompanyId 
      },
      include: {
        offer: true
      }
    });

    // Get user's additional offer access
    const userOfferAccess = await prisma.userOfferAccess.findMany({
      where: {
        userId,
        partnerCompanyId,
        enabled: true
      }
    });

    const accessibleOfferIds = new Set([
      ...userRegistrations.map(reg => reg.partnerOfferId).filter(Boolean),
      ...userOfferAccess.map(access => access.offerId)
    ]);

    const originalOfferIds = new Set(
      userRegistrations.map(reg => reg.partnerOfferId).filter(Boolean)
    );

    const offers = partnerOffers.map(offer => ({
      id: offer.id,
      name: offer.name,
      courseName: offer.course.name,
      offerType: offer.offerType,
      totalAmount: Number(offer.totalAmount),
      installments: offer.installments,
      isActive: offer.isActive,
      hasAccess: accessibleOfferIds.has(offer.id),
      isOriginal: originalOfferIds.has(offer.id)
    }));

    res.json(offers);
  } catch (error) {
    console.error('Get user offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Grant user access to an offer
router.post('/users/:userId/offers/:offerId/grant', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId, offerId } = req.params;
    const actionToken = req.body?.actionToken;

    // DEBUG: Log all authentication data
    console.log('🔍 GRANT ENDPOINT DEBUG:', {
      timestamp: new Date().toISOString(),
      userId,
      offerId,
      partnerCompanyId,
      hasPartnerCompany: !!req.partnerCompany,
      partnerCompany: req.partnerCompany,
      hasPartnerEmployee: !!req.partnerEmployee,
      partnerEmployee: req.partnerEmployee,
      actionToken,
      headers: {
        authorization: req.headers.authorization?.substring(0, 20) + '...',
        'content-type': req.headers['content-type']
      },
      body: req.body
    });

    if (!partnerCompanyId) {
      console.log('❌ GRANT ERROR: Partner company non trovata', { req_partnerCompany: req.partnerCompany });
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify the offer belongs to this partner
    console.log('🔍 Checking offer:', { offerId, partnerCompanyId });
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: offerId,
        partnerCompanyId,
        isActive: true
      }
    });

    console.log('🔍 Offer result:', { found: !!offer, offer });

    if (!offer) {
      console.log('❌ GRANT ERROR: Offerta non trovata', { offerId, partnerCompanyId });
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Variables to track who is responsible for the action
    let actionPerformedBy: string | null = null;
    let actionPerformedByData: any = null;

    // If actionToken is provided, validate and use it for tracking
    if (actionToken) {
      const tokenValidation = await validateAndConsumeActionToken(actionToken, 'GRANT_ACCESS');

      if (!tokenValidation.isValid) {
        return res.status(400).json({ error: tokenValidation.error });
      }

      // Use token data for tracking
      actionPerformedBy = tokenValidation.partnerEmployeeId!;
      actionPerformedByData = tokenValidation.partnerEmployee;

      console.log(`📊 Action tracked: GRANT_ACCESS by ${actionPerformedByData.firstName} ${actionPerformedByData.lastName} for user ${userId}, offer ${offerId}`);
    } else {
      // Fallback to authenticated user (existing behavior)
      actionPerformedBy = req.partnerEmployee?.id || null;
    }

    // Check if user already has access
    const existingAccess = await prisma.userOfferAccess.findUnique({
      where: {
        userId_offerId: {
          userId,
          offerId
        }
      }
    });

    if (existingAccess) {
      // Update existing access to enabled
      await prisma.userOfferAccess.update({
        where: { id: existingAccess.id },
        data: { enabled: true }
      });
    } else {
      // Create new access
      // Find corresponding partnerId for partnerCompanyId for legacy compatibility
      const partnerCompany = req.partnerCompany;
      let legacyPartnerId = null;
      
      // Try to find legacy partner by referral code pattern
      const legacyPartner = await prisma.partner.findFirst({
        where: { 
          OR: [
            { referralCode: { endsWith: 'LEGACY' } },
            { referralCode: { contains: partnerCompany?.referralCode || '' } }
          ]
        }
      });
      
      if (legacyPartner) {
        legacyPartnerId = legacyPartner.id;
      } else {
        // Create a legacy partner for this company if it doesn't exist
        const dummyUserId = `dummy-user-for-partner-${partnerCompanyId}`;
        
        // Check if dummy user exists
        let dummyUser = await prisma.user.findUnique({
          where: { id: dummyUserId }
        });
        
        if (!dummyUser) {
          dummyUser = await prisma.user.create({
            data: {
              id: dummyUserId,
              email: `dummy-${partnerCompanyId}@legacy.system`,
              password: 'dummy-password-hash',
              role: 'PARTNER',
              isActive: false,
              emailVerified: false
            }
          });
        }
        
        // Create legacy partner
        const newLegacyPartner = await prisma.partner.create({
          data: {
            id: `legacy-partner-${partnerCompanyId}`,
            userId: dummyUserId,
            referralCode: `${partnerCompany?.referralCode || 'UNKNOWN'}-LEGACY`,
            canCreateChildren: false,
            commissionPerUser: 0,
            commissionToAdmin: 0
          }
        });
        
        legacyPartnerId = newLegacyPartner.id;
      }
      
      console.log('🔍 Creating UserOfferAccess:', {
        userId,
        offerId,
        partnerId: legacyPartnerId,
        partnerCompanyId,
        enabled: true
      });

      const userOfferAccess = await prisma.userOfferAccess.create({
        data: {
          userId,
          offerId,
          partnerId: legacyPartnerId,
          partnerCompanyId,
          enabled: true
        }
      });

      console.log(`✅ UserOfferAccess created successfully:`, {
        userId,
        offerId,
        partnerCompanyId,
        actionPerformedBy,
        userOfferAccessId: userOfferAccess.id,
        createdRecord: userOfferAccess
      });
    }

    console.log('✅ GRANT SUCCESS: Access granted successfully');
    res.json({ success: true, message: 'Accesso all\'offerta concesso' });
  } catch (error) {
    console.error('🚨 GRANT ENDPOINT ERROR:', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.userId,
      offerId: req.params.offerId,
      partnerCompanyId: req.partnerCompany?.id
    });
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Revoke user access to an offer
router.post('/users/:userId/offers/:offerId/revoke', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId, offerId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: { 
        id: offerId,
        partnerCompanyId,
        isActive: true 
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata o non autorizzata' });
    }

    // Check if this is an original offer (user registered through this offer)
    const originalRegistration = await prisma.registration.findFirst({
      where: {
        userId,
        partnerOfferId: offerId,
        partnerCompanyId
      }
    });

    if (originalRegistration) {
      return res.status(400).json({ 
        error: 'Non puoi revocare l\'accesso all\'offerta originale di iscrizione' 
      });
    }

    // Update or delete access record
    const existingAccess = await prisma.userOfferAccess.findUnique({
      where: {
        userId_offerId: {
          userId,
          offerId
        }
      }
    });

    if (existingAccess) {
      await prisma.userOfferAccess.update({
        where: { id: existingAccess.id },
        data: { enabled: false }
      });
    }

    // Check if user is orphaned (has no registrations)
    // Note: Revoking offer access doesn't make a user orphaned - only lack of registrations does
    const userIsOrphaned = await isUserOrphaned(userId, partnerCompanyId);
    
    res.json({ 
      success: true, 
      message: 'Accesso all\'offerta revocato',
      userIsOrphaned,
      info: userIsOrphaned ? 'L\'utente non ha registrazioni attive ed è considerato orfano' : 'L\'utente ha registrazioni attive'
    });
  } catch (error) {
    console.error('Revoke user offer access error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get partner coupons
router.get('/coupons', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot access coupons
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non hanno accesso ai coupon' });
    }

    // Find legacy partner for this company
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      // Return empty array if no legacy partner exists yet
      return res.json([]);
    }

    const coupons = await prisma.coupon.findMany({
      where: { partnerCompanyId },
      include: {
        uses: true
      },
      orderBy: { validFrom: 'desc' }
    });

    res.json(coupons);
  } catch (error) {
    console.error('Get partner coupons error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Create partner coupon
router.post('/coupons', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    const { code, discountType, discountAmount, discountPercent, maxUses, validFrom, validUntil } = req.body;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot create coupons
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non possono creare coupon' });
    }

    // Find or create legacy partner for this company
    let legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      // Create legacy partner if it doesn't exist (similar to offers.ts logic)
      const dummyUserId = `dummy-user-for-partner-${partnerCompanyId}`;
      
      let dummyUser = await prisma.user.findUnique({
        where: { id: dummyUserId }
      });
      
      if (!dummyUser) {
        dummyUser = await prisma.user.create({
          data: {
            id: dummyUserId,
            email: `dummy-${partnerCompanyId}@legacy.system`,
            password: 'dummy-password-hash',
            role: 'PARTNER',
            isActive: false,
            emailVerified: false
          }
        });
      }
      
      legacyPartner = await prisma.partner.create({
        data: {
          id: `legacy-partner-${partnerCompanyId}`,
          userId: dummyUserId,
          referralCode: `${req.partnerCompany!.referralCode}-LEGACY`,
          canCreateChildren: false,
          commissionPerUser: 0,
          commissionToAdmin: 0
        }
      });
    }

    // Check if coupon code already exists for this partner
    const existingCoupon = await prisma.coupon.findFirst({
      where: {
        partnerCompanyId: partnerCompanyId,
        code
      }
    });

    if (existingCoupon) {
      return res.status(400).json({ error: 'Codice coupon già esistente' });
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        partnerId: legacyPartner.id, // Legacy field
        partnerCompanyId: partnerCompanyId, // Use actual partner company ID
        code,
        discountType,
        discountAmount: discountAmount ? Number(discountAmount) : null,
        discountPercent: discountPercent ? Number(discountPercent) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil)
      }
    });

    res.json({
      success: true,
      coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update coupon status
router.put('/coupons/:id/status', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot modify coupons
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non possono modificare i coupon' });
    }

    // Find legacy partner for this company
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      return res.status(404).json({ error: 'Legacy partner not found' });
    }

    // Update coupon - only if it belongs to this partner
    const coupon = await prisma.coupon.updateMany({
      where: {
        id,
        partnerCompanyId: partnerCompanyId
      },
      data: { isActive }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update coupon status error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete coupon
router.delete('/coupons/:id', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    const { id } = req.params;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot delete coupons
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non possono eliminare i coupon' });
    }

    // Find legacy partner for this company
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      return res.status(404).json({ error: 'Legacy partner not found' });
    }

    // Check if coupon has been used
    const couponUse = await prisma.couponUse.findFirst({
      where: { couponId: id }
    });

    if (couponUse) {
      return res.status(400).json({ error: 'Impossibile eliminare un coupon già utilizzato' });
    }

    // Delete coupon - only if it belongs to this partner company
    const coupon = await prisma.coupon.deleteMany({
      where: {
        id,
        partnerCompanyId: partnerCompanyId
      }
    });

    if (coupon.count === 0) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Validate coupon code
router.post('/coupons/validate', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    const { code } = req.body;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot validate coupons
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non possono validare i coupon' });
    }

    // Find legacy partner for this company
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      return res.status(404).json({ error: 'Legacy partner not found' });
    }

    // Find coupon
    const coupon = await prisma.coupon.findFirst({
      where: {
        code,
        partnerCompanyId: partnerCompanyId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Codice sconto non valido o scaduto' });
    }

    // Check if max uses reached
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Codice sconto esaurito' });
    }

    // Check if coupon was already used
    const existingUse = await prisma.couponUse.findFirst({
      where: { couponId: coupon.id }
    });

    if (existingUse) {
      return res.status(400).json({ error: 'Codice sconto già utilizzato' });
    }

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent
      }
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get coupon usage logs with user details
router.get('/coupons/:couponId/usage-logs', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    const { couponId } = req.params;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company not found' });
    }

    // Check if partner company is a child - children cannot access coupon usage logs
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { parentId: true }
    });

    if (partnerCompany?.parentId) {
      return res.status(403).json({ error: 'I partner figli non hanno accesso ai log dei coupon' });
    }

    // Find legacy partner for this company
    const legacyPartner = await prisma.partner.findFirst({
      where: {
        referralCode: `${req.partnerCompany!.referralCode}-LEGACY`
      }
    });

    if (!legacyPartner) {
      return res.status(404).json({ error: 'Legacy partner not found' });
    }

    // Verify coupon belongs to this partner
    const coupon = await prisma.coupon.findFirst({
      where: {
        id: couponId,
        partnerCompanyId: partnerCompanyId
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon non trovato' });
    }

    // Get usage logs with user and registration details
    const usageLogs = await prisma.couponUse.findMany({
      where: { couponId: couponId },
      include: {
        registration: {
          include: {
            user: {
              include: {
                profile: {
                  select: {
                    nome: true,
                    cognome: true
                  }
                }
              }
            },
            offer: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { usedAt: 'desc' }
    });

    // Transform data for frontend
    const formattedLogs = usageLogs.map(log => ({
      id: log.id,
      usedAt: log.usedAt,
      discountApplied: log.discountApplied,
      user: {
        email: log.registration.user.email,
        nome: log.registration.user.profile?.nome || 'N/A',
        cognome: log.registration.user.profile?.cognome || 'N/A'
      },
      registration: {
        id: log.registrationId,
        offerName: log.registration.offer?.name || 'Offerta diretta'
      }
    }));

    res.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: coupon.discountAmount,
        discountPercent: coupon.discountPercent,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount
      },
      usageLogs: formattedLogs,
      totalUses: formattedLogs.length
    });
  } catch (error) {
    console.error('Get coupon usage logs error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/partners/offer-visibility/:offerId - Get offer visibility settings for users
router.get('/offer-visibility/:offerId', authenticateUnified, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Verify that the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.offerId,
        partnerCompanyId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    // Get all users associated with this partner
    const associatedUsers = await prisma.user.findMany({
      where: { assignedPartnerId: partner.id },
      include: {
        profile: true
      }
    });

    // Get visibility settings for this offer
    const visibilitySettings = await prisma.offerVisibility.findMany({
      where: {
        partnerOfferId: req.params.offerId
      }
    });

    const visibilityMap = new Map(
      visibilitySettings.map(v => [v.userId, v.isVisible])
    );

    // Format response with user info and visibility status
    const userVisibility = associatedUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.profile ? `${user.profile.nome} ${user.profile.cognome}` : 'Nome non disponibile',
      isVisible: visibilityMap.get(user.id) ?? true // Default to visible
    }));

    res.json({ 
      offerId: req.params.offerId,
      users: userVisibility 
    });
  } catch (error) {
    console.error('Error getting offer visibility:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/partners/offer-visibility/:offerId - Update offer visibility for users
router.put('/offer-visibility/:offerId', authenticateUnified, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partner = await prisma.partner.findUnique({
      where: { userId: req.user!.id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Verify that the offer belongs to this partner
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        id: req.params.offerId,
        partnerCompanyId: partner.id
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    const { userVisibility } = req.body;
    
    if (!Array.isArray(userVisibility)) {
      return res.status(400).json({ error: 'userVisibility deve essere un array' });
    }

    // Update visibility settings for each user
    for (const setting of userVisibility) {
      const { userId, isVisible } = setting;
      
      if (typeof userId !== 'string' || typeof isVisible !== 'boolean') {
        continue; // Skip invalid entries
      }

      // Upsert visibility setting
      await prisma.offerVisibility.upsert({
        where: {
          partnerOfferId_userId: {
            partnerOfferId: req.params.offerId,
            userId: userId
          }
        },
        update: {
          isVisible: isVisible
        },
        create: {
          partnerOfferId: req.params.offerId,
          userId: userId,
          isVisible: isVisible
        }
      });
    }

    res.json({ 
      success: true, 
      message: 'Visibilità offerta aggiornata con successo' 
    });
  } catch (error) {
    console.error('Error updating offer visibility:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get registration details for partner
router.get('/registrations/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Check if partner can view this registration
    const { canManage, isReadOnly } = await canManageRegistration(partnerCompanyId, registrationId);
    
    if (!canManage) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        },
        payments: true,
        userDocuments: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    res.json({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      contractTemplateUrl: registration.contractTemplateUrl,
      contractSignedUrl: registration.contractSignedUrl,
      contractGeneratedAt: registration.contractGeneratedAt,
      contractUploadedAt: registration.contractUploadedAt,
      isReadOnly: isReadOnly,
      canManagePayments: !isReadOnly,
      user: {
        id: registration.user.id,
        email: registration.user.email,
        profile: registration.user.profile
      },
      offer: {
        id: registration.offer?.id,
        name: registration.offer?.name || 'Offerta diretta',
        course: registration.offer?.course
      },
      payments: registration.payments,
      userDocuments: registration.userDocuments
    });
  } catch (error) {
    console.error('Get registration details error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Download contract template
router.get('/download-contract/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_DOWNLOAD] Starting download for registration: ${registrationId}, partner: ${partnerCompanyId}`);
    
    if (!partnerCompanyId) {
      console.log('[CONTRACT_DOWNLOAD] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerCompanyId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_DOWNLOAD] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_DOWNLOAD] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_DOWNLOAD] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_DOWNLOAD] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
        console.log('[CONTRACT_DOWNLOAD] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_DOWNLOAD] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file - Use project root for consistency
    const projectRoot = getProjectRoot();
    const contractPath = path.join(projectRoot, 'backend', registration.contractTemplateUrl.substring(1)); // Remove leading slash
    console.log(`[CONTRACT_DOWNLOAD] Attempting to serve existing contract from: ${contractPath}`);
    
    if (!require('fs').existsSync(contractPath)) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Contract file not found at path: ${contractPath}`);
      console.log(`[CONTRACT_DOWNLOAD] Current directory: ${__dirname}`);
      console.log(`[CONTRACT_DOWNLOAD] Resolved path components: dir=${__dirname}, url=${registration.contractTemplateUrl}`);
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    console.log('[CONTRACT_DOWNLOAD] File exists, sending...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[CONTRACT_DOWNLOAD] Full error details:', error);
    console.error('[CONTRACT_DOWNLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Errore durante il download del contratto' });
  }
});

// Preview contract template - inline display
router.get('/preview-contract/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_PREVIEW] Starting preview for registration: ${registrationId}, partner: ${partnerCompanyId}`);
    
    if (!partnerCompanyId) {
      console.log('[CONTRACT_PREVIEW] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerCompanyId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_PREVIEW] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_PREVIEW] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_PREVIEW] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_PREVIEW] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_PREVIEW] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers for inline display and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="contratto_${registrationId}.pdf"`);
        console.log('[CONTRACT_PREVIEW] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_PREVIEW] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file for inline display - Use project root for consistency
    const projectRoot = getProjectRoot();
    const contractPath = path.join(projectRoot, 'backend', registration.contractTemplateUrl.substring(1));
    console.log(`[CONTRACT_PREVIEW] Serving existing contract from: ${contractPath}`);
    
    if (!require('fs').existsSync(contractPath)) {
      console.log(`[CONTRACT_PREVIEW] Error: Contract file not found at path: ${contractPath}`);
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contratto_${registrationId}.pdf"`);
    console.log('[CONTRACT_PREVIEW] Sending existing contract file');
    res.sendFile(contractPath);

  } catch (error) {
    console.error('Preview contract error:', error);
    res.status(500).json({ error: 'Errore durante la preview del contratto' });
  }
});

// Upload signed contract
router.post('/upload-signed-contract', authenticateUnified, uploadContract.single('contract'), async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File non fornito' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerCompanyId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Rename file with proper registrationId
    const oldPath = req.file.path;
    const newFilename = `signed_contract_${registrationId}_${Date.now()}.pdf`;
    const newPath = path.join(path.dirname(oldPath), newFilename);
    require('fs').renameSync(oldPath, newPath);
    
    // Update registration with signed contract info
    const contractSignedUrl = `/uploads/signed-contracts/${newFilename}`;
    
    // Use transaction to update registration and create payment deadlines
    await prisma.$transaction(async (tx) => {
      // Update registration status
      const updatedRegistration = await tx.registration.update({
        where: { id: registrationId },
        data: {
          contractSignedUrl,
          contractUploadedAt: new Date(),
          status: 'CONTRACT_SIGNED' // Update status to next step
        }
      });

      // Check if payment deadlines already exist
      const existingDeadlines = await tx.paymentDeadline.findMany({
        where: { registrationId }
      });

      // Only create payment deadlines if they don't exist yet
      if (existingDeadlines.length === 0) {
        const finalAmount = Number(updatedRegistration.finalAmount);
        const installments = updatedRegistration.installments;
        const offerType = updatedRegistration.offerType;

        console.log(`Creating payment deadlines for registration ${registrationId}:`, {
          finalAmount,
          installments,
          offerType
        });

        // Determine payment structure based on offer type
        if (offerType === 'TFA_ROMANIA' && installments > 1) {
          // TFA with installments: down payment + monthly installments
          const downPayment = 1500;
          const installmentAmount = (finalAmount - downPayment) / installments;
          
          // Create down payment deadline (7 days from now)
          const downPaymentDate = new Date();
          downPaymentDate.setDate(downPaymentDate.getDate() + 7);
          
          await tx.paymentDeadline.create({
            data: {
              registrationId,
              amount: downPayment,
              dueDate: downPaymentDate,
              paymentNumber: 0,
              description: 'Acconto',
              isPaid: false
            }
          });

          // Create monthly installment deadlines
          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() + 37); // First installment 30 days after down payment
          
          for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            await tx.paymentDeadline.create({
              data: {
                registrationId,
                amount: installmentAmount,
                dueDate,
                paymentNumber: i + 1,
                description: `Rata ${i + 1} di ${installments}`,
                isPaid: false
              }
            });
          }
          
          console.log(`Created ${installments + 1} payment deadlines for TFA enrollment`);
        } else if (installments > 1) {
          // Certification with installments: divide equally
          const installmentAmount = finalAmount / installments;
          const baseDate = new Date();
          baseDate.setDate(baseDate.getDate() + 7); // First payment 7 days from now
          
          for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            await tx.paymentDeadline.create({
              data: {
                registrationId,
                amount: installmentAmount,
                dueDate,
                paymentNumber: i + 1,
                description: `Rata ${i + 1} di ${installments}`,
                isPaid: false
              }
            });
          }
          
          console.log(`Created ${installments} payment deadlines for certification enrollment`);
        } else {
          // Single payment
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7);
          
          await tx.paymentDeadline.create({
            data: {
              registrationId,
              amount: finalAmount,
              dueDate,
              paymentNumber: 1,
              description: 'Pagamento unico',
              isPaid: false
            }
          });
          
          console.log('Created single payment deadline');
        }
      } else {
        console.log(`Payment deadlines already exist for registration ${registrationId}, skipping creation`);
      }
    });

    res.json({
      success: true,
      message: 'Contratto firmato caricato con successo',
      contractSignedUrl
    });

  } catch (error) {
    console.error('Upload signed contract error:', error);
    res.status(500).json({ error: 'Errore durante il caricamento del contratto' });
  }
});

// Download signed contract endpoint
router.get('/download-signed-contract/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    console.log(`[SIGNED_CONTRACT_DOWNLOAD] Starting download for registration: ${registrationId}, partner: ${partnerCompanyId}`);
    
    if (!partnerCompanyId) {
      console.log('[SIGNED_CONTRACT_DOWNLOAD] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerCompanyId 
      }
    });

    if (!registration) {
      console.log(`[SIGNED_CONTRACT_DOWNLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (!registration.contractSignedUrl) {
      console.log(`[SIGNED_CONTRACT_DOWNLOAD] Error: No signed contract for registration: ${registrationId}`);
      return res.status(404).json({ error: 'Contratto firmato non disponibile' });
    }

    // Serve the signed contract file - Use project root for consistency
    const projectRoot = getProjectRoot();
    const contractPath = path.join(projectRoot, 'backend', registration.contractSignedUrl.substring(1)); // Remove leading slash
    console.log(`[SIGNED_CONTRACT_DOWNLOAD] Serving signed contract from: ${contractPath}`);
    
    if (!require('fs').existsSync(contractPath)) {
      console.log(`[SIGNED_CONTRACT_DOWNLOAD] Error: Signed contract file not found at path: ${contractPath}`);
      return res.status(404).json({ error: 'File contratto firmato non trovato' });
    }
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_firmato_${registrationId}.pdf"`);
    
    // Send file
    res.sendFile(contractPath);
    
  } catch (error) {
    console.error('[SIGNED_CONTRACT_DOWNLOAD] Error:', error);
    res.status(500).json({ error: 'Errore durante il download del contratto firmato' });
  }
});

// Reset contract cache endpoint
router.delete('/reset-contract/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        contractTemplateUrl: null,
        contractGeneratedAt: null
      }
    });

    res.json({ success: true, message: 'Contract cache reset' });
  } catch (error) {
    console.error('Reset contract cache error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Test contract data endpoint
router.get('/test-contract-data/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
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
        payments: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    res.json({
      registration: {
        id: registration.id,
        offerType: registration.offerType,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments,
        createdAt: registration.createdAt
      },
      user: registration.user,
      profile: registration.user?.profile,
      offer: registration.offer,
      payments: registration.payments
    });
  } catch (error) {
    console.error('Test contract data error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get recent enrollments for dashboard
router.get('/recent-enrollments', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const recentEnrollments = await prisma.registration.findMany({
      where: { partnerCompanyId },
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

// Get pending documents for verification
router.get('/documents/pending', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const pendingDocuments = await DocumentService.getPendingDocumentsForPartner(partnerCompanyId);
    
    const formattedDocs = pendingDocuments.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
      uploadSource: doc.uploadSource,
      user: {
        id: doc.user.id,
        email: doc.user.email,
        name: doc.user.profile ? `${doc.user.profile.nome} ${doc.user.profile.cognome}` : 'Nome non disponibile'
      },
      registration: doc.registration ? {
        id: doc.registration.id,
        courseName: doc.registration.offer?.course?.name || 'Corso non specificato'
      } : null
    }));

    res.json({ 
      pendingDocuments: formattedDocs,
      count: formattedDocs.length
    });
  } catch (error: any) {
    console.error('Get pending documents error:', error);
    res.status(500).json({ error: 'Errore nel caricamento dei documenti in sospeso' });
  }
});

// Get payment deadlines for a registration
router.get('/registrations/:registrationId/deadlines', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Check partner employee role for payment management
    if (req.partnerEmployee && req.partnerEmployee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Accesso negato - richiesto ruolo amministrativo' });
    }

    // Verify registration belongs to partner company
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId,
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Get all payment deadlines
    const deadlines = await prisma.paymentDeadline.findMany({
      where: { registrationId },
      orderBy: { dueDate: 'asc' }
    });

    const formattedDeadlines = deadlines.map(d => ({
      id: d.id,
      amount: Number(d.amount),
      dueDate: d.dueDate,
      description: d.description || `Pagamento ${d.paymentNumber}`,
      isPaid: d.isPaid,
      paidAt: d.paidAt,
      notes: d.notes,
      partialAmount: d.partialAmount ? Number(d.partialAmount) : null,
      paymentStatus: d.paymentStatus
    }));

    // Calculate remaining amount properly including custom payments
    const totalPaid = deadlines.reduce((sum, d) => {
      if (d.isPaid) {
        return sum + Number(d.amount);
      } else if (d.paymentStatus === 'PARTIAL' && d.partialAmount) {
        return sum + Number(d.partialAmount);
      }
      return sum;
    }, 0);
    
    const calculatedRemainingAmount = Number(registration.finalAmount) - totalPaid;

    res.json({
      deadlines: formattedDeadlines,
      remainingAmount: calculatedRemainingAmount,
      delayedAmount: Number(registration.delayedAmount || 0)
    });
  } catch (error) {
    console.error('Get payment deadlines error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark payment deadline as paid and update remaining amount
router.post('/registrations/:registrationId/payments/:deadlineId/mark-paid', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId, deadlineId } = req.params;
    const { notes } = req.body;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Check partner employee role for payment management
    if (req.partnerEmployee && req.partnerEmployee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Accesso negato - richiesto ruolo amministrativo' });
    }

    // Check if partner can manage this registration
    const { canManage, isReadOnly } = await canManageRegistration(partnerCompanyId, registrationId);
    
    if (!canManage) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Block modification operations for read-only access
    if (isReadOnly) {
      return res.status(403).json({ error: 'Operazione non consentita: accesso solo lettura' });
    }

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Find the specific deadline
    const deadline = await prisma.paymentDeadline.findFirst({
      where: {
        id: deadlineId,
        registrationId
      }
    });

    if (!deadline) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    if (deadline.isPaid) {
      return res.status(400).json({ error: 'Pagamento già marcato come pagato' });
    }

    // Mark deadline as paid and create payment record for revenue tracking
    const paymentDate = new Date();
    
    await prisma.$transaction(async (tx) => {
      // Mark deadline as paid
      await tx.paymentDeadline.update({
        where: { id: deadlineId },
        data: {
          isPaid: true,
          paidAt: paymentDate,
          paymentStatus: 'PAID',
          notes
        }
      });

      // Create payment record for revenue tracking
      await tx.payment.create({
        data: {
          registrationId,
          amount: deadline.amount,
          paymentDate,
          paymentNumber: deadline.paymentNumber,
          isFirstPayment: deadline.paymentNumber === 0,
          isConfirmed: true,
          confirmedBy: req.user?.id || req.partnerEmployee?.id,
          confirmedAt: paymentDate,
          notes,
          createdBy: req.user?.id || req.partnerEmployee?.id
        }
      });
    });

    // Calculate remaining amount
    const paidDeadlines = await prisma.paymentDeadline.findMany({
      where: {
        registrationId,
        isPaid: true
      }
    });

    const totalPaid = paidDeadlines.reduce((sum, d) => sum + Number(d.amount), 0);
    const remainingAmount = Number(registration.finalAmount) - totalPaid;

    // Check if all payments are completed for status update
    const allDeadlines = await prisma.paymentDeadline.findMany({
      where: { registrationId }
    });
    const allDeadlinesPaid = allDeadlines.every(d => d.paymentStatus === 'PAID');
    
    // Update registration with remaining amount and status
    const updateData: any = {
      remainingAmount: remainingAmount
    };
    
    // For certifications, automatically move to ENROLLED when all payments are completed
    // We need to fetch offer info since it's not included in the registration
    const registrationWithOffer = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { offer: true }
    });
    
    // Debug logging
    console.log('Payment completion check:', {
      allDeadlinesPaid,
      currentStatus: registration.status,
      offerType: registrationWithOffer?.offer?.offerType,
      registrationId
    });
    
    // Move to ENROLLED when all payments are completed (from CONTRACT_SIGNED or PENDING)
    if (allDeadlinesPaid && ['PENDING', 'CONTRACT_SIGNED'].includes(registration.status) && registrationWithOffer?.offer?.offerType === 'CERTIFICATION') {
      console.log('Updating registration status to ENROLLED for certification');
      updateData.status = 'ENROLLED';
      updateData.enrolledAt = new Date();
    }
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: updateData
    });

    // Get next unpaid deadline
    const nextDeadline = await prisma.paymentDeadline.findFirst({
      where: {
        registrationId,
        isPaid: false
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({
      success: true,
      remainingAmount,
      totalPaid,
      nextDeadline: nextDeadline ? {
        id: nextDeadline.id,
        amount: Number(nextDeadline.amount),
        dueDate: nextDeadline.dueDate,
        description: nextDeadline.description
      } : null
    });
  } catch (error) {
    console.error('Mark payment as paid error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark payment deadline as custom paid
router.post('/registrations/:registrationId/payments/:deadlineId/mark-partial-paid', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId, deadlineId } = req.params;
    const { partialAmount, notes } = req.body;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Check partner employee role for payment management
    if (req.partnerEmployee && req.partnerEmployee.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ error: 'Accesso negato - richiesto ruolo amministrativo' });
    }

    if (!partialAmount || partialAmount <= 0) {
      return res.status(400).json({ error: 'Importo personalizzato non valido' });
    }

    // Check if partner can manage this registration
    const { canManage, isReadOnly } = await canManageRegistration(partnerCompanyId, registrationId);
    
    if (!canManage) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Block modification operations for read-only access
    if (isReadOnly) {
      return res.status(403).json({ error: 'Operazione non consentita: accesso solo lettura' });
    }

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Find the specific deadline
    const deadline = await prisma.paymentDeadline.findFirst({
      where: {
        id: deadlineId,
        registrationId
      }
    });

    if (!deadline) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    if (deadline.isPaid) {
      return res.status(400).json({ error: 'Pagamento già marcato come pagato' });
    }

    const deadlineAmount = Number(deadline.amount);
    const partialAmountNum = Number(partialAmount);

    // Calculate total delayed amount from all existing custom payments for this registration
    const allPartialDeadlines = await prisma.paymentDeadline.findMany({
      where: {
        registrationId,
        paymentStatus: 'PARTIAL'
      }
    });

    const totalDelayedAmount = allPartialDeadlines.reduce((sum, d) => {
      if (d.partialAmount) {
        return sum + (Number(d.amount) - Number(d.partialAmount));
      }
      return sum;
    }, 0);

    // Maximum allowed is current deadline amount + total delayed amount
    const maxAllowedAmount = deadlineAmount + totalDelayedAmount;

    if (partialAmountNum > maxAllowedAmount) {
      return res.status(400).json({ 
        error: `Importo troppo alto. Massimo consentito: €${maxAllowedAmount.toFixed(2)} (Rata: €${deadlineAmount.toFixed(2)} + Ritardi: €${totalDelayedAmount.toFixed(2)})` 
      });
    }

    // Mark deadline as custom paid and create payment record
    const paymentDate = new Date();
    
    // Determine if this is a full payment, partial payment, or overpayment
    const isFullPayment = partialAmountNum === deadlineAmount;
    const isOverpayment = partialAmountNum > deadlineAmount;
    const excessAmount = isOverpayment ? partialAmountNum - deadlineAmount : 0;
    
    await prisma.$transaction(async (tx) => {
      // Update deadline with custom payment
      await tx.paymentDeadline.update({
        where: { id: deadlineId },
        data: {
          partialAmount: isFullPayment ? null : partialAmountNum,
          paymentStatus: isFullPayment ? 'PAID' : 'PARTIAL',
          isPaid: isFullPayment,
          paidAt: paymentDate,
          notes
        }
      });

      // Create payment record for the partial amount
      await tx.payment.create({
        data: {
          registrationId,
          amount: partialAmountNum,
          paymentDate,
          paymentNumber: deadline.paymentNumber,
          isFirstPayment: deadline.paymentNumber === 0,
          isConfirmed: true,
          confirmedBy: req.user?.id || req.partnerEmployee?.id,
          confirmedAt: paymentDate,
          notes: isOverpayment 
            ? `Pagamento personalizzato: €${partialAmountNum} (Rata: €${deadlineAmount} + Riduzione ritardi: €${excessAmount.toFixed(2)}). ${notes || ''}`.trim()
            : `Pagamento personalizzato: €${partialAmountNum} di €${deadlineAmount}. ${notes || ''}`.trim(),
          createdBy: req.user?.id || req.partnerEmployee?.id
        }
      });

      // Calculate total delayed amount from all custom payments
      const allPartialDeadlines = await tx.paymentDeadline.findMany({
        where: {
          registrationId,
          paymentStatus: 'PARTIAL'
        }
      });
      
      let totalDelayedAmount = allPartialDeadlines.reduce((sum, d) => {
        return sum + (Number(d.amount) - Number(d.partialAmount || 0));
      }, 0);
      
      // If there was an overpayment, reduce the total delayed amount
      if (isOverpayment) {
        totalDelayedAmount = Math.max(0, totalDelayedAmount - excessAmount);
      }
      
      await tx.registration.update({
        where: { id: registrationId },
        data: {
          delayedAmount: totalDelayedAmount
        }
      });
    });

    // Calculate remaining amount
    const paidDeadlines = await prisma.paymentDeadline.findMany({
      where: {
        registrationId,
        OR: [
          { isPaid: true },
          { paymentStatus: 'PARTIAL' }
        ]
      }
    });

    const totalPaid = paidDeadlines.reduce((sum, d) => {
      if (d.isPaid) {
        return sum + Number(d.amount);
      } else if (d.paymentStatus === 'PARTIAL' && d.partialAmount) {
        return sum + Number(d.partialAmount);
      }
      return sum;
    }, 0);

    const remainingAmount = Number(registration.finalAmount) - totalPaid;

    // Get the updated delayed amount from the transaction
    const updatedRegistration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { delayedAmount: true }
    });

    // Check if all payments are completed for status update (for partial payments too)
    const allDeadlines = await prisma.paymentDeadline.findMany({
      where: { registrationId },
      include: { registration: { include: { offer: true } } }
    });
    const allDeadlinesPaid = allDeadlines.every(d => d.paymentStatus === 'PAID');
    const registrationWithOffer = allDeadlines[0]?.registration;
    
    // Update registration with remaining amount and potentially status
    const updateData: any = {
      remainingAmount: remainingAmount
    };
    
    // Debug logging for partial payments
    console.log('Partial payment completion check:', {
      allDeadlinesPaid,
      currentStatus: registrationWithOffer?.status,
      offerType: registrationWithOffer?.offer?.offerType,
      registrationId
    });
    
    // Move to ENROLLED when all payments are completed (from CONTRACT_SIGNED or PENDING)
    if (allDeadlinesPaid && ['PENDING', 'CONTRACT_SIGNED'].includes(registrationWithOffer?.status || '') && registrationWithOffer?.offer?.offerType === 'CERTIFICATION') {
      console.log('Updating registration status to ENROLLED for certification (partial payments)');
      updateData.status = 'ENROLLED';
      updateData.enrolledAt = new Date();
    }
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: updateData
    });

    // Get next unpaid deadline
    const nextDeadline = await prisma.paymentDeadline.findFirst({
      where: {
        registrationId,
        isPaid: false,
        paymentStatus: 'UNPAID'
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json({
      success: true,
      remainingAmount,
      totalPaid,
      delayedAmount: Number(updatedRegistration?.delayedAmount || 0),
      partialPayment: {
        amount: partialAmountNum,
        excessAmount: isOverpayment ? excessAmount : 0,
        deadlineId
      },
      nextDeadline: nextDeadline ? {
        id: nextDeadline.id,
        amount: Number(nextDeadline.amount),
        dueDate: nextDeadline.dueDate,
        description: nextDeadline.description
      } : null,
      statusChanged: allDeadlinesPaid && ['PENDING', 'CONTRACT_SIGNED'].includes(registrationWithOffer?.status || '') && registrationWithOffer?.offer?.offerType === 'CERTIFICATION'
    });
  } catch (error) {
    console.error('Mark custom payment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Notify partner about document upload
router.post('/documents/:documentId/notify', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    
    // Get user's assigned partner
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id || req.partnerEmployee?.id },
      select: { assignedPartnerId: true }
    });

    if (!user || !user.assignedPartnerId) {
      return res.status(400).json({ error: 'Partner non assegnato' });
    }

    const result = await DocumentService.notifyPartnerNewDocument(documentId, user.assignedPartnerId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Notify partner error:', error);
    res.status(500).json({ error: 'Errore nella notifica al partner' });
  }
});

// GET /api/partners/users/:userId/documents - Get all documents for a user (partner access)
router.get('/users/:userId/documents', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify that the user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId,
        partnerCompanyId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a visualizzare i documenti di questo utente' });
    }

    // Get all user documents
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' }
    });

    res.json({ documents });
  } catch (error) {
    console.error('Get user documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/partners/users/:userId/documents/:documentId/download - Download user document (partner access)
router.get('/users/:userId/documents/:documentId/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId, documentId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify that the user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId,
        partnerCompanyId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a scaricare i documenti di questo utente' });
    }

    // Try to find document in UserDocument table first
    const userDocument = await prisma.userDocument.findFirst({
      where: {
        id: documentId,
        userId
      }
    });

    let documentSource = 'UserDocument';
    let filePath: string | undefined;
    let fileName: string | undefined;

    if (userDocument) {
      filePath = userDocument.url;
      fileName = userDocument.originalName;
    } else {
      // Document not found - legacy Document table no longer used
    }

    if (!filePath || !fileName) {
      console.log(`❌ Partner download: Document not found ${documentId} for user ${userId}`);
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    console.log(`📄 Partner download: Found document ${fileName} in ${documentSource} table`);

    // 🚀 R2 INTEGRATION: Use unified storage system instead of fs.existsSync
    try {
      const downloadResult = await storageManager.getDownloadUrl(filePath); // filePath is actually R2 key

      console.log(`✅ Partner download: Generated download URL for ${fileName}`);

      // Check if it's a local file path or R2 signed URL
      if (storageManager.getStorageType() === 'local') {
        // Local development - use direct file download
        const fs = require('fs');
        if (fs.existsSync(downloadResult.signedUrl)) {
          res.download(downloadResult.signedUrl, fileName);
        } else {
          console.log(`❌ Partner download: Local file not found: ${downloadResult.signedUrl}`);
          return res.status(404).json({ error: 'File non trovato sul server' });
        }
      } else {
        // Production R2 - redirect to signed URL
        res.redirect(downloadResult.signedUrl);
      }

    } catch (storageError) {
      console.error(`❌ Partner download: Storage error for ${filePath}:`, storageError);
      return res.status(404).json({ error: 'File non trovato nello storage' });
    }

  } catch (error) {
    console.error('Download user document error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
});

// =====================================
// ENTERPRISE DOCUMENT MANAGEMENT SYSTEM
// =====================================

// Get all documents for a registration (new document system)
router.get('/registrations/:registrationId/documents', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;

    console.log('🔍 DOCUMENTS ENDPOINT 2 (partner.ts:3066) CALLED:', {
      timestamp: new Date().toISOString(),
      registrationId,
      partnerCompanyId,
      endpoint: '/registrations/:registrationId/documents (SECOND INSTANCE - UnifiedService)'
    });

    if (!partnerCompanyId) {
      console.log('❌ ENDPOINT 2: Partner company non trovata');
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration) {
      console.log('❌ ENDPOINT 2: Iscrizione non trovata', { registrationId, partnerCompanyId });
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log('🔍 ENDPOINT 2: Calling DocumentService.getRegistrationDocuments');
    const documents = await DocumentService.getRegistrationDocuments(registrationId);
    
    const uploadedCount = documents.filter((doc: any) => doc.uploaded).length;
    const totalCount = documents.length;

    console.log('🔍 ENDPOINT 2 RESPONSE:', {
      endpoint: '/registrations/:registrationId/documents (SECOND INSTANCE)',
      documentsFound: documents.length,
      uploadedCount,
      totalCount,
      documentsPreview: documents.map((doc: any) => ({
        type: doc.type,
        uploaded: doc.uploaded,
        filename: doc.filename,
        id: doc.id
      }))
    });

    res.json({
      documents,
      uploadedCount,
      totalCount,
      registration: {
        id: registration.id,
        courseName: 'Corso non specificato' // Will be populated by frontend
      }
    });
  } catch (error: any) {
    console.error('Get registration documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get all documents for a user (comprehensive view)
router.get('/users/:userId/documents/all', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify user has registrations with this partner
    const userRegistrations = await prisma.registration.findMany({
      where: { userId, partnerCompanyId }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a visualizzare i documenti di questo utente' });
    }

    const documents = await DocumentService.getAllUserDocuments(userId);
    
    const formattedDocs = documents.map((doc: any) => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.originalName,
      fileSize: doc.size,
      mimeType: doc.mimeType,
      status: doc.status,
      verifiedBy: doc.verifier?.email,
      verifiedAt: doc.verifiedAt,
      rejectionReason: doc.rejectionReason,
      uploadedAt: doc.uploadedAt,
      registrationId: doc.registrationId,
      courseName: doc.registration?.offer?.course?.name
    }));

    res.json({ documents: formattedDocs });
  } catch (error: any) {
    console.error('Get all user documents error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Download document (partner access with full permissions)
router.get('/documents/:documentId/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { documentId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const fileInfo = await DocumentService.downloadDocument(documentId, '', true); // Partner has full access

    // Redirect to signed URL
    res.redirect(fileInfo.signedUrl);
  } catch (error: any) {
    console.error('Partner download document error:', error);
    res.status(404).json({ error: error.message || 'Documento non trovato' });
  }
});

// Approve document
router.post('/documents/:documentId/approve', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { documentId } = req.params;
    const { notes } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const result = await DocumentService.approveDocument(documentId, req.user?.id || req.partnerEmployee?.id, notes);
    
    res.json({ 
      message: 'Documento approvato con successo',
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Approve document error:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione del documento' });
  }
});

// Reject document with email notification
router.post('/documents/:documentId/reject', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { documentId } = req.params;
    const { reason, details } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Motivo del rifiuto obbligatorio' });
    }

    const result = await DocumentService.rejectDocument(documentId, req.user?.id || req.partnerEmployee?.id, reason, details);
    
    res.json({ 
      message: 'Documento rifiutato con successo',
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt,
        rejectionReason: result.document.rejectionReason,
        rejectionDetails: result.document.rejectionDetails
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Reject document error:', error);
    res.status(500).json({ error: 'Errore nel rifiuto del documento' });
  }
});

// Legacy verify endpoint (for backward compatibility)
router.post('/documents/:documentId/verify', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { documentId } = req.params;
    const { status, rejectionReason } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!Object.values(DocumentStatus).includes(status)) {
      return res.status(400).json({ error: 'Status documento non valido' });
    }

    if (status === DocumentStatus.REJECTED && !rejectionReason) {
      return res.status(400).json({ error: 'Motivo del rifiuto obbligatorio' });
    }

    // Use new methods based on status
    const result = status === DocumentStatus.APPROVED 
      ? await DocumentService.approveDocument(documentId, req.user?.id || req.partnerEmployee?.id)
      : await DocumentService.rejectDocument(documentId, req.user?.id || req.partnerEmployee?.id, rejectionReason);
    
    // Auto-progression logic for CERTIFICATION workflows (only when approving)
    if (status === DocumentStatus.APPROVED) {
      const document = await prisma.userDocument.findUnique({
        where: { id: documentId },
        include: {
          user: {
            include: {
              registrations: {
                where: { partnerCompanyId }
              }
            }
          }
        }
      });

      if (document) {
        // Check if all required documents are now approved for CERTIFICATION registrations
        for (const registration of document.user.registrations) {
          if (registration.status === 'ENROLLED') {
            // Get registration with offer details
            const regWithOffer = await prisma.registration.findUnique({
              where: { id: registration.id },
              include: { offer: true }
            });

            if (regWithOffer?.offer?.offerType === 'CERTIFICATION') {
              // For certification, check if both IDENTITY_CARD and TESSERA_SANITARIA are approved
              const requiredDocs = await prisma.userDocument.findMany({
                where: {
                  userId: document.user.id,
                  type: { in: ['IDENTITY_CARD', 'TESSERA_SANITARIA'] },
                  status: 'APPROVED'
                }
              });

              // If both documents are approved, automatically advance to DOCUMENTS_APPROVED only
              if (requiredDocs.length === 2) {
                if (registration.status === 'ENROLLED') {
                  // Only transition: ENROLLED → DOCUMENTS_APPROVED (stop here)
                  await prisma.registration.update({
                    where: { id: registration.id },
                    data: { status: 'DOCUMENTS_APPROVED' }
                  });
                  
                  console.log('Auto-advanced certification to DOCUMENTS_APPROVED:', registration.id);
                }
              }
            }
          }
        }
      }
    }
    
    res.json({ 
      message: `Documento ${status === DocumentStatus.APPROVED ? 'approvato' : 'rifiutato'} con successo`,
      document: {
        id: result.document.id,
        status: result.document.status,
        verifiedAt: result.document.verifiedAt,
        rejectionReason: result.document.rejectionReason
      },
      emailSent: result.emailSent
    });
  } catch (error: any) {
    console.error('Verify document error:', error);
    res.status(500).json({ error: 'Errore nella verifica del documento' });
  }
});

// Upload CNRed document for registration
router.post('/registrations/:registrationId/cnred', authenticateUnified, documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with CNRed URL
    const cnredUrl = `/uploads/documents/${req.file.filename}`;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        cnredUrl,
        cnredUploadedAt: new Date()
      }
    });

    res.json({
      message: 'Documento CNRed caricato con successo',
      cnredUrl
    });
  } catch (error: any) {
    console.error('Upload CNRed error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento CNRed' });
  }
});

// Upload Adverintia document for registration
router.post('/registrations/:registrationId/adverintia', authenticateUnified, documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with Adverintia URL
    const adverintiaUrl = `/uploads/documents/${req.file.filename}`;
    
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        adverintiaUrl,
        adverintiaUploadedAt: new Date()
      }
    });

    res.json({
      message: 'Documento Adverintia caricato con successo',
      adverintiaUrl
    });
  } catch (error: any) {
    console.error('Upload Adverintia error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del documento Adverintia' });
  }
});

// Download CNRed document
router.get('/registrations/:registrationId/cnred/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration || !registration.cnredUrl) {
      return res.status(404).json({ error: 'Documento CNRed non trovato' });
    }

    const projectRoot = getProjectRoot();
    const filePath = path.join(projectRoot, 'backend', registration.cnredUrl.substring(1));
    
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="CNRed_${registrationId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Download CNRed error:', error);
    res.status(500).json({ error: 'Errore nel download del documento CNRed' });
  }
});

// Download Adverintia document
router.get('/registrations/:registrationId/adverintia/download', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration || !registration.adverintiaUrl) {
      return res.status(404).json({ error: 'Documento Adverintia non trovato' });
    }

    const projectRoot = getProjectRoot();
    const filePath = path.join(projectRoot, 'backend', registration.adverintiaUrl.substring(1));
    
    if (!require('fs').existsSync(filePath)) {
      return res.status(404).json({ error: 'File non trovato sul server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="Adverintia_${registrationId}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Download Adverintia error:', error);
    res.status(500).json({ error: 'Errore nel download del documento Adverintia' });
  }
});

// Set exam date for certification workflow
router.post('/registrations/:registrationId/exam-date', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    const { examDate } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!examDate) {
      return res.status(400).json({ error: 'Data esame obbligatoria' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update exam date and status for certification workflow
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        examDate: new Date(examDate),
        examRegisteredBy: partnerCompanyId,
        status: 'EXAM_REGISTERED'
      }
    });

    res.json({
      message: 'Data esame registrata con successo',
      examDate: new Date(examDate)
    });
  } catch (error: any) {
    console.error('Set exam date error:', error);
    res.status(500).json({ error: 'Errore nella registrazione della data esame' });
  }
});

// Mark exam as completed for certification workflow
router.post('/registrations/:registrationId/complete-exam', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify registration belongs to this partner and is in EXAM_REGISTERED state
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId, 
        partnerCompanyId,
        status: 'EXAM_REGISTERED' 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata o non in stato corretto' });
    }

    // Update status to COMPLETED and record completion
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'COMPLETED',
        examCompletedDate: new Date(),
        examCompletedBy: partnerCompanyId
      },
      include: {
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    // Send completion email to user
    try {
      const emailService = require('../services/emailService').default;
      await emailService.sendCertificationExamCompletedNotification(
        updatedRegistration.user.email,
        updatedRegistration.user.profile?.nome || 'Utente',
        'Certificazione'
      );
    } catch (emailError) {
      console.error('Error sending completion email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      message: 'Esame completato con successo',
      registration: {
        id: updatedRegistration.id,
        status: updatedRegistration.status,
        examCompletedDate: updatedRegistration.examCompletedDate
      }
    });
  } catch (error: any) {
    console.error('Complete exam error:', error);
    res.status(500).json({ error: 'Errore nel completamento dell\'esame' });
  }
});

// Get document audit trail for a specific document
router.get('/documents/:documentId/audit', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { documentId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const auditLog = await DocumentService.getDocumentAuditTrail(documentId);
    
    const formattedLog = auditLog.map(log => ({
      id: log.id,
      action: log.action,
      performedBy: log.performer.email,
      performedAt: log.createdAt,
      previousStatus: log.previousStatus,
      newStatus: log.newStatus,
      notes: log.notes
    }));

    res.json({ auditLog: formattedLog });
  } catch (error: any) {
    console.error('Get document audit trail error:', error);
    res.status(500).json({ error: 'Errore nel caricamento del log di audit' });
  }
});

// Bulk verify documents for a registration
router.post('/registrations/:registrationId/bulk-verify', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    const { documentStatuses } = req.body; // Array of { documentId, status, rejectionReason }
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (!Array.isArray(documentStatuses)) {
      return res.status(400).json({ error: 'documentStatuses deve essere un array' });
    }

    const results = [];

    for (const { documentId, status, rejectionReason } of documentStatuses) {
      try {
        // Use new methods based on status
        const result = status === DocumentStatus.APPROVED 
          ? await DocumentService.approveDocument(documentId, req.user?.id || req.partnerEmployee?.id)
          : await DocumentService.rejectDocument(documentId, req.user?.id || req.partnerEmployee?.id, rejectionReason || 'Motivo non specificato');
        
        results.push({
          documentId,
          success: true,
          status: result.document.status
        });
      } catch (error: any) {
        results.push({
          documentId,
          success: false,
          error: error.message
        });
      }
    }

    // Auto-progression logic for CERTIFICATION workflows (after bulk processing)
    const regWithOffer = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { 
        offer: true,
        user: true
      }
    });

    if (regWithOffer?.offer?.offerType === 'CERTIFICATION') {
      // Check approved documents for this user
      const approvedDocs = await prisma.userDocument.findMany({
        where: {
          userId: regWithOffer.userId,
          type: { in: ['IDENTITY_CARD', 'TESSERA_SANITARIA'] },
          status: 'APPROVED'
        }
      });

      if (approvedDocs.length === 2) {
        // If both documents are approved, automatically advance to DOCUMENTS_APPROVED only
        if (regWithOffer.status === 'ENROLLED') {
          // Only transition: ENROLLED → DOCUMENTS_APPROVED (stop here)
          await prisma.registration.update({
            where: { id: registrationId },
            data: { status: 'DOCUMENTS_APPROVED' }
          });
          
          console.log('Auto-advanced certification to DOCUMENTS_APPROVED (bulk):', registrationId);
        }
      }
    }

    res.json({
      message: 'Verifica documenti completata',
      results
    });
  } catch (error: any) {
    console.error('Bulk verify documents error:', error);
    res.status(500).json({ error: 'Errore nella verifica dei documenti' });
  }
});

// Get unified documents for a specific registration (partner view)
router.get('/registrations/:registrationId/documents/unified', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify registration belongs to this partner company
    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: {
        offer: {
          include: {
            course: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Document types based on offer type
    let documentTypes = [];
    
    if (registration.offer?.offerType === 'CERTIFICATION') {
      // For certifications, only basic documents are required
      documentTypes = [
        { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
        { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' }
      ];
    } else {
      // For TFA, all documents are required
      documentTypes = [
        { type: 'IDENTITY_CARD', name: 'Carta d\'Identità', description: 'Fronte e retro della carta d\'identità o passaporto in corso di validità' },
        { type: 'TESSERA_SANITARIA', name: 'Tessera Sanitaria', description: 'Tessera sanitaria o documento che attesti il codice fiscale' },
        { type: 'BACHELOR_DEGREE', name: 'Certificato Laurea Triennale', description: 'Certificato di laurea triennale o diploma universitario' },
        { type: 'MASTER_DEGREE', name: 'Certificato Laurea Magistrale', description: 'Certificato di laurea magistrale, specialistica o vecchio ordinamento' },
        { type: 'TRANSCRIPT', name: 'Piano di Studio', description: 'Piano di studio con lista esami sostenuti' },
        { type: 'MEDICAL_CERT', name: 'Certificato Medico', description: 'Certificato medico attestante la sana e robusta costituzione fisica e psichica' },
        { type: 'BIRTH_CERT', name: 'Certificato di Nascita', description: 'Certificato di nascita o estratto di nascita dal Comune' },
        { type: 'DIPLOMA', name: 'Diploma di Laurea', description: 'Diploma di laurea (cartaceo o digitale)' },
        { type: 'OTHER', name: 'Altri Documenti', description: 'Altri documenti rilevanti' }
      ];
    }

    // Get all documents for this specific registration only
    const userDocuments = await prisma.userDocument.findMany({
      where: { 
        registrationId: registrationId
      },
      include: {
        verifier: {
          select: { id: true, email: true }
        },
        uploader: {
          select: { id: true, email: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });



    // Create unified document structure
    const documents = documentTypes.map(docType => {
      const userDoc = userDocuments.find(doc => doc.type === docType.type);
      
      return {
        id: userDoc?.id || `empty-${docType.type}`,
        type: docType.type,
        name: docType.name,
        description: docType.description,
        uploaded: !!userDoc,
        fileName: userDoc?.originalName,
        originalName: userDoc?.originalName,
        mimeType: userDoc?.mimeType,
        size: userDoc?.size,
        uploadedAt: userDoc?.uploadedAt?.toISOString(),
        documentId: userDoc?.id,
        status: userDoc?.status,
        rejectionReason: userDoc?.rejectionReason,
        rejectionDetails: userDoc?.rejectionDetails,
        verifiedBy: userDoc?.verifiedBy,
        verifiedAt: userDoc?.verifiedAt?.toISOString(),
        uploadSource: userDoc?.uploadSource,
        isVerified: userDoc?.status === 'APPROVED'
      };
    });

    const uploadedCount = documents.filter(doc => doc.uploaded).length;
    const totalCount = documents.length;

    console.log('🔍 ENDPOINT 1 RESPONSE:', {
      endpoint: '/registrations/:registrationId/documents (ACTIVE FIRST INSTANCE)',
      documentsFound: documents.length,
      uploadedCount,
      totalCount,
      registrationFound: !!registration,
      documentsPreview: documents.slice(0, 3).map(doc => ({
        type: doc.type,
        uploaded: doc.uploaded,
        fileName: doc.fileName,
        documentId: doc.documentId
      }))
    });

    res.json({
      documents,
      uploadedCount,
      totalCount,
      registration: {
        id: registration.id,
        courseName: registration.offer?.course?.name || 'Corso non specificato'
      }
    });
  } catch (error) {
    console.error('Error getting unified registration documents:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Approve document
router.post('/documents/:documentId/approve', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const { notes } = req.body;
    const partnerCompanyId = req.partnerCompany?.id;
    const userId = req.user?.id || req.partnerEmployee?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Find the document and verify user belongs to this partner
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerCompanyId }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Check if user has registrations with this partner
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato ad approvare questo documento' });
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        verifiedBy: userId,
        verifiedAt: new Date()
      }
    });

    // Log the approval
    await prisma.documentActionLog.create({
      data: {
        documentId: documentId,
        action: 'APPROVE',
        performedBy: userId,
        performedRole: 'PARTNER',
        details: { notes: notes || 'Documento approvato' }
      }
    });

    // Check if all required documents are now approved for CERTIFICATION registrations
    for (const registration of document.user.registrations) {
      if (registration.status === 'ENROLLED') {
        // Get registration with offer details
        const regWithOffer = await prisma.registration.findUnique({
          where: { id: registration.id },
          include: { offer: true }
        });

        if (regWithOffer?.offer?.offerType === 'CERTIFICATION') {
          // For certification, check if both IDENTITY_CARD and TESSERA_SANITARIA are approved
          const requiredDocs = await prisma.userDocument.findMany({
            where: {
              userId: document.user.id,
              type: { in: ['IDENTITY_CARD', 'TESSERA_SANITARIA'] },
              status: 'APPROVED'
            }
          });

          console.log('Checking auto-approval for certification:', {
            registrationId: registration.id,
            approvedDocs: requiredDocs.length,
            requiredDocsTypes: requiredDocs.map(d => d.type)
          });

          // If both documents are approved, automatically advance through the workflow
          if (requiredDocs.length === 2) {
            if (registration.status === 'ENROLLED') {
              // First transition: ENROLLED → DOCUMENTS_APPROVED
              await prisma.registration.update({
                where: { id: registration.id },
                data: { status: 'DOCUMENTS_APPROVED' }
              });
              
              console.log('Auto-advanced certification to DOCUMENTS_APPROVED:', registration.id);
            }
            
            // Auto-progression stops at DOCUMENTS_APPROVED
            // The partner must manually advance to EXAM_REGISTERED
          }
        }
      }
    }

    res.json({
      message: 'Documento approvato con successo',
      document: {
        id: updatedDocument.id,
        status: updatedDocument.status,
        verifiedAt: updatedDocument.verifiedAt
      }
    });
  } catch (error) {
    console.error('Error approving document:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione del documento' });
  }
});

// Reject document
router.post('/documents/:documentId/reject', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { documentId } = req.params;
    const { reason, details } = req.body;
    const partnerCompanyId = req.partnerCompany?.id;
    const userId = req.user?.id || req.partnerEmployee?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Motivo del rifiuto è richiesto' });
    }

    // Find the document and verify user belongs to this partner
    const document = await prisma.userDocument.findFirst({
      where: { id: documentId },
      include: {
        user: {
          include: {
            registrations: {
              where: { partnerCompanyId }
            }
          }
        }
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }

    // Check if user has registrations with this partner
    if (!document.user.registrations.length) {
      return res.status(403).json({ error: 'Non autorizzato a rifiutare questo documento' });
    }

    // Update document status
    const updatedDocument = await prisma.userDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectionDetails: details,
        verifiedBy: userId,
        verifiedAt: new Date(),
        userNotifiedAt: new Date()
      }
    });

    // Log the rejection
    await prisma.documentActionLog.create({
      data: {
        documentId: documentId,
        action: 'REJECT',
        performedBy: userId,
        performedRole: 'PARTNER',
        details: { reason, details }
      }
    });

    // TODO: Send email notification to user about document rejection
    // This should be implemented with the email service

    res.json({
      message: 'Documento rifiutato',
      document: {
        id: updatedDocument.id,
        status: updatedDocument.status,
        rejectionReason: updatedDocument.rejectionReason,
        verifiedAt: updatedDocument.verifiedAt
      }
    });
  } catch (error) {
    console.error('Error rejecting document:', error);
    res.status(500).json({ error: 'Errore nel rifiuto del documento' });
  }
});

// POST /api/partners/users/:userId/documents/upload - Partner uploads document for user
router.post('/users/:userId/documents/upload', authenticateUnified, documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    const { type, registrationId } = req.body;

    if (!partnerCompanyId) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Tipo documento richiesto' });
    }

    // Verify partner has access to this user
    const userRegistrations = await prisma.registration.findMany({
      where: {
        userId: userId,
        partnerCompanyId: partnerCompanyId
      }
    });

    if (userRegistrations.length === 0) {
      return res.status(403).json({ error: 'Non autorizzato a caricare documenti per questo utente' });
    }

    // Use the UnifiedDocumentService to upload
    // When partner uploads on behalf of user, uploadedBy should be the userId (since it has FK to User table)
    // The actual partner ID is stored separately for tracking
    const partnerId = req.user?.id || req.partnerEmployee?.id;
    const document = await DocumentService.uploadDocument(
      userId, // Document belongs to the user
      req.file,
      type,
      registrationId, // Registration ID for document linkage
      'PARTNER_PANEL', // Upload source
      'USER' // User role
    );

    res.json({
      success: true,
      document: {
        id: document.id,
        type: document.type,
        fileName: document.originalName,
        mimeType: document.mimeType,
        fileSize: document.size,
        uploadedAt: document.uploadedAt.toISOString(),
        status: document.status,
        uploadSource: document.uploadSource
      },
      message: 'Documento caricato con successo dal partner'
    });

  } catch (error: any) {
    console.error('Partner upload error:', error);
    // Clean up file on error
    if (req.file && require('fs').existsSync(req.file.path)) {
      require('fs').unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Errore nel caricamento del documento' });
  }
});

// GET /api/partner/export/registrations - Export partner's registrations to Excel
router.get('/export/registrations', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Get partner company info for filename
    const partner = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { referralCode: true }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner non trovato' });
    }

    // Fetch partner's registrations with comprehensive data
    // For sub-partners, include registrations where they are the source
    const registrations = await prisma.registration.findMany({
      where: {
        OR: [
          { partnerCompanyId },
          { sourcePartnerCompanyId: partnerCompanyId }
        ]
      },
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
        },
        partnerCompany: true,
        sourcePartnerCompany: true
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

// ==================== CERTIFICATION 5-STEP WORKFLOW ====================

// Step 3: Mark documents as approved (carta identità + tessera sanitaria)
router.post('/registrations/:registrationId/certification-docs-approved', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    // Update status to documents approved
    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'DOCUMENTS_APPROVED' }
    });

    // Send email notification to user
    if (registration.user?.email) {
      const userName = registration.user.profile?.nome || 'Utente';
      const courseName = registration.offer?.name || 'Corso di Certificazione';
      
      try {
        await emailService.sendCertificationDocsApprovedNotification(
          registration.user.email,
          userName,
          courseName
        );
      } catch (emailError) {
        console.error('Error sending docs approved email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, message: 'Documenti approvati per certificazione' });
  } catch (error) {
    console.error('Errore approvazione documenti certificazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Step 4: Register for exam
router.post('/registrations/:registrationId/certification-exam-registered', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    // Update status without requiring date
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        examRegisteredBy: partnerCompanyId,
        status: 'EXAM_REGISTERED'
      }
    });

    // Send email notification to user
    if (registration.user?.email) {
      const userName = registration.user.profile?.nome || 'Utente';
      const courseName = registration.offer?.name || 'Corso di Certificazione';
      
      try {
        await emailService.sendCertificationExamRegisteredNotification(
          registration.user.email,
          userName,
          courseName
        );
      } catch (emailError) {
        console.error('Error sending exam registered email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, message: 'Iscrizione all\'esame registrata' });
  } catch (error) {
    console.error('Errore registrazione esame certificazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Step 5: Mark exam as completed
router.post('/registrations/:registrationId/certification-exam-completed', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    // Update with completion date and final status
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        examCompletedDate: new Date(),
        examCompletedBy: partnerCompanyId,
        status: 'COMPLETED'
      }
    });

    // Send email notification to user
    if (registration.user?.email) {
      const userName = registration.user.profile?.nome || 'Utente';
      const courseName = registration.offer?.name || 'Corso di Certificazione';
      
      try {
        await emailService.sendCertificationExamCompletedNotification(
          registration.user.email,
          userName,
          courseName
        );
      } catch (emailError) {
        console.error('Error sending exam completed email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, message: 'Esame completato' });
  } catch (error) {
    console.error('Errore completamento esame certificazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get certification steps progress  
router.get('/registrations/:registrationId/certification-steps', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        deadlines: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Steps disponibili solo per corsi di certificazione' });
    }

    // Check if all payments are completed
    const allDeadlinesPaid = registration.deadlines.every(d => d.paymentStatus === 'PAID');

    // Build certification steps
    const steps = {
      enrollment: {
        step: 1,
        title: 'Iscrizione Completata',
        description: 'Iscrizione al corso di certificazione completata',
        completed: true,
        completedAt: registration.createdAt,
        status: 'completed'
      },
      payment: {
        step: 2,
        title: 'Pagamento Completato',
        description: 'Tutti i pagamenti sono stati completati',
        completed: allDeadlinesPaid,
        completedAt: allDeadlinesPaid ? registration.deadlines.find(d => d.paymentStatus === 'PAID')?.paidAt : null,
        status: allDeadlinesPaid ? 'completed' : 
                (registration.status === 'ENROLLED' ? 'current' : 'pending')
      },
      documentsApproved: {
        step: 3,
        title: 'Documenti Approvati',
        description: 'Carta d\'identità e tessera sanitaria approvate',
        completed: registration.status === 'DOCUMENTS_APPROVED' || 
                   ['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status),
        completedAt: registration.status === 'DOCUMENTS_APPROVED' ? new Date() : null,
        status: registration.status === 'DOCUMENTS_APPROVED' ? 'completed' :
                (['EXAM_REGISTERED', 'COMPLETED'].includes(registration.status) ? 'completed' : 
                (registration.status === 'ENROLLED' && allDeadlinesPaid ? 'current' : 'pending'))
      },
      examRegistered: {
        step: 4,
        title: 'Iscritto all\'Esame',
        description: 'Iscrizione all\'esame di certificazione completata',
        completed: !!registration.examDate || registration.status === 'COMPLETED',
        completedAt: registration.examDate,
        status: registration.status === 'EXAM_REGISTERED' ? 'current' :
                (registration.status === 'COMPLETED' || !!registration.examDate ? 'completed' : 'pending')
      },
      examCompleted: {
        step: 5,
        title: 'Esame Sostenuto',
        description: 'Esame di certificazione completato con successo',
        completed: !!registration.examCompletedDate,
        completedAt: registration.examCompletedDate,
        status: registration.status === 'COMPLETED' ? 'completed' : 'pending'
      }
    };

    res.json({
      registrationId: registration.id,
      currentStatus: registration.status,
      steps
    });

  } catch (error) {
    console.error('Certification steps error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// ==================== TFA POST-ENROLLMENT STEPS ====================

// Step 0: Register admission test
router.post('/registrations/:registrationId/admission-test', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;
    const { testDate, passed = true } = req.body;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!testDate) {
      return res.status(400).json({ error: 'Data test richiesta' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    // Update registration with admission test data
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        admissionTestDate: new Date(testDate),
        admissionTestBy: partnerCompanyId,
        admissionTestPassed: Boolean(passed)
      }
    });

    res.json({ success: true, message: 'Test d\'ingresso registrato con successo' });
  } catch (error) {
    console.error('Errore registrazione test d\'ingresso:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Step 1: Register CNRED release
router.post('/registrations/:registrationId/cnred-release', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    // Update registration with CNRED release
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'CNRED_RELEASED',
        cnredReleasedAt: new Date(),
        cnredReleasedBy: partnerCompanyId
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaCnredReleasedNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending CNRED released email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Rilascio CNRED registrato con successo',
      status: 'CNRED_RELEASED'
    });

  } catch (error) {
    console.error('CNRED release registration error:', error);
    res.status(500).json({ error: 'Errore nella registrazione rilascio CNRED' });
  }
});

// Step 2: Register final exam
router.post('/registrations/:registrationId/final-exam', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const { examDate, passed } = req.body;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    if (!examDate || passed === undefined) {
      return res.status(400).json({ error: 'Data esame e esito sono obbligatori' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    // Update registration with final exam info
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'FINAL_EXAM',
        finalExamDate: new Date(examDate),
        finalExamRegisteredBy: partnerCompanyId,
        finalExamPassed: Boolean(passed)
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaFinalExamNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA',
        Boolean(passed),
        new Date(examDate).toLocaleDateString('it-IT')
      );
    } catch (emailError) {
      console.error('Error sending final exam email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Esame finale registrato con successo',
      status: 'FINAL_EXAM',
      passed: Boolean(passed)
    });

  } catch (error) {
    console.error('Final exam registration error:', error);
    res.status(500).json({ error: 'Errore nella registrazione esame finale' });
  }
});

// Step 3: Register recognition request
router.post('/registrations/:registrationId/recognition-request', authenticateUnified, documentUpload.single('document'), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi TFA' });
    }

    let recognitionDocumentUrl = null;
    if (req.file) {
      recognitionDocumentUrl = `/uploads/documents/${req.file.filename}`;
    }

    // Update registration with recognition request
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'RECOGNITION_REQUEST',
        recognitionRequestDate: new Date(),
        recognitionRequestBy: partnerCompanyId,
        recognitionDocumentUrl
      }
    });

    // Send email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaRecognitionRequestNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending recognition request email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Richiesta riconoscimento registrata con successo',
      status: 'RECOGNITION_REQUEST',
      documentUrl: recognitionDocumentUrl
    });

  } catch (error) {
    console.error('Recognition request error:', error);
    res.status(500).json({ error: 'Errore nella registrazione richiesta riconoscimento' });
  }
});

// Approve recognition (final step to COMPLETED)
router.post('/registrations/:registrationId/recognition-approval', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerCompanyId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.status !== 'RECOGNITION_REQUEST') {
      return res.status(400).json({ error: 'La richiesta di riconoscimento deve essere già inviata' });
    }

    // Update registration to completed
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        status: 'COMPLETED',
        recognitionApprovalDate: new Date()
      }
    });

    // Send completion email notification
    try {
      const userName = registration.user.profile?.nome && registration.user.profile?.cognome
        ? `${registration.user.profile.nome} ${registration.user.profile.cognome}`
        : registration.user.email;
      
      const courseName = await prisma.course.findUnique({
        where: { id: registration.offer?.courseId || '' },
        select: { name: true }
      });

      await emailService.sendTfaCompletedNotification(
        registration.user.email,
        userName,
        courseName?.name || 'Corso TFA'
      );
    } catch (emailError) {
      console.error('Error sending TFA completed email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ 
      success: true, 
      message: 'Riconoscimento approvato - corso completato',
      status: 'COMPLETED'
    });

  } catch (error) {
    console.error('Recognition approval error:', error);
    res.status(500).json({ error: 'Errore nell\'approvazione riconoscimento' });
  }
});

// GET /api/partner/registrations/:registrationId/tfa-steps - Get TFA steps for partner's registration
router.get('/registrations/:registrationId/tfa-steps', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId, 
        partnerCompanyId 
      },
      include: {
        offer: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'TFA_ROMANIA') {
      return res.status(400).json({ error: 'Steps disponibili solo per corsi TFA' });
    }

    // Build steps progress object
    const steps = {
      admissionTest: {
        step: 1,
        title: 'Test d\'Ingresso',
        description: 'Test preliminare per l\'ammissione al corso TFA',
        completed: !!registration.admissionTestDate,
        completedAt: registration.admissionTestDate,
        passed: registration.admissionTestPassed,
        status: !!registration.admissionTestDate ? 'completed' : 
                (['CONTRACT_SIGNED', 'ENROLLED'].includes(registration.status) ? 'current' : 'pending')
      },
      cnredRelease: {
        step: 2,
        title: 'Rilascio CNRED',
        description: 'Il CNRED (Codice Nazionale di Riconoscimento Europeo dei Diplomi) è stato rilasciato',
        completed: !!registration.cnredReleasedAt,
        completedAt: registration.cnredReleasedAt,
        status: registration.status === 'CNRED_RELEASED' ? 'current' : 
                (!!registration.cnredReleasedAt ? 'completed' : 
                  (registration.admissionTestDate ? 'current' : 'pending'))
      },
      finalExam: {
        step: 3,
        title: 'Esame Finale',
        description: 'Sostenimento dell\'esame finale del corso TFA',
        completed: !!registration.finalExamDate,
        completedAt: registration.finalExamDate,
        passed: registration.finalExamPassed,
        status: registration.status === 'FINAL_EXAM' ? 'current' : 
                (!!registration.finalExamDate ? 'completed' : 'pending')
      },
      recognitionRequest: {
        step: 4,
        title: 'Richiesta Riconoscimento',
        description: 'Invio richiesta di riconoscimento del titolo conseguito',
        completed: !!registration.recognitionRequestDate,
        completedAt: registration.recognitionRequestDate,
        documentUrl: registration.recognitionDocumentUrl,
        status: registration.status === 'RECOGNITION_REQUEST' ? 'current' : 
                (!!registration.recognitionRequestDate ? 'completed' : 'pending')
      },
      finalCompletion: {
        step: 5,
        title: 'Corso Completato',
        description: 'Riconoscimento approvato - corso TFA completamente terminato',
        completed: registration.status === 'COMPLETED',
        completedAt: registration.recognitionApprovalDate,
        status: registration.status === 'COMPLETED' ? 'completed' : 'pending'
      }
    };

    res.json({
      registrationId: registration.id,
      currentStatus: registration.status,
      steps
    });

  } catch (error) {
    console.error('Partner TFA steps error:', error);
    res.status(500).json({ error: 'Errore nel recupero steps TFA' });
  }
});

// Get partner analytics data for charts
router.get('/analytics', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Get monthly revenue for the last 6 months
    const now = new Date();
    const monthsData = [];
    
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthlyRevenue = await prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          registration: { partnerCompanyId: partnerCompanyId },
          paymentDate: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
      monthsData.push({
        month: monthName,
        revenue: Number(monthlyRevenue._sum.amount || 0),
        target: 1000 // Could be made configurable per partner
      });
    }

    // Get registration status distribution
    const statusCounts = await prisma.registration.groupBy({
      by: ['status'],
      where: { partnerCompanyId: partnerCompanyId },
      _count: true
    });

    const statusData = statusCounts.map(item => ({
      status: item.status,
      count: item._count
    }));

    // Get user growth over time (registrations per month)
    const growthData = [];
    for (let i = 5; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthlyUsers = await prisma.registration.count({
        where: {
          partnerCompanyId: partnerCompanyId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      const monthName = startDate.toLocaleDateString('it-IT', { month: 'short' });
      growthData.push({
        month: monthName,
        users: monthlyUsers
      });
    }

    // Calculate conversion metrics
    const totalRegistrations = await prisma.registration.count({
      where: { partnerCompanyId: partnerCompanyId }
    });

    const completedRegistrations = await prisma.registration.count({
      where: { 
        partnerCompanyId: partnerCompanyId,
        status: 'COMPLETED'
      }
    });

    const conversionRate = totalRegistrations > 0 ? 
      Math.round((completedRegistrations / totalRegistrations) * 100) : 0;

    // Get pending actions count (users waiting for document verification)
    const documentsUpload = await prisma.registration.count({
      where: { 
        partnerCompanyId: partnerCompanyId,
        status: 'PENDING'
      }
    });

    const contractGenerated = await prisma.registration.count({
      where: { 
        partnerCompanyId: partnerCompanyId,
        status: 'CONTRACT_GENERATED'
      }
    });

    const contractSigned = await prisma.registration.count({
      where: { 
        partnerCompanyId: partnerCompanyId,
        status: 'CONTRACT_SIGNED'
      }
    });

    res.json({
      revenueChart: monthsData,
      statusDistribution: statusData,
      userGrowth: growthData,
      metrics: {
        conversionRate,
        avgRevenuePerUser: totalRegistrations > 0 ? 
          Math.round((monthsData.reduce((sum, m) => sum + m.revenue, 0) / totalRegistrations)) : 0,
        growthRate: growthData.length > 1 ? 
          Math.round(((growthData[growthData.length - 1].users - growthData[0].users) / Math.max(growthData[0].users, 1)) * 100) : 0
      },
      pendingActions: {
        documentsToApprove: documentsUpload,
        contractsToSign: contractGenerated,
        paymentsInProgress: contractSigned,
        completedEnrollments: completedRegistrations
      }
    });
  } catch (error) {
    console.error('Get partner analytics error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// DELETE /api/partner/registrations/:registrationId - Delete a registration with all related data
router.delete('/registrations/:registrationId', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { registrationId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Get registration with all related data
    const registration = await prisma.registration.findFirst({
      where: {
        id: registrationId
      },
      include: {
        user: {
          include: {
            profile: true
          }
        },
        offer: true,
        deadlines: true,
        payments: true,
        userDocuments: true,
        partnerCompany: true,
        sourcePartnerCompany: true
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Check deletion permissions based on partner company hierarchy
    const canDelete = canDeleteRegistration(partnerCompanyId, registration);
    if (!canDelete) {
      return res.status(403).json({ error: 'Non autorizzato a eliminare questa registrazione' });
    }

    // Log deletion for audit purposes
    console.log(`🗑️ Deleting registration ${registrationId} for partner ${partnerCompanyId}`);
    console.log(`- User: ${registration.user.email}`);
    console.log(`- Offer: ${registration.offer?.name}`);
    console.log(`- Status: ${registration.status}`);
    console.log(`- Deadlines: ${registration.deadlines.length}`);
    console.log(`- Payments: ${registration.payments.length}`);
    console.log(`- Documents: ${registration.userDocuments.length}`);

    // Use transaction to ensure atomic deletion and access disabling
    await prisma.$transaction(async (tx) => {
      // 1. Disable user access to the offer before deleting registration (if offerId exists)
      if (registration.partnerOfferId) {
        await tx.userOfferAccess.updateMany({
          where: {
            userId: registration.userId,
            offerId: registration.partnerOfferId
          },
          data: {
            enabled: false
          }
        });
      }

      // 2. Delete payment deadlines (thanks to CASCADE, this happens automatically)
      await tx.paymentDeadline.deleteMany({
        where: { registrationId }
      });

      // 3. Delete payments (thanks to CASCADE, this happens automatically)
      await tx.payment.deleteMany({
        where: { registrationId }
      });

      // 4. Delete coupon uses
      await tx.couponUse.deleteMany({
        where: { registrationId }
      });

      // 5. Delete the registration (CASCADE will handle UserDocuments)
      await tx.registration.delete({
        where: { id: registrationId }
      });

      console.log(`🚫 Disabled access for user ${registration.user.email} to offer ${registration.offer?.name}`);
    });

    console.log(`✅ Successfully deleted registration ${registrationId}`);

    res.json({
      success: true,
      message: 'Registrazione eliminata con successo',
      deletedRegistration: {
        id: registrationId,
        userEmail: registration.user.email,
        offerName: registration.offer?.name,
        status: registration.status
      }
    });

  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione della registrazione' });
  }
});

// Get company hierarchy for partner coupon management
router.get('/companies/hierarchy', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const partnerEmployee = req.partnerEmployee;
    
    if (!partnerCompanyId || !partnerEmployee) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    let companies = [];
    
    // Only ADMINISTRATIVE users can see hierarchy for coupon management
    if (partnerEmployee.role === 'ADMINISTRATIVE') {
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
      
      const childrenCompanies = await getAllChildren(partnerCompanyId);
      
      // Get current company details
      const currentCompany = await prisma.partnerCompany.findUnique({
        where: { id: partnerCompanyId },
        select: {
          id: true,
          name: true,
          referralCode: true
        }
      });
      
      companies = [
        ...(currentCompany ? [currentCompany] : []),
        ...childrenCompanies
      ];
    } else {
      // COMMERCIAL users can only see their own company
      const currentCompany = await prisma.partnerCompany.findUnique({
        where: { id: partnerCompanyId },
        select: {
          id: true,
          name: true,
          referralCode: true
        }
      });
      
      companies = currentCompany ? [currentCompany] : [];
    }
    
    res.json({ companies });
    
  } catch (error) {
    console.error('Get companies hierarchy error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get available offers for reactivating orphaned users
router.get('/offers', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;

    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    const offers = await prisma.partnerOffer.findMany({
      where: {
        partnerCompanyId,
        isActive: true
      },
      include: {
        course: true,
        createdByEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        // Note: registrations are queried separately as they're not directly related to PartnerOffer
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Query registrations separately for each offer to calculate statistics
    const offersWithStats = await Promise.all(offers.map(async (offer) => {
      const registrations = await prisma.registration.findMany({
        where: {
          partnerOfferId: offer.id,
          partnerCompanyId: partnerCompanyId
        },
        select: {
          id: true,
          originalAmount: true,
          finalAmount: true,
          couponId: true,
          status: true
        }
      });

      // Calculate pricing statistics
      const totalRegistrations = registrations.length;
      const registrationsWithCoupons = registrations.filter(r => r.couponId);
      const averageOriginalAmount = totalRegistrations > 0
        ? registrations.reduce((sum: number, r) => sum + Number(r.originalAmount || 0), 0) / totalRegistrations
        : Number(offer.totalAmount);
      const averageFinalAmount = totalRegistrations > 0
        ? registrations.reduce((sum: number, r) => sum + Number(r.finalAmount || 0), 0) / totalRegistrations
        : Number(offer.totalAmount);
      const totalDiscountGiven = registrations.reduce((sum: number, r) =>
        sum + (Number(r.originalAmount || 0) - Number(r.finalAmount || 0)), 0
      );

      return {
        ...offer,
        // Add pricing insights for partner visibility
        pricingStats: {
          totalAmount: Number(offer.totalAmount), // Base offer price
          averageOriginalAmount: Math.round(averageOriginalAmount * 100) / 100,
          averageFinalAmount: Math.round(averageFinalAmount * 100) / 100, // 🎯 This shows effective price with coupons
          totalRegistrations,
          registrationsWithCoupons: registrationsWithCoupons.length,
          couponUsageRate: totalRegistrations > 0 ? Math.round((registrationsWithCoupons.length / totalRegistrations) * 100) : 0,
          totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
          averageDiscountPerRegistration: totalRegistrations > 0 ? Math.round((totalDiscountGiven / totalRegistrations) * 100) / 100 : 0
        }
      };
    }));

    res.json({ offers: offersWithStats });
  } catch (error) {
    console.error('Get offers error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Reactivate orphaned user by creating new registration
router.post('/users/:userId/reactivate', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    const { offerId, finalAmount, actionToken } = req.body;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Verify user is orphaned and assigned to this partner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        registrations: true,
        profile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.assignedPartnerId !== partnerCompanyId) {
      return res.status(403).json({ error: 'Utente non assegnato a questo partner' });
    }

    if (user.registrations.length > 0) {
      return res.status(400).json({ error: 'Utente non è orfano - ha già iscrizioni attive' });
    }

    // Get the offer details and partner info
    const offer = await prisma.partnerOffer.findUnique({
      where: { id: offerId },
      include: { course: true }
    });

    // Get legacy partnerId from partnerCompanyId
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      include: { employees: { where: { isOwner: true }, take: 1 } }
    });

    if (!partnerCompany) {
      return res.status(404).json({ error: 'Partner company non trovata' });
    }

    // Get legacy partner record
    const legacyPartner = await prisma.partner.findFirst({
      where: { userId: partnerCompany.employees[0]?.id }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    // Variables to track who is responsible for the action
    let actionPerformedBy: string | null = null;
    let actionPerformedByData: any = null;

    // If actionToken is provided, validate and use it for tracking
    if (actionToken) {
      const tokenValidation = await validateAndConsumeActionToken(actionToken, 'REACTIVATE_USER');

      if (!tokenValidation.isValid) {
        return res.status(400).json({ error: tokenValidation.error });
      }

      // Use token data for tracking
      actionPerformedBy = tokenValidation.partnerEmployeeId!;
      actionPerformedByData = tokenValidation.partnerEmployee;

      console.log(`📊 Action tracked: REACTIVATE_USER by ${actionPerformedByData.firstName} ${actionPerformedByData.lastName} for user ${userId}, offer ${offerId}`);
    } else {
      // Fallback to authenticated user (existing behavior)
      actionPerformedBy = req.partnerEmployee?.id || null;
    }

    if (offer.partnerCompanyId !== partnerCompanyId) {
      return res.status(403).json({ error: 'Offerta non appartiene a questo partner' });
    }

    // Create new registration
    const registration = await prisma.registration.create({
      data: {
        userId: userId,
        partnerId: legacyPartner?.id || 'legacy-partner-for-test-company',
        partnerCompanyId: partnerCompanyId,
        sourcePartnerCompanyId: partnerCompanyId,
        requestedByEmployeeId: actionPerformedBy, // Track who made the registration (from token or authenticated user)
        partnerOfferId: offerId,
        courseId: offer.courseId,
        offerType: offer.offerType,
        originalAmount: Number(offer.totalAmount),
        finalAmount: finalAmount || Number(offer.totalAmount),
        installments: offer.installments || 1,
        status: 'PENDING',
        createdAt: new Date()
      },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        }
      }
    });

    // Create payment deadlines if needed
    if (registration.installments > 1) {
      const installmentAmount = Math.round(Number(registration.finalAmount) / registration.installments);
      const paymentDeadlines = [];
      
      for (let i = 0; i < registration.installments; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        
        paymentDeadlines.push({
          registrationId: registration.id,
          paymentNumber: i + 1,
          installmentNumber: i + 1,
          amount: i === registration.installments - 1 
            ? Number(registration.finalAmount) - (installmentAmount * (registration.installments - 1))
            : installmentAmount,
          dueDate: dueDate,
          status: 'PENDING' as const
        });
      }
      
      await prisma.paymentDeadline.createMany({
        data: paymentDeadlines
      });
    }

    console.log(`✅ User ${user.email} reactivated with registration ${registration.id}`);
    
    res.json({ 
      message: 'Utente riattivato con successo',
      registration: {
        id: registration.id,
        status: registration.status,
        courseName: offer.course?.name || offer.name,
        finalAmount: registration.finalAmount
      }
    });
  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete orphaned user - DELETE /api/partners/users/:userId/orphaned
router.delete('/users/:userId/orphaned', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    const { userId } = req.params;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Find legacy partner IDs that correspond to this partner company
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { referralCode: true, name: true }
    });
    
    let legacyPartnerIds: string[] = [];
    if (partnerCompany?.referralCode) {
      const legacyPartners = await prisma.partner.findMany({
        where: {
          OR: [
            { referralCode: { startsWith: partnerCompany.referralCode } },
            { referralCode: { endsWith: 'LEGACY' } }
          ]
        },
        select: { id: true, referralCode: true }
      });
      
      const baseCode = partnerCompany.referralCode.split('-')[0];
      legacyPartnerIds = legacyPartners
        .filter(p => p.referralCode.startsWith(baseCode))
        .map(p => p.id);
    }

    // Verify user is assigned to this partner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        registrations: {
          where: {
            partnerCompanyId: partnerCompanyId
          }
        },
        profile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Check if user is assigned to this partner (new or legacy system)
    const isAssignedToPartner = user.assignedPartnerId === partnerCompanyId || 
                               legacyPartnerIds.includes(user.assignedPartnerId || '');

    if (!isAssignedToPartner) {
      return res.status(403).json({ error: 'Utente non assegnato a questo partner' });
    }

    // Verify user is actually orphaned (no registrations)
    if (user.registrations.length > 0) {
      return res.status(400).json({ 
        error: 'Impossibile eliminare: l\'utente ha registrazioni attive',
        details: `L'utente ha ${user.registrations.length} registrazione/i`
      });
    }

    // Safety check: verify user has no registrations at all (not just for this partner)
    const totalRegistrations = await prisma.registration.count({
      where: { userId: userId }
    });

    if (totalRegistrations > 0) {
      return res.status(400).json({ 
        error: 'Impossibile eliminare: l\'utente ha registrazioni con altri partner',
        details: `L'utente ha ${totalRegistrations} registrazione/i totali`
      });
    }

    // Delete user and related data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete user offer access records
      await tx.userOfferAccess.deleteMany({
        where: { userId: userId }
      });

      // Delete user profile
      if (user.profile) {
        await tx.userProfile.delete({
          where: { userId: userId }
        });
      }


      // Delete user documents
      await tx.userDocument.deleteMany({
        where: { userId: userId }
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId }
      });
    });

    console.log(`🗑️ Deleted orphaned user: ${user.email} (${userId}) by partner ${partnerCompany?.name}`);

    res.json({ 
      success: true, 
      message: 'Utente orfano eliminato con successo',
      deletedUser: {
        id: userId,
        email: user.email,
        name: user.profile ? `${user.profile.nome} ${user.profile.cognome}` : null
      }
    });

  } catch (error) {
    console.error('Delete orphaned user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete all orphaned users - DELETE /api/partners/users/orphaned/all
router.delete('/users/orphaned/all', authenticateUnified, async (req: AuthRequest, res) => {
  try {
    const partnerCompanyId = req.partnerCompany?.id;
    
    if (!partnerCompanyId) {
      return res.status(400).json({ error: 'Partner company non trovata' });
    }

    // Only ADMINISTRATIVE role can delete all orphaned users
    const partnerEmployee = req.partnerEmployee;
    if (partnerEmployee?.role !== 'ADMINISTRATIVE') {
      return res.status(403).json({ 
        error: 'Accesso negato: solo gli utenti ADMINISTRATIVE possono eliminare tutti gli utenti orfani'
      });
    }

    // Find legacy partner IDs that correspond to this partner company
    const partnerCompany = await prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
      select: { referralCode: true, name: true }
    });
    
    let legacyPartnerIds: string[] = [];
    if (partnerCompany?.referralCode) {
      const legacyPartners = await prisma.partner.findMany({
        where: {
          OR: [
            { referralCode: { startsWith: partnerCompany.referralCode } },
            { referralCode: { endsWith: 'LEGACY' } }
          ]
        },
        select: { id: true, referralCode: true }
      });
      
      const baseCode = partnerCompany.referralCode.split('-')[0];
      legacyPartnerIds = legacyPartners
        .filter(p => p.referralCode.startsWith(baseCode))
        .map(p => p.id);
    }

    // Get all orphaned users for this partner
    const orphanedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { assignedPartnerId: partnerCompanyId },
          { assignedPartnerId: { in: legacyPartnerIds } }
        ]
      },
      include: {
        registrations: true,
        profile: true
      }
    });

    // Filter to only truly orphaned users (no registrations at all)
    const trulyOrphanedUsers = orphanedUsers.filter(user => user.registrations.length === 0);

    if (trulyOrphanedUsers.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Nessun utente orfano da eliminare',
        deletedCount: 0,
        deletedUsers: []
      });
    }

    // Delete all orphaned users in transaction
    const deletedUsers: any[] = [];
    
    await prisma.$transaction(async (tx) => {
      for (const user of trulyOrphanedUsers) {
        // Delete user offer access records
        await tx.userOfferAccess.deleteMany({
          where: { userId: user.id }
        });

        // Delete user profile
        if (user.profile) {
          await tx.userProfile.delete({
            where: { userId: user.id }
          });
        }


        // Delete user documents
        await tx.userDocument.deleteMany({
          where: { userId: user.id }
        });

        // Finally delete the user
        await tx.user.delete({
          where: { id: user.id }
        });

        deletedUsers.push({
          id: user.id,
          email: user.email,
          name: user.profile ? `${user.profile.nome} ${user.profile.cognome}` : null
        });
      }
    });

    console.log(`🗑️ Deleted ${deletedUsers.length} orphaned users by partner ${partnerCompany?.name} (${partnerEmployee?.email})`);

    res.json({ 
      success: true, 
      message: `Eliminati ${deletedUsers.length} utenti orfani`,
      deletedCount: deletedUsers.length,
      deletedUsers: deletedUsers
    });

  } catch (error) {
    console.error('Delete all orphaned users error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;