import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import SecureTokenService from '../services/secureTokenService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Helper function to process documents for a registration
async function processDocumentsForRegistration(tx: any, registrationId: string, userId: string, documents: any[]) {
  const documentTypeMap: Record<string, string> = {
    'cartaIdentita': 'IDENTITY_CARD',
    'certificatoTriennale': 'BACHELOR_DEGREE',
    'certificatoMagistrale': 'MASTER_DEGREE',
    'pianoStudioTriennale': 'TRANSCRIPT',
    'pianoStudioMagistrale': 'TRANSCRIPT',
    'certificatoMedico': 'MEDICAL_CERT',
    'certificatoNascita': 'BIRTH_CERT',
    'diplomoLaurea': 'BACHELOR_DEGREE',
    'pergamenaLaurea': 'MASTER_DEGREE',
    'diplomaMaturita': 'DIPLOMA'
  };

  for (const doc of documents) {
    const documentType = documentTypeMap[doc.type] || 'OTHER';
    
    // Check if document already exists
    const existingDoc = await tx.userDocument.findFirst({
      where: {
        userId,
        registrationId,
        type: documentType
      }
    });
    
    if (!existingDoc) {
      // Create new document record
      await tx.userDocument.create({
        data: {
          userId,
          registrationId,
          type: documentType,
          originalName: doc.originalFileName || doc.fileName,
          url: doc.url || doc.filePath,
          size: doc.fileSize || 0,
          mimeType: doc.mimeType || 'application/octet-stream',
          status: 'PENDING',
          uploadSource: 'ENROLLMENT',
          uploadedBy: userId,
          uploadedByRole: 'USER'
        }
      });
    }
  }
}

// Multer configuration for enrollment document uploads
const enrollmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folders: Record<string, string> = {
      // Basic documents
      cartaIdentita: 'carte-identita',
      certificatoMedico: 'certificati-medici',
      
      // TFA specific documents
      certificatoTriennale: 'lauree',
      certificatoMagistrale: 'lauree',
      pianoStudioTriennale: 'piani-studio',
      pianoStudioMagistrale: 'piani-studio',
      certificatoNascita: 'certificati-nascita',
      
      // Diplomas
      diplomoLaurea: 'diplomi-laurea',
      pergamenaLaurea: 'pergamene-laurea',
      
      // Other
      altro: 'altri'
    };
    
    const docType = req.body.documentType || 'altro';
    const folder = folders[docType] || 'altri';
    const uploadPath = path.join(__dirname, '../../uploads', folder);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const enrollmentUpload = multer({
  storage: enrollmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non permesso'));
    }
  }
});

// Helper function to apply coupon and record usage
async function applyCouponAndRecordUsage(
  couponCode: string, 
  partnerId: string, 
  registrationId: string, 
  baseAmount: number,
  tx: any // Prisma transaction client
): Promise<{ finalAmount: number; couponApplied: boolean; discountApplied: number }> {
  try {
    // Find active coupon for this partner
    const coupon = await tx.coupon.findFirst({
      where: {
        code: couponCode,
        partnerId: partnerId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    if (!coupon) {
      return { finalAmount: baseAmount, couponApplied: false, discountApplied: 0 };
    }

    // Check usage limits
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      console.warn(`Coupon ${couponCode} has reached usage limit: ${coupon.usedCount}/${coupon.maxUses}`);
      return { finalAmount: baseAmount, couponApplied: false, discountApplied: 0 };
    }

    // Calculate discount
    let finalAmount = baseAmount;
    let discountApplied = 0;

    if (coupon.discountType === 'PERCENTAGE') {
      const discountPercent = Number(coupon.discountPercent || 0);
      discountApplied = baseAmount * (discountPercent / 100);
      finalAmount = baseAmount - discountApplied;
    } else if (coupon.discountType === 'FIXED') {
      discountApplied = Math.min(Number(coupon.discountAmount || 0), baseAmount);
      finalAmount = Math.max(0, baseAmount - discountApplied);
    }

    // Record coupon usage
    await tx.couponUse.create({
      data: {
        couponId: coupon.id,
        registrationId: registrationId,
        discountApplied: discountApplied,
        usedAt: new Date()
      }
    });

    // Increment usage counter
    const updatedCoupon = await tx.coupon.update({
      where: { id: coupon.id },
      data: { 
        usedCount: { increment: 1 }
      }
    });

    // Check if coupon should be deactivated (reached max uses)
    if (updatedCoupon.maxUses && updatedCoupon.usedCount >= updatedCoupon.maxUses) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { isActive: false }
      });
      console.log(`Coupon ${couponCode} deactivated after reaching usage limit: ${updatedCoupon.usedCount}/${updatedCoupon.maxUses}`);
    }

    console.log(`Applied coupon ${couponCode}: ${baseAmount} -> ${finalAmount} (discount: ${discountApplied})`);
    return { finalAmount, couponApplied: true, discountApplied };

  } catch (error) {
    console.error('Error applying coupon:', error);
    return { finalAmount: baseAmount, couponApplied: false, discountApplied: 0 };
  }
}

// Helper function to map frontend document types to database enum values
function mapDocumentType(frontendType: string): string {
  const typeMapping: Record<string, string> = {
    cartaIdentita: 'CARTA_IDENTITA',
    certificatoTriennale: 'CERTIFICATO_TRIENNALE',
    certificatoMagistrale: 'CERTIFICATO_MAGISTRALE',
    pianoStudioTriennale: 'PIANO_STUDIO_TRIENNALE',
    pianoStudioMagistrale: 'PIANO_STUDIO_MAGISTRALE',
    certificatoMedico: 'CERTIFICATO_MEDICO',
    certificatoNascita: 'CERTIFICATO_NASCITA',
    diplomoLaurea: 'DIPLOMA_LAUREA',
    pergamenaLaurea: 'PERGAMENA_LAUREA'
  };
  
  return typeMapping[frontendType] || 'ALTRO';
}

