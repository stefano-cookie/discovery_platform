import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import emailService from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

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
        profile: true
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
        hasTemporaryPassword: user.hasTemporaryPassword,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      },
      profile: user.profile
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
        offer: {
          include: {
            course: true,
            partner: {
              include: {
                user: true
              }
            }
          }
        },
        payments: true,
        deadlines: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedRegistrations = registrations.map(reg => ({
      id: reg.id,
      courseId: reg.courseId,
      courseName: reg.offer?.course?.name || 'Corso Non Specificato',
      status: reg.status,
      createdAt: reg.createdAt,
      finalAmount: reg.finalAmount,
      installments: reg.installments,
      offerType: reg.offerType,
      partnerName: reg.offer?.partner?.user ? 'Partner Assegnato' : null,
      paymentsCount: reg.payments.length,
      totalPaid: reg.payments
        .filter(p => p.isConfirmed)
        .reduce((sum, p) => sum + Number(p.amount), 0)
    }));
    
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
    
    // Get user's existing registrations to avoid duplicates
    const existingRegistrations = await prisma.registration.findMany({
      where: { userId },
      select: { partnerOfferId: true }
    });
    
    const enrolledOfferIds = existingRegistrations
      .map(reg => reg.partnerOfferId)
      .filter((id): id is string => id !== null);
    
    // Get user's associated partner to show their available offers
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        associatedPartner: {
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
    
    let availableCourses: Array<{
      id: string;
      name: string;
      description: string;
      partnerOfferId?: string;
      referralLink?: string;
      offerType: string;
    }> = [];
    
    // If user has an associated partner, show their offers (considering visibility settings)
    const partner = user?.associatedPartner;
    if (partner?.offers) {
      // Get offer visibility settings for this user
      const visibilitySettings = await prisma.offerVisibility.findMany({
        where: {
          userId,
          partnerOfferId: {
            in: partner.offers.map(offer => offer.id)
          }
        }
      });
      
      const visibilityMap = new Map(
        visibilitySettings.map(v => [v.partnerOfferId, v.isVisible])
      );
      
      availableCourses = partner.offers
        .filter(offer => {
          // Exclude already enrolled offers
          if (enrolledOfferIds.includes(offer.id)) return false;
          
          // Check visibility settings - default to visible if no setting exists
          const isVisible = visibilityMap.get(offer.id) ?? true;
          return isVisible;
        })
        .map(offer => ({
          id: offer.course.id,
          name: offer.course.name,
          description: offer.course.description || '',
          partnerOfferId: offer.id,
          referralLink: offer.referralLink,
          offerType: offer.offerType.toString()
        }));
    }
    
    res.json({ courses: availableCourses });
  } catch (error) {
    console.error('Error getting available courses:', error);
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
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La nuova password deve essere di almeno 8 caratteri' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // For temporary passwords, skip current password check
    if (!user.hasTemporaryPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Password attuale richiesta' });
      }
      
      const bcrypt = require('bcrypt');
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Password attuale non corretta' });
      }
    }
    
    // Hash new password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        hasTemporaryPassword: false,
        passwordChanged: true
      }
    });

    // Send password change confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(user.email, {
        nome: user.email.split('@')[0], // Fallback if no profile
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
router.get('/documents/types', authenticate, async (req: AuthRequest, res: Response) => {
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