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