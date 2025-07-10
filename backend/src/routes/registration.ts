import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';

const router = Router();
const prisma = new PrismaClient();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folders: Record<string, string> = {
      cartaIdentita: 'carte-identita',
      certificatoLaureaTriennale: 'lauree',
      certificatoLaureaMagistrale: 'lauree',
      certificatoMedico: 'certificati-medici',
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

// Submit registration
router.post('/submit', upload.fields([
  { name: 'cartaIdentita', maxCount: 1 },
  { name: 'certificatoLaureaTriennale', maxCount: 1 },
  { name: 'certificatoLaureaMagistrale', maxCount: 1 },
  { name: 'certificatoMedico', maxCount: 1 }
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
      tipoLaurea, laureaConseguita, laureaUniversita, laureaData,
      // Professione
      tipoProfessione, scuolaDenominazione, scuolaCitta, scuolaProvincia,
      // Iscrizione
      referralCode, courseId, couponCode
    } = req.body;

    // Find partner by referral code
    let partner = null;
    if (referralCode) {
      partner = await prisma.partner.findUnique({
        where: { referralCode }
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: 'temp_password', // To be changed on first login
        role: 'USER',
        isActive: true,
        passwordChanged: false
      }
    });

    // Create user profile
    await prisma.userProfile.create({
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
        laureaUniversita,
        laureaData: new Date(laureaData),
        tipoProfessione,
        scuolaDenominazione: scuolaDenominazione || null,
        scuolaCitta: scuolaCitta || null,
        scuolaProvincia: scuolaProvincia || null
      }
    });

    // Get default course
    const course = await prisma.course.findFirst({
      where: { isActive: true }
    });

    if (!course) {
      return res.status(400).json({ error: 'Nessun corso disponibile' });
    }

    // Get partner offer
    const offer = await prisma.partnerOffer.findFirst({
      where: {
        partnerId: partner?.id,
        courseId: course.id,
        isActive: true
      }
    });

    // Create registration
    const registration = await prisma.registration.create({
      data: {
        userId: user.id,
        partnerId: partner?.id || 'default',
        courseId: course.id,
        partnerOfferId: offer?.id,
        originalAmount: Number(offer?.totalAmount) || 5000,
        finalAmount: Number(offer?.totalAmount) || 5000,
        installments: offer?.installments || 1,
        status: 'PENDING'
      }
    });

    // Handle file uploads
    const files = req.files as Record<string, Express.Multer.File[]>;
    if (files) {
      for (const [fieldName, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          await prisma.document.create({
            data: {
              registrationId: registration.id,
              type: fieldName,
              fileName: file.originalname,
              filePath: file.path
            }
          });
        }
      }
    }

    res.json({
      success: true,
      registrationId: registration.id,
      message: 'Registrazione completata con successo'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;