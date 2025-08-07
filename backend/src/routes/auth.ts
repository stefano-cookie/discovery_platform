import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';
import SecureTokenService from '../services/secureTokenService';

const router = Router();
const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        partner: true,
        profile: true,
        assignedPartner: true
      }
    });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    // Verifica che l'account sia attivato
    if (!user.emailVerified) {
      return res.status(401).json({ 
        error: 'Account non attivato. Controlla la tua email per il link di attivazione.',
        needsEmailVerification: true
      });
    }
    
    // Aggiorna ultimo login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        hasProfile: !!user.profile,
        referralCode: user.partner?.referralCode || null,
        assignedPartner: user.assignedPartner ? {
          id: user.assignedPartner.id,
          referralCode: user.assignedPartner.referralCode
        } : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password corrente e nuova password sono obbligatorie' });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Password corrente errata' });
    }
    
    // Valida la nuova password
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ 
        error: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola e un numero' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        partner: true,
        profile: true,
        assignedPartner: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      hasProfile: !!user.profile,
      referralCode: user.partner?.referralCode || null,
      assignedPartner: user.assignedPartner ? {
        id: user.assignedPartner.id,
        referralCode: user.assignedPartner.referralCode
      } : null
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Send email verification
router.post('/send-email-verification', async (req, res) => {
  try {
    const { email, referralCode } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è obbligatoria' });
    }
    
    // Check if email already exists and is truly registered (has profile and registrations)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: true
      }
    });
    
    // Consider user as "truly registered" only if they have complete data
    const hasCompleteProfile = !!existingUser?.profile;
    const hasActiveRegistration = existingUser?.registrations && existingUser.registrations.length > 0;
    const isTrulyRegistered = existingUser && (hasCompleteProfile || hasActiveRegistration);
    
    if (isTrulyRegistered) {
      return res.status(400).json({ error: 'Email già registrata con un account completo' });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create or update user with verification token - but mark as incomplete
    await prisma.user.upsert({
      where: { email },
      update: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: tokenExpiry
      },
      create: {
        email,
        password: 'INCOMPLETE_TEMP', // Temporary password - will be set during registration
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: tokenExpiry,
        role: 'USER',
        isActive: false // Mark as inactive until registration is complete
      }
    });
    
    // Create verification link with referral code if provided
    let verificationLink = `${process.env.FRONTEND_URL}/email-verification?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    if (referralCode) {
      verificationLink += `&referralCode=${encodeURIComponent(referralCode)}`;
    }
    
    // Send email with verification link
    await emailService.sendEmailVerification(email, verificationLink);
    
    res.json({ 
      success: true,
      message: 'Email di verifica inviata'
    });
    
  } catch (error) {
    console.error('Send email verification error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Verify email (activate account)
router.post('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return res.status(400).json({ error: 'Token e email sono obbligatori' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Allow re-verification if email is already verified (for UX)
    if (user.emailVerified) {
      return res.json({ 
        success: true,
        message: 'Account già attivato in precedenza',
        alreadyVerified: true
      });
    }
    
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      return res.status(400).json({ 
        error: 'Token di verifica non valido' 
      });
    }
    
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      return res.status(400).json({ 
        error: 'Token di verifica scaduto. Contatta il supporto per assistenza.' 
      });
    }
    
    // Update user as verified and activated
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
        isActive: true
      }
    });
    
    res.json({ 
      success: true,
      message: 'Account attivato con successo! Ora puoi effettuare il login.'
    });
    
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Generate secure access token for enrollment form
router.post('/generate-access-token', async (req, res) => {
  try {
    const { email, referralCode } = req.body;
    
    if (!email || !referralCode) {
      return res.status(400).json({ error: 'Email e referral code sono obbligatori' });
    }
    
    // Verifica che l'utente esista e abbia email verificata
    const user = await prisma.user.findUnique({
      where: { 
        email,
        emailVerified: true,
        isActive: true
      },
      include: {
        assignedPartner: true,
        profile: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato o email non verificata' });
    }
    
    if (!user.profile) {
      return res.status(404).json({ error: 'Profilo utente non completo' });
    }
    
    // Verifica che il referral code sia valido
    const offer = await prisma.partnerOffer.findUnique({
      where: { referralLink: referralCode },
      include: { partner: true, course: true }
    });
    
    if (!offer || !offer.isActive) {
      return res.status(404).json({ error: 'Offerta non trovata o non attiva' });
    }
    
    // Genera token sicuro
    const token = await SecureTokenService.createAccessToken(user.id, referralCode);
    
    res.json({
      success: true,
      accessToken: token,
      message: 'Token di accesso generato con successo'
    });
    
  } catch (error) {
    console.error('Generate access token error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Register new user (complete registration)
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password,
      referralCode,
      // Dati profilo
      cognome,
      nome, 
      dataNascita,
      luogoNascita,
      provinciaNascita,
      sesso,
      codiceFiscale,
      telefono,
      nomePadre,
      nomeMadre,
      // Residenza
      residenzaVia,
      residenzaCitta,
      residenzaProvincia,
      residenzaCap,
      // Domicilio opzionale
      hasDifferentDomicilio,
      domicilioVia,
      domicilioCitta,
      domicilioProvincia,
      domicilioCap
    } = req.body;
    
    // Debug: log dei dati ricevuti
    console.log('Registration data received:', {
      email,
      hasPassword: !!password,
      cognome,
      nome,
      dataNascita,
      luogoNascita,
      provinciaNascita,
      sesso,
      codiceFiscale,
      telefono,
      // Residenza
      residenzaVia,
      residenzaCitta,
      residenzaProvincia,
      residenzaCap,
      // Optional fields
      nomePadre,
      nomeMadre,
      referralCode,
      hasDifferentDomicilio
    });
    
    // Validazione campi obbligatori
    if (!email || !password || !cognome || !nome || !dataNascita || !luogoNascita || 
        !provinciaNascita || !sesso || !codiceFiscale || !telefono || 
        !residenzaVia || !residenzaCitta || !residenzaProvincia || !residenzaCap) {
      
      const missingFields = [];
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      if (!cognome) missingFields.push('cognome');
      if (!nome) missingFields.push('nome');
      if (!dataNascita) missingFields.push('dataNascita');
      if (!luogoNascita) missingFields.push('luogoNascita');
      if (!provinciaNascita) missingFields.push('provinciaNascita');
      if (!sesso) missingFields.push('sesso');
      if (!codiceFiscale) missingFields.push('codiceFiscale');
      if (!telefono) missingFields.push('telefono');
      if (!residenzaVia) missingFields.push('residenzaVia');
      if (!residenzaCitta) missingFields.push('residenzaCitta');
      if (!residenzaProvincia) missingFields.push('residenzaProvincia');
      if (!residenzaCap) missingFields.push('residenzaCap');
      
      return res.status(400).json({ 
        error: 'Tutti i campi obbligatori devono essere compilati',
        missingFields 
      });
    }
    
    console.log('✅ Campi obbligatori validati');
    
    // Verifica password sicura (min 8 caratteri, almeno 1 maiuscola, 1 minuscola, 1 numero)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      console.log('❌ Password validation failed');
      return res.status(400).json({ 
        error: 'La password deve essere di almeno 8 caratteri e contenere almeno una maiuscola, una minuscola e un numero' 
      });
    }
    
    console.log('✅ Password validata');
    
    // Trova il partner dal referral code se fornito
    let assignedPartnerId = null;
    if (referralCode) {
      console.log(`🔍 Cercando partner con referral code: ${referralCode}`);
      
      // Il referral code può avere un suffisso (es: MAIN001-CERT)
      // Estrai la parte base del referral code
      const baseReferralCode = referralCode.split('-')[0];
      console.log(`🔍 Referral code base estratto: ${baseReferralCode}`);
      
      const partner = await prisma.partner.findUnique({
        where: { referralCode: baseReferralCode }
      });
      
      if (partner) {
        assignedPartnerId = partner.id;
        console.log(`✅ Partner trovato: ${partner.id} per referral code base: ${baseReferralCode}`);
      } else {
        console.log(`❌ Partner non trovato per referral code base: ${baseReferralCode}`);
        // Potrebbe essere utile logare tutti i partner disponibili per debug
        const allPartners = await prisma.partner.findMany({ select: { id: true, referralCode: true } });
        console.log(`🔍 Partner disponibili nel database:`, allPartners);
      }
    }
    
    // Verifica se email già registrata - CONTROLLO SEMPLICE
    console.log(`🔍 Verificando se email esiste: ${email}`);
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    // Se l'email esiste già, blocca sempre la registrazione
    if (existingUser) {
      console.log(`❌ Email già registrata`);
      return res.status(400).json({ 
        error: 'Utente già registrato',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    console.log(`✅ Email verificata - nuova registrazione consentita`);
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Genera token di verifica email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore
    
    await prisma.$transaction(async (tx) => {
      // Crea utente (sappiamo che non esiste)
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          assignedPartnerId,
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiry: tokenExpiry,
          role: 'USER',
          isActive: true,
          emailVerified: false
        }
      });
      
      // Crea profilo utente (nuovo utente)
      await tx.userProfile.create({
        data: {
          userId: user.id,
          cognome,
          nome,
          dataNascita: new Date(dataNascita),
          luogoNascita,
          provinciaNascita,
          sesso,
          codiceFiscale,
          telefono,
          nomePadre,
          nomeMadre,
          residenzaVia,
          residenzaCitta,
          residenzaProvincia,
          residenzaCap,
          hasDifferentDomicilio: hasDifferentDomicilio || false,
          domicilioVia: hasDifferentDomicilio ? domicilioVia : null,
          domicilioCitta: hasDifferentDomicilio ? domicilioCitta : null,
          domicilioProvincia: hasDifferentDomicilio ? domicilioProvincia : null,
          domicilioCap: hasDifferentDomicilio ? domicilioCap : null
        }
      });
    });
    
    // Invia email di conferma con referral code se presente
    let verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    if (referralCode) {
      verificationLink += `&referralCode=${encodeURIComponent(referralCode)}`;
    }
    await emailService.sendEmailVerification(email, verificationLink);
    
    res.json({
      success: true,
      message: 'Registrazione completata. Controlla la tua email per attivare l\'account.'
    });
    
  } catch (error) {
    console.error('Register error:', error);
    const prismaError = error as any;
    if (prismaError.code === 'P2002') {
      if (prismaError.meta?.target?.includes('codiceFiscale')) {
        return res.status(400).json({ error: 'Codice fiscale già registrato' });
      }
      if (prismaError.meta?.target?.includes('email')) {
        return res.status(400).json({ error: 'Email già registrata' });
      }
    }
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Set password for users with temporary password (after email verification)
router.post('/set-password', async (req, res) => {
  try {
    const { verificationCode, password } = req.body;

    if (!verificationCode || !password) {
      return res.status(400).json({ error: 'Codice di verifica e password sono obbligatori' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve essere di almeno 6 caratteri' });
    }

    // Find user by verification code
    const user = await prisma.user.findFirst({
      where: {
        verificationCode,
        codeExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Codice di verifica non valido o scaduto' });
    }

    // Check if user has temporary password
    if (user.password !== 'INCOMPLETE_TEMP') {
      return res.status(400).json({ error: 'Utente già ha una password impostata' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Update user with new password and clear verification code
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verificationCode: null,
        codeExpiresAt: null
      }
    });

    res.json({
      success: true,
      message: 'Password impostata con successo. Ora puoi accedere al tuo account.'
    });

  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Check referral code validity
router.get('/check-referral/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Check if this is a partner offer link (format: PARTNERCODE-OFFERID)
    let partnerCode = code;
    let offerId: string | null = null;
    
    if (code.includes('-')) {
      const parts = code.split('-');
      partnerCode = parts[0];
      offerId = parts.slice(1).join('-'); // Handle cases with multiple dashes
    }
    
    const partner = await prisma.partner.findUnique({
      where: { referralCode: partnerCode },
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });
    
    if (!partner) {
      return res.status(404).json({ error: 'Codice referral non valido' });
    }
    
    // If offerId is provided, check if the offer exists and belongs to this partner
    let offer = null;
    if (offerId) {
      // First try to find by referralLink (in case the full link is provided)
      offer = await prisma.partnerOffer.findFirst({
        where: {
          referralLink: code,
          isActive: true
        },
        include: {
          course: true,
          partner: true
        }
      });
      
      // If not found by referralLink, try by the offerId part with partner check
      if (!offer) {
        offer = await prisma.partnerOffer.findFirst({
          where: {
            id: offerId,
            partnerId: partner.id,
            isActive: true
          },
          include: {
            course: true
          }
        });
      }
    }
    
    // If we expected an offer but didn't find one, return error
    if (offerId && !offer) {
      return res.status(404).json({ error: 'Offerta non trovata o non attiva' });
    }
    
    res.json({
      valid: true,
      partnerEmail: partner.user.email,
      partnerId: partner.id,
      offer: offer ? {
        id: offer.id,
        name: offer.name,
        offerType: offer.offerType,
        totalAmount: offer.totalAmount,
        course: offer.course
      } : null
    });
    
  } catch (error) {
    console.error('Check referral error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Verify unique code for enrollment access
router.post('/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Codice obbligatorio' });
    }
    
    const user = await prisma.user.findUnique({
      where: { verificationCode: code },
      include: {
        profile: true,
        assignedPartner: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Codice non valido' });
    }
    
    if (user.codeExpiresAt && user.codeExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Codice scaduto. Verifica nuovamente la tua email.' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        hasProfile: !!user.profile,
        assignedPartner: user.assignedPartner ? {
          id: user.assignedPartner.id,
          referralCode: user.assignedPartner.referralCode
        } : null
      }
    });
    
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Check email verification status
router.get('/check-email-verification/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`🔍 EMAIL CHECK REQUEST for: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: true
      }
    });
    
    console.log(`🔍 EMAIL CHECK RESULT:`, {
      userExists: !!user,
      hasProfile: !!user?.profile,
      registrationsCount: user?.registrations?.length || 0,
      emailVerified: user?.emailVerified || false
    });
    
    if (!user) {
      return res.json({ verified: false, exists: false });
    }
    
    // Consider user as "truly registered" only if they have a profile
    const hasCompleteProfile = !!user.profile;
    
    res.json({ 
      verified: user.emailVerified || false,
      exists: hasCompleteProfile,
      hasProfile: hasCompleteProfile
    });
    
  } catch (error) {
    console.error('Check email verification error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Development utilities
if (process.env.NODE_ENV === 'development') {
  router.get('/test-email', async (_req, res) => {
    try {
      const isConnected = await emailService.testConnection();
      res.json({ 
        success: isConnected,
        message: isConnected ? 'Email configurata correttamente' : 'Errore configurazione email'
      });
    } catch (error) {
      res.status(500).json({ error: 'Errore test email' });
    }
  });


  // Clean user data for development
  router.delete('/dev-clean-user/:email', async (req, res) => {
    try {
      const { email } = req.params;
      
      const existingUser = await prisma.user.findUnique({
        where: { email: decodeURIComponent(email) },
        include: {
          profile: true,
          registrations: true
        }
      });

      if (!existingUser) {
        return res.json({ success: true, message: 'User not found, nothing to clean' });
      }

      await prisma.$transaction(async (tx) => {
        // Delete related records first
        if (existingUser.registrations.length > 0) {
          const registrationIds = existingUser.registrations.map(r => r.id);
          
          // Clean up UserDocument tables
          await tx.userDocument.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          // Also clean up user documents not tied to registrations
          await tx.userDocument.deleteMany({
            where: { userId: existingUser.id }
          });
          await tx.couponUse.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.paymentDeadline.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.payment.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.registration.deleteMany({
            where: { id: { in: registrationIds } }
          });
        }
        
        if (existingUser.profile) {
          await tx.userProfile.delete({
            where: { userId: existingUser.id }
          });
        }
        
        await tx.user.delete({
          where: { id: existingUser.id }
        });
      });

      res.json({ 
        success: true, 
        message: `User ${email} and all related data cleaned successfully` 
      });
    } catch (error) {
      console.error('Clean user error:', error);
      res.status(500).json({ error: 'Errore durante la pulizia' });
    }
  });
}

// Check if user needs to set password (for temporary password users)
router.post('/check-password-status', async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ error: 'Codice di verifica richiesto' });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationCode,
        codeExpiresAt: {
          gt: new Date()
        }
      },
      select: {
        id: true,
        email: true,
        password: true,
        profile: {
          select: {
            nome: true,
            cognome: true
          }
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Codice di verifica non valido o scaduto' });
    }

    const needsPassword = user.password === 'INCOMPLETE_TEMP';

    res.json({
      needsPassword,
      user: {
        id: user.id,
        email: user.email,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Check password status error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;