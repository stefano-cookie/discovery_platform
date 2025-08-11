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

  async sendDocumentApprovedEmail(email: string, userName: string, documentType: string): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Documento Approvato - Piattaforma Diamante',
      html: this.getDocumentApprovedTemplate(userName, documentType),
      text: `
        Gentile ${userName},
        
        Il tuo documento "${documentType}" è stato approvato con successo.
        
        Puoi visualizzare lo stato di tutti i tuoi documenti nella tua area personale.
        
        Cordiali saluti,
        Il team di Piattaforma Diamante
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✉️ Email di approvazione documento inviata a: ${email}`);
    } catch (error) {
      console.error('Errore nell\'invio dell\'email di approvazione:', error);
      throw error;
    }
  }

  async sendDocumentRejectedEmail(
    email: string, 
    userName: string, 
    documentType: string, 
    reason: string,
    details?: string
  ): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Documento Non Conforme - Azione Richiesta',
      html: this.getDocumentRejectedTemplate(userName, documentType, reason, details),
      text: `
        Gentile ${userName},
        
        Il documento "${documentType}" che hai caricato non è conforme e richiede una tua azione.
        
        Motivo del rifiuto: ${reason}
        ${details ? `\nDettagli aggiuntivi: ${details}` : ''}
        
        Per procedere con la tua iscrizione, ti preghiamo di:
        1. Accedere alla tua area personale
        2. Caricare nuovamente il documento corretto
        3. Attendere la verifica del partner
        
        Link area personale: ${process.env.FRONTEND_URL}/dashboard
        
        Cordiali saluti,
        Il team di Piattaforma Diamante
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✉️ Email di rifiuto documento inviata a: ${email}`);
    } catch (error) {
      console.error('Errore nell\'invio dell\'email di rifiuto:', error);
      throw error;
    }
  }

  private getDocumentApprovedTemplate(userName: string, documentType: string): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <title>Documento Approvato</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .success { color: #10b981; font-size: 48px; }
            .title { font-size: 24px; font-weight: bold; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success">✓</div>
                <div class="title">Documento Approvato</div>
            </div>
            <p>Gentile ${userName},</p>
            <p>Il tuo documento <strong>"${documentType}"</strong> è stato approvato con successo.</p>
            <p>Puoi visualizzare lo stato di tutti i tuoi documenti nella tua area personale.</p>
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Vai all'Area Personale</a>
            <p>Cordiali saluti,<br>Il team di Piattaforma Diamante</p>
        </div>
    </body>
    </html>
    `;
  }

  private getDocumentRejectedTemplate(userName: string, documentType: string, reason: string, details?: string): string {
    return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <title>Documento Non Conforme</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .warning { color: #ef4444; font-size: 48px; }
            .title { font-size: 24px; font-weight: bold; margin: 20px 0; color: #ef4444; }
            .reason-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
            .steps { background: #f3f4f6; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="warning">⚠</div>
                <div class="title">Documento Non Conforme</div>
            </div>
            <p>Gentile ${userName},</p>
            <p>Il documento <strong>"${documentType}"</strong> che hai caricato non è conforme e richiede una tua azione.</p>
            
            <div class="reason-box">
                <strong>Motivo del rifiuto:</strong><br>
                ${reason}
                ${details ? `<br><br><strong>Dettagli aggiuntivi:</strong><br>${details}` : ''}
            </div>
            
            <div class="steps">
                <strong>Per procedere con la tua iscrizione:</strong>
                <ol>
                    <li>Accedi alla tua area personale</li>
                    <li>Carica nuovamente il documento corretto</li>
                    <li>Attendi la verifica del partner</li>
                </ol>
            </div>
            
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Vai all'Area Personale</a>
            
            <p>Cordiali saluti,<br>Il team di Piattaforma Diamante</p>
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

  // Send document rejection email
  async sendDocumentRejectionEmail(
    userEmail: string,
    userName: string,
    documentType: string,
    reason: string,
    details?: string,
    registrationId?: string
  ): Promise<boolean> {
    try {
      const template = this.getDocumentRejectionTemplate(userName, documentType, reason, details);
      
      const mailOptions = {
        from: this.fromEmail,
        to: userEmail,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Document rejection email sent successfully:', result.messageId);

      if (process.env.NODE_ENV === 'development' && result.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(result));
      }

      return true;
    } catch (error) {
      console.error('Failed to send document rejection email:', error);
      return false;
    }
  }

  // Send document approval email
  async sendDocumentApprovalEmail(
    userEmail: string,
    userName: string,
    documentType: string
  ): Promise<boolean> {
    try {
      const template = this.getDocumentApprovalTemplate(userName, documentType);
      
      const mailOptions = {
        from: this.fromEmail,
        to: userEmail,
        subject: template.subject,
        html: template.html,
        text: template.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Document approval email sent successfully:', result.messageId);

      if (process.env.NODE_ENV === 'development' && result.previewURL) {
        console.log('Preview email:', nodemailer.getTestMessageUrl(result));
      }

      return true;
    } catch (error) {
      console.error('Failed to send document approval email:', error);
      return false;
    }
  }

  // Document rejection email template
  private getDocumentRejectionTemplate(
    userName: string,
    documentType: string,
    reason: string,
    details?: string
  ) {
    const documentTypeMap: Record<string, string> = {
      'IDENTITY_CARD': 'Carta d\'Identità',
      'PASSPORT': 'Passaporto', 
      'DIPLOMA': 'Diploma',
      'BACHELOR_DEGREE': 'Laurea Triennale',
      'MASTER_DEGREE': 'Laurea Magistrale',
      'TRANSCRIPT': 'Piano di Studi',
      'CV': 'Curriculum Vitae',
      'PHOTO': 'Foto Tessera',
      'RESIDENCE_CERT': 'Certificato di Residenza',
      'BIRTH_CERT': 'Certificato di Nascita',
      'MEDICAL_CERT': 'Certificato Medico',
      'CONTRACT_SIGNED': 'Contratto Firmato',
      'OTHER': 'Altro Documento'
    };

    const documentTypeName = documentTypeMap[documentType] || documentType;
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const subject = '🚨 Documento non conforme - Azione richiesta';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px 0;
          }
          .details { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 3px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚨 Documento non conforme</h2>
          </div>
          
          <div class="content">
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <p>Il documento "<strong>${documentTypeName}</strong>" non è conforme ai requisiti richiesti.</p>
            
            <div class="details">
              <h4>📋 Motivo del rifiuto:</h4>
              <p><strong>${reason}</strong></p>
              ${details ? `<p><em>Note aggiuntive:</em> ${details}</p>` : ''}
            </div>
            
            <p>Per procedere con la sua iscrizione, la preghiamo di:</p>
            <ol>
              <li>Accedere alla sua area personale</li>
              <li>Caricare nuovamente il documento corretto</li>
              <li>Attendere la verifica del partner</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">🔗 Accedi all'Area Personale</a>
            </div>
            
            <p><strong>Documenti richiesti:</strong></p>
            <ul>
              <li>Formato: PDF, JPG o PNG</li>
              <li>Dimensione massima: 10MB</li>
              <li>Documento leggibile e completo</li>
              <li>Non scannerizzato da fotocopia</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Questa è una email automatica. Non rispondere a questo messaggio.</p>
            <p><strong>Team Diamante</strong><br>Piattaforma TFA e Certificazioni</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Documento non conforme - Azione richiesta

Gentile ${userName},

Il documento "${documentTypeName}" non è conforme.

Motivo del rifiuto: ${reason}
${details ? `Note aggiuntive: ${details}` : ''}

Per procedere:
1. Accedere all'area personale
2. Caricare nuovamente il documento corretto  
3. Attendere la verifica del partner

Link area personale: ${dashboardUrl}

Requisiti documenti:
- Formato: PDF, JPG o PNG
- Dimensione massima: 10MB
- Documento leggibile e completo

Team Diamante
    `;

    return { subject, html, text };
  }

  // Document approval email template
  private getDocumentApprovalTemplate(userName: string, documentType: string) {
    const documentTypeMap: Record<string, string> = {
      'IDENTITY_CARD': 'Carta d\'Identità',
      'PASSPORT': 'Passaporto',
      'DIPLOMA': 'Diploma', 
      'BACHELOR_DEGREE': 'Laurea Triennale',
      'MASTER_DEGREE': 'Laurea Magistrale',
      'TRANSCRIPT': 'Piano di Studi',
      'CV': 'Curriculum Vitae',
      'PHOTO': 'Foto Tessera',
      'RESIDENCE_CERT': 'Certificato di Residenza',
      'BIRTH_CERT': 'Certificato di Nascita',
      'MEDICAL_CERT': 'Certificato Medico',
      'CONTRACT_SIGNED': 'Contratto Firmato',
      'OTHER': 'Altro Documento'
    };

    const documentTypeName = documentTypeMap[documentType] || documentType;
    const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

    const subject = '✅ Documento approvato';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
          .button { 
            display: inline-block; 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px 0;
          }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Documento Approvato</h2>
          </div>
          
          <div class="content">
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <p>Il suo documento "<strong>${documentTypeName}</strong>" è stato verificato e <strong>approvato</strong> dal nostro team.</p>
            
            <p>Può procedere con il completamento della sua iscrizione accedendo alla sua area personale.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="button">🔗 Accedi all'Area Personale</a>
            </div>
          </div>
          
          <div class="footer">
            <p>Grazie per aver scelto la Piattaforma Diamante.</p>
            <p><strong>Team Diamante</strong><br>Piattaforma TFA e Certificazioni</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Documento Approvato

Gentile ${userName},

Il suo documento "${documentTypeName}" è stato verificato e approvato.

Può procedere con il completamento della sua iscrizione.

Link area personale: ${dashboardUrl}

Team Diamante
    `;

    return { subject, html, text };
  }

  // TFA Step notifications
  async sendTfaCnredReleasedNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getTfaCnredReleasedTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendTfaFinalExamNotification(email: string, userName: string, courseName: string, passed: boolean, examDate: string): Promise<void> {
    const template = this.getTfaFinalExamTemplate(userName, courseName, passed, examDate);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendTfaRecognitionRequestNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getTfaRecognitionRequestTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendTfaCompletedNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getTfaCompletedTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
  }

  private getTfaCnredReleasedTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = 'CNRED Rilasciato - Corso TFA';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .step-badge { background-color: #e0f2fe; color: #0369a1; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .button { background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 CNRED Rilasciato</h1>
            <p>Il tuo percorso TFA continua!</p>
          </div>
          
          <div class="content">
            <div class="step-badge">🏆 Step 1 Completato</div>
            
            <p>Caro <strong>${userName}</strong>,</p>
            
            <p>Siamo lieti di informarti che il <strong>CNRED</strong> (Codice Nazionale di Riconoscimento Europeo dei Diplomi) per il tuo corso <strong>${courseName}</strong> è stato <strong>rilasciato</strong>!</p>
            
            <p>Questo è un importante traguardo nel tuo percorso TFA. Il CNRED certifica il riconoscimento del tuo titolo di studio a livello europeo.</p>
            
            <h3>Prossimi step:</h3>
            <ul>
              <li>📝 Preparazione all'esame finale</li>
              <li>🎯 Sostenimento esame finale</li>
              <li>📋 Richiesta di riconoscimento</li>
            </ul>
            
            <p>Il tuo partner di riferimento ti accompagnerà nei prossimi passi.</p>
          </div>
          
          <div class="footer">
            <p>Congratulazioni per questo importante traguardo!</p>
            <p><strong>Team TFA Romania</strong><br>Piattaforma Diamante</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
CNRED Rilasciato - Corso TFA

Caro ${userName},

Il CNRED per il tuo corso ${courseName} è stato rilasciato!

Questo certifica il riconoscimento del tuo titolo di studio a livello europeo.

Prossimi step:
- Preparazione all'esame finale
- Sostenimento esame finale
- Richiesta di riconoscimento

Team TFA Romania
    `;

    return { subject, html, text };
  }

  private getTfaFinalExamTemplate(userName: string, courseName: string, passed: boolean, examDate: string): { subject: string; html: string; text: string } {
    const subject = passed ? 'Esame Finale Superato - Corso TFA' : 'Esame Finale - Informazioni - Corso TFA';
    
    const resultColor = passed ? '#10b981' : '#ef4444';
    const resultIcon = passed ? '✅' : '📝';
    const resultText = passed ? 'SUPERATO' : 'COMPLETATO';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .step-badge { background-color: #fef3c7; color: #d97706; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .result-badge { background-color: ${passed ? '#d1fae5' : '#fee2e2'}; color: ${resultColor}; padding: 12px 20px; border-radius: 8px; font-weight: 700; text-align: center; margin: 20px 0; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${resultIcon} Esame Finale</h1>
            <p>Aggiornamento sul tuo percorso TFA</p>
          </div>
          
          <div class="content">
            <div class="step-badge">📝 Step 2 Completato</div>
            
            <p>Caro <strong>${userName}</strong>,</p>
            
            <div class="result-badge">
              Esame finale del ${examDate}: ${resultText}
            </div>
            
            <p>L'esame finale per il tuo corso <strong>${courseName}</strong> è stato registrato in data <strong>${examDate}</strong>.</p>
            
            ${passed ? `
              <p>🎉 <strong>Complimenti!</strong> Hai superato con successo l'esame finale. Questo è un traguardo molto importante nel tuo percorso TFA.</p>
              
              <h3>Prossimo step:</h3>
              <ul>
                <li>📋 Il tuo partner preparerà la richiesta di riconoscimento</li>
                <li>🎓 Completamento finale del percorso</li>
              </ul>
            ` : `
              <p>Il tuo esame finale è stato registrato e sarà valutato secondo le procedure standard del corso TFA.</p>
              
              <p>Il tuo partner di riferimento ti fornirà ulteriori informazioni sui prossimi passi.</p>
            `}
          </div>
          
          <div class="footer">
            <p>${passed ? 'Congratulazioni per il traguardo raggiunto!' : 'Ti terremo aggiornato sui prossimi sviluppi.'}</p>
            <p><strong>Team TFA Romania</strong><br>Piattaforma Diamante</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
${subject}

Caro ${userName},

Esame finale del ${examDate}: ${resultText}

L'esame finale per il tuo corso ${courseName} è stato registrato.

${passed ? 'Congratulazioni! Hai superato con successo l\'esame finale.' : 'Il tuo esame è stato registrato e sarà valutato secondo le procedure standard.'}

Team TFA Romania
    `;

    return { subject, html, text };
  }

  private getTfaRecognitionRequestTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = 'Richiesta di Riconoscimento Inviata - Corso TFA';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .step-badge { background-color: #fdf2f8; color: #be185d; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Richiesta di Riconoscimento</h1>
            <p>Siamo quasi al traguardo!</p>
          </div>
          
          <div class="content">
            <div class="step-badge">📄 Step 3 Completato</div>
            
            <p>Caro <strong>${userName}</strong>,</p>
            
            <p>È stata <strong>inviata la richiesta di riconoscimento</strong> per il tuo corso <strong>${courseName}</strong>!</p>
            
            <p>Questo è il penultimo passo del tuo percorso TFA. La richiesta è ora in fase di elaborazione presso gli enti competenti.</p>
            
            <h3>Cosa succede ora:</h3>
            <ul>
              <li>⏳ La richiesta verrà processata dagli enti competenti</li>
              <li>📞 Potresti essere contattato per eventuali chiarimenti</li>
              <li>🎓 Una volta approvata, il tuo percorso sarà completato</li>
            </ul>
            
            <p>Ti terremo aggiornato su tutti gli sviluppi. Il completamento finale è ormai vicino!</p>
          </div>
          
          <div class="footer">
            <p>Siamo orgogliosi del tuo percorso fino a questo punto!</p>
            <p><strong>Team TFA Romania</strong><br>Piattaforma Diamante</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Richiesta di Riconoscimento Inviata - Corso TFA

Caro ${userName},

È stata inviata la richiesta di riconoscimento per il tuo corso ${courseName}!

Questo è il penultimo passo del tuo percorso TFA.

Cosa succede ora:
- La richiesta verrà processata dagli enti competenti
- Potresti essere contattato per eventuali chiarimenti
- Una volta approvata, il tuo percorso sarà completato

Ti terremo aggiornato su tutti gli sviluppi.

Team TFA Romania
    `;

    return { subject, html, text };
  }

  private getTfaCompletedTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = '🎓 Corso TFA Completato - Congratulazioni!';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px; text-align: center; }
          .content { padding: 30px; }
          .completion-badge { background-color: #d1fae5; color: #047857; padding: 15px 25px; border-radius: 8px; font-weight: 700; text-align: center; margin: 25px 0; font-size: 18px; }
          .steps-completed { background-color: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .footer { background-color: #f8fafc; padding: 25px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 CORSO COMPLETATO!</h1>
            <p style="font-size: 18px; margin-top: 15px;">Hai raggiunto il traguardo finale</p>
          </div>
          
          <div class="content">
            <div class="completion-badge">
              ✅ PERCORSO TFA COMPLETATO CON SUCCESSO
            </div>
            
            <p style="font-size: 18px;">Caro <strong>${userName}</strong>,</p>
            
            <p><strong>Complimenti!</strong> Hai completato con successo il tuo corso <strong>${courseName}</strong>!</p>
            
            <p>Il riconoscimento è stato approvato e il tuo percorso TFA è ora <strong>ufficialmente concluso</strong>. Questo è un traguardo straordinario che testimonia il tuo impegno e la tua dedizione.</p>
            
            <div class="steps-completed">
              <h3 style="margin-top: 0; color: #047857;">🏁 Tutti i passaggi completati:</h3>
              <ul style="margin: 10px 0;">
                <li>✅ <strong>CNRED rilasciato</strong> - Riconoscimento europeo ottenuto</li>
                <li>✅ <strong>Esame finale superato</strong> - Competenze certificate</li>
                <li>✅ <strong>Richiesta di riconoscimento approvata</strong> - Titolo ufficialmente riconosciuto</li>
                <li>✅ <strong>Percorso completato</strong> - Obiettivo raggiunto!</li>
              </ul>
            </div>
            
            <p>Ora sei ufficialmente qualificato e puoi procedere con fiducia nel tuo percorso professionale nell'ambito dell'insegnamento.</p>
            
            <p><strong>Grazie</strong> per aver scelto la nostra piattaforma e per la fiducia che ci hai accordato durante tutto il percorso.</p>
          </div>
          
          <div class="footer">
            <p style="font-size: 16px; font-weight: 600; color: #059669;">🎉 Congratulazioni per questo straordinario traguardo! 🎉</p>
            <p><strong>Team TFA Romania</strong><br>Piattaforma Diamante</p>
            <p style="font-style: italic;">Siamo orgogliosi di aver fatto parte del tuo successo!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
🎓 CORSO TFA COMPLETATO - Congratulazioni!

Caro ${userName},

Complimenti! Hai completato con successo il tuo corso ${courseName}!

Il riconoscimento è stato approvato e il tuo percorso TFA è ora ufficialmente concluso.

Tutti i passaggi completati:
✅ CNRED rilasciato
✅ Esame finale superato  
✅ Richiesta di riconoscimento approvata
✅ Percorso completato

Ora sei ufficialmente qualificato per l'insegnamento.

Grazie per aver scelto la nostra piattaforma!

🎉 Congratulazioni per questo straordinario traguardo! 🎉

Team TFA Romania
Piattaforma Diamante
    `;

    return { subject, html, text };
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