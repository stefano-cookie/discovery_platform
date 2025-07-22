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
            passwordChanged: false
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
            passwordChanged: false
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
        tipoLaurea,
        laureaConseguita,
        laureaConseguitaCustom: laureaConseguitaCustom || null,
        laureaUniversita,
        laureaData: new Date(laureaData),
        tipoLaureaTriennale: tipoLaureaTriennale || null,
        laureaConseguitaTriennale: laureaConseguitaTriennale || null,
        laureaUniversitaTriennale: laureaUniversitaTriennale || null,
        laureaDataTriennale: laureaDataTriennale ? new Date(laureaDataTriennale) : null,
        tipoProfessione,
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
            tipoLaurea,
            laureaConseguita,
            laureaConseguitaCustom: laureaConseguitaCustom || null,
            laureaUniversita,
            laureaData: new Date(laureaData),
            tipoLaureaTriennale: tipoLaureaTriennale || null,
            laureaConseguitaTriennale: laureaConseguitaTriennale || null,
            laureaUniversitaTriennale: laureaUniversitaTriennale || null,
            laureaDataTriennale: laureaDataTriennale ? new Date(laureaDataTriennale) : null,
            tipoProfessione,
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

      // Get partner offer
      const offer = await tx.partnerOffer.findFirst({
        where: {
          partnerId: partner?.id,
          courseId: course.id,
          isActive: true
        }
      });

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

    // Send confirmation email
    try {
      await emailService.sendRegistrationConfirmation(email, {
        nome: result.profile.nome,
        cognome: result.profile.cognome,
        email: email,
        registrationId: result.registration.id
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
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