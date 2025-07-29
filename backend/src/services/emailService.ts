import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@diamante.com';
    
    const config: EmailConfig = {
      host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'ethereal.user',
        pass: process.env.EMAIL_PASS || 'ethereal.pass'
      }
    };

    this.transporter = nodemailer.createTransport(config);
  }

  async sendEmailVerification(email: string, verificationLink: string): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Verifica il tuo indirizzo email - Piattaforma Diamante',
      html: this.getVerificationEmailTemplate(verificationLink),
      text: `
        Ciao,
        
        Per completare la tua registrazione sulla Piattaforma Diamante, devi verificare il tuo indirizzo email.
        
        Clicca sul seguente link per verificare la tua email:
        ${verificationLink}
        
        Questo link è valido per 24 ore.
        
        Se non hai richiesto questa verifica, puoi ignorare questa email.
        
        Grazie,
        Il team Piattaforma Diamante
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      
      if (process.env.NODE_ENV === 'development' && info.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Unable to send verification email');
    }
  }

  private getVerificationEmailTemplate(verificationLink: string): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica Email - Piattaforma Diamante</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            .title {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
            }
            .verification-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
            }
            .verification-button:hover {
                background: linear-gradient(135deg, #2563eb, #7c3aed);
            }
            .link-fallback {
                margin-top: 20px;
                padding: 15px;
                background-color: #f3f4f6;
                border-radius: 8px;
                word-break: break-all;
                font-size: 14px;
                color: #6b7280;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
            .warning {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #92400e;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">💎 Piattaforma Diamante</div>
                <h1 class="title">Verifica il tuo indirizzo email</h1>
            </div>
            
            <div class="content">
                <p>Ciao,</p>
                <p>Grazie per aver iniziato la registrazione sulla <strong>Piattaforma Diamante</strong>!</p>
                <p>Per completare la tua registrazione e accedere a tutti i nostri servizi, devi verificare il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
                
                <div style="text-align: center;">
                    <a href="${verificationLink}" class="verification-button">
                        ✓ Verifica la mia email
                    </a>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong> Questo link è valido per 24 ore. Dopo la scadenza dovrai richiedere un nuovo link di verifica.
                </div>
                
                <p>Se il pulsante non funziona, puoi copiare e incollare il seguente link nel tuo browser:</p>
                <div class="link-fallback">
                    ${verificationLink}
                </div>
                
                <p>Se non hai richiesto questa verifica, puoi ignorare questa email in sicurezza.</p>
            </div>
            
            <div class="footer">
                <p><strong>Piattaforma Diamante</strong></p>
                <p>Questa è una email automatica, non rispondere a questo messaggio.</p>
                <p>Per assistenza, contatta il supporto.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendRegistrationConfirmation(email: string, registrationData: any): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Registrazione completata - Piattaforma Diamante',
      html: this.getRegistrationConfirmationTemplate(registrationData),
      text: `
        Ciao ${registrationData.nome},
        
        La tua registrazione alla Piattaforma Diamante è stata completata con successo!
        
        Dettagli registrazione:
        - Nome: ${registrationData.nome} ${registrationData.cognome}
        - Email: ${registrationData.email}
        - ID Registrazione: ${registrationData.registrationId}
        
        Il nostro team ti contatterà presto per i prossimi passi.
        
        Grazie per aver scelto la Piattaforma Diamante!
        
        Il team Piattaforma Diamante
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Registration confirmation email sent:', info.messageId);
      
      if (process.env.NODE_ENV === 'development' && info.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Unable to send confirmation email');
    }
  }

  private getRegistrationConfirmationTemplate(registrationData: any): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registrazione Completata - Piattaforma Diamante</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #10b981;
                margin-bottom: 10px;
            }
            .title {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
            }
            .success-icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
            }
            .info-box {
                background-color: #f0fdf4;
                border: 1px solid #16a34a;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .info-box h3 {
                color: #15803d;
                margin-top: 0;
                margin-bottom: 15px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #dcfce7;
            }
            .info-row:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .info-label {
                font-weight: bold;
                color: #15803d;
            }
            .info-value {
                color: #166534;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
            .next-steps {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                color: #92400e;
            }
            .next-steps h3 {
                color: #92400e;
                margin-top: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">💎 Piattaforma Diamante</div>
                <div class="success-icon">🎉</div>
                <h1 class="title">Registrazione Completata!</h1>
            </div>
            
            <div class="content">
                <p>Ciao <strong>${registrationData.nome}</strong>,</p>
                <p>La tua registrazione alla <strong>Piattaforma Diamante</strong> è stata completata con successo!</p>
                
                <div class="info-box">
                    <h3>📋 Dettagli della tua registrazione:</h3>
                    <div class="info-row">
                        <span class="info-label">Nome Completo:</span>
                        <span class="info-value">${registrationData.nome} ${registrationData.cognome}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value">${registrationData.email}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ID Registrazione:</span>
                        <span class="info-value">${registrationData.registrationId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Data Registrazione:</span>
                        <span class="info-value">${new Date().toLocaleDateString('it-IT')}</span>
                    </div>
                </div>
                
                <div class="next-steps">
                    <h3>📞 Prossimi Passi:</h3>
                    <ul>
                        <li>Il nostro team ti contatterà entro 24-48 ore</li>
                        <li>Riceverai informazioni dettagliate sul corso</li>
                        <li>Ti guideremo attraverso il processo di iscrizione</li>
                    </ul>
                </div>
                
                <p>Conserva questa email per i tuoi archivi. Se hai domande, non esitare a contattarci.</p>
                <p>Benvenuto nella famiglia Piattaforma Diamante! 🚀</p>
            </div>
            
            <div class="footer">
                <p><strong>Piattaforma Diamante</strong></p>
                <p>Questa è una email automatica, non rispondere a questo messaggio.</p>
                <p>Per assistenza, contatta il nostro supporto.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendTemporaryCredentials(email: string, credentials: { temporaryPassword: string, loginUrl: string }, userData: any): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Credenziali di accesso - Piattaforma Diamante',
      html: this.getTemporaryCredentialsTemplate(credentials, userData),
      text: `
        Ciao ${userData.nome},
        
        La tua registrazione alla Piattaforma Diamante è stata completata con successo!
        
        Ecco le tue credenziali di accesso temporanee:
        Email: ${email}
        Password temporanea: ${credentials.temporaryPassword}
        
        Link di accesso: ${credentials.loginUrl}
        
        IMPORTANTE: Per motivi di sicurezza, dovrai cambiare la password al primo accesso.
        
        Conserva queste informazioni in luogo sicuro.
        
        Il team Piattaforma Diamante
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Temporary credentials email sent:', info.messageId);
      
      if (process.env.NODE_ENV === 'development' && info.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Unable to send temporary credentials email');
    }
  }

  private getTemporaryCredentialsTemplate(credentials: { temporaryPassword: string, loginUrl: string }, userData: any): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credenziali di Accesso - Piattaforma Diamante</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #3b82f6;
                margin-bottom: 10px;
            }
            .title {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
            }
            .credentials-box {
                background-color: #fef3c7;
                border: 2px solid #f59e0b;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .credentials-box h3 {
                color: #92400e;
                margin-top: 0;
                margin-bottom: 15px;
            }
            .credential-item {
                margin: 15px 0;
                padding: 10px;
                background-color: white;
                border-radius: 4px;
                border: 1px solid #fbbf24;
            }
            .credential-label {
                font-weight: bold;
                color: #92400e;
                display: block;
                margin-bottom: 5px;
            }
            .credential-value {
                font-family: 'Courier New', monospace;
                font-size: 16px;
                color: #1f2937;
                background-color: #f3f4f6;
                padding: 8px;
                border-radius: 4px;
                word-break: break-all;
            }
            .login-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
            }
            .security-warning {
                background-color: #fef2f2;
                border: 2px solid #ef4444;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                color: #dc2626;
            }
            .security-warning h3 {
                color: #dc2626;
                margin-top: 0;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">💎 Piattaforma Diamante</div>
                <h1 class="title">🎉 Benvenuto nella piattaforma!</h1>
            </div>
            
            <div class="content">
                <p>Ciao <strong>${userData.nome}</strong>,</p>
                <p>La tua registrazione è stata completata con successo! Ora puoi accedere alla tua area personale.</p>
                
                <div class="credentials-box">
                    <h3>🔐 Le tue credenziali di accesso:</h3>
                    <div class="credential-item">
                        <span class="credential-label">Email:</span>
                        <div class="credential-value">${userData.email}</div>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Password temporanea:</span>
                        <div class="credential-value">${credentials.temporaryPassword}</div>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${credentials.loginUrl}" class="login-button">
                        🚀 Accedi alla Piattaforma
                    </a>
                </div>
                
                <div class="security-warning">
                    <h3>⚠️ Importante - Sicurezza</h3>
                    <ul>
                        <li><strong>Devi cambiare la password al primo accesso</strong></li>
                        <li>La password temporanea è valida solo per il primo login</li>
                        <li>Conserva queste credenziali in luogo sicuro</li>
                        <li>Non condividere mai le tue credenziali</li>
                    </ul>
                </div>
                
                <p>Nella tua area personale potrai:</p>
                <ul>
                    <li>📝 Visualizzare le tue iscrizioni</li>
                    <li>📄 Gestire i tuoi documenti</li>
                    <li>🎓 Accedere a nuovi corsi disponibili</li>
                    <li>💬 Comunicare con il tuo partner di riferimento</li>
                </ul>
            </div>
            
            <div class="footer">
                <p><strong>Piattaforma Diamante</strong></p>
                <p>Per assistenza tecnica, contatta il nostro supporto.</p>
                <p>Questo messaggio contiene informazioni riservate.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendPasswordChangeConfirmation(email: string, userData: { nome: string, timestamp: string }): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: '🔒 Password modificata con successo - Piattaforma Diamante',
      html: this.getPasswordChangeConfirmationTemplate(userData),
      text: `
        Ciao ${userData.nome},
        
        Ti confermiamo che la tua password è stata modificata con successo.
        
        Data e ora modifica: ${userData.timestamp}
        
        Se non hai effettuato tu questa modifica, contattaci immediatamente per mettere in sicurezza il tuo account.
        
        Cordiali saluti,
        Il Team di Piattaforma Diamante
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Password change confirmation email sent to:', email);
    } catch (error) {
      console.error('Error sending password change confirmation email:', error);
      throw new Error('Unable to send password change confirmation email');
    }
  }

  private getPasswordChangeConfirmationTemplate(userData: { nome: string, timestamp: string }): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Modificata - Piattaforma Diamante</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #0066cc;
                padding-bottom: 20px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #0066cc;
                margin-bottom: 10px;
            }
            .success-icon {
                font-size: 48px;
                color: #28a745;
                margin-bottom: 20px;
            }
            .content {
                text-align: center;
                margin-bottom: 30px;
            }
            .info-box {
                background-color: #e8f4fd;
                border: 1px solid #b8daff;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .timestamp {
                font-weight: bold;
                color: #0066cc;
            }
            .security-notice {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">PIATTAFORMA DIAMANTE</div>
                <div style="font-size: 16px; color: #666;">Formazione Professionale</div>
            </div>
            
            <div class="content">
                <div class="success-icon">✓</div>
                <h2 style="color: #28a745; margin-bottom: 20px;">Password Modificata con Successo!</h2>
                
                <p>Ciao <strong>${userData.nome}</strong>,</p>
                
                <p>Ti confermiamo che la tua password è stata modificata con successo sulla Piattaforma Diamante.</p>
                
                <div class="info-box">
                    <h3 style="margin-top: 0; color: #0066cc;">Dettagli Modifica:</h3>
                    <p class="timestamp">Data e ora: ${userData.timestamp}</p>
                </div>
                
                <div class="security-notice">
                    <h4 style="margin-top: 0; color: #856404;">Importante per la Sicurezza:</h4>
                    <p style="margin-bottom: 0;">Se <strong>NON</strong> hai effettuato tu questa modifica, contattaci immediatamente per mettere in sicurezza il tuo account.</p>
                </div>
                
                <p>La tua password è ora aggiornata e potrai utilizzarla per i prossimi accessi alla piattaforma.</p>
                
                <div style="margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL}/login" 
                       style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Accedi alla Piattaforma
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p><strong>Piattaforma Diamante</strong><br>
                Formazione Professionale di Qualità</p>
                <p style="font-size: 12px; margin-top: 15px;">
                    Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendEnrollmentConfirmation(email: string, enrollmentData: any): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Iscrizione completata con successo - Piattaforma Diamante',
      html: this.getEnrollmentConfirmationTemplate(enrollmentData),
      text: `
        Ciao ${enrollmentData.nome},
        
        La tua iscrizione al corso "${enrollmentData.courseName}" è stata completata con successo!
        
        Dettagli iscrizione:
        - Corso: ${enrollmentData.courseName}
        - Tipo: ${enrollmentData.offerType}
        - ID Iscrizione: ${enrollmentData.registrationId}
        - Partner di riferimento: ${enrollmentData.partnerName}
        
        Puoi accedere alla tua area riservata per visualizzare tutti i dettagli e seguire i progressi della tua iscrizione.
        
        Grazie per aver scelto la Piattaforma Diamante!
        
        Il team Piattaforma Diamante
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Enrollment confirmation email sent:', info.messageId);
      
      if (process.env.NODE_ENV === 'development' && info.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Unable to send enrollment confirmation email');
    }
  }

  private getEnrollmentConfirmationTemplate(enrollmentData: any): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Iscrizione Completata - Piattaforma Diamante</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                color: #10b981;
                margin-bottom: 10px;
            }
            .title {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
            }
            .success-icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            .content {
                margin-bottom: 30px;
                color: #4b5563;
            }
            .course-info {
                background-color: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .course-info h3 {
                color: #0c4a6e;
                margin-top: 0;
                margin-bottom: 15px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e0f2fe;
            }
            .info-row:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
            }
            .info-label {
                font-weight: bold;
                color: #0c4a6e;
            }
            .info-value {
                color: #075985;
            }
            .dashboard-button {
                display: inline-block;
                background: linear-gradient(135deg, #3b82f6, #8b5cf6);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 16px;
                text-align: center;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
            .next-steps {
                background-color: #f0fdf4;
                border: 1px solid #16a34a;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                color: #15803d;
            }
            .next-steps h3 {
                color: #15803d;
                margin-top: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">💎 Piattaforma Diamante</div>
                <div class="success-icon">🎓</div>
                <h1 class="title">Iscrizione Completata!</h1>
            </div>
            
            <div class="content">
                <p>Ciao <strong>${enrollmentData.nome}</strong>,</p>
                <p>La tua iscrizione è stata completata con successo! Benvenuto nel corso.</p>
                
                <div class="course-info">
                    <h3>📚 Dettagli del tuo corso:</h3>
                    <div class="info-row">
                        <span class="info-label">Corso:</span>
                        <span class="info-value">${enrollmentData.courseName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Tipologia:</span>
                        <span class="info-value">${enrollmentData.offerType === 'TFA_ROMANIA' ? 'TFA' : 'Certificazione'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ID Iscrizione:</span>
                        <span class="info-value">${enrollmentData.registrationId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Partner di riferimento:</span>
                        <span class="info-value">${enrollmentData.partnerName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Data iscrizione:</span>
                        <span class="info-value">${new Date().toLocaleDateString('it-IT')}</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="dashboard-button">
                        🏠 Accedi alla tua Area Riservata
                    </a>
                </div>
                
                <div class="next-steps">
                    <h3>📋 Prossimi Passi:</h3>
                    <ul>
                        <li>Accedi alla tua area riservata per visualizzare i dettagli completi</li>
                        <li>Il tuo partner di riferimento ti contatterà per i prossimi step</li>
                        <li>Puoi caricare eventuali documenti aggiuntivi dall'area riservata</li>
                        <li>Monitora lo stato della tua iscrizione e i pagamenti</li>
                    </ul>
                </div>
                
                <p>Conserva questa email per i tuoi archivi. La tua avventura formativa inizia ora!</p>
            </div>
            
            <div class="footer">
                <p><strong>Piattaforma Diamante</strong></p>
                <p>Questa è una email automatica, non rispondere a questo messaggio.</p>
                <p>Per assistenza, accedi alla tua area riservata o contatta il tuo partner.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email connection configured correctly');
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      return false;
    }
  }
}

export default new EmailService();