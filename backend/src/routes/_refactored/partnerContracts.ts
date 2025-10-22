import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../../middleware/auth';
import { ContractServicePDFKit } from '../../services/contractServicePDFKit';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const prisma = new PrismaClient();
const contractService = new ContractServicePDFKit();

// Configure multer for contract uploads - Use process.cwd() for consistency
const contractStorage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const signedContractsDir = path.join(process.cwd(), 'uploads/signed-contracts');
    // Ensure directory exists
    if (!fs.existsSync(signedContractsDir)) {
      fs.mkdirSync(signedContractsDir, { recursive: true });
    }
    cb(null, signedContractsDir);
  },
  filename: (req: any, file: any, cb: any) => {
    cb(null, `signed_contract_temp_${Date.now()}.pdf`);
  }
});

const uploadContract = multer({
  storage: contractStorage,
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo file PDF sono consentiti'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Download contract template
router.get('/download-contract/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_DOWNLOAD] Starting download for registration: ${registrationId}, partner: ${partnerId}`);
    
    if (!partnerId) {
      console.log('[CONTRACT_DOWNLOAD] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_DOWNLOAD] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_DOWNLOAD] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_DOWNLOAD] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_DOWNLOAD] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers and send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
        console.log('[CONTRACT_DOWNLOAD] Sending generated PDF buffer');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_DOWNLOAD] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file - Use process.cwd() for consistency
    const contractPath = path.join(process.cwd(), registration.contractTemplateUrl.substring(1)); // Remove leading slash
    console.log(`[CONTRACT_DOWNLOAD] Attempting to serve existing contract from: ${contractPath}`);
    
    if (!fs.existsSync(contractPath)) {
      console.log(`[CONTRACT_DOWNLOAD] Error: Contract file not found at path: ${contractPath}`);
      console.log(`[CONTRACT_DOWNLOAD] Current directory: ${__dirname}`);
      console.log(`[CONTRACT_DOWNLOAD] Resolved path components: dir=${__dirname}, url=${registration.contractTemplateUrl}`);
      return res.status(404).json({ error: 'File contratto non trovato' });
    }
    
    console.log('[CONTRACT_DOWNLOAD] File exists, sending...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[CONTRACT_DOWNLOAD] Full error details:', error);
    console.error('[CONTRACT_DOWNLOAD] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ error: 'Errore durante il download del contratto' });
  }
});

// Preview contract template - inline display
router.get('/preview-contract/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_PREVIEW] Starting preview for registration: ${registrationId}, partner: ${partnerId}`);
    
    if (!partnerId) {
      console.log('[CONTRACT_PREVIEW] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      console.log(`[CONTRACT_PREVIEW] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[CONTRACT_PREVIEW] Registration found, contractTemplateUrl: ${registration.contractTemplateUrl}`);

    // Generate contract if not exists
    if (!registration.contractTemplateUrl) {
      console.log('[CONTRACT_PREVIEW] Generating new contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        console.log(`[CONTRACT_PREVIEW] Contract generated, buffer size: ${pdfBuffer.length}`);
        
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        console.log(`[CONTRACT_PREVIEW] Contract saved to: ${contractUrl}`);
        
        // Update registration with contract URL
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        // Set response headers for inline display
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        console.log('[CONTRACT_PREVIEW] Sending generated PDF buffer for preview');
        return res.send(pdfBuffer);
      } catch (generateError) {
        console.error('[CONTRACT_PREVIEW] Error generating contract:', generateError);
        throw generateError;
      }
    }

    // If contract already exists, serve the file for preview - Use process.cwd() for consistency
    const contractPath = path.join(process.cwd(), registration.contractTemplateUrl.substring(1));
    console.log(`[CONTRACT_PREVIEW] Attempting to serve existing contract from: ${contractPath}`);
    
    if (!fs.existsSync(contractPath)) {
      console.log(`[CONTRACT_PREVIEW] Error: Contract file not found at path: ${contractPath}`);
      
      // Try to regenerate the contract
      console.log('[CONTRACT_PREVIEW] Attempting to regenerate contract...');
      try {
        const pdfBuffer = await contractService.generateContract(registrationId);
        const contractUrl = await contractService.saveContract(registrationId, pdfBuffer);
        
        await prisma.registration.update({
          where: { id: registrationId },
          data: {
            contractTemplateUrl: contractUrl,
            contractGeneratedAt: new Date()
          }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        return res.send(pdfBuffer);
      } catch (regenError) {
        console.error('[CONTRACT_PREVIEW] Error regenerating contract:', regenError);
        return res.status(404).json({ error: 'File contratto non trovato e impossibile rigenerare' });
      }
    }
    
    console.log('[CONTRACT_PREVIEW] File exists, sending for preview...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[CONTRACT_PREVIEW] Full error details:', error);
    res.status(500).json({ error: 'Errore durante l\'anteprima del contratto' });
  }
});

// Upload signed contract
router.post('/upload-signed-contract', authenticatePartner, uploadContract.single('contract'), async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.body;
    const file = req.file;
    
    console.log(`[SIGNED_CONTRACT_UPLOAD] Upload attempt - Partner: ${partnerId}, Registration: ${registrationId}, File: ${file?.filename}`);
    
    if (!partnerId) {
      console.log('[SIGNED_CONTRACT_UPLOAD] Error: Partner not found');
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!registrationId) {
      console.log('[SIGNED_CONTRACT_UPLOAD] Error: Registration ID not provided');
      return res.status(400).json({ error: 'ID iscrizione richiesto' });
    }

    if (!file) {
      console.log('[SIGNED_CONTRACT_UPLOAD] Error: No file uploaded');
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    console.log(`[SIGNED_CONTRACT_UPLOAD] File details - Original: ${file.originalname}, Size: ${file.size}, Type: ${file.mimetype}`);

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        user: {
          include: { profile: true }
        }
      }
    });

    if (!registration) {
      console.log(`[SIGNED_CONTRACT_UPLOAD] Error: Registration not found for ID: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    console.log(`[SIGNED_CONTRACT_UPLOAD] Registration found - Status: ${registration.status}, User: ${registration.user.email}`);

    // Generate final filename and move file - Use process.cwd() for consistency
    const fileName = `signed_contract_${registrationId}_${Date.now()}.pdf`;
    const finalPath = path.join(process.cwd(), 'uploads/signed-contracts', fileName);
    const relativePath = `/uploads/signed-contracts/${fileName}`;

    try {
      fs.renameSync(file.path, finalPath);
      console.log(`[SIGNED_CONTRACT_UPLOAD] File moved to: ${finalPath}`);
    } catch (moveError) {
      console.error('[SIGNED_CONTRACT_UPLOAD] Error moving file:', moveError);
      return res.status(500).json({ error: 'Errore nel salvataggio del file' });
    }

    // Update registration with signed contract URL and advance status
    const updateData: any = {
      contractSignedUrl: relativePath,
      contractUploadedAt: new Date()
    };

    // Only advance status if current status allows it
    if (registration.status === 'ENROLLED' || registration.status === 'DATA_VERIFIED') {
      updateData.status = 'CONTRACT_SIGNED';
      console.log(`[SIGNED_CONTRACT_UPLOAD] Advancing status from ${registration.status} to CONTRACT_SIGNED`);
    }

    await prisma.registration.update({
      where: { id: registrationId },
      data: updateData
    });

    console.log('[SIGNED_CONTRACT_UPLOAD] Registration updated successfully');

    res.json({
      success: true,
      message: 'Contratto firmato caricato con successo',
      contractUrl: relativePath,
      newStatus: updateData.status || registration.status
    });

  } catch (error) {
    console.error('[SIGNED_CONTRACT_UPLOAD] Full error details:', error);
    
    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('[SIGNED_CONTRACT_UPLOAD] Cleaned up temporary file');
      } catch (cleanupError) {
        console.error('[SIGNED_CONTRACT_UPLOAD] Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Errore durante il caricamento del contratto firmato' });
  }
});

// Download signed contract
router.get('/download-signed-contract/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[SIGNED_CONTRACT_DOWNLOAD] Download request - Partner: ${partnerId}, Registration: ${registrationId}`);
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      console.log(`[SIGNED_CONTRACT_DOWNLOAD] Registration not found: ${registrationId}`);
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (!registration.contractSignedUrl) {
      console.log('[SIGNED_CONTRACT_DOWNLOAD] No signed contract available');
      return res.status(404).json({ error: 'Contratto firmato non disponibile' });
    }

    const contractPath = path.join(process.cwd(), registration.contractSignedUrl.substring(1));
    console.log(`[SIGNED_CONTRACT_DOWNLOAD] Contract path: ${contractPath}`);
    
    if (!fs.existsSync(contractPath)) {
      console.log('[SIGNED_CONTRACT_DOWNLOAD] Contract file not found on disk');
      return res.status(404).json({ error: 'File contratto firmato non trovato' });
    }
    
    console.log('[SIGNED_CONTRACT_DOWNLOAD] Sending signed contract file');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contratto_firmato_${registrationId}.pdf"`);
    res.sendFile(contractPath);

  } catch (error) {
    console.error('[SIGNED_CONTRACT_DOWNLOAD] Error:', error);
    res.status(500).json({ error: 'Errore durante il download del contratto firmato' });
  }
});

// Reset contract (delete signed version)
router.delete('/reset-contract/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    console.log(`[CONTRACT_RESET] Reset request - Partner: ${partnerId}, Registration: ${registrationId}`);
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to this partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Delete signed contract file if exists
    if (registration.contractSignedUrl) {
      const contractPath = path.join(process.cwd(), registration.contractSignedUrl.substring(1));
      if (fs.existsSync(contractPath)) {
        try {
          fs.unlinkSync(contractPath);
          console.log(`[CONTRACT_RESET] Deleted signed contract file: ${contractPath}`);
        } catch (deleteError) {
          console.error('[CONTRACT_RESET] Error deleting file:', deleteError);
        }
      }
    }

    // Reset contract fields in database
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        contractSignedUrl: null,
        contractUploadedAt: null,
        status: registration.status === 'CONTRACT_SIGNED' ? 'ENROLLED' : registration.status
      }
    });

    console.log('[CONTRACT_RESET] Contract reset successfully');
    res.json({ success: true, message: 'Contratto resettato con successo' });

  } catch (error) {
    console.error('[CONTRACT_RESET] Error:', error);
    res.status(500).json({ error: 'Errore durante il reset del contratto' });
  }
});

// Test endpoint to view contract data
router.get('/test-contract-data/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        user: {
          include: { profile: true }
        },
        offer: {
          include: { course: true }
        },
        deadlines: {
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Return contract data for debugging
    res.json({
      registration: {
        id: registration.id,
        status: registration.status,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments,
        createdAt: registration.createdAt,
        contractTemplateUrl: registration.contractTemplateUrl,
        contractSignedUrl: registration.contractSignedUrl,
        contractGeneratedAt: registration.contractGeneratedAt,
        contractUploadedAt: registration.contractUploadedAt
      },
      user: registration.user,
      offer: registration.offer,
      deadlines: registration.deadlines
    });

  } catch (error) {
    console.error('Test contract data error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;