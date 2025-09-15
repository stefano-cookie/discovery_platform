import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContractData {
  fullName: string;
  birthDate: string;
  birthPlace: string;
  address: string;
  province: string;
  zipCode: string;
  fiscalCode: string;
  email: string;
  phone: string;
  totalAmount: string;
  contractDate: string;
  selectedServices: Array<{
    name: string;
    price: string;
    secondService?: string;
    secondPrice?: string;
  }>;
  paymentPlan: Array<{
    number: string;
    amount: string;
    dueDate: string;
    secondNumber?: string;
    secondAmount?: string;
    secondDueDate?: string;
  }>;
}

export class ContractService {
  private templatePath = path.join(__dirname, '../../templates/contract-template.html');

  constructor() {
    // Registra helper Handlebars
    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    });

    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Intl.DateTimeFormat('it-IT').format(date);
    });
  }

  async generateContract(registrationId: string): Promise<Buffer> {
    try {
      console.log(`[CONTRACT_SERVICE] Starting contract generation for: ${registrationId}`);
      
      // Recupera i dati dell'iscrizione dal database
      const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
          user: {
            include: {
              profile: true
            }
          },
          offer: {
            include: {
              course: true
            }
          },
          payments: true
        }
      });

      if (!registration) {
        console.log(`[CONTRACT_SERVICE] Error: Registration not found: ${registrationId}`);
        throw new Error('Registrazione non trovata');
      }
      
      console.log(`[CONTRACT_SERVICE] Registration data loaded for user: ${registration.user?.email}`);

      console.log('Registration data:', {
        id: registration.id,
        user: registration.user?.email,
        profile: registration.user?.profile ? 'PRESENT' : 'MISSING',
        profileData: registration.user?.profile,
        offer: registration.offer?.name,
        originalAmount: registration.originalAmount,
        finalAmount: registration.finalAmount,
        installments: registration.installments
      });

      // Prepara i dati per il template
      const contractData = this.prepareContractData(registration);
      
      console.log('Contract data prepared:', JSON.stringify(contractData, null, 2));

      // Legge il template HTML
      console.log(`[CONTRACT_SERVICE] Reading template from: ${this.templatePath}`);
      if (!fs.existsSync(this.templatePath)) {
        console.log(`[CONTRACT_SERVICE] Error: Template file not found: ${this.templatePath}`);
        throw new Error(`Template file not found: ${this.templatePath}`);
      }
      const templateHtml = fs.readFileSync(this.templatePath, 'utf8');
      console.log(`[CONTRACT_SERVICE] Template loaded, length: ${templateHtml.length}`);
      
      // Compila il template con Handlebars
      const template = Handlebars.compile(templateHtml);
      const html = template(contractData);

      // Genera il PDF usando Puppeteer
      console.log('[CONTRACT_SERVICE] Launching Puppeteer...');
      console.log('[CONTRACT_SERVICE] Puppeteer executable path:', puppeteer.executablePath());
      
      // Verifica se Chrome esiste e può essere eseguito
      const chromeExecutable = puppeteer.executablePath();
      if (!fs.existsSync(chromeExecutable)) {
        console.error('[CONTRACT_SERVICE] Chrome executable not found at:', chromeExecutable);
        throw new Error('Chrome/Chromium non è installato sul server. Contattare l\'amministratore di sistema.');
      }
      
      let browser;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        });
        console.log('[CONTRACT_SERVICE] Puppeteer browser launched successfully');
      } catch (puppeteerError) {
        console.error('[CONTRACT_SERVICE] Puppeteer launch failed:', puppeteerError);
        const errorMessage = puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError);
        
        // Check if it's a missing library error
        if (errorMessage.includes('error while loading shared libraries')) {
          console.error('[CONTRACT_SERVICE] Missing system libraries detected');
          console.error('[CONTRACT_SERVICE] The following packages need to be installed:');
          console.error('[CONTRACT_SERVICE] sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libatspi2.0-0 libxdamage1 libasound2');
          
          // Provide a user-friendly error message
          throw new Error('Il server non ha le librerie necessarie per generare i PDF. Contattare l\'amministratore di sistema per installare le dipendenze richieste.');
        }
        
        console.error('[CONTRACT_SERVICE] Puppeteer error stack:', puppeteerError instanceof Error ? puppeteerError.stack : 'No stack trace');
        
        // Try alternative configurations
        const alternativePaths = [
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/snap/bin/chromium'
        ];
        
        let alternativeFound = false;
        for (const altPath of alternativePaths) {
          if (fs.existsSync(altPath)) {
            console.log(`[CONTRACT_SERVICE] Trying alternative browser at: ${altPath}`);
            try {
              browser = await puppeteer.launch({
                headless: true,
                args: [
                  '--no-sandbox',
                  '--disable-setuid-sandbox', 
                  '--disable-dev-shm-usage',
                  '--disable-gpu',
                  '--no-zygote'
                ],
                executablePath: altPath
              });
              console.log(`[CONTRACT_SERVICE] Successfully launched with ${altPath}`);
              alternativeFound = true;
              break;
            } catch (altError) {
              console.log(`[CONTRACT_SERVICE] Failed with ${altPath}: ${altError instanceof Error ? altError.message : String(altError)}`);
            }
          }
        }
        
        if (!alternativeFound) {
          throw new Error(`Impossibile avviare il browser per generare il PDF. Errore: ${errorMessage}`);
        }
      }

      if (!browser) {
        throw new Error('Browser non inizializzato correttamente');
      }

      const page = await browser.newPage();
      console.log('[CONTRACT_SERVICE] Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('[CONTRACT_SERVICE] Generating PDF...');

      const pdfBuffer = Buffer.from(await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      }));
      
      console.log(`[CONTRACT_SERVICE] PDF generated, buffer size: ${pdfBuffer.length}`);
      await browser.close();
      console.log('[CONTRACT_SERVICE] Browser closed');

      return pdfBuffer;

    } catch (error) {
      console.error('Errore generazione contratto:', error);
      throw new Error('Errore durante la generazione del contratto');
    }
  }

  private prepareContractData(registration: any): ContractData {
    const user = registration.user;
    const profile = registration.user?.profile;
    const offer = registration.offer;

    // Formato data italiana
    const formatDate = (date: Date | string) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('it-IT');
    };

    // Calcola l'importo totale corretto - converti string in number
    const finalAmount = registration.finalAmount ? parseFloat(registration.finalAmount.toString()) : null;
    const originalAmount = registration.originalAmount ? parseFloat(registration.originalAmount.toString()) : null;
    const offerPrice = offer?.totalAmount ? parseFloat(offer.totalAmount.toString()) : null;
    
    const totalAmount = finalAmount || offerPrice || originalAmount || 1500;
    
    console.log('Amount calculation:', {
      finalAmount,
      originalAmount, 
      offerPrice,
      totalAmount
    });

    // Prepara servizi selezionati basati sul tipo di offerta
    const selectedServices = this.prepareServices(registration, offer, totalAmount);

    // Prepara piano pagamenti con importi reali
    const paymentPlan = this.preparePaymentPlan(registration, totalAmount);

    return {
      fullName: profile ? `${profile.nome} ${profile.cognome}`.toUpperCase() : 'NOME COGNOME',
      birthDate: profile?.dataNascita ? formatDate(profile.dataNascita) : '',
      birthPlace: profile?.luogoNascita?.toUpperCase() || '',
      address: profile ? `${profile.residenzaVia} - ${profile.residenzaCitta}` : '',
      province: profile?.residenzaProvincia?.toUpperCase() || '',
      zipCode: profile?.residenzaCap || '',
      fiscalCode: profile?.codiceFiscale?.toUpperCase() || '',
      email: user?.email || '',
      phone: profile?.telefono || '',
      totalAmount: totalAmount ? `${totalAmount.toFixed(2).replace('.', ',')}` : '0,00',
      contractDate: formatDate(registration.createdAt),
      selectedServices,
      paymentPlan
    };
  }

  private prepareServices(registration: any, offer: any, totalAmount: number): Array<{
    name: string;
    price: string;
    secondService?: string;
    secondPrice?: string;
  }> {
    // Mostra solo il corso effettivo della registrazione
    const courseName = offer?.course?.name || offer?.name || 'Corso di Formazione';

    return [{
      name: courseName,
      price: totalAmount ? `${totalAmount.toFixed(2).replace('.', ',')}` : '0,00'
    }];
  }

  private preparePaymentPlan(registration: any, totalAmount: number): Array<{
    number: string;
    amount: string;
    dueDate: string;
    secondNumber?: string;
    secondAmount?: string;
    secondDueDate?: string;
  }> {
    const paymentPlan = [];
    let allPayments: any[] = [];
    
    // Verifica se esistono pagamenti già registrati
    if (registration.payments && registration.payments.length > 0) {
      // Usa i pagamenti reali dalla registrazione
      allPayments = registration.payments.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    } else if (registration.offer?.customPaymentPlan?.payments) {
      // Usa il piano pagamenti personalizzato dall'offerta
      allPayments = registration.offer.customPaymentPlan.payments;
    } else {
      // Piano pagamenti di default basato su installments della registrazione
      const today = new Date();
      const installments = registration.installments || 12;
      
      if (installments > 1) {
        // Per corsi con rate multiple: acconto €1500 + rate sul restante
        // L'acconto NON è contato come rata, quindi se installments = 10, avremo 1 acconto + 10 rate
        const downPayment = 1500;
        const installmentableAmount = Math.max(0, totalAmount - downPayment);
        const monthlyAmount = installments > 0 ? installmentableAmount / installments : installmentableAmount;

        // Aggiungi l'acconto come primo pagamento (paymentNumber 0)
        const downPaymentDate = new Date(today);
        downPaymentDate.setDate(downPaymentDate.getDate() + 7); // 7 giorni dopo registrazione

        allPayments.push({
          amount: downPayment,
          dueDate: downPaymentDate,
          paymentNumber: 0
        });

        // Calcola le rate mensili a partire da 37 giorni dopo la registrazione
        const baseDate = new Date(today);
        baseDate.setDate(baseDate.getDate() + 37); // 7 giorni acconto + 30 giorni prima rata

        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          // Calcola importo per ultima rata (remainder)
          let amount = monthlyAmount;
          if (i === installments - 1) {
            // Ultima rata: aggiusta per eventuali differenze di arrotondamento
            const totalPaid = monthlyAmount * (installments - 1);
            amount = installmentableAmount - totalPaid;
          }

          allPayments.push({
            amount: amount,
            dueDate: dueDate,
            paymentNumber: i + 1
          });
        }
      } else {
        // Per pagamento unico: senza acconto
        allPayments.push({
          amount: totalAmount,
          dueDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 giorni dopo
          paymentNumber: 1
        });
      }
    }

    // Organizza i pagamenti per la visualizzazione in tabella
    // Se ci sono pochi pagamenti (<=6), li mostriamo verticalmente (uno per riga)
    // Se ci sono molti pagamenti (>6), li organizziamo in 2 colonne
    if (allPayments.length <= 6) {
      // Layout verticale - un pagamento per riga
      for (let i = 0; i < allPayments.length; i++) {
        const payment = allPayments[i];
        // Gestisci correttamente la numerazione: paymentNumber 0 = Acconto, altrimenti Rata N
        const paymentLabel = payment.paymentNumber === 0 ? 'Acconto' : 
                           payment.paymentNumber ? `Rata ${payment.paymentNumber}` : 
                           `Rata ${i + 1}`;
        
        paymentPlan.push({
          number: paymentLabel,
          amount: `${payment.amount.toFixed(2).replace('.', ',')}`,
          dueDate: new Date(payment.dueDate).toLocaleDateString('it-IT'),
          secondNumber: undefined,
          secondAmount: undefined,
          secondDueDate: undefined
        });
      }
    } else {
      // Layout a 2 colonne per molti pagamenti
      for (let i = 0; i < allPayments.length; i += 2) {
        const firstPayment = allPayments[i];
        const secondPayment = allPayments[i + 1];
        
        // Gestisci correttamente la numerazione per il primo pagamento
        const firstLabel = firstPayment.paymentNumber === 0 ? 'Acconto' : 
                          firstPayment.paymentNumber ? `Rata ${firstPayment.paymentNumber}` : 
                          `Rata ${i + 1}`;
        
        // Gestisci correttamente la numerazione per il secondo pagamento
        const secondLabel = secondPayment ? (
          secondPayment.paymentNumber === 0 ? 'Acconto' :
          secondPayment.paymentNumber ? `Rata ${secondPayment.paymentNumber}` :
          `Rata ${i + 2}`
        ) : undefined;
        
        paymentPlan.push({
          number: firstLabel,
          amount: `${firstPayment.amount.toFixed(2).replace('.', ',')}`,
          dueDate: new Date(firstPayment.dueDate).toLocaleDateString('it-IT'),
          secondNumber: secondLabel,
          secondAmount: secondPayment ? `${secondPayment.amount.toFixed(2).replace('.', ',')}` : undefined,
          secondDueDate: secondPayment ? new Date(secondPayment.dueDate).toLocaleDateString('it-IT') : undefined
        });
      }
    }

    return paymentPlan;
  }

  async saveContract(registrationId: string, pdfBuffer: Buffer): Promise<string> {
    try {
      console.log(`[CONTRACT_SAVE] Starting save for registration: ${registrationId}`);
      console.log(`[CONTRACT_SAVE] __dirname: ${__dirname}`);
      
      // Crea directory per i contratti se non exists
      const contractsDir = path.join(__dirname, '../../uploads/contracts');
      console.log(`[CONTRACT_SAVE] Contracts directory: ${contractsDir}`);
      
      if (!fs.existsSync(contractsDir)) {
        console.log(`[CONTRACT_SAVE] Creating directory: ${contractsDir}`);
        fs.mkdirSync(contractsDir, { recursive: true });
      } else {
        console.log(`[CONTRACT_SAVE] Directory already exists: ${contractsDir}`);
      }

      // Salva il file PDF
      const fileName = `contract_${registrationId}.pdf`;
      const filePath = path.join(contractsDir, fileName);
      console.log(`[CONTRACT_SAVE] Saving file to: ${filePath}`);
      
      fs.writeFileSync(filePath, pdfBuffer);
      console.log(`[CONTRACT_SAVE] File saved successfully, size: ${pdfBuffer.length} bytes`);

      const returnPath = `/uploads/contracts/${fileName}`;
      console.log(`[CONTRACT_SAVE] Returning URL path: ${returnPath}`);
      return returnPath;
    } catch (error) {
      console.error('[CONTRACT_SAVE] Error saving contract:', error);
      console.error('[CONTRACT_SAVE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error('Errore durante il salvataggio del contratto');
    }
  }
}