// POST /api/registration/upload-document - Upload document during enrollment
// Temporary document upload for enrollment (no userId required)
router.post('/upload-temp-document', enrollmentUpload.single('document'), async (req: Request, res: Response) => {
  try {
    const { documentType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'File non fornito' });
    }
    
    if (!documentType) {
      return res.status(400).json({ error: 'documentType è richiesto' });
    }
    
    // Generate temporary ID
    const tempId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Return file info for localStorage storage
    res.json({
      success: true,
      tempId: tempId,
      filePath: file.path,
      url: file.path,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      documentType: documentType,
      uploadedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Temp document upload error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

router.post('/upload-document', enrollmentUpload.single('document'), async (req: Request, res: Response) => {
  try {
    const { userId, documentType, templateType, registrationId } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'File non fornito' });
    }
    
    if (!userId || !documentType || !registrationId) {
      return res.status(400).json({ error: 'userId, documentType e registrationId sono richiesti' });
    }
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Map frontend document type to database enum
    const dbDocumentType = mapDocumentType(documentType);
    
    // Check if document of this type already exists for this user (not linked to a registration yet)
    // Check if document already exists for this specific registration
    const existingDoc = await prisma.userDocument.findFirst({
      where: {
        userId,
        registrationId,
        type: dbDocumentType as any
      }
    });
    
    let document;
    
    if (existingDoc) {
      // Update existing document for this registration
      document = await prisma.userDocument.update({
        where: { id: existingDoc.id },
        data: {
          originalName: file.originalname,
          url: file.path,
          size: file.size,
          mimeType: file.mimetype,
          status: 'PENDING',
          uploadedAt: new Date()
        }
      });
      
      // Clean up old file
      try {
        if (existingDoc.url && fs.existsSync(existingDoc.url)) {
          fs.unlinkSync(existingDoc.url);
        }
      } catch (error) {
        console.error('Error deleting old file:', error);
      }
    } else {
      // Create new document
      document = await prisma.userDocument.create({
        data: {
          userId,
          registrationId,
          type: dbDocumentType as any,
          originalName: file.originalname,
          url: file.path,
          size: file.size,
          mimeType: file.mimetype,
          status: 'PENDING',
          uploadSource: 'ENROLLMENT',
          uploadedBy: userId,
          uploadedByRole: 'USER'
        }
      });
    }
    
    console.log(`📄 Document uploaded during enrollment: ${documentType} for user ${userId}`);
    
    res.json({
      success: true,
      document: {
        id: document.id,
        type: documentType, // Return frontend type
        fileName: document.originalName,
        uploadedAt: document.uploadedAt,
        status: document.status
      },
      message: existingDoc ? 'Documento aggiornato con successo' : 'Documento caricato con successo'
    });
    
  } catch (error) {
    console.error('Error uploading enrollment document:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file on error:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/registration/user-documents/:userId - Get user's unlinked documents for enrollment
router.get('/user-documents/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Get documents not yet linked to any registration - now returns empty as all documents are registration-specific
    const documents: any[] = [];
    
    // Map database types back to frontend types
    const frontendTypeMapping: Record<string, string> = {
      CARTA_IDENTITA: 'cartaIdentita',
      CERTIFICATO_TRIENNALE: 'certificatoTriennale',
      CERTIFICATO_MAGISTRALE: 'certificatoMagistrale',
      PIANO_STUDIO_TRIENNALE: 'pianoStudioTriennale',
      PIANO_STUDIO_MAGISTRALE: 'pianoStudioMagistrale',
      CERTIFICATO_MEDICO: 'certificatoMedico',
      CERTIFICATO_NASCITA: 'certificatoNascita',
      DIPLOMA_LAUREA: 'diplomoLaurea',
      PERGAMENA_LAUREA: 'pergamenaLaurea'
    };
    
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      type: frontendTypeMapping[doc.type] || 'altro',
      fileName: doc.originalName,
      uploadedAt: doc.uploadedAt,
      status: doc.status,
      isVerified: doc.status === 'APPROVED'
    }));
    
    res.json({ documents: formattedDocuments });
    
  } catch (error) {
    console.error('Error getting user documents:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/registration/check-user/:email - Check if user exists
router.get('/check-user/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: {
          include: {
            offer: true
          }
        }
      }
    });
    
    if (existingUser) {
      return res.json({
        exists: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          hasProfile: !!existingUser.profile,
          registrationsCount: existingUser.registrations.length,
          emailVerified: existingUser.emailVerified
        }
      });
    }
    
    return res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user existence:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/registration/offer-info/:referralLink - Get offer information for registration
