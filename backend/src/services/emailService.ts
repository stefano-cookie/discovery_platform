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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica Email - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0066cc 0%, #004499 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .verification-button { 
            background-color: white; 
            color: black; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #0066cc;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
            text-align: center;
          }
          .info-box { background-color: #e8f4fd; border: 1px solid #b8daff; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .link-fallback { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; margin: 20px 0; word-break: break-all; font-size: 14px; }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Verifica il tuo indirizzo email</h1>
          </div>
          
          <div class="content">
            <p>Gentile utente,</p>
            
            <p>Grazie per aver iniziato la registrazione sulla <strong>Piattaforma Diamante</strong>.</p>
            
            <p>Per completare la sua registrazione e accedere a tutti i nostri servizi formativi, è necessario verificare il suo indirizzo email cliccando sul pulsante qui sotto:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="verification-button">
                ✓ Verifica Email
              </a>
            </div>
            
            <div class="info-box">
              <h4 style="margin-top: 0; color: #0066cc;">⏱️ Importante:</h4>
              <p style="margin-bottom: 0;">Questo link è valido per <strong>24 ore</strong>. Dopo la scadenza dovrà richiedere un nuovo link di verifica.</p>
            </div>
            
            <p>Se il pulsante non dovesse funzionare, può copiare e incollare il seguente link nel suo browser:</p>
            
            <div class="link-fallback">
              ${verificationLink}
            </div>
            
            <p style="font-size: 14px; color: #666;">Se non ha richiesto questa verifica, può ignorare questa email in sicurezza.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto.
            </p>
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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documento Approvato - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; color: #059669; margin-bottom: 20px; text-align: center; }
          .document-info { background-color: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .dashboard-button { 
            background-color: white; 
            color: black; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #059669;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
          </div>
          
          <div class="content">
            <div class="success-icon">✅</div>
            
            <h2 style="color: #059669; text-align: center; margin-bottom: 25px;">Documento Approvato!</h2>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <div class="document-info">
              <h4 style="margin-top: 0; color: #047857;">📄 Documento verificato con successo</h4>
              <p style="margin-bottom: 0; font-weight: 600; color: #065f46;">${documentType}</p>
            </div>
            
            <p>Il documento è stato verificato dal nostro team e <strong>approvato</strong> secondo i criteri richiesti.</p>
            
            <p>Può visualizzare lo stato di tutti i suoi documenti e procedere con i prossimi passi accedendo alla sua area personale.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="dashboard-button">
                🏠 Accedi all'Area Personale
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">La ringraziamo per la collaborazione nel processo di verifica.</p>
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

  private getDocumentRejectedTemplate(userName: string, documentType: string, reason: string, details?: string): string {
    return `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documento Non Conforme - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .warning-icon { font-size: 48px; color: #dc2626; margin-bottom: 20px; text-align: center; }
          .document-info { background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .reason-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
          .steps-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .requirements { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .dashboard-button { 
            background-color: white; 
            color: black; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #dc2626;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
          </div>
          
          <div class="content">
            <div class="warning-icon">⚠️</div>
            
            <h2 style="color: #dc2626; text-align: center; margin-bottom: 25px;">Documento Non Conforme</h2>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <div class="document-info">
              <h4 style="margin-top: 0; color: #dc2626;">📄 Documento soggetto a revisione</h4>
              <p style="margin-bottom: 0; font-weight: 600; color: #991b1b;">${documentType}</p>
            </div>
            
            <p>Il documento che ha caricato non è conforme ai requisiti richiesti e necessita di una sua azione per procedere.</p>
            
            <div class="reason-box">
              <h4 style="margin-top: 0; color: #dc2626;">🚨 Motivo del rifiuto:</h4>
              <p style="font-weight: 600; margin-bottom: ${details ? '10px' : '0'};">${reason}</p>
              ${details ? `<p style="margin-bottom: 0;"><em>Note aggiuntive:</em> ${details}</p>` : ''}
            </div>
            
            <div class="steps-box">
              <h4 style="margin-top: 0; color: #374151;">🔄 Per procedere con la sua iscrizione:</h4>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Acceda alla sua area personale</li>
                <li>Carichi nuovamente il documento corretto</li>
                <li>Attenda la nuova verifica del partner</li>
              </ol>
            </div>
            
            <div class="requirements">
              <h4 style="margin-top: 0; color: #0369a1;">📋 Requisiti documenti:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Formato: PDF, JPG o PNG</li>
                <li>Dimensione massima: 10MB</li>
                <li>Documento leggibile e completo</li>
                <li>Non acquisito da fotocopia</li>
                <li>Immagine nitida e ben illuminata</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="dashboard-button">
                🏠 Accedi all'Area Personale
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">La ringraziamo per la collaborazione e ci scusiamo per l'inconveniente.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto.
            </p>
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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registrazione Completata - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; text-align: center; }
          .registration-info { background-color: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #bbf7d0; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #047857; }
          .info-value { color: #065f46; }
          .next-steps { background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Registrazione Completata!</h1>
          </div>
          
          <div class="content">
            <div class="success-icon">🎉</div>
            
            <p>Gentile <strong>${registrationData.nome}</strong>,</p>
            
            <p>La sua registrazione alla <strong>Piattaforma Diamante</strong> è stata completata con successo!</p>
            
            <div class="registration-info">
              <h4 style="margin-top: 0; color: #047857;">📋 Dettagli della registrazione:</h4>
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
              <h4 style="margin-top: 0; color: #92400e;">📞 Prossimi Passi:</h4>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>Il nostro team la contatterà entro <strong>24-48 ore</strong></li>
                <li>Riceverà informazioni dettagliate sul corso selezionato</li>
                <li>Sarà guidata attraverso il processo di iscrizione completo</li>
                <li>Potrà accedere alla sua area personale una volta attivata</li>
              </ul>
            </div>
            
            <p style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 25px 0;">
              💡 <strong>Consiglio:</strong> Conservi questa email per i suoi archivi personali. Contiene informazioni importanti per il suo percorso formativo.
            </p>
            
            <p style="text-align: center; font-size: 18px; color: #047857; font-weight: 600;">Benvenuto nella famiglia Piattaforma Diamante! 🚀</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto clienti.
            </p>
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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credenziali di Accesso - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0066cc 0%, #004499 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .welcome-icon { font-size: 48px; margin: 20px 0; text-align: center; }
          .credentials-box { background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; }
          .credential-item { margin: 15px 0; padding: 15px; background-color: white; border-radius: 6px; border: 1px solid #fbbf24; }
          .credential-label { font-weight: 600; color: #92400e; display: block; margin-bottom: 8px; }
          .credential-value { font-family: 'Courier New', monospace; font-size: 16px; color: #1f2937; background-color: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all; border: 1px solid #dee2e6; }
          .login-button { 
            background-color: white; 
            color: black; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #0066cc;
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .security-warning { background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 25px; margin: 25px 0; }
          .features-box { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Benvenuto nella piattaforma!</h1>
          </div>
          
          <div class="content">
            <div class="welcome-icon">🎉</div>
            
            <p>Gentile <strong>${userData.nome}</strong>,</p>
            
            <p>La sua registrazione è stata completata con successo! Ora può accedere alla sua area personale utilizzando le credenziali qui di seguito.</p>
            
            <div class="credentials-box">
              <h4 style="margin-top: 0; color: #92400e;">🔐 Le sue credenziali di accesso:</h4>
              <div class="credential-item">
                <span class="credential-label">Email di accesso:</span>
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
              <h4 style="margin-top: 0; color: #dc2626;">⚠️ Importante - Sicurezza</h4>
              <ul style="margin: 15px 0; padding-left: 20px; color: #dc2626;">
                <li><strong>Deve cambiare la password al primo accesso</strong></li>
                <li>La password temporanea è valida solo per il primo login</li>
                <li>Conservi queste credenziali in luogo sicuro</li>
                <li>Non condivida mai le sue credenziali con terzi</li>
                <li>In caso di problemi, contatti immediatamente il supporto</li>
              </ul>
            </div>
            
            <div class="features-box">
              <h4 style="margin-top: 0; color: #0369a1;">🎯 Nella sua area personale potrà:</h4>
              <ul style="margin: 15px 0; padding-left: 20px;">
                <li>📝 Visualizzare le sue iscrizioni e il loro stato</li>
                <li>📄 Gestire i suoi documenti e certificazioni</li>
                <li>🎓 Accedere ai corsi disponibili e ai materiali formativi</li>
                <li>💬 Comunicare direttamente con il suo partner di riferimento</li>
                <li>📊 Monitorare i suoi progressi formativi</li>
                <li>🔔 Ricevere notifiche importanti sui suoi corsi</li>
              </ul>
            </div>
            
            <p style="color: #666; font-size: 14px; background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #0066cc;">
              💡 <strong>Suggerimento:</strong> Dopo il primo accesso, personalizzi la sua password scegliendo una combinazione sicura che ricorderà facilmente.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio contiene informazioni riservate e personali.<br>
              Per assistenza tecnica, contatti il nostro supporto clienti.
            </p>
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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Modificata - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; color: #059669; margin-bottom: 20px; text-align: center; }
          .change-info { background-color: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
          .timestamp { font-weight: 600; color: #047857; font-size: 16px; }
          .security-notice { background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0; }
          .login-button { 
            background-color: white; 
            color: black; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #059669;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Password Modificata</h1>
          </div>
          
          <div class="content">
            <div class="success-icon">🔒</div>
            
            <h2 style="color: #059669; text-align: center; margin-bottom: 25px;">Modifica Completata con Successo!</h2>
            
            <p>Gentile <strong>${userData.nome}</strong>,</p>
            
            <p>Le confermiamo che la sua password è stata modificata con successo sulla Piattaforma Diamante.</p>
            
            <div class="change-info">
              <h4 style="margin-top: 0; color: #047857;">📅 Dettagli della modifica:</h4>
              <div class="timestamp">${userData.timestamp}</div>
            </div>
            
            <div class="security-notice">
              <h4 style="margin-top: 0; color: #92400e;">⚠️ Importante per la sicurezza:</h4>
              <p style="margin-bottom: 0;">Se <strong>NON</strong> ha effettuato lei questa modifica, la preghiamo di contattarci <strong>immediatamente</strong> per mettere in sicurezza il suo account.</p>
            </div>
            
            <p>La sua nuova password è ora attiva e potrà utilizzarla per i prossimi accessi alla piattaforma.</p>
            
            <p style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; border-left: 4px solid #0ea5e9; margin: 25px 0;">
              💡 <strong>Consiglio:</strong> Per mantenere il suo account sicuro, utilizzi sempre password uniche e complesse per ogni servizio online.
            </p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/login" class="login-button">
                🚀 Accedi alla Piattaforma
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza sulla sicurezza, contatti immediatamente il nostro supporto.
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
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Iscrizione Completata - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; margin-bottom: 20px; text-align: center; }
          .course-info { background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 25px; margin: 25px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 12px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #374151; }
          .info-value { color: #111827; }
          .dashboard-button { 
            background-color: white; 
            color: black; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #8b5cf6;
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .next-steps { background-color: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 25px; margin: 25px 0; }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Richiesta di iscrizione</h1>
          </div>
          
          <div class="content">
            <div class="success-icon">🎓</div>
            
            <h2 style="color: #8b5cf6; text-align: center; margin-bottom: 25px;">Benvenuto nel corso!</h2>
            
            <p>Gentile <strong>${enrollmentData.nome}</strong>,</p>
            
            <p>La sua richiesta di iscrizione al corso è stata completata con successo! Completi tutti i restanti steps della piattaforma accedendo alla sua area riservata</p>
            
            <div class="course-info">
              <h4 style="margin-top: 0; color: #374151;">📚 Dettagli del suo corso:</h4>
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
                🏠 Accedi alla sua Area Riservata
              </a>
            </div>
            
            <p style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 25px 0;">
              📎 <strong>Importante:</strong> Conservi questa email per i suoi archivi personali. Contiene informazioni essenziali per il suo percorso formativo.
            </p>
            
            <p style="text-align: center; font-size: 18px; color: #8b5cf6; font-weight: 600;">La sua avventura formativa inizia ora! 🚀</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, acceda alla sua area riservata o contatti il suo partner di riferimento.
            </p>
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
    const dashboardUrl = `${process.env.FRONTEND_URL || ''}/dashboard`;

    const subject = '🚨 Documento non conforme - Azione richiesta';

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documento Non Conforme - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .warning-icon { font-size: 48px; color: #dc2626; margin-bottom: 20px; text-align: center; }
          .document-info { background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .reason-box { background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
          .steps-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .requirements { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .dashboard-button { 
            background-color: white; 
            color: black; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #dc2626;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
          </div>
          
          <div class="content">
            <div class="warning-icon">⚠️</div>
            
            <h2 style="color: #dc2626; text-align: center; margin-bottom: 25px;">Documento Non Conforme</h2>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <div class="document-info">
              <h4 style="margin-top: 0; color: #dc2626;">📄 Documento soggetto a revisione</h4>
              <p style="margin-bottom: 0; font-weight: 600; color: #991b1b;">${documentTypeName}</p>
            </div>
            
            <p>Il documento che ha caricato non è conforme ai requisiti richiesti e necessita di una sua azione per procedere.</p>
            
            <div class="reason-box">
              <h4 style="margin-top: 0; color: #dc2626;">🚨 Motivo del rifiuto:</h4>
              <p style="font-weight: 600; margin-bottom: ${details ? '10px' : '0'};">${reason}</p>
              ${details ? `<p style="margin-bottom: 0;"><em>Note aggiuntive:</em> ${details}</p>` : ''}
            </div>
            
            <div class="steps-box">
              <h4 style="margin-top: 0; color: #374151;">🔄 Per procedere con la sua iscrizione:</h4>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Acceda alla sua area personale</li>
                <li>Carichi nuovamente il documento corretto</li>
                <li>Attenda la nuova verifica del partner</li>
              </ol>
            </div>
            
            <div class="requirements">
              <h4 style="margin-top: 0; color: #0369a1;">📋 Requisiti documenti:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Formato: PDF, JPG o PNG</li>
                <li>Dimensione massima: 10MB</li>
                <li>Documento leggibile e completo</li>
                <li>Non acquisito da fotocopia</li>
                <li>Immagine nitida e ben illuminata</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="dashboard-button">
                🏠 Accedi all'Area Personale
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">La ringraziamo per la collaborazione e ci scusiamo per l'inconveniente.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto.
            </p>
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
- Non acquisito da fotocopia
- Immagine nitida e ben illuminata

Team Diamante - Piattaforma Diamante
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
    const dashboardUrl = `${process.env.FRONTEND_URL || ''}/dashboard`;

    const subject = '✅ Documento approvato';

    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Documento Approvato - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .success-icon { font-size: 48px; color: #059669; margin-bottom: 20px; text-align: center; }
          .document-info { background-color: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .dashboard-button { 
            background-color: white; 
            color: black; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            border: 2px solid #059669;
            font-weight: 600; 
            display: inline-block; 
            margin: 20px 0;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
          </div>
          
          <div class="content">
            <div class="success-icon">✅</div>
            
            <h2 style="color: #059669; text-align: center; margin-bottom: 25px;">Documento Approvato!</h2>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <div class="document-info">
              <h4 style="margin-top: 0; color: #047857;">📄 Documento verificato con successo</h4>
              <p style="margin-bottom: 0; font-weight: 600; color: #065f46;">${documentTypeName}</p>
            </div>
            
            <p>Il documento è stato verificato dal nostro team e <strong>approvato</strong> secondo i criteri richiesti.</p>
            
            <p>Può procedere con il completamento della sua iscrizione e continuare con i prossimi passi del suo percorso formativo accedendo alla sua area personale.</p>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="dashboard-button">
                🏠 Accedi all'Area Personale
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">La ringraziamo per la collaborazione nel processo di verifica.</p>
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

    const text = `
Documento Approvato

Gentile ${userName},

Il suo documento "${documentTypeName}" è stato verificato e approvato.

Può procedere con il completamento della sua iscrizione.

Link area personale: ${dashboardUrl}

Team Diamante - Piattaforma Diamante
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

  // Certification Step Email Notifications
  async sendCertificationDocsApprovedNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getCertificationDocsApprovedTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`✉️ Certification docs approved notification sent to: ${email}`);
  }

  async sendCertificationExamRegisteredNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getCertificationExamRegisteredTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`✉️ Certification exam registered notification sent to: ${email}`);
  }

  async sendCertificationExamCompletedNotification(email: string, userName: string, courseName: string): Promise<void> {
    const template = this.getCertificationExamCompletedTemplate(userName, courseName);
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`✉️ Certification exam completed notification sent to: ${email}`);
  }

  private getCertificationDocsApprovedTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = '✅ Documenti Approvati - Corso di Certificazione';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .step-badge { background-color: #d1fae5; color: #047857; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
          .next-step { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Documenti Approvati</h1>
            <p>Il tuo percorso di certificazione continua!</p>
          </div>
          
          <div class="content">
            <div class="step-badge">📄 Step 3 Completato</div>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <p>I tuoi documenti (carta d'identità e tessera sanitaria) per il corso <strong>${courseName}</strong> sono stati <strong>verificati e approvati</strong> dal nostro team!</p>
            
            <p>Questo è un passo importante nel tuo percorso di certificazione. La verifica dei documenti garantisce l'autenticità e la validità della tua identità per il processo di certificazione.</p>
            
            <div class="next-step">
              <h3>📚 Prossimo step:</h3>
              <p>Il tuo partner procederà ora con l'<strong>iscrizione all'esame</strong>. Ti terremo aggiornato su tutti gli sviluppi.</p>
            </div>
            
            <p>Puoi visualizzare lo stato aggiornato del tuo percorso accedendo alla tua area personale.</p>
          </div>
          
          <div class="footer">
            <p>Ottimo lavoro! Continua così!</p>
            <p><strong>Team Certificazione</strong><br>Piattaforma Diamante</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Documenti Approvati - Corso di Certificazione

Gentile ${userName},

I tuoi documenti per il corso ${courseName} sono stati verificati e approvati!

Questo è un passo importante nel tuo percorso di certificazione.

Prossimo step: Il tuo partner procederà con l'iscrizione all'esame.

Team Certificazione
    `;

    return { subject, html, text };
  }

  private getCertificationExamRegisteredTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = '📝 Iscrizione all\'Esame Completata - Corso di Certificazione';
    
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
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
          .next-step { background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📝 Iscrizione all'Esame</h1>
            <p>Sei pronto per il prossimo passo!</p>
          </div>
          
          <div class="content">
            <div class="step-badge">🎯 Step 4 Completato</div>
            
            <p>Gentile <strong>${userName}</strong>,</p>
            
            <p>La tua <strong>iscrizione all'esame</strong> per il corso <strong>${courseName}</strong> è stata <strong>registrata con successo</strong>!</p>
            
            <p>Il nostro team ha completato tutte le procedure necessarie per iscriverti all'esame di certificazione. Ora sei ufficialmente registrato per sostenere l'esame.</p>
            
            <div class="next-step">
              <h3>🎓 Prossimo step:</h3>
              <p>Quando avrai <strong>sostenuto l'esame</strong>, il tuo partner registrerà il completamento e il tuo percorso di certificazione sarà concluso.</p>
              <p>Riceverai tutte le informazioni necessarie direttamente dal centro d'esame.</p>
            </div>
            
            <p>Puoi visualizzare lo stato aggiornato del tuo percorso accedendo alla tua area personale.</p>
          </div>
          
          <div class="footer">
            <p>In bocca al lupo per il tuo esame!</p>
            <p><strong>Team Certificazione</strong><br>Piattaforma Diamante</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Iscrizione all'Esame Completata - Corso di Certificazione

Gentile ${userName},

La tua iscrizione all'esame per il corso ${courseName} è stata registrata con successo!

Sei ora ufficialmente registrato per sostenere l'esame di certificazione.

Prossimo step: Sostenere l'esame e completare il percorso di certificazione.

In bocca al lupo!

Team Certificazione
    `;

    return { subject, html, text };
  }

  private getCertificationExamCompletedTemplate(userName: string, courseName: string): { subject: string; html: string; text: string } {
    const subject = '🎓 Esame Completato - Certificazione Conseguita!';
    
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
            <h1>🎓 CERTIFICAZIONE CONSEGUITA!</h1>
            <p style="font-size: 18px; margin-top: 15px;">Hai completato con successo il tuo percorso</p>
          </div>
          
          <div class="content">
            <div class="completion-badge">
              ✅ PERCORSO DI CERTIFICAZIONE COMPLETATO
            </div>
            
            <p style="font-size: 18px;">Gentile <strong>${userName}</strong>,</p>
            
            <p><strong>Complimenti!</strong> Hai completato con successo il tuo corso <strong>${courseName}</strong> e <strong>sostenuto l'esame finale</strong>!</p>
            
            <p>Il tuo percorso di certificazione è ora <strong>ufficialmente concluso</strong>. Questo rappresenta un importante traguardo professionale che testimonia le tue competenze e conoscenze acquisite.</p>
            
            <div class="steps-completed">
              <h3 style="margin-top: 0; color: #047857;">🏁 Tutti i passaggi completati:</h3>
              <ul style="margin: 10px 0;">
                <li>✅ <strong>Iscrizione confermata</strong> - Accesso al percorso garantito</li>
                <li>✅ <strong>Pagamento completato</strong> - Tutte le pratiche amministrative concluse</li>
                <li>✅ <strong>Documenti approvati</strong> - Identità verificata e confermata</li>
                <li>✅ <strong>Esame registrato e sostenuto</strong> - Competenze certificate ufficialmente</li>
                <li>✅ <strong>Certificazione conseguita</strong> - Obiettivo raggiunto con successo!</li>
              </ul>
            </div>
            
            <p>Ora hai acquisito una qualificazione ufficiale che potrai utilizzare per il tuo sviluppo professionale e accademico.</p>
            
            <p><strong>Grazie</strong> per aver scelto la Piattaforma Diamante e per la fiducia che ci hai accordato durante tutto il percorso di certificazione.</p>
          </div>
          
          <div class="footer">
            <p style="font-size: 16px; font-weight: 600; color: #059669;">🎉 Congratulazioni per questo straordinario traguardo! 🎉</p>
            <p><strong>Team Certificazione</strong><br>Piattaforma Diamante</p>
            <p style="font-style: italic;">Siamo orgogliosi di aver contribuito al tuo successo!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
🎓 CERTIFICAZIONE CONSEGUITA - Complimenti!

Gentile ${userName},

Complimenti! Hai completato con successo il tuo corso ${courseName} e sostenuto l'esame finale!

Il tuo percorso di certificazione è ora ufficialmente concluso.

Tutti i passaggi completati:
✅ Iscrizione confermata
✅ Pagamento completato  
✅ Documenti approvati
✅ Esame registrato e sostenuto
✅ Certificazione conseguita

Hai acquisito una qualificazione ufficiale per il tuo sviluppo professionale.

🎉 Congratulazioni per questo straordinario traguardo! 🎉

Team Certificazione
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

  // Send partner employee invite email
  async sendPartnerInviteEmail(
    email: string,
    inviteToken: string,
    inviterName: string,
    companyName: string
  ): Promise<void> {
    const inviteUrl = `${process.env.FRONTEND_URL}/partner/accept-invite/${inviteToken}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: `Invito a collaborare con ${companyName} - Piattaforma Diamante`,
      html: this.getPartnerInviteTemplate(inviteToken, inviterName, companyName, inviteUrl),
      text: `
        Ciao,
        
        ${inviterName} ti ha invitato a collaborare con l'azienda ${companyName} sulla Piattaforma Diamante.
        
        Accetta l'invito visitando il seguente link:
        ${inviteUrl}
        
        Questo link è valido per 7 giorni.
        
        Se non hai richiesto questo invito, puoi ignorare questa email.
        
        Cordiali saluti,
        Il team di Piattaforma Diamante
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✉️ Partner invite email sent to: ${email}`);
    } catch (error) {
      console.error('Error sending partner invite email:', error);
      throw error;
    }
  }

  // Alias method for backwards compatibility
  async sendPartnerInvite(
    email: string,
    inviteUrl: string,
    companyName: string,
    inviterName: string,
    role: string
  ): Promise<void> {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: `Invito a collaborare con ${companyName} - Piattaforma Diamante`,
      html: this.getPartnerInviteTemplateV2(inviteUrl, inviterName, companyName, role),
      text: `
        Ciao,
        
        ${inviterName} ti ha invitato a collaborare come ${role} con l'azienda ${companyName} sulla Piattaforma Diamante.
        
        Accetta l'invito visitando il seguente link:
        ${inviteUrl}
        
        Questo link è valido per 72 ore.
        
        Se non hai richiesto questo invito, puoi ignorare questa email.
        
        Cordiali saluti,
        Il team di Piattaforma Diamante
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✉️ Partner invite email sent to: ${email}`);
    } catch (error) {
      console.error('Error sending partner invite email:', error);
      throw error;
    }
  }

  private getPartnerInviteTemplateV2(
    inviteUrl: string, 
    inviterName: string, 
    companyName: string, 
    role: string
  ): string {
    const roleTranslation = role === 'ADMINISTRATIVE' ? 'Amministrativo' : 'Commerciale';
    
    return `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invito Collaborazione - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .invite-icon { font-size: 48px; margin-bottom: 20px; text-align: center; }
          .company-info { background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .role-badge { background-color: #e0f2fe; color: #0369a1; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-block; margin: 10px 0; }
          .accept-button { 
            background-color: #8b5cf6; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Invito di Collaborazione</h1>
          </div>
          
          <div class="content">
            <div class="invite-icon">🤝</div>
            
            <p>Ciao,</p>
            
            <p><strong>${inviterName}</strong> ti ha invitato a collaborare come partner sulla <strong>Piattaforma Diamante</strong>.</p>
            
            <div class="company-info">
              <h3 style="margin-top: 0; color: #374151;">Azienda Partner</h3>
              <p style="font-size: 18px; font-weight: 600; color: #8b5cf6; margin: 10px 0;">${companyName}</p>
              <div class="role-badge">Ruolo: ${roleTranslation}</div>
            </div>
            
            <p>Unendoti al loro team, avrai accesso a:</p>
            <ul>
              ${role === 'ADMINISTRATIVE' ? `
                <li>🎯 Dashboard completa per gestire registrazioni</li>
                <li>📊 Analisi e statistiche dettagliate con dati economici</li>
                <li>👥 Strumenti per la gestione utenti e collaboratori</li>
                <li>📋 Sistema di gestione documenti integrato</li>
                <li>💰 Gestione pagamenti e contratti</li>
                <li>🏢 Creazione e gestione aziende sub-partners</li>
              ` : `
                <li>🎯 Dashboard per gestire registrazioni</li>
                <li>📊 Analisi e statistiche (senza dati economici)</li>
                <li>👥 Strumenti per la gestione utenti</li>
                <li>📋 Sistema di gestione documenti</li>
              `}
            </ul>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="accept-button">
                ✅ Accetta Invito
              </a>
            </div>
            
            <p style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 25px 0; font-size: 14px;">
              ⏱️ <strong>Importante:</strong> Questo invito è valido per <strong>72 ore</strong>. Dopo la scadenza dovrai richiedere un nuovo invito.
            </p>
            
            <p style="font-size: 14px; color: #666;">Se non hai richiesto questo invito o non conosci ${inviterName}, puoi ignorare questa email in sicurezza.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPartnerInviteTemplate(
    inviteToken: string, 
    inviterName: string, 
    companyName: string, 
    inviteUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invito Collaborazione - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .invite-icon { font-size: 48px; margin-bottom: 20px; text-align: center; }
          .company-info { background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .accept-button { 
            background-color: #8b5cf6; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">Invito di Collaborazione</h1>
          </div>
          
          <div class="content">
            <div class="invite-icon">🤝</div>
            
            <p>Ciao,</p>
            
            <p><strong>${inviterName}</strong> ti ha invitato a collaborare come partner sulla <strong>Piattaforma Diamante</strong>.</p>
            
            <div class="company-info">
              <h3 style="margin-top: 0; color: #374151;">Azienda Partner</h3>
              <p style="font-size: 18px; font-weight: 600; color: #8b5cf6; margin-bottom: 0;">${companyName}</p>
            </div>
            
            <p>Unendoti al loro team, avrai accesso a:</p>
            <ul>
              <li>🎯 Dashboard completa per gestire registrazioni</li>
              <li>📊 Analisi e statistiche dettagliate</li>
              <li>👥 Strumenti per la gestione utenti</li>
              <li>📋 Sistema di gestione documenti integrato</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="accept-button">
                ✅ Accetta Invito
              </a>
            </div>
            
            <p style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 25px 0; font-size: 14px;">
              ⏱️ <strong>Importante:</strong> Questo invito è valido per <strong>7 giorni</strong>. Dopo la scadenza dovrai richiedere un nuovo invito.
            </p>
            
            <p style="font-size: 14px; color: #666;">Se non hai richiesto questo invito o non conosci ${inviterName}, puoi ignorare questa email in sicurezza.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente. Per favore non rispondere a questa email.<br>
              Per assistenza, contatti il nostro supporto.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Sub-partner company invitation email
  async sendEmail(options: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }): Promise<void> {
    let template;
    
    switch (options.template) {
      case 'companyInvite':
        template = this.getCompanyInviteTemplate(options.data);
        break;
      case 'subPartnerWelcome':
        template = this.getSubPartnerWelcomeTemplate(options.data);
        break;
      case 'parentNotification':
        template = this.getParentNotificationTemplate(options.data);
        break;
      default:
        throw new Error(`Unknown template: ${options.template}`);
    }

    const mailOptions = {
      from: this.fromEmail,
      to: options.to,
      subject: options.subject,
      html: template.html,
      text: template.text
    };

    await this.transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent to: ${options.to} (template: ${options.template})`);
  }

  private getCompanyInviteTemplate(data: {
    companyName: string;
    parentCompanyName: string;
    inviteUrl: string;
    expiresAt: string;
  }): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invito Creazione Azienda Partner - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 30px; text-align: center; }
          .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .content { padding: 30px; }
          .company-highlight { background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; }
          .accept-button { 
            background-color: #059669; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PIATTAFORMA DIAMANTE</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.9;">Formazione Professionale</div>
            <h1 style="margin: 25px 0 0 0; font-size: 24px;">🏢 Invito Creazione Azienda Partner</h1>
          </div>
          
          <div class="content">
            <div style="text-align: center; font-size: 48px; margin-bottom: 20px;">🤝</div>
            
            <p>Ciao,</p>
            
            <p>Hai ricevuto un invito speciale per creare una nuova <strong>azienda partner</strong> sulla Piattaforma Diamante!</p>
            
            <div class="company-highlight">
              <h3 style="margin-top: 0; color: #047857;">🎯 Dettagli della Nuova Azienda</h3>
              <p style="font-size: 20px; font-weight: 700; color: #059669; margin: 15px 0;">${data.companyName}</p>
              <p style="color: #374151;">Azienda partner di <strong>${data.parentCompanyName}</strong></p>
            </div>
            
            <p>Come <strong>amministratore</strong> della nuova azienda partner, avrai accesso a:</p>
            <ul>
              <li>🎯 Dashboard completa per gestire registrazioni</li>
              <li>📊 Analisi e statistiche dettagliate</li>
              <li>👥 Gestione collaboratori e team</li>
              <li>📋 Sistema di gestione documenti integrato</li>
              <li>💰 Strumenti di gestione pagamenti</li>
              <li>📈 Sistema di tracking commissioni</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${data.inviteUrl}" class="accept-button">
                🚀 Crea la Tua Azienda Partner
              </a>
            </div>
            
            <p style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 25px 0; font-size: 14px;">
              ⏱️ <strong>Importante:</strong> Questo invito è valido fino al <strong>${data.expiresAt}</strong>. Non perdere questa opportunità!
            </p>
            
            <p style="font-size: 14px; color: #666;">Se non hai richiesto questo invito, puoi ignorare questa email in sicurezza.</p>
          </div>
          
          <div class="footer">
            <p><strong>Piattaforma Diamante</strong><br>
            Formazione Professionale di Qualità</p>
            <p style="font-size: 12px; margin-top: 15px;">
              Questo messaggio è stato inviato automaticamente.<br>
              Per assistenza, contatta il nostro supporto.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
INVITO CREAZIONE AZIENDA PARTNER - Piattaforma Diamante

Ciao,

Hai ricevuto un invito per creare una nuova azienda partner sulla Piattaforma Diamante!

Dettagli della Nuova Azienda:
- Nome: ${data.companyName}
- Azienda partner di: ${data.parentCompanyName}

Come amministratore avrai accesso a dashboard completa, analisi, gestione collaboratori e molto altro.

Accetta l'invito visitando: ${data.inviteUrl}

Importante: Questo invito è valido fino al ${data.expiresAt}.

Piattaforma Diamante
    `;

    return { html, text };
  }

  private getSubPartnerWelcomeTemplate(data: {
    firstName: string;
    companyName: string;
    parentCompanyName: string;
    loginUrl: string;
  }): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto - Piattaforma Diamante</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 30px; }
          .welcome-badge { background-color: #f3e8ff; color: #7c3aed; padding: 15px 25px; border-radius: 8px; font-weight: 700; text-align: center; margin: 25px 0; font-size: 18px; }
          .login-button { 
            background-color: #8b5cf6; 
            color: white; 
            padding: 15px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: 600; 
            display: inline-block; 
            margin: 25px 0;
            font-size: 16px;
          }
          .footer { background-color: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Benvenuto su Piattaforma Diamante!</h1>
            <p>La tua azienda partner è stata creata con successo</p>
          </div>
          
          <div class="content">
            <div class="welcome-badge">
              🏢 AZIENDA PARTNER ATTIVATA
            </div>
            
            <p>Caro <strong>${data.firstName}</strong>,</p>
            
            <p><strong>Complimenti!</strong> La tua azienda partner <strong>"${data.companyName}"</strong> è stata creata con successo sulla Piattaforma Diamante!</p>
            
            <p>Sei ora partner affiliato di <strong>${data.parentCompanyName}</strong> e hai accesso completo alla piattaforma come amministratore della tua azienda.</p>
            
            <h3>🚀 Cosa puoi fare ora:</h3>
            <ul>
              <li>📊 Accedere alla dashboard dedicata</li>
              <li>👥 Gestire le registrazioni degli utenti</li>
              <li>📋 Monitorare lo stato dei documenti</li>
              <li>📈 Visualizzare le statistiche</li>
              <li>🔧 Configurare le impostazioni aziendali</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${data.loginUrl}" class="login-button">
                🚪 Accedi alla Dashboard
              </a>
            </div>
            
            <p style="background-color: #ecfdf5; padding: 20px; border-radius: 6px; border-left: 4px solid #10b981; margin: 25px 0;">
              💡 <strong>Suggerimento:</strong> Usa le credenziali che hai appena creato per accedere alla tua area riservata.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Benvenuto nel network Piattaforma Diamante!</strong><br>
            Siamo entusiasti di averti a bordo</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Benvenuto su Piattaforma Diamante!

Caro ${data.firstName},

Complimenti! La tua azienda partner "${data.companyName}" è stata creata con successo!

Sei ora partner affiliato di ${data.parentCompanyName} con accesso completo alla piattaforma.

Accedi alla dashboard: ${data.loginUrl}

Benvenuto nel network Piattaforma Diamante!
    `;

    return { html, text };
  }

  private getParentNotificationTemplate(data: {
    childCompanyName: string;
    parentCompanyName: string;
    adminName: string;
    adminEmail: string;
  }): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <title>Nuova Azienda Figlia Creata</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .info-box { background-color: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Nuova Azienda Figlia Creata!</h1>
          </div>
          
          <div class="content">
            <p>Una nuova azienda figlia è stata creata con successo nel tuo network partner!</p>
            
            <div class="info-box">
              <h3>📋 Dettagli:</h3>
              <p><strong>Azienda Figlia:</strong> ${data.childCompanyName}</p>
              <p><strong>Azienda Parent:</strong> ${data.parentCompanyName}</p>
              <p><strong>Amministratore:</strong> ${data.adminName}</p>
              <p><strong>Email:</strong> ${data.adminEmail}</p>
            </div>
            
            <p>L'amministratore ha completato la registrazione e ha ora accesso completo alla piattaforma.</p>
          </div>
          
          <div class="footer">
            <p>Piattaforma Diamante - Sistema Sub-Partner</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Nuova Azienda Figlia Creata!

Una nuova azienda figlia è stata creata nel tuo network:

Azienda Figlia: ${data.childCompanyName}
Azienda Parent: ${data.parentCompanyName}
Amministratore: ${data.adminName}
Email: ${data.adminEmail}

L'amministratore ha completato la registrazione.

Piattaforma Diamante
    `;

    return { html, text };
  }

  // ==================== DISCOVERY APPROVAL EMAILS ====================

  /**
   * Send registration approved email (Discovery final approval)
   */
  async sendRegistrationApprovedEmail(
    toEmail: string,
    userName: string,
    courseName: string
  ): Promise<boolean> {
    try {
      const { html, text } = this.getRegistrationApprovedEmailTemplate(userName, courseName);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: '✅ Iscrizione Approvata - Discovery',
        html,
        text
      });

      console.log(`✅ Email approvazione iscrizione inviata a: ${toEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Errore invio email approvazione:', error);
      return false;
    }
  }

  /**
   * Send registration rejected email (Discovery rejection)
   */
  async sendRegistrationRejectedEmail(
    toEmail: string,
    userName: string,
    courseName: string,
    reason: string
  ): Promise<boolean> {
    try {
      const { html, text } = this.getRegistrationRejectedEmailTemplate(userName, courseName, reason);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: toEmail,
        subject: '❌ Iscrizione Rifiutata - Richieste Modifiche',
        html,
        text
      });

      console.log(`✅ Email rifiuto iscrizione inviata a: ${toEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Errore invio email rifiuto:', error);
      return false;
    }
  }

  private getRegistrationApprovedEmailTemplate(userName: string, courseName: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .success-box { background-color: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Iscrizione Approvata!</h1>
          </div>

          <div class="content">
            <p>Gentile <strong>${userName}</strong>,</p>

            <div class="success-box">
              <div class="success-icon">🎉</div>
              <h2 style="color: #059669; margin: 0;">La tua iscrizione è stata approvata!</h2>
            </div>

            <p>Siamo lieti di informarti che la tua iscrizione al corso <strong>${courseName}</strong> è stata verificata e approvata dal nostro team Discovery.</p>

            <p><strong>Cosa succede adesso?</strong></p>
            <ul>
              <li>✅ Tutti i tuoi documenti sono stati verificati e approvati</li>
              <li>📧 Riceverai ulteriori comunicazioni riguardo il proseguimento del corso</li>
              <li>💼 Il tuo partner di riferimento ti contatterà per i prossimi step</li>
            </ul>

            <p>Per qualsiasi domanda, contatta il tuo partner di riferimento o il nostro supporto.</p>
          </div>

          <div class="footer">
            <p>Piattaforma Discovery - Sistema di Gestione Iscrizioni</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Iscrizione Approvata!

Gentile ${userName},

Siamo lieti di informarti che la tua iscrizione al corso ${courseName} è stata verificata e approvata dal nostro team Discovery.

Cosa succede adesso?
- Tutti i tuoi documenti sono stati verificati e approvati
- Riceverai ulteriori comunicazioni riguardo il proseguimento del corso
- Il tuo partner di riferimento ti contatterà per i prossimi step

Per qualsiasi domanda, contatta il tuo partner di riferimento o il nostro supporto.

Piattaforma Discovery
    `;

    return { html, text };
  }

  private getRegistrationRejectedEmailTemplate(userName: string, courseName: string, reason: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .warning-box { background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .reason-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Richieste Modifiche</h1>
          </div>

          <div class="content">
            <p>Gentile <strong>${userName}</strong>,</p>

            <div class="warning-box">
              <h3 style="color: #d97706; margin-top: 0;">La tua iscrizione richiede delle modifiche</h3>
              <p>Il nostro team Discovery ha rilevato alcuni problemi con la tua iscrizione al corso <strong>${courseName}</strong>.</p>
            </div>

            <div class="reason-box">
              <h4 style="margin-top: 0;">Motivo:</h4>
              <p>${reason}</p>
            </div>

            <p><strong>Cosa devi fare?</strong></p>
            <ul>
              <li>📞 Contatta il tuo partner di riferimento per maggiori dettagli</li>
              <li>📄 Apporta le modifiche richieste ai documenti o alle informazioni</li>
              <li>🔄 Ricarica i documenti corretti attraverso il tuo partner</li>
            </ul>

            <p>Una volta apportate le correzioni, la tua iscrizione sarà nuovamente sottoposta a verifica.</p>
          </div>

          <div class="footer">
            <p>Piattaforma Discovery - Sistema di Gestione Iscrizioni</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Richieste Modifiche - Iscrizione

Gentile ${userName},

Il nostro team Discovery ha rilevato alcuni problemi con la tua iscrizione al corso ${courseName}.

Motivo:
${reason}

Cosa devi fare?
- Contatta il tuo partner di riferimento per maggiori dettagli
- Apporta le modifiche richieste ai documenti o alle informazioni
- Ricarica i documenti corretti attraverso il tuo partner

Una volta apportate le correzioni, la tua iscrizione sarà nuovamente sottoposta a verifica.

Piattaforma Discovery
    `;

    return { html, text };
  }
}

export default new EmailService();