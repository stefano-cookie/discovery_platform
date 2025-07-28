import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// NOTE: File upload configuration moved to the document upload endpoint
// since enrollment now handles documents separately

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
        type: offer.offerType,
        steps: offer.offerType === 'TFA_ROMANIA' 
          ? ['generale', 'residenza', 'istruzione', 'professione', 'documenti', 'opzioni', 'riepilogo']
          : ['generale', 'residenza', 'documenti', 'opzioni', 'riepilogo'],
        requiredFields: offer.offerType === 'TFA_ROMANIA'
          ? {
              generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono', 'nomePadre', 'nomeMadre'],
              documenti: ['cartaIdentita', 'diplomoLaurea', 'pergamenaLaurea', 'certificatoMedico', 'certificatoNascita']
            }
          : {
              generale: ['email', 'cognome', 'nome', 'dataNascita', 'luogoNascita', 'codiceFiscale', 'telefono'],
              documenti: ['cartaIdentita', 'tesseriaSanitaria']
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
      // Create new registration with course-specific data
      const registration = await tx.registration.create({
        data: {
          userId: userId,
          partnerId: partnerId || 'default-partner-id',
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: offer?.offerType || 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || 0,
          finalAmount: paymentPlan.finalAmount || 0,
          installments: paymentPlan.installments || 1,
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
      const finalAmount = Number(paymentPlan.finalAmount) || 0;
      const registrationOfferType = offer?.offerType || 'TFA_ROMANIA';
      
      console.log(`Creating payment deadlines for authenticated user registration ${registration.id}:`, {
        installments,
        finalAmount,
        offerType: registrationOfferType
      });
      
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
          downPaymentDate.setDate(downPaymentDate.getDate() + 1);
          
          await tx.paymentDeadline.create({
            data: {
              registrationId: registration.id,
              amount: downPayment,
              dueDate: downPaymentDate,
              paymentNumber: 0,
              isPaid: false
            }
          });
        }
        
        for (let i = 0; i < installments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i + 1);
          
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
        dueDate.setDate(dueDate.getDate() + 1);
        
        await tx.paymentDeadline.create({
          data: {
            registrationId: registration.id,
            amount: finalAmount,
            dueDate: dueDate,
            paymentNumber: 1,
            isPaid: false
          }
        });
      }
      
      // Link existing user documents to new registration if needed
      if (documents && documents.length > 0) {
        for (const docId of documents) {
          await tx.documentUsage.create({
            data: {
              registrationId: registration.id,
              documentId: docId
            }
          });
        }
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
      // Create new registration
      const registration = await tx.registration.create({
        data: {
          userId: user.id,
          partnerId: partnerId || 'default-partner-id',
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: offer?.offerType || 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || 0,
          finalAmount: paymentPlan.finalAmount || 0,
          installments: paymentPlan.installments || 1,
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
      
      // Create payment deadlines (same logic as authenticated enrollment)
      const installments = paymentPlan.installments || 1;
      const finalAmount = Number(paymentPlan.finalAmount) || 0;
      const registrationOfferType = offer?.offerType || 'TFA_ROMANIA';
      
      console.log(`Creating payment deadlines for registration ${registration.id}:`, {
        installments,
        finalAmount,
        offerType: registrationOfferType
      });
      
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
          downPaymentDate.setDate(downPaymentDate.getDate() + 1);
          
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
        
        // Create installment deadlines
        for (let i = 0; i < installments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i + 1);
          
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
        dueDate.setDate(dueDate.getDate() + 1);
        
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

// POST /api/registration/verified-user-enrollment - Enrollment for email-verified users
router.post('/verified-user-enrollment', async (req: Request, res: Response) => {
  try {
    const { verifiedEmail, ...enrollmentData } = req.body;
    
    if (!verifiedEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email verificata richiesta' 
      });
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
      return res.status(404).json({ 
        success: false, 
        message: 'Utente non trovato o email non verificata' 
      });
    }
    
    // Use the same logic as additional-enrollment but without authentication requirement
    const {
      courseId,
      partnerOfferId,
      referralCode,
      paymentPlan,
      couponCode,
      originalAmount,
      finalAmount,
      installments,
      downPayment,
      installmentAmount,
      // Course-specific data
      tipoLaurea,
      laureaConseguita,
      laureaConseguitaCustom,
      laureaUniversita,
      laureaData,
      tipoProfessione,
      scuolaDenominazione,
      scuolaCitta,
      scuolaProvincia
    } = enrollmentData;
    
    if (!courseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Corso richiesto' 
      });
    }
    
    // Find the course
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });
    
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Corso non trovato' 
      });
    }
    
    // Determine partner (from assignedPartner, partnerOffer, or referralCode)
    let partnerId = user.assignedPartnerId;
    
    if (partnerOfferId) {
      const partnerOffer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId }
      });
      if (partnerOffer) {
        partnerId = partnerOffer.partnerId;
      }
    }
    
    if (!partnerId && referralCode) {
      const partner = await prisma.partner.findUnique({
        where: { referralCode }
      });
      if (partner) {
        partnerId = partner.id;
      }
    }
    
    if (!partnerId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Partner non identificato' 
      });
    }
    
    // Determine offer type
    let offerType = 'TFA_ROMANIA';
    if (partnerOfferId) {
      const offer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId }
      });
      if (offer) {
        offerType = offer.offerType;
      }
    }
    
    // Apply coupon discount if provided
    let appliedFinalAmount = finalAmount || originalAmount || 5000;
    if (couponCode && partnerId) {
      try {
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
        
        if (coupon) {
          const baseAmount = originalAmount || 5000;
          if (coupon.discountType === 'PERCENTAGE') {
            const discountPercent = Number(coupon.discountPercent || 0);
            appliedFinalAmount = baseAmount * (1 - discountPercent / 100);
          } else if (coupon.discountType === 'FIXED') {
            const discountAmount = Number(coupon.discountAmount || 0);
            appliedFinalAmount = Math.max(0, baseAmount - discountAmount);
          }
          console.log(`Applied coupon ${couponCode}: ${baseAmount} -> ${appliedFinalAmount}`);
        }
      } catch (couponError) {
        console.error('Error applying coupon:', couponError);
        // Continue with original amount if coupon application fails
      }
    }
    
    // Create the registration
    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        partnerId: partnerId,
        courseId: courseId,
        partnerOfferId: partnerOfferId || null,
        offerType: offerType as any,
        
        // Course-specific data (only for TFA Romania)
        tipoLaurea: offerType === 'TFA_ROMANIA' ? tipoLaurea : null,
        laureaConseguita: offerType === 'TFA_ROMANIA' ? laureaConseguita : null,
        laureaUniversita: offerType === 'TFA_ROMANIA' ? laureaUniversita : null,
        laureaData: offerType === 'TFA_ROMANIA' && laureaData ? new Date(laureaData) : null,
        
        // Profession data (only for TFA Romania)
        tipoProfessione: offerType === 'TFA_ROMANIA' ? tipoProfessione : null,
        scuolaDenominazione: offerType === 'TFA_ROMANIA' ? scuolaDenominazione : null,
        scuolaCitta: offerType === 'TFA_ROMANIA' ? scuolaCitta : null,
        scuolaProvincia: offerType === 'TFA_ROMANIA' ? scuolaProvincia : null,
        
        // Payment info (with coupon discount applied)
        originalAmount: originalAmount || 5000, // Default fallback
        finalAmount: appliedFinalAmount,
        installments: installments || 1,
        
        status: 'PENDING'
      }
    });
    
    // Send confirmation email
    try {
      await emailService.sendEnrollmentConfirmation(user.email, {
        userName: user.profile?.nome || 'Utente',
        courseName: course.name,
        registrationId: registration.id,
        totalAmount: appliedFinalAmount,
        installments: installments || 1
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the registration if email fails
    }
    
    return res.json({
      success: true,
      message: 'Iscrizione completata con successo',
      registrationId: registration.id
    });
    
  } catch (error) {
    console.error('Verified user enrollment error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Errore interno del server' 
    });
  }
});

export default router;