router.get('/offer-info/:referralLink', async (req, res) => {
  try {
    const offer = await prisma.partnerOffer.findUnique({
      where: { 
        referralLink: req.params.referralLink,
        isActive: true
      },
      include: {
        course: true,
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({
      offer,
      formConfig: {
        templateType: offer.course.templateType,
        steps: offer.course.templateType === 'TFA' 
          ? ['generale', 'residenza', 'istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo']
          : ['generale', 'residenza', 'documenti', 'opzioni', 'riepilogo'],
        requiredFields: offer.course.templateType === 'TFA'
          ? {
              generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre'],
              documenti: ['cartaIdentita', 'diplomoLaurea', 'pergamenaLaurea', 'certificatoMedico', 'certificatoNascita']
            }
          : {
              generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'],
              documenti: ['cartaIdentita', 'codiceFiscale']
            }
      }
    });
  } catch (error) {
    console.error('Error fetching offer info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// REMOVED: Old submit endpoint - users now follow separate registration/enrollment flow
// Registration: RegistrationModal → /auth/register → email verification → login
// Enrollment: MultiStepForm → /registration/additional-enrollment (authenticated only)

// POST /api/registration/additional-enrollment - Additional enrollment for existing users
router.post('/additional-enrollment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      courseId, 
      partnerOfferId, 
      paymentPlan, 
      couponCode,
      documents = [],
      tempDocuments = [], // Also accept tempDocuments
      courseData = {},
      referralCode  // Add referralCode to help identify partner if user doesn't have one assigned
    } = req.body;
    
    // Use tempDocuments if documents is empty
    const documentsToProcess = documents.length > 0 ? documents : tempDocuments;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Check if user has profile and get associated partner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        assignedPartner: true  // Get the permanently assigned partner
      }
    });
    
    if (!user || !user.profile) {
      return res.status(400).json({ error: 'Profilo utente non trovato' });
    }
    
    // Determine partner ID
    let partnerId = user.assignedPartnerId;
    let offer = null;
    
    // If user doesn't have an assigned partner, try to find one from the offer or referral code
    if (!partnerId && partnerOfferId) {
      // Get offer first to find the partner
      offer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId },
        include: { partner: true, course: true }
      });
      
      if (offer) {
        partnerId = offer.partnerId;
        
        // Assign this partner to the user permanently
        await prisma.user.update({
          where: { id: userId },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to user ${userId} from offer ${partnerOfferId}`);
      }
    }
    
    // If still no partner and we have a referral code, try to find partner from referral code
    if (!partnerId && referralCode) {
      // First try to find PartnerCompany directly with the referral code
      const partnerCompany = await prisma.partnerCompany.findUnique({
        where: { referralCode: referralCode }
      });
      
      if (partnerCompany) {
        // Create or find a legacy Partner record for backward compatibility
        let partner = await prisma.partner.findFirst({
          where: { referralCode: { startsWith: referralCode } }
        });
        
        if (!partner) {
          // Create a legacy partner entry for backward compatibility
          partner = await prisma.partner.create({
            data: {
              id: `legacy-partner-${partnerCompany.id}`,
              userId: `dummy-user-for-partner-${partnerCompany.id}`,
              referralCode: `${referralCode}-LEGACY`,
              canCreateChildren: partnerCompany.canCreateChildren || false,
              commissionPerUser: partnerCompany.commissionPerUser || 0,
              commissionToAdmin: 0,
              promotedFromChild: false
            }
          });
        }
        
        partnerId = partner.id;
        
        // Assign this partner to the user permanently
        await prisma.user.update({
          where: { id: userId },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to user ${userId} from referral code ${referralCode} (PartnerCompany: ${partnerCompany.id})`);
      }
    }
    
    // If we still don't have a partner, we can't proceed
    if (!partnerId) {
      return res.status(400).json({ 
        error: 'Impossibile determinare il partner per questa iscrizione. Contatta il supporto.',
        details: 'User has no assigned partner and no valid partner could be determined from offer or referral code'
      });
    }
    
    // Get offer information if we don't have it yet
    if (partnerOfferId && !offer) {
      offer = await prisma.partnerOffer.findUnique({
        where: { 
          id: partnerOfferId,
          partnerId: partnerId  // Ensure offer belongs to the determined partner
        },
        include: { partner: true, course: true }
      });
      
      if (!offer) {
        return res.status(400).json({ error: 'Offerta non trovata o non autorizzata per il partner determinato' });
      }

      // Validate that the courseId matches the offer's course
      if (offer.courseId !== courseId) {
        return res.status(400).json({ 
          error: 'Il corso specificato non corrisponde all\'offerta del partner',
          details: `Expected courseId: ${offer.courseId}, received: ${courseId}`
        });
      }
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate registrations with same user and course
      // Include both cases: with and without partnerOfferId
      const existingRegistration = await tx.registration.findFirst({
        where: {
          userId: userId,
          courseId: courseId,
          partnerId: partnerId,
          status: 'PENDING' // Only check pending registrations
        }
      });
      
      if (existingRegistration) {
        console.log(`⚠️ Duplicate registration attempt detected for user ${userId}, returning existing registration ${existingRegistration.id}`);
        return existingRegistration; // Return the existing registration instead of creating a duplicate
      }
      
      // NEW: Enhanced hierarchical system with referral link parsing
      let partnerCompanyId = null;
      let sourcePartnerCompanyId = null;
      let isDirectRegistration = true;
      
      if (partnerId && partnerId !== 'default-partner-id') {
        // Method 1: Use referral link from offer (most accurate for sub-partner detection)
        if (offer?.referralLink) {
          console.log(`🔍 Analyzing referral link: ${offer.referralLink}`);
          try {
            // Import the service dynamically to avoid circular imports
            const { OfferInheritanceService } = await import('../services/offerInheritanceService');
            console.log(`✅ OfferInheritanceService imported successfully`);
            
            const companiesInfo = await OfferInheritanceService.findCompaniesByReferralLink(offer.referralLink);
            console.log(`🔍 Companies info:`, companiesInfo);
            
            if (companiesInfo.isSubPartnerRegistration && companiesInfo.childCompany) {
              // Sub-partner registration
              partnerCompanyId = companiesInfo.parentCompany.id; // Parent gets commissions  
              sourcePartnerCompanyId = companiesInfo.childCompany.id; // Child is the source
              isDirectRegistration = false;
              console.log(`📋 Sub-partner registration via referral link: source=${sourcePartnerCompanyId} (${companiesInfo.childCompany.name}), parent=${partnerCompanyId} (${companiesInfo.parentCompany.name})`);
            } else {
              // Direct parent registration
              partnerCompanyId = companiesInfo.parentCompany.id;
              sourcePartnerCompanyId = companiesInfo.parentCompany.id;
              isDirectRegistration = true;
              console.log(`📋 Direct parent registration via referral link: company=${partnerCompanyId} (${companiesInfo.parentCompany.name})`);
            }
          } catch (error) {
            console.error(`❌ Error parsing referral link ${offer.referralLink}:`, error);
            // Fallback to method 2
          }
        } else {
          console.log(`⚠️ No referral link found in offer:`, offer);
        }
        
        // Method 2: Fallback - check partnerCompanyId from offer
        console.log(`🔍 Method 1 result: partnerCompanyId=${partnerCompanyId}`);
        if (!partnerCompanyId && offer?.partnerCompanyId) {
          console.log(`🔍 Using Method 2 - offer.partnerCompanyId: ${offer.partnerCompanyId}`);
          const offerCompany = await tx.partnerCompany.findUnique({
            where: { id: offer.partnerCompanyId },
            include: { parent: true }
          });
          
          if (offerCompany) {
            if (offerCompany.parentId) {
              partnerCompanyId = offerCompany.parentId; // Parent gets commissions
              sourcePartnerCompanyId = offerCompany.id; // Child is the source
              isDirectRegistration = false;
              console.log(`📋 Sub-partner registration via offer company: source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
            } else {
              partnerCompanyId = offerCompany.id;
              sourcePartnerCompanyId = offerCompany.id;
              console.log(`📋 Direct partner registration via offer company: company=${partnerCompanyId}`);
            }
          }
        }
        
        // Method 3: Legacy fallback - map Partner to PartnerCompany via referralCode
        console.log(`🔍 Method 2 result: partnerCompanyId=${partnerCompanyId}`);
        if (!partnerCompanyId) {
          console.log(`🔍 Using Method 3 - Legacy mapping with partnerId: ${partnerId}`);
          const partner = await tx.partner.findUnique({
            where: { id: partnerId }
          });
          if (partner?.referralCode) {
            const partnerCompany = await tx.partnerCompany.findFirst({
              where: { 
                referralCode: {
                  startsWith: partner.referralCode.split('-')[0]
                }
              },
              include: { parent: true }
            });
            if (partnerCompany) {
              partnerCompanyId = partnerCompany.id;
              sourcePartnerCompanyId = partnerCompany.id;
              
              if (partnerCompany.parentId) {
                isDirectRegistration = false;
                partnerCompanyId = partnerCompany.parentId;
                console.log(`📋 Sub-partner registration via legacy mapping: source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
              } else {
                console.log(`📋 Direct partner registration via legacy mapping: company=${partnerCompanyId}`);
              }
            }
          }
        }
      }
      
      // Determine default amounts based on offer type
      const isCertification = offer?.course?.templateType === 'CERTIFICATION';
      const defaultAmount = isCertification ? 1500 : 4500;
      const offerAmount = Number(offer?.totalAmount) || defaultAmount;
      
      // Final fallback: if still no partnerCompanyId, try to get it from the Partner's referralCode
      if (!partnerCompanyId && partnerId && partnerId !== 'default-partner-id') {
        console.log(`⚠️ Final fallback: trying to find PartnerCompany for partnerId ${partnerId}`);
        const partner = await tx.partner.findUnique({
          where: { id: partnerId }
        });
        
        if (partner?.referralCode) {
          // Extract base referral code (e.g., "DIAMANTE001" from "DIAMANTE001-LEGACY")
          const baseReferralCode = partner.referralCode.split('-')[0];
          console.log(`🔍 Looking for PartnerCompany with base referral code: ${baseReferralCode}`);
          
          const partnerCompany = await tx.partnerCompany.findFirst({
            where: { 
              OR: [
                { referralCode: baseReferralCode },
                { referralCode: { startsWith: baseReferralCode } }
              ]
            },
            orderBy: { createdAt: 'asc' } // Get the oldest one (likely the main company)
          });
          
          if (partnerCompany) {
            partnerCompanyId = partnerCompany.id;
            sourcePartnerCompanyId = partnerCompany.id;
            isDirectRegistration = true;
            console.log(`✅ Found PartnerCompany via final fallback: ${partnerCompany.id} (${partnerCompany.name})`);
          }
        }
      }
      
      // Log final tracking values before creating registration
      console.log(`📋 Final tracking values:`, {
        partnerCompanyId,
        sourcePartnerCompanyId,
        isDirectRegistration,
        offerReferralLink: offer?.referralLink
      });
      
      // Create new registration with course-specific data
      const registration = await tx.registration.create({
        data: {
          userId: userId,
          partnerId: partnerId || 'default-partner-id',
          partnerCompanyId: partnerCompanyId,
          sourcePartnerCompanyId: sourcePartnerCompanyId,
          isDirectRegistration: isDirectRegistration,
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: isCertification ? 'CERTIFICATION' : 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || offerAmount,
          finalAmount: paymentPlan.finalAmount || offerAmount,
          remainingAmount: paymentPlan.finalAmount || offerAmount, // Initialize with final amount
          installments: paymentPlan.installments || offer?.installments || 1,
          status: 'PENDING',
          // Course-specific data from courseData object
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
          // Diploma data
          diplomaData: courseData.diplomaData ? new Date(courseData.diplomaData) : null,
          diplomaCitta: courseData.diplomaCitta || null,
          diplomaProvincia: courseData.diplomaProvincia || null,
          diplomaIstituto: courseData.diplomaIstituto || null,
          diplomaVoto: courseData.diplomaVoto || null,
          // Triennale education data
          tipoLaureaTriennale: courseData.tipoLaureaTriennale || null,
          laureaConseguitaTriennale: courseData.laureaConseguitaTriennale || null,
          laureaUniversitaTriennale: courseData.laureaUniversitaTriennale || null,
          laureaDataTriennale: courseData.laureaDataTriennale ? new Date(courseData.laureaDataTriennale) : null,
          // Profession data
          tipoProfessione: courseData.tipoProfessione || null,
          scuolaDenominazione: courseData.scuolaDenominazione || null,
          scuolaCitta: courseData.scuolaCitta || null,
          scuolaProvincia: courseData.scuolaProvincia || null
        }
      });
      
      const installments = paymentPlan.installments || 1;
      let finalAmount = Number(paymentPlan.finalAmount) || 0;
      const registrationOfferType = offer?.course?.templateType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA_ROMANIA';
      
      // FALLBACK: If finalAmount is 0, use offer's totalAmount
      if (finalAmount === 0 && offer && offer.totalAmount) {
        finalAmount = Number(offer.totalAmount);
        console.log(`⚠️ FinalAmount was 0, using offer totalAmount: ${finalAmount}`);
      }
      
      
      // Apply coupon if provided
      if (couponCode && partnerId) {
        const originalAmount = Number(paymentPlan.originalAmount) || offerAmount;
        const couponResult = await applyCouponAndRecordUsage(
          couponCode, 
          partnerId, 
          registration.id, 
          originalAmount,
          tx
        );
        
        if (couponResult.couponApplied) {
          finalAmount = couponResult.finalAmount;
          
          // Update registration with corrected amounts
          await tx.registration.update({
            where: { id: registration.id },
            data: {
              originalAmount: originalAmount,
              finalAmount: finalAmount
            }
          });
          
          console.log(`Coupon applied to registration ${registration.id}: ${originalAmount} -> ${finalAmount}`);
        }
      }
      
      console.log(`Creating payment deadlines for authenticated user registration ${registration.id}:`, {
        installments,
        finalAmount,
        offerType: registrationOfferType,
        hasCustomPlan: !!offer?.customPaymentPlan
      });
      
      // Check if offer has custom payment plan
      if (offer?.customPaymentPlan && typeof offer.customPaymentPlan === 'object' && 'payments' in offer.customPaymentPlan) {
        // Use custom payment plan from offer
        const customPayments = (offer.customPaymentPlan as any).payments;
        console.log(`Using custom payment plan with ${customPayments.length} payments:`, customPayments);
        
        // FOR TFA ROMANIA: Add €1500 down payment before custom installments
        if (registrationOfferType === 'TFA_ROMANIA' && customPayments.length > 1) {
          const downPaymentDate = new Date();
          downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration
          
          await tx.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: 1500,
              dueDate: downPaymentDate,
              paymentNumber: 0,
              isPaid: false
            }
          });
          
          console.log(`Created TFA Romania down payment deadline: €1500`);
          
          // Recalculate custom payment amounts for TFA Romania (subtract €1500 from total)
          const remainingAmount = finalAmount - 1500;
          const amountPerInstallment = remainingAmount / customPayments.length;
          
          for (let i = 0; i < customPayments.length; i++) {
            const payment = customPayments[i];
            const dueDate = new Date(payment.dueDate);
            
            await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: Math.round(amountPerInstallment * 100) / 100, // Use calculated amount for TFA Romania
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created TFA custom payment deadline ${i + 1}: €${amountPerInstallment} (recalculated)`);
          }
        } else {
          // For CERTIFICATIONS or TFA single payment: use original custom amounts
          for (let i = 0; i < customPayments.length; i++) {
            const payment = customPayments[i];
            const dueDate = new Date(payment.dueDate);
            
            await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: Number(payment.amount),
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created custom payment deadline ${i + 1}:`, payment);
          }
        }
      } else {
        // Use standard payment logic
        let downPayment = 0;
        let installmentableAmount = finalAmount;
        
        if (registrationOfferType === 'TFA_ROMANIA') {
          downPayment = 1500;
          installmentableAmount = Math.max(0, finalAmount - downPayment);
        }
        
        if (installments > 1) {
          // For TFA: down payment is NOT counted as an installment
          // Calculate: (total price - down payment) / number of installments
          const amountPerInstallment = installmentableAmount / installments;
          
          if (downPayment > 0) {
            const downPaymentDate = new Date();
            downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration
            
            const downPaymentDeadline = await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: downPayment,
                dueDate: downPaymentDate,
                paymentNumber: 0,
                description: 'Acconto',
                isPaid: false
              }
            });
            
            console.log(`Created down payment deadline:`, downPaymentDeadline);
          }
          
          // Calculate installment dates: first installment 30 days after down payment deadline
          const baseDate = new Date();
          if (downPayment > 0) {
            baseDate.setDate(baseDate.getDate() + 7 + 30); // 7 days + 30 days = 37 days after registration
          } else {
            baseDate.setDate(baseDate.getDate() + 7); // 7 days after registration if no down payment
          }
          
          for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i); // Each installment is 1 month apart
            
            await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: amountPerInstallment,
                dueDate: dueDate,
                paymentNumber: i + 1,
                description: `Rata ${i + 1} di ${installments}`,
                isPaid: false
              }
            });
          }
        } else {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7); // 7 days after registration
          
          const singlePaymentDeadline = await tx.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: finalAmount,
              dueDate: dueDate,
              paymentNumber: 1,
              description: 'Pagamento unico',
              isPaid: false
            }
          });
          
          console.log(`Created single payment deadline:`, singlePaymentDeadline);
        }
      }
      
      // Finalize temporarily uploaded documents first
      if (documentsToProcess && documentsToProcess.length > 0) {
        try {
          const documentsToFinalize = Array.isArray(documentsToProcess) ? documentsToProcess : [];
          
          if (documentsToFinalize.length > 0) {
            const { DocumentService } = await import('../services/documentService');
            const finalizedDocs = await DocumentService.finalizeEnrollmentDocuments(
              registration.id, 
              userId, 
              documentsToFinalize, 
              tx
            );
            console.log(`✅ Finalized ${finalizedDocs.length} enrollment documents for registration ${registration.id}`);
          }
        } catch (docError) {
          console.error('Document finalization error (non-blocking):', docError);
          // Don't fail registration if document finalization fails
        }
      }

      // DEPRECATED: Link existing user documents to new registration (no longer needed)
      // All documents are now created with registrationId directly
      console.log(`📝 Registration ${registration.id} created - documents will be uploaded directly with registrationId`);
      
      return registration;
    });
    
    // Send enrollment confirmation email
    try {
      const courseInfo = await prisma.course.findUnique({
        where: { id: courseId }
      });
      
      const partnerInfo = await prisma.partner.findUnique({
        where: { id: partnerId },
        include: {
          user: { select: { email: true } }
        }
      });
      
      await emailService.sendEnrollmentConfirmation(user.email, {
        nome: user.profile.nome,
        cognome: user.profile.cognome,
        email: user.email,
        registrationId: result.id,
        courseName: courseInfo?.name || 'Corso selezionato',
        offerType: offer?.offerType || 'TFA_ROMANIA',
        partnerName: partnerInfo?.user.email || 'Partner di riferimento'
      });
    } catch (emailError) {
      console.error('Failed to send enrollment confirmation email:', emailError);
      // Don't fail the registration if email fails
    }
    
    res.json({
      success: true,
      registrationId: result.id,
      message: 'Iscrizione aggiuntiva completata con successo'
    });
    
  } catch (error) {
    console.error('Additional enrollment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/registration/verified-user-enrollment - Enrollment for email-verified users (no auth required)
router.post('/verified-user-enrollment', async (req: Request, res: Response) => {
  try {
    const { 
      verifiedEmail,
      courseId, 
      partnerOfferId, 
      paymentPlan, 
      couponCode,
      documents = [],
      tempDocuments = [], // Also accept tempDocuments
      courseData = {},
      referralCode,
      // All the other enrollment data
      ...enrollmentData
    } = req.body;
    
    // Use tempDocuments if documents is empty
    const documentsToProcess = documents.length > 0 ? documents : tempDocuments;
    
    if (!verifiedEmail) {
      return res.status(400).json({ error: 'Email verificata richiesta' });
    }
    
    // Find the verified user
    const user = await prisma.user.findUnique({
      where: { 
        email: verifiedEmail,
        emailVerified: true
      },
      include: { 
        profile: true,
        assignedPartner: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente verificato non trovato' });
    }
    
    if (!user.profile) {
      return res.status(400).json({ error: 'Profilo utente non trovato' });
    }
    
    // Determine partner ID (same logic as authenticated enrollment)
    let partnerId = user.assignedPartnerId;
    let offer = null;
    
    if (!partnerId && partnerOfferId) {
      offer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId },
        include: { partner: true, course: true }
      });
      
      if (offer) {
        partnerId = offer.partnerId;
        
        await prisma.user.update({
          where: { id: user.id },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to verified user ${user.id} from offer ${partnerOfferId}`);
      }
    }
    
    if (!partnerId && referralCode) {
      // First try to find PartnerCompany directly with the referral code
      const partnerCompany = await prisma.partnerCompany.findUnique({
        where: { referralCode: referralCode }
      });
      
      if (partnerCompany) {
        // Create or find a legacy Partner record for backward compatibility
        let partner = await prisma.partner.findFirst({
          where: { referralCode: { startsWith: referralCode } }
        });
        
        if (!partner) {
          // Create a legacy partner entry for backward compatibility
          partner = await prisma.partner.create({
            data: {
              id: `legacy-partner-${partnerCompany.id}`,
              userId: `dummy-user-for-partner-${partnerCompany.id}`,
              referralCode: `${referralCode}-LEGACY`,
              canCreateChildren: partnerCompany.canCreateChildren || false,
              commissionPerUser: partnerCompany.commissionPerUser || 0,
              commissionToAdmin: 0,
              promotedFromChild: false
            }
          });
        }
        
        partnerId = partner.id;
        
        await prisma.user.update({
          where: { id: user.id },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to verified user ${user.id} from referral code ${referralCode} (PartnerCompany: ${partnerCompany.id})`);
      }
    }
    
    if (!partnerId) {
      return res.status(400).json({ 
        error: 'Impossibile determinare il partner per questa iscrizione',
        details: 'No partner could be determined from offer or referral code'
      });
    }
    
    // Get offer information if we don't have it yet
    if (partnerOfferId && !offer) {
      offer = await prisma.partnerOffer.findUnique({
        where: { 
          id: partnerOfferId,
          partnerId: partnerId
        },
        include: { partner: true, course: true }
      });
      
      if (!offer) {
        return res.status(400).json({ error: 'Offerta non trovata o non autorizzata' });
      }

      if (offer.courseId !== courseId) {
        return res.status(400).json({ 
          error: 'Il corso specificato non corrisponde all\'offerta del partner'
        });
      }
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing registrations - more comprehensive check
      // Check by multiple criteria to catch registrations created by token service
      const existingRegistration = await tx.registration.findFirst({
        where: {
          userId: user.id,
          status: 'PENDING',
          OR: [
            // Check by course and partner
            {
              courseId: courseId,
              partnerId: partnerId
            },
            // Check by partnerOfferId if provided
            ...(partnerOfferId ? [{
              partnerOfferId: partnerOfferId
            }] : [])
          ]
        }
      });
      
      if (existingRegistration) {
        console.log(`✓ Found existing registration ${existingRegistration.id} for verified user ${user.id}, updating it instead of creating duplicate`);
        
        // Update the existing registration with enrollment data
        const updatedRegistration = await tx.registration.update({
          where: { id: existingRegistration.id },
          data: {
            // Update amounts if provided
            originalAmount: paymentPlan.originalAmount || existingRegistration.originalAmount,
            finalAmount: paymentPlan.finalAmount || existingRegistration.finalAmount,
            remainingAmount: paymentPlan.finalAmount || existingRegistration.remainingAmount,
            installments: paymentPlan.installments || existingRegistration.installments,
            // Course-specific data
            tipoLaurea: courseData.tipoLaurea || existingRegistration.tipoLaurea,
            laureaConseguita: courseData.laureaConseguita || existingRegistration.laureaConseguita,
            laureaUniversita: courseData.laureaUniversita || existingRegistration.laureaUniversita,
            laureaData: courseData.laureaData ? new Date(courseData.laureaData) : existingRegistration.laureaData,
            // Diploma data
            diplomaData: courseData.diplomaData ? new Date(courseData.diplomaData) : existingRegistration.diplomaData,
            diplomaCitta: courseData.diplomaCitta || existingRegistration.diplomaCitta,
            diplomaProvincia: courseData.diplomaProvincia || existingRegistration.diplomaProvincia,
            diplomaIstituto: courseData.diplomaIstituto || existingRegistration.diplomaIstituto,
            diplomaVoto: courseData.diplomaVoto || existingRegistration.diplomaVoto,
            tipoLaureaTriennale: courseData.tipoLaureaTriennale || existingRegistration.tipoLaureaTriennale,
            laureaConseguitaTriennale: courseData.laureaConseguitaTriennale || existingRegistration.laureaConseguitaTriennale,
            laureaUniversitaTriennale: courseData.laureaUniversitaTriennale || existingRegistration.laureaUniversitaTriennale,
            laureaDataTriennale: courseData.laureaDataTriennale ? new Date(courseData.laureaDataTriennale) : existingRegistration.laureaDataTriennale,
            tipoProfessione: courseData.tipoProfessione || existingRegistration.tipoProfessione,
            scuolaDenominazione: courseData.scuolaDenominazione || existingRegistration.scuolaDenominazione,
            scuolaCitta: courseData.scuolaCitta || existingRegistration.scuolaCitta,
            scuolaProvincia: courseData.scuolaProvincia || existingRegistration.scuolaProvincia,
            // Clear token since we're completing the enrollment
            accessToken: null,
            tokenExpiresAt: null
          }
        });
        
        // Check if payment deadlines already exist
        const existingDeadlines = await tx.paymentDeadline.findMany({
          where: { registrationId: existingRegistration.id }
        });
        
        // Only create payment deadlines if they don't exist
        if (existingDeadlines.length === 0) {
          // Create payment deadlines (continue with existing logic)
          const installments = paymentPlan.installments || updatedRegistration.installments || 1;
          let finalAmount = Number(paymentPlan.finalAmount) || Number(updatedRegistration.finalAmount);
          const registrationOfferType = offer?.course?.templateType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA_ROMANIA';
          
          console.log(`Creating payment deadlines for existing registration ${updatedRegistration.id}`);
          
          // Check if offer has custom payment plan
          if (offer?.customPaymentPlan && typeof offer.customPaymentPlan === 'object' && 'payments' in offer.customPaymentPlan) {
            const customPayments = (offer.customPaymentPlan as any).payments;
            
            // FOR TFA ROMANIA: Add €1500 down payment before custom installments
            if (registrationOfferType === 'TFA_ROMANIA' && customPayments.length > 1) {
              const downPaymentDate = new Date();
              downPaymentDate.setDate(downPaymentDate.getDate() + 7);
              
              await tx.paymentDeadline.create({
                data: {
                  registrationId: updatedRegistration.id,
                  amount: 1500,
                  dueDate: downPaymentDate,
                  paymentNumber: 0,
                  isPaid: false,
                  description: 'Acconto'
                }
              });
              
              const remainingAmount = finalAmount - 1500;
              const installmentAmount = remainingAmount / customPayments.length;
              
              for (let i = 0; i < customPayments.length; i++) {
                const payment = customPayments[i];
                await tx.paymentDeadline.create({
                  data: {
                    registrationId: updatedRegistration.id,
                    amount: installmentAmount,
                    dueDate: new Date(payment.dueDate),
                    paymentNumber: i + 1,
                    isPaid: false,
                    description: `Rata ${i + 1} di ${customPayments.length}`
                  }
                });
              }
            } else if (customPayments.length > 0) {
              // For certifications or single payment, use custom plan directly
              for (let i = 0; i < customPayments.length; i++) {
                const payment = customPayments[i];
                await tx.paymentDeadline.create({
                  data: {
                    registrationId: updatedRegistration.id,
                    amount: payment.amount,
                    dueDate: new Date(payment.dueDate),
                    paymentNumber: i + 1,
                    isPaid: false,
                    description: payment.description || `Pagamento ${i + 1}`
                  }
                });
              }
            }
          } else {
            // Standard payment plan logic
            if (registrationOfferType === 'TFA_ROMANIA' && installments > 1) {
              // Create down payment
              const downPaymentDate = new Date();
              downPaymentDate.setDate(downPaymentDate.getDate() + 7);
              
              await tx.paymentDeadline.create({
                data: {
                  registrationId: updatedRegistration.id,
                  amount: 1500,
                  dueDate: downPaymentDate,
                  paymentNumber: 0,
                  isPaid: false,
                  description: 'Acconto'
                }
              });
              
              // Create installments
              const remainingAmount = finalAmount - 1500;
              const installmentAmount = remainingAmount / installments;
              const baseDate = new Date();
              baseDate.setDate(baseDate.getDate() + 37); // 7 days for down payment + 30 days
              
              for (let i = 0; i < installments; i++) {
                const dueDate = new Date(baseDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                
                await tx.paymentDeadline.create({
                  data: {
                    registrationId: updatedRegistration.id,
                    amount: installmentAmount,
                    dueDate,
                    paymentNumber: i + 1,
                    isPaid: false,
                    description: `Rata ${i + 1} di ${installments}`
                  }
                });
              }
            } else {
              // Single payment or certification
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + 7);
              
              await tx.paymentDeadline.create({
                data: {
                  registrationId: updatedRegistration.id,
                  amount: finalAmount,
                  dueDate,
                  paymentNumber: 1,
                  isPaid: false,
                  description: installments > 1 ? `Rata 1 di ${installments}` : 'Pagamento unico'
                }
              });
            }
          }
        }
        
        // Process documents if provided
        if (documentsToProcess && documentsToProcess.length > 0) {
          await processDocumentsForRegistration(tx, updatedRegistration.id, user.id, documentsToProcess);
        }
        
        return updatedRegistration;
      }
      
      // NEW: Enhanced hierarchical system with referral link parsing (duplicate logic for complete registration)
      let partnerCompanyId = null;
      let sourcePartnerCompanyId = null;
      let isDirectRegistration = true;
      
      if (partnerId && partnerId !== 'default-partner-id') {
        // Method 1: Use referral link from offer (most accurate for sub-partner detection)
        if (offer?.referralLink) {
          try {
            // Import the service dynamically to avoid circular imports
            const { OfferInheritanceService } = await import('../services/offerInheritanceService');
            
            const companiesInfo = await OfferInheritanceService.findCompaniesByReferralLink(offer.referralLink);
            
            if (companiesInfo.isSubPartnerRegistration && companiesInfo.childCompany) {
              // Sub-partner registration
              partnerCompanyId = companiesInfo.parentCompany.id; // Parent gets commissions  
              sourcePartnerCompanyId = companiesInfo.childCompany.id; // Child is the source
              isDirectRegistration = false;
              console.log(`📋 Sub-partner registration via referral link (complete): source=${sourcePartnerCompanyId} (${companiesInfo.childCompany.name}), parent=${partnerCompanyId} (${companiesInfo.parentCompany.name})`);
            } else {
              // Direct parent registration
              partnerCompanyId = companiesInfo.parentCompany.id;
              sourcePartnerCompanyId = companiesInfo.parentCompany.id;
              isDirectRegistration = true;
              console.log(`📋 Direct parent registration via referral link (complete): company=${partnerCompanyId} (${companiesInfo.parentCompany.name})`);
            }
          } catch (error) {
            console.warn(`⚠️ Error parsing referral link ${offer.referralLink}:`, error);
            // Fallback to method 2
          }
        }
        
        // Method 2: Fallback - check partnerCompanyId from offer
        if (!partnerCompanyId && offer?.partnerCompanyId) {
          const offerCompany = await tx.partnerCompany.findUnique({
            where: { id: offer.partnerCompanyId },
            include: { parent: true }
          });
          
          if (offerCompany) {
            if (offerCompany.parentId) {
              partnerCompanyId = offerCompany.parentId; // Parent gets commissions
              sourcePartnerCompanyId = offerCompany.id; // Child is the source
              isDirectRegistration = false;
              console.log(`📋 Sub-partner registration via offer company (complete): source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
            } else {
              partnerCompanyId = offerCompany.id;
              sourcePartnerCompanyId = offerCompany.id;
              console.log(`📋 Direct partner registration via offer company (complete): company=${partnerCompanyId}`);
            }
          }
        }
        
        // Method 3: Legacy fallback - map Partner to PartnerCompany via referralCode
        if (!partnerCompanyId) {
          const partner = await tx.partner.findUnique({
            where: { id: partnerId }
          });
          if (partner?.referralCode) {
            const partnerCompany = await tx.partnerCompany.findFirst({
              where: { 
                referralCode: {
                  startsWith: partner.referralCode.split('-')[0]
                }
              },
              include: { parent: true }
            });
            if (partnerCompany) {
              partnerCompanyId = partnerCompany.id;
              sourcePartnerCompanyId = partnerCompany.id;
              
              if (partnerCompany.parentId) {
                isDirectRegistration = false;
                partnerCompanyId = partnerCompany.parentId;
                console.log(`📋 Sub-partner registration via legacy mapping (complete): source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
              } else {
                console.log(`📋 Direct partner registration via legacy mapping (complete): company=${partnerCompanyId}`);
              }
            }
          }
        }
        
        // OLD FALLBACK: Try to find PartnerCompany via PartnerOffer first (most reliable)
        if (offer?.partnerCompanyId) {
          // Get the company that created the offer to check hierarchy
          const offerCompany = await tx.partnerCompany.findUnique({
            where: { id: offer.partnerCompanyId },
            include: { parent: true }
          });
          
          if (offerCompany) {
            // If the offer company has a parent, this is a sub-partner registration
            if (offerCompany.parentId) {
              partnerCompanyId = offerCompany.parentId; // Parent gets commissions
              sourcePartnerCompanyId = offerCompany.id; // Child is the source
              isDirectRegistration = false;
              console.log(`📋 Sub-partner registration via offer (complete): source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
            } else {
              // Direct registration from root company
              partnerCompanyId = offerCompany.id;
              sourcePartnerCompanyId = offerCompany.id;
              console.log(`📋 Direct partner registration via offer (complete): company=${partnerCompanyId}`);
            }
          }
        } else {
          // Fallback: try to map Partner to PartnerCompany via referralCode matching
          const partner = await tx.partner.findUnique({
            where: { id: partnerId }
          });
          if (partner?.referralCode) {
            const partnerCompany = await tx.partnerCompany.findFirst({
              where: { 
                referralCode: {
                  startsWith: partner.referralCode.split('-')[0] // Handle variations like TEST001 vs TEST001-LEGACY
                }
              },
              include: {
                parent: true // Include parent to determine if this is a sub-partner
              }
            });
            if (partnerCompany) {
              partnerCompanyId = partnerCompany.id;
              sourcePartnerCompanyId = partnerCompany.id;
              
              // Check if this is a sub-partner registration (indirect)
              if (partnerCompany.parentId) {
                isDirectRegistration = false;
                // For sub-partners, partnerCompanyId should be the parent (for commissions)
                // sourcePartnerCompanyId remains the sub-partner (for tracking)
                partnerCompanyId = partnerCompany.parentId;
                console.log(`📋 Sub-partner registration: source=${sourcePartnerCompanyId}, parent=${partnerCompanyId}`);
              } else {
                console.log(`📋 Direct partner registration: company=${partnerCompanyId}`);
              }
            }
          }
        }
      }
      
      // Determine default amounts based on offer type
      const isCertification = offer?.course?.templateType === 'CERTIFICATION';
      const defaultAmount = isCertification ? 1500 : 4500;
      const offerAmount = Number(offer?.totalAmount) || defaultAmount;
      
      // Create new registration
      const registration = await tx.registration.create({
        data: {
          userId: user.id,
          partnerId: partnerId || 'default-partner-id',
          partnerCompanyId: partnerCompanyId,
          sourcePartnerCompanyId: sourcePartnerCompanyId,
          isDirectRegistration: isDirectRegistration,
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: isCertification ? 'CERTIFICATION' : 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || offerAmount,
          finalAmount: paymentPlan.finalAmount || offerAmount,
          remainingAmount: paymentPlan.finalAmount || offerAmount, // Initialize with final amount
          installments: paymentPlan.installments || offer?.installments || 1,
          status: 'PENDING',
          // Course-specific data
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
          // Diploma data
          diplomaData: courseData.diplomaData ? new Date(courseData.diplomaData) : null,
          diplomaCitta: courseData.diplomaCitta || null,
          diplomaProvincia: courseData.diplomaProvincia || null,
          diplomaIstituto: courseData.diplomaIstituto || null,
          diplomaVoto: courseData.diplomaVoto || null,
          tipoLaureaTriennale: courseData.tipoLaureaTriennale || null,
          laureaConseguitaTriennale: courseData.laureaConseguitaTriennale || null,
          laureaUniversitaTriennale: courseData.laureaUniversitaTriennale || null,
          laureaDataTriennale: courseData.laureaDataTriennale ? new Date(courseData.laureaDataTriennale) : null,
          tipoProfessione: courseData.tipoProfessione || null,
          scuolaDenominazione: courseData.scuolaDenominazione || null,
          scuolaCitta: courseData.scuolaCitta || null,
          scuolaProvincia: courseData.scuolaProvincia || null
        }
      });
      
      // Create payment deadlines based on offer's custom payment plan or standard logic
      const installments = paymentPlan.installments || 1;
      let finalAmount = Number(paymentPlan.finalAmount) || 0;
      const registrationOfferType = offer?.course?.templateType === 'CERTIFICATION' ? 'CERTIFICATION' : 'TFA_ROMANIA';
      
      // FALLBACK: If finalAmount is 0, use offer's totalAmount
      if (finalAmount === 0 && offer && offer.totalAmount) {
        finalAmount = Number(offer.totalAmount);
        console.log(`⚠️ FinalAmount was 0, using offer totalAmount: ${finalAmount}`);
      }
      
      
      console.log(`Creating payment deadlines for registration ${registration.id}:`, {
        installments,
        finalAmount,
        offerType: registrationOfferType,
        hasCustomPlan: !!offer?.customPaymentPlan
      });
      
      // Check if offer has custom payment plan
      if (offer?.customPaymentPlan && typeof offer.customPaymentPlan === 'object' && 'payments' in offer.customPaymentPlan) {
        // Use custom payment plan from offer
        const customPayments = (offer.customPaymentPlan as any).payments;
        console.log(`Using custom payment plan with ${customPayments.length} payments:`, customPayments);
        
        // FOR TFA ROMANIA: Add €1500 down payment before custom installments
        if (registrationOfferType === 'TFA_ROMANIA' && customPayments.length > 1) {
          const downPaymentDate = new Date();
          downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration
          
          const downPaymentDeadline = await tx.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: 1500,
              dueDate: downPaymentDate,
              paymentNumber: 0,
              isPaid: false
            }
          });
          
          console.log(`Created TFA Romania down payment deadline: €1500`, downPaymentDeadline);
          
          // Recalculate custom payment amounts for TFA Romania (subtract €1500 from total)
          const remainingAmount = finalAmount - 1500;
          const amountPerInstallment = remainingAmount / customPayments.length;
          
          for (let i = 0; i < customPayments.length; i++) {
            const payment = customPayments[i];
            const dueDate = new Date(payment.dueDate);
            
            const customDeadline = await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: Math.round(amountPerInstallment * 100) / 100, // Use calculated amount for TFA Romania
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created TFA custom payment deadline ${i + 1}: €${amountPerInstallment} (recalculated)`, customDeadline);
          }
        } else {
          // For CERTIFICATIONS or TFA single payment: use original custom amounts
          for (let i = 0; i < customPayments.length; i++) {
            const payment = customPayments[i];
            const dueDate = new Date(payment.dueDate);
            
            const customDeadline = await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: Number(payment.amount),
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created custom payment deadline ${i + 1}:`, customDeadline);
          }
        }
      } else {
        // Use standard payment logic
        let downPayment = 0;
        let installmentableAmount = finalAmount;
        
        if (registrationOfferType === 'TFA_ROMANIA') {
          downPayment = 1500;
          installmentableAmount = Math.max(0, finalAmount - downPayment);
        }
        
        if (installments > 1) {
          // For TFA: down payment is NOT counted as an installment
          // Calculate: (total price - down payment) / number of installments
          const amountPerInstallment = installmentableAmount / installments;
          
          // Create down payment deadline for TFA Romania
          if (downPayment > 0) {
            const downPaymentDate = new Date();
            downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration
            
            const downPaymentDeadline = await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: downPayment,
                dueDate: downPaymentDate,
                paymentNumber: 0,
                description: 'Acconto',
                isPaid: false
              }
            });
            
            console.log(`Created down payment deadline:`, downPaymentDeadline);
          }
          
          // Calculate installment dates: first installment 30 days after down payment deadline
          const baseDate = new Date();
          if (downPayment > 0) {
            baseDate.setDate(baseDate.getDate() + 7 + 30); // 7 days + 30 days = 37 days after registration
          } else {
            baseDate.setDate(baseDate.getDate() + 7); // 7 days after registration if no down payment
          }
          
          // Create installment deadlines
          for (let i = 0; i < installments; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(dueDate.getMonth() + i); // Each installment is 1 month apart
            
            const installmentDeadline = await tx.paymentDeadline.create({
              data: {
                registrationId: registration.id,
                amount: amountPerInstallment,
                dueDate: dueDate,
                paymentNumber: i + 1,
                isPaid: false
              }
            });
            
            console.log(`Created installment deadline ${i + 1}:`, installmentDeadline);
          }
        } else {
          // Single payment
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 7); // 7 days after registration
          
          const singlePaymentDeadline = await tx.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: finalAmount,
              dueDate: dueDate,
              paymentNumber: 1,
              description: 'Pagamento unico',
              isPaid: false
            }
          });
          
          console.log(`Created single payment deadline:`, singlePaymentDeadline);
        }
      }
      
      // Finalize temporarily uploaded documents first
      if (documentsToProcess && documentsToProcess.length > 0) {
        try {
          const documentsToFinalize = Array.isArray(documentsToProcess) ? documentsToProcess : [];
          
          if (documentsToFinalize.length > 0) {
            const { DocumentService } = await import('../services/documentService');
            const finalizedDocs = await DocumentService.finalizeEnrollmentDocuments(
              registration.id, 
              user.id, 
              documentsToFinalize, 
              tx
            );
            console.log(`✅ Finalized ${finalizedDocs.length} enrollment documents for verified user registration ${registration.id}`);
          }
        } catch (docError) {
          console.error('Document finalization error (non-blocking):', docError);
          // Don't fail registration if document finalization fails
        }
      }

      // DEPRECATED: Link existing user documents to new registration (no longer needed)
      // All documents are now created with registrationId directly
      console.log(`📝 Verified user registration ${registration.id} created - documents will be uploaded directly with registrationId`);
      
      return registration;
    });
    
    // Send enrollment confirmation email
    try {
      const courseInfo = await prisma.course.findUnique({
        where: { id: courseId }
      });
      
      const partnerInfo = await prisma.partner.findUnique({
        where: { id: partnerId },
        include: {
          user: { select: { email: true } }
        }
      });
      
      await emailService.sendEnrollmentConfirmation(user.email, {
        nome: user.profile.nome,
        cognome: user.profile.cognome,
        email: user.email,
        registrationId: result.id,
        courseName: courseInfo?.name || 'Corso selezionato',
        offerType: offer?.offerType || 'TFA_ROMANIA',
        partnerName: partnerInfo?.user.email || 'Partner di riferimento'
      });
    } catch (emailError) {
      console.error('Failed to send enrollment confirmation email:', emailError);
    }
    
    res.json({
      success: true,
      registrationId: result.id,
      message: 'Iscrizione completata con successo'
    });
    
  } catch (error) {
    console.error('Verified user enrollment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Validate coupon for registration (public endpoint)
router.post('/validate-coupon', async (req, res) => {
  try {
    const { couponCode, partnerId } = req.body;

    if (!couponCode || !partnerId) {
      return res.status(400).json({ 
        isValid: false, 
        message: 'Codice coupon e partner richiesti' 
      });
    }

    // Find active coupon for this partner
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: couponCode,
        partnerId: partnerId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() }
      }
    });

    if (!coupon) {
      return res.json({ 
        isValid: false, 
        message: 'Codice coupon non valido o scaduto' 
      });
    }

    // Check usage limits
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.json({ 
        isValid: false, 
        message: 'Codice coupon esaurito' 
      });
    }

    // Return coupon info
    res.json({
      isValid: true,
      message: `Coupon valido! Sconto ${coupon.discountType === 'PERCENTAGE' 
        ? coupon.discountPercent + '%' 
        : '€' + coupon.discountAmount}`,
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
    res.status(500).json({ 
      isValid: false, 
      message: 'Errore interno del server' 
    });
  }
});

// POST /api/registration/token-enrollment - Enrollment for token-based users (no auth required)
router.post('/token-enrollment', async (req: Request, res: Response) => {
  try {
    const { 
      accessToken,
      courseId, 
      partnerOfferId, 
      paymentPlan, 
      couponCode,
      documents = [],
      tempDocuments = [], // Also accept tempDocuments
      courseData = {},
      referralCode,
      // All the other enrollment data
      ...enrollmentData
    } = req.body;
    
    // Use tempDocuments if documents is empty
    const documentsToProcess = documents.length > 0 ? documents : tempDocuments;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Token di accesso richiesto' });
    }
    
    // Verify token and get associated data
    const tokenData = await SecureTokenService.verifyToken(accessToken);
    
    if (!tokenData) {
      return res.status(401).json({ error: 'Token non valido o scaduto' });
    }
    
    const { user, registration: existingRegistration } = tokenData;
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Update the existing registration with enrollment data
    const result = await prisma.$transaction(async (tx) => {
      // Check if registration was already completed (not in PENDING state anymore)
      if (existingRegistration.status !== 'PENDING') {
        console.log(`⚠️ Duplicate token enrollment attempt detected for registration ${existingRegistration.id}, already in ${existingRegistration.status} state`);
        return existingRegistration; // Return the existing registration instead of updating again
      }
      
      // Update registration with enrollment details
      const updatedRegistration = await tx.registration.update({
        where: { id: existingRegistration.id },
        data: {
          // Course-specific data
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
          // Diploma data
          diplomaData: courseData.diplomaData ? new Date(courseData.diplomaData) : null,
          diplomaCitta: courseData.diplomaCitta || null,
          diplomaProvincia: courseData.diplomaProvincia || null,
          diplomaIstituto: courseData.diplomaIstituto || null,
          diplomaVoto: courseData.diplomaVoto || null,
          tipoLaureaTriennale: courseData.tipoLaureaTriennale || null,
          laureaConseguitaTriennale: courseData.laureaConseguitaTriennale || null,
          laureaUniversitaTriennale: courseData.laureaUniversitaTriennale || null,
          laureaDataTriennale: courseData.laureaDataTriennale ? new Date(courseData.laureaDataTriennale) : null,
          tipoProfessione: courseData.tipoProfessione || null,
          scuolaDenominazione: courseData.scuolaDenominazione || null,
          scuolaCitta: courseData.scuolaCitta || null,
          scuolaProvincia: courseData.scuolaProvincia || null,
          
          // Payment information (might be updated from frontend)
          originalAmount: paymentPlan.originalAmount || existingRegistration.originalAmount,
          finalAmount: paymentPlan.finalAmount || existingRegistration.finalAmount,
          installments: paymentPlan.installments || existingRegistration.installments,
          
          // Mark as completed
          status: 'PENDING', // Will be updated to appropriate status
          
          // Clear token since enrollment is complete
          accessToken: null,
          tokenExpiresAt: null
        }
      });
      
      // Process documents if any
      if (documentsToProcess && documentsToProcess.length > 0) {
        console.log('📄 Processing documents for token enrollment:', documentsToProcess);
        
        for (const document of documentsToProcess) {
          // Validate document structure
          if (!document.fileName || !document.url || !document.type) {
            console.warn('⚠️ Skipping invalid document:', document);
            continue;
          }
          
          try {
            // Map frontend document types to backend enum
            const documentTypeMap: Record<string, string> = {
              'cartaIdentita': 'IDENTITY_CARD',
              'certificatoTriennale': 'BACHELOR_DEGREE',
              'certificatoMagistrale': 'MASTER_DEGREE',
              'pianoStudioTriennale': 'TRANSCRIPT',
              'pianoStudioMagistrale': 'TRANSCRIPT',
              'certificatoMedico': 'MEDICAL_CERT',
              'certificatoNascita': 'BIRTH_CERT',
              'diplomoLaurea': 'BACHELOR_DEGREE',
              'pergamenaLaurea': 'MASTER_DEGREE',
              'diplomaMaturita': 'DIPLOMA'
            };
            
            const documentType = documentTypeMap[document.type] || 'OTHER';
            
            // Create UserDocument instead of Document
            await tx.userDocument.create({
              data: {
                userId: user.id,
                registrationId: updatedRegistration.id,
                type: documentType as any, // Convert to DocumentType enum
                originalName: document.fileName || document.originalFileName,
                url: document.url || document.filePath,
                size: document.fileSize || 0,
                mimeType: document.mimeType || 'application/octet-stream',
                status: 'PENDING' as any,
                uploadSource: 'ENROLLMENT' as any,
                uploadedBy: user.id,
                uploadedByRole: 'USER' as any,
                uploadedAt: new Date()
              }
            });
            console.log('✅ Created UserDocument record:', { fileName: document.fileName, type: document.type });
          } catch (docError) {
            console.error('❌ Error creating UserDocument:', docError, 'Document data:', document);
            // Continue with other documents instead of failing the entire transaction
          }
        }
      }
      
      return updatedRegistration;
    });
    
    console.log(`✅ Token-based enrollment completed for user ${user.id}, registration ${result.id}`);
    
    // Send enrollment confirmation email
    try {
      // Get user profile
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: user.id }
      });
      
      // Get course info
      const courseInfo = await prisma.course.findUnique({
        where: { id: courseId }
      });
      
      // Get offer and partner info
      const offer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId },
        include: {
          partner: {
            include: {
              user: { select: { email: true } }
            }
          }
        }
      });
      
      if (userProfile) {
        await emailService.sendEnrollmentConfirmation(user.email, {
          nome: userProfile.nome,
          cognome: userProfile.cognome,
          email: user.email,
          registrationId: result.id,
          courseName: courseInfo?.name || 'Corso selezionato',
          offerType: offer?.offerType || 'TFA_ROMANIA',
          partnerName: offer?.partner?.user?.email || 'Partner di riferimento'
        });
        console.log('✉️ Enrollment confirmation email sent to:', user.email);
      }
    } catch (emailError) {
      console.error('Failed to send enrollment confirmation email:', emailError);
      // Don't fail the registration if email fails
    }
    
    res.json({
      success: true,
      registrationId: result.id,
      message: 'Iscrizione completata con successo'
    });
    
  } catch (error) {
    console.error('Token enrollment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});


export default router;