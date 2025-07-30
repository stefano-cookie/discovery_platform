import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

// Get user profile by verified email (no auth required)
router.post('/profile-by-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è richiesta' });
    }

    // Trova l'utente con email verificata
    const user = await prisma.user.findUnique({
      where: { 
        email,
        emailVerified: true // Solo utenti con email verificata
      },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: true
          }
        }
      }
    });

    if (!user || !user.profile) {
      return res.status(404).json({ error: 'Profilo utente non trovato o email non verificata' });
    }

    // Restituisci i dati del profilo (senza password)
    const profileData = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        user: {
          email: user.assignedPartner.user.email
        }
      } : null
    };

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching profile by email:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Multer configuration for user document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folders: Record<string, string> = {
      CARTA_IDENTITA: 'carte-identita',
      TESSERA_SANITARIA: 'certificati-medici',
      DIPLOMA_LAUREA: 'diplomi-laurea',
      PERGAMENA_LAUREA: 'pergamene-laurea',
      CERTIFICATO_MEDICO: 'certificati-medici',
      CONTRATTO: 'contratti',
      ALTRO: 'altri'
    };
    
    const docType = req.body.type as string;
    const folder = folders[docType] || 'altri';
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

// GET /api/user/profile-by-email/:email - Get user profile by email (for verified users)
router.get('/profile-by-email/:email', async (req, res: Response) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è obbligatoria' });
    }

    const decodedEmail = decodeURIComponent(email);
    
    const user = await prisma.user.findUnique({
      where: { email: decodedEmail },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Verifica che l'utente sia verificato
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Account non ancora verificato' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        email: user.assignedPartner.user.email
      } : null
    });
  } catch (error) {
    console.error('Get user profile by email error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/profile - Get user profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        assignedPartner: {
          include: {
            user: {
              select: {
                email: true
              }
            }
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      },
      profile: user.profile,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode,
        email: user.assignedPartner.user.email
      } : null
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/registrations - Get user registrations
router.get('/registrations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const registrations = await prisma.registration.findMany({
      where: { userId },
      include: {
        partner: {
          include: {
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
        payments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        deadlines: {
          orderBy: [
            { paymentNumber: 'asc' },
            { dueDate: 'asc' }
          ]
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedRegistrations = registrations.map(reg => {
      // Calculate total paid amount
      const totalPaid = reg.payments.reduce((sum, payment) => 
        payment.isConfirmed ? sum + Number(payment.amount) : sum, 0
      );
      
      return {
        id: reg.id,
        courseId: reg.offer?.course?.id || 'unknown',
        courseName: reg.offer?.name || reg.offer?.course?.name || 'Corso non specificato',
        status: reg.status,
        originalAmount: Number(reg.originalAmount),
        finalAmount: Number(reg.finalAmount),
        installments: reg.installments,
        offerType: reg.offerType,
        createdAt: reg.createdAt.toISOString(),
        totalPaid,
        partner: {
          referralCode: reg.partner?.referralCode || '',
          user: {
            email: reg.partner?.user?.email || 'Partner non specificato'
          }
        },
        payments: reg.payments.map(payment => ({
          id: payment.id,
          amount: Number(payment.amount),
          paymentDate: payment.createdAt.toISOString(),
          isConfirmed: payment.isConfirmed,
          paymentNumber: payment.paymentNumber || 1
        })),
        deadlines: reg.deadlines.map(deadline => ({
          id: deadline.id,
          amount: Number(deadline.amount),
          dueDate: deadline.dueDate.toISOString(),
          paymentNumber: deadline.paymentNumber,
          isPaid: deadline.isPaid
        }))
      };
    });
    
    res.json({ registrations: formattedRegistrations });
  } catch (error) {
    console.error('Error getting user registrations:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/documents - Get user documents
router.get('/documents', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const documents = await prisma.userDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' }
    });
    
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      isVerified: doc.isVerified
    }));
    
    res.json({ documents: formattedDocuments });
  } catch (error) {
    console.error('Error getting user documents:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/available-courses - Get available courses for user
router.get('/available-courses', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Get user's assigned partner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        assignedPartner: {
          include: {
            offers: {
              include: {
                course: true
              },
              where: { isActive: true }
            }
          }
        }
      }
    });
    
    const partner = user?.assignedPartner;
    if (!partner) {
      return res.json({ 
        courses: [],
        message: 'Nessun partner assegnato. Contatta il supporto per ottenere accesso ai corsi.'
      });
    }

    if (!partner.offers || partner.offers.length === 0) {
      return res.json({ 
        courses: [],
        message: 'Il tuo partner non ha corsi attivi al momento. Contattalo per maggiori informazioni.'
      });
    }

    // Get user's registrations (original offers they signed up for)
    const userRegistrations = await prisma.registration.findMany({
      where: { 
        userId,
        partnerId: partner.id 
      },
      include: {
        offer: {
          include: {
            course: true
          }
        }
      }
    });

    // Get user's additional offer access
    const userOfferAccess = await prisma.userOfferAccess.findMany({
      where: {
        userId,
        partnerId: partner.id,
        enabled: true
      }
    });

    // Create sets for quick lookup
    const originalOfferIds = new Set(
      userRegistrations.map(reg => reg.partnerOfferId).filter(Boolean)
    );
    
    const additionalOfferIds = new Set(
      userOfferAccess.map(access => access.offerId)
    );

    // All accessible offer IDs (original + additional)
    const accessibleOfferIds = new Set([
      ...originalOfferIds,
      ...additionalOfferIds
    ]);

    // Filter and format offers that user has access to
    const availableCourses = partner.offers
      .filter(offer => accessibleOfferIds.has(offer.id))
      .map(offer => {
        const isOriginal = originalOfferIds.has(offer.id);
        const userRegistration = userRegistrations.find(reg => reg.partnerOfferId === offer.id);
        
        return {
          id: offer.course.id,
          name: offer.name,
          description: offer.course.description || '',
          partnerOfferId: offer.id,
          offerType: offer.offerType.toString(),
          totalAmount: Number(offer.totalAmount),
          finalAmount: userRegistration ? Number(userRegistration.finalAmount) : Number(offer.totalAmount),
          installments: offer.installments,
          isOriginal,
          isEnrolled: !!userRegistration,
          enrollmentStatus: userRegistration?.status || null,
          referralLink: isOriginal && !userRegistration 
            ? `${process.env.FRONTEND_URL}/registration/${offer.referralLink}`
            : userRegistration 
              ? null // Already enrolled
              : `${process.env.FRONTEND_URL}/registration/${offer.referralLink}` // Can enroll in additional offer
        };
      });
    
    res.json({ courses: availableCourses });
  } catch (error) {
    console.error('Error getting available courses:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/user/profile - Update user profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      cognome,
      nome,
      telefono,
      nomePadre,
      nomeMadre,
      residenzaVia,
      residenzaCitta,
      residenzaProvincia,
      residenzaCap,
      hasDifferentDomicilio,
      domicilioVia,
      domicilioCitta,
      domicilioProvincia,
      domicilioCap
    } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    
    if (!user || !user.profile) {
      return res.status(404).json({ error: 'Profilo utente non trovato' });
    }
    
    // Aggiorna il profilo (campi non modificabili: dataNascita, luogoNascita, codiceFiscale, provinciaNascita, sesso)
    const updatedProfile = await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        cognome: cognome || user.profile.cognome,
        nome: nome || user.profile.nome,
        telefono: telefono || user.profile.telefono,
        nomePadre: nomePadre !== undefined ? nomePadre : user.profile.nomePadre,
        nomeMadre: nomeMadre !== undefined ? nomeMadre : user.profile.nomeMadre,
        residenzaVia: residenzaVia || user.profile.residenzaVia,
        residenzaCitta: residenzaCitta || user.profile.residenzaCitta,
        residenzaProvincia: residenzaProvincia || user.profile.residenzaProvincia,
        residenzaCap: residenzaCap || user.profile.residenzaCap,
        hasDifferentDomicilio: hasDifferentDomicilio !== undefined ? hasDifferentDomicilio : user.profile.hasDifferentDomicilio,
        domicilioVia: hasDifferentDomicilio ? domicilioVia : null,
        domicilioCitta: hasDifferentDomicilio ? domicilioCitta : null,
        domicilioProvincia: hasDifferentDomicilio ? domicilioProvincia : null,
        domicilioCap: hasDifferentDomicilio ? domicilioCap : null
      }
    });
    
    res.json({
      success: true,
      profile: updatedProfile,
      message: 'Profilo aggiornato con successo'
    });
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/user/change-password - Change user password
router.put('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    // Validate new password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola e un numero' 
      });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Always require current password
    if (!currentPassword) {
      return res.status(400).json({ error: 'Password attuale richiesta' });
    }
    
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Password attuale non corretta' });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword
      }
    });

    // Send password change confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(user.email, {
        nome: user.profile?.nome || user.email.split('@')[0],
        timestamp: new Date().toLocaleString('it-IT')
      });
    } catch (emailError) {
      console.error('Failed to send password change confirmation email:', emailError);
      // Don't fail the request if email fails
    }
    
    res.json({ success: true, message: 'Password cambiata con successo' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/user/documents - Upload document to user repository
router.post('/documents', authenticate, upload.single('document'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type } = req.body;
    const file = req.file;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    if (!file) {
      return res.status(400).json({ error: 'File non fornito' });
    }
    
    if (!type) {
      return res.status(400).json({ error: 'Tipo documento non specificato' });
    }
    
    // Check if document type already exists for user
    const existingDoc = await prisma.userDocument.findFirst({
      where: {
        userId,
        type: type as any
      }
    });
    
    if (existingDoc) {
      // Update existing document
      const updatedDoc = await prisma.userDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: file.originalname,
          filePath: file.path,
          isVerified: false,
          uploadedAt: new Date()
        }
      });
      
      return res.json({
        success: true,
        document: {
          id: updatedDoc.id,
          type: updatedDoc.type,
          fileName: updatedDoc.fileName,
          uploadedAt: updatedDoc.uploadedAt,
          isVerified: updatedDoc.isVerified
        },
        message: 'Documento aggiornato con successo'
      });
    } else {
      // Create new document
      const newDoc = await prisma.userDocument.create({
        data: {
          userId,
          type: type as any,
          fileName: file.originalname,
          filePath: file.path,
          isVerified: false
        }
      });
      
      return res.json({
        success: true,
        document: {
          id: newDoc.id,
          type: newDoc.type,
          fileName: newDoc.fileName,
          uploadedAt: newDoc.uploadedAt,
          isVerified: newDoc.isVerified
        },
        message: 'Documento caricato con successo'
      });
    }
    
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// DELETE /api/user/documents/:id - Delete user document
router.delete('/documents/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utente non autenticato' });
    }
    
    const document = await prisma.userDocument.findFirst({
      where: {
        id,
        userId
      }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Documento non trovato' });
    }
    
    // Delete file from filesystem
    const fs = require('fs');
    try {
      fs.unlinkSync(document.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
    
    // Delete document from database
    await prisma.userDocument.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Documento eliminato con successo' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/user/documents/types - Get available document types
router.get('/documents/types', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const documentTypes = [
      { value: 'CARTA_IDENTITA', label: 'Carta d\'Identità', required: true },
      { value: 'TESSERA_SANITARIA', label: 'Tessera Sanitaria', required: false },
      { value: 'DIPLOMA_LAUREA', label: 'Diploma di Laurea', required: false },
      { value: 'PERGAMENA_LAUREA', label: 'Pergamena di Laurea', required: false },
      { value: 'CERTIFICATO_MEDICO', label: 'Certificato Medico', required: false },
      { value: 'ALTRO', label: 'Altro', required: false }
    ];
    
    res.json({ documentTypes });
  } catch (error) {
    console.error('Error getting document types:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;