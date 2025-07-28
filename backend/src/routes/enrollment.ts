import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    let subDir = 'altri';
    if (file.fieldname === 'cartaIdentita') subDir = 'carte-identita';
    else if (file.fieldname === 'tesseraperSanitaria') subDir = 'tessere-sanitarie';
    else if (file.fieldname === 'laurea') subDir = 'lauree';
    else if (file.fieldname === 'pergamenaLaurea') subDir = 'pergamene';
    else if (file.fieldname === 'diplomaMaturita') subDir = 'diplomi';
    else if (file.fieldname === 'certificatoMedico') subDir = 'certificati-medici';
    
    const targetDir = path.join(uploadDir, subDir);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req: AuthRequest, file, cb) => {
    const timestamp = Date.now();
    const userId = req.user?.id || 'unknown';
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}_${file.fieldname}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo immagini (JPEG, PNG) e PDF sono permessi'));
    }
  }
});

// Middleware per gestire sia utenti autenticati che verificati via email
const handleAuthOrVerifiedEmail = async (req: any, res: any, next: any) => {
  const { verifiedEmail } = req.body;
  
  if (verifiedEmail) {
    // Utente verificato via email
    const user = await prisma.user.findUnique({
      where: { email: verifiedEmail },
      include: { profile: true }
    });
    
    if (!user || !user.emailVerified) {
      return res.status(403).json({ error: 'Utente non verificato' });
    }
    
    req.user = { id: user.id };
    next();
  } else {
    // Utente normale autenticato
    authenticate(req, res, next);
  }
};

// Submit course enrollment
router.post('/submit', handleAuthOrVerifiedEmail, upload.fields([
  { name: 'cartaIdentita', maxCount: 1 },
  { name: 'tesseraperSanitaria', maxCount: 1 },
  { name: 'laurea', maxCount: 1 },
  { name: 'pergamenaLaurea', maxCount: 1 },
  { name: 'diplomaMaturita', maxCount: 1 },
  { name: 'certificatoMedico', maxCount: 1 }
]), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      partnerOfferId,
      offerType,
      courseId,
      paymentPlan,
      // Course-specific data
      tipoLaurea,
      laureaConseguita,
      laureaUniversita,
      laureaData,
      tipoProfessione,
      scuolaDenominazione,
      scuolaCitta,
      scuolaProvincia
    } = req.body;

    // Verify user exists and has a profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        partner: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (!user.profile) {
      return res.status(400).json({ error: 'Profilo utente non trovato. Completa prima la registrazione.' });
    }

    // Get partner and course information
    let partnerId = user.assignedPartnerId;
    let courseInfo = null;
    let finalAmount = 0;
    let installments = 1;

    if (partnerOfferId) {
      // Get offer details
      const offer = await prisma.partnerOffer.findUnique({
        where: { id: partnerOfferId },
        include: { 
          partner: true,
          course: true
        }
      });

      if (!offer || !offer.isActive) {
        return res.status(404).json({ error: 'Offerta non trovata o non attiva' });
      }

      partnerId = offer.partnerId;
      courseInfo = offer.course;
      finalAmount = Number(offer.totalAmount);
      installments = offer.installments;
    } else {
      // Use default course and partner
      if (!partnerId) {
        return res.status(400).json({ error: 'Partner non assegnato' });
      }

      // Find default course or use courseId if provided
      if (courseId) {
        courseInfo = await prisma.course.findUnique({
          where: { id: courseId }
        });
      }

      if (!courseInfo) {
        return res.status(400).json({ error: 'Corso non specificato' });
      }

      // Use default pricing (should be configurable)
      finalAmount = offerType === 'CERTIFICATION' ? 500 : 3000;
      installments = 1;
    }

    // Create registration in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the registration
      const registration = await tx.registration.create({
        data: {
          userId,
          partnerId: partnerId!,
          courseId: courseInfo!.id,
          partnerOfferId: partnerOfferId || null,
          originalAmount: finalAmount,
          finalAmount,
          installments,
          status: 'PENDING',
          
          // Course-specific data
          ...(offerType === 'TFA_ROMANIA' && {
            tipoLaurea,
            laureaConseguita,
            laureaUniversita,
            laureaData: laureaData ? new Date(laureaData) : null,
            tipoProfessione,
            scuolaDenominazione,
            scuolaCitta,
            scuolaProvincia
          })
        }
      });

      // Handle file uploads and create document records
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const documents = [];

      for (const [fieldname, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const document = await tx.document.create({
            data: {
              registrationId: registration.id,
              type: fieldname,
              fileName: file.originalname,
              filePath: file.path
            }
          });
          documents.push(document);
        }
      }

      // Create payment deadlines based on installments
      const paymentDeadlines = [];
      const amountPerInstallment = finalAmount / installments;
      
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i + 1);
        dueDate.setDate(30); // Always 30th of the month
        
        const deadline = await tx.paymentDeadline.create({
          data: {
            registrationId: registration.id,
            amount: amountPerInstallment,
            dueDate,
            paymentNumber: i + 1
          }
        });
        paymentDeadlines.push(deadline);
      }

      return {
        registration,
        documents,
        paymentDeadlines
      };
    });

    res.json({
      message: 'Iscrizione completata con successo',
      registrationId: result.registration.id,
      courseId: courseInfo.id,
      courseName: courseInfo.name,
      finalAmount,
      installments,
      documents: result.documents.length,
      paymentDeadlines: result.paymentDeadlines.length
    });

  } catch (error) {
    console.error('Error submitting enrollment:', error);
    res.status(500).json({ 
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get user's registrations
router.get('/my-registrations', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const registrations = await prisma.registration.findMany({
      where: { userId },
      include: {
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        documents: true,
        payments: {
          where: { isConfirmed: true },
          orderBy: { paymentDate: 'desc' }
        },
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(registrations);

  } catch (error) {
    console.error('Error fetching user registrations:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get specific registration details
router.get('/:registrationId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const userId = req.user!.id;

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        userId // Ensure user can only access their own registrations
      },
      include: {
        partner: {
          select: {
            referralCode: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        offer: {
          include: {
            course: true
          }
        },
        documents: true,
        payments: {
          orderBy: { paymentDate: 'desc' }
        },
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    res.json(registration);

  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;