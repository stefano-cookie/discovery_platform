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
  private templatePath: string;

  /**
   * Calculate the project root directory
   * Works in both development and production environments
   */
  private getProjectRoot(): string {
    // In development: __dirname is like /path/to/project/backend/src/services
    // In production: __dirname is like /path/to/project/backend/dist/services

    let currentDir = __dirname;

    // Walk up the directory tree to find the project root
    // Look for package.json or backend directory to identify project root
    while (currentDir !== path.dirname(currentDir)) { // Not at filesystem root
      const parentDir = path.dirname(currentDir);

      // Check if parent contains backend directory (indicating project root)
      if (fs.existsSync(path.join(parentDir, 'backend')) &&
          (fs.existsSync(path.join(parentDir, 'package.json')) ||
           fs.existsSync(path.join(parentDir, 'frontend')))) {
        // Found project root
        return parentDir;
      }

      currentDir = parentDir;
    }

    // Fallback: assume current working directory is project root
    // Using fallback project root
    return process.cwd();
  }

  constructor() {
    // Calculate project root directory - works in both development and production
    const projectRoot = this.getProjectRoot();

    // In development: src/services -> templates/
    // In production: dist/services -> dist/templates/
    const templatePaths = [
      path.join(__dirname, '../../templates/contract-template.html'), // Development
      path.join(__dirname, '../templates/contract-template.html'),    // Production (dopo build)
      path.join(projectRoot, 'backend/templates/contract-template.html'), // Production from project root
      path.join(process.cwd(), 'templates/contract-template.html'),    // Fallback current dir
    ];

    this.templatePath = templatePaths.find(templatePath => {
      const exists = fs.existsSync(templatePath);
      // Checking template path
      return exists;
    }) || templatePaths[0]; // Default to first path if none found

    // Using template path set

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
      // Starting contract generation
      
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
        // Registration not found
        throw new Error('Registrazione non trovata');
      }
      
      // Registration data loaded

      // Registration data logged

      // Prepara i dati per il template
      const contractData = this.prepareContractData(registration);
      
      // Contract data prepared

      // Legge il template HTML
      // Reading template
      if (!fs.existsSync(this.templatePath)) {
        // Template file not found
        throw new Error(`Template file not found: ${this.templatePath}`);
      }
      const templateHtml = fs.readFileSync(this.templatePath, 'utf8');
      // Template loaded
      
      // Compila il template con Handlebars
      const template = Handlebars.compile(templateHtml);
      const html = template(contractData);

      // Genera il PDF usando Puppeteer
      // Launching Puppeteer
      
      // Verifica se Chrome esiste e può essere eseguito
      const chromeExecutable = puppeteer.executablePath();
      if (!fs.existsSync(chromeExecutable)) {
        // Chrome executable not found
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
        // Puppeteer browser launched successfully
      } catch (puppeteerError) {
        // Puppeteer launch failed
        const errorMessage = puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError);
        
        // Check if it's a missing library error
        if (errorMessage.includes('error while loading shared libraries')) {
          // Missing system libraries detected
          
          // Provide a user-friendly error message
          throw new Error('Il server non ha le librerie necessarie per generare i PDF. Contattare l\'amministratore di sistema per installare le dipendenze richieste.');
        }
        
        // Puppeteer error occurred
        
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
            // Trying alternative browser
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
              // Successfully launched with alternative browser
              alternativeFound = true;
              break;
            } catch (altError) {
              // Failed with alternative browser
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
      // Setting page content
      await page.setContent(html, { waitUntil: 'networkidle0' });
      // Generating PDF

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
      
      // PDF generated successfully
      await browser.close();
      // Browser closed

      return pdfBuffer;

    } catch (error) {
      // Error generating contract
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
    
    // Amount calculation completed

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
      // Starting contract save

      // Calculate project root directory for consistent path resolution
      const projectRoot = this.getProjectRoot();
      const contractsDir = path.join(projectRoot, 'backend/uploads/contracts');
      // Project root and contracts directory set

      if (!fs.existsSync(contractsDir)) {
        // Creating contracts directory
        fs.mkdirSync(contractsDir, { recursive: true });
      } else {
        // Contracts directory already exists
      }

      // Salva il file PDF
      const fileName = `contract_${registrationId}.pdf`;
      const filePath = path.join(contractsDir, fileName);
      // Saving contract file

      fs.writeFileSync(filePath, pdfBuffer);
      // File saved successfully

      const returnPath = `/uploads/contracts/${fileName}`;
      // Returning URL path
      return returnPath;
    } catch (error) {
      // Error saving contract
      throw new Error('Errore durante il salvataggio del contratto');
    }
  }
}