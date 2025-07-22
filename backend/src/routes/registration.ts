import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folders: Record<string, string> = {
      cartaIdentita: 'carte-identita',
      certificatoTriennale: 'lauree',
      certificatoMagistrale: 'lauree',
      pianoStudioTriennale: 'piani-studio',
      pianoStudioMagistrale: 'piani-studio',
      certificatoMedico: 'certificati-medici',
      certificatoNascita: 'certificati-nascita',
      diplomoLaurea: 'diplomi-laurea',
      pergamenaLaurea: 'pergamene-laurea',
    };
    
    const folder = folders[file.fieldname] || 'altri';
    cb(null, `uploads/${folder}`);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
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
          hasTemporaryPassword: existingUser.hasTemporaryPassword
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

// Submit registration
router.post('/submit', upload.fields([
  { name: 'cartaIdentita', maxCount: 1 },
  { name: 'certificatoTriennale', maxCount: 1 },
  { name: 'certificatoMagistrale', maxCount: 1 },
  { name: 'pianoStudioTriennale', maxCount: 1 },
  { name: 'pianoStudioMagistrale', maxCount: 1 },
  { name: 'certificatoMedico', maxCount: 1 },
  { name: 'certificatoNascita', maxCount: 1 },
  { name: 'diplomoLaurea', maxCount: 1 },
  { name: 'pergamenaLaurea', maxCount: 1 }
]), async (req, res) => {
  try {
    
    const {
      // Dati generali
      email, cognome, nome, dataNascita, luogoNascita, codiceFiscale, telefono,
      nomePadre, nomeMadre,
      // Residenza
      residenzaVia, residenzaCitta, residenzaProvincia, residenzaCap,
      hasDifferentDomicilio, domicilioVia, domicilioCitta, domicilioProvincia, domicilioCap,
      // Istruzione
      tipoLaurea, laureaConseguita, laureaConseguitaCustom, laureaUniversita, laureaData,
      // Laurea Triennale 
      tipoLaureaTriennale, laureaConseguitaTriennale, laureaUniversitaTriennale, laureaDataTriennale,
      // Professione
      tipoProfessione, scuolaDenominazione, scuolaCitta, scuolaProvincia,
      // Iscrizione
      referralCode, courseId, couponCode, paymentPlan, customInstallments,
      // Partner offer (opzionale)
      partnerOfferId
    } = req.body;

    // Validate required fields
    if (!email || !cognome || !nome || !dataNascita || !luogoNascita || !codiceFiscale || !telefono) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: true
      }
    });


    if (existingUser) {
      // Check if it's a truly complete registration
      const hasCompleteProfile = !!existingUser.profile;
      const hasActiveRegistration = existingUser.registrations.length > 0;
      // Only consider user truly registered if they have BOTH profile AND registrations
      // Email verification alone is not enough
      const isTrulyRegistered = hasCompleteProfile && hasActiveRegistration;
      
      if (isTrulyRegistered) {
        return res.status(400).json({ 
          error: 'Un utente con questa email è già registrato',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }

    // Find partner by referral code
    let partner = null;
    if (referralCode) {
      const baseReferralCode = referralCode.split('-')[0];
      partner = await prisma.partner.findUnique({
        where: { referralCode: baseReferralCode }
      });
    }

    // Use transaction to ensure all-or-nothing registration
    const result = await prisma.$transaction(async (tx) => {
      // Create or update user
      let user;
      if (existingUser) {
        // Update the existing incomplete user
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            password: 'temp_password', // To be changed on first login
            isActive: true,
            passwordChanged: false,
            // Associate to partner if not already associated
            associatedPartnerId: existingUser.associatedPartnerId || partner?.id || null
            // Non tocchiamo emailVerified, emailVerificationToken - la verifica è un processo separato
          }
        });
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            email,
            password: 'temp_password', // To be changed on first login
            role: 'USER',
            isActive: true,
            passwordChanged: false,
            associatedPartnerId: partner?.id || null  // Associate user to partner permanently
          }
        });
      }

      // Create or update user profile
      let profile;
      if (existingUser?.profile) {
        // Update existing profile
        profile = await tx.userProfile.update({
          where: { userId: user.id },
          data: {
        cognome,
        nome,
        dataNascita: new Date(dataNascita),
        luogoNascita,
        codiceFiscale,
        telefono,
        nomePadre: nomePadre || null,
        nomeMadre: nomeMadre || null,
        residenzaVia,
        residenzaCitta,
        residenzaProvincia,
        residenzaCap,
        hasDifferentDomicilio: hasDifferentDomicilio === 'true',
        domicilioVia: domicilioVia || null,
        domicilioCitta: domicilioCitta || null,
        domicilioProvincia: domicilioProvincia || null,
        domicilioCap: domicilioCap || null,
        tipoLaurea: tipoLaurea || null,
        laureaConseguita: laureaConseguita || null,
        laureaConseguitaCustom: laureaConseguitaCustom || null,
        laureaUniversita: laureaUniversita || null,
        laureaData: laureaData ? new Date(laureaData) : null,
        tipoLaureaTriennale: tipoLaureaTriennale || null,
        laureaConseguitaTriennale: laureaConseguitaTriennale || null,
        laureaUniversitaTriennale: laureaUniversitaTriennale || null,
        laureaDataTriennale: laureaDataTriennale ? new Date(laureaDataTriennale) : null,
        tipoProfessione: tipoProfessione || null,
        scuolaDenominazione: scuolaDenominazione || null,
        scuolaCitta: scuolaCitta || null,
        scuolaProvincia: scuolaProvincia || null
          }
        });
      } else {
        // Create new profile
        profile = await tx.userProfile.create({
          data: {
            userId: user.id,
            cognome,
            nome,
            dataNascita: new Date(dataNascita),
            luogoNascita,
            codiceFiscale,
            telefono,
            nomePadre: nomePadre || null,
            nomeMadre: nomeMadre || null,
            residenzaVia,
            residenzaCitta,
            residenzaProvincia,
            residenzaCap,
            hasDifferentDomicilio: hasDifferentDomicilio === 'true',
            domicilioVia: domicilioVia || null,
            domicilioCitta: domicilioCitta || null,
            domicilioProvincia: domicilioProvincia || null,
            domicilioCap: domicilioCap || null,
            tipoLaurea: tipoLaurea || null,
            laureaConseguita: laureaConseguita || null,
            laureaConseguitaCustom: laureaConseguitaCustom || null,
            laureaUniversita: laureaUniversita || null,
            laureaData: laureaData ? new Date(laureaData) : null,
            tipoLaureaTriennale: tipoLaureaTriennale || null,
            laureaConseguitaTriennale: laureaConseguitaTriennale || null,
            laureaUniversitaTriennale: laureaUniversitaTriennale || null,
            laureaDataTriennale: laureaDataTriennale ? new Date(laureaDataTriennale) : null,
            tipoProfessione: tipoProfessione || null,
            scuolaDenominazione: scuolaDenominazione || null,
            scuolaCitta: scuolaCitta || null,
            scuolaProvincia: scuolaProvincia || null
          }
        });
      }

      // Get default course
      const course = await tx.course.findFirst({
        where: { isActive: true }
      });

      if (!course) {
        throw new Error('Nessun corso disponibile');
      }

      // Get partner offer - use specific partnerOfferId if provided, otherwise find by partner and course
      let offer = null;
      if (partnerOfferId) {
        offer = await tx.partnerOffer.findFirst({
          where: {
            id: partnerOfferId,
            isActive: true
          }
        });
      } else if (partner) {
        offer = await tx.partnerOffer.findFirst({
          where: {
            partnerId: partner.id,
            courseId: course.id,
            isActive: true
          }
        });
      }

      let originalAmount = Number(offer?.totalAmount) || 5000;
      let finalAmount = originalAmount;
      let couponData = null;

      // Validate and apply coupon if provided
      if (couponCode) {
        // Find coupon for this partner
        const coupon = await tx.coupon.findFirst({
        where: {
          code: couponCode,
          partnerId: partner?.id,
          isActive: true,
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() }
        }
        });

        if (!coupon) {
          throw new Error('Codice sconto non valido o scaduto');
        }

        // Check if max uses reached
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new Error('Codice sconto esaurito');
        }

        // Check if coupon was already used in a registration (only one use per coupon)
        const existingUse = await tx.couponUse.findFirst({
          where: { couponId: coupon.id }
        });

        if (existingUse) {
          throw new Error('Codice sconto già utilizzato');
        }

        // Apply discount
        let discountAmount = 0;
        if (coupon.discountType === 'PERCENTAGE') {
          discountAmount = (originalAmount * Number(coupon.discountPercent)) / 100;
        } else {
          discountAmount = Number(coupon.discountAmount);
        }

        finalAmount = Math.max(0, originalAmount - discountAmount);
        couponData = { coupon, discountAmount };
      }

      // Create registration
      const registration = await tx.registration.create({
      data: {
        userId: user.id,
        partnerId: partner?.id || null,
        courseId: course.id,
        partnerOfferId: offer?.id || null,
        offerType: offer?.offerType || 'TFA_ROMANIA',
        originalAmount: originalAmount,
        finalAmount: finalAmount,
        installments: offer?.installments || 1,
        status: 'PENDING'
      }
      });

      // Create coupon use record if coupon was applied
      if (couponData) {
        await tx.couponUse.create({
          data: {
            couponId: couponData.coupon.id,
            registrationId: registration.id,
            discountApplied: couponData.discountAmount
          }
        });

        // Update coupon used count
        await tx.coupon.update({
          where: { id: couponData.coupon.id },
          data: { usedCount: { increment: 1 } }
        });
      }

      // Handle file uploads (still needs to be outside transaction due to file system operations)
      const files = req.files as Record<string, Express.Multer.File[]>;
      const fileDocuments = [];
      
      if (files) {
        for (const [fieldName, fileArray] of Object.entries(files)) {
          if (fileArray && fileArray.length > 0) {
            const file = fileArray[0];
            const doc = await tx.document.create({
              data: {
                registrationId: registration.id,
                type: fieldName,
                fileName: file.originalname,
                filePath: file.path
              }
            });
            fileDocuments.push(doc);
          }
        }
      }

      return { user, profile, registration, fileDocuments };
    });

    // Generate temporary password and send credentials email
    try {
      const temporaryPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
      
      // Update user with temporary password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
      
      await prisma.user.update({
        where: { id: result.user.id },
        data: { 
          password: hashedPassword,
          hasTemporaryPassword: true
        }
      });
      
      await emailService.sendTemporaryCredentials(email, {
        temporaryPassword: temporaryPassword,
        loginUrl: loginUrl
      }, {
        nome: result.profile.nome,
        cognome: result.profile.cognome,
        email: email
      });
    } catch (emailError) {
      console.error('Failed to send temporary credentials email:', emailError);
    }

    res.json({
      success: true,
      registrationId: result.registration.id,
      message: 'Registrazione completata con successo'
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Provide more specific error information in development
    if (process.env.NODE_ENV === 'development') {
      res.status(500).json({ 
        error: 'Errore interno del server',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } else {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
});

// POST /api/registration/additional-enrollment - Additional enrollment for existing users
router.post('/additional-enrollment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      courseId, 
      partnerOfferId, 
      paymentPlan, 
      couponCode,
      documents = []
    } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Check if user has profile and get associated partner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        associatedPartner: true  // Get the permanently associated partner
      }
    });
    
    if (!user || !user.profile) {
      return res.status(400).json({ error: 'Profilo utente non trovato' });
    }
    
    // Use user's associated partner, not the one from request
    const partnerId = user.associatedPartnerId;
    
    // Get offer information - must be from user's associated partner
    let offer = null;
    
    if (partnerOfferId) {
      if (!partnerId) {
        return res.status(400).json({ error: 'Utente non associato a nessun partner' });
      }
      
      offer = await prisma.partnerOffer.findUnique({
        where: { 
          id: partnerOfferId,
          partnerId: partnerId  // Ensure offer belongs to user's partner
        },
        include: { partner: true, course: true }
      });
      
      if (!offer) {
        return res.status(400).json({ error: 'Offerta non trovata o non autorizzata per il tuo partner' });
      }
    }
    
    const result = await prisma.$transaction(async (tx) => {
      // Create new registration
      const registration = await tx.registration.create({
        data: {
          userId: userId,
          partnerId: partnerId,
          courseId: courseId,
          partnerOfferId: partnerOfferId,
          offerType: offer?.offerType || 'TFA_ROMANIA',
          originalAmount: paymentPlan.originalAmount || 0,
          finalAmount: paymentPlan.finalAmount || 0,
          installments: paymentPlan.installments || 1,
          status: 'PENDING'
        }
      });
      
      // Handle coupon if provided
      if (couponCode && partnerId) {
        // Coupon validation logic here
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

export default router;