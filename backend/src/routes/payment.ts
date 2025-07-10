import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Add payment for a registration
router.post('/add', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId, amount, paymentNumber, isFirstPayment } = req.body;

    if (!registrationId || !amount || !paymentNumber) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    // Verify registration exists and user has permission
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { user: true, partner: true }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Check if partner has permission to manage this registration
    if (req.user.role === 'PARTNER' && registration.partnerId !== req.partner?.id) {
      return res.status(403).json({ error: 'Non hai permesso di gestire questa registrazione' });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        registrationId,
        amount: parseFloat(amount),
        paymentDate: new Date(),
        paymentNumber: parseInt(paymentNumber),
        isFirstPayment: isFirstPayment || false,
        isConfirmed: false,
        createdBy: req.user.id
      }
    });

    res.json({
      success: true,
      payment,
      message: 'Pagamento aggiunto con successo'
    });

  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Confirm payment
router.put('/confirm/:paymentId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        registration: {
          include: { offer: true }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento non trovato' });
    }

    // Check permission
    if (req.user.role === 'PARTNER' && payment.registration.partnerId !== req.partner?.id) {
      return res.status(403).json({ error: 'Non hai permesso di confermare questo pagamento' });
    }

    // Confirm payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        isConfirmed: true,
        confirmedBy: req.user.id,
        confirmedAt: new Date()
      }
    });

    // If it's the first payment, generate deadlines and enroll user
    if (payment.isFirstPayment) {
      const { registration } = payment;
      const { offer } = registration;

      if (offer && offer.installments > 1) {
        const amountPerInstallment = Number(offer.totalAmount) / offer.installments;
        const deadlines = [];

        // Generate deadlines (skip first one as it's already paid)
        for (let i = 2; i <= offer.installments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + (offer.installmentFrequency * (i - 1)));
          
          deadlines.push({
            registrationId: registration.id,
            amount: amountPerInstallment,
            dueDate,
            paymentNumber: i,
            isPaid: false
          });
        }

        if (deadlines.length > 0) {
          await prisma.paymentDeadline.createMany({ data: deadlines });
        }
      }

      // Update registration status to enrolled
      await prisma.registration.update({
        where: { id: registration.id },
        data: {
          status: 'ENROLLED',
          enrolledAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      payment: updatedPayment,
      message: 'Pagamento confermato con successo'
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get payments for a registration
router.get('/registration/:registrationId', authenticate, requireRole(['PARTNER', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        payments: {
          orderBy: { paymentNumber: 'asc' }
        },
        deadlines: {
          orderBy: { paymentNumber: 'asc' }
        }
      }
    });

    if (!registration) {
      return res.status(404).json({ error: 'Registrazione non trovata' });
    }

    // Check permission
    if (req.user.role === 'PARTNER' && registration.partnerId !== req.partner?.id) {
      return res.status(403).json({ error: 'Non hai permesso di visualizzare questi pagamenti' });
    }

    res.json({
      payments: registration.payments,
      deadlines: registration.deadlines
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;