import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import emailService from '../services/emailService';

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

// Helper function to get document type folder
function getDocumentTypeFolder(type: string): string {
  const folders: Record<string, string> = {
    // Basic documents
    'cartaIdentita': 'carte-identita',
    'tessera_sanitaria': 'certificati-medici',
    
    // TFA specific documents
    'certificatoTriennale': 'lauree',
    'certificatoMagistrale': 'lauree',
    'pianoStudioTriennale': 'piani-studio',
    'pianoStudioMagistrale': 'piani-studio',
    'certificatoMedico': 'certificati-medici',
    'certificatoNascita': 'certificati-nascita',
    'diplomoLaurea': 'diplomi',
    'pergamenaLaurea': 'pergamene',
    'diplomaMaturita': 'diplomi-maturita'
  };
  
  return folders[type] || 'altri';
}

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
      // Diploma data
      diplomaData,
      diplomaCitta,
      diplomaProvincia,
      diplomaIstituto,
      diplomaVoto,
      // Profession data
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
            // Diploma data
            diplomaData: diplomaData ? new Date(diplomaData) : null,
            diplomaCitta,
            diplomaProvincia,
            diplomaIstituto,
            diplomaVoto,
            // Profession data
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

      // First, handle direct file uploads (legacy multer approach)
      if (files && typeof files === 'object') {
        for (const [fieldname, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          
          // Document type mapping for UserDocument enum
          const documentTypeMap = {
            'cartaIdentita': 'IDENTITY_CARD',
            'tesseraperSanitaria': 'TESSERA_SANITARIA', 
            'laurea': 'BACHELOR_DEGREE',
            'pergamenaLaurea': 'MASTER_DEGREE',
            'diplomaMaturita': 'DIPLOMA',
            'certificatoMedico': 'MEDICAL_CERT'
          };
          
          const userDocumentType = documentTypeMap[fieldname as keyof typeof documentTypeMap] || 'OTHER';
          
          // Check if user already has this document type for this registration
          const existingUserDoc = await tx.userDocument.findFirst({
            where: {
              userId,
              registrationId: registration.id,
              type: userDocumentType as any
            }
          });
          
          if (existingUserDoc) {
            // Update existing document
            const document = await tx.userDocument.update({
              where: { id: existingUserDoc.id },
              data: {
                originalName: file.originalname,
                url: file.path,
                size: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date()
              }
            });
            documents.push(document);
          } else {
            // Create new user document
            const document = await tx.userDocument.create({
              data: {
                userId,
                registrationId: registration.id,
                type: userDocumentType as any,
                originalName: file.originalname,
                url: file.path,
                size: file.size,
                mimeType: file.mimetype,
                status: 'PENDING' as any,
                uploadSource: 'ENROLLMENT' as any,
                uploadedBy: userId,
                uploadedByRole: 'USER' as any
              }
            });
            documents.push(document);
          }
        }
      }
      }

      // Additionally, handle temporary documents from frontend temp upload system
      const { tempDocuments, documents: tempDocsArray } = req.body;
      const documentsToProcess = tempDocuments || tempDocsArray;
      if (documentsToProcess && Array.isArray(documentsToProcess)) {
        console.log(`Processing ${documentsToProcess.length} temporary documents for enrollment`);
        
        for (const tempDoc of documentsToProcess) {
          try {
            // Check if temp file still exists - try multiple possible paths
            let tempFilePath = '';
            
            // Try with url first (as it's sent from frontend)
            if (tempDoc.url) {
              if (path.isAbsolute(tempDoc.url)) {
                tempFilePath = tempDoc.url;
              } else {
                tempFilePath = path.join(process.cwd(), tempDoc.url);
              }
            }
            
            // If not found, try with fileName in temp-enrollment
            if (!fs.existsSync(tempFilePath) && tempDoc.fileName) {
              tempFilePath = path.join(process.cwd(), 'uploads', 'temp-enrollment', tempDoc.fileName);
            }
            
            // If not found, try with the filePath directly if it's provided
            if (!fs.existsSync(tempFilePath) && tempDoc.filePath) {
              if (path.isAbsolute(tempDoc.filePath)) {
                tempFilePath = tempDoc.filePath;
              } else {
                tempFilePath = path.join(process.cwd(), tempDoc.filePath);
              }
            }
            
            // If still not found, try looking in uploads/temp-enrollment with originalFileName
            if (!fs.existsSync(tempFilePath) && tempDoc.originalFileName) {
              tempFilePath = path.join(process.cwd(), 'uploads', 'temp-enrollment', tempDoc.originalFileName);
            }
            
            if (!fs.existsSync(tempFilePath)) {
              console.warn(`Temp file not found in any location: ${tempDoc.fileName || tempDoc.originalFileName}`);
              console.warn(`Tried paths: ${tempDoc.url}, uploads/temp-enrollment/${tempDoc.fileName}, ${tempDoc.filePath}`);
              continue;
            }

            // Map frontend document types to backend enums
            const frontendToBackendTypeMap = {
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

            const documentType = frontendToBackendTypeMap[tempDoc.type as keyof typeof frontendToBackendTypeMap] || 'OTHER';

            // Create permanent directory structure
            const docTypeFolder = getDocumentTypeFolder(tempDoc.type);
            const permanentDir = path.join(process.cwd(), 'uploads', 'documents', docTypeFolder);
            if (!fs.existsSync(permanentDir)) {
              fs.mkdirSync(permanentDir, { recursive: true });
            }

            // Generate permanent filename
            const extension = path.extname(tempDoc.originalFileName);
            const permanentFileName = `${registration.id}_${tempDoc.type}_${Date.now()}${extension}`;
            const permanentPath = path.join(permanentDir, permanentFileName);

            // Move file from temp to permanent location
            try {
              fs.renameSync(tempFilePath, permanentPath);
              console.log(`File moved from ${tempFilePath} to ${permanentPath}`);
            } catch (moveError) {
              console.error(`Error moving file from ${tempFilePath} to ${permanentPath}:`, moveError);
              // If rename fails, try copy and delete
              try {
                fs.copyFileSync(tempFilePath, permanentPath);
                fs.unlinkSync(tempFilePath);
                console.log(`File copied from ${tempFilePath} to ${permanentPath}`);
              } catch (copyError) {
                console.error(`Error copying file:`, copyError);
                throw copyError;
              }
            }

            // Check if document already exists for this type
            const existingDoc = await tx.userDocument.findFirst({
              where: {
                userId,
                registrationId: registration.id,
                type: documentType as any
              }
            });

            if (existingDoc) {
              // Update existing document
              const document = await tx.userDocument.update({
                where: { id: existingDoc.id },
                data: {
                  originalName: tempDoc.originalFileName,
                  url: path.relative(process.cwd(), permanentPath), // Store relative path
                  size: tempDoc.fileSize || 0,
                  mimeType: tempDoc.mimeType || 'application/octet-stream',
                  uploadedAt: new Date()
                }
              });
              documents.push(document);
              console.log(`Updated existing document ${existingDoc.id} for type ${documentType}`);
            } else {
              // Create new user document
              const document = await tx.userDocument.create({
                data: {
                  userId,
                  registrationId: registration.id,
                  type: documentType as any,
                  originalName: tempDoc.originalFileName,
                  url: path.relative(process.cwd(), permanentPath), // Store relative path
                  size: tempDoc.fileSize || 0,
                  mimeType: tempDoc.mimeType || 'application/octet-stream',
                  status: 'PENDING' as any,
                  uploadSource: 'ENROLLMENT' as any,
                  uploadedBy: userId,
                  uploadedByRole: 'USER' as any
                }
              });
              documents.push(document);
              console.log(`Created new document for type ${documentType} with ID ${document.id}`);
            }

            console.log(`Finalized temp document: ${tempDoc.originalFileName} -> ${permanentFileName}`);

          } catch (docError) {
            console.error(`Error processing temp document ${tempDoc.originalFileName}:`, docError);
            // Continue processing other documents
          }
        }
      }

      // Create payment deadlines based on installments
      const paymentDeadlines = [];
      
      // For TFA Romania, account for down payment
      let downPayment = 0;
      let installmentableAmount = finalAmount;
      
      if (courseInfo?.templateType === 'TFA') {
        downPayment = 1500;
        installmentableAmount = Math.max(0, finalAmount - downPayment);
      }
      
      const amountPerInstallment = installments > 1 ? installmentableAmount / installments : finalAmount;
      
      // Create down payment deadline for TFA Romania
      if (downPayment > 0 && installments > 1) {
        const downPaymentDate = new Date();
        downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 days after registration
        
        const downPaymentDeadline = await tx.paymentDeadline.create({
          data: {
            registrationId: registration.id,
            amount: downPayment,
            dueDate: downPaymentDate,
            paymentNumber: 0
          }
        });
        paymentDeadlines.push(downPaymentDeadline);
      }
      
      // Calculate installment dates: first installment 30 days after down payment deadline
      const baseDate = new Date();
      if (downPayment > 0 && installments > 1) {
        baseDate.setDate(baseDate.getDate() + 7 + 30); // 7 days + 30 days = 37 days after registration
      } else {
        baseDate.setDate(baseDate.getDate() + 7); // 7 days after registration if no down payment
      }
      
      for (let i = 0; i < installments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(dueDate.getMonth() + i); // Each installment is 1 month apart
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

    // Send enrollment confirmation email
    let courseDisplayName = courseInfo?.name || 'Corso';
    try {
      // Get partner info for the email
      const partnerData = await prisma.partner.findUnique({
        where: { id: partnerId! },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      });

      // Use course name directly (it's already the display name)
      courseDisplayName = courseInfo?.name || 'Corso';

      // Get partner display name
      const partnerName = partnerData?.user?.profile 
        ? `${partnerData.user.profile.nome} ${partnerData.user.profile.cognome}`
        : partnerData?.user?.email || 'Partner di riferimento';

      const enrollmentEmailData = {
        nome: user.profile?.nome || 'Utente',
        cognome: user.profile?.cognome || '',
        email: user.email,
        registrationId: result.registration.id,
        courseName: courseDisplayName,
        offerType: offerType || (courseInfo?.templateType === 'TFA' ? 'TFA_ROMANIA' : 'CERTIFICATION'),
        partnerName: partnerName
      };

      await emailService.sendEnrollmentConfirmation(user.email, enrollmentEmailData);
      console.log(`✉️ Enrollment confirmation email sent to: ${user.email}`);
    } catch (emailError) {
      // Log error but don't fail the enrollment
      console.error('Failed to send enrollment confirmation email:', emailError);
    }

    res.json({
      message: 'Iscrizione completata con successo',
      registrationId: result.registration.id,
      courseId: courseInfo.id,
      courseName: courseDisplayName,
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
        userDocuments: true,
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
        userDocuments: true,
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