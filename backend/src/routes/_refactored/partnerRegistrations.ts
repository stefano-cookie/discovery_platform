import { Router, Response as ExpressResponse } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticatePartner, AuthRequest } from '../middleware/auth';
import { DocumentService, upload as documentUpload } from '../services/documentService';
import emailService from '../services/emailService';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

// Get specific registration details
router.get('/registrations/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
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

    res.json(registration);
  } catch (error) {
    console.error('Get registration error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Delete registration
router.delete('/registrations/:registrationId', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Delete related records first
    await prisma.paymentDeadline.deleteMany({
      where: { registrationId }
    });

    await prisma.userDocument.deleteMany({
      where: { registrationId }
    });

    await prisma.registration.delete({
      where: { id: registrationId }
    });

    res.json({ success: true, message: 'Iscrizione eliminata con successo' });
  } catch (error) {
    console.error('Delete registration error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get payment deadlines for a registration
router.get('/registrations/:registrationId/deadlines', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    const deadlines = await prisma.paymentDeadline.findMany({
      where: { registrationId },
      orderBy: { dueDate: 'asc' }
    });

    res.json(deadlines);
  } catch (error) {
    console.error('Get payment deadlines error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark payment as paid
router.post('/registrations/:registrationId/payments/:deadlineId/mark-paid', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId, deadlineId } = req.params;
    const { amount, method, notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: { user: { include: { profile: true } } }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update deadline
    const deadline = await prisma.paymentDeadline.update({
      where: { id: deadlineId },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paidAmount: amount ? Number(amount) : undefined,
        paymentMethod: method || 'MANUAL',
        notes: notes || 'Pagamento confermato dal partner'
      }
    });

    // Send confirmation email
    if (registration.user.email) {
      await emailService.sendEmail({
        to: registration.user.email,
        subject: 'Pagamento Confermato',
        html: `
          <p>Ciao ${registration.user.profile?.nome || 'Utente'},</p>
          <p>Il tuo pagamento di <strong>€ ${deadline.amount}</strong> è stato confermato.</p>
          <p>Grazie per la tua puntualità!</p>
        `
      });
    }

    res.json({ 
      success: true, 
      message: 'Pagamento confermato',
      deadline 
    });
  } catch (error) {
    console.error('Mark payment as paid error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Mark payment as partially paid
router.post('/registrations/:registrationId/payments/:deadlineId/mark-partial-paid', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId, deadlineId } = req.params;
    const { amount, method, notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Importo pagamento richiesto' });
    }

    // Verify registration belongs to partner
    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    const deadline = await prisma.paymentDeadline.findUnique({
      where: { id: deadlineId }
    });

    if (!deadline) {
      return res.status(404).json({ error: 'Scadenza non trovata' });
    }

    const paidAmount = Number(amount);
    const remainingAmount = deadline.amount - paidAmount;

    if (paidAmount >= deadline.amount) {
      // Full payment
      await prisma.paymentDeadline.update({
        where: { id: deadlineId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paidAmount: deadline.amount,
          paymentMethod: method || 'MANUAL',
          notes: notes || 'Pagamento completo confermato dal partner'
        }
      });
    } else {
      // Partial payment - update existing deadline and create new one for remainder
      await prisma.paymentDeadline.update({
        where: { id: deadlineId },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paidAmount: paidAmount,
          amount: paidAmount,
          paymentMethod: method || 'MANUAL',
          notes: `${notes || 'Pagamento parziale'} - Pagato: €${paidAmount}`
        }
      });

      // Create new deadline for remaining amount
      const nextMonth = new Date(deadline.dueDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await prisma.paymentDeadline.create({
        data: {
          registrationId,
          amount: remainingAmount,
          dueDate: nextMonth,
          description: `Residuo rata precedente - €${remainingAmount.toFixed(2)}`,
          isPaid: false
        }
      });
    }

    res.json({ 
      success: true, 
      message: 'Pagamento parziale registrato',
      paidAmount,
      remainingAmount: paidAmount >= deadline.amount ? 0 : remainingAmount
    });
  } catch (error) {
    console.error('Mark partial payment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get offer visibility settings
router.get('/offer-visibility/:offerId', authenticatePartner, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partnerId = req.partner?.id;
    const { offerId } = req.params;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify offer belongs to partner
    const offer = await prisma.partnerOffer.findFirst({
      where: { 
        id: offerId,
        partnerId 
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    // Get current visibility settings
    const visibilitySettings = await prisma.userOfferAccess.findMany({
      where: { 
        offerId,
        partnerId 
      },
      include: {
        user: {
          include: { profile: true }
        }
      }
    });

    res.json({
      offer,
      visibilitySettings: visibilitySettings.map(setting => ({
        userId: setting.userId,
        enabled: setting.enabled,
        user: {
          email: setting.user.email,
          name: setting.user.profile ? `${setting.user.profile.nome} ${setting.user.profile.cognome}` : 'Nome non disponibile'
        }
      }))
    });
  } catch (error) {
    console.error('Get offer visibility error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Update offer visibility for users
router.put('/offer-visibility/:offerId', authenticatePartner, async (req: AuthRequest, res: ExpressResponse) => {
  try {
    const partnerId = req.partner?.id;
    const { offerId } = req.params;
    const { userVisibility } = req.body; // Array of { userId, enabled }
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    // Verify offer belongs to partner
    const offer = await prisma.partnerOffer.findFirst({
      where: { 
        id: offerId,
        partnerId 
      }
    });

    if (!offer) {
      return res.status(404).json({ error: 'Offerta non trovata' });
    }

    // Update visibility settings
    for (const setting of userVisibility) {
      await prisma.userOfferAccess.upsert({
        where: {
          userId_offerId: {
            userId: setting.userId,
            offerId
          }
        },
        create: {
          userId: setting.userId,
          offerId,
          partnerId,
          enabled: setting.enabled
        },
        update: {
          enabled: setting.enabled
        }
      });
    }

    res.json({ success: true, message: 'Visibilità offerta aggiornata' });
  } catch (error) {
    console.error('Update offer visibility error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Set exam date
router.post('/registrations/:registrationId/exam-date', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    const { examDate, location, notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        user: { include: { profile: true } }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with exam info
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        examDate: new Date(examDate),
        examLocation: location,
        examNotes: notes,
        status: 'EXAM_SCHEDULED'
      }
    });

    // Send notification email
    if (registration.user.email) {
      await emailService.sendEmail({
        to: registration.user.email,
        subject: 'Data Esame Programmata',
        html: `
          <p>Ciao ${registration.user.profile?.nome || 'Utente'},</p>
          <p>La tua data d'esame è stata programmata:</p>
          <ul>
            <li><strong>Data:</strong> ${new Date(examDate).toLocaleDateString('it-IT')}</li>
            <li><strong>Luogo:</strong> ${location || 'Da definire'}</li>
            ${notes ? `<li><strong>Note:</strong> ${notes}</li>` : ''}
          </ul>
          <p>Ti invieremo ulteriori dettagli prossimamente.</p>
        `
      });
    }

    res.json({ success: true, message: 'Data esame programmata' });
  } catch (error) {
    console.error('Set exam date error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Complete exam
router.post('/registrations/:registrationId/complete-exam', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;
    const { grade, passed, notes } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { 
        id: registrationId,
        partnerId 
      },
      include: {
        user: { include: { profile: true } }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    // Update registration with exam results
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        examGrade: grade ? Number(grade) : null,
        examPassed: passed,
        examCompleted: true,
        examCompletedAt: new Date(),
        examNotes: notes,
        status: passed ? 'EXAM_PASSED' : 'EXAM_FAILED'
      }
    });

    // Send results email
    if (registration.user.email) {
      await emailService.sendEmail({
        to: registration.user.email,
        subject: passed ? 'Esame Superato!' : 'Risultato Esame',
        html: `
          <p>Ciao ${registration.user.profile?.nome || 'Utente'},</p>
          <p>I risultati del tuo esame sono disponibili:</p>
          <ul>
            <li><strong>Risultato:</strong> ${passed ? 'SUPERATO' : 'NON SUPERATO'}</li>
            ${grade ? `<li><strong>Voto:</strong> ${grade}</li>` : ''}
            ${notes ? `<li><strong>Note:</strong> ${notes}</li>` : ''}
          </ul>
          ${passed ? '<p>Congratulazioni per aver superato l\'esame!</p>' : '<p>Contatta il tuo partner per informazioni sui prossimi passi.</p>'}
        `
      });
    }

    res.json({ success: true, message: 'Risultato esame registrato' });
  } catch (error) {
    console.error('Complete exam error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Certification workflow - Step 3: Mark documents as approved
router.post('/registrations/:registrationId/certification-docs-approved', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { 
        offer: true,
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    // Update status to documents approved
    await prisma.registration.update({
      where: { id: registrationId },
      data: { status: 'DOCUMENTS_APPROVED' }
    });

    // Send email notification to user
    if (registration.user?.email) {
      const userName = registration.user.profile?.nome || 'Utente';
      const courseName = registration.offer?.name || 'Corso di Certificazione';
      
      await emailService.sendEmail({
        to: registration.user.email,
        subject: 'Documenti Approvati - Prossimo Step',
        html: `
          <p>Ciao ${userName},</p>
          <p>I tuoi documenti per il corso <strong>${courseName}</strong> sono stati approvati!</p>
          <p>Ora puoi procedere con la registrazione all'esame.</p>
          <p>Il tuo partner ti contatterà per i dettagli.</p>
        `
      });
    }

    res.json({ 
      success: true, 
      message: 'Documenti approvati, utente può procedere con registrazione esame',
      newStatus: 'DOCUMENTS_APPROVED'
    });
  } catch (error) {
    console.error('Certification docs approved error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Certification workflow - Step 4: Mark exam as registered
router.post('/registrations/:registrationId/certification-exam-registered', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;
    const { examDate, examLocation } = req.body;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { offer: true, user: { include: { profile: true } } }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    // Update status and exam info
    await prisma.registration.update({
      where: { id: registrationId },
      data: { 
        status: 'EXAM_REGISTERED',
        examDate: examDate ? new Date(examDate) : null,
        examLocation: examLocation || null
      }
    });

    // Send confirmation email
    if (registration.user?.email) {
      await emailService.sendEmail({
        to: registration.user.email,
        subject: 'Registrazione Esame Confermata',
        html: `
          <p>Ciao ${registration.user.profile?.nome || 'Utente'},</p>
          <p>La tua registrazione all'esame è stata confermata!</p>
          ${examDate ? `<p><strong>Data Esame:</strong> ${new Date(examDate).toLocaleDateString('it-IT')}</p>` : ''}
          ${examLocation ? `<p><strong>Luogo:</strong> ${examLocation}</p>` : ''}
          <p>Ti invieremo ulteriori dettagli prossimamente.</p>
        `
      });
    }

    res.json({ 
      success: true, 
      message: 'Registrazione esame confermata',
      newStatus: 'EXAM_REGISTERED'
    });
  } catch (error) {
    console.error('Certification exam registered error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Certification workflow - Step 5: Mark exam as completed
router.post('/registrations/:registrationId/certification-exam-completed', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;
    const partnerId = req.partner?.id;
    const { examResult, finalGrade } = req.body;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { offer: true, user: { include: { profile: true } } }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibile solo per corsi di certificazione' });
    }

    const examPassed = examResult === 'PASSED';

    // Update registration with final status
    await prisma.registration.update({
      where: { id: registrationId },
      data: { 
        status: examPassed ? 'COMPLETED' : 'EXAM_FAILED',
        examPassed,
        examGrade: finalGrade ? Number(finalGrade) : null,
        examCompleted: true,
        examCompletedAt: new Date()
      }
    });

    // Send final result email
    if (registration.user?.email) {
      await emailService.sendEmail({
        to: registration.user.email,
        subject: examPassed ? 'Certificazione Completata!' : 'Risultato Esame',
        html: `
          <p>Ciao ${registration.user.profile?.nome || 'Utente'},</p>
          <p>Il tuo percorso di certificazione è terminato:</p>
          <p><strong>Risultato:</strong> ${examPassed ? 'SUPERATO ✅' : 'NON SUPERATO ❌'}</p>
          ${finalGrade ? `<p><strong>Voto Finale:</strong> ${finalGrade}</p>` : ''}
          ${examPassed ? 
            '<p>Congratulazioni! La tua certificazione è stata completata con successo.</p>' : 
            '<p>Contatta il tuo partner per informazioni su eventuali recuperi.</p>'
          }
        `
      });
    }

    res.json({ 
      success: true, 
      message: `Esame ${examPassed ? 'completato' : 'non superato'}`,
      newStatus: examPassed ? 'COMPLETED' : 'EXAM_FAILED'
    });
  } catch (error) {
    console.error('Certification exam completed error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get certification workflow steps
router.get('/registrations/:registrationId/certification-steps', authenticatePartner, async (req: AuthRequest, res) => {
  try {
    const partnerId = req.partner?.id;
    const { registrationId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ error: 'Partner non trovato' });
    }

    const registration = await prisma.registration.findFirst({
      where: { id: registrationId, partnerId },
      include: { offer: true }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Iscrizione non trovata' });
    }

    if (registration.offer?.offerType !== 'CERTIFICATION') {
      return res.status(400).json({ error: 'Step disponibili solo per corsi di certificazione' });
    }

    const steps = [
      {
        step: 1,
        name: 'Iscrizione',
        status: 'COMPLETED',
        completedAt: registration.createdAt,
        description: 'Utente iscritto al corso'
      },
      {
        step: 2,
        name: 'Caricamento Documenti',
        status: registration.status === 'ENROLLED' ? 'CURRENT' : 'COMPLETED',
        completedAt: registration.status !== 'ENROLLED' ? registration.updatedAt : null,
        description: 'Caricamento carta identità e tessera sanitaria'
      },
      {
        step: 3,
        name: 'Approvazione Documenti',
        status: registration.status === 'DOCUMENTS_APPROVED' ? 'CURRENT' : 
                registration.status === 'ENROLLED' ? 'PENDING' : 'COMPLETED',
        completedAt: registration.status === 'DOCUMENTS_APPROVED' ? registration.updatedAt : null,
        description: 'Partner approva i documenti caricati'
      },
      {
        step: 4,
        name: 'Registrazione Esame',
        status: registration.status === 'EXAM_REGISTERED' ? 'CURRENT' :
                ['ENROLLED', 'DOCUMENTS_APPROVED'].includes(registration.status) ? 'PENDING' : 'COMPLETED',
        completedAt: registration.status === 'EXAM_REGISTERED' ? registration.updatedAt : null,
        description: 'Registrazione all\'esame di certificazione'
      },
      {
        step: 5,
        name: 'Completamento Esame',
        status: registration.status === 'COMPLETED' ? 'COMPLETED' :
                registration.status === 'EXAM_FAILED' ? 'FAILED' : 'PENDING',
        completedAt: registration.examCompletedAt,
        description: 'Sostenimento e completamento esame finale'
      }
    ];

    res.json({
      registration: {
        id: registration.id,
        status: registration.status,
        examDate: registration.examDate,
        examLocation: registration.examLocation,
        examPassed: registration.examPassed,
        examGrade: registration.examGrade
      },
      steps,
      currentStep: steps.find(s => s.status === 'CURRENT')?.step || 
                   (registration.status === 'COMPLETED' ? 5 : 1)
    });
  } catch (error) {
    console.error('Get certification steps error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;