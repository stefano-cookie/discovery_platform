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
    const uploadPath = `uploads/${folder}`;
    
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
router.post('/upload-document', enrollmentUpload.single('document'), async (req: Request, res: Response) => {
  try {
    const { userId, documentType, templateType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'File non fornito' });
    }
    
    if (!userId || !documentType) {
      return res.status(400).json({ error: 'userId e documentType sono richiesti' });
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
    const existingDoc = await prisma.userDocument.findFirst({
      where: {
        userId,
        type: dbDocumentType as any,
        registrationId: null // Only unlinked documents
      }
    });
    
    let document;
    
    if (existingDoc) {
      // Update existing document
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
    
    // Get documents not yet linked to any registration
    const documents = await prisma.userDocument.findMany({
      where: {
        userId,
        registrationId: null
      },
      orderBy: { uploadedAt: 'desc' }
    });
    
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
      courseData = {},
      referralCode  // Add referralCode to help identify partner if user doesn't have one assigned
    } = req.body;
    
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
      const baseReferralCode = referralCode.split('-')[0];
      const partner = await prisma.partner.findUnique({
        where: { referralCode: baseReferralCode }
      });
      
      if (partner) {
        partnerId = partner.id;
        
        // Assign this partner to the user permanently
        await prisma.user.update({
          where: { id: userId },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to user ${userId} from referral code ${referralCode}`);
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
      // Determine default amounts based on offer type
      const isCertification = offer?.course?.templateType === 'CERTIFICATION';
      const defaultAmount = isCertification ? 1500 : 4500;
      const offerAmount = Number(offer?.totalAmount) || defaultAmount;
      
      // Create new registration with course-specific data
      const registration = await tx.registration.create({
        data: {
          userId: userId,
          partnerId: partnerId || 'default-partner-id',
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: isCertification ? 'CERTIFICATION' : 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || offerAmount,
          finalAmount: paymentPlan.finalAmount || offerAmount,
          installments: paymentPlan.installments || offer?.installments || 1,
          status: 'PENDING',
          // Course-specific data from courseData object
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
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
              isPaid: false
            }
          });
          
          console.log(`Created single payment deadline:`, singlePaymentDeadline);
        }
      }
      
      // Finalize temporarily uploaded documents first
      if (documents && documents.length > 0) {
        try {
          const documentsToFinalize = Array.isArray(documents) ? documents : [];
          
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

      // Link existing user documents to new registration
      // Find all unlinked documents for this user and link them to the registration
      const userDocuments = await tx.userDocument.findMany({
        where: {
          userId: userId,
          registrationId: null // Only unlinked documents
        }
      });
      
      if (userDocuments.length > 0) {
        // Link all unlinked documents to this registration
        await tx.userDocument.updateMany({
          where: {
            userId: userId,
            registrationId: null
          },
          data: {
            registrationId: registration.id
          }
        });
        
        console.log(`🔗 Linked ${userDocuments.length} documents to registration ${registration.id}`);
      }
      
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
      courseData = {},
      referralCode,
      // All the other enrollment data
      ...enrollmentData
    } = req.body;
    
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
      const baseReferralCode = referralCode.split('-')[0];
      const partner = await prisma.partner.findUnique({
        where: { referralCode: baseReferralCode }
      });
      
      if (partner) {
        partnerId = partner.id;
        
        await prisma.user.update({
          where: { id: user.id },
          data: { assignedPartnerId: partnerId }
        });
        
        console.log(`Assigned partner ${partnerId} to verified user ${user.id} from referral code ${referralCode}`);
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
      // Determine default amounts based on offer type
      const isCertification = offer?.course?.templateType === 'CERTIFICATION';
      const defaultAmount = isCertification ? 1500 : 4500;
      const offerAmount = Number(offer?.totalAmount) || defaultAmount;
      
      // Create new registration
      const registration = await tx.registration.create({
        data: {
          userId: user.id,
          partnerId: partnerId || 'default-partner-id',
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: isCertification ? 'CERTIFICATION' : 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || offerAmount,
          finalAmount: paymentPlan.finalAmount || offerAmount,
          installments: paymentPlan.installments || offer?.installments || 1,
          status: 'PENDING',
          // Course-specific data
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
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
              isPaid: false
            }
          });
          
          console.log(`Created single payment deadline:`, singlePaymentDeadline);
        }
      }
      
      // Finalize temporarily uploaded documents first
      if (documents && documents.length > 0) {
        try {
          const documentsToFinalize = Array.isArray(documents) ? documents : [];
          
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

      // Link existing user documents to new registration
      // Find all unlinked documents for this user and link them to the registration
      const userDocuments = await tx.userDocument.findMany({
        where: {
          userId: user.id,
          registrationId: null // Only unlinked documents
        }
      });
      
      if (userDocuments.length > 0) {
        // Link all unlinked documents to this registration
        await tx.userDocument.updateMany({
          where: {
            userId: user.id,
            registrationId: null
          },
          data: {
            registrationId: registration.id
          }
        });
        
        console.log(`🔗 Linked ${userDocuments.length} documents to verified user registration ${registration.id}`);
      }
      
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
      courseData = {},
      referralCode,
      // All the other enrollment data
      ...enrollmentData
    } = req.body;
    
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
      // Update registration with enrollment details
      const updatedRegistration = await tx.registration.update({
        where: { id: existingRegistration.id },
        data: {
          // Course-specific data
          tipoLaurea: courseData.tipoLaurea || null,
          laureaConseguita: courseData.laureaConseguita || null,
          laureaUniversita: courseData.laureaUniversita || null,
          laureaData: courseData.laureaData ? new Date(courseData.laureaData) : null,
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
      if (documents && documents.length > 0) {
        console.log('📄 Processing documents for token enrollment:', documents);
        
        for (const document of documents) {
          // Validate document structure
          if (!document.fileName || !document.url || !document.type) {
            console.warn('⚠️ Skipping invalid document:', document);
            continue;
          }
          
          try {
            await tx.document.create({
              data: {
                registrationId: updatedRegistration.id,
                fileName: document.fileName,
                filePath: document.url,
                type: document.type,
                uploadedAt: new Date()
              }
            });
            console.log('✅ Created document record:', { fileName: document.fileName, type: document.type });
          } catch (docError) {
            console.error('❌ Error creating document:', docError, 'Document data:', document);
            // Continue with other documents instead of failing the entire transaction
          }
        }
      }
      
      return updatedRegistration;
    });
    
    console.log(`✅ Token-based enrollment completed for user ${user.id}, registration ${result.id}`);
    